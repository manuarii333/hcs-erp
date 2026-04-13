/* ================================================================
   HCS ERP — Command Palette (Ctrl+K)
   Navigation ultra-rapide, recherche globale, actions rapides.
   Inspiré de Notion, Linear, VS Code.
   Exposé via window.CommandPalette
   ================================================================ */

'use strict';

const CommandPalette = (() => {

  let _isOpen    = false;
  let _selIndex  = -1;
  let _items     = [];
  let _overlay   = null;

  /* ================================================================
     ACTIONS STATIQUES — navigation + création
     ================================================================ */
  const STATIC_ACTIONS = [
    /* Navigation modules */
    { id: 'go-dashboard',    label: 'Aller à Accueil',        icon: '⊞',  category: 'Navigation', action: () => { openApp('dashboard'); } },
    { id: 'go-ventes',       label: 'Aller à Ventes',         icon: '🛒',  category: 'Navigation', action: () => { openApp('ventes'); } },
    { id: 'go-contacts',     label: 'Aller à Contacts',       icon: '👤',  category: 'Navigation', action: () => { openApp('ventes'); setTimeout(() => openView('contacts'), 60); } },
    { id: 'go-pipeline',     label: 'Aller au Pipeline',      icon: '⊞',  category: 'Navigation', action: () => { openApp('ventes'); setTimeout(() => openView('pipeline'), 60); } },
    { id: 'go-stock',        label: 'Aller à Stock',          icon: '📦',  category: 'Navigation', action: () => { openApp('stock'); } },
    { id: 'go-production',   label: 'Aller à Production',     icon: '⚙️', category: 'Navigation', action: () => { openApp('production'); } },
    { id: 'go-comptabilite', label: 'Aller à Comptabilité',   icon: '💰',  category: 'Navigation', action: () => { openApp('comptabilite'); } },
    { id: 'go-caisse',       label: 'Ouvrir la Caisse',       icon: '💳',  category: 'Navigation', action: () => { openApp('caisse'); } },
    { id: 'go-parametres',   label: 'Aller à Paramètres',     icon: '⚙',  category: 'Navigation', action: () => { openApp('parametres'); } },
    { id: 'go-boutique',     label: 'Config. boutique',       icon: '🏪',  category: 'Navigation', action: () => { openApp('parametres'); setTimeout(() => openView('boutique'), 60); } },

    /* Actions de création */
    { id: 'new-devis',       label: 'Créer un devis',         icon: '📄',  category: 'Créer',      action: () => { openApp('ventes'); setTimeout(() => openView('quotes'), 60); } },
    { id: 'new-commande',    label: 'Créer une commande',     icon: '📦',  category: 'Créer',      action: () => { openApp('ventes'); setTimeout(() => openView('orders'), 60); } },
    { id: 'new-facture',     label: 'Créer une facture',      icon: '🧾',  category: 'Créer',      action: () => { openApp('ventes'); setTimeout(() => openView('invoices'), 60); } },
    { id: 'new-client',      label: 'Ajouter un client',      icon: '👤',  category: 'Créer',      action: () => { openApp('ventes'); setTimeout(() => openView('contacts'), 60); } },
    { id: 'new-produit',     label: 'Ajouter un produit',     icon: '📦',  category: 'Créer',      action: () => { openApp('stock'); } },
    { id: 'new-depense',     label: 'Ajouter une dépense',    icon: '💸',  category: 'Créer',      action: () => { openApp('comptabilite'); setTimeout(() => openView('depenses'), 60); } },
    { id: 'new-of',          label: 'Nouvel ordre de fabrication', icon: '🔧', category: 'Créer', action: () => { openApp('production'); } },
    { id: 'new-fournisseur', label: 'Ajouter un fournisseur', icon: '🏭',  category: 'Créer',      action: () => { openApp('stock'); setTimeout(() => openView('suppliers'), 60); } },
  ];

  /* ================================================================
     OUVRIR LA PALETTE
     ================================================================ */
  function open() {
    if (_isOpen) { _focusInput(); return; }

    _overlay = document.createElement('div');
    _overlay.id = 'cp-overlay';
    _overlay.innerHTML = _buildHTML();
    Object.assign(_overlay.style, {
      position: 'fixed', inset: '0', zIndex: '9999',
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '12vh'
    });

    document.body.appendChild(_overlay);
    _isOpen   = true;
    _selIndex = -1;

    /* Fermer au clic sur l'overlay */
    _overlay.addEventListener('click', e => {
      if (e.target === _overlay) close();
    });

    /* Charger les résultats initiaux (suggestions) */
    _search('');
    _focusInput();
    _bindEvents();
  }

  /* ================================================================
     FERMER
     ================================================================ */
  function close() {
    if (!_isOpen) return;
    _overlay?.remove();
    _overlay  = null;
    _isOpen   = false;
    _selIndex = -1;
    _items    = [];
  }

  /* ================================================================
     HTML STRUCTURE
     ================================================================ */
  function _buildHTML() {
    return `
      <div id="cp-box" style="
        background:#ffffff; border-radius:14px; width:640px; max-width:95vw;
        max-height:75vh; display:flex; flex-direction:column; overflow:hidden;
        box-shadow:0 32px 96px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.08);
      ">
        <!-- Barre de recherche -->
        <div style="
          display:flex; align-items:center; gap:12px;
          padding:16px 20px; border-bottom:1px solid #F3F4F6;
        ">
          <span style="font-size:20px; color:#9CA3AF; flex-shrink:0;">🔍</span>
          <input id="cp-input" type="text" autocomplete="off" spellcheck="false"
            placeholder="Rechercher ou exécuter une action…"
            style="
              flex:1; border:none; outline:none; font-size:16px;
              background:transparent; color:#111827; font-family:inherit;
            " />
          <kbd style="
            font-size:11px; color:#9CA3AF; background:#F9FAFB;
            padding:4px 8px; border-radius:6px; border:1px solid #E5E7EB;
            white-space:nowrap; flex-shrink:0;
          ">Échap</kbd>
        </div>

        <!-- Résultats -->
        <div id="cp-results" style="
          overflow-y:auto; flex:1; overscroll-behavior:contain;
        "></div>

        <!-- Footer -->
        <div style="
          padding:8px 20px; border-top:1px solid #F3F4F6;
          display:flex; align-items:center; gap:16px;
          font-size:11px; color:#9CA3AF;
        ">
          <span>↑↓ naviguer</span>
          <span>↵ exécuter</span>
          <span>Échap fermer</span>
        </div>
      </div>
    `;
  }

  /* ================================================================
     LIAISON DES ÉVÉNEMENTS
     ================================================================ */
  function _bindEvents() {
    const input = document.getElementById('cp-input');
    if (!input) return;

    input.addEventListener('input', () => _search(input.value));

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); _moveSel(1);  return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); _moveSel(-1); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = _items[_selIndex >= 0 ? _selIndex : 0];
        if (item) _execute(item);
        return;
      }
    });

    /* Délégation de clic sur les items */
    document.getElementById('cp-results')?.addEventListener('click', e => {
      const li = e.target.closest('[data-cp-idx]');
      if (li) _execute(_items[parseInt(li.dataset.cpIdx)]);
    });
  }

  function _focusInput() {
    setTimeout(() => document.getElementById('cp-input')?.focus(), 30);
  }

  /* ================================================================
     RECHERCHE + RENDU
     ================================================================ */
  function _search(query) {
    const q = (query || '').toLowerCase().trim();
    _items    = [];
    _selIndex = -1;

    const sections = [];

    /* --- Section 1 : résultats de données --- */
    if (q.length > 0) {
      const db = typeof Store !== 'undefined' ? Store.getDB() : {};
      const DATA_COLS = [
        { key: 'contacts',  label: 'Clients',    icon: '👤', fields: ['nom','email','telephone'],  app: 'ventes', view: 'contacts'  },
        { key: 'devis',     label: 'Devis',      icon: '📄', fields: ['ref','client'],             app: 'ventes', view: 'quotes'    },
        { key: 'commandes', label: 'Commandes',  icon: '📦', fields: ['ref','client'],             app: 'ventes', view: 'orders'    },
        { key: 'factures',  label: 'Factures',   icon: '🧾', fields: ['ref','client'],             app: 'ventes', view: 'invoices'  },
        { key: 'produits',  label: 'Produits',   icon: '📋', fields: ['nom','ref','sku'],          app: 'stock',  view: 'products'  },
        { key: 'depenses',  label: 'Dépenses',   icon: '💸', fields: ['libelle','categorie'],      app: 'comptabilite', view: 'depenses' },
      ];

      DATA_COLS.forEach(col => {
        const matches = (db[col.key] || [])
          .filter(item => col.fields.some(f => String(item[f] || '').toLowerCase().includes(q)))
          .slice(0, 4);

        if (!matches.length) return;

        const colItems = matches.map(item => ({
          id:       col.key + '-' + item.id,
          label:    String(item[col.fields[0]] || item.id || '—'),
          sub:      String(item[col.fields[1]] || ''),
          icon:     col.icon,
          category: col.label,
          action:   () => {
            if (typeof openApp === 'function') {
              openApp(col.app);
              setTimeout(() => { if (typeof openView === 'function') openView(col.view); }, 60);
            }
          }
        }));

        sections.push({ category: col.label, items: colItems });
        _items.push(...colItems);
      });
    }

    /* --- Section 2 : actions statiques filtrées --- */
    const filteredActions = q
      ? STATIC_ACTIONS.filter(a => a.label.toLowerCase().includes(q) || a.category.toLowerCase().includes(q))
      : STATIC_ACTIONS;

    /* Regrouper par catégorie */
    const actionGroups = {};
    filteredActions.forEach(a => {
      if (!actionGroups[a.category]) actionGroups[a.category] = [];
      actionGroups[a.category].push(a);
    });
    Object.entries(actionGroups).forEach(([cat, items]) => {
      sections.push({ category: cat, items });
      _items.push(...items);
    });

    _renderResults(sections, q);
  }

  function _renderResults(sections, q) {
    const el = document.getElementById('cp-results');
    if (!el) return;

    if (sections.length === 0) {
      el.innerHTML = `
        <div style="padding:32px;text-align:center;color:#9CA3AF;font-size:14px;">
          Aucun résultat pour <strong style="color:#6B7280;">"${_esc(q)}"</strong>
        </div>`;
      return;
    }

    let idx   = 0;
    let html  = '';

    sections.forEach(({ category, items }) => {
      html += `<div style="
        padding:8px 20px 4px;
        font-size:11px; font-weight:700; color:#9CA3AF;
        text-transform:uppercase; letter-spacing:.07em;
      ">${_esc(category)}</div>`;

      items.forEach(item => {
        const i = idx++;
        html += `
          <div data-cp-idx="${i}" style="
            display:flex; align-items:center; gap:12px;
            padding:10px 20px; cursor:pointer;
            transition:background .08s; border-radius:0;
          "
          onmouseenter="this.style.background='#F3F4F6'"
          onmouseleave="this.style.background=''"
          >
            <span style="font-size:20px;flex-shrink:0;width:28px;text-align:center;">${item.icon || '→'}</span>
            <div style="flex:1;min-width:0;">
              <div style="
                font-size:14px;font-weight:500;color:#111827;
                overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
              ">${_highlight(_esc(item.label), q)}</div>
              ${item.sub ? `<div style="font-size:12px;color:#6B7280;margin-top:1px;">${_esc(item.sub)}</div>` : ''}
            </div>
            <span style="font-size:16px;color:#D1D5DB;flex-shrink:0;">→</span>
          </div>`;
      });
    });

    el.innerHTML = html;
    _selIndex = -1;
  }

  /* ================================================================
     NAVIGATION CLAVIER
     ================================================================ */
  function _moveSel(dir) {
    const els = document.querySelectorAll('#cp-results [data-cp-idx]');
    if (!els.length) return;
    _selIndex = (_selIndex + dir + els.length) % els.length;
    els.forEach((el, i) => {
      el.style.background = i === _selIndex ? '#EEF2FF' : '';
      el.style.color      = i === _selIndex ? 'var(--accent-blue, #6366F1)' : '';
    });
    els[_selIndex]?.scrollIntoView({ block: 'nearest' });
  }

  /* ================================================================
     EXÉCUTER UNE ACTION
     ================================================================ */
  function _execute(item) {
    if (!item) return;
    close();
    setTimeout(() => {
      try { item.action(); } catch (err) { console.error('CommandPalette action error:', err); }
    }, 30);
  }

  /* ================================================================
     UTILITAIRES
     ================================================================ */
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _highlight(html, q) {
    if (!q) return html;
    /* Met en gras la partie correspondante */
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return html.replace(re, '<strong style="color:var(--accent-blue,#6366F1);">$1</strong>');
  }

  /* ================================================================
     API PUBLIQUE
     ================================================================ */
  return { open, close };

})();

/* Exposer globalement */
window.CommandPalette = CommandPalette;
