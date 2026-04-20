/* ================================================================
   HCS ERP — js/modules/inventory.js
   Module Stock : produits, catégories, mouvements, rapport.
   Pattern IIFE — exposé via window.Inventory
   ================================================================ */

'use strict';

const Inventory = (() => {

  /* ----------------------------------------------------------------
     État interne du module
     ---------------------------------------------------------------- */
  const _state = {
    view:         'products',
    mode:         'list',    // 'list' | 'form'
    listMode:     'list',    // 'list' | 'kanban'
    currentId:    null,
    showArchived: false      // toggle liste produits archivés
  };

  /* Image produit en cours d'édition (base64 ou URL) */
  let _pendingImage = null;

  /* Variantes en cours d'édition — tableau d'objets
     { taille, couleur, coupe, ref, prix, cout, quantite } */
  let _currentVariantes = [];

  /* Paliers de prix en cours d'édition — tableau d'objets
     { qteMin, prix } — tarification dégressive */
  let _currentPaliers = [];

  /* Attributs personnalisés en cours d'édition — [{nom, valeurs:[]}] */
  let _currentCustomAttrs = [];

  /* Attribut qui varie le prix ('taille'|'couleur'|'coupe'|nom_custom) */
  let _attrPrix = '';

  /* Incréments de prix par valeur d'attribut — {valeur: increment} */
  let _attrIncrements = {};

  /* Type de produit en cours d'édition : 'simple' | 'variable' */
  let _currentProductKind = 'simple';

  /* ================================================================
     POINT D'ENTRÉE — init(toolbar, area, viewId)
     ================================================================ */
  function init(toolbar, area, viewId) {
    if (viewId !== _state.view) {
      _state.view      = viewId;
      _state.mode      = 'list';
      _state.currentId = null;
    }

    switch (_state.view) {
      case 'products':    _renderProducts(toolbar, area);    break;
      case 'categories':  _renderCategories(toolbar, area);  break;
      case 'stock-moves': _renderStockMoves(toolbar, area);  break;
      case 'stock-report':_renderStockReport(toolbar, area); break;
      default:            _renderProducts(toolbar, area);
    }
  }

  /* ================================================================
     VUE : PRODUITS
     ================================================================ */
  function _renderProducts(toolbar, area) {
    if (_state.mode === 'form') {
      _renderProductForm(toolbar, area);
    } else {
      _renderProductList(toolbar, area);
    }
  }

  /* ---- Liste produits ---- */
  function _renderProductList(toolbar, area) {
    const isKanban = _state.listMode === 'kanban';

    const showArch = _state.showArchived || false;
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-new-product">+ Nouveau produit</button>
      <button class="btn btn-ghost btn-sm" id="btn-import-products" title="Importer depuis CSV ou Excel" style="margin-left:8px;">📥 Importer</button>
      <button class="btn btn-ghost btn-sm" id="btn-export-products" title="Exporter vers CSV" style="margin-left:4px;">📤 Exporter CSV</button>
      <div style="display:flex;gap:4px;margin-left:8px;">
        <button class="btn ${!isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-view-list" title="Vue liste">☰ Liste</button>
        <button class="btn ${isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-view-kanban" title="Vue kanban">⊞ Kanban</button>
      </div>
      <div style="display:flex;gap:4px;margin-left:8px;">
        <button class="btn ${!showArch ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-show-active" title="Produits actifs">✅ Actifs</button>
        <button class="btn ${showArch ? 'btn-warning' : 'btn-ghost'} btn-sm" id="btn-show-archived" title="Produits archivés">🗄 Archivés</button>
      </div>`;

    toolbar.querySelector('#btn-new-product').addEventListener('click', () => {
      _state.mode          = 'form';
      _state.currentId     = null;
      _pendingImage        = null;
      _currentVariantes    = [];
      _currentCustomAttrs  = [];
      _attrPrix            = '';
      _attrIncrements      = {};
      _currentProductKind  = 'simple';
      _renderProductForm(toolbar, area);
    });
    toolbar.querySelector('#btn-view-list').addEventListener('click', () => {
      _state.listMode = 'list';
      _renderProductList(toolbar, area);
    });
    toolbar.querySelector('#btn-view-kanban').addEventListener('click', () => {
      _state.listMode = 'kanban';
      _renderProductList(toolbar, area);
    });
    toolbar.querySelector('#btn-show-active')?.addEventListener('click', () => {
      _state.showArchived = false;
      _renderProductList(toolbar, area);
    });
    toolbar.querySelector('#btn-show-archived')?.addEventListener('click', () => {
      _state.showArchived = true;
      _renderProductList(toolbar, area);
    });
    toolbar.querySelector('#btn-import-products')?.addEventListener('click', () => _openImportModal(toolbar, area));
    toolbar.querySelector('#btn-export-products')?.addEventListener('click', () => _exportProductsCSV());

    const showArch2 = _state.showArchived || false;
    const produits = Store.getAll('produits').filter(p =>
      showArch2 ? p.status === 'archived' : (p.status !== 'archived')
    );

    if (isKanban) {
      _renderProductKanban(produits, area);
      return;
    }

    area.innerHTML = '<div id="inv-products-table"></div>';
    renderTable('inv-products-table', {
      title: `Produits (${produits.length})`,
      data: produits,
      searchable: true,
      columns: [
        {
          key: 'nom', label: 'Produit', type: 'text', sortable: true,
          render: (_, row) => {
            /* Construire les tags variantes */
            const tags = [];
            if (row.coupe)   tags.push(_escI(row.coupe));
            if (row.tailles) tags.push('📏 ' + _escI(row.tailles));
            if (row.couleurs)tags.push('🎨 ' + _escI(row.couleurs));
            const tagsHtml = tags.map(t =>
              `<span style="font-size:10px;background:#F3F4F6;border-radius:4px;
                padding:1px 5px;color:#6B7280;white-space:nowrap;">${t}</span>`
            ).join('');
            return `
              <div style="display:flex;align-items:center;gap:10px;">
                ${row.image
              ? `<img src="${_escI(row.image)}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;" />`
              : `<span style="font-size:1.4rem;">${row.emoji || '📦'}</span>`}
                <div>
                  <div style="font-weight:600;color:var(--text-primary);">
                    ${_escI(row.nom)}
                    ${row.status === 'archived' ? '<span style="font-size:10px;background:#FEF3C7;color:#92400E;border-radius:4px;padding:1px 5px;margin-left:6px;">Archivé</span>' : ''}
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);">
                    ${row.designation ? _escI(row.designation) + ' · ' : ''}${row.ref ? 'Réf: ' + _escI(row.ref) + ' · ' : ''}${_escI(row.sku || '')}
                  </div>
                  ${tags.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px;">${tagsHtml}</div>` : ''}
                  ${row.variantes && row.variantes.length > 0
                    ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">
                        ${row.variantes.length} variante${row.variantes.length > 1 ? 's' : ''}</div>` : ''}
                </div>
              </div>`;
          }
        },
        {
          key: 'categorie', label: 'Catégorie', type: 'text', sortable: true,
          render: (_, r) => {
            const tvaVal = r.tva ? `${r.tva}%` : '';
            const typeLabel = { marchandise: '🛍', service: '🔧', consommable: '🧴', matiere: '🪢' }[r.type] || '';
            return `<div>
              <div>${_escI(r.categorie || '—')}</div>
              ${typeLabel || tvaVal ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px;">
                ${typeLabel} ${_escI(r.type || '')}${tvaVal ? ' · TVA ' + tvaVal : ''}
              </div>` : ''}
            </div>`;
          }
        },
        {
          key: 'prix', label: 'Prix vente', type: 'money', sortable: true,
          render: (_, r) => {
            const ht  = r.prix    || 0;
            const ttc = r.prixTTC || 0;
            return `<div style="font-family:var(--font-mono);">
              <div style="font-weight:600;">${fmt(ht)} HT</div>
              ${ttc ? `<div style="font-size:11px;color:var(--text-muted);">${fmt(ttc)} TTC</div>` : ''}
            </div>`;
          }
        },
        { key: 'cout', label: 'Revient HT', type: 'money', render: (_, r) => `<span style="font-family:var(--font-mono);">${fmt(r.cout || 0)}</span>` },
        {
          key: 'stock', label: 'Stock', type: 'text', sortable: true,
          render: (_, row) => {
            const mag  = row.stockMagasin     || 0;
            const four = row.stockFournisseur || 0;
            const s    = row.stock || (mag + four) || 0;
            const sMin = row.stockMin || 0;
            const color = s === 0 ? 'var(--accent-red)'
              : s <= sMin ? 'var(--accent-orange)'
              : 'var(--accent-green)';
            return `<div>
              <span style="font-family:var(--font-mono);font-weight:700;color:${color};">${s} ${_escI(row.unite || 'u')}</span>
              ${mag || four ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px;">
                🏪 ${mag} · 📦 ${four}
              </div>` : ''}
            </div>`;
          }
        },
        {
          key: 'marge', label: 'Marge %', type: 'text',
          render: (_, row) => {
            if (!row || !row.prix || !row.cout) return '—';
            const pct = Math.round(((row.prix - row.cout) / row.prix) * 100);
            const color = pct >= 30 ? 'var(--accent-green)' : pct >= 15 ? 'var(--accent-orange)' : 'var(--accent-red)';
            return `<span style="font-family:var(--font-mono);color:${color};">${pct}%</span>`;
          }
        },
        {
          key: '_actions', label: '', type: 'actions',
          actions: [
            { label: '✏️ Modifier',  className: 'btn-ghost', onClick: (row) => _openProduct(row) },
            { label: '📊 Ajuster',   className: 'btn-ghost', onClick: (row) => _openAjustementModal(row) },
            { label: _state.showArchived ? '♻ Réactiver' : '🗄 Archiver', className: 'btn-ghost', onClick: (row) => _toggleArchiveProduct(row) },
            { label: '🗑 Supprimer', className: 'btn-ghost danger', onClick: (row) => _deleteProduct(row) }
          ]
        }
      ],
      emptyMsg: 'Aucun produit.',
      onRowClick: (row) => _openProduct(row)
    });
  }

  /* ---- Kanban produits — colonnes côte à côte ---- */
  function _renderProductKanban(produits, area) {
    /* Grouper par catégorie */
    const cats = {};
    produits.forEach(p => {
      const cat = p.categorie || '(Non classé)';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(p);
    });

    if (produits.length === 0) {
      area.innerHTML = `<div class="table-empty"><div class="empty-icon">📦</div><p>Aucun produit.</p></div>`;
      return;
    }

    /* Chaque catégorie = une colonne fixe de 210px, défilement horizontal */
    const colonnes = Object.entries(cats)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cat, items]) => {
        const cards = items.map(p => _renderProductCard(p)).join('');
        const totalStock = items.reduce((s, p) => s + (p.stock || 0), 0);
        return `
          <div style="
            flex:0 0 210px;
            background:var(--bg-elevated);
            border:1px solid var(--border);
            border-radius:12px;
            display:flex;
            flex-direction:column;
            max-height:calc(100vh - 180px);
            overflow:hidden;">

            <!-- En-tête colonne -->
            <div style="
              padding:12px 14px;
              border-bottom:1px solid var(--border);
              background:var(--bg-surface);
              border-radius:12px 12px 0 0;
              flex-shrink:0;">
              <div style="font-size:12px;font-weight:700;color:var(--text-primary);
                text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;
                overflow:hidden;text-overflow:ellipsis;" title="${_escI(cat)}">
                ${_escI(cat)}
              </div>
              <div style="display:flex;gap:8px;margin-top:4px;font-size:11px;color:var(--text-muted);">
                <span>${items.length} article${items.length > 1 ? 's' : ''}</span>
                <span>·</span>
                <span>Stock : ${totalStock}</span>
              </div>
            </div>

            <!-- Cartes défilables -->
            <div style="
              padding:10px;
              display:flex;
              flex-direction:column;
              gap:8px;
              overflow-y:auto;
              flex:1;">
              ${cards}
            </div>
          </div>`;
      }).join('');

    area.innerHTML = `
      <div style="
        display:flex;
        gap:14px;
        padding:8px 4px 16px;
        overflow-x:auto;
        align-items:flex-start;
        min-height:300px;">
        ${colonnes}
      </div>`;

    area.querySelectorAll('[data-prod-id]').forEach(card => {
      card.addEventListener('click', () => {
        const produit = Store.getById('produits', card.dataset.prodId);
        if (produit) _openProduct(produit);
      });
    });
  }

  /* Carte produit pour le kanban colonnes */
  function _renderProductCard(p) {
    const s      = p.stock    || 0;
    const sMin   = p.stockMin || 0;
    const sColor = s === 0 ? '#ef4444' : s <= sMin ? '#f97316' : '#22c55e';

    const imgHtml = p.image
      ? `<img src="${p.image}"
           style="width:36px;height:36px;border-radius:8px;object-fit:cover;flex-shrink:0;" />`
      : `<div style="width:36px;height:36px;border-radius:8px;flex-shrink:0;
           display:flex;align-items:center;justify-content:center;
           font-size:1.5rem;background:var(--bg-elevated);">${p.emoji || '📦'}</div>`;

    const prixFmt = typeof fmt === 'function' ? fmt(p.prix || 0) : (p.prix || 0) + ' XPF';

    return `
      <div data-prod-id="${p.id}" style="
          background:var(--bg-surface);
          border:1px solid var(--border);
          border-radius:10px;
          cursor:pointer;
          padding:10px;
          display:flex;
          gap:10px;
          align-items:flex-start;
          transition:box-shadow 0.15s,transform 0.12s;"
        onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.28)';this.style.transform='translateY(-1px)'"
        onmouseleave="this.style.boxShadow='none';this.style.transform='none'">

        ${imgHtml}

        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:12px;color:var(--text-primary);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
            title="${_escI(p.nom)}">${_escI(p.nom)}</div>

          ${p.designation
            ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px;
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${_escI(p.designation)}</div>`
            : p.ref
            ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px;">Réf: ${_escI(p.ref)}</div>`
            : ''}

          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;gap:4px;">
            <span style="font-family:var(--font-mono);font-size:10px;font-weight:700;
              color:${sColor};background:${sColor}18;border-radius:4px;padding:2px 5px;white-space:nowrap;">
              ${s} ${_escI(p.unite || 'u')}
            </span>
            <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);white-space:nowrap;">
              ${prixFmt}
            </span>
          </div>

          ${p.variantes && p.variantes.length > 0
            ? `<div style="font-size:9px;color:var(--accent-blue);margin-top:3px;">
                ${p.variantes.length} variante${p.variantes.length > 1 ? 's' : ''}
              </div>` : ''}
        </div>
      </div>`;
  }

  /* Ouvrir produit en mode formulaire */
  function _openProduct(produit) {
    _state.mode      = 'form';
    _state.currentId = produit ? produit.id : null;
    /* Réinitialiser l'état des sections avancées */
    _currentCustomAttrs = [];
    _attrPrix           = '';
    _attrIncrements     = {};
    _pendingImage       = null;
    _renderProductForm(
      document.getElementById('toolbar-actions'),
      document.getElementById('view-content')
    );
  }

  /* ---- Formulaire produit ---- */
  function _renderProductForm(toolbar, area) {
    const isNew   = !_state.currentId;
    const produit = isNew ? {} : (Store.getById('produits', _state.currentId) || {});

    /* Réinitialiser l'image en attente uniquement si on ouvre un nouveau formulaire */
    if (_pendingImage === null && produit.image) {
      _pendingImage = produit.image;
    }

    /* Initialiser les variantes depuis le produit existant */
    _currentVariantes = (produit.variantes || []).map(v => ({ ...v }));

    /* Toolbar */
    const isArchived = produit.status === 'archived';
    toolbar.innerHTML = `
      <button class="btn btn-ghost" id="btn-prod-back">← Retour</button>
      <button class="btn btn-primary" id="btn-save-prod">💾 Enregistrer</button>
      ${!isNew ? `
        <button class="btn ${isArchived ? 'btn-success' : 'btn-warning'} btn-sm" id="btn-archive-prod">
          ${isArchived ? '♻ Réactiver' : '🗄 Archiver'}
        </button>
        <button class="btn btn-danger btn-sm" id="btn-delete-prod">🗑 Supprimer</button>
      ` : ''}`;

    toolbar.querySelector('#btn-prod-back').addEventListener('click', () => {
      _state.mode         = 'list';
      _pendingImage       = null;
      _currentVariantes   = [];
      _currentProductKind = 'simple';
      _renderProductList(toolbar, area);
    });
    toolbar.querySelector('#btn-save-prod').addEventListener('click', () => _saveProduct(produit));

    if (!isNew) {
      toolbar.querySelector('#btn-archive-prod')?.addEventListener('click', () => {
        const prod = Store.getById('produits', _state.currentId);
        if (!prod) return;
        const newStatus = prod.status === 'archived' ? 'active' : 'archived';
        Store.update('produits', _state.currentId, { status: newStatus });
        const msg = newStatus === 'archived' ? '🗄 Produit archivé.' : '♻ Produit réactivé.';
        if (typeof toastSuccess === 'function') toastSuccess(msg);
        _state.mode = 'list';
        _renderProductList(toolbar, area);
      });
      toolbar.querySelector('#btn-delete-prod')?.addEventListener('click', () => {
        const prod = Store.getById('produits', _state.currentId);
        if (!prod) return;
        _deleteProduct(prod);
      });
    }

    /* Catégories disponibles */
    const cats = _getCategories();
    const catOptions = cats.map(c => ({ value: c, label: c }));

    /* Fournisseurs disponibles */
    const fournisseurs  = Store.getAll('fournisseurs');
    const fournOptions  = fournisseurs.map(f => ({ value: f.nom || f.id, label: f.nom || f.id }));

    /* ---------------------------------------------------------------
       CHAMPS DU FORMULAIRE
       Organisés en 2 colonnes
       --------------------------------------------------------------- */
    const fields = [
      /* Identification */
      { name: 'emoji',       label: 'Emoji',              type: 'text',     cols: 1 },
      { name: 'nom',         label: 'Nom *',               type: 'text',     required: true, cols: 2 },
      { name: 'designation', label: 'Désignation courte', type: 'text',     cols: 2 },
      { name: 'ref',         label: 'Référence article',  type: 'text',     cols: 1 },
      { name: 'sku',         label: 'SKU interne',        type: 'text',     cols: 1 },

      /* Type & TVA */
      {
        name: 'type', label: 'Type d\'article', type: 'select', cols: 1,
        options: [
          { value: 'marchandise', label: '🛍 Marchandise' },
          { value: 'service',     label: '🔧 Service / Prestation' },
          { value: 'consommable', label: '🧴 Consommable' },
          { value: 'matiere',     label: '🪢 Matière première' }
        ]
      },
      {
        name: 'tva', label: 'TVA (Polynésie française)', type: 'select', cols: 1,
        options: [
          { value: '16', label: '16% — Marchandise' },
          { value: '13', label: '13% — Services / Prestations' },
          { value: '0',  label: '0% — Exonéré / Export' }
        ]
      },

      /* Classification */
      {
        name: 'categorie', label: 'Catégorie', type: 'select', cols: 1,
        options: [{ value: '', label: '— Sélectionner —' }, ...catOptions]
      },
      {
        name: 'fournisseur', label: 'Fournisseur', type: 'select', cols: 1,
        options: [{ value: '', label: '— Aucun —' }, ...fournOptions]
      },

      /* Tarif */
      { name: 'unite', label: 'Unité',              type: 'text',  cols: 1 },
      { name: 'prix',    label: 'Prix de vente HT',  type: 'money', cols: 1 },
      { name: 'prixTTC', label: 'Prix de vente TTC', type: 'money', cols: 1 },
      { name: 'cout',    label: 'Prix de revient HT', type: 'money', cols: 1 },

      /* Stock par entrepôt */
      { name: 'stockMagasin',     label: 'Stock — Entrepôt magasin',     type: 'number', cols: 1 },
      { name: 'stockFournisseur', label: 'Stock — Entrepôt fournisseur', type: 'number', cols: 1 },
      { name: 'stockMin',         label: 'Stock minimum alerte',         type: 'number', cols: 1 },
      {
        name: 'status', label: 'Statut', type: 'select', cols: 1,
        options: [
          { value: 'active',   label: '✅ Actif' },
          { value: 'archived', label: '🗄 Archivé' }
        ]
      },

      /* Comptabilité / Journaux */
      { name: 'compteVente', label: 'Compte ventes (ex : 700100)',       type: 'text', cols: 1 },
      { name: 'compteTVA',   label: 'Compte TVA collectée (ex : 445700)', type: 'text', cols: 1 },
      { name: 'compteStock', label: 'Compte stock (ex : 310100)',         type: 'text', cols: 1 },

      { name: 'description', label: 'Description',  type: 'textarea', cols: 2 }
    ];

    const currentImg = _pendingImage || produit.image || '';

    area.innerHTML = `
      <div style="max-width:760px;margin:0 auto;padding:24px 0;">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:24px;">
          ${isNew ? 'Nouveau produit' : _escI(produit.nom || 'Produit')}
        </div>

        <!-- Section image -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;
          padding:16px;margin-bottom:20px;display:flex;align-items:center;gap:16px;">
          <div id="img-preview-wrap" style="flex-shrink:0;width:88px;height:88px;border-radius:10px;
            overflow:hidden;background:var(--bg-elevated);display:flex;align-items:center;
            justify-content:center;font-size:2.6rem;border:1px solid var(--border);">
            ${currentImg
              ? `<img id="img-preview" src="${_escI(currentImg)}" style="width:100%;height:100%;object-fit:cover;" />`
              : `<span id="img-emoji-preview">${produit.emoji || '📦'}</span>`}
          </div>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;">
              Image du produit
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <label class="btn btn-ghost btn-sm" style="cursor:pointer;">
                📷 Choisir un fichier
                <input type="file" id="prod-img-file" accept="image/*" style="display:none;" />
              </label>
              <button class="btn btn-ghost btn-sm" id="btn-prod-img-url">🔗 URL</button>
              ${currentImg ? `<button class="btn btn-ghost btn-sm" id="btn-prod-img-clear"
                style="color:var(--accent-red);">✕ Supprimer</button>` : ''}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px;">
              JPG, PNG, WebP — max 2 Mo. L'image est stockée localement.
            </div>
          </div>
        </div>

        <!-- Toggle Produit simple / Avec variations -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;
          padding:14px 18px;margin-bottom:20px;display:flex;align-items:center;gap:12px;">
          <span style="font-size:13px;font-weight:600;color:var(--text-secondary);white-space:nowrap;">
            Type de produit :
          </span>
          <div style="display:flex;gap:0;border-radius:8px;overflow:hidden;
            border:1px solid var(--border);flex-shrink:0;">
            <button id="btn-type-simple" data-prodtype="simple"
              class="btn btn-sm"
              style="border-radius:0;border:none;padding:7px 18px;font-size:13px;
                font-weight:600;transition:background .15s;
                background:${(produit.productKind||'simple')==='simple' ? 'var(--accent-blue)' : 'var(--bg-elevated)'};
                color:${(produit.productKind||'simple')==='simple' ? '#fff' : 'var(--text-secondary)'};">
              📦 Produit simple
            </button>
            <button id="btn-type-variable" data-prodtype="variable"
              class="btn btn-sm"
              style="border-radius:0;border:none;border-left:1px solid var(--border);
                padding:7px 18px;font-size:13px;font-weight:600;transition:background .15s;
                background:${(produit.productKind||'simple')==='variable' ? 'var(--accent-blue)' : 'var(--bg-elevated)'};
                color:${(produit.productKind||'simple')==='variable' ? '#fff' : 'var(--text-secondary)'};">
              ⚡ Produit avec variations
            </button>
          </div>
          <span style="font-size:12px;color:var(--text-muted);" id="prodtype-hint">
            ${(produit.productKind||'simple')==='simple'
              ? 'Prix unique, pas de variantes.'
              : 'Prix variable selon les attributs (taille, format…)'}
          </span>
        </div>

        <div id="product-form-container"></div>

        <!-- Sections variantes — masquées pour produit simple -->
        <div id="variations-sections"
          style="display:${(produit.productKind||'simple')==='variable' ? 'block' : 'none'};">
          <!-- Bloc unifié : attributs + tarification + génération + tableau variantes -->
          <div id="variantes-section" style="margin-top:8px;"></div>
        </div>

        <!-- Section paliers de prix (tarification dégressive) -->
        <div id="paliers-section" style="margin-top:8px;"></div>

        <!-- Section positions atelier -->
        <div id="positions-atelier-section" style="margin-top:8px;"></div>
      </div>`;

    /* Gestion upload image */
    const fileInput = document.getElementById('prod-img-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          if (typeof toast === 'function') toast('Image trop volumineuse (max 2 Mo).', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          _pendingImage = ev.target.result;
          const wrap = document.getElementById('img-preview-wrap');
          if (wrap) wrap.innerHTML = `<img id="img-preview" src="${_pendingImage}"
            style="width:100%;height:100%;object-fit:cover;" />`;
        };
        reader.readAsDataURL(file);
      });
    }

    document.getElementById('btn-prod-img-url')?.addEventListener('click', () => {
      const url = prompt('Entrez l\'URL de l\'image :');
      if (!url) return;
      _pendingImage = url;
      const wrap = document.getElementById('img-preview-wrap');
      if (wrap) wrap.innerHTML = `<img id="img-preview" src="${_escI(url)}"
        style="width:100%;height:100%;object-fit:cover;" />`;
    });

    document.getElementById('btn-prod-img-clear')?.addEventListener('click', () => {
      _pendingImage = '';
      const wrap = document.getElementById('img-preview-wrap');
      if (wrap) wrap.innerHTML = `<span id="img-emoji-preview">${produit.emoji || '📦'}</span>`;
    });

    renderForm('product-form-container', {
      id:     'product-form',
      fields,
      data:   produit,
      cols:   2
    });

    /* Rendre le bloc variantes unifié (inclut attributs + tarification + générateur + tableau) */
    _renderVariantesSection(produit);

    /* Rendre la section paliers de prix */
    _renderPaliersSection(produit);

    /* Rendre la section positions atelier */
    _renderPositionsAtelierSection(produit);

    /* ---- Toggle Produit simple / Avec variations ---- */
    (function _bindProductTypeToggle() {
      _currentProductKind = produit.productKind || 'simple';

      function applyKind(kind) {
        _currentProductKind = kind;
        const varSec  = document.getElementById('variations-sections');
        const btnSimp = document.getElementById('btn-type-simple');
        const btnVar  = document.getElementById('btn-type-variable');
        const hint    = document.getElementById('prodtype-hint');
        if (varSec)  varSec.style.display  = kind === 'variable' ? 'block' : 'none';
        if (btnSimp) {
          btnSimp.style.background = kind === 'simple' ? 'var(--accent-blue)' : 'var(--bg-elevated)';
          btnSimp.style.color      = kind === 'simple' ? '#fff' : 'var(--text-secondary)';
        }
        if (btnVar) {
          btnVar.style.background  = kind === 'variable' ? 'var(--accent-blue)' : 'var(--bg-elevated)';
          btnVar.style.color       = kind === 'variable' ? '#fff' : 'var(--text-secondary)';
        }
        if (hint) hint.textContent = kind === 'simple'
          ? 'Prix unique, pas de variantes.'
          : 'Prix variable selon les attributs (taille, format…)';
      }

      applyKind(_currentProductKind);

      document.getElementById('btn-type-simple')?.addEventListener('click',   () => applyKind('simple'));
      document.getElementById('btn-type-variable')?.addEventListener('click',  () => applyKind('variable'));
    })();

    /* Auto-sélection TVA selon le type d'article */
    (function _bindAutoTVA() {
      const typeSelect = document.querySelector('[name="type"]');
      const tvaSelect  = document.querySelector('[name="tva"]');
      if (!typeSelect || !tvaSelect) return;
      typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'service') {
          tvaSelect.value = '13';
        } else if (['marchandise', 'consommable', 'matiere'].includes(typeSelect.value)) {
          tvaSelect.value = '16';
        }
        tvaSelect.dispatchEvent(new Event('change', { bubbles: true }));
      });
    })();

    /* ----------------------------------------------------------------
       Synchronisation bidirectionnelle : Prix HT ↔ Prix TTC
       - Modifier HT  → recalcule TTC  (TTC = HT × (1 + TVA%))
       - Modifier TTC → recalcule HT   (HT  = TTC / (1 + TVA%))
       - Changer TVA  → recalcule TTC depuis HT
       ---------------------------------------------------------------- */
    (function _bindPrixSync() {
      const inpHT  = document.querySelector('[name="prix"]');
      const inpTTC = document.querySelector('[name="prixTTC"]');
      const selTVA = document.querySelector('[name="tva"]');
      if (!inpHT || !inpTTC || !selTVA) return;

      /* Initialiser TTC si le produit a un prix HT mais pas de prixTTC stocké */
      if (!inpTTC.value && inpHT.value) {
        const tva = parseFloat(selTVA.value) || 16;
        inpTTC.value = Math.round(parseFloat(inpHT.value) * (1 + tva / 100)) || '';
      }

      let _lock = false;

      /* HT modifié → calcule TTC */
      inpHT.addEventListener('input', () => {
        if (_lock) return;
        _lock = true;
        const ht  = parseFloat(inpHT.value) || 0;
        const tva = parseFloat(selTVA.value) || 16;
        inpTTC.value = ht > 0 ? Math.round(ht * (1 + tva / 100)) : '';
        _lock = false;
      });

      /* TTC modifié → calcule HT, puis met à jour le panneau marge */
      inpTTC.addEventListener('input', () => {
        if (_lock) return;
        _lock = true;
        const ttc = parseFloat(inpTTC.value) || 0;
        const tva = parseFloat(selTVA.value) || 16;
        inpHT.value = ttc > 0 ? Math.round(ttc / (1 + tva / 100)) : '';
        /* Déclencher mise à jour du panneau marge */
        inpHT.dispatchEvent(new Event('input', { bubbles: true }));
        _lock = false;
      });

      /* TVA changée → recalcule TTC depuis HT courant */
      selTVA.addEventListener('change', () => {
        if (_lock) return;
        _lock = true;
        const ht  = parseFloat(inpHT.value) || 0;
        const tva = parseFloat(selTVA.value) || 16;
        if (ht > 0) inpTTC.value = Math.round(ht * (1 + tva / 100));
        _lock = false;
      });
    })();

    /* Injecter le panneau de marge après rendu */
    (function _injectMarginPanel() {
      const prix = produit.prix || 0;
      const cout = produit.cout || 0;
      const marge = prix - cout;
      const margePct = prix > 0 ? Math.round((marge / prix) * 100) : 0;
      const prixConseille = cout > 0 ? Math.ceil(cout / 0.60 / 10) * 10 : 0;
      const margeColor = margePct >= 40 ? '#16A34A' : margePct >= 20 ? '#D97706' : '#DC2626';

      const panel = document.createElement('div');
      panel.id = 'margin-panel';
      const tvaPct   = parseFloat(produit.tva) || 16;
      const prixTTC  = prix > 0 ? Math.round(prix * (1 + tvaPct / 100)) : 0;

      panel.style.cssText = `
        background:var(--bg-surface);border:1px solid var(--border);
        border-radius:10px;padding:16px 20px;margin-bottom:16px;
        display:grid;grid-template-columns:repeat(5,1fr);gap:12px;
      `;
      panel.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Prix vente HT</div>
          <div style="font-size:17px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);" id="mp-prix">${prix > 0 ? prix.toLocaleString('fr-FR') + ' XPF' : '—'}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Prix TTC</div>
          <div style="font-size:17px;font-weight:700;font-family:var(--font-mono);color:var(--accent-blue);" id="mp-ttc">${prixTTC > 0 ? prixTTC.toLocaleString('fr-FR') + ' XPF' : '—'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;" id="mp-tva-lbl">TVA ${tvaPct}%</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Prix de revient</div>
          <div style="font-size:17px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);" id="mp-cout">${cout > 0 ? cout.toLocaleString('fr-FR') + ' XPF' : '—'}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Marge brute</div>
          <div style="font-size:17px;font-weight:700;font-family:var(--font-mono);color:${margeColor};" id="mp-marge">${prix > 0 && cout > 0 ? margePct + '%' : '—'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;" id="mp-marge-val">${prix > 0 && cout > 0 ? marge.toLocaleString('fr-FR') + ' XPF' : ''}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Prix conseillé (40%)</div>
          <div style="font-size:17px;font-weight:700;font-family:var(--font-mono);color:var(--accent-green);" id="mp-conseille">${prixConseille > 0 ? prixConseille.toLocaleString('fr-FR') + ' XPF' : '—'}</div>
        </div>
      `;

      /* Insérer avant le premier form-section */
      const firstSection = area.querySelector('.form-section');
      const formContainer = document.getElementById('product-form-container');
      if (firstSection) {
        firstSection.parentNode.insertBefore(panel, firstSection);
      } else if (formContainer) {
        formContainer.parentNode.insertBefore(panel, formContainer);
      }

      /* Live update quand prix, cout ou TVA change */
      function _updateMarginPanel() {
        const p    = parseFloat(document.querySelector('[name="prix"]')?.value) || 0;
        const c    = parseFloat(document.querySelector('[name="cout"]')?.value) || 0;
        const tva  = parseFloat(document.querySelector('[name="tva"]')?.value) || 16;
        const ttc  = p > 0 ? Math.round(p * (1 + tva / 100)) : 0;
        const m    = p - c;
        const mpct = p > 0 ? Math.round((m / p) * 100) : 0;
        const mc   = p > 0 ? (mpct >= 40 ? '#16A34A' : mpct >= 20 ? '#D97706' : '#DC2626') : '#9CA3AF';
        const cons = c > 0 ? Math.ceil(c / 0.60 / 10) * 10 : 0;
        const mp   = document.getElementById('mp-prix');
        const mttc = document.getElementById('mp-ttc');
        const mtl  = document.getElementById('mp-tva-lbl');
        const mpc  = document.getElementById('mp-cout');
        const mpm  = document.getElementById('mp-marge');
        const mpmv = document.getElementById('mp-marge-val');
        const mps  = document.getElementById('mp-conseille');
        if (mp)   mp.textContent   = p > 0 ? p.toLocaleString('fr-FR') + ' XPF' : '—';
        if (mttc) mttc.textContent = ttc > 0 ? ttc.toLocaleString('fr-FR') + ' XPF' : '—';
        if (mtl)  mtl.textContent  = 'TVA ' + tva + '%';
        if (mpc)  mpc.textContent  = c > 0 ? c.toLocaleString('fr-FR') + ' XPF' : '—';
        if (mpm)  { mpm.textContent = p > 0 && c > 0 ? mpct + '%' : '—'; mpm.style.color = mc; }
        if (mpmv) mpmv.textContent = p > 0 && c > 0 ? m.toLocaleString('fr-FR') + ' XPF' : '';
        if (mps)  mps.textContent  = cons > 0 ? cons.toLocaleString('fr-FR') + ' XPF' : '—';
      }

      document.querySelector('[name="prix"]')?.addEventListener('input', _updateMarginPanel);
      document.querySelector('[name="cout"]')?.addEventListener('input', _updateMarginPanel);
      document.querySelector('[name="tva"]')?.addEventListener('change', _updateMarginPanel);
    })();

    /* Injecter l'historique produit si édition */
    if (!isNew && _state.currentId) {
      (function _injectProductHistory() {
        const db = Store.getDB();
        const pid = _state.currentId;
        const prodNom = (produit.nom || '').toLowerCase();

        /* Commandes liées */
        const commandes = (db.commandes || []).filter(c =>
          c.commandeId === pid ||
          (c.lignes || []).some(l => l.produitId === pid || (l.description || '').toLowerCase() === prodNom)
        ).slice(0, 5);

        /* Factures liées */
        const factures = (db.factures || []).filter(f =>
          (f.lignes || []).some(l => l.produitId === pid || (l.description || '').toLowerCase() === prodNom)
        ).slice(0, 5);

        /* Mouvements */
        const mouvements = (db.mouvements || []).filter(m => m.produitId === pid)
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
          .slice(0, 5);

        if (!commandes.length && !factures.length && !mouvements.length) return;

        const histHTML = `
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:16px 20px;margin-top:8px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;">
              📜 Historique du produit
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
              <div>
                <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Commandes</div>
                ${commandes.length
                  ? commandes.map(c => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border-light);color:var(--text-primary);">
                    <span class="col-ref">${_escI(c.ref || c.id)}</span>
                    <span style="color:var(--text-muted);margin-left:6px;">${_escI(c.client || '')}</span>
                  </div>`).join('')
                  : '<div style="font-size:12px;color:var(--text-muted);">Aucune commande</div>'}
              </div>
              <div>
                <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Factures</div>
                ${factures.length
                  ? factures.map(f => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border-light);color:var(--text-primary);">
                    <span class="col-ref">${_escI(f.ref || f.id)}</span>
                    <span style="color:var(--text-muted);margin-left:6px;">${_escI(f.client || '')}</span>
                  </div>`).join('')
                  : '<div style="font-size:12px;color:var(--text-muted);">Aucune facture</div>'}
              </div>
              <div>
                <div style="font-size:11px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Mouvements stock</div>
                ${mouvements.length
                  ? mouvements.map(m => `<div style="font-size:12px;padding:4px 0;border-bottom:1px solid var(--border-light);">
                    <span style="color:${m.type === 'Entrée' ? '#16A34A' : '#DC2626'};">${m.type === 'Entrée' ? '+' : '-'}${m.quantite || 0}</span>
                    <span style="color:var(--text-muted);margin-left:6px;">${_escI(m.motif || m.type || '')}</span>
                    <span style="color:var(--text-muted);margin-left:4px;font-size:10px;">${m.date || ''}</span>
                  </div>`).join('')
                  : '<div style="font-size:12px;color:var(--text-muted);">Aucun mouvement</div>'}
              </div>
            </div>
          </div>`;

        /* Ajouter à la fin de la zone de contenu */
        const formWrap2 = area.firstElementChild;
        if (formWrap2) formWrap2.insertAdjacentHTML('beforeend', histHTML);
      })();
    }
  }

  /* ── Positions atelier disponibles ── */
  const _POSITIONS_STD = [
    '📍 Poitrine gauche', '📍 Poitrine centre', '📍 Poitrine droite',
    '📍 Dos haut', '📍 Dos complet',
    '📍 Manche gauche', '📍 Manche droite',
    '📍 Capuche', '📍 Col', '📍 Bas de vêtement'
  ];

  function _renderPositionsAtelierSection(produit) {
    const el = document.getElementById('positions-atelier-section');
    if (!el) return;
    const saved = produit.positionsAtelier || [];
    const customs = saved.filter(p => !_POSITIONS_STD.includes(p));

    el.innerHTML = `
      <div class="form-section">
        <div class="form-section-title">📍 Positions atelier disponibles</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
          Cochez les positions proposées — elles seront sélectionnables dans le devis.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;" id="positions-grid">
          ${_POSITIONS_STD.map(pos => `
            <label style="display:flex;align-items:center;gap:6px;background:var(--bg-surface);
              border:1px solid ${saved.includes(pos) ? 'var(--accent-blue)' : 'var(--border)'};
              border-radius:8px;padding:6px 12px;cursor:pointer;font-size:12px;
              color:${saved.includes(pos) ? 'var(--accent-blue)' : 'var(--text-secondary)'};
              transition:border .15s,color .15s;">
              <input type="checkbox" class="pos-check" data-pos="${pos}"
                ${saved.includes(pos) ? 'checked' : ''} style="width:14px;height:14px;accent-color:var(--accent-blue);">
              ${pos}
            </label>`).join('')}
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <input type="text" id="pos-custom-input" placeholder="Position personnalisée… ex: 📍 Épaule gauche"
            class="form-control" style="max-width:300px;height:34px;font-size:12px;" />
          <button class="btn btn-ghost btn-sm" id="btn-pos-add">+ Ajouter</button>
        </div>
        <div id="pos-custom-list" style="display:flex;flex-wrap:wrap;gap:6px;">
          ${customs.map(p => `
            <span class="chip" data-custom-pos="${p}"
              style="display:flex;align-items:center;gap:4px;font-size:12px;">
              ${p}
              <span data-remove-pos="${p}" style="color:var(--accent-red);font-weight:700;cursor:pointer;margin-left:2px;">×</span>
            </span>`).join('')}
        </div>
      </div>`;

    /* Couleur dynamique des cases */
    el.querySelectorAll('.pos-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const lbl = cb.closest('label');
        if (!lbl) return;
        lbl.style.borderColor = cb.checked ? 'var(--accent-blue)' : 'var(--border)';
        lbl.style.color       = cb.checked ? 'var(--accent-blue)' : 'var(--text-secondary)';
      });
    });

    /* Ajouter position custom */
    document.getElementById('btn-pos-add')?.addEventListener('click', () => {
      const input = document.getElementById('pos-custom-input');
      const val = (input?.value || '').trim();
      if (!val) return;
      if (document.querySelector(`[data-custom-pos="${CSS.escape(val)}"]`)) return;
      const list = document.getElementById('pos-custom-list');
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.customPos = val;
      chip.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;';
      chip.innerHTML = `${val} <span data-remove-pos style="color:var(--accent-red);font-weight:700;cursor:pointer;margin-left:2px;">×</span>`;
      list.appendChild(chip);
      if (input) input.value = '';
    });

    /* Supprimer position custom */
    document.getElementById('pos-custom-list')?.addEventListener('click', e => {
      if (e.target.hasAttribute('data-remove-pos')) {
        e.target.closest('[data-custom-pos]')?.remove();
      }
    });
  }

  function _collectPositionsFromDOM() {
    const positions = [];
    document.querySelectorAll('.pos-check:checked').forEach(cb => positions.push(cb.dataset.pos));
    document.querySelectorAll('#pos-custom-list [data-custom-pos]').forEach(chip => {
      positions.push(chip.dataset.customPos);
    });
    return positions;
  }

  /* Sauvegarde produit */
  function _saveProduct(produitExist) {
    let data = getFormData('product-form-container');
    if (!data) {
      /* Fallback : lire les champs directement depuis le DOM */
      data = {};
      document.querySelectorAll('[data-form-field="product-form-container"]').forEach(el => {
        const key = el.dataset.fieldKey || el.getAttribute('name');
        if (!key) return;
        data[key] = el.type === 'number' ? Number(el.value) : el.value;
      });
      if (!data.nom) {
        toastError('Formulaire produit introuvable. Rechargez la page.');
        return;
      }
    }

    /* Type de produit depuis l'état module (plus fiable que formData) */
    data.productKind = _currentProductKind;

    /* Convertir les champs numériques */
    data.tva              = parseFloat(data.tva)              || 16;
    data.cout             = parseFloat(data.cout)             || 0;
    data.stockMagasin     = parseFloat(data.stockMagasin)     || 0;
    data.stockFournisseur = parseFloat(data.stockFournisseur) || 0;
    data.stockMin         = parseFloat(data.stockMin)         || 0;

    /* Résoudre HT/TTC : si TTC saisi et HT absent, on déduit HT depuis TTC */
    const htSaisi  = parseFloat(data.prix)    || 0;
    const ttcSaisi = parseFloat(data.prixTTC) || 0;
    if (ttcSaisi > 0 && htSaisi === 0) {
      data.prix    = Math.round(ttcSaisi / (1 + data.tva / 100));
      data.prixTTC = ttcSaisi;
    } else {
      data.prix    = htSaisi;
      data.prixTTC = htSaisi > 0 ? Math.round(htSaisi * (1 + data.tva / 100)) : ttcSaisi;
    }

    /* Stock total = entrepôt magasin + entrepôt fournisseur (si au moins un renseigné) */
    if (data.stockMagasin > 0 || data.stockFournisseur > 0) {
      data.stock = data.stockMagasin + data.stockFournisseur;
    } else {
      data.stock = parseFloat(data.stock) || 0;
    }

    /* Image en attente */
    if (_pendingImage !== null) {
      data.image = _pendingImage;
    }

    /* Produit simple : pas de variantes ni d'attributs */
    const isVariable = (data.productKind || 'simple') === 'variable';

    if (isVariable) {
      const variantesMAJ = _collectVariantesFromDOM();
      data.variantes = variantesMAJ;
      data.paliers   = _collectPaliersFromDOM();
      data.customAttrs    = _currentCustomAttrs.filter(ca => ca.nom);
      data.attrPrix       = _attrPrix;
      data.attrIncrements = Object.assign({}, _attrIncrements);
      /* Stock = somme quantités variantes */
      if (variantesMAJ.length > 0) {
        data.stock = variantesMAJ.reduce((s, v) => s + (parseInt(v.quantite) || 0), 0);
        data.tailles  = [...new Set(variantesMAJ.map(v => v.taille).filter(Boolean))].join(', ');
        data.couleurs = [...new Set(variantesMAJ.map(v => v.couleur).filter(Boolean))].join(', ');
        data.coupe    = [...new Set(variantesMAJ.map(v => v.coupe).filter(Boolean))].join(', ');
      }
    } else {
      /* Produit simple : on efface toute donnée de variantes */
      data.variantes      = [];
      data.paliers        = [];
      data.customAttrs    = [];
      data.attrPrix       = '';
      data.attrIncrements = {};
    }

    /* Positions atelier disponibles */
    data.positionsAtelier = _collectPositionsFromDOM();

    if (!data.nom) { toastError('Le nom du produit est obligatoire.'); return; }

    const isNew = !_state.currentId;
    if (isNew) {
      Store.create('produits', data);
      toastSuccess('Produit créé.');
    } else {
      Store.update('produits', _state.currentId, data);
      toastSuccess('Produit mis à jour.');
    }

    _pendingImage     = null;
    _currentVariantes = [];
    _state.mode = 'list';
    _renderProductList(
      document.getElementById('toolbar-actions'),
      document.getElementById('view-content')
    );
  }

  /* Archiver / Réactiver un produit */
  function _toggleArchiveProduct(produit) {
    const newStatus = produit.status === 'archived' ? 'active' : 'archived';
    const msg = newStatus === 'archived'
      ? `Archiver "${produit.nom}" ? Il n'apparaîtra plus dans les devis et commandes.`
      : `Réactiver "${produit.nom}" ? Il sera de nouveau disponible.`;
    showConfirm(msg, () => {
      Store.update('produits', produit.id, { status: newStatus });
      const tk = newStatus === 'archived' ? '🗄 Produit archivé.' : '♻ Produit réactivé.';
      if (typeof toastSuccess === 'function') toastSuccess(tk);
      _renderProductList(
        document.getElementById('toolbar-actions'),
        document.getElementById('view-content')
      );
    });
  }

  /* Suppression produit */
  function _deleteProduct(produit) {
    showDeleteConfirm(produit.nom, () => {
      Store.remove('produits', produit.id);
      toastSuccess('Produit supprimé.');
      _renderProductList(
        document.getElementById('toolbar-actions'),
        document.getElementById('view-content')
      );
    });
  }

  /* Modal ajustement manuel de stock */
  function _openAjustementModal(produit) {
    showFormModal(
      `Ajustement de stock — ${produit.nom}`,
      [
        {
          name: 'type', label: 'Type', type: 'select', required: true,
          options: [
            { value: 'Ajustement', label: 'Ajustement (remplace)' },
            { value: 'Entrée',     label: 'Entrée (ajoute)' },
            { value: 'Sortie',     label: 'Sortie (soustrait)' }
          ]
        },
        { name: 'quantite', label: 'Quantité *', type: 'number', required: true },
        { name: 'motif',    label: 'Motif',       type: 'text'   }
      ],
      { type: 'Ajustement', quantite: produit.stock || 0 },
      (data) => {
        const qte = parseFloat(data.quantite) || 0;
        let newStock = produit.stock || 0;

        if (data.type === 'Ajustement') newStock = qte;
        else if (data.type === 'Entrée') newStock += qte;
        else if (data.type === 'Sortie') newStock = Math.max(0, newStock - qte);

        Store.update('produits', produit.id, { stock: newStock });

        /* Enregistrement mouvement */
        Store.create('mouvements', {
          date:       new Date().toISOString().slice(0, 10),
          produitId:  produit.id,
          produitNom: produit.nom,
          type:       data.type,
          quantite:   qte,
          motif:      data.motif || 'Ajustement manuel',
          reference:  'AJUST'
        });

        toastSuccess(`Stock de "${produit.nom}" mis à jour → ${newStock} ${produit.unite || 'u'}`);
        _renderProductList(
          document.getElementById('toolbar-actions'),
          document.getElementById('view-content')
        );
      }
    );
  }

  /* ================================================================
     VUE : CATÉGORIES
     ================================================================ */
  function _renderCategories(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-new-cat">+ Nouvelle catégorie</button>`;

    toolbar.querySelector('#btn-new-cat').addEventListener('click', () => {
      showFormModal(
        'Nouvelle catégorie',
        [{ name: 'nom', label: 'Nom *', type: 'text', required: true }],
        {},
        (data) => {
          if (!data.nom) { toastError('Nom requis.'); return; }
          const cats = Store.getAll('categories');
          if (cats.find(c => c.nom === data.nom)) {
            toastWarning('Cette catégorie existe déjà.');
            return;
          }
          Store.create('categories', { nom: data.nom });
          toastSuccess('Catégorie créée.');
          _renderCategories(
            document.getElementById('toolbar-actions'),
            document.getElementById('view-content')
          );
        }
      );
    });

    const cats    = _getCategories();
    const produits = Store.getAll('produits');

    /* Compter les produits par catégorie */
    const countMap = {};
    produits.forEach(p => {
      const c = p.categorie || '(Sans catégorie)';
      countMap[c] = (countMap[c] || 0) + 1;
    });

    const data = cats.map(c => ({
      nom:      c,
      nbProduits: countMap[c] || 0,
      valeurStock: produits
        .filter(p => p.categorie === c)
        .reduce((s, p) => s + (p.stock || 0) * (p.cout || 0), 0)
    }));

    area.innerHTML = '<div id="inv-categories-table"></div>';
    renderTable('inv-categories-table', {
      title: 'Catégories',
      data,
      columns: [
        { key: 'nom',         label: 'Catégorie',      type: 'text', sortable: true },
        { key: 'nbProduits',  label: 'Nb produits',    type: 'text', sortable: true },
        {
          key: 'valeurStock', label: 'Valeur stock', type: 'money',
          render: (r) => fmt(Math.round(r.valeurStock))
        },
        {
          key: '_actions', label: '', type: 'actions',
          actions: [
            {
              label: '🗑 Supprimer', className: 'btn-ghost danger',
              onClick: (row) => {
                if (row.nbProduits > 0) {
                  toastWarning(`${row.nbProduits} produit(s) utilisent cette catégorie.`);
                  return;
                }
                showDeleteConfirm(row.nom, () => {
                  const stored = Store.getAll('categories');
                  const cat    = stored.find(c => c.nom === row.nom);
                  if (cat) Store.remove('categories', cat.id);
                  toastSuccess('Catégorie supprimée.');
                  _renderCategories(
                    document.getElementById('toolbar-actions'),
                    document.getElementById('view-content')
                  );
                });
              }
            }
          ]
        }
      ],
      emptyMsg: 'Aucune catégorie.'
    });
  }

  /* ================================================================
     VUE : MOUVEMENTS DE STOCK
     ================================================================ */
  function _renderStockMoves(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-ajust-stock">📊 Ajustement manuel</button>`;

    toolbar.querySelector('#btn-ajust-stock').addEventListener('click', () => {
      const produits = Store.getAll('produits');
      const opts = produits.map(p => ({ value: p.id, label: `${p.emoji || '📦'} ${p.nom}` }));

      showFormModal(
        'Ajustement de stock',
        [
          {
            name: 'produitId', label: 'Produit *', type: 'select', required: true,
            options: [{ value: '', label: '— Sélectionner —' }, ...opts]
          },
          {
            name: 'type', label: 'Type', type: 'select', required: true,
            options: [
              { value: 'Ajustement', label: 'Ajustement (remplace)' },
              { value: 'Entrée',     label: 'Entrée (ajoute)' },
              { value: 'Sortie',     label: 'Sortie (soustrait)' }
            ]
          },
          { name: 'quantite', label: 'Quantité *', type: 'number', required: true },
          { name: 'motif',    label: 'Motif',       type: 'text'   }
        ],
        { type: 'Ajustement' },
        (data) => {
          if (!data.produitId) { toastError('Veuillez sélectionner un produit.'); return; }
          const produit = Store.getById('produits', data.produitId);
          if (!produit) return;

          const qte = parseFloat(data.quantite) || 0;
          let newStock = produit.stock || 0;

          if (data.type === 'Ajustement') newStock = qte;
          else if (data.type === 'Entrée')  newStock += qte;
          else if (data.type === 'Sortie')  newStock = Math.max(0, newStock - qte);

          Store.update('produits', produit.id, { stock: newStock });
          Store.create('mouvements', {
            date:       new Date().toISOString().slice(0, 10),
            produitId:  produit.id,
            produitNom: produit.nom,
            type:       data.type,
            quantite:   qte,
            motif:      data.motif || 'Ajustement manuel',
            reference:  'AJUST'
          });

          toastSuccess(`Stock "${produit.nom}" → ${newStock} ${produit.unite || 'u'}`);
          _renderStockMoves(
            document.getElementById('toolbar-actions'),
            document.getElementById('view-content')
          );
        }
      );
    });

    const mouvements = Store.getAll('mouvements');
    const sorted     = [...mouvements].sort((a, b) =>
      new Date(b.date || 0) - new Date(a.date || 0)
    );

    const TYPE_COLORS = {
      'Entrée':      'green',
      'Sortie':      'red',
      'Ajustement':  'blue'
    };

    area.innerHTML = '<div id="inv-moves-table"></div>';
    renderTable('inv-moves-table', {
      title: `Mouvements de stock (${mouvements.length})`,
      data: sorted,
      searchable: true,
      columns: [
        { key: 'date',       label: 'Date',     type: 'date',  sortable: true },
        { key: 'produitNom', label: 'Produit',  type: 'text',  sortable: true },
        { key: 'type',       label: 'Type',     type: 'badge', badgeMap: TYPE_COLORS, sortable: true },
        {
          key: 'quantite', label: 'Quantité', type: 'text',
          render: (r) => {
            const sign  = r.type === 'Sortie' ? '-' : (r.type === 'Entrée' ? '+' : '=');
            const color = r.type === 'Sortie' ? 'var(--accent-red)'
              : r.type === 'Entrée' ? 'var(--accent-green)'
              : 'var(--accent-blue)';
            return `<span style="font-family:var(--font-mono);font-weight:700;color:${color};">
              ${sign}${r.quantite}
            </span>`;
          }
        },
        { key: 'motif',     label: 'Motif',     type: 'text' },
        { key: 'reference', label: 'Référence', type: 'text' }
      ],
      emptyMsg: 'Aucun mouvement enregistré.'
    });
  }

  /* ================================================================
     VUE : RAPPORT STOCK
     ================================================================ */
  function _renderStockReport(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-ghost" id="btn-refresh-stock">↺ Actualiser</button>`;

    toolbar.querySelector('#btn-refresh-stock').addEventListener('click', () => {
      _renderStockReport(toolbar, area);
    });

    const produits = Store.getAll('produits');

    /* Calculs globaux */
    const valeurTotale = produits.reduce((s, p) => s + (p.stock || 0) * (p.cout || 0), 0);
    const ruptures     = produits.filter(p => (p.stock || 0) === 0);
    const alertes      = produits.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.stockMin || 0));
    const nbRefs       = produits.length;

    /* Valeur par catégorie */
    const catValMap = {};
    produits.forEach(p => {
      const cat = p.categorie || '(Sans catégorie)';
      catValMap[cat] = (catValMap[cat] || 0) + (p.stock || 0) * (p.cout || 0);
    });

    area.innerHTML = `
      <div style="padding:24px 0;max-width:1100px;margin:0 auto;">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:24px;">
          Rapport Stock
        </div>

        <!-- KPI -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;">
          <div id="kpi-valeur-stock"></div>
          <div id="kpi-ruptures"></div>
          <div id="kpi-alertes"></div>
          <div id="kpi-nb-refs"></div>
        </div>

        <!-- Graphiques -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
          <div style="background:var(--bg-surface);border:1px solid var(--border);
            border-radius:12px;padding:20px;">
            <div id="chart-stock-categories"></div>
          </div>
          <div style="background:var(--bg-surface);border:1px solid var(--border);
            border-radius:12px;padding:20px;">
            <div id="chart-stock-top"></div>
          </div>
        </div>

        <!-- Table alertes -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);
          border-radius:12px;padding:20px;margin-bottom:24px;">
          <div style="font-size:14px;font-weight:600;color:var(--accent-orange);
            margin-bottom:16px;">⚠ Alertes stock (${alertes.length + ruptures.length})</div>
          <div id="table-alertes-stock"></div>
        </div>

      </div>`;

    /* Stat cards */
    statCard('kpi-valeur-stock', {
      icon: '💎', value: fmt(Math.round(valeurTotale)),
      label: 'Valeur totale stock', color: 'var(--accent-blue)'
    });
    statCard('kpi-ruptures', {
      icon: '🚫', value: ruptures.length,
      label: 'Ruptures de stock',
      color: 'var(--accent-red)',
      sub: ruptures.length > 0 ? ruptures.slice(0,2).map(p=>p.nom).join(', ') + (ruptures.length > 2 ? '…' : '') : 'Aucune rupture'
    });
    statCard('kpi-alertes', {
      icon: '⚠', value: alertes.length,
      label: 'Alertes stock bas', color: 'var(--accent-orange)'
    });
    statCard('kpi-nb-refs', {
      icon: '📦', value: nbRefs,
      label: 'Références actives', color: 'var(--accent-green)'
    });

    /* Pie chart par catégorie */
    const catColors = ['#4a5fff','#00d4aa','#ffc857','#ff6b6b','#b07bff','#00b4d8','#f77f00','#9b5de5'];
    const catEntries = Object.entries(catValMap).filter(e => e[1] > 0);
    pieChart('chart-stock-categories', {
      title: 'Valeur stock par catégorie',
      segments: catEntries.map(([label, value], i) => ({
        label, value: Math.round(value), color: catColors[i % catColors.length]
      })),
      size: 150,
      donut: true
    });

    /* Bar chart top 8 produits par valeur */
    const topProduits = [...produits]
      .map(p => ({ ...p, valeurStock: (p.stock || 0) * (p.cout || 0) }))
      .sort((a, b) => b.valeurStock - a.valeurStock)
      .slice(0, 8);

    barChart('chart-stock-top', {
      title: 'Top produits par valeur stock',
      labels: topProduits.map(p => (p.emoji || '') + ' ' + truncate(p.nom, 20)),
      values: topProduits.map(p => p.valeurStock),
      formatter: (v) => fmt(Math.round(v)),
      colors: catColors
    });

    /* Table alertes */
    const alerteData = [
      ...ruptures.map(p => ({ ...p, alerte: 'Rupture' })),
      ...alertes.map(p => ({ ...p, alerte: 'Stock bas' }))
    ];

    const ALERTE_COLORS = { 'Rupture': 'red', 'Stock bas': 'orange' };

    renderTable('table-alertes-stock', {
      data: alerteData,
      columns: [
        {
          key: 'nom', label: 'Produit', type: 'text',
          render: (row) => `${row.emoji || '📦'} ${_escI(row.nom)}`
        },
        { key: 'categorie',  label: 'Catégorie',  type: 'text' },
        { key: 'alerte',     label: 'Alerte',      type: 'badge', badgeMap: ALERTE_COLORS },
        {
          key: 'stock', label: 'Stock actuel', type: 'text',
          render: (r) => {
            const c = r.stock === 0 ? 'var(--accent-red)' : 'var(--accent-orange)';
            return `<span style="font-family:var(--font-mono);color:${c};font-weight:700;">
              ${r.stock} ${r.unite || 'u'}
            </span>`;
          }
        },
        {
          key: 'stockMin', label: 'Stock min', type: 'text',
          render: (r) => `<span style="font-family:var(--font-mono);">${r.stockMin || 0}</span>`
        },
        {
          key: '_actions', label: '', type: 'actions',
          actions: [
            {
              label: '+ Commander', className: 'btn-ghost',
              onClick: (row) => {
                toastInfo(`Redirection vers Achats pour "${row.nom}"…`);
              }
            }
          ]
        }
      ],
      emptyMsg: '✅ Tous les stocks sont suffisants.'
    });
  }

  /* ================================================================
     SYSTÈME DE VARIANTES
     ================================================================ */

  /**
   * Affiche la section variantes sous le formulaire produit.
   * Contient : générateur (tailles/couleurs/coupes) + tableau éditable.
   */
  /* ================================================================
     ATTRIBUTS PERSONNALISÉS + INCRÉMENTS PRIX PAR ATTRIBUT
     ================================================================ */

  function _renderAvancesSection(produit) {
    const sec = document.getElementById('avances-section');
    if (!sec) return;

    /* Initialiser l'état depuis le produit existant */
    _currentCustomAttrs = (produit.customAttrs || []).map(ca => ({
      nom: ca.nom || '',
      valeurs: [...(ca.valeurs || [])]
    }));
    _attrPrix       = produit.attrPrix       || '';
    _attrIncrements = Object.assign({}, produit.attrIncrements || {});

    _refreshAvancesSection(sec, produit);
  }

  /* Catalogue des types de formats avec leurs valeurs par défaut */
  const _FORMAT_TYPES = {
    format_dtf: {
      lbl:  '🖨 Format Transfert DTF',
      vals: ['A5 (14×20)', 'A4 (20×28)', 'A3 (28×40)', 'A2 (40×56)', 'A1 (56×80)',
             'Coeur 10×10', 'Poitrine 24×24', 'Dos 24×24', 'Nuque 8×8', 'Manche 10×10']
    },
    format_thermocollant: {
      lbl:  '🔥 Format Thermocollant',
      vals: ['A5 (14×20)', 'A4 (20×28)', 'A3 (28×40)',
             'Coeur 8×8', 'Poitrine 20×20', 'Dos 28×28', 'Manche 8×8']
    },
    format_sticker: {
      lbl:  '🏷 Format Stickers',
      vals: ['A6 (10×14)', 'A5 (14×20)', 'A4 (20×28)',
             '5×5 cm', '10×10 cm', '15×15 cm', '20×20 cm']
    }
  };

  /* Mots-clés pour fusionner un type de format avec un attribut custom */
  const _FORMAT_KEYWORDS = {
    format_dtf:           ['dtf', 'transfert dtf', 'format dtf', 'format'],
    format_thermocollant: ['thermocollant', 'thermo', 'transfert thermo', 'format thermo'],
    format_sticker:       ['sticker', 'stickers', 'format sticker', 'autocollant']
  };

  function _getAttrValues(attrName) {
    /* Retourne les valeurs connues pour un attribut donné */
    if (attrName === 'taille') {
      const t = document.getElementById('var-attr-tailles')?.value || '';
      const vals = t.split(',').map(s => s.trim()).filter(Boolean);
      if (vals.length) return vals;
      return [...new Set(_currentVariantes.map(v => v.taille).filter(Boolean))];
    }
    if (attrName === 'couleur') {
      const c = document.getElementById('var-attr-couleurs')?.value || '';
      const vals = c.split(',').map(s => s.trim()).filter(Boolean);
      if (vals.length) return vals;
      return [...new Set(_currentVariantes.map(v => v.couleur).filter(Boolean))];
    }
    if (attrName === 'coupe') {
      const co = document.getElementById('var-attr-coupe')?.value || '';
      const vals = co.split(',').map(s => s.trim()).filter(Boolean);
      if (vals.length) return vals;
      return [...new Set(_currentVariantes.map(v => v.coupe).filter(Boolean))];
    }
    /* Types de formats : fusion avec l'attribut custom correspondant */
    if (_FORMAT_TYPES[attrName]) {
      const keywords = _FORMAT_KEYWORDS[attrName] || [];
      /* Chercher un attribut custom dont le nom correspond */
      const customFmt = _currentCustomAttrs.find(ca => {
        const nom = ca.nom.toLowerCase();
        return keywords.some(k => nom.includes(k));
      });
      /* Priorité : valeurs custom si renseignées, sinon valeurs par défaut du type */
      if (customFmt && customFmt.valeurs.length) return customFmt.valeurs;
      return _FORMAT_TYPES[attrName].vals;
    }
    const custom = _currentCustomAttrs.find(ca => ca.nom === attrName);
    return custom ? custom.valeurs : [];
  }

  function _refreshAvancesSection(sec, produit) {
    /* Options de l'attribut prix */
    /* Identifier les attrs custom qui ne correspondent pas à un type de format connu */
    const formatKeywordsAll = Object.values(_FORMAT_KEYWORDS).flat();
    const customNonFormat = _currentCustomAttrs.filter(ca => {
      if (!ca.nom) return false;
      const nom = ca.nom.toLowerCase();
      return !formatKeywordsAll.some(k => nom.includes(k));
    });

    const attrOptions = [
      { val: '',    lbl: '— Aucun (prix fixe) —', group: '' },
      { val: 'taille',  lbl: '📏 Taille',         group: 'Dimensions' },
      { val: 'couleur', lbl: '🎨 Couleur',          group: 'Dimensions' },
      { val: 'coupe',   lbl: '✂ Coupe / Style',     group: 'Dimensions' },
      /* Types de formats */
      ...Object.entries(_FORMAT_TYPES).map(([val, { lbl }]) => ({ val, lbl, group: 'Formats' })),
      /* Attributs custom restants */
      ...customNonFormat.map(ca => ({ val: ca.nom, lbl: '⬡ ' + ca.nom, group: 'Personnalisés' }))
    ];

    /* Construire le select avec optgroups */
    const groups = {};
    attrOptions.forEach(o => {
      const g = o.group || '';
      if (!groups[g]) groups[g] = [];
      groups[g].push(o);
    });
    const selectHtml = Object.entries(groups).map(([grp, opts]) => {
      const optsHtml = opts.map(o =>
        `<option value="${_escI(o.val)}" ${_attrPrix === o.val ? 'selected' : ''}>${_escI(o.lbl)}</option>`
      ).join('');
      return grp ? `<optgroup label="${_escI(grp)}">${optsHtml}</optgroup>` : optsHtml;
    }).join('');

    /* Valeurs + incréments pour l'attribut sélectionné */
    const attrVals = _attrPrix ? _getAttrValues(_attrPrix) : [];
    const incrementRows = attrVals.map(v => `
      <tr>
        <td style="padding:4px 8px;font-size:13px;font-weight:600;color:var(--text-primary);">
          ${_escI(v)}
        </td>
        <td style="padding:4px 8px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="color:var(--text-muted);font-size:12px;">+</span>
            <input type="number" class="line-input num-input" data-incr-val="${_escI(v)}"
              value="${_attrIncrements[v] || 0}" min="0" step="1"
              style="width:90px;" placeholder="0" />
            <span style="color:var(--text-muted);font-size:12px;">XPF</span>
          </div>
        </td>
      </tr>`).join('');

    /* Lignes attributs personnalisés */
    const customRows = _currentCustomAttrs.map((ca, i) => `
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;" data-ca-idx="${i}">
        <input type="text" class="form-control" data-ca-nom="${i}"
          value="${_escI(ca.nom)}" placeholder="Nom attribut (ex: Matière)"
          style="width:140px;flex-shrink:0;" />
        <input type="text" class="form-control" data-ca-valeurs="${i}"
          value="${_escI(ca.valeurs.join(', '))}" placeholder="Valeurs séparées par virgule"
          style="flex:1;" />
        <button class="btn btn-ghost btn-sm" data-ca-del="${i}"
          style="color:var(--accent-red);flex-shrink:0;">✕</button>
      </div>`).join('');

    sec.innerHTML = `
      <div style="background:var(--bg-surface);border:1px solid var(--border);
        border-radius:12px;padding:20px;margin-bottom:24px;">

        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:16px;">
          ⬡ Attributs & Tarification par variante
        </div>

        <!-- Attributs personnalisés -->
        <div style="margin-bottom:20px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);
            text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">
            Attributs personnalisés
          </div>
          <div id="custom-attrs-list">
            ${customRows || '<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Aucun attribut personnalisé.</div>'}
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-add-custom-attr" style="margin-top:4px;">
            + Ajouter un attribut
          </button>
        </div>

        <!-- Attribut qui varie le prix + incréments -->
        <div style="border-top:1px solid var(--border);padding-top:16px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);
            text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">
            Incrément de prix par valeur d'attribut
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <label style="font-size:12px;color:var(--text-secondary);white-space:nowrap;">
              Attribut qui varie le prix :
            </label>
            <select class="form-control" id="avance-attrprix" style="width:220px;">
              ${selectHtml}
            </select>
          </div>

          ${attrVals.length ? `
            <div style="margin-bottom:12px;">
              <table style="font-size:12px;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="padding:4px 8px;text-align:left;color:var(--text-muted);
                      font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Valeur</th>
                    <th style="padding:4px 8px;text-align:left;color:var(--text-muted);
                      font-size:11px;text-transform:uppercase;letter-spacing:.05em;">Supplément de prix</th>
                  </tr>
                </thead>
                <tbody>${incrementRows}</tbody>
              </table>
            </div>
            <button class="btn btn-primary btn-sm" id="btn-apply-increments">
              ⚡ Appliquer aux variantes
            </button>
            <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">
              prix variante = prix de base + incrément
            </span>
          ` : (
            _attrPrix
              ? `<div style="font-size:12px;color:var(--text-muted);">
                  Aucune valeur trouvée. Renseignez d'abord les attributs dans la section Variantes.
                </div>`
              : ''
          )}
        </div>
      </div>`;

    /* ── Événements ── */

    /* Ajouter attribut personnalisé */
    document.getElementById('btn-add-custom-attr')?.addEventListener('click', () => {
      _currentCustomAttrs.push({ nom: '', valeurs: [] });
      _refreshAvancesSection(sec, produit);
    });

    /* Supprimer attribut personnalisé */
    sec.querySelectorAll('[data-ca-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.caDel);
        if (_attrPrix === _currentCustomAttrs[idx]?.nom) {
          _attrPrix = '';
          _attrIncrements = {};
        }
        _currentCustomAttrs.splice(idx, 1);
        _refreshAvancesSection(sec, produit);
      });
    });

    /* Éditer nom attribut personnalisé */
    sec.querySelectorAll('[data-ca-nom]').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = parseInt(inp.dataset.caNom);
        _currentCustomAttrs[i].nom = inp.value.trim();
      });
    });

    /* Éditer valeurs attribut personnalisé */
    sec.querySelectorAll('[data-ca-valeurs]').forEach(inp => {
      inp.addEventListener('input', () => {
        const i = parseInt(inp.dataset.caValeurs);
        _currentCustomAttrs[i].valeurs = inp.value.split(',').map(s => s.trim()).filter(Boolean);
        if (_attrPrix === _currentCustomAttrs[i].nom) {
          _refreshAvancesSection(sec, produit);
        }
        _updateVarAttrsSummary();
      });
    });

    /* Changement de l'attribut prix */
    document.getElementById('avance-attrprix')?.addEventListener('change', (e) => {
      _attrPrix = e.target.value;
      _refreshAvancesSection(sec, produit);
      _updateVarAttrsSummary();
    });

    /* Éditer un incrément */
    sec.querySelectorAll('[data-incr-val]').forEach(inp => {
      inp.addEventListener('input', () => {
        _attrIncrements[inp.dataset.incrVal] = parseFloat(inp.value) || 0;
      });
    });

    /* Appliquer les incréments aux variantes */
    document.getElementById('btn-apply-increments')?.addEventListener('click', () => {
      const prixBase = parseFloat(document.querySelector('[name="prix"]')?.value) || 0;
      /* Résoudre le nom de clé réel : format type → custom attr nom */
      let resolvedKey = _attrPrix;
      if (_FORMAT_TYPES[_attrPrix]) {
        const keywords = _FORMAT_KEYWORDS[_attrPrix] || [];
        const matchAttr = _currentCustomAttrs.find(ca => {
          const n = ca.nom.toLowerCase();
          return keywords.some(k => n.includes(k));
        });
        if (matchAttr) resolvedKey = matchAttr.nom;
      }
      let nb = 0;
      _currentVariantes.forEach(v => {
        /* Chercher la valeur de l'attr dans les champs directs ou customDims */
        const valAttr = v[resolvedKey] !== undefined
          ? v[resolvedKey]
          : ((v.customDims || {})[resolvedKey] || '');
        if (valAttr && _attrIncrements[valAttr] !== undefined) {
          v.prix = prixBase + (_attrIncrements[valAttr] || 0);
          nb++;
        }
      });
      _refreshVariantesTable();
      if (typeof toast === 'function') toast(`Prix recalculés pour ${nb} variante${nb > 1 ? 's' : ''}.`, 'success');
    });
  }

  function _renderVariantesSection(produit) {
    const sec = document.getElementById('variantes-section');
    if (!sec) return;

    const tDefaut = produit.tailles || '';

    sec.innerHTML = `
      <div style="background:var(--bg-surface);border:1px solid var(--border);
        border-radius:12px;padding:20px;margin-bottom:24px;">

        <!-- EN-TÊTE -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
          <div style="font-size:14px;font-weight:700;color:var(--text-primary);">
            ⚡ Variantes de l'article
            <span id="var-count-badge" style="font-size:12px;font-weight:400;
              color:var(--text-muted);margin-left:6px;">
              (${_currentVariantes.length} variante${_currentVariantes.length !== 1 ? 's' : ''})
            </span>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-var-clear-all"
            style="color:var(--accent-red);">✕ Tout effacer</button>
        </div>

        <!-- ATTRIBUTS & TARIFICATION (intégré) -->
        <div id="avances-section" style="margin-bottom:16px;"></div>

        <!-- GÉNÉRATION -->
        <div style="background:var(--bg-elevated);border-radius:10px;padding:14px;margin-bottom:16px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;
            letter-spacing:.06em;color:var(--text-muted);margin-bottom:12px;">
            Génération des variantes
          </div>

          <!-- Taille optionnelle -->
          <div class="form-group" style="margin-bottom:10px;">
            <label class="form-label">📏 Taille
              <span style="font-size:10px;font-weight:400;color:var(--text-muted);">
                — optionnel, laisser vide si non applicable (ex: transferts vinyl)
              </span>
            </label>
            <input type="text" class="form-control" id="var-attr-tailles"
              value="${_escI(tDefaut)}" placeholder="S, M, L, XL, XXL" />
          </div>

          <!-- Résumé des attributs utilisés -->
          <div id="var-attrs-summary" style="margin-bottom:12px;"></div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="btn-var-generate">⚡ Générer les variantes</button>
            <button class="btn btn-warning btn-sm" id="btn-var-regenerate">🔄 Régénérer</button>
            <button class="btn btn-ghost btn-sm" id="btn-var-add-manual">+ Ajouter manuellement</button>
            <span id="var-gen-preview" style="font-size:11px;color:var(--text-muted);margin-left:4px;"></span>
          </div>
        </div>

        <!-- TABLEAU VARIANTES -->
        <div id="variantes-table-wrap">${_renderVariantesTable()}</div>
      </div>`;

    /* Rendre les attributs à l'intérieur du bloc */
    _renderAvancesSection(produit);
    /* Résumé des attrs pour le générateur */
    _updateVarAttrsSummary();
    _bindVariantesEvents(produit);
  }

  /* Résumé des attributs inclus dans la génération */
  function _updateVarAttrsSummary() {
    const el = document.getElementById('var-attrs-summary');
    if (!el) return;
    const actives = _currentCustomAttrs.filter(ca => ca.nom && ca.valeurs.length > 0);
    if (!actives.length) {
      el.innerHTML = `<div style="font-size:12px;color:var(--text-muted);font-style:italic;">
        Ajoutez des attributs ci-dessus — chaque attribut devient une dimension des variantes.</div>`;
      return;
    }
    el.innerHTML = `
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">
        Attributs inclus dans la génération :
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${actives.map(ca => `
          <span style="background:var(--bg-surface);
            border:1px solid ${_attrPrix === ca.nom ? 'var(--accent-blue)' : 'var(--border)'};
            border-radius:6px;padding:3px 10px;font-size:12px;font-weight:600;
            color:${_attrPrix === ca.nom ? 'var(--accent-blue)' : 'var(--text-primary)'};">
            ${_escI(ca.nom)}${_attrPrix === ca.nom ? ' ⭐' : ''}
            <span style="font-weight:400;color:var(--text-muted);">(${ca.valeurs.length})</span>
          </span>`).join('')}
      </div>`;
  }

  /* ================================================================
     TARIFICATION DÉGRESSIVE (PALIERS DE PRIX)
     ================================================================ */

  /**
   * Affiche la section paliers de prix sous le formulaire produit.
   * Chaque palier = { qteMin, prix } — le meilleur prix est appliqué
   * automatiquement dans les lignes de commande selon la quantité.
   */
  function _renderPaliersSection(produit) {
    const sec = document.getElementById('paliers-section');
    if (!sec) return;

    /* Initialiser les paliers depuis le produit existant */
    _currentPaliers = (produit.paliers || []).map(p => ({ ...p }));

    _refreshPaliersSection(sec);
  }

  /** Re-dessine uniquement le contenu de la section paliers (sans recréer le wrapper) */
  function _refreshPaliersSection(sec) {
    const rows = _currentPaliers.map((p, i) => `
      <tr data-pal-idx="${i}">
        <td>
          <input type="number" class="line-input num-input" data-pal-field="qteMin" data-pal-i="${i}"
            value="${p.qteMin || ''}" placeholder="10" min="1" step="1" style="width:80px;" />
        </td>
        <td>
          <input type="number" class="line-input num-input" data-pal-field="prix" data-pal-i="${i}"
            value="${p.prix || ''}" placeholder="0.00" min="0" step="0.01" style="width:90px;" />
        </td>
        <td style="text-align:center;">
          <button class="btn-remove-line" data-pal-del="${i}" title="Supprimer ce palier">✕</button>
        </td>
      </tr>`).join('');

    sec.innerHTML = `
      <div style="background:var(--bg-surface);border:1px solid var(--border);
        border-radius:12px;padding:20px;margin-bottom:24px;">

        <!-- En-tête -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text-primary);">
              Tarification dégressive
              <span style="font-size:12px;color:var(--text-muted);font-weight:400;margin-left:6px;">
                (${_currentPaliers.length} palier${_currentPaliers.length !== 1 ? 's' : ''})
              </span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
              Le prix le plus avantageux est appliqué automatiquement selon la quantité commandée.
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="btn-pal-add">+ Ajouter un palier</button>
        </div>

        <!-- Tableau des paliers -->
        ${_currentPaliers.length === 0 ? `
          <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:13px;
            background:var(--bg-elevated);border-radius:8px;">
            Aucun palier — le prix standard s'applique toujours.
          </div>` : `
          <div class="table-wrapper">
            <table class="data-table" style="font-size:12px;">
              <thead>
                <tr>
                  <th style="width:120px;">Qté minimum</th>
                  <th style="width:120px;">Prix unitaire (XPF)</th>
                  <th style="width:50px;"></th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`}
      </div>`;

    /* Bind des événements de la section paliers */
    _bindPaliersEvents(sec);
  }

  /** Bind les événements du tableau paliers (add, remove, edit) */
  function _bindPaliersEvents(sec) {
    /* Ajouter un palier */
    sec.querySelector('#btn-pal-add')?.addEventListener('click', () => {
      _currentPaliers.push({ qteMin: '', prix: '' });
      _refreshPaliersSection(sec);
    });

    /* Supprimer un palier */
    sec.querySelectorAll('[data-pal-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.palDel);
        _currentPaliers.splice(idx, 1);
        _refreshPaliersSection(sec);
      });
    });

    /* Éditer un champ palier en temps réel */
    sec.querySelectorAll('[data-pal-field]').forEach(inp => {
      inp.addEventListener('input', () => {
        const i     = parseInt(inp.dataset.palI);
        const field = inp.dataset.palField;
        _currentPaliers[i][field] = inp.value;
      });
    });
  }

  /**
   * Lit les paliers depuis `_currentPaliers`, valide et trie par qteMin croissant.
   * Appelé dans _saveProduct() avant la persistance.
   */
  function _collectPaliersFromDOM() {
    return _currentPaliers
      .map(p => ({
        qteMin: parseInt(p.qteMin)   || 0,
        prix:   parseFloat(p.prix)   || 0
      }))
      .filter(p => p.qteMin > 0 && p.prix > 0)
      .sort((a, b) => a.qteMin - b.qteMin);
  }

  /** Génère le HTML du tableau éditable des variantes */
  function _renderVariantesTable() {
    if (_currentVariantes.length === 0) {
      return `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">
        Aucune variante. Définissez des attributs puis cliquez sur "Générer".
      </div>`;
    }

    /* Colonnes dynamiques : taille + attrs custom actifs */
    const hasTaille  = _currentVariantes.some(v => v.taille);
    /* Colonnes custom : basées sur les attrs définis ET les customDims stockés */
    const customCols = [...new Set([
      ..._currentCustomAttrs.filter(ca => ca.nom).map(ca => ca.nom),
      ..._currentVariantes.flatMap(v => Object.keys(v.customDims || {}))
    ])];

    const rows = _currentVariantes.map((v, i) => `
      <tr data-var-idx="${i}">
        ${hasTaille ? `<td><input type="text" class="line-input" data-var-field="taille" data-var-i="${i}"
          value="${_escI(v.taille || '')}" placeholder="S" style="width:60px;" /></td>` : ''}
        ${customCols.map(col => {
          /* Cherche la valeur dans les champs standard ou customDims */
          const val = v[col] !== undefined ? v[col] : ((v.customDims || {})[col] || '');
          return `<td><input type="text" class="line-input" data-var-field="${_escI(col)}" data-var-i="${i}"
            value="${_escI(val)}" placeholder="${_escI(col)}" style="width:85px;" /></td>`;
        }).join('')}
        <td><input type="text" class="line-input" data-var-field="ref" data-var-i="${i}"
          value="${_escI(v.ref || '')}" placeholder="SKU-001" style="width:85px;" /></td>
        <td><input type="number" class="line-input num-input" data-var-field="prix" data-var-i="${i}"
          value="${v.prix || ''}" min="0" step="1" style="width:80px;" /></td>
        <td><input type="number" class="line-input num-input" data-var-field="cout" data-var-i="${i}"
          value="${v.cout || ''}" min="0" step="1" style="width:80px;" /></td>
        <td><input type="number" class="line-input num-input" data-var-field="quantite" data-var-i="${i}"
          value="${v.quantite || 0}" min="0" step="1" style="width:60px;" /></td>
        <td><button class="btn-remove-line" data-var-del="${i}" title="Supprimer">✕</button></td>
      </tr>`).join('');

    const totalQte  = _currentVariantes.reduce((s, v) => s + (parseInt(v.quantite) || 0), 0);
    const colCount  = (hasTaille ? 1 : 0) + customCols.length + 4; /* ref + prix + cout + qte */

    return `
      <div class="table-wrapper">
        <table class="data-table" style="font-size:12px;">
          <thead>
            <tr>
              ${hasTaille ? '<th style="width:70px;">Taille</th>' : ''}
              ${customCols.map(col =>
                `<th style="width:90px;text-transform:capitalize;">${_escI(col)}</th>`
              ).join('')}
              <th style="width:95px;">Réf / SKU</th>
              <th style="width:90px;text-align:right;">Prix HT</th>
              <th style="width:90px;text-align:right;">Coût</th>
              <th style="width:65px;text-align:right;">Qté</th>
              <th style="width:36px;"></th>
            </tr>
          </thead>
          <tbody id="var-tbody">${rows}</tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border);">
              <td colspan="${colCount}" style="text-align:right;font-size:12px;
                color:var(--text-muted);padding:8px 12px;">Stock total :</td>
              <td style="font-family:var(--font-mono);font-weight:700;
                color:var(--accent-green);padding:8px 6px;">${totalQte}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  /** Lie tous les événements de la section variantes */
  function _bindVariantesEvents(produit) {

    /* Aperçu du nombre de combinaisons */
    const _updateGenPreview = () => {
      const t    = _splitAttr(document.getElementById('var-attr-tailles')?.value);
      const dims = _currentCustomAttrs.filter(ca => ca.nom && ca.valeurs.length > 0);
      let n = Math.max(t.length, 1);
      dims.forEach(d => { n *= d.valeurs.length; });
      const prev = document.getElementById('var-gen-preview');
      if (prev) prev.textContent = n > 1 ? `→ ${n} combinaison${n > 1 ? 's' : ''}` : '';
    };
    document.getElementById('var-attr-tailles')?.addEventListener('input', _updateGenPreview);
    _updateGenPreview();

    /* Générer : taille × TOUS les attributs personnalisés */
    document.getElementById('btn-var-generate')?.addEventListener('click', () => {
      const tailles  = _splitAttr(document.getElementById('var-attr-tailles')?.value);
      const dims     = _currentCustomAttrs.filter(ca => ca.nom && ca.valeurs.length > 0);
      const prixDefaut = parseFloat(document.querySelector('[name="prix"]')?.value) || 0;
      const coutDefaut = parseFloat(document.querySelector('[name="cout"]')?.value) || 0;

      if (!dims.length && !tailles.length) {
        if (typeof toast === 'function') toast('Ajoutez au moins un attribut avec des valeurs.', 'info');
        return;
      }

      /* Construire toutes les combinaisons : taille × dim1 × dim2 × … */
      let combos = tailles.length ? tailles.map(t => ({ taille: t })) : [{}];
      dims.forEach(dim => {
        combos = combos.flatMap(combo =>
          dim.valeurs.map(v => ({ ...combo, [dim.nom]: v }))
        );
      });

      /* Clé de déduplication */
      const makeKey = combo =>
        Object.entries(combo).sort(([a],[b]) => a.localeCompare(b))
          .map(([k,v]) => `${k}:${v}`).join('|');

      const existingKeys = new Set(_currentVariantes.map(v => {
        const c = {};
        if (v.taille) c.taille = v.taille;
        _currentCustomAttrs.forEach(ca => {
          const val = v[ca.nom] !== undefined ? v[ca.nom] : ((v.customDims || {})[ca.nom]);
          if (val) c[ca.nom] = val;
        });
        return makeKey(c);
      }));

      let ajouts = 0;
      combos.forEach(combo => {
        const key = makeKey(combo);
        if (existingKeys.has(key)) return;

        /* Prix avec incrément attrPrix
           Si _attrPrix est un type de format (format_dtf…), résoudre vers
           le nom de l'attribut custom correspondant dans le combo */
        let prixVariante = prixDefaut;
        if (_attrPrix && Object.keys(_attrIncrements).length) {
          let resolvedKey = _attrPrix;
          if (_FORMAT_TYPES[_attrPrix]) {
            const keywords = _FORMAT_KEYWORDS[_attrPrix] || [];
            const matchAttr = _currentCustomAttrs.find(ca => {
              const n = ca.nom.toLowerCase();
              return keywords.some(k => n.includes(k));
            });
            if (matchAttr) resolvedKey = matchAttr.nom;
          }
          const valAttr = combo[resolvedKey] || '';
          if (valAttr && _attrIncrements[valAttr] !== undefined) {
            prixVariante = prixDefaut + (_attrIncrements[valAttr] || 0);
          }
        }

        /* Construire le variante — stocker chaque attr directement sur l'objet */
        const variante = { taille: combo.taille || '', ref: '', prix: prixVariante, cout: coutDefaut, quantite: 0 };
        dims.forEach(dim => { variante[dim.nom] = combo[dim.nom] || ''; });

        _currentVariantes.push(variante);
        existingKeys.add(key);
        ajouts++;
      });

      _refreshVariantesTable();
      if (ajouts > 0) {
        if (typeof toast === 'function') toast(`${ajouts} variante${ajouts > 1 ? 's' : ''} ajoutée${ajouts > 1 ? 's' : ''}.`, 'success');
      } else {
        if (typeof toast === 'function') toast('Toutes ces combinaisons existent déjà.', 'info');
      }
    });

    /* Régénérer */
    document.getElementById('btn-var-regenerate')?.addEventListener('click', () => {
      if (_currentVariantes.length > 0 &&
          !confirm('Effacer les variantes existantes et régénérer ?')) return;
      _currentVariantes = [];
      document.getElementById('btn-var-generate')?.click();
    });

    /* Ajouter manuellement */
    document.getElementById('btn-var-add-manual')?.addEventListener('click', () => {
      const v = { taille: '', ref: '', prix: 0, cout: 0, quantite: 0 };
      _currentCustomAttrs.filter(ca => ca.nom).forEach(ca => { v[ca.nom] = ''; });
      _currentVariantes.push(v);
      _refreshVariantesTable();
    });

    /* Tout effacer */
    document.getElementById('btn-var-clear-all')?.addEventListener('click', () => {
      if (_currentVariantes.length === 0) return;
      if (confirm('Effacer toutes les variantes ?')) {
        _currentVariantes = [];
        _refreshVariantesTable();
      }
    });

    /* Délégation sur le tableau : édition inline + suppression */
    _bindVariantesTableEvents();
  }

  /** Lie les événements du tableau de variantes (délégation) */
  function _bindVariantesTableEvents() {
    const wrap = document.getElementById('variantes-table-wrap');
    if (!wrap) return;

    /* Saisie dans les inputs */
    wrap.addEventListener('input', (e) => {
      const el = e.target;
      const i  = parseInt(el.dataset.varI, 10);
      const f  = el.dataset.varField;
      if (isNaN(i) || !f || !_currentVariantes[i]) return;

      const numFields = ['prix', 'cout', 'quantite'];
      _currentVariantes[i][f] = numFields.includes(f)
        ? parseInt(el.value) || 0
        : el.value;

      /* Mettre à jour uniquement le total stock sans recréer tout le tableau */
      _updateVarTotalStock();
      _updateVarCountBadge();
    });

    /* Suppression d'une ligne */
    wrap.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-var-del]');
      if (!btn) return;
      const i = parseInt(btn.dataset.varDel, 10);
      _currentVariantes.splice(i, 1);
      _refreshVariantesTable();
    });
  }

  /** Redessine le tableau sans toucher au reste de la section */
  function _refreshVariantesTable() {
    const wrap = document.getElementById('variantes-table-wrap');
    if (wrap) wrap.innerHTML = _renderVariantesTable();
    _bindVariantesTableEvents();
    _updateVarCountBadge();
  }

  /** Met à jour le total stock affiché en pied de tableau */
  function _updateVarTotalStock() {
    const total = _currentVariantes.reduce((s, v) => s + (parseInt(v.quantite) || 0), 0);
    const tfoot = document.querySelector('#variantes-section tfoot td:nth-child(2)');
    if (!tfoot) {
      /* Chercher dans le vrai DOM */
      const cells = document.querySelectorAll('#variantes-section tfoot td');
      if (cells.length >= 2) cells[1].textContent = total;
    }
  }

  /** Met à jour le badge compteur de variantes dans l'en-tête */
  function _updateVarCountBadge() {
    const badge = document.getElementById('var-count-badge');
    if (badge) {
      const n = _currentVariantes.length;
      badge.textContent = `(${n} variante${n !== 1 ? 's' : ''})`;
    }
  }

  /** Lit les variantes directement depuis le DOM du tableau éditable */
  function _collectVariantesFromDOM() {
    const rows = document.querySelectorAll('#var-tbody tr[data-var-idx]');
    if (rows.length === 0) return _currentVariantes;

    rows.forEach(tr => {
      const i = parseInt(tr.dataset.varIdx, 10);
      if (isNaN(i) || !_currentVariantes[i]) return;
      tr.querySelectorAll('[data-var-field]').forEach(inp => {
        const f = inp.dataset.varField;
        const numFields = ['prix', 'cout', 'quantite'];
        /* Stockage direct sur le variante (tous les attrs sont des propriétés top-level) */
        _currentVariantes[i][f] = numFields.includes(f)
          ? (parseFloat(inp.value) || 0)
          : inp.value;
      });
    });
    return _currentVariantes;
  }

  /** Découpe une chaîne d'attributs séparés par virgule/point-virgule */
  function _splitAttr(str) {
    if (!str || !str.trim()) return [];
    return str.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  }

  /* ================================================================
     UTILITAIRES PRIVÉS
     ================================================================ */

  /* Récupère la liste consolidée des catégories (Store + produits) */
  function _getCategories() {
    const stored  = Store.getAll('categories').map(c => c.nom);
    const fromProd = [...new Set(Store.getAll('produits').map(p => p.categorie).filter(Boolean))];
    return [...new Set([...stored, ...fromProd])].sort();
  }

  /* Échappement HTML */
  function _escI(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ================================================================
     PICKER DE VARIANTES — utilisé par sales.js dans les lignes de devis
     ================================================================ */

  /**
   * Ouvre un modal de sélection de variante pour un produit.
   * @param {object} produit  - Le produit complet
   * @param {function} onSelect - Callback(varianteSelectionnee, descriptionAuto)
   *   varianteSelectionnee = { taille, couleur, coupe, ref, prix, cout, ... }
   *   descriptionAuto      = string avec les attributs sélectionnés
   */
  function showVariantePicker(produit, onSelect) {
    const variantes = produit.variantes || [];
    if (variantes.length === 0) {
      if (typeof onSelect === 'function') onSelect(null, '');
      return;
    }

    const SKIP = new Set(['ref', 'prix', 'cout', 'quantite', 'customDims']);
    const fmt  = n => Number(n || 0).toLocaleString('fr-FR') + ' XPF';

    /* Attributs disponibles + valeurs uniques */
    const dynKeys = [...new Set(variantes.flatMap(v => Object.keys(v).filter(k => !SKIP.has(k))))];
    const attrVals = {};
    dynKeys.forEach(k => {
      attrVals[k] = [...new Set(variantes.map(v => v[k]).filter(Boolean))];
    });

    /* Icône par attribut */
    const attrIcon = k => {
      const kl = k.toLowerCase();
      if (kl === 'taille') return '📏';
      if (kl === 'couleur' || kl === 'color') return '🎨';
      if (kl === 'coupe') return '✂';
      if (kl.includes('format')) return '📐';
      if (kl.includes('aspect') || kl.includes('finition')) return '✨';
      return '▸';
    };

    /* Sélects par attribut */
    const selectsHtml = dynKeys.map(k => `
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:11px;font-weight:700;text-transform:uppercase;
          letter-spacing:.06em;color:var(--text-muted);margin-bottom:6px;">
          ${attrIcon(k)} ${_escI(k)}
        </label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;" id="vp-btns-${_escI(k)}">
          ${attrVals[k].map(val => `
            <button type="button" class="vp-attr-btn"
              data-attr="${_escI(k)}" data-val="${_escI(val)}"
              style="padding:6px 14px;border-radius:6px;border:1px solid var(--border);
                background:var(--bg-elevated);font-size:13px;cursor:pointer;
                transition:all .15s;color:var(--text-primary);">
              ${_escI(val)}
            </button>`).join('')}
        </div>
      </div>`).join('');

    const html = `
      <div style="min-width:420px;max-width:560px;">
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">
          ${_escI(produit.nom)}
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">
          Sélectionnez les attributs pour choisir la variante
        </div>
        ${selectsHtml}
        <!-- Description live -->
        <div id="vp-desc" style="margin-top:14px;padding:10px 14px;border-radius:8px;
          background:var(--bg-elevated);border:1px solid var(--border);
          font-size:13px;color:var(--text-muted);min-height:36px;
          display:flex;align-items:center;gap:8px;">
          <span style="opacity:.5;">Sélectionnez les attributs…</span>
        </div>
        <div id="vp-no-match" style="margin-top:8px;font-size:12px;
          color:var(--accent-red);display:none;">
          Aucune variante ne correspond à cette sélection.
        </div>
      </div>`;

    openModal(html);

    setTimeout(() => {
      const selection = {};
      let matchedVariante = null;

      function findMatch() {
        /* Cherche la variante qui correspond exactement à la sélection courante */
        return variantes.find(v =>
          dynKeys.every(k => !selection[k] || v[k] === selection[k])
        ) || null;
      }

      function updateResult() {
        matchedVariante = findMatch();
        const descEl  = document.getElementById('vp-desc');
        const noMatch = document.getElementById('vp-no-match');
        const allSet  = dynKeys.every(k => selection[k]);
        const chosen  = dynKeys.filter(k => selection[k]);

        /* Mettre à jour la description live */
        if (descEl) {
          if (chosen.length === 0) {
            descEl.innerHTML = '<span style="opacity:.5;">Sélectionnez les attributs…</span>';
          } else if (matchedVariante) {
            const stock = matchedVariante.quantite || 0;
            const prix  = matchedVariante.prix || 0;
            descEl.innerHTML = `
              <span style="font-weight:600;color:var(--text-primary);">
                ${chosen.map(k => `${k}: <strong>${selection[k]}</strong>`).join(' &nbsp;·&nbsp; ')}
              </span>
              ${prix ? `<span style="margin-left:auto;font-family:var(--font-mono);
                font-weight:700;color:var(--accent-blue);white-space:nowrap;">
                ${fmt(prix)}</span>` : ''}
              <span style="font-size:11px;white-space:nowrap;
                color:${stock > 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">
                ${stock} u</span>`;
          } else {
            descEl.innerHTML = `<span style="opacity:.6;">${
              chosen.map(k => `${k}: ${selection[k]}`).join(' · ')
            }</span>`;
          }
        }

        if (allSet && matchedVariante) {
          /* Tous les attributs choisis + variante trouvée → validation automatique */
          const parts = chosen.map(k => `${k}: ${selection[k]}`);
          if (matchedVariante.ref) parts.push(`Réf: ${matchedVariante.ref}`);
          closeModal();
          if (typeof onSelect === 'function') onSelect(matchedVariante, parts.join(' — '));
        } else if (allSet) {
          if (noMatch) noMatch.style.display = 'block';
        } else {
          if (noMatch) noMatch.style.display = 'none';
        }
      }

      /* Clic sur un bouton attribut */
      document.querySelectorAll('.vp-attr-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const attr = btn.dataset.attr;
          const val  = btn.dataset.val;
          selection[attr] = selection[attr] === val ? '' : val;

          /* Mettre à jour l'apparence des boutons du groupe */
          document.querySelectorAll(`.vp-attr-btn[data-attr="${attr}"]`).forEach(b => {
            const active = b.dataset.val === selection[attr];
            b.style.background   = active ? 'var(--accent-blue)' : 'var(--bg-elevated)';
            b.style.color        = active ? '#fff' : 'var(--text-primary)';
            b.style.borderColor  = active ? 'var(--accent-blue)' : 'var(--border)';
            b.style.fontWeight   = active ? '700' : '400';
          });
          updateResult();
        });
      });

    }, 50);
  }

  /* ================================================================
     IMPORT / EXPORT PRODUITS
     ================================================================ */

  const _IMPORT_FIELDS = [
    { key: 'nom',         label: 'Nom produit',   required: true },
    { key: 'categorie',   label: 'Catégorie' },
    { key: 'prix',        label: 'Prix vente (XPF)' },
    { key: 'cout',        label: 'Coût achat (XPF)' },
    { key: 'stock',       label: 'Stock initial' },
    { key: 'unite',       label: 'Unité' },
    { key: 'description', label: 'Description' },
    { key: 'ref',         label: 'Référence / SKU' },
    { key: 'emoji',       label: 'Emoji' },
  ];

  const _IMPORT_ALIASES = {
    nom:         ['nom', 'name', 'produit', 'article', 'libelle', 'designation', 'désignation'],
    categorie:   ['categorie', 'catégorie', 'category', 'cat', 'famille', 'type'],
    prix:        ['prix', 'price', 'prix vente', 'pv', 'tarif', 'prix_vente'],
    cout:        ['cout', 'coût', 'cost', 'prix achat', 'pa', 'prix_achat', 'achat'],
    stock:       ['stock', 'quantite', 'quantité', 'qty', 'qte', 'inventaire'],
    unite:       ['unite', 'unité', 'unit', 'uom', 'mesure'],
    description: ['description', 'desc', 'details', 'détails', 'notes', 'commentaire'],
    ref:         ['ref', 'référence', 'reference', 'sku', 'code', 'code_article'],
    emoji:       ['emoji', 'icone', 'icône', 'icon'],
  };

  function _autoMapColumns(headers) {
    const map = {};
    headers.forEach(h => {
      const hn = h.toLowerCase().trim();
      for (const [field, aliases] of Object.entries(_IMPORT_ALIASES)) {
        if (!map[field] && aliases.some(a => hn === a || hn.includes(a))) {
          map[field] = h;
        }
      }
    });
    return map;
  }

  function _openImportModal(toolbar, area) {
    let _importData    = [];
    let _importHeaders = [];
    let _mapping       = {};

    const overlay = document.getElementById('modal-container');
    const box     = document.getElementById('modal-box');
    if (!overlay || !box) return;
    box.className        = 'modal-box modal-lg';
    overlay.style.display = 'flex';

    /* ---- Étape 1 : Upload ---- */
    function renderStep1() {
      const content = document.getElementById('modal-content');
      if (!content) return;
      content.innerHTML = `
        <div class="modal-title">📥 Importer des produits</div>
        <div class="modal-body-content">
          <div style="text-align:center;padding:24px 0 16px;">
            <div id="import-drop-zone" style="border:2px dashed var(--border);border-radius:12px;
              padding:36px 24px;cursor:pointer;transition:border-color .15s;background:var(--bg-muted);">
              <div style="font-size:2.5rem;margin-bottom:10px;">📂</div>
              <div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:6px;">
                Glissez un fichier ici
              </div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
                ou cliquez pour sélectionner — <strong>CSV</strong> ou <strong>Excel (.xlsx, .xls)</strong>
              </div>
              <button class="btn btn-ghost btn-sm" id="btn-import-browse">Parcourir…</button>
              <input type="file" id="import-file-input" accept=".csv,.xlsx,.xls" style="display:none;" />
            </div>
            <div style="margin-top:14px;font-size:12px;color:var(--text-muted);">
              Colonnes reconnues automatiquement : nom, catégorie, prix, coût, stock, unité, description, référence
            </div>
            <a href="#" id="btn-dl-template"
              style="font-size:12px;color:var(--accent-blue);text-decoration:none;
                margin-top:8px;display:inline-block;">
              ⬇ Télécharger le modèle CSV
            </a>
          </div>
        </div>`;

      const drop  = document.getElementById('import-drop-zone');
      const input = document.getElementById('import-file-input');

      document.getElementById('btn-import-browse')?.addEventListener('click', () => input?.click());
      drop?.addEventListener('click', e => { if (e.target.id !== 'btn-import-browse') input?.click(); });
      drop?.addEventListener('dragover', e => { e.preventDefault(); drop.style.borderColor = 'var(--accent-blue)'; });
      drop?.addEventListener('dragleave', () => { drop.style.borderColor = 'var(--border)'; });
      drop?.addEventListener('drop', e => {
        e.preventDefault(); drop.style.borderColor = 'var(--border)';
        const f = e.dataTransfer?.files?.[0]; if (f) parseFile(f);
      });
      input?.addEventListener('change', () => { if (input.files?.[0]) parseFile(input.files[0]); });
      document.getElementById('btn-dl-template')?.addEventListener('click', e => {
        e.preventDefault(); _downloadImportTemplate();
      });
    }

    /* ---- Parse ---- */
    function parseFile(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      const reader = new FileReader();
      if (ext === 'csv') {
        reader.onload = e => parseCSV(e.target.result);
        reader.readAsText(file, 'UTF-8');
      } else if (['xlsx', 'xls'].includes(ext)) {
        reader.onload = e => parseXLSX(e.target.result);
        reader.readAsArrayBuffer(file);
      } else {
        if (typeof toast === 'function') toast('Format non supporté (.csv, .xlsx, .xls uniquement).', 'error');
      }
    }

    function parseCSV(text) {
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // BOM
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { if (typeof toast === 'function') toast('Fichier vide ou sans données.', 'error'); return; }
      const parseRow = line => {
        const out = []; let cur = '', inQ = false;
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ; }
          else if ((ch === ',' || ch === ';') && !inQ) { out.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        out.push(cur.trim()); return out;
      };
      const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, ''));
      const rows = lines.slice(1).map(l => {
        const vals = parseRow(l);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (vals[i] || '').replace(/^"|"$/g, ''); });
        return obj;
      }).filter(r => Object.values(r).some(v => v));
      _importHeaders = headers; _importData = rows;
      _mapping = _autoMapColumns(headers);
      renderStep2();
    }

    function parseXLSX(buffer) {
      if (typeof XLSX === 'undefined') {
        if (typeof toast === 'function') toast('Librairie XLSX non chargée. Rechargez la page.', 'error');
        return;
      }
      const wb   = XLSX.read(buffer, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rows.length) { if (typeof toast === 'function') toast('Feuille Excel vide.', 'error'); return; }
      _importHeaders = Object.keys(rows[0]);
      _importData    = rows;
      _mapping       = _autoMapColumns(_importHeaders);
      renderStep2();
    }

    /* ---- Étape 2 : Mapping + Aperçu ---- */
    function renderStep2() {
      const content = document.getElementById('modal-content');
      if (!content) return;

      const mappingRows = _IMPORT_FIELDS.map(f => `
        <tr>
          <td style="padding:6px 10px;font-size:13px;color:var(--text-primary);
            font-weight:${f.required ? '600' : '400'};">
            ${_escI(f.label)}${f.required ? ' <span style="color:var(--accent-red)">*</span>' : ''}
          </td>
          <td style="padding:6px 10px;">
            <select class="form-control" data-map="${_escI(f.key)}"
              style="width:100%;font-size:12px;padding:4px 6px;">
              <option value="">— Ignorer —</option>
              ${_importHeaders.map(h =>
                `<option value="${_escI(h)}" ${_mapping[f.key] === h ? 'selected' : ''}>${_escI(h)}</option>`
              ).join('')}
            </select>
          </td>
        </tr>`).join('');

      const previewCols = _importHeaders.slice(0, 8);
      const previewRows = _importData.slice(0, 6).map(row => `
        <tr>${previewCols.map(h =>
          `<td style="padding:3px 8px;font-size:11px;max-width:110px;overflow:hidden;
            text-overflow:ellipsis;white-space:nowrap;border-bottom:1px solid var(--border);">
            ${_escI(String(row[h] || ''))}</td>`
        ).join('')}</tr>`).join('');

      content.innerHTML = `
        <div class="modal-title">📥 Importer des produits — Correspondance des colonnes</div>
        <div class="modal-body-content">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;">

            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                color:var(--text-muted);margin-bottom:10px;">Champs ERP → Colonne fichier</div>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="padding:5px 10px;font-size:11px;text-align:left;color:var(--text-muted);
                      border-bottom:1px solid var(--border);">Champ ERP</th>
                    <th style="padding:5px 10px;font-size:11px;text-align:left;color:var(--text-muted);
                      border-bottom:1px solid var(--border);">Colonne du fichier</th>
                  </tr>
                </thead>
                <tbody>${mappingRows}</tbody>
              </table>
            </div>

            <div>
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                color:var(--text-muted);margin-bottom:10px;">
                Aperçu — <strong>${_importData.length}</strong> ligne${_importData.length > 1 ? 's' : ''} détectée${_importData.length > 1 ? 's' : ''}
              </div>
              <div style="overflow-x:auto;max-height:240px;overflow-y:auto;
                border:1px solid var(--border);border-radius:8px;">
                <table style="width:100%;border-collapse:collapse;">
                  <thead>
                    <tr style="background:var(--bg-muted);">
                      ${previewCols.map(h =>
                        `<th style="padding:4px 8px;font-size:10px;white-space:nowrap;
                          text-align:left;color:var(--text-muted);">${_escI(h)}</th>`
                      ).join('')}
                    </tr>
                  </thead>
                  <tbody>${previewRows}</tbody>
                </table>
              </div>
              ${_importData.length > 6
                ? `<div style="font-size:11px;color:var(--text-muted);margin-top:5px;">… et ${_importData.length - 6} autre${_importData.length - 6 > 1 ? 's' : ''} ligne${_importData.length - 6 > 1 ? 's' : ''}</div>`
                : ''}
              ${_importHeaders.length > 8
                ? `<div style="font-size:11px;color:var(--text-muted);margin-top:3px;">Aperçu limité à 8 colonnes sur ${_importHeaders.length}</div>`
                : ''}
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="btn-imp-back">← Retour</button>
          <button class="btn btn-primary" id="btn-imp-confirm">
            ✅ Importer ${_importData.length} produit${_importData.length > 1 ? 's' : ''}
          </button>
        </div>`;

      content.querySelectorAll('[data-map]').forEach(sel => {
        sel.addEventListener('change', () => { _mapping[sel.dataset.map] = sel.value; });
      });
      document.getElementById('btn-imp-back')?.addEventListener('click', renderStep1);
      document.getElementById('btn-imp-confirm')?.addEventListener('click', doImport);
    }

    /* ---- Import ---- */
    function doImport() {
      if (!_mapping.nom) {
        if (typeof toast === 'function') toast('La colonne "Nom produit" est obligatoire.', 'error');
        return;
      }
      let created = 0, skipped = 0;
      const errors = [];

      _importData.forEach((row, i) => {
        const nom = String(row[_mapping.nom] || '').trim();
        if (!nom) { skipped++; return; }
        const num = (key) => {
          const raw = _mapping[key] ? String(row[_mapping[key]] || '0').replace(',', '.') : '0';
          return parseFloat(raw) || 0;
        };
        const str = (key) => _mapping[key] ? String(row[_mapping[key]] || '').trim() : '';
        try {
          Store.create('produits', {
            nom,
            categorie:   str('categorie'),
            prix:        num('prix'),
            cout:        num('cout'),
            stock:       Math.round(num('stock')),
            unite:       str('unite') || 'unité',
            description: str('description'),
            ref:         str('ref'),
            emoji:       str('emoji') || '📦',
            status:      'active',
            variantes:   [],
            paliers:     [],
            customAttrs: [],
          });
          created++;
        } catch (e) { errors.push(`Ligne ${i + 2} : ${e.message}`); }
      });

      renderStep3(created, skipped, errors);
    }

    /* ---- Étape 3 : Résultat ---- */
    function renderStep3(created, skipped, errors) {
      const content = document.getElementById('modal-content');
      if (!content) return;
      content.innerHTML = `
        <div class="modal-title">📥 Import terminé</div>
        <div class="modal-body-content" style="text-align:center;padding:24px 0;">
          <div style="font-size:3rem;margin-bottom:12px;">${errors.length ? '⚠️' : '✅'}</div>
          <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:8px;">
            ${created} produit${created > 1 ? 's' : ''} importé${created > 1 ? 's' : ''}
          </div>
          ${skipped > 0
            ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">
                ${skipped} ligne${skipped > 1 ? 's' : ''} ignorée${skipped > 1 ? 's' : ''} (nom vide)</div>`
            : ''}
          ${errors.length
            ? `<div style="margin-top:16px;text-align:left;background:var(--bg-muted);
                border-radius:8px;padding:12px;max-height:140px;overflow-y:auto;">
                ${errors.map(e => `<div style="font-size:12px;color:var(--accent-red);margin-bottom:4px;">• ${_escI(e)}</div>`).join('')}
              </div>`
            : ''}
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="btn-imp-done">Fermer</button>
        </div>`;

      document.getElementById('btn-imp-done')?.addEventListener('click', () => {
        closeModal();
        _renderProductList(toolbar, area);
      });
      if (created > 0 && typeof toast === 'function')
        toast(`${created} produit${created > 1 ? 's' : ''} importé${created > 1 ? 's' : ''} avec succès.`, 'success');
    }

    renderStep1();
  }

  /* ---- Télécharger le modèle CSV (colonnes + 1 exemple) ---- */
  function _downloadImportTemplate() {
    const cols  = _IMPORT_FIELDS.map(f => f.key);
    const label = _IMPORT_FIELDS.map(f => f.label);
    const example = {
      nom: 'T-Shirt Blanc Classic', categorie: 'Vêtements',
      prix: '2500', cout: '800', stock: '50', unite: 'unité',
      description: 'T-shirt 100% coton peigné — disponible toutes tailles',
      ref: 'TSH-001', emoji: '👕'
    };
    const lines = [
      cols.join(','),
      label.map(l => `"${l}"`).join(','),
      cols.map(k => `"${example[k] || ''}"`).join(',')
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'modele-import-produits.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  /* ---- Exporter tous les produits en CSV (avec config complète) ---- */
  function _exportProductsCSV() {
    const produits = Store.getAll('produits');
    if (!produits.length) {
      if (typeof toast === 'function') toast('Aucun produit à exporter.', 'info');
      return;
    }
    const cols = ['nom', 'categorie', 'prix', 'cout', 'stock', 'unite', 'description', 'ref', 'emoji', 'status'];
    const header = cols.join(',');
    const rows = produits.map(p =>
      cols.map(k => {
        const v = p[k] !== undefined ? String(p[k]) : '';
        return v.includes(',') || v.includes('"') || v.includes('\n')
          ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(',')
    );
    const csv  = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `produits-hcs-${date}.csv`;
    a.click(); URL.revokeObjectURL(url);
    if (typeof toast === 'function') toast(`${produits.length} produit${produits.length > 1 ? 's' : ''} exporté${produits.length > 1 ? 's' : ''}.`, 'success');
  }

  /* ================================================================
     API PUBLIQUE
     ================================================================ */
  return { init, showVariantePicker };

})();

window.Inventory = Inventory;
