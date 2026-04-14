// hcs-proxy — Cloudflare Worker
// Étape 1 (détourage) : remove.bg  ← remplace PicWish
// Étape 2 (amélioration) + Smart Crop : PicWish (inchangé)

const MAX_BODY_SIZE   = 1024 * 1024 * 15;
const MAX_TOKENS_ALLOWED = 2000;
const RATE_LIMIT_MAX  = 30;
const RATE_LIMIT_WINDOW = 60_000;
const ipCounters = new Map();

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return corsResponse(null, 204, env);

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return corsResponse(JSON.stringify({ status: 'ok', worker: 'hcs-proxy' }), 200, env);
    }

    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    if (allowedOrigin !== '*' && origin && origin !== allowedOrigin) {
      return errorResponse('Origine non autorisée', 403);
    }

    const clientSecret = request.headers.get('X-Worker-Secret');
    if (!clientSecret || clientSecret !== env.WORKER_SECRET) {
      return errorResponse('Non autorisé', 401);
    }

    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitError = checkRateLimit(clientIP);
    if (rateLimitError) return errorResponse(rateLimitError, 429);

    const contentLength = parseInt(request.headers.get('Content-Length') || '0');
    if (contentLength > MAX_BODY_SIZE) return errorResponse('Payload trop volumineux', 413);

    try {
      if (url.pathname === '/api/chat'             && request.method === 'POST') return await handleChat(request, env);
      if (url.pathname === '/api/images'           && request.method === 'POST') return await handleImages(request, env);
      if (url.pathname === '/api/dropbox/upload'   && request.method === 'POST') return await handleDropboxUpload(request, env);
      if (url.pathname === '/api/picwish'          && request.method === 'POST') return await handlePicWish(request, env);
      if (url.pathname === '/api/dropbox/archive'  && request.method === 'POST') return await handleDropboxArchive(request, env);
      if (url.pathname === '/api/claude'           && request.method === 'POST') return await handleClaude(request, env);
      if (url.pathname === '/api/replicate'        && request.method === 'POST') return await handleReplicate(request, env);
      return errorResponse('Route introuvable', 404);
    } catch (err) {
      console.error('Worker error:', err);
      return errorResponse('Erreur interne du serveur', 500);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PICWISH — handler principal
// ─────────────────────────────────────────────────────────────────────────────
async function handlePicWish(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return errorResponse('JSON invalide', 400); }

  const { image_base64, operation } = body;

  if (!['remove-background', 'enhance', 'smart-crop'].includes(operation)) {
    return errorResponse('operation invalide (remove-background | enhance | smart-crop)', 400);
  }
  if (operation !== 'smart-crop' && (!image_base64 || typeof image_base64 !== 'string')) {
    return errorResponse('image_base64 requis pour cette opération', 400);
  }

  // ── Étape 1 : détourage → PicWish Matting ────────────────────────────────
  if (operation === 'remove-background') {
    return await handlePicWishMatteing(image_base64, env);
  }

  // ── Étapes 2 & 3 : amélioration + smart-crop → PicWish ───────────────────
  try {
    const endpoints = {
      'enhance':    'https://techhk.aoscdn.com/api/tasks/visual/scale',
      'smart-crop': 'https://techhk.aoscdn.com/api/tasks/visual/correction'
    };
    const picwishEndpoint = endpoints[operation];
    let picRes;

    if (operation === 'smart-crop') {
      if (!body.image_url) throw new Error('image_url requis pour smart-crop');
      picRes = await fetch(picwishEndpoint, {
        method: 'POST',
        headers: { 'X-API-KEY': env.PICWISH_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `image_url=${encodeURIComponent(body.image_url)}&sync=0`
      });
    } else {
      const imageBuffer = base64ToArrayBuffer(image_base64);
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('image_file', blob, 'image.jpg');
      formData.append('sync', '0');
      picRes = await fetch(picwishEndpoint, {
        method: 'POST',
        headers: { 'X-API-KEY': env.PICWISH_API_KEY },
        body: formData
      });
    }

    const picRaw = await picRes.text();
    let picData;
    try { picData = JSON.parse(picRaw); }
    catch { throw new Error(`PicWish réponse non-JSON (${picRes.status}): ${picRaw.slice(0, 120)}`); }

    if (picData.status === 200 && picData.data?.state === 1) {
      const resultUrl = picData.data.image || picData.data.fore_image;
      if (!resultUrl) throw new Error(`URL résultat introuvable: ${JSON.stringify(picData.data)}`);
      return corsResponse(JSON.stringify({ success: true, result_url: resultUrl }), 200, null, true);
    }

    if (picData.status !== 200 || !picData.data?.task_id) {
      throw new Error(`PicWish soumission échouée: ${JSON.stringify(picData).slice(0, 200)}`);
    }

    const taskId   = picData.data.task_id;
    const pollUrl  = `${picwishEndpoint}/${taskId}`;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const pollRes  = await fetch(pollUrl, { headers: { 'X-API-KEY': env.PICWISH_API_KEY } });
      const pollData = await pollRes.json();
      const state    = pollData.data?.state ?? -99;
      if (state < 0) throw new Error(`PicWish échec state=${state}: ${JSON.stringify(pollData).slice(0, 200)}`);
      if (state === 1) {
        const resultUrl = pollData.data.image || pollData.data.fore_image;
        if (!resultUrl) throw new Error(`URL résultat introuvable: ${JSON.stringify(pollData.data)}`);
        return corsResponse(JSON.stringify({ success: true, result_url: resultUrl }), 200, null, true);
      }
    }
    throw new Error('Timeout PicWish (30s)');
  } catch (err) {
    console.error('handlePicWish error:', err.message);
    return errorResponse(`Erreur PicWish: ${err.message}`, 502);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PICWISH MATTING — détourage logos & graphiques via PicWish
// Retourne { success: true, result_base64: "data:image/png;base64,..." }
// ─────────────────────────────────────────────────────────────────────────────
async function handlePicWishMatteing(image_base64, env) {
  try {
    if (!env.PICWISH_API_KEY) throw new Error('PICWISH_API_KEY manquant dans les secrets Worker');

    // PicWish Open API — suppression de fond (logos & graphiques)
    const formData = new FormData();
    formData.append('image_base64', image_base64);

    const res = await fetch('https://api.picwish.com/open-api/async-task/remove-image-background', {
      method: 'POST',
      headers: { 'X-API-KEY': env.PICWISH_API_KEY },
      body: formData
    });

    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); }
    catch { throw new Error(`PicWish réponse non-JSON (${res.status}): ${raw.slice(0, 120)}`); }

    if (!data.data?.task_id) {
      throw new Error(`PicWish soumission échouée: ${JSON.stringify(data).slice(0, 200)}`);
    }

    // Polling du résultat
    const taskId  = data.data.task_id;
    const pollUrl = `https://api.picwish.com/open-api/async-task/${taskId}`;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const p   = await fetch(pollUrl, { headers: { 'X-API-KEY': env.PICWISH_API_KEY } });
      const pd  = await p.json();
      const state = pd.data?.state ?? -99;
      if (state < 0) throw new Error(`PicWish matting échoué state=${state}`);
      if (state === 1) {
        const resultUrl = pd.data.image || pd.data.fore_image;
        if (!resultUrl) throw new Error('URL résultat introuvable');
        const imgRes = await fetch(resultUrl);
        if (!imgRes.ok) throw new Error(`Téléchargement résultat échoué: ${imgRes.status}`);
        const arrayBuffer = await imgRes.arrayBuffer();
        const b64 = arrayBufferToBase64(arrayBuffer);
        return corsResponse(
          JSON.stringify({ success: true, result_base64: `data:image/png;base64,${b64}` }),
          200, null, true
        );
      }
    }
    throw new Error('Timeout PicWish matting (30s)');

  } catch (err) {
    console.error('handlePicWishMatteing error:', err.message);
    return errorResponse(`Erreur matting: ${err.message}`, 502);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE.BG — détourage précis (gardé en réserve)
// Retourne { success: true, result_base64: "data:image/png;base64,..." }
// ─────────────────────────────────────────────────────────────────────────────
async function handleRemoveBg(image_base64, env) {
  try {
    if (!env.REMOVEBG_API_KEY) throw new Error('REMOVEBG_API_KEY manquant dans les secrets Worker');

    // ✅ image_file_b64 : paramètre officiel remove.bg — envoie le base64 pur directement
    //    Évite tout problème de type MIME (JPEG/PNG/WEBP détecté automatiquement côté serveur)
    const formData = new FormData();
    formData.append('image_file_b64', image_base64);
    formData.append('size',              'auto');    // qualité auto (résolution préservée)
    formData.append('type',              'graphic'); // logos & illustrations → conserve TOUT (texte, bords)
    formData.append('format',            'png');     // résultat toujours PNG transparent
    formData.append('semitransparency',  'true');    // préserve les demi-teintes et ombres douces

    const res = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': env.REMOVEBG_API_KEY },
      body: formData
    });

    if (!res.ok) {
      let errMsg = `remove.bg HTTP ${res.status}`;
      try {
        const errData = await res.json();
        errMsg += ` — ${errData.errors?.[0]?.title || JSON.stringify(errData)}`;
      } catch {}
      throw new Error(errMsg);
    }

    // Réponse OK = PNG binaire → on convertit en base64 pour renvoyer au frontend
    const arrayBuffer  = await res.arrayBuffer();
    const base64Result = arrayBufferToBase64(arrayBuffer);
    const dataUrl      = `data:image/png;base64,${base64Result}`;

    return corsResponse(
      JSON.stringify({ success: true, result_base64: dataUrl }),
      200, null, true
    );
  } catch (err) {
    console.error('handleRemoveBg error:', err.message);
    return errorResponse(`Erreur remove.bg: ${err.message}`, 502);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Autres handlers (inchangés)
// ─────────────────────────────────────────────────────────────────────────────
async function handleChat(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('JSON invalide', 400); }

  const { messages, model = 'gpt-4o', max_tokens = 800 } = body;
  if (!Array.isArray(messages) || messages.length === 0) return errorResponse('messages[] requis', 400);
  if (messages.length > 20) return errorResponse('Trop de messages (max 20)', 400);
  for (const msg of messages) {
    if (!['system', 'user', 'assistant'].includes(msg.role)) return errorResponse('Rôle de message invalide', 400);
    if (typeof msg.content !== 'string' || msg.content.length > 8000) return errorResponse('Contenu de message invalide ou trop long', 400);
  }
  const safeTokens     = Math.min(parseInt(max_tokens) || 800, MAX_TOKENS_ALLOWED);
  const allowedModels  = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'];
  if (!allowedModels.includes(model)) return errorResponse(`Modèle non autorisé. Utilisez : ${allowedModels.join(', ')}`, 400);

  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: safeTokens, temperature: 0.8 })
  });
  if (!upstream.ok) {
    const errText = await upstream.text();
    return errorResponse(`Erreur OpenAI (${upstream.status})`, upstream.status);
  }
  return corsResponse(JSON.stringify(await upstream.json()), 200, null, true);
}

async function handleImages(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('JSON invalide', 400); }

  const { prompt, size = '1024x1024', quality = 'hd' } = body;
  if (!prompt || typeof prompt !== 'string') return errorResponse('prompt requis', 400);
  if (prompt.length > 2000) return errorResponse('Prompt trop long (max 2000 chars)', 400);
  const allowedSizes = ['1024x1024', '1792x1024', '1024x1792'];
  if (!allowedSizes.includes(size)) return errorResponse('Taille invalide', 400);

  const upstream = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size, quality })
  });
  if (!upstream.ok) return errorResponse(`Erreur DALL-E (${upstream.status})`, upstream.status);
  return corsResponse(JSON.stringify(await upstream.json()), 200, null, true);
}

async function handleDropboxUpload(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('JSON invalide', 400); }

  const { imageUrl, fileName, folder } = body;
  if (!imageUrl || !fileName || !folder) return errorResponse('imageUrl, fileName et folder sont requis', 400);
  if (!imageUrl.startsWith('https://oaidalleapiprodscus.blob.core.windows.net/') && !imageUrl.startsWith('https://images.openai.com/')) {
    return errorResponse('imageUrl non autorisée', 400);
  }
  const safeFileName = fileName.replace(/[^a-zA-Z0-9_\-\.]/g, '_').slice(0, 80);
  const basePath     = env.DROPBOX_BASE_PATH || 'HCS/2026';
  const dropboxPath  = `/${basePath}/${folder}/${safeFileName}`;
  const imgResponse  = await fetch(imageUrl);
  if (!imgResponse.ok) return errorResponse('Impossible de télécharger l\'image source', 502);
  const imageBuffer  = await imgResponse.arrayBuffer();

  const upstream = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.DROPBOX_ACCESS_TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'overwrite', autorename: true, mute: false })
    },
    body: imageBuffer
  });
  if (!upstream.ok) return errorResponse(`Erreur Dropbox (${upstream.status})`, upstream.status);
  const data = await upstream.json();
  return corsResponse(JSON.stringify({ success: true, path: data.path_display }), 200, null, true);
}

async function handleDropboxArchive(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('JSON invalide', 400); }

  const { image_base64, client, mois } = body;
  if (!image_base64 || typeof image_base64 !== 'string') return errorResponse('image_base64 requis', 400);
  if (!client || typeof client !== 'string')             return errorResponse('client requis', 400);

  const safeClient  = client.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 60);
  const safeMois    = (mois || 'inconnu').replace(/[^a-zA-Z]/g, '').slice(0, 20);
  const basePath    = env.DROPBOX_BASE_PATH || 'HCS/2026';
  const dropboxPath = `/${basePath}/CLIENTS/${safeMois}/${safeClient}/logos/${safeClient}_logo_traite.png`;

  try {
    const imageBuffer = base64ToArrayBuffer(image_base64);
    const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.DROPBOX_ACCESS_TOKEN}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: dropboxPath, mode: 'overwrite', autorename: false, mute: false })
      },
      body: imageBuffer
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Dropbox ${res.status}: ${txt.slice(0, 120)}`);
    }
    const data = await res.json();
    return corsResponse(JSON.stringify({ success: true, path: data.path_display || dropboxPath }), 200, null, true);
  } catch (err) {
    return errorResponse(`Erreur archivage: ${err.message}`, 502);
  }
}

async function handleClaude(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('JSON invalide', 400); }

  const { apiKey, model = 'claude-opus-4-5', messages, system, max_tokens = 1400 } = body;
  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 10) return errorResponse('apiKey Claude requis', 400);
  if (!Array.isArray(messages) || messages.length === 0) return errorResponse('messages[] requis', 400);

  const safeTokens     = Math.min(parseInt(max_tokens) || 1400, 8000);
  const anthropicBody  = { model, messages, max_tokens: safeTokens };
  if (system) anthropicBody.system = system;

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(anthropicBody)
  });
  if (!upstream.ok) {
    const errText = await upstream.text();
    return errorResponse(`Erreur Claude (${upstream.status}): ${errText.substring(0, 300)}`, upstream.status);
  }
  return corsResponse(JSON.stringify(await upstream.json()), 200, null, true);
}

async function handleReplicate(request, env) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('JSON invalide', 400); }

  const { token, modelId, input, predictionId } = body;
  if (!token) return errorResponse('token requis', 400);

  if (predictionId) {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Token ${token}` }
    });
    if (!r.ok) {
      const err = await r.text();
      return errorResponse(`Replicate poll ${r.status}: ${err.substring(0, 300)}`, r.status);
    }
    const poll = await r.json();
    if (poll.status === 'succeeded') {
      const url = Array.isArray(poll.output) ? poll.output[0] : poll.output;
      return corsResponse(JSON.stringify({ url, status: 'succeeded' }), 200, null, true);
    }
    if (poll.status === 'failed' || poll.status === 'canceled') {
      return errorResponse(`Replicate ${poll.status}: ${poll.error || 'unknown'}`, 500);
    }
    return corsResponse(JSON.stringify({ predictionId, status: poll.status || 'processing' }), 202, null, true);
  }

  if (!modelId || !input) return errorResponse('modelId et input requis', 400);
  const r1 = await fetch(`https://api.replicate.com/v1/models/${modelId}/predictions`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=25'
    },
    body: JSON.stringify({ input })
  });
  if (!r1.ok) {
    const err = await r1.text();
    return errorResponse(`Replicate ${r1.status}: ${err.substring(0, 300)}`, r1.status);
  }
  const pred = await r1.json();
  if (pred.status === 'succeeded') {
    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
    return corsResponse(JSON.stringify({ url, status: 'succeeded' }), 200, null, true);
  }
  if (pred.status === 'failed') return errorResponse(`Replicate failed: ${pred.error || 'unknown'}`, 500);
  const predId = pred.id;
  if (!predId) return errorResponse('Pas d\'ID de prédiction', 500);
  return corsResponse(JSON.stringify({ predictionId: predId, status: pred.status || 'processing' }), 202, null, true);
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaires
// ─────────────────────────────────────────────────────────────────────────────
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function arrayBufferToBase64(buffer) {
  // Traitement par chunks de 8192 octets pour éviter le stack overflow sur grandes images
  const bytes  = new Uint8Array(buffer);
  let binary   = '';
  const CHUNK  = 8192;
  for (let i = 0; i < bytes.byteLength; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function checkRateLimit(ip) {
  const now = Date.now();
  if (!ipCounters.has(ip)) { ipCounters.set(ip, { count: 1, windowStart: now }); return null; }
  const entry = ipCounters.get(ip);
  if (now - entry.windowStart > RATE_LIMIT_WINDOW) { entry.count = 1; entry.windowStart = now; return null; }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return `Trop de requêtes. Limite : ${RATE_LIMIT_MAX} req/${RATE_LIMIT_WINDOW / 1000}s`;
  return null;
}

function corsResponse(body, status = 200, env = null, isJson = false) {
  const allowedOrigin = env?.ALLOWED_ORIGIN || '*';
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Worker-Secret',
      'Access-Control-Max-Age': '86400',
      ...(isJson ? { 'Content-Type': 'application/json' } : {})
    }
  });
}

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
