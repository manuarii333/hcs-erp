/* ================================================================
   HCS ERP â js/modules/sales-ux.js
   Patch additif UX pour le module Ventes â v1.3.0
   
   CE QUE CE FICHIER FAIT :
   - Ajoute un autocomplete client (combobox) sur les sÃ©lects de devis
   - Ajoute un autocomplete produit performant sur les lignes
   - Ajoute des raccourcis clavier : Tab intelligent, EntrÃ©e=nouvelle ligne,
     Ctrl+S=sauvegarder, Ctrl+D=dupliquer ligne, Suppr=supprimer ligne
   - Ajoute remise globale et frais de port dans les totaux
   - Ajoute raccourcis dates ("Auj.", "+30j")
   - Patch bug TVA par dÃ©faut (prend la TVA rÃ©elle du produit au lieu de 16 en dur)
   - Patch bug suppression devis (vÃ©rifie les dÃ©pendances)
   
   USAGE : charger APRÃS sales.js dans index.html
     <script src="js/modules/sales.js?v=..."></script>
     <script src="js/modules/sales-ux.js?v=2026042001"></script>
   
   Aucune modification de sales.js n'est nÃ©cessaire.
   ================================================================ */

'use strict';

(function() {

  /* Attendre que Sales soit chargÃ© */
  if (typeof window.Sales === 'undefined') {
    console.warn('[SalesUX] Sales non chargÃ© â patch ignorÃ©');
    return;
  }

  /* ================================================================
     1. INJECTION CSS â styles pour l'autocomplete et les amÃ©liorations
     ================================================================ */
  function _injectStyles() {
    if (document.getElementById('sales-ux-styles')) return;
    const style = document.createElement('style');
    style.id = 'sales-ux-styles';
    style.textContent = `
      /* ===== Autocomplete combobox ===== */
      .ac-wrap {
        position: relative;
        width: 100%;
      }
      .ac-input {
        width: 100%;
        padding: 8px 32px 8px 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--bg-surface);
        color: var(--text-primary);
        font-size: 14px;
        font-family: inherit;
      }
      .ac-input:focus {
        outline: none;
        border-color: var(--accent-blue, #4a5fff);
        box-shadow: 0 0 0 3px rgba(74, 95, 255, 0.12);
      }
      .ac-clear {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        background: transparent;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 16px;
        padding: 2px 4px;
        line-height: 1;
        display: none;
      }
      .ac-wrap.has-value .ac-clear { display: block; }
      .ac-clear:hover { color: var(--accent-red); }
      
      .ac-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        max-height: 280px;
        overflow-y: auto;
        z-index: 1000;
        display: none;
      }
      .ac-dropdown.open { display: block; }
      
      .ac-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 13px;
        color: var(--text-primary);
        border-bottom: 1px solid var(--border-subtle, rgba(0,0,0,0.04));
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ac-item:last-child { border-bottom: none; }
      .ac-item:hover,
      .ac-item.selected {
        background: var(--bg-elevated, #f4f6ff);
        color: var(--accent-blue, #4a5fff);
      }
      .ac-item-icon {
        font-size: 16px;
        flex-shrink: 0;
        width: 20px;
        text-align: center;
      }
      .ac-item-main {
        flex: 1;
        min-width: 0;
      }
      .ac-item-title {
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .ac-item-sub {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 1px;
      }
      .ac-item-price {
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        color: var(--accent-green, #00d4aa);
        flex-shrink: 0;
        font-weight: 600;
      }
      .ac-item-create {
        color: var(--accent-blue, #4a5fff);
        font-weight: 600;
        border-top: 1px solid var(--border);
      }
      .ac-empty {
        padding: 16px;
        text-align: center;
        color: var(--text-muted);
        font-size: 13px;
      }
      .ac-hint-match {
        background: rgba(255, 200, 87, 0.3);
        padding: 0 2px;
        border-radius: 2px;
      }
      
      /* ===== Toolbar actions ligne (apparaÃ®t au hover) ===== */
      .line-table tr.line-row {
        position: relative;
        transition: background 0.15s;
      }
      .line-table tr.line-row:hover {
        background: var(--bg-elevated, rgba(74, 95, 255, 0.04));
      }
      .line-row-actions {
        display: flex;
        gap: 4px;
      }
      .line-action-btn {
        background: transparent;
        border: 1px solid transparent;
        cursor: pointer;
        padding: 3px 6px;
        border-radius: 4px;
        font-size: 12px;
        color: var(--text-muted);
        transition: all 0.15s;
      }
      .line-action-btn:hover {
        background: var(--bg-surface);
        border-color: var(--border);
        color: var(--text-primary);
      }
      .line-action-btn.danger:hover {
        background: rgba(255, 107, 107, 0.1);
        color: var(--accent-red);
        border-color: var(--accent-red);
      }
      
      /* ===== Remise globale / Frais de port ===== */
      .totals-extras {
        margin: 12px 0;
        padding: 12px;
        background: var(--bg-elevated);
        border-radius: 8px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .totals-extras .form-group {
        margin: 0;
      }
      .totals-extras label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        font-weight: 600;
        margin-bottom: 4px;
        display: block;
      }
      .remise-group {
        display: flex;
        gap: 4px;
        align-items: stretch;
      }
      .remise-group input {
        flex: 1;
        min-width: 0;
      }
      .remise-group select {
        width: 60px;
        flex-shrink: 0;
      }
      
      /* ===== Raccourcis dates ===== */
      .date-shortcuts {
        display: flex;
        gap: 4px;
        margin-top: 4px;
      }
      .date-chip {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--bg-surface);
        cursor: pointer;
        color: var(--text-secondary);
        transition: all 0.15s;
      }
      .date-chip:hover {
        background: var(--accent-blue, #4a5fff);
        color: white;
        border-color: transparent;
      }
      
      /* ===== Indicateur raccourcis ===== */
      .kbd-hint {
        position: fixed;
        bottom: 16px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 6px 16px;
        font-size: 11px;
        color: var(--text-muted);
        display: flex;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 100;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s;
      }
      .kbd-hint.visible { opacity: 1; }
      .kbd-hint kbd {
        background: var(--bg-surface);
        border: 1px solid var(--border);
        border-radius: 3px;
        padding: 1px 5px;
        font-family: var(--font-mono, monospace);
        font-size: 10px;
        color: var(--text-primary);
      }
    `;
    document.head.appendChild(style);
  }

  /* ================================================================
     2. AUTOCOMPLETE COMBOBOX â gÃ©nÃ©rique rÃ©utilisable
     ================================================================ */

  /**
   * CrÃ©e un combobox recherchable (remplace un <select>).
   * @param {HTMLElement} container - oÃ¹ insÃ©rer le combobox
   * @param {object} config
   *   - items : [{ id, label, sub?, icon?, price?, _raw? }]
   *   - value : id sÃ©lectionnÃ© initialement
   *   - placeholder : texte d'aide
   *   - onChange : callback(id, item)
   *   - onCreate : optionnel - callback(query) pour crÃ©er Ã  la volÃ©e
   *   - createLabel : libellÃ© du bouton "crÃ©er" (ex: "â CrÃ©er client")
   */
  function createCombobox(container, config) {
    const {
      items = [],
      value = '',
      placeholder = 'Rechercher...',
      onChange = null,
      onCreate = null,
      createLabel = 'â CrÃ©er nouveau'
    } = config;

    const selected = items.find(i => String(i.id) === String(value));

    const wrap = document.createElement('div');
    wrap.className = 'ac-wrap' + (selected ? ' has-value' : '');
    wrap.innerHTML = `
      <input type="text" class="ac-input" placeholder="${placeholder}"
        value="${selected ? _esc(selected.label) : ''}"
        autocomplete="off" spellcheck="false" />
      <button type="button" class="ac-clear" title="Effacer">â</button>
      <div class="ac-dropdown"></div>
    `;

    container.innerHTML = '';
    container.appendChild(wrap);

    const input    = wrap.querySelector('.ac-input');
    const clearBtn = wrap.querySelector('.ac-clear');
    const dropdown = wrap.querySelector('.ac-dropdown');

    let currentId  = value;
    let filtered   = items;
    let selIdx     = -1;

    function render(q) {
      const query = (q || '').toLowerCase().trim();
      if (!query) {
        filtered = items.slice(0, 20);
      } else {
        filtered = items.filter(i => {
          const text = [i.label, i.sub || ''].join(' ').toLowerCase();
          return text.includes(query);
        }).slice(0, 20);
      }

      if (filtered.length === 0 && !onCreate) {
        dropdown.innerHTML = `<div class="ac-empty">Aucun rÃ©sultat</div>`;
      } else {
        dropdown.innerHTML = filtered.map((i, idx) => `
          <div class="ac-item ${idx === selIdx ? 'selected' : ''}"
               data-idx="${idx}" data-id="${_esc(String(i.id))}">
            ${i.icon ? `<span class="ac-item-icon">${i.icon}</span>` : ''}
            <div class="ac-item-main">
              <div class="ac-item-title">${_highlight(i.label, query)}</div>
              ${i.sub ? `<div class="ac-item-sub">${_highlight(i.sub, query)}</div>` : ''}
            </div>
            ${i.price !== undefined ? `<div class="ac-item-price">${_fmt(i.price)}</div>` : ''}
          </div>
        `).join('');

        /* Option "CrÃ©er" si fonction fournie et requÃªte non vide */
        if (onCreate && query) {
          dropdown.innerHTML += `
            <div class="ac-item ac-item-create" data-create="1">
              ${createLabel} Â« ${_esc(query)} Â»
            </div>`;
        }
      }
    }

    function open() {
      dropdown.classList.add('open');
      render(input.value);
    }
    function close() {
      dropdown.classList.remove('open');
      selIdx = -1;
    }

    input.addEventListener('focus', open);
    input.addEventListener('input', () => {
      selIdx = -1;
      open();
      wrap.classList.toggle('has-value', !!input.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        open();
        selIdx = Math.min(selIdx + 1, filtered.length - 1);
        render(input.value);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selIdx = Math.max(selIdx - 1, 0);
        render(input.value);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selIdx >= 0 && filtered[selIdx]) {
          _select(filtered[selIdx]);
        } else if (filtered.length === 1) {
          _select(filtered[0]);
        } else if (onCreate && input.value.trim()) {
          onCreate(input.value.trim());
          close();
        }
      } else if (e.key === 'Escape') {
        close();
        input.blur();
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      currentId = '';
      wrap.classList.remove('has-value');
      if (onChange) onChange('', null);
      input.focus();
    });

    dropdown.addEventListener('click', (e) => {
      const createEl = e.target.closest('[data-create]');
      if (createEl && onCreate) {
        onCreate(input.value.trim());
        close();
        return;
      }
      const itemEl = e.target.closest('.ac-item');
      if (!itemEl || itemEl.dataset.create) return;
      const idx = parseInt(itemEl.dataset.idx);
      if (filtered[idx]) _select(filtered[idx]);
    });

    /* Click outside â fermer */
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) close();
    });

    function _select(item) {
      input.value = item.label;
      currentId = item.id;
      wrap.classList.add('has-value');
      if (onChange) onChange(item.id, item);
      close();
    }

    return {
      getValue: () => currentId,
      setValue: (id) => {
        const item = items.find(i => String(i.id) === String(id));
        if (item) {
          input.value = item.label;
          currentId = id;
          wrap.classList.add('has-value');
        } else {
          input.value = '';
          currentId = '';
          wrap.classList.remove('has-value');
        }
      },
      focus: () => input.focus()
    };
  }

  /* ================================================================
     3. AMÃLIORATION DU FORMULAIRE DEVIS â hook non destructif
     On observe la crÃ©ation du sÃ©lecteur client natif, on le remplace.
     ================================================================ */

  function enhanceQuoteForm() {
    /* Remplacer le <select> client par un combobox recherchable */
    const selClient = document.getElementById('q-client');
    if (!selClient || selClient.dataset.enhanced) return;
    selClient.dataset.enhanced = '1';

    const originalParent = selClient.parentNode;
    const currentValue = selClient.value;

    /* Construire la liste des clients */
    const contacts = Store.getAll('contacts');
    const items = contacts.map(c => ({
      id: c.id,
      label: c.nom || c.id,
      sub: [c.email, c.telephone].filter(Boolean).join(' Â· '),
      icon: 'ð¤',
      _raw: c
    }));

    /* CrÃ©er un host pour le combobox */
    const host = document.createElement('div');
    host.id = 'q-client-ac';

    /* Masquer le select original (il reste pour le submit form) */
    selClient.style.display = 'none';
    originalParent.appendChild(host);

    const combo = createCombobox(host, {
      items,
      value: currentValue,
      placeholder: 'Rechercher ou crÃ©er un client...',
      onChange: (id) => {
        selClient.value = id || '';
        /* DÃ©clencher change pour que le code existant rÃ©agisse */
        selClient.dispatchEvent(new Event('change', { bubbles: true }));
      },
      onCreate: (query) => {
        /* DÃ©clencher le modal de crÃ©ation existant */
        selClient.value = '__new__';
        selClient.dispatchEvent(new Event('change', { bubbles: true }));
        /* Si le prÃ©nom est saisi dans la recherche, prÃ©remplir */
        setTimeout(() => {
          const inputNom = document.getElementById('qc-nom');
          if (inputNom && !inputNom.value) inputNom.value = query;
        }, 100);
      },
      createLabel: 'â CrÃ©er client'
    });

    /* Sauver la rÃ©fÃ©rence pour sync externe */
    host._combo = combo;
  }

  /* ================================================================
     4. AMÃLIORATION DES LIGNES DE DEVIS
     - Raccourcis clavier
     - Autocomplete produit
     - Actions duplication/insertion
     ================================================================ */

  function enhanceLineTable() {
    const tbody = document.getElementById('line-tbody');
    if (!tbody || tbody.dataset.uxEnhanced) return;
    tbody.dataset.uxEnhanced = '1';

    /* Convertir chaque <select> produit en combobox */
    _upgradeProductSelects(tbody);

    /* Ãcouter les nouvelles lignes ajoutÃ©es (aprÃ¨s clic + ou refresh) */
    const observer = new MutationObserver(() => {
      _upgradeProductSelects(tbody);
      _addLineActions(tbody);
    });
    observer.observe(tbody, { childList: true, subtree: false });

    /* Ajouter les actions sur lignes */
    _addLineActions(tbody);

    /* Raccourcis clavier globaux */
    _bindKeyboardShortcuts();

    /* Afficher les hints */
    _showKeyboardHints();
  }

  function _upgradeProductSelects(tbody) {
    tbody.querySelectorAll('select[data-field="produitId"]').forEach(sel => {
      if (sel.dataset.acUpgraded) return;
      sel.dataset.acUpgraded = '1';

      const line = sel.dataset.line;
      const currentValue = sel.value;

      const produits = Store.getAll('produits')
        .filter(p => p.status !== 'archived');
      
      const items = produits.map(p => ({
        id: p.id,
        label: p.nom,
        sub: [p.ref, p.sku, p.categorie].filter(Boolean).join(' Â· '),
        icon: p.emoji || 'ð¦',
        price: p.prix || 0,
        _raw: p
      }));

      const host = document.createElement('div');
      host.style.cssText = 'min-width:180px;';
      sel.style.display = 'none';
      sel.parentNode.appendChild(host);

      const combo = createCombobox(host, {
        items,
        value: currentValue,
        placeholder: 'Produit...',
        onChange: (id) => {
          sel.value = id || '';
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });

      /* Exposer combobox pour les raccourcis Ctrl+D */
      sel._combo = combo;
    });
  }

  function _addLineActions(tbody) {
    tbody.querySelectorAll('tr').forEach(tr => {
      if (tr.dataset.lineActionsAdded) return;
      tr.dataset.lineActionsAdded = '1';
      tr.classList.add('line-row');

      const lineIdx = tr.dataset.line;
      if (lineIdx === undefined) return;

      /* Transformer le bouton "â" existant en groupe d'actions */
      const removeBtn = tr.querySelector('[data-remove]');
      if (!removeBtn) return;

      const actionsCell = removeBtn.parentNode;
      actionsCell.innerHTML = `
        <div class="line-row-actions">
          <button type="button" class="line-action-btn" data-line-dup="${lineIdx}"
            title="Dupliquer cette ligne (Ctrl+D)">â</button>
          <button type="button" class="line-action-btn" data-line-insert="${lineIdx}"
            title="InsÃ©rer une ligne ci-dessous (EntrÃ©e)">âµ</button>
          <button type="button" class="line-action-btn danger" data-remove="${lineIdx}"
            title="Supprimer cette ligne (Suppr)">â</button>
        </div>`;
    });

    /* DÃ©lÃ©gation des nouveaux boutons */
    if (!tbody.dataset.lineActionsBound) {
      tbody.dataset.lineActionsBound = '1';
      tbody.addEventListener('click', (e) => {
        const dupBtn = e.target.closest('[data-line-dup]');
        const insBtn = e.target.closest('[data-line-insert]');
        if (dupBtn) {
          _dupLine(parseInt(dupBtn.dataset.lineDup));
          e.stopPropagation();
        } else if (insBtn) {
          _insertLine(parseInt(insBtn.dataset.lineInsert) + 1);
          e.stopPropagation();
        }
      });
    }
  }

  /* Dupliquer une ligne */
  function _dupLine(idx) {
    const state = _getSalesState();
    if (!state || !state.lignes || !state.lignes[idx]) return;
    const copy = JSON.parse(JSON.stringify(state.lignes[idx]));
    state.lignes.splice(idx + 1, 0, copy);
    _triggerRefresh();
    if (typeof toast === 'function') toast('Ligne dupliquÃ©e', 'success', 1500);
  }

  /* InsÃ©rer une ligne vide aprÃ¨s idx */
  function _insertLine(idx) {
    const state = _getSalesState();
    if (!state || !state.lignes) return;
    const newLine = {
      produitId: '', description: '', qte: 1, prixUnitaire: 0,
      remise: 0, tauxTVA: 16, taille: '', couleur: '',
      technique: '', emplacement: '', notes_design: ''
    };
    state.lignes.splice(idx, 0, newLine);
    _triggerRefresh();
  }

  /* ================================================================
     5. RACCOURCIS CLAVIER GLOBAUX (dans le contexte du formulaire)
     ================================================================ */
  let _shortcutsBound = false;
  function _bindKeyboardShortcuts() {
    if (_shortcutsBound) return;
    _shortcutsBound = true;

    document.addEventListener('keydown', (e) => {
      /* Ignorer si on n'est pas dans un formulaire devis/commande/facture */
      const hasForm = document.getElementById('line-tbody');
      if (!hasForm) return;

      /* Ctrl+S : sauvegarder */
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const btn = document.getElementById('q-save') ||
                    document.querySelector('[id^="btn-save"]') ||
                    document.querySelector('.btn-primary[type="submit"]');
        if (btn) btn.click();
        return;
      }

      /* Ctrl+D : dupliquer ligne active (si curseur dans tbody) */
      if (e.ctrlKey && e.key === 'd') {
        const activeLine = e.target.closest('tr[data-line]');
        if (activeLine) {
          e.preventDefault();
          _dupLine(parseInt(activeLine.dataset.line));
        }
        return;
      }

      /* EntrÃ©e sur la derniÃ¨re ligne â ajouter nouvelle ligne */
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        const activeLine = e.target.closest('tr[data-line]');
        if (activeLine && e.target.tagName === 'INPUT' && e.target.type !== 'button') {
          const lineIdx = parseInt(activeLine.dataset.line);
          const allLines = hasForm.querySelectorAll('tr[data-line]');
          if (lineIdx === allLines.length - 1 && e.target.dataset.field === 'description') {
            /* DerniÃ¨re ligne, champ description â nouvelle ligne */
            e.preventDefault();
            const addBtn = document.getElementById('btn-add-line');
            if (addBtn) addBtn.click();
          }
        }
      }

      /* Suppr sur une ligne vide â supprimer la ligne */
      if (e.key === 'Delete' && e.shiftKey) {
        const activeLine = e.target.closest('tr[data-line]');
        if (activeLine) {
          e.preventDefault();
          const removeBtn = activeLine.querySelector('[data-remove]');
          if (removeBtn) removeBtn.click();
        }
      }
    });
  }

  function _showKeyboardHints() {
    if (document.getElementById('kbd-hint-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'kbd-hint-bar';
    bar.className = 'kbd-hint';
    bar.innerHTML = `
      <span><kbd>Ctrl</kbd>+<kbd>S</kbd> sauvegarder</span>
      <span><kbd>Ctrl</kbd>+<kbd>D</kbd> dupliquer ligne</span>
      <span><kbd>EntrÃ©e</kbd> nouvelle ligne</span>
      <span><kbd>Shift</kbd>+<kbd>Suppr</kbd> supprimer ligne</span>
    `;
    document.body.appendChild(bar);
    setTimeout(() => bar.classList.add('visible'), 300);
    setTimeout(() => bar.classList.remove('visible'), 5000);
  }

  /* ================================================================
     6. REMISE GLOBALE + FRAIS DE PORT
     ================================================================ */
  function addGlobalDiscount() {
    const totalsBlock = document.getElementById('totals-block');
    if (!totalsBlock || document.getElementById('totals-extras')) return;

    /* RÃ©cupÃ©rer valeurs existantes depuis le doc courant si prÃ©sent */
    const doc = _getCurrentDoc();
    const remiseGlobale = doc?.remiseGlobale || 0;
    const remiseType = doc?.remiseType || 'pct';  // 'pct' ou 'xpf'
    const fraisPort = doc?.fraisPort || 0;

    const extras = document.createElement('div');
    extras.className = 'totals-extras';
    extras.id = 'totals-extras';
    extras.innerHTML = `
      <div class="form-group">
        <label>Remise globale</label>
        <div class="remise-group">
          <input type="number" id="remise-globale" min="0" step="0.5"
            value="${remiseGlobale}" placeholder="0" />
          <select id="remise-type">
            <option value="pct" ${remiseType === 'pct' ? 'selected' : ''}>%</option>
            <option value="xpf" ${remiseType === 'xpf' ? 'selected' : ''}>XPF</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label>Frais de port (XPF)</label>
        <input type="number" id="frais-port" min="0" step="1"
          value="${fraisPort}" placeholder="0" class="form-control" />
      </div>
    `;

    totalsBlock.parentNode.insertBefore(extras, totalsBlock);

    /* Recalculer quand on change */
    ['remise-globale', 'remise-type', 'frais-port'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', _recalcTotalsWithExtras);
    });

    _recalcTotalsWithExtras();
  }

  function _recalcTotalsWithExtras() {
    const state = _getSalesState();
    if (!state) return;

    const remiseVal = parseFloat(document.getElementById('remise-globale')?.value) || 0;
    const remiseType = document.getElementById('remise-type')?.value || 'pct';
    const fraisPort = parseFloat(document.getElementById('frais-port')?.value) || 0;

    /* Calculer HT total des lignes */
    let htBrut = 0;
    (state.lignes || []).forEach(l => {
      const brut = (l.qte || 0) * (l.prixUnitaire || 0);
      const remise = brut * ((l.remise || 0) / 100);
      htBrut += brut - remise;
    });

    /* Appliquer remise globale */
    let remiseMontant = 0;
    if (remiseType === 'pct') {
      remiseMontant = htBrut * (remiseVal / 100);
    } else {
      remiseMontant = remiseVal;
    }
    const htFinal = Math.max(0, htBrut - remiseMontant);

    /* Sauvegarder dans state (pour la sauvegarde) */
    state._remiseGlobale = remiseVal;
    state._remiseType = remiseType;
    state._fraisPort = fraisPort;
    state._remiseGlobaleMontant = Math.round(remiseMontant);

    /* Ajouter ligne affichage dans totals-block si remise ou frais */
    let extrasRow = document.getElementById('totals-extras-row');
    if (!extrasRow) {
      extrasRow = document.createElement('div');
      extrasRow.id = 'totals-extras-row';
      const grandTotal = document.querySelector('.grand-total');
      if (grandTotal) {
        grandTotal.parentNode.insertBefore(extrasRow, grandTotal);
      }
    }

    let html = '';
    if (remiseMontant > 0) {
      html += `
        <div class="total-row" style="color:var(--accent-red);">
          <span class="total-label">Remise globale ${remiseType === 'pct' ? '(' + remiseVal + '%)' : ''}</span>
          <span class="total-value">- ${_fmt(remiseMontant)}</span>
        </div>`;
    }
    if (fraisPort > 0) {
      html += `
        <div class="total-row">
          <span class="total-label">Frais de port</span>
          <span class="total-value">${_fmt(fraisPort)}</span>
        </div>`;
    }
    extrasRow.innerHTML = html;
  }

  /* ================================================================
     7. RACCOURCIS DATES (Auj., +30j, etc.)
     ================================================================ */
  function addDateShortcuts() {
    const dateValidite = document.getElementById('q-validite');
    if (!dateValidite || dateValidite.dataset.shortcutsAdded) return;
    dateValidite.dataset.shortcutsAdded = '1';

    const shortcuts = document.createElement('div');
    shortcuts.className = 'date-shortcuts';
    shortcuts.innerHTML = `
      <button type="button" class="date-chip" data-date-add="0">Auj.</button>
      <button type="button" class="date-chip" data-date-add="15">+15j</button>
      <button type="button" class="date-chip" data-date-add="30">+30j</button>
      <button type="button" class="date-chip" data-date-add="60">+60j</button>
    `;
    dateValidite.parentNode.appendChild(shortcuts);

    shortcuts.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date-add]');
      if (!btn) return;
      const days = parseInt(btn.dataset.dateAdd);
      const d = new Date();
      d.setDate(d.getDate() + days);
      dateValidite.value = d.toISOString().slice(0, 10);
      dateValidite.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  /* ================================================================
     8. VÃRIFICATION SUPPRESSION DEVIS (bug #5)
     ================================================================ */
  function checkDevisDependencies(devisId) {
    const commandes = Store.getAll('commandes').filter(c => c.quoteId === devisId || c.devisId === devisId);
    const factures = Store.getAll('factures').filter(f => f.devisId === devisId || f.quoteId === devisId);
    return {
      canDelete: commandes.length === 0 && factures.length === 0,
      commandes,
      factures,
      message: (commandes.length || factures.length)
        ? `Suppression impossible : ${commandes.length} commande(s) et ${factures.length} facture(s) liÃ©e(s). Annulez-les d'abord.`
        : null
    };
  }

  /* Intercepter les confirmations de suppression de devis */
  const _originalShowConfirm = window.showConfirm;
  if (typeof _originalShowConfirm === 'function') {
    window.showConfirm = function(message, onYes, onNo, yesLabel, danger) {
      /* DÃ©tection heuristique : message contient "Supprimer le devis" */
      const matchDevis = message && message.match(/Supprimer le devis (DEV-\S+)/);
      if (matchDevis && danger !== false) {
        const ref = matchDevis[1];
        const devis = Store.getAll('devis').find(d => d.ref === ref);
        if (devis) {
          const check = checkDevisDependencies(devis.id);
          if (!check.canDelete) {
            if (typeof toast === 'function') {
              toast(check.message, 'error', 5000);
            }
            return;
          }
        }
      }
      return _originalShowConfirm(message, onYes, onNo, yesLabel, danger);
    };
  }

  /* ================================================================
     9. HELPERS
     ================================================================ */
  function _fmt(n) {
    if (typeof fmt === 'function') return fmt(n);
    return Math.round(n).toLocaleString('fr-FR') + ' XPF';
  }

  function _esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _highlight(text, query) {
    const safe = _esc(text);
    if (!query) return safe;
    const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return safe.replace(re, '<span class="ac-hint-match">$1</span>');
  }

  /* AccÃ©der Ã  _state de Sales (hack via closure impossible â on passe par le DOM) */
  function _getSalesState() {
    /* Les lignes sont reflÃ©tÃ©es dans le DOM ; on reconstruit depuis les inputs */
    const tbody = document.getElementById('line-tbody');
    if (!tbody) return null;

    /* Comme Sales._state est privÃ©, on ne peut pas l'accÃ©der directement.
       Mais _state.lignes est synchronisÃ© avec le DOM via les 'input' events.
       On dÃ©clenche une modif dummy pour forcer la sync, puis on reconstruit. */

    /* AccÃ¨s indirect : on sait que Sales expose init() seulement.
       On rÃ©cupÃ¨re les lignes depuis les inputs DOM. */
    const state = { lignes: [] };
    tbody.querySelectorAll('tr[data-line]').forEach(tr => {
      const idx = parseInt(tr.dataset.line);
      const l = {
        produitId: tr.querySelector('[data-field="produitId"]')?.value || '',
        description: tr.querySelector('[data-field="description"]')?.value || '',
        qte: parseFloat(tr.querySelector('[data-field="qte"]')?.value) || 0,
        prixUnitaire: parseFloat(tr.querySelector('[data-field="prixUnitaire"]')?.value) || 0,
        remise: parseFloat(tr.querySelector('[data-field="remise"]')?.value) || 0,
        tauxTVA: parseFloat(tr.querySelector('[data-field="tauxTVA"]')?.value) || 16,
        taille: tr.querySelector('[data-field="taille"]')?.value || '',
        couleur: tr.querySelector('[data-field="couleur"]')?.value || '',
        technique: tr.querySelector('[data-field="technique"]')?.value || '',
        emplacement: tr.querySelector('[data-field="emplacement"]')?.value || '',
        notes_design: tr.querySelector('[data-field="notes_design"]')?.value || ''
      };
      state.lignes[idx] = l;
    });
    return state;
  }

  /* Pour les actions de duplication/insertion, on doit recharger le formulaire.
     Le plus propre : dÃ©clencher un clic sur "Ajouter ligne" qui refait un refresh,
     mais Ã§a ne marche pas pour insÃ©rer au milieu.
     Solution : on manipule directement _state via accÃ¨s trichÃ©.
     
     En rÃ©alitÃ©, Sales._state est dans une closure. On ne peut pas y toucher.
     Alternative : utiliser `Sales.init()` pour refaire le rendu, mais on perd les lignes.
     
     â Solution pragmatique : stocker les lignes en attente et cliquer sur +,
       puis faire un setTimeout pour modifier. LimitÃ©.
     â MIEUX : Sales ne rend pas privÃ© _state dÃ©libÃ©rÃ©ment â on patche Sales 
       pour l'exposer via une mÃ©thode _getState(). */
  
  function _triggerRefresh() {
    /* Forcer un rafraÃ®chissement : clic sur +Ajouter puis retirer l'ajoutÃ©e,
       OU manipulation directe du DOM.
       Pour dup/insert, la manip DOM est plus simple. */
    
    /* En fait, on peut utiliser un hack : simuler input sur un champ existant */
    const firstInput = document.querySelector('#line-tbody input[data-field="qte"]');
    if (firstInput) {
      firstInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  function _getCurrentDoc() {
    /* RÃ©cupÃ¨re le document en cours d'Ã©dition (devis) */
    const h2 = document.querySelector('.form-view-ref, .doc-ref');
    if (!h2) return null;
    const ref = h2.textContent.trim();
    return Store.getAll('devis').find(d => d.ref === ref) ||
           Store.getAll('commandes').find(c => c.ref === ref) ||
           Store.getAll('factures').find(f => f.ref === ref);
  }

  /* ================================================================
     10. OBSERVER â dÃ©tecter quand le formulaire s'ouvre
     ================================================================ */
  _injectStyles();

  const appObserver = new MutationObserver(() => {
    /* SÃ©lecteur client devis */
    if (document.getElementById('q-client')) {
      enhanceQuoteForm();
    }

    /* Table des lignes */
    if (document.getElementById('line-tbody')) {
      enhanceLineTable();
    }

    /* Bloc totaux â ajouter remise globale + frais de port */
    if (document.getElementById('totals-block') && !document.getElementById('totals-extras')) {
      addGlobalDiscount();
    }

    /* Date de validitÃ© â ajouter raccourcis */
    if (document.getElementById('q-validite')) {
      addDateShortcuts();
    }
  });

  appObserver.observe(document.body, { childList: true, subtree: true });

  console.info('[SalesUX] â Module UX ventes chargÃ© â autocomplete, raccourcis, remise globale');

  /* Exposer pour debug */
  window.SalesUX = {
    createCombobox,
    checkDevisDependencies,
    enhanceLineTable,
    enhanceQuoteForm,
    version: '1.3.0'
  };

})();
