/**
 * advisor.js — Module Advisor HCS
 * Assistant IA intégré dans l'ERP, branché sur Claude API (claude-sonnet-4-6)
 * Contexte HCS injecté automatiquement depuis store.js
 * Polynésie française — XPF — High Coffee Shirt / MANAWEAR
 */

/* ============================================================
   CONFIGURATION
   ============================================================ */
const ADVISOR_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1024,
  apiEndpoint: 'https://api.anthropic.com/v1/messages',
  storageKey: 'hcs_advisor_key',
  historyKey: 'hcs_advisor_history',
  maxHistory: 20, // nb de messages max conservés
};

/* ============================================================
   SYSTEM PROMPT HCS — contexte injecté à chaque requête
   ============================================================ */
function buildSystemPrompt() {
  // Récupère les données vivantes depuis store.js (si disponible)
  const orders   = (typeof Store !== 'undefined' && Store.getAll) ? (Store.getAll('orders')   || []) : [];
  const clients  = (typeof Store !== 'undefined' && Store.getAll) ? (Store.getAll('clients')  || []) : [];
  const products = (typeof Store !== 'undefined' && Store.getAll) ? (Store.getAll('products') || []) : [];
  const stock    = (typeof Store !== 'undefined' && Store.getAll) ? (Store.getAll('inventory')|| []) : [];

  // Résumé rapide des données
  const ordersEnCours = orders.filter(o => o.status !== 'livré' && o.status !== 'annulé');
  const ordersUrgents = ordersEnCours.filter(o => o.priority === 'urgent' || o.status === 'en_retard');

  return `Tu es Grace, l'assistante IA intégrée dans l'ERP de High Coffee Shirt (HCS) à Papeete, Tahiti, Polynésie française.

## Entreprise
- Nom : High Coffee Shirt (HCS) — marque textile MANAWEAR
- Localisation : Papeete, Tahiti, Polynésie française
- Monnaie : XPF (franc CFP). TOUJOURS afficher les montants en XPF.
- Activités : impression DTF, transferts vinyle/flock, stickers, covering véhicule

## Ton rôle
Tu assistes l'équipe HCS directement dans l'ERP. Tu peux :
- Analyser les commandes, stocks et clients
- Calculer des coûts (DTF, vinyle, stickers) en XPF
- Suggérer des actions prioritaires pour l'atelier
- Aider à rédiger des devis, emails clients, fiches de production
- Répondre aux questions sur la gestion de l'entreprise

## Données ERP en temps réel
- Commandes totales : ${orders.length}
- Commandes en cours : ${ordersEnCours.length}
- Commandes urgentes : ${ordersUrgents.length}
- Clients enregistrés : ${clients.length}
- Références produits : ${products.length}
- Articles en stock : ${stock.length}

## Formules de calcul importantes
- Coût DTF landed = prix_USD × taux_change × 1.07 (douane) × 1.16 (TVA 16%)
- Coût vinyle cm² = prix_rouleau_XPF ÷ (largeur_cm × longueur_cm)
- Loyalty B2C : 1 pt / 100 XPF (Rookie) → 2 pts / 100 XPF (Ambassadeur)

## Règles de communication
- Répondre TOUJOURS en français
- Être concis, précis, professionnel mais chaleureux
- Utiliser quelques mots reo tahiti quand c'est naturel (māuruuru, māeva, ia ora na)
- Structurer les réponses avec des listes ou tableaux quand c'est utile
- Ne jamais inventer de données — si tu n'as pas l'info, demande-la

## Contexte technique
- ERP : SPA JavaScript vanilla, données dans localStorage
- Intégrations : n8n, Odoo (am595a.odoo.com), WooCommerce, Airtable, Dropbox
- VPS : Hostinger Ubuntu 24.04, Docker + Traefik`;
}

/* ============================================================
   GESTION DE L'HISTORIQUE
   ============================================================ */
const AdvisorHistory = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(ADVISOR_CONFIG.historyKey) || '[]');
    } catch { return []; }
  },
  save(history) {
    // Garde seulement les N derniers messages
    const trimmed = history.slice(-ADVISOR_CONFIG.maxHistory);
    localStorage.setItem(ADVISOR_CONFIG.historyKey, JSON.stringify(trimmed));
  },
  add(role, content) {
    const history = this.get();
    history.push({ role, content });
    this.save(history);
    return history;
  },
  clear() {
    localStorage.removeItem(ADVISOR_CONFIG.historyKey);
  }
};

/* ============================================================
   API CLAUDE
   ============================================================ */
async function callClaude(userMessage) {
  const apiKey = localStorage.getItem(ADVISOR_CONFIG.storageKey);
  if (!apiKey) {
    throw new Error('CLE_MANQUANTE');
  }

  // Ajoute le message utilisateur à l'historique
  const history = AdvisorHistory.add('user', userMessage);

  // Construit les messages pour l'API (format Anthropic)
  const messages = history.map(h => ({
    role: h.role,
    content: h.content
  }));

  const response = await fetch(ADVISOR_CONFIG.apiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-calls': 'true',
    },
    body: JSON.stringify({
      model: ADVISOR_CONFIG.model,
      max_tokens: ADVISOR_CONFIG.maxTokens,
      system: buildSystemPrompt(),
      messages,
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('CLE_INVALIDE');
    if (response.status === 429) throw new Error('QUOTA_DEPASSE');
    throw new Error(err.error?.message || `Erreur API ${response.status}`);
  }

  const data = await response.json();
  const assistantMsg = data.content?.[0]?.text || '';

  // Sauvegarde la réponse dans l'historique
  AdvisorHistory.add('assistant', assistantMsg);

  return assistantMsg;
}

/* ============================================================
   SUGGESTIONS RAPIDES CONTEXTUELLES
   ============================================================ */
function getSuggestions() {
  const orders = (typeof Store !== 'undefined' && Store.getAll) ? (Store.getAll('orders') || []) : [];
  const urgent = orders.filter(o => o.priority === 'urgent').length;

  const base = [
    '📋 Résume les commandes du jour',
    '💰 Calcule le coût d\'un DTF A3 en XPF',
    '📦 Quel est l\'état des stocks vinyle ?',
    '✉️ Rédige un email de relance client',
    '🏷️ Prix d\'un sticker 10×10 cm en vinyle Oracal',
  ];

  if (urgent > 0) {
    base.unshift(`🚨 ${urgent} commande${urgent > 1 ? 's' : ''} urgente${urgent > 1 ? 's' : ''} — que faire ?`);
  }

  return base.slice(0, 5);
}

/* ============================================================
   RENDU HTML — interface chat
   ============================================================ */
function renderAdvisorMessage(role, content) {
  const isAssistant = role === 'assistant';
  const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // Conversion markdown simple → HTML
  const html = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^### (.*$)/gm, '<h4>$1</h4>')
    .replace(/^## (.*$)/gm, '<h3>$1</h3>')
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  return `
    <div class="adv-msg adv-msg--${role}">
      <div class="adv-msg__avatar">
        ${isAssistant ? '⬡' : '◆'}
      </div>
      <div class="adv-msg__body">
        <div class="adv-msg__bubble"><p>${html}</p></div>
        <div class="adv-msg__time">${isAssistant ? 'Grace · ' : ''}${time}</div>
      </div>
    </div>`;
}

function renderTypingIndicator() {
  return `
    <div class="adv-msg adv-msg--assistant adv-typing" id="adv-typing">
      <div class="adv-msg__avatar">⬡</div>
      <div class="adv-msg__body">
        <div class="adv-msg__bubble adv-msg__bubble--typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>`;
}

/* ============================================================
   CSS — injecté dynamiquement
   ============================================================ */
function injectAdvisorStyles() {
  if (document.getElementById('advisor-styles')) return;
  const style = document.createElement('style');
  style.id = 'advisor-styles';
  style.textContent = `
    /* ---- Conteneur principal ---- */
    .advisor-shell {
      display: flex;
      flex-direction: column;
      height: calc(100vh - 120px);
      max-width: 860px;
      margin: 0 auto;
      font-family: 'Inter', 'DM Mono', monospace;
    }

    /* ---- Header advisor ---- */
    .adv-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid var(--border, rgba(196,129,58,0.2));
      background: var(--bg-card, #2a1508);
      border-radius: 8px 8px 0 0;
      flex-shrink: 0;
    }
    .adv-header__left { display: flex; align-items: center; gap: 12px; }
    .adv-avatar {
      width: 40px; height: 40px;
      background: var(--accent, #c4813a);
      clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; color: #1a0e07; font-weight: 800;
    }
    .adv-header__info h3 {
      font-size: 15px; font-weight: 700;
      color: var(--text, #f5ede0); margin: 0;
    }
    .adv-header__info p {
      font-size: 11px; color: var(--text-dim, #c8b89a); margin: 0;
    }
    .adv-status {
      display: flex; align-items: center; gap: 6px;
      font-size: 11px; color: var(--text-dim, #c8b89a);
    }
    .adv-status__dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #4caf7d; box-shadow: 0 0 6px #4caf7d;
      animation: adv-pulse 2s infinite;
    }
    @keyframes adv-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    /* ---- Zone API key ---- */
    .adv-apikey {
      padding: 20px 24px;
      background: rgba(196,129,58,0.06);
      border-bottom: 1px solid var(--border, rgba(196,129,58,0.2));
      display: none;
    }
    .adv-apikey.visible { display: block; }
    .adv-apikey label {
      display: block; font-size: 11px; letter-spacing: .1em;
      text-transform: uppercase; color: var(--text-dim, #c8b89a);
      margin-bottom: 8px;
    }
    .adv-apikey__row { display: flex; gap: 8px; }
    .adv-apikey input {
      flex: 1; padding: 9px 12px;
      background: rgba(0,0,0,.3);
      border: 1px solid var(--border, rgba(196,129,58,0.2));
      border-radius: 4px; color: var(--text, #f5ede0);
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      outline: none;
    }
    .adv-apikey input:focus { border-color: var(--accent, #c4813a); }
    .adv-apikey .btn-save {
      padding: 9px 18px; background: var(--accent, #c4813a);
      border: none; border-radius: 4px; color: #1a0e07;
      font-size: 12px; font-weight: 600; cursor: pointer;
    }
    .adv-apikey .btn-save:hover { background: #e09a4f; }

    /* ---- Zone messages ---- */
    .adv-messages {
      flex: 1; overflow-y: auto; padding: 20px 24px;
      display: flex; flex-direction: column; gap: 16px;
      background: var(--bg, #1a0e07);
    }
    .adv-messages::-webkit-scrollbar { width: 4px; }
    .adv-messages::-webkit-scrollbar-thumb {
      background: rgba(196,129,58,.3); border-radius: 2px;
    }

    /* ---- Message ---- */
    .adv-msg {
      display: flex; gap: 10px; align-items: flex-start;
      animation: adv-in .2s ease;
    }
    @keyframes adv-in {
      from { opacity:0; transform:translateY(6px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .adv-msg--user { flex-direction: row-reverse; }
    .adv-msg__avatar {
      width: 32px; height: 32px; border-radius: 4px;
      background: rgba(196,129,58,.15);
      border: 1px solid rgba(196,129,58,.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0; color: var(--accent, #c4813a);
    }
    .adv-msg--user .adv-msg__avatar {
      background: rgba(196,129,58,.25); color: #1a0e07;
    }
    .adv-msg__body { max-width: 78%; display: flex; flex-direction: column; gap: 4px; }
    .adv-msg--user .adv-msg__body { align-items: flex-end; }
    .adv-msg__bubble {
      padding: 11px 15px;
      border-radius: 6px; font-size: 13px; line-height: 1.6;
      color: var(--text, #f5ede0);
      background: rgba(196,129,58,.1);
      border: 1px solid rgba(196,129,58,.15);
    }
    .adv-msg--user .adv-msg__bubble {
      background: rgba(196,129,58,.2);
      border-color: rgba(196,129,58,.35);
    }
    .adv-msg__bubble p { margin: 0 0 6px; }
    .adv-msg__bubble p:last-child { margin: 0; }
    .adv-msg__bubble h3, .adv-msg__bubble h4 {
      color: var(--accent, #c4813a); margin: 8px 0 4px;
      font-size: 13px; font-weight: 700;
    }
    .adv-msg__bubble ul { margin: 4px 0; padding-left: 18px; }
    .adv-msg__bubble li { margin-bottom: 3px; }
    .adv-msg__bubble code {
      background: rgba(0,0,0,.4); padding: 1px 5px;
      border-radius: 3px; font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      color: #e09a4f;
    }
    .adv-msg__bubble strong { color: #e09a4f; }
    .adv-msg__time {
      font-size: 10px; color: var(--text-dim, #c8b89a);
      padding: 0 4px;
    }

    /* ---- Typing indicator ---- */
    .adv-msg__bubble--typing {
      display: flex; gap: 5px; align-items: center;
      padding: 12px 16px; width: 56px;
    }
    .adv-msg__bubble--typing span {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--accent, #c4813a); opacity: .4;
      animation: adv-bounce .9s infinite;
    }
    .adv-msg__bubble--typing span:nth-child(2) { animation-delay: .2s; }
    .adv-msg__bubble--typing span:nth-child(3) { animation-delay: .4s; }
    @keyframes adv-bounce {
      0%,80%,100% { transform:translateY(0); opacity:.4; }
      40% { transform:translateY(-5px); opacity:1; }
    }

    /* ---- Suggestions ---- */
    .adv-suggestions {
      padding: 12px 24px 0;
      display: flex; flex-wrap: wrap; gap: 6px;
      background: var(--bg, #1a0e07);
      flex-shrink: 0;
    }
    .adv-suggestion {
      padding: 6px 12px; font-size: 11px;
      background: rgba(196,129,58,.08);
      border: 1px solid rgba(196,129,58,.2);
      border-radius: 20px; cursor: pointer;
      color: var(--text-dim, #c8b89a);
      transition: all .15s; white-space: nowrap;
    }
    .adv-suggestion:hover {
      border-color: var(--accent, #c4813a);
      color: var(--accent, #c4813a);
      background: rgba(196,129,58,.15);
    }

    /* ---- Zone de saisie ---- */
    .adv-input-zone {
      padding: 14px 24px 16px;
      border-top: 1px solid var(--border, rgba(196,129,58,.2));
      background: var(--bg-card, #2a1508);
      border-radius: 0 0 8px 8px;
      flex-shrink: 0;
    }
    .adv-input-row {
      display: flex; gap: 10px; align-items: flex-end;
    }
    .adv-input-row textarea {
      flex: 1; padding: 10px 14px;
      background: rgba(0,0,0,.3);
      border: 1px solid var(--border, rgba(196,129,58,.2));
      border-radius: 6px; color: var(--text, #f5ede0);
      font-family: 'Inter', sans-serif; font-size: 13px;
      resize: none; outline: none; line-height: 1.5;
      max-height: 120px; min-height: 42px;
      transition: border-color .15s;
    }
    .adv-input-row textarea:focus {
      border-color: var(--accent, #c4813a);
    }
    .adv-input-row textarea::placeholder { color: rgba(200,184,154,.4); }
    .adv-send {
      width: 42px; height: 42px; flex-shrink: 0;
      background: var(--accent, #c4813a);
      border: none; border-radius: 6px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; transition: background .15s;
      color: #1a0e07;
    }
    .adv-send:hover { background: #e09a4f; }
    .adv-send:disabled { background: rgba(196,129,58,.3); cursor: not-allowed; }
    .adv-footer {
      display: flex; justify-content: space-between;
      margin-top: 8px; padding: 0 2px;
    }
    .adv-footer span {
      font-size: 10px; color: rgba(200,184,154,.4);
    }
    .adv-clear {
      font-size: 10px; color: rgba(200,184,154,.4);
      background: none; border: none; cursor: pointer;
      padding: 0; font-family: inherit;
    }
    .adv-clear:hover { color: var(--accent, #c4813a); }

    /* ---- Message d'accueil ---- */
    .adv-welcome {
      text-align: center; padding: 32px 20px;
      color: var(--text-dim, #c8b89a);
    }
    .adv-welcome__icon {
      font-size: 36px; margin-bottom: 12px;
      display: block;
    }
    .adv-welcome h4 {
      font-size: 16px; color: var(--text, #f5ede0);
      margin: 0 0 8px; font-weight: 700;
    }
    .adv-welcome p { font-size: 12px; margin: 0; line-height: 1.6; }

    /* ---- Erreur ---- */
    .adv-error {
      padding: 10px 14px; border-radius: 6px; font-size: 12px;
      background: rgba(224,90,58,.1); border: 1px solid rgba(224,90,58,.3);
      color: #e05a3a; margin: 0 24px;
    }
  `;
  document.head.appendChild(style);
}

/* ============================================================
   MODULE PRINCIPAL — appelé par app.js
   ============================================================ */
const AdvisorModule = {

  /* Rendu de la vue complète */
  render() {
    injectAdvisorStyles();

    const hasKey = !!localStorage.getItem(ADVISOR_CONFIG.storageKey);
    const history = AdvisorHistory.get();
    const suggestions = getSuggestions();

    // Messages existants
    const messagesHtml = history.length === 0
      ? `<div class="adv-welcome">
           <span class="adv-welcome__icon">⬡</span>
           <h4>Ia ora na ! Je suis Grace</h4>
           <p>Votre assistante IA intégrée dans l'ERP HCS.<br>
           Posez-moi une question sur vos commandes, stocks, clients ou calculs de prix.</p>
         </div>`
      : history.map(m => renderAdvisorMessage(m.role, m.content)).join('');

    // Suggestions rapides
    const suggestionsHtml = suggestions
      .map(s => `<button class="adv-suggestion" onclick="AdvisorModule.sendSuggestion(this.textContent)">${s}</button>`)
      .join('');

    const view = document.getElementById('view-content');
    if (!view) return;

    view.innerHTML = `
      <div class="advisor-shell">

        <!-- Header -->
        <div class="adv-header">
          <div class="adv-header__left">
            <div class="adv-avatar">⬡</div>
            <div class="adv-header__info">
              <h3>Grace — Advisor HCS</h3>
              <p>Assistante IA · High Coffee Shirt · Papeete</p>
            </div>
          </div>
          <div class="adv-status">
            <div class="adv-status__dot"></div>
            ${hasKey ? 'Claude API connectée' : 'Clé API requise'}
          </div>
        </div>

        <!-- Zone clé API (affichée si pas de clé) -->
        <div class="adv-apikey ${hasKey ? '' : 'visible'}" id="adv-apikey-zone">
          <label>🔑 Clé API Anthropic (stockée localement)</label>
          <div class="adv-apikey__row">
            <input type="password" id="adv-api-input"
              placeholder="sk-ant-api03-..."
              value="${hasKey ? '••••••••••••••••' : ''}" />
            <button class="btn-save" onclick="AdvisorModule.saveKey()">Enregistrer</button>
          </div>
        </div>

        <!-- Messages -->
        <div class="adv-messages" id="adv-messages">
          ${messagesHtml}
        </div>

        <!-- Suggestions -->
        <div class="adv-suggestions" id="adv-suggestions">
          ${suggestionsHtml}
        </div>

        <!-- Input -->
        <div class="adv-input-zone">
          <div class="adv-input-row">
            <textarea
              id="adv-textarea"
              placeholder="Posez votre question à Grace…"
              rows="1"
              onkeydown="AdvisorModule.handleKey(event)"
              oninput="AdvisorModule.autoResize(this)"
            ></textarea>
            <button class="adv-send" id="adv-send-btn" onclick="AdvisorModule.send()">➤</button>
          </div>
          <div class="adv-footer">
            <span>claude-sonnet-4-6 · Entrée pour envoyer · Maj+Entrée pour saut de ligne</span>
            <button class="adv-clear" onclick="AdvisorModule.clearHistory()">🗑 Effacer l'historique</button>
          </div>
        </div>

      </div>`;

    // Scroll en bas
    this.scrollBottom();
  },

  /* Enregistre la clé API */
  saveKey() {
    const input = document.getElementById('adv-api-input');
    const key = input?.value?.trim();
    if (!key || key.startsWith('•')) return;
    localStorage.setItem(ADVISOR_CONFIG.storageKey, key);

    // Masque la zone clé et met à jour le statut
    document.getElementById('adv-apikey-zone')?.classList.remove('visible');
    if (typeof showToast === 'function') showToast('Clé API enregistrée ✓', 'success');
    else alert('Clé API enregistrée !');
  },

  /* Envoie une suggestion au clic */
  sendSuggestion(text) {
    const textarea = document.getElementById('adv-textarea');
    if (textarea) {
      textarea.value = text.replace(/^[^\s]+\s/, ''); // retire l'emoji
      this.send();
    }
  },

  /* Gestion touche Entrée */
  handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.send();
    }
  },

  /* Auto-resize textarea */
  autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  },

  /* Envoie le message */
  async send() {
    const textarea = document.getElementById('adv-textarea');
    const sendBtn  = document.getElementById('adv-send-btn');
    const messages = document.getElementById('adv-messages');
    if (!textarea || !messages) return;

    const text = textarea.value.trim();
    if (!text) return;

    // Vérifie la clé API
    if (!localStorage.getItem(ADVISOR_CONFIG.storageKey)) {
      document.getElementById('adv-apikey-zone')?.classList.add('visible');
      if (typeof showToast === 'function') showToast('Entrez votre clé API Anthropic', 'error');
      return;
    }

    // Affiche le message utilisateur
    const welcomeEl = messages.querySelector('.adv-welcome');
    if (welcomeEl) welcomeEl.remove();

    messages.insertAdjacentHTML('beforeend', renderAdvisorMessage('user', text));
    textarea.value = '';
    textarea.style.height = 'auto';

    // Masque les suggestions
    const sugEl = document.getElementById('adv-suggestions');
    if (sugEl) sugEl.style.display = 'none';

    // Désactive le bouton + affiche typing
    if (sendBtn) sendBtn.disabled = true;
    messages.insertAdjacentHTML('beforeend', renderTypingIndicator());
    this.scrollBottom();

    try {
      const reply = await callClaude(text);

      // Supprime le typing indicator
      document.getElementById('adv-typing')?.remove();

      // Affiche la réponse
      messages.insertAdjacentHTML('beforeend', renderAdvisorMessage('assistant', reply));

    } catch (err) {
      document.getElementById('adv-typing')?.remove();

      let errMsg = 'Une erreur est survenue. Réessayez.';
      if (err.message === 'CLE_MANQUANTE') errMsg = '🔑 Clé API manquante — entrez votre clé Anthropic ci-dessus.';
      if (err.message === 'CLE_INVALIDE')  errMsg = '❌ Clé API invalide — vérifiez votre clé sur console.anthropic.com';
      if (err.message === 'QUOTA_DEPASSE') errMsg = '⏱ Quota API dépassé — attendez quelques instants.';

      messages.insertAdjacentHTML('beforeend',
        `<div class="adv-error">${errMsg}</div>`);
    }

    if (sendBtn) sendBtn.disabled = false;
    this.scrollBottom();
  },

  /* Efface l'historique */
  clearHistory() {
    if (!confirm('Effacer tout l\'historique de conversation ?')) return;
    AdvisorHistory.clear();
    this.render();
  },

  /* Scroll automatique vers le bas */
  scrollBottom() {
    setTimeout(() => {
      const messages = document.getElementById('adv-messages');
      if (messages) messages.scrollTop = messages.scrollHeight;
    }, 50);
  }
};

/* ============================================================
   ENREGISTREMENT DU MODULE dans app.js
   Si app.js utilise un système de modules, on l'enregistre ici.
   Sinon, AdvisorModule est accessible globalement.
   ============================================================ */
if (typeof registerModule === 'function') {
  registerModule('advisor', {
    label: '🤖 Advisor',
    icon: '⬡',
    render: () => AdvisorModule.render(),
  });
}
