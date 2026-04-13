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
      <div style="display:flex;gap:4px;margin-left:8px;">
        <button class="btn ${!isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-view-list" title="Vue liste">☰ Liste</button>
        <button class="btn ${isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-view-kanban" title="Vue kanban">⊞ Kanban</button>
      </div>
      <div style="display:flex;gap:4px;margin-left:8px;">
        <button class="btn ${!showArch ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-show-active" title="Produits actifs">✅ Actifs</button>
        <button class="btn ${showArch ? 'btn-warning' : 'btn-ghost'} btn-sm" id="btn-show-archived" title="Produits archivés">🗄 Archivés</button>
      </div>`;

    toolbar.querySelector('#btn-new-product').addEventListener('click', () => {
      _state.mode       = 'form';
      _state.currentId  = null;
      _pendingImage     = null;
      _currentVariantes = [];
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
          render: (row) => {
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
                    ${row.ref ? 'Réf: ' + _escI(row.ref) + ' · ' : ''}${_escI(row.sku || '')}
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
          key: 'fournisseur', label: 'Fournisseur', type: 'text', sortable: true,
          render: (r) => r.fournisseur
            ? `<span style="font-size:12px;color:#4B5563;">${_escI(r.fournisseur)}</span>`
            : '<span style="color:#D1D5DB;">—</span>'
        },
        { key: 'categorie', label: 'Catégorie',   type: 'text',  sortable: true },
        { key: 'prix',      label: 'Prix vente',  type: 'money', render: (r) => fmt(r.prix || 0), sortable: true },
        { key: 'cout',      label: 'Coût',        type: 'money', render: (r) => fmt(r.cout || 0) },
        {
          key: 'stock', label: 'Stock', type: 'text', sortable: true,
          render: (row) => {
            const s    = row.stock    || 0;
            const sMin = row.stockMin || 0;
            const color = s === 0 ? 'var(--accent-red)'
              : s <= sMin ? 'var(--accent-orange)'
              : 'var(--accent-green)';
            return `<span style="font-family:var(--font-mono);font-weight:700;color:${color};">
              ${s} ${_escI(row.unite || 'u')}
            </span>`;
          }
        },
        {
          key: 'marge', label: 'Marge %', type: 'text',
          render: (row) => {
            if (!row.prix || !row.cout) return '—';
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

  /* ---- Kanban produits ---- */
  function _renderProductKanban(produits, area) {
    /* Grouper par catégorie */
    const cats = {};
    produits.forEach(p => {
      const cat = p.categorie || '(Non classé)';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(p);
    });

    let html = `<div style="padding:4px 0;">`;

    if (produits.length === 0) {
      html += `<div class="table-empty"><div class="empty-icon">📦</div><p>Aucun produit.</p></div>`;
    } else {
      for (const [cat, items] of Object.entries(cats).sort((a,b) => a[0].localeCompare(b[0]))) {
        html += `
          <div style="margin-bottom:28px;">
            <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
              letter-spacing:0.07em;margin-bottom:12px;padding-left:2px;">
              ${_escI(cat)} <span style="opacity:0.5;">(${items.length})</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(172px,1fr));gap:12px;">
              ${items.map(p => _renderProductCard(p)).join('')}
            </div>
          </div>`;
      }
    }

    html += `</div>`;
    area.innerHTML = html;

    area.querySelectorAll('[data-prod-id]').forEach(card => {
      card.addEventListener('click', () => {
        const produit = Store.getById('produits', card.dataset.prodId);
        if (produit) _openProduct(produit);
      });
    });
  }

  /* Carte produit pour le kanban */
  function _renderProductCard(p) {
    const s     = p.stock    || 0;
    const sMin  = p.stockMin || 0;
    const sColor = s === 0 ? '#ef4444' : s <= sMin ? '#f97316' : '#22c55e';
    const sLabel = s === 0 ? 'Rupture' : s <= sMin ? 'Stock bas' : 'En stock';

    const imgHtml = p.image
      ? `<img src="${p.image}" style="width:100%;height:90px;object-fit:cover;" />`
      : `<div style="height:90px;display:flex;align-items:center;justify-content:center;
          font-size:2.4rem;background:var(--bg-elevated);">${p.emoji || '📦'}</div>`;

    return `
      <div data-prod-id="${p.id}" style="
          background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;
          cursor:pointer;overflow:hidden;transition:box-shadow 0.2s,transform 0.15s;"
        onmouseenter="this.style.boxShadow='0 4px 20px rgba(0,0,0,0.35)';this.style.transform='translateY(-2px)'"
        onmouseleave="this.style.boxShadow='none';this.style.transform='none'">
        ${imgHtml}
        <div style="padding:10px 12px;">
          <div style="font-weight:600;font-size:13px;color:var(--text-primary);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
            title="${_escI(p.nom)}">${_escI(p.nom)}</div>
          ${p.ref ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px;">Réf: ${_escI(p.ref)}</div>` : ''}
          ${p.variantes && p.variantes.length > 0
            ? `<div style="font-size:10px;color:var(--accent-blue);margin-top:2px;">
                ${p.variantes.length} variante${p.variantes.length > 1 ? 's' : ''}
              </div>` : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;gap:4px;">
            <span style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:${sColor};
              background:${sColor}18;border-radius:4px;padding:2px 6px;">
              ${s} ${_escI(p.unite || 'u')}
            </span>
            <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary);">
              ${typeof fmt === 'function' ? fmt(p.prix || 0) : (p.prix || 0) + ' XPF'}
            </span>
          </div>
        </div>
      </div>`;
  }

  /* Ouvrir produit en mode formulaire */
  function _openProduct(produit) {
    _state.mode      = 'form';
    _state.currentId = produit ? produit.id : null;
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
      _state.mode        = 'list';
      _pendingImage      = null;
      _currentVariantes  = [];
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
       Organisés en 2 colonnes — ajout : ref, fournisseur,
       coupe, tailles, couleurs, quantitesVariantes
       --------------------------------------------------------------- */
    const fields = [
      /* Identification */
      { name: 'emoji',    label: 'Emoji',             type: 'text',    cols: 1 },
      { name: 'nom',      label: 'Nom *',              type: 'text',    required: true, cols: 2 },
      { name: 'ref',      label: 'Référence article',  type: 'text',    cols: 1 },
      { name: 'sku',      label: 'SKU interne',        type: 'text',    cols: 1 },

      /* Classification */
      {
        name: 'categorie', label: 'Catégorie', type: 'select', cols: 1,
        options: [{ value: '', label: '— Sélectionner —' }, ...catOptions]
      },
      {
        name: 'fournisseur', label: 'Fournisseur (éventuel)', type: 'select', cols: 1,
        options: [{ value: '', label: '— Aucun —' }, ...fournOptions]
      },

      /* Tarif & stock (le stock est calculé auto si des variantes existent) */
      { name: 'unite',    label: 'Unité',              type: 'text',    cols: 1 },
      { name: 'prix',     label: 'Prix de vente HT',   type: 'money',   cols: 1 },
      { name: 'cout',     label: 'Coût de revient',    type: 'money',   cols: 1 },
      { name: 'stock',    label: 'Stock actuel',       type: 'number',  cols: 1 },
      { name: 'stockMin', label: 'Stock minimum',      type: 'number',  cols: 1 },
      {
        name: 'status', label: 'Statut', type: 'select', cols: 1,
        options: [
          { value: 'active',   label: '✅ Actif' },
          { value: 'archived', label: '🗄 Archivé' }
        ]
      },
      { name: 'description', label: 'Description',     type: 'textarea',cols: 2 }
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

        <div id="product-form-container"></div>

        <!-- Section variantes dynamique -->
        <div id="variantes-section" style="margin-top:8px;"></div>

        <!-- Section paliers de prix (tarification dégressive) -->
        <div id="paliers-section" style="margin-top:8px;"></div>
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

    /* Rendre la section variantes */
    _renderVariantesSection(produit);

    /* Rendre la section paliers de prix */
    _renderPaliersSection(produit);

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
      panel.style.cssText = `
        background:var(--bg-surface);border:1px solid var(--border);
        border-radius:10px;padding:16px 20px;margin-bottom:16px;
        display:grid;grid-template-columns:repeat(4,1fr);gap:16px;
      `;
      panel.innerHTML = `
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Prix vente</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);" id="mp-prix">${prix > 0 ? prix.toLocaleString('fr-FR') + ' XPF' : '—'}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Coût de revient</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);" id="mp-cout">${cout > 0 ? cout.toLocaleString('fr-FR') + ' XPF' : '—'}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Marge</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:${margeColor};" id="mp-marge">${prix > 0 && cout > 0 ? margePct + '%' : '—'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px;" id="mp-marge-val">${prix > 0 && cout > 0 ? marge.toLocaleString('fr-FR') + ' XPF' : ''}</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Prix conseillé (40%)</div>
          <div style="font-size:18px;font-weight:700;font-family:var(--font-mono);color:var(--accent-blue);" id="mp-conseille">${prixConseille > 0 ? prixConseille.toLocaleString('fr-FR') + ' XPF' : '—'}</div>
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

      /* Live update quand prix ou cout change */
      function _updateMarginPanel() {
        const p = parseFloat(document.querySelector('[name="prix"]')?.value) || 0;
        const c = parseFloat(document.querySelector('[name="cout"]')?.value) || 0;
        const m = p - c;
        const mpct = p > 0 ? Math.round((m / p) * 100) : 0;
        const mc = p > 0 ? (mpct >= 40 ? '#16A34A' : mpct >= 20 ? '#D97706' : '#DC2626') : '#9CA3AF';
        const cons = c > 0 ? Math.ceil(c / 0.60 / 10) * 10 : 0;
        const mp   = document.getElementById('mp-prix');
        const mpc  = document.getElementById('mp-cout');
        const mpm  = document.getElementById('mp-marge');
        const mpmv = document.getElementById('mp-marge-val');
        const mps  = document.getElementById('mp-conseille');
        if (mp)  mp.textContent  = p > 0 ? p.toLocaleString('fr-FR') + ' XPF' : '—';
        if (mpc) mpc.textContent = c > 0 ? c.toLocaleString('fr-FR') + ' XPF' : '—';
        if (mpm) { mpm.textContent = p > 0 && c > 0 ? mpct + '%' : '—'; mpm.style.color = mc; }
        if (mpmv) mpmv.textContent = p > 0 && c > 0 ? m.toLocaleString('fr-FR') + ' XPF' : '';
        if (mps) mps.textContent = cons > 0 ? cons.toLocaleString('fr-FR') + ' XPF' : '—';
      }

      document.querySelector('[name="prix"]')?.addEventListener('input', _updateMarginPanel);
      document.querySelector('[name="cout"]')?.addEventListener('input', _updateMarginPanel);
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

  /* Sauvegarde produit */
  function _saveProduct(produitExist) {
    const data = getFormData('product-form');
    if (!data) return;

    /* Convertir les champs numériques */
    data.prix     = parseFloat(data.prix)     || 0;
    data.cout     = parseFloat(data.cout)     || 0;
    data.stock    = parseFloat(data.stock)    || 0;
    data.stockMin = parseFloat(data.stockMin) || 0;

    /* Image en attente */
    if (_pendingImage !== null) {
      data.image = _pendingImage;
    }

    /* Lire les variantes depuis le tableau éditable */
    const variantesMAJ = _collectVariantesFromDOM();
    data.variantes = variantesMAJ;

    /* Lire les paliers de prix (tarification dégressive) */
    data.paliers = _collectPaliersFromDOM();

    /* Stock = somme des quantités variantes si variantes existent, sinon stock saisi */
    if (variantesMAJ.length > 0) {
      data.stock = variantesMAJ.reduce((s, v) => s + (parseInt(v.quantite) || 0), 0);
    }

    /* Reconstruire les attributs depuis les variantes */
    if (variantesMAJ.length > 0) {
      data.tailles  = [...new Set(variantesMAJ.map(v => v.taille).filter(Boolean))].join(', ');
      data.couleurs = [...new Set(variantesMAJ.map(v => v.couleur).filter(Boolean))].join(', ');
      data.coupe    = [...new Set(variantesMAJ.map(v => v.coupe).filter(Boolean))].join(', ');
    }

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
  function _renderVariantesSection(produit) {
    const sec = document.getElementById('variantes-section');
    if (!sec) return;

    /* Valeurs actuelles des attributs (depuis variantes existantes ou produit) */
    const tDefaut  = produit.tailles  || '';
    const cDefaut  = produit.couleurs || '';
    const coDefaut = produit.coupe    || '';

    sec.innerHTML = `
      <div style="background:var(--bg-surface);border:1px solid var(--border);
        border-radius:12px;padding:20px;margin-bottom:24px;">

        <!-- En-tête -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--text-primary);">
              Variantes de l'article
              <span id="var-count-badge" style="font-size:12px;color:var(--text-muted);
                font-weight:400;margin-left:6px;">
                (${_currentVariantes.length} variante${_currentVariantes.length !== 1 ? 's' : ''})
              </span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
              Définissez les attributs puis cliquez sur "Générer" pour créer toutes les combinaisons.
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" id="btn-var-clear-all"
            style="color:var(--accent-red);font-size:11px;">
            ✕ Tout effacer
          </button>
        </div>

        <!-- Générateur d'attributs -->
        <div style="background:var(--bg-elevated);border-radius:10px;padding:14px;margin-bottom:16px;">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);
            text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">
            Attributs — séparez les valeurs par des virgules
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
            <div class="form-group" style="margin:0;">
              <label class="form-label">📏 Tailles</label>
              <input type="text" class="form-control" id="var-attr-tailles"
                value="${_escI(tDefaut)}"
                placeholder="S, M, L, XL, XXL" />
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">🎨 Couleurs</label>
              <input type="text" class="form-control" id="var-attr-couleurs"
                value="${_escI(cDefaut)}"
                placeholder="Blanc, Noir, Rouge" />
            </div>
            <div class="form-group" style="margin:0;">
              <label class="form-label">✂ Coupe / Style</label>
              <input type="text" class="form-control" id="var-attr-coupe"
                value="${_escI(coDefaut)}"
                placeholder="Regular, Slim, Loose" />
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <button class="btn btn-primary btn-sm" id="btn-var-generate">
              ⚡ Générer les variantes
            </button>
            <button class="btn btn-ghost btn-sm" id="btn-var-add-manual">
              + Ajouter manuellement
            </button>
            <span style="font-size:11px;color:var(--text-muted);margin-left:4px;" id="var-gen-preview"></span>
          </div>
        </div>

        <!-- Tableau éditable des variantes -->
        <div id="variantes-table-wrap">
          ${_renderVariantesTable()}
        </div>
      </div>`;

    _bindVariantesEvents(produit);
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
        Aucune variante. Utilisez le générateur ou ajoutez manuellement.
      </div>`;
    }

    const rows = _currentVariantes.map((v, i) => `
      <tr data-var-idx="${i}">
        <td><input type="text" class="line-input" data-var-field="taille" data-var-i="${i}"
          value="${_escI(v.taille || '')}" placeholder="S" style="width:60px;" /></td>
        <td><input type="text" class="line-input" data-var-field="couleur" data-var-i="${i}"
          value="${_escI(v.couleur || '')}" placeholder="Blanc" style="width:80px;" /></td>
        <td><input type="text" class="line-input" data-var-field="coupe" data-var-i="${i}"
          value="${_escI(v.coupe || '')}" placeholder="Regular" style="width:80px;" /></td>
        <td><input type="text" class="line-input" data-var-field="ref" data-var-i="${i}"
          value="${_escI(v.ref || '')}" placeholder="SKU-001" style="width:90px;" /></td>
        <td><input type="number" class="line-input num-input" data-var-field="prix" data-var-i="${i}"
          value="${v.prix || ''}" placeholder="0" min="0" step="1" style="width:80px;" /></td>
        <td><input type="number" class="line-input num-input" data-var-field="cout" data-var-i="${i}"
          value="${v.cout || ''}" placeholder="0" min="0" step="1" style="width:80px;" /></td>
        <td><input type="number" class="line-input num-input" data-var-field="quantite" data-var-i="${i}"
          value="${v.quantite || 0}" min="0" step="1" style="width:60px;" /></td>
        <td style="text-align:center;">
          <button class="btn-remove-line" data-var-del="${i}" title="Supprimer cette variante">✕</button>
        </td>
      </tr>`).join('');

    /* Total stock */
    const totalQte = _currentVariantes.reduce((s, v) => s + (parseInt(v.quantite) || 0), 0);

    return `
      <div class="table-wrapper">
        <table class="data-table" style="font-size:12px;">
          <thead>
            <tr>
              <th style="width:70px;">Taille</th>
              <th style="width:90px;">Couleur</th>
              <th style="width:90px;">Coupe</th>
              <th style="width:100px;">Réf / SKU</th>
              <th style="width:90px;text-align:right;">Prix HT (XPF)</th>
              <th style="width:90px;text-align:right;">Coût (XPF)</th>
              <th style="width:70px;text-align:right;">Qté</th>
              <th style="width:36px;"></th>
            </tr>
          </thead>
          <tbody id="var-tbody">
            ${rows}
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--border);">
              <td colspan="6" style="text-align:right;font-size:12px;
                color:var(--text-muted);padding:8px 12px;">
                Stock total calculé :
              </td>
              <td style="font-family:var(--font-mono);font-weight:700;
                color:var(--accent-green);padding:8px 6px;">
                ${totalQte}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  /** Lie tous les événements de la section variantes */
  function _bindVariantesEvents(produit) {
    /* Aperçu du nombre de combinaisons à générer */
    const _updateGenPreview = () => {
      const t  = _splitAttr(document.getElementById('var-attr-tailles')?.value);
      const c  = _splitAttr(document.getElementById('var-attr-couleurs')?.value);
      const co = _splitAttr(document.getElementById('var-attr-coupe')?.value);
      const n  = Math.max(t.length, 1) * Math.max(c.length, 1) * Math.max(co.length, 1);
      const prev = document.getElementById('var-gen-preview');
      if (prev) prev.textContent = n > 1 ? `→ ${n} combinaison${n > 1 ? 's' : ''}` : '';
    };
    ['var-attr-tailles', 'var-attr-couleurs', 'var-attr-coupe'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', _updateGenPreview);
    });
    _updateGenPreview();

    /* Générer les combinaisons */
    document.getElementById('btn-var-generate')?.addEventListener('click', () => {
      const tailles  = _splitAttr(document.getElementById('var-attr-tailles')?.value);
      const couleurs = _splitAttr(document.getElementById('var-attr-couleurs')?.value);
      const coupes   = _splitAttr(document.getElementById('var-attr-coupe')?.value);

      const tList  = tailles.length  ? tailles  : [''];
      const cList  = couleurs.length ? couleurs : [''];
      const coList = coupes.length   ? coupes   : [''];

      /* Prix et coût par défaut depuis le formulaire principal */
      const prixDefaut = parseFloat(document.getElementById('product-form')
        ?.querySelector('[name="prix"]')?.value) || 0;
      const coutDefaut = parseFloat(document.getElementById('product-form')
        ?.querySelector('[name="cout"]')?.value) || 0;

      /* Générer toutes les combinaisons, dédupliquer avec l'existant */
      const existingKeys = new Set(_currentVariantes.map(v =>
        `${v.taille}|${v.couleur}|${v.coupe}`
      ));

      let ajouts = 0;
      tList.forEach(t => {
        cList.forEach(c => {
          coList.forEach(co => {
            const key = `${t}|${c}|${co}`;
            if (!existingKeys.has(key)) {
              _currentVariantes.push({
                taille:   t,
                couleur:  c,
                coupe:    co,
                ref:      '',
                prix:     prixDefaut,
                cout:     coutDefaut,
                quantite: 0
              });
              existingKeys.add(key);
              ajouts++;
            }
          });
        });
      });

      _refreshVariantesTable();
      if (ajouts > 0) {
        if (typeof toast === 'function') toast(`${ajouts} variante${ajouts > 1 ? 's' : ''} ajoutée${ajouts > 1 ? 's' : ''}.`, 'success');
      } else {
        if (typeof toast === 'function') toast('Toutes ces combinaisons existent déjà.', 'info');
      }
    });

    /* Ajouter manuellement une ligne vide */
    document.getElementById('btn-var-add-manual')?.addEventListener('click', () => {
      _currentVariantes.push({ taille: '', couleur: '', coupe: '', ref: '', prix: 0, cout: 0, quantite: 0 });
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
        _currentVariantes[i][f] = numFields.includes(f)
          ? parseInt(inp.value) || 0
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
     API PUBLIQUE
     ================================================================ */
  return { init };

})();

window.Inventory = Inventory;
