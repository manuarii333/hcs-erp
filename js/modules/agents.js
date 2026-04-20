/* ================================================================
   HCS ERP — agents.js
   Module Agents IA : dashboard des 8 agents HCS, interface chat,
   historique des sessions
   ================================================================ */

'use strict';

const Agents = (() => {

  /* ----------------------------------------------------------------
     CONFIGURATION DES 8 AGENTS HCS
     Chaque agent a un id Anthropic, un rôle et un system prompt dédié
     ---------------------------------------------------------------- */
  const AGENTS_LIST = [
    {
      id:    'agent_011Ca1i2FzUX3zNd4xuM4PHa',
      nom:   'HCS-Atelier',
      role:  'Responsable Production',
      icon:  '⚙️',
      color: '#FF6B6B',
      modele:'claude-sonnet-4-6',
      statut:'actif',
      description: 'Gestion des ordres de fabrication, planning atelier, DTF et vinyle.',
      systemPrompt: `Tu es HCS-Atelier, l'agent IA de production de High Coffee Shirt (HCS) à Papeete, Tahiti.
Tu gères les ordres de fabrication, le planning de l'atelier, les impressions DTF et le vinyl.
Réponds toujours en français, de façon concise et opérationnelle.
Monnaie : XPF (franc CFP).`
    },
    {
      id:    'agent_011Ca1i5Lk4BaMSRTMCtdkjk',
      nom:   'HCS-Commercial',
      role:  'Agent Commercial',
      icon:  '🤝',
      color: '#4A5FFF',
      modele:'claude-sonnet-4-6',
      statut:'actif',
      description: 'Devis, suivi clients, pipeline commercial et relances.',
      systemPrompt: `Tu es HCS-Commercial, l'agent IA commercial de High Coffee Shirt (HCS) à Papeete, Tahiti.
Tu gères les devis, le suivi clients, le pipeline commercial et les relances.
Réponds toujours en français, de façon commerciale et professionnelle.
Monnaie : XPF (franc CFP).`
    },
    {
      id:    'agent_011Ca1i5QZW9BuYFmAEUbrt3',
      nom:   'HCS-Marketing',
      role:  'Responsable Marketing',
      icon:  '📢',
      color: '#B07BFF',
      modele:'claude-sonnet-4-6',
      statut:'actif',
      description: 'Campagnes, réseaux sociaux, contenu et stratégie de marque MANAWEAR.',
      systemPrompt: `Tu es HCS-Marketing, l'agent IA marketing de High Coffee Shirt (HCS) / MANAWEAR à Papeete, Tahiti.
Tu gères les campagnes, les réseaux sociaux, le contenu et la stratégie de marque.
Réponds toujours en français, avec créativité et sens du branding polynésien.`
    },
    {
      id:    'agent_011Ca1i5TrwZCPHXnqW8EjqM',
      nom:   'HCS-Support',
      role:  'Support Client',
      icon:  '🎧',
      color: '#00D4AA',
      modele:'claude-sonnet-4-6',
      statut:'actif',
      description: 'Assistance clients, suivi commandes, réclamations et SAV.',
      systemPrompt: `Tu es HCS-Support, l'agent IA support de High Coffee Shirt (HCS) à Papeete, Tahiti.
Tu gères l'assistance clients, le suivi des commandes, les réclamations et le SAV.
Réponds toujours en français, avec bienveillance et efficacité.
Monnaie : XPF (franc CFP).`
    },
    {
      id:    'agent_011Ca1i5WyDUg2fQCJSUzWq5',
      nom:   'HCS-Finance',
      role:  'Analyste Financier',
      icon:  '💰',
      color: '#F59E0B',
      modele:'claude-sonnet-4-6',
      statut:'actif',
      description: 'Comptabilité, trésorerie, TVA, rapports financiers en XPF.',
      systemPrompt: `Tu es HCS-Finance, l'agent IA financier de High Coffee Shirt (HCS) à Papeete, Tahiti, Polynésie française.
Tu gères la comptabilité, la trésorerie, la TVA et les rapports financiers.
Réponds toujours en français. TOUJOURS afficher les montants en XPF (franc CFP).
TVA en Polynésie : 16%. Taux de change USD/XPF : environ 110.`
    },
    {
      id:    'agent_011Ca1i5a41GExc8u42YVC4y',
      nom:   'HCS-Logistique',
      role:  'Responsable Logistique',
      icon:  '📦',
      color: '#6B7280',
      modele:'claude-sonnet-4-6',
      statut:'actif',
      description: 'Stock, fournisseurs, commandes achat, expéditions et réceptions.',
      systemPrompt: `Tu es HCS-Logistique, l'agent IA logistique de High Coffee Shirt (HCS) à Papeete, Tahiti.
Tu gères le stock, les fournisseurs, les commandes achat, les expéditions et les réceptions.
Réponds toujours en français, de façon précise et organisée.
Monnaie : XPF (franc CFP).`
    },
    {
      id:    'agent_011Ca1i5cqgmXC8pfK6n8YvJ',
      nom:   'HCS-Music',
      role:  'Agent Créatif',
      icon:  '🎵',
      color: '#EC4899',
      modele:'claude-sonnet-4-6',
      statut:'actif',
      description: 'Projets musicaux, créations artistiques et contenu culturel polynésien.',
      systemPrompt: `Tu es HCS-Music, l'agent IA créatif de High Coffee Shirt (HCS) à Papeete, Tahiti.
Tu gères les projets musicaux, les créations artistiques et le contenu culturel polynésien.
Réponds toujours en français, avec créativité et sensibilité culturelle ma'ohi.`
    },
    {
      id:    'agent_011Ca1i5g4QWANXkWTS8FCDT',
      nom:   'HCS-Orchestrateur',
      role:  'Orchestrateur Multi-Agents',
      icon:  '⬡',
      color: '#4A5FFF',
      modele:'claude-opus-4-6',
      statut:'actif',
      description: 'Coordination de tous les agents, tâches complexes multi-domaines.',
      systemPrompt: `Tu es HCS-Orchestrateur, l'agent IA principal de High Coffee Shirt (HCS) à Papeete, Tahiti, Polynésie française.
Tu coordonnes tous les agents HCS et tu traites les tâches complexes multi-domaines.
Tu as une vision globale de l'entreprise : production, commercial, finance, logistique, marketing et support.
Réponds toujours en français. Monnaie : XPF (franc CFP).`
    }
  ];

  /* ================================================================
     OUTILS ERP — disponibles pour tous les agents via Claude tool_use
     ================================================================ */
  const ERP_TOOLS = [
    {
      name: 'erp_get_commandes',
      description: 'Récupère les commandes récentes depuis l\'ERP HCS (clients, montants, statuts).',
      input_schema: {
        type: 'object',
        properties: {
          limit:  { type: 'number', description: 'Nombre de commandes (défaut 10, max 50)' },
          statut: { type: 'string', description: 'Filtrer par statut : en_cours, confirmée, livrée, annulée' }
        }
      }
    },
    {
      name: 'erp_get_produits',
      description: 'Récupère les produits et niveaux de stock de l\'ERP HCS.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Nombre de produits (défaut 50)' }
        }
      }
    },
    {
      name: 'erp_get_contacts',
      description: 'Recherche des clients et contacts dans l\'ERP HCS.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Terme de recherche : nom, email, entreprise' },
          limit: { type: 'number', description: 'Nombre de résultats (défaut 10)' }
        }
      }
    },
    {
      name: 'erp_get_planning',
      description: 'Récupère le planning atelier et les ordres de fabrication en cours.',
      input_schema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Nombre d\'entrées (défaut 20)' }
        }
      }
    },
    {
      name: 'erp_create_devis',
      description: 'Crée un nouveau devis dans l\'ERP HCS. Calcule automatiquement le TTC (TVA 16%).',
      input_schema: {
        type: 'object',
        properties: {
          client_nom:  { type: 'string', description: 'Nom du client' },
          montant_ht:  { type: 'number', description: 'Montant HT en XPF' },
          description: { type: 'string', description: 'Objet / description du devis' },
          statut:      { type: 'string', description: 'brouillon | envoyé | accepté (défaut: brouillon)' }
        },
        required: ['client_nom', 'montant_ht']
      }
    },
    {
      name: 'erp_create_tache',
      description: 'Crée une tâche dans l\'ERP et l\'assigne à l\'agent courant.',
      input_schema: {
        type: 'object',
        properties: {
          titre:       { type: 'string', description: 'Titre court de la tâche' },
          description: { type: 'string', description: 'Détail de la tâche' },
          priorite:    { type: 'string', description: 'basse | normale | haute | urgente' },
          echeance:    { type: 'string', description: 'Date limite format YYYY-MM-DD' }
        },
        required: ['titre']
      }
    },
    {
      name: 'erp_ouvrir_app',
      description: `Ouvre une application ou une vue dans l'ERP HCS.
Apps disponibles :
- dashboard > overview | activity
- ventes > quotes (devis) | orders (commandes) | invoices (factures) | contacts | pipeline
- production > planning | mo (ordres fab.) | bom | work-centers
- stock > products | categories | stock-moves | suppliers | po
- caisse > caisse-pos
- comptabilite > tableau-de-bord | depenses | pl-report | bilan
- rh > employes | conges | planning-rh
- outils > picwish-pipeline | content-generator | atelier-production | triage-dashboard | commercial-dashboard | stock-dashboard | finance-dashboard | ocr-scanner | supervision-dashboard | boutique-assistant | admin-photos-produits | signmaster-guide
- agents > dashboard | chat | sessions`,
      input_schema: {
        type: 'object',
        properties: {
          app:  { type: 'string', description: 'ID de l\'application (ex: ventes, outils, production)' },
          view: { type: 'string', description: 'ID de la vue (ex: quotes, picwish-pipeline, planning)' }
        },
        required: ['app', 'view']
      }
    },
    {
      name: 'erp_picwish',
      description: 'Ouvre le pipeline PicWish de détourage d\'image dans l\'ERP.',
      input_schema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message à afficher à l\'utilisateur avant d\'ouvrir PicWish' }
        }
      }
    },
    {
      name: 'erp_content_generator',
      description: 'Ouvre le générateur de contenu marketing HCS (posts réseaux sociaux, descriptions produits).',
      input_schema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message à afficher avant d\'ouvrir le générateur' }
        }
      }
    },
    {
      name: 'erp_dtf_studio',
      description: 'Ouvre DTF Studio — composition et préparation des fichiers DTF pour impression.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'erp_mockup_forge',
      description: 'Ouvre MockupForge v12 — générateur de mockups produits HCS (t-shirts, polos, casquettes).',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'erp_mockup_studio',
      description: 'Ouvre T-Shirt Mockup Studio — studio de mockup textile interactif.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'erp_dtf_plaques',
      description: 'Ouvre DTF Plaques Transfert — calcul et impression des plaques de transfert DTF.',
      input_schema: { type: 'object', properties: {} }
    },
    {
      name: 'erp_dtf_atelier',
      description: 'Ouvre un atelier DTF. Choisir BN20 (Yannick) ou USA selon la machine utilisée.',
      input_schema: {
        type: 'object',
        properties: {
          machine: { type: 'string', description: 'bn20 (imprimante Yannick) | usa (imprimante USA)' }
        }
      }
    }
  ];

  /* Clés de stockage localStorage */
  const STORAGE_KEY_API    = 'hcs_agents_api_key';
  const STORAGE_KEY_SESS   = 'hcs_agents_sessions';
  const STORAGE_KEY_MEM    = 'hcs_agents_shared_memory';
  const STORAGE_KEY_HIST   = 'hcs_agents_histories';

  /* État interne du module */
  let _currentAgent    = null;  // agent sélectionné pour le chat
  let _chatHistory     = [];    // historique messages du chat actif
  let _sessions        = [];    // toutes les sessions sauvegardées
  let _container       = null;  // référence au conteneur principal
  let _agentHistories  = {};    // historique par agent { agentId: [...messages] }
  let _sharedFacts     = [];    // faits partagés entre tous les agents

  /* ----------------------------------------------------------------
     ENTRÉE PUBLIQUE : init(toolbarEl, containerEl, view)
     Appelé par app.js → renderView() à chaque changement de vue
     ---------------------------------------------------------------- */
  function init(toolbarEl, containerEl, view) {
    _container = containerEl;

    /* Charger les sessions et la mémoire partagée depuis localStorage */
    _loadSessions();
    _loadMemory();

    /* Rendre la toolbar selon la vue */
    _renderToolbar(toolbarEl, view);

    /* Dispatcher vers la bonne vue */
    switch (view) {
      case 'chat':      _renderChat(containerEl);     break;
      case 'sessions':  _renderSessions(containerEl); break;
      default:          _renderDashboard(containerEl);
    }
  }

  /* ================================================================
     VUE 1 — DASHBOARD : grille des 8 agents
     ================================================================ */
  function _renderDashboard(el) {
    el.innerHTML = `
      <div class="agents-dashboard">
        <div class="agents-header">
          <h2 class="agents-title">⬡ Agents IA HCS</h2>
          <p class="agents-subtitle">8 agents spécialisés propulsés par Claude Anthropic</p>
        </div>
        <div class="agents-grid">
          ${AGENTS_LIST.map(agent => _cardAgent(agent)).join('')}
        </div>
      </div>
    `;

    /* Liaison des boutons "Parler" */
    el.querySelectorAll('.btn-agent-chat').forEach(btn => {
      btn.addEventListener('click', () => {
        const agentId = btn.dataset.agentId;
        /* Sélectionner l'agent et aller dans la vue chat */
        _selectAgent(agentId);
        openView('chat'); // router global app.js
      });
    });
  }

  /** Génère la carte HTML d'un agent */
  function _cardAgent(agent) {
    const statutClass = agent.statut === 'actif' ? 'statut-actif' : 'statut-inactif';
    const statutLabel = agent.statut === 'actif' ? '● Actif' : '○ Inactif';
    return `
      <div class="agent-card" data-agent-id="${agent.id}" style="--agent-color:${agent.color}">
        <div class="agent-card-header">
          <span class="agent-icon">${agent.icon}</span>
          <div class="agent-info">
            <span class="agent-nom">${_esc(agent.nom)}</span>
            <span class="agent-role">${_esc(agent.role)}</span>
          </div>
          <span class="agent-statut ${statutClass}">${statutLabel}</span>
        </div>
        <p class="agent-description">${_esc(agent.description)}</p>
        <div class="agent-card-footer">
          <span class="agent-modele">🤖 ${_esc(agent.modele)}</span>
          <button class="btn btn-primary btn-sm btn-agent-chat" data-agent-id="${agent.id}">
            💬 Parler
          </button>
        </div>
      </div>
    `;
  }

  /* ================================================================
     VUE 2 — CHAT : interface de conversation avec un agent
     ================================================================ */
  function _renderChat(el) {
    const agent = _currentAgent || AGENTS_LIST[0];
    const apiKey = localStorage.getItem(STORAGE_KEY_API) || '';

    el.innerHTML = `
      <div class="agents-chat-layout">

        <!-- Panneau latéral : sélection agent + clé API -->
        <aside class="chat-sidebar">
          <div class="chat-sidebar-section">
            <label class="form-label">Clé API Anthropic</label>
            <div class="api-key-wrap">
              <input type="password" id="agents-api-key" class="form-input"
                placeholder="sk-ant-…"
                value="${_esc(apiKey)}"
                autocomplete="off" />
              <button class="btn btn-ghost btn-sm" id="btn-save-key" title="Sauvegarder">💾</button>
            </div>
            <p class="form-hint">Stockée localement dans votre navigateur.</p>
          </div>

          <div class="chat-sidebar-section">
            <label class="form-label">Agent</label>
            <div class="agent-select-list">
              ${AGENTS_LIST.map(a => `
                <button class="agent-select-item ${a.id === agent.id ? 'active' : ''}"
                  data-agent-id="${a.id}"
                  style="--agent-color:${a.color}">
                  <span class="agent-select-icon">${a.icon}</span>
                  <span class="agent-select-nom">${_esc(a.nom)}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <button class="btn btn-ghost btn-sm btn-clear-chat" id="btn-clear-chat">
            🗑 Effacer le chat
          </button>

          <!-- Mémoire partagée inter-agents -->
          <div class="chat-sidebar-section">
            <label class="form-label">🧠 Mémoire partagée
              <span style="font-size:10px;color:var(--text-muted);margin-left:4px">${_sharedFacts.length} fait(s)</span>
            </label>
            <div class="shared-memory-list" id="shared-memory-list">
              ${_sharedFacts.length === 0
                ? `<p style="font-size:11px;color:var(--text-muted)">Aucun fait mémorisé.<br>Cliquez sur 📌 pour mémoriser un fait.</p>`
                : _sharedFacts.map((f, i) => `
                  <div class="memory-fact" style="display:flex;align-items:flex-start;gap:4px;margin-bottom:4px">
                    <span style="font-size:10px;color:var(--text-muted);flex:1">${_esc(f)}</span>
                    <button class="btn btn-ghost btn-sm btn-del-fact" data-idx="${i}" style="padding:0 4px;font-size:11px;min-width:unset">✕</button>
                  </div>`).join('')
              }
            </div>
            <div style="display:flex;gap:4px;margin-top:6px">
              <input id="new-fact-input" class="form-input" style="font-size:11px;padding:4px 8px"
                placeholder="Ajouter un fait…" />
              <button class="btn btn-primary btn-sm" id="btn-add-fact" style="min-width:unset;padding:4px 8px">📌</button>
            </div>
          </div>
        </aside>

        <!-- Zone principale de chat -->
        <div class="chat-main">
          <div class="chat-agent-banner" style="border-left:4px solid ${agent.color}">
            <span class="chat-agent-icon">${agent.icon}</span>
            <div>
              <strong>${_esc(agent.nom)}</strong>
              <span class="chat-agent-role">${_esc(agent.role)}</span>
            </div>
            <span class="agent-statut statut-actif" style="margin-left:auto">● Actif</span>
          </div>

          <!-- Messages -->
          <div class="chat-messages" id="chat-messages">
            ${_chatHistory.length === 0
              ? `<div class="chat-empty">
                   <span style="font-size:2rem">${agent.icon}</span>
                   <p>Bonjour ! Je suis <strong>${_esc(agent.nom)}</strong>.<br>${_esc(agent.description)}<br><em>Comment puis-je vous aider ?</em></p>
                 </div>`
              : _chatHistory.map(m => _renderMessage(m)).join('')
            }
          </div>

          <!-- Zone de saisie -->
          <div class="chat-input-zone">
            <textarea id="chat-input" class="chat-textarea"
              placeholder="Écrivez votre message… (Entrée pour envoyer, Maj+Entrée pour nouvelle ligne)"
              rows="2"></textarea>
            <button class="btn btn-primary" id="btn-send-chat">
              ➤ Envoyer
            </button>
          </div>

          <p id="chat-error" class="chat-error" style="display:none"></p>
        </div>
      </div>
    `;

    /* ---- Liaisons événements ---- */

    /* Sauvegarde de la clé API */
    el.querySelector('#btn-save-key').addEventListener('click', () => {
      const key = el.querySelector('#agents-api-key').value.trim();
      localStorage.setItem(STORAGE_KEY_API, key);
      _showToast('Clé API sauvegardée', 'success');
    });

    /* Sélection d'un autre agent */
    el.querySelectorAll('.agent-select-item').forEach(btn => {
      btn.addEventListener('click', () => {
        /* Sauvegarder l'historique de l'agent courant avant de changer */
        if (_currentAgent) {
          _agentHistories[_currentAgent.id] = [..._chatHistory];
          _saveMemory();
        }
        _selectAgent(btn.dataset.agentId);
        /* Restaurer l'historique du nouvel agent (ou démarrer vide) */
        _chatHistory = _agentHistories[_currentAgent.id]
          ? [..._agentHistories[_currentAgent.id]]
          : [];
        _renderChat(el);
      });
    });

    /* Effacer le chat */
    el.querySelector('#btn-clear-chat').addEventListener('click', () => {
      _chatHistory = [];
      if (_currentAgent) {
        _agentHistories[_currentAgent.id] = [];
        _saveMemory();
      }
      _renderChat(el);
    });

    /* Ajouter un fait en mémoire partagée */
    const addFactBtn = el.querySelector('#btn-add-fact');
    const factInput  = el.querySelector('#new-fact-input');
    if (addFactBtn && factInput) {
      addFactBtn.addEventListener('click', () => {
        const fact = factInput.value.trim();
        if (!fact) return;
        _sharedFacts.push(fact);
        _saveMemory();
        factInput.value = '';
        _renderChat(el);
      });
      factInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { addFactBtn.click(); }
      });
    }

    /* Supprimer un fait de la mémoire partagée */
    el.querySelectorAll('.btn-del-fact').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        _sharedFacts.splice(idx, 1);
        _saveMemory();
        _renderChat(el);
      });
    });

    /* Envoi du message (bouton) */
    el.querySelector('#btn-send-chat').addEventListener('click', () => _sendMessage(el));

    /* Envoi du message (Entrée sans Maj) */
    el.querySelector('#chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _sendMessage(el);
      }
    });

    /* Scroll en bas */
    _scrollToBottom();
  }

  /** Rendu d'un message dans le chat */
  function _renderMessage(msg) {
    const isUser = msg.role === 'user';
    return `
      <div class="chat-message ${isUser ? 'msg-user' : 'msg-agent'}">
        <div class="msg-bubble">
          <div class="msg-content">${_formatMarkdown(msg.content)}</div>
          <div class="msg-meta">${_esc(msg.time || '')}</div>
        </div>
      </div>
    `;
  }

  /** Envoie un message à l'API Anthropic */
  async function _sendMessage(el) {
    const input    = el.querySelector('#chat-input');
    const errorEl  = el.querySelector('#chat-error');
    const sendBtn  = el.querySelector('#btn-send-chat');
    const text     = input ? input.value.trim() : '';

    if (!text) return;

    /* Vérifier la clé API */
    const apiKey = localStorage.getItem(STORAGE_KEY_API) || '';
    if (!apiKey) {
      _showError(errorEl, '⚠️ Veuillez saisir et sauvegarder votre clé API Anthropic.');
      return;
    }

    const agent = _currentAgent || AGENTS_LIST[0];

    /* Ajouter le message utilisateur à l'historique */
    _chatHistory.push({
      role:    'user',
      content: text,
      time:    _now()
    });

    /* Vider le champ et désactiver le bouton */
    input.value = '';
    sendBtn.disabled  = true;
    sendBtn.textContent = '⏳ En cours…';
    _showError(errorEl, '');

    /* Rafraîchir l'affichage avec le message utilisateur */
    _updateMessages(el);

    try {
      /* Messages pour l'API (sans le champ 'time') */
      const apiMessages = _chatHistory
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      const systemPrompt = await _buildSystemPrompt(agent);
      const model = agent.modele === 'claude-opus-4-6' ? 'claude-opus-4-6' : 'claude-sonnet-4-6';

      /* Boucle tool_use : Claude peut appeler plusieurs outils avant de répondre */
      let loopMessages = [...apiMessages];
      let finalReply   = '';
      let toolsLog     = [];  // trace des outils utilisés pour affichage

      for (let iter = 0; iter < 10; iter++) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type':         'application/json',
            'x-api-key':             apiKey,
            'anthropic-version':     '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
          },
          body: JSON.stringify({
            model, max_tokens: 2048,
            system:   systemPrompt,
            tools:    ERP_TOOLS,
            messages: loopMessages
          })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `Erreur HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.stop_reason === 'tool_use') {
          /* Claude veut utiliser un ou plusieurs outils */
          const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
          const toolResults   = [];

          for (const tu of toolUseBlocks) {
            sendBtn.textContent = `⚙️ ${tu.name.replace('erp_', '')}…`;
            toolsLog.push(tu.name);
            const result = await _executeTool(tu.name, tu.input);
            toolResults.push({
              type:        'tool_result',
              tool_use_id: tu.id,
              content:     JSON.stringify(result)
            });
          }

          /* Ajouter le tour assistant (avec tool_use) et le tour user (avec tool_result) */
          loopMessages.push({ role: 'assistant', content: data.content });
          loopMessages.push({ role: 'user',      content: toolResults });

        } else {
          /* Réponse finale texte */
          finalReply = data.content?.find(b => b.type === 'text')?.text || '(réponse vide)';
          break;
        }
      }

      /* Préfixe indiquant les outils utilisés */
      if (toolsLog.length > 0) {
        const outils = toolsLog.map(t => t.replace('erp_', '').replace(/_/g, ' ')).join(', ');
        finalReply = `*[Outils ERP utilisés : ${outils}]*\n\n${finalReply}`;
      }

      /* Ajouter la réponse de l'agent à l'historique */
      _chatHistory.push({ role: 'assistant', content: finalReply, time: _now() });

      /* Sauvegarder la session et la mémoire */
      _saveSession(agent, text, finalReply);
      _agentHistories[agent.id] = [..._chatHistory];
      _saveMemory();

    } catch (err) {
      _showError(errorEl, `❌ ${err.message}`);
      _chatHistory.pop();
    } finally {
      sendBtn.disabled    = false;
      sendBtn.textContent = '➤ Envoyer';
      _updateMessages(el);
      _scrollToBottom();
    }
  }

  /** Exécute un outil ERP et retourne le résultat en JSON */
  async function _executeTool(name, input) {
    if (typeof window.MYSQL === 'undefined') return { error: 'MySQL non disponible' };
    try {
      switch (name) {
        case 'erp_get_commandes':
          return await window.MYSQL.getAll('commandes', {
            sort: 'created_at', order: 'desc',
            limit: Math.min(input.limit || 10, 50)
          });

        case 'erp_get_produits':
          return await window.MYSQL.getAll('produits', { limit: input.limit || 50 });

        case 'erp_get_contacts':
          return input.query
            ? await window.MYSQL.search('contacts', input.query)
            : await window.MYSQL.getAll('contacts', { limit: input.limit || 10 });

        case 'erp_get_planning':
          return await window.MYSQL.getAll('planning_atelier', {
            sort: 'created_at', order: 'desc', limit: input.limit || 20
          });

        case 'erp_create_devis': {
          const ht  = Number(input.montant_ht);
          const ttc = Math.round(ht * 1.16);
          return await window.MYSQL.create('devis', {
            client_nom:  input.client_nom,
            montant_ht:  ht,
            montant_ttc: ttc,
            tva:         Math.round(ht * 0.16),
            description: input.description || '',
            statut:      input.statut || 'brouillon',
            date_devis:  new Date().toISOString().split('T')[0]
          });
        }

        case 'erp_create_tache':
          return createTache(input.titre, {
            description: input.description || '',
            priorite:    input.priorite   || 'normale',
            echeance:    input.echeance   || null,
            source:      'chat'
          });

        case 'erp_ouvrir_app':
          if (typeof openApp === 'function') {
            openApp(input.app);
            if (input.view && typeof openView === 'function') {
              setTimeout(() => openView(input.view), 80);
            }
            return { ok: true, message: `Navigation vers ${input.app} > ${input.view}` };
          }
          return { error: 'Fonction de navigation non disponible' };

        case 'erp_picwish':
          if (typeof openApp === 'function') {
            openApp('outils');
            setTimeout(() => openView('picwish-pipeline'), 80);
            return { ok: true, message: 'PicWish Pipeline ouvert' };
          }
          return { error: 'Navigation non disponible' };

        case 'erp_content_generator':
          if (typeof openApp === 'function') {
            openApp('outils');
            setTimeout(() => openView('content-generator'), 80);
            return { ok: true, message: 'Content Generator ouvert' };
          }
          return { error: 'Navigation non disponible' };

        case 'erp_dtf_studio':
          window.open('apps/dtf-studio.html', '_blank', 'noopener,noreferrer');
          return { ok: true, message: 'DTF Studio ouvert dans un nouvel onglet' };

        case 'erp_mockup_forge':
          window.open('apps/mockup-forge-v12.html', '_blank', 'noopener,noreferrer');
          return { ok: true, message: 'MockupForge v12 ouvert dans un nouvel onglet' };

        case 'erp_mockup_studio':
          window.open('apps/tshirt-mockup-studio.html', '_blank', 'noopener,noreferrer');
          return { ok: true, message: 'T-Shirt Mockup Studio ouvert dans un nouvel onglet' };

        case 'erp_dtf_plaques':
          if (typeof openApp === 'function') {
            openApp('outils');
            setTimeout(() => openView('dtf-plaques-transfert'), 80);
            return { ok: true, message: 'DTF Plaques Transfert ouvert' };
          }
          return { error: 'Navigation non disponible' };

        case 'erp_dtf_atelier': {
          const machine = (input.machine || 'bn20').toLowerCase();
          const viewId  = machine === 'usa' ? 'dtf-atelier-usa' : 'dtf-atelier-bn20-yannick';
          if (typeof openApp === 'function') {
            openApp('outils');
            setTimeout(() => openView(viewId), 80);
            return { ok: true, message: `DTF Atelier ${machine.toUpperCase()} ouvert` };
          }
          return { error: 'Navigation non disponible' };
        }

        default:
          return { error: `Outil inconnu : ${name}` };
      }
    } catch (e) {
      return { error: e.message };
    }
  }

  /** Met à jour uniquement la zone de messages sans recréer toute la vue */
  function _updateMessages(el) {
    const agent    = _currentAgent || AGENTS_LIST[0];
    const messagesEl = el.querySelector('#chat-messages');
    if (!messagesEl) return;

    if (_chatHistory.length === 0) {
      messagesEl.innerHTML = `
        <div class="chat-empty">
          <span style="font-size:2rem">${agent.icon}</span>
          <p>Bonjour ! Je suis <strong>${_esc(agent.nom)}</strong>.<br>${_esc(agent.description)}<br><em>Comment puis-je vous aider ?</em></p>
        </div>`;
    } else {
      messagesEl.innerHTML = _chatHistory.map(m => _renderMessage(m)).join('');
    }
    _scrollToBottom();
  }

  /* ================================================================
     VUE 3 — SESSIONS : liste des sessions de chat sauvegardées
     ================================================================ */
  function _renderSessions(el) {
    _loadSessions();

    if (_sessions.length === 0) {
      el.innerHTML = `
        <div class="agents-sessions">
          <div class="agents-header">
            <h2 class="agents-title">📋 Sessions Agents IA</h2>
          </div>
          <div class="table-empty">
            <p>Aucune session enregistrée.<br>Commencez par parler à un agent dans la vue <strong>Chat</strong>.</p>
          </div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div class="agents-sessions">
        <div class="agents-header">
          <h2 class="agents-title">📋 Sessions Agents IA</h2>
          <button class="btn btn-ghost btn-sm" id="btn-clear-sessions">🗑 Tout supprimer</button>
        </div>
        <div class="sessions-list">
          <table class="data-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Premier message</th>
                <th>Réponse</th>
                <th>Date</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${_sessions.slice().reverse().map(s => `
                <tr>
                  <td>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span>${_esc(s.agentIcon || '⬡')}</span>
                      <strong>${_esc(s.agentNom)}</strong>
                    </div>
                  </td>
                  <td class="session-preview">${_esc(_truncate(s.userMsg, 60))}</td>
                  <td class="session-preview">${_esc(_truncate(s.agentReply, 60))}</td>
                  <td style="white-space:nowrap;font-size:12px;color:var(--text-muted)">${_esc(s.date)}</td>
                  <td><span class="badge badge-success">Terminée</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    /* Bouton suppression de toutes les sessions */
    const btnClear = el.querySelector('#btn-clear-sessions');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('Supprimer toutes les sessions ?')) {
          _sessions = [];
          _saveSessions();
          _renderSessions(el);
        }
      });
    }
  }

  /* ================================================================
     TOOLBAR
     ================================================================ */
  function _renderToolbar(toolbarEl, view) {
    if (!toolbarEl) return;
    toolbarEl.innerHTML = '';

    if (view === 'chat' || view === 'dashboard') {
      /* Bouton "Nouvelle conversation" dans le chat */
      if (view === 'chat') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.textContent = '+ Nouvelle conversation';
        btn.addEventListener('click', () => {
          _chatHistory = [];
          if (_container) _renderChat(_container);
        });
        toolbarEl.appendChild(btn);
      }
    }
  }

  /* ================================================================
     UTILITAIRES INTERNES
     ================================================================ */

  /** Sélectionne l'agent courant par son ID */
  function _selectAgent(agentId) {
    _currentAgent = AGENTS_LIST.find(a => a.id === agentId) || AGENTS_LIST[0];
  }

  /**
   * Construit le system prompt complet :
   * - prompt de base de l'agent
   * - mémoire partagée inter-agents
   * - données ERP temps réel (MySQL)
   */
  async function _buildSystemPrompt(agent) {
    let prompt = agent.systemPrompt;

    /* Mémoire partagée inter-agents */
    if (_sharedFacts.length > 0) {
      prompt += `\n\n## Contexte partagé entre agents (mémoire commune)\n`;
      prompt += _sharedFacts.map(f => `- ${f}`).join('\n');
      prompt += `\n\nCes informations ont été mémorisées lors d'échanges avec d'autres agents HCS. Utilise-les pour répondre de façon cohérente.`;
    }

    /* Données ERP en temps réel depuis MySQL */
    const erpCtx = await _fetchERPContext();
    if (erpCtx) prompt += erpCtx;

    return prompt;
  }

  /**
   * Interroge MySQL pour obtenir un snapshot ERP récent.
   * Retourne une chaîne formatée prête à injecter dans le system prompt.
   * Silencieux en cas d'erreur (ne bloque pas le chat).
   */
  async function _fetchERPContext() {
    if (typeof window.MYSQL === 'undefined') return null;

    try {
      /* Requêtes parallèles — on prend les plus récentes, limit pour ne pas surcharger le prompt */
      const [commandes, produits, contacts, taches] = await Promise.all([
        window.MYSQL.getAll('commandes',       { sort: 'created_at', order: 'desc', limit: 10 }).catch(() => []),
        window.MYSQL.getAll('produits',        { limit: 50 }).catch(() => []),
        window.MYSQL.getAll('contacts',        { limit: 1 }).catch(() => []),
        window.MYSQL.getAll('taches_agents',   { sort: 'created_at', order: 'desc', limit: 10 }).catch(() => []),
      ]);

      /* Compter les contacts séparément sans charger tout */
      const nbContacts = contacts.length > 0 ? '≥1' : '0';

      /* Commandes urgentes = statut en_cours ou en attente */
      const cmdEnCours = commandes.filter(c =>
        ['en_cours','en attente','confirmée'].includes((c.statut || '').toLowerCase())
      );

      /* Stock faible = quantité ≤ 5 */
      const stockFaible = produits.filter(p => Number(p.quantite || p.stock || 0) <= 5);

      /* Tâches agents non terminées */
      const tachesActives = taches.filter(t => t.statut === 'todo' || t.statut === 'en_cours');

      let ctx = `\n\n## Données ERP — temps réel (${new Date().toLocaleString('fr-FR')})\n`;

      ctx += `\n### Commandes (${commandes.length} récentes)\n`;
      if (commandes.length === 0) {
        ctx += `- Aucune commande récente.\n`;
      } else {
        ctx += `- En cours / à traiter : ${cmdEnCours.length}\n`;
        commandes.slice(0, 5).forEach(c => {
          ctx += `- [${c.statut || '?'}] ${c.client_nom || c.client || 'Client inconnu'} — ${c.montant_ttc ? Number(c.montant_ttc).toLocaleString('fr-FR') + ' XPF' : ''} (${c.date_commande || c.created_at || ''})\n`;
        });
      }

      ctx += `\n### Stock produits (${produits.length} références)\n`;
      if (stockFaible.length > 0) {
        ctx += `⚠️ Stock faible (≤5 unités) : ${stockFaible.map(p => p.nom || p.name).join(', ')}\n`;
      } else {
        ctx += `- Aucun stock critique détecté.\n`;
      }

      ctx += `\n### Tâches agents (${tachesActives.length} actives)\n`;
      if (tachesActives.length === 0) {
        ctx += `- Aucune tâche en attente.\n`;
      } else {
        tachesActives.slice(0, 5).forEach(t => {
          ctx += `- [${t.priorite || 'normale'}] ${t.agent_nom || ''} : ${t.titre}\n`;
        });
      }

      ctx += `\nMonnaie : XPF (franc CFP). TVA : 16%. Taux USD/XPF ≈ 110.\n`;
      ctx += `Réponds en te basant sur ces données réelles. Si une information manque, indique-le clairement.\n`;

      return ctx;

    } catch (e) {
      console.warn('[Agents] _fetchERPContext échoué:', e.message);
      return null;
    }
  }

  /** Charge la mémoire partagée et les historiques depuis localStorage */
  function _loadMemory() {
    try {
      _sharedFacts    = JSON.parse(localStorage.getItem(STORAGE_KEY_MEM)  || '[]');
      _agentHistories = JSON.parse(localStorage.getItem(STORAGE_KEY_HIST) || '{}');
    } catch {
      _sharedFacts    = [];
      _agentHistories = {};
    }
  }

  /** Persiste la mémoire partagée et les historiques dans localStorage */
  function _saveMemory() {
    localStorage.setItem(STORAGE_KEY_MEM,  JSON.stringify(_sharedFacts));
    localStorage.setItem(STORAGE_KEY_HIST, JSON.stringify(_agentHistories));
  }

  /** Charge les sessions depuis localStorage */
  function _loadSessions() {
    try {
      _sessions = JSON.parse(localStorage.getItem(STORAGE_KEY_SESS) || '[]');
    } catch {
      _sessions = [];
    }
  }

  /** Persiste les sessions dans localStorage */
  function _saveSessions() {
    localStorage.setItem(STORAGE_KEY_SESS, JSON.stringify(_sessions));
  }

  /** Sauvegarde une nouvelle session après un échange */
  function _saveSession(agent, userMsg, agentReply) {
    _sessions.push({
      agentId:    agent.id,
      agentNom:   agent.nom,
      agentIcon:  agent.icon,
      userMsg,
      agentReply,
      date:       _now()
    });
    /* Garder les 100 dernières sessions */
    if (_sessions.length > 100) _sessions = _sessions.slice(-100);
    _saveSessions();
  }

  /** Scroll automatique vers le bas de la zone messages */
  function _scrollToBottom() {
    setTimeout(() => {
      const zone = document.getElementById('chat-messages');
      if (zone) zone.scrollTop = zone.scrollHeight;
    }, 50);
  }

  /** Affiche un message d'erreur dans la zone dédiée */
  function _showError(el, msg) {
    if (!el) return;
    el.textContent  = msg;
    el.style.display = msg ? 'block' : 'none';
  }

  /** Affiche un toast via le composant global si disponible */
  function _showToast(msg, type = 'info') {
    if (typeof Toast !== 'undefined' && Toast.show) {
      Toast.show(msg, type);
    }
  }

  /** Heure courante formatée */
  function _now() {
    return new Date().toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  /** Tronque une chaîne */
  function _truncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  /** Échappe le HTML pour éviter les injections XSS */
  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Convertit un texte Markdown minimal en HTML sécurisé.
   * Gère : **gras**, *italique*, `code`, sauts de ligne.
   * Le contenu est d'abord échappé puis les balises Markdown sont appliquées.
   */
  function _formatMarkdown(text) {
    if (!text) return '';
    let s = _esc(text);
    // Blocs de code ```
    s = s.replace(/```([\s\S]*?)```/g, '<pre class="msg-code">$1</pre>');
    // Code inline
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Gras
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italique
    s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Sauts de ligne → <br>
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  /* ================================================================
     TÂCHES AGENTS — lecture/écriture via Store.js → MySQL
     ================================================================ */

  /**
   * Crée une tâche agent dans le Store (sync MySQL automatique).
   * @param {string} titre
   * @param {object} opts - { description, priorite, echeance, source, contexte }
   */
  function createTache(titre, opts = {}) {
    if (typeof Store === 'undefined') {
      console.warn('[Agents] Store non disponible — tâche non sauvegardée MySQL');
      return null;
    }
    const agent = _currentAgent || AGENTS_LIST[0];
    const record = {
      agent_id:    agent.id,
      agent_nom:   agent.nom,
      agent_icon:  agent.icon,
      titre:       titre,
      description: opts.description || '',
      statut:      'todo',
      priorite:    opts.priorite    || 'normale',
      source:      opts.source      || 'chat',
      contexte:    opts.contexte    ? JSON.stringify(opts.contexte) : '',
      echeance:    opts.echeance    || null,
    };
    return Store.create('taches_agents', record);
  }

  /**
   * Retourne toutes les tâches de la collection (triées par date desc).
   */
  function getTaches(filtreAgent = null) {
    if (typeof Store === 'undefined') return [];
    const all = Store.getAll('taches_agents') || [];
    if (filtreAgent) return all.filter(t => t.agent_id === filtreAgent);
    return all;
  }

  /**
   * Met à jour le statut d'une tâche.
   */
  function updateTacheStatut(tacheId, statut) {
    if (typeof Store === 'undefined') return;
    Store.update('taches_agents', tacheId, { statut });
  }

  /* ----------------------------------------------------------------
     API PUBLIQUE
     ---------------------------------------------------------------- */
  return { init, createTache, getTaches, updateTacheStatut };

})();

window.Agents = Agents;
