/* ================================================================
   HCS ERP â js/modules/inventory-ux.js
   Patch additif UX pour la fiche article â v1.3.0
   
   CE QUE CE FICHIER FAIT :
   - Ajoute une navigation par onglets dans la fiche article
     (GÃ©nÃ©ral / Prix & TVA / Stock / Variantes / ComptabilitÃ© / Historique)
   - RÃ©partit les champs existants dans les onglets sans toucher au code
   - Ajoute un rÃ©sumÃ© sticky en haut (nom + image + prix + stock)
   - Synchronise automatiquement Prix HT â Prix TTC (bug #6)
   - Ajoute un bouton "Dupliquer ce produit" dans la liste
   - Ajoute filtres rapides dans la liste (type, catÃ©gorie, stock bas)
   
   USAGE : charger APRÃS inventory.js dans index.html
     <script src="js/modules/inventory.js?v=..."></script>
     <script src="js/modules/inventory-ux.js?v=2026042001"></script>
   
   Aucune modification de inventory.js n'est nÃ©cessaire.
   ================================================================ */

'use strict';

(function() {

  if (typeof window.Inventory === 'undefined') {
    console.warn('[InventoryUX] Inventory non chargÃ© â patch ignorÃ©');
    return;
  }

  /* ================================================================
     1. INJECTION CSS
     ================================================================ */
  function _injectStyles() {
    if (document.getElementById('inventory-ux-styles')) return;
    const style = document.createElement('style');
    style.id = 'inventory-ux-styles';
    style.textContent = `
      /* ===== Sticky header produit ===== */
      .prod-sticky-header {
        position: sticky;
        top: 0;
        z-index: 10;
        background: var(--bg-base);
        border-bottom: 1px solid var(--border);
        padding: 12px 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        margin: -20px -20px 0 -20px;
      }
      .prod-sticky-header .ph-img {
        width: 56px;
        height: 56px;
        border-radius: 8px;
        overflow: hidden;
        flex-shrink: 0;
        background: var(--bg-elevated);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 2rem;
        border: 1px solid var(--border);
      }
      .prod-sticky-header .ph-img img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .prod-sticky-header .ph-info {
        flex: 1;
        min-width: 0;
      }
      .prod-sticky-header .ph-name {
        font-size: 16px;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
        line-height: 1.2;
      }
      .prod-sticky-header .ph-ref {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 2px;
      }
      .prod-sticky-header .ph-stats {
        display: flex;
        gap: 16px;
        font-family: var(--font-mono, monospace);
        font-size: 13px;
        flex-shrink: 0;
      }
      .prod-sticky-header .ph-stat {
        text-align: right;
      }
      .prod-sticky-header .ph-stat-label {
        font-size: 10px;
        text-transform: uppercase;
        color: var(--text-muted);
        font-weight: 600;
        letter-spacing: 0.05em;
      }
      .prod-sticky-header .ph-stat-value {
        font-size: 15px;
        font-weight: 700;
        color: var(--text-primary);
      }
      .prod-sticky-header .ph-stat-value.low {
        color: var(--accent-orange);
      }
      .prod-sticky-header .ph-stat-value.zero {
        color: var(--accent-red);
      }

      /* ===== Onglets fiche produit ===== */
      .prod-tabs {
        display: flex;
        gap: 2px;
        margin: 20px -20px 0 -20px;
        padding: 0 20px;
        border-bottom: 1px solid var(--border);
        overflow-x: auto;
        scrollbar-width: none;
      }
      .prod-tabs::-webkit-scrollbar { display: none; }
      
      .prod-tab {
        padding: 10px 18px;
        cursor: pointer;
        border: none;
        background: transparent;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-secondary);
        border-bottom: 2px solid transparent;
        transition: all 0.15s;
        white-space: nowrap;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: inherit;
      }
      .prod-tab:hover {
        color: var(--text-primary);
        background: var(--bg-elevated);
      }
      .prod-tab.active {
        color: var(--accent-blue, #4a5fff);
        border-bottom-color: var(--accent-blue, #4a5fff);
        font-weight: 600;
      }
      .prod-tab-badge {
        background: var(--bg-elevated);
        color: var(--text-muted);
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 10px;
        font-weight: 600;
      }
      .prod-tab.active .prod-tab-badge {
        background: var(--accent-blue, #4a5fff);
        color: white;
      }

      /* ===== Contenu des onglets ===== */
      .prod-tab-content {
        display: none;
        padding: 20px 0;
        animation: prod-tab-fade 0.2s ease;
      }
      .prod-tab-content.active {
        display: block;
      }
      @keyframes prod-tab-fade {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* ===== Filtres rapides liste articles ===== */
      .prod-filters {
        display: flex;
        gap: 8px;
        padding: 12px 0;
        flex-wrap: wrap;
        align-items: center;
      }
      .prod-filter-label {
        font-size: 12px;
        color: var(--text-muted);
        margin-right: 4px;
      }
      .prod-filter-chip {
        padding: 4px 12px;
        border-radius: 14px;
        border: 1px solid var(--border);
        background: var(--bg-surface);
        cursor: pointer;
        font-size: 12px;
        color: var(--text-secondary);
        transition: all 0.15s;
      }
      .prod-filter-chip:hover {
        border-color: var(--accent-blue, #4a5fff);
        color: var(--accent-blue, #4a5fff);
      }
      .prod-filter-chip.active {
        background: var(--accent-blue, #4a5fff);
        color: white;
        border-color: transparent;
      }
      .prod-filter-chip-count {
        background: rgba(255,255,255,0.2);
        padding: 0 6px;
        border-radius: 8px;
        margin-left: 4px;
        font-size: 10px;
        font-weight: 600;
      }
      .prod-filter-chip:not(.active) .prod-filter-chip-count {
        background: var(--bg-elevated);
        color: var(--text-muted);
      }

      /* ===== Historique timeline ===== */
      .prod-timeline {
        padding: 8px 0;
      }
      .prod-timeline-item {
        display: flex;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid var(--border);
      }
      .prod-timeline-item:last-child { border-bottom: none; }
      .prod-timeline-icon {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        font-size: 14px;
      }
      .prod-timeline-body {
        flex: 1;
      }
      .prod-timeline-title {
        font-weight: 500;
        color: var(--text-primary);
        font-size: 13px;
      }
      .prod-timeline-meta {
        font-size: 11px;
        color: var(--text-muted);
        margin-top: 2px;
      }
      .prod-timeline-amount {
        font-family: var(--font-mono, monospace);
        font-weight: 600;
        color: var(--accent-green);
      }

      /* ===== RÃ©sumÃ© variantes / paliers ===== */
      .prod-summary-box {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 12px;
        display: flex;
        gap: 12px;
        align-items: center;
        font-size: 13px;
      }
      .prod-summary-box.warn {
        background: rgba(255, 200, 87, 0.1);
        border-color: #ffc857;
      }
    `;
    document.head.appendChild(style);
  }

  /* ================================================================
     2. DÃTECTER L'OUVERTURE DU FORMULAIRE PRODUIT
     On observe le DOM et on injecte les onglets quand la fiche apparaÃ®t.
     ================================================================ */
  function enhanceProductForm() {
    const formContainer = document.getElementById('product-form-container');
    if (!formContainer || formContainer.dataset.tabsEnhanced) return;
    formContainer.dataset.tabsEnhanced = '1';

    const area = formContainer.closest('.view-content, #view-content') ||
                 formContainer.parentElement;
    if (!area) return;

    /* RÃ©cupÃ©rer les sections existantes */
    const variationsSections = document.getElementById('variations-sections');
    const paliersSection     = document.getElementById('paliers-section');
    const imageSection       = formContainer.previousElementSibling; // section image
    const toggleSection      = imageSection?.nextElementSibling; // toggle simple/variable

    if (!variationsSections || !paliersSection) return;

    /* RÃ©cupÃ©rer les infos produit pour le sticky header */
    const nom = document.querySelector('[data-field-key="nom"]')?.value || 
                document.querySelector('[data-field-key="nom"]')?.getAttribute('value') || '';
    const ref = document.querySelector('[data-field-key="ref"]')?.value || '';
    const prix = parseFloat(document.querySelector('[data-field-key="prix"]')?.value) || 0;
    const stockMag = parseFloat(document.querySelector('[data-field-key="stockMagasin"]')?.value) || 0;
    const stockFour = parseFloat(document.querySelector('[data-field-key="stockFournisseur"]')?.value) || 0;
    const stockTotal = stockMag + stockFour;
    const stockMin = parseFloat(document.querySelector('[data-field-key="stockMin"]')?.value) || 0;
    const imgPreview = document.querySelector('#img-preview-wrap');
    const imgHtml = imgPreview ? imgPreview.innerHTML : 'ð¦';

    /* CrÃ©er le sticky header */
    const sticky = document.createElement('div');
    sticky.className = 'prod-sticky-header';
    sticky.id = 'prod-sticky-header';
    sticky.innerHTML = `
      <div class="ph-img" id="ph-img">${imgHtml}</div>
      <div class="ph-info">
        <h2 class="ph-name" id="ph-name">${_esc(nom || 'Nouveau produit')}</h2>
        <div class="ph-ref" id="ph-ref">${ref ? 'RÃ©f: ' + _esc(ref) : 'Sans rÃ©fÃ©rence'}</div>
      </div>
      <div class="ph-stats">
        <div class="ph-stat">
          <div class="ph-stat-label">Prix HT</div>
          <div class="ph-stat-value" id="ph-prix">${_fmt(prix)}</div>
        </div>
        <div class="ph-stat">
          <div class="ph-stat-label">Stock</div>
          <div class="ph-stat-value ${stockTotal === 0 ? 'zero' : (stockTotal <= stockMin ? 'low' : '')}" id="ph-stock">
            ${stockTotal}
          </div>
        </div>
      </div>
    `;

    /* CrÃ©er les onglets */
    const tabs = document.createElement('div');
    tabs.className = 'prod-tabs';
    tabs.innerHTML = `
      <button class="prod-tab active" data-prod-tab="general">
        ð GÃ©nÃ©ral
      </button>
      <button class="prod-tab" data-prod-tab="pricing">
        ð° Prix & TVA
      </button>
      <button class="prod-tab" data-prod-tab="stock">
        ð¦ Stock
      </button>
      <button class="prod-tab" data-prod-tab="variants">
        â¡ Variantes <span class="prod-tab-badge" id="tab-badge-variants">0</span>
      </button>
      <button class="prod-tab" data-prod-tab="pricing-tiers">
        ð Paliers
      </button>
      <button class="prod-tab" data-prod-tab="accounting">
        ð§¾ ComptabilitÃ©
      </button>
      <button class="prod-tab" data-prod-tab="history">
        ð Historique
      </button>
    `;

    /* CrÃ©er les conteneurs d'onglets */
    const tabGeneral  = _createTab('general', true);
    const tabPricing  = _createTab('pricing');
    const tabStock    = _createTab('stock');
    const tabVariants = _createTab('variants');
    const tabTiers    = _createTab('pricing-tiers');
    const tabAccount  = _createTab('accounting');
    const tabHistory  = _createTab('history');

    /* InsÃ©rer les Ã©lÃ©ments dans l'ordre */
    /* 1. RÃ©cupÃ©rer le parent et le container principal */
    const topDiv = imageSection?.parentNode;
    if (!topDiv) return;

    topDiv.insertBefore(sticky, imageSection);
    topDiv.insertBefore(tabs, imageSection);

    /* 2. RÃ©cupÃ©rer les champs du formulaire actuellement rendus
          et les classer par catÃ©gorie d'onglet */
    _distributeFieldsToTabs({
      formContainer,
      imageSection,
      toggleSection,
      variationsSections,
      paliersSection,
      tabGeneral, tabPricing, tabStock,
      tabVariants, tabTiers, tabAccount, tabHistory
    });

    /* 3. InsÃ©rer les onglets aprÃ¨s */
    topDiv.appendChild(tabGeneral);
    topDiv.appendChild(tabPricing);
    topDiv.appendChild(tabStock);
    topDiv.appendChild(tabVariants);
    topDiv.appendChild(tabTiers);
    topDiv.appendChild(tabAccount);
    topDiv.appendChild(tabHistory);

    /* 4. Gestion du switch d'onglet */
    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-prod-tab]');
      if (!btn) return;
      const tabKey = btn.dataset.prodTab;
      tabs.querySelectorAll('.prod-tab').forEach(t => t.classList.toggle('active', t === btn));
      topDiv.querySelectorAll('.prod-tab-content').forEach(c => {
        c.classList.toggle('active', c.dataset.tabContent === tabKey);
      });
      /* RafraÃ®chir historique Ã  l'ouverture */
      if (tabKey === 'history') _renderHistory(tabHistory);
    });

    /* 5. Compteurs de badges */
    _updateTabBadges();

    /* 6. Synchroniser sticky header avec les champs */
    _bindStickyHeaderSync();

    /* 7. Synchronisation HT â TTC (bug #6) */
    _bindHtTtcSync();

    console.info('[InventoryUX] â Fiche article transformÃ©e en onglets');
  }

  function _createTab(key, active = false) {
    const div = document.createElement('div');
    div.className = 'prod-tab-content' + (active ? ' active' : '');
    div.dataset.tabContent = key;
    return div;
  }

  /* ================================================================
     3. RÃPARTITION DES CHAMPS DANS LES ONGLETS
     ================================================================ */
  function _distributeFieldsToTabs(ctx) {
    const {
      formContainer, imageSection, toggleSection,
      variationsSections, paliersSection,
      tabGeneral, tabPricing, tabStock,
      tabVariants, tabTiers, tabAccount, tabHistory
    } = ctx;

    /* Le formContainer contient tous les form-group gÃ©nÃ©rÃ©s par renderForm().
       Chaque form-group a un input/select avec data-field-key=... 
       On les trie par clÃ© et on les dÃ©place dans le bon onglet. */

    const FIELD_MAP = {
      general:     ['emoji', 'nom', 'designation', 'ref', 'sku', 'type',
                    'categorie', 'fournisseur', 'unite', 'description', 'status'],
      pricing:     ['prix', 'prixTTC', 'cout', 'tva'],
      stock:       ['stockMagasin', 'stockFournisseur', 'stockMin'],
      accounting:  ['compteVente', 'compteTVA', 'compteStock']
    };

    /* Parcourir les form-group et les rÃ©partir */
    const formGroups = formContainer.querySelectorAll('.form-group');
    formGroups.forEach(group => {
      const field = group.querySelector('[data-field-key]');
      if (!field) return;
      const key = field.dataset.fieldKey;

      let targetTab = tabGeneral; // dÃ©faut

      for (const [tabKey, fields] of Object.entries(FIELD_MAP)) {
        if (fields.includes(key)) {
          targetTab = { general: tabGeneral, pricing: tabPricing,
                        stock: tabStock, accounting: tabAccount }[tabKey];
          break;
        }
      }

      /* CrÃ©er une grille dans l'onglet si pas dÃ©jÃ  faite */
      let grid = targetTab.querySelector('.form-grid');
      if (!grid) {
        grid = document.createElement('div');
        grid.className = 'form-grid';
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:16px;';
        targetTab.appendChild(grid);
      }
      grid.appendChild(group);
    });

    /* Image section â reste en haut (gÃ©rÃ©e par sticky), on peut la cacher ou la garder dans General */
    if (imageSection) {
      imageSection.style.marginTop = '0';
      tabGeneral.insertBefore(imageSection, tabGeneral.firstChild);
    }

    /* Toggle simple/variable â onglet variantes */
    if (toggleSection) {
      tabVariants.appendChild(toggleSection);
    }

    /* variations-sections â onglet variantes */
    tabVariants.appendChild(variationsSections);
    /* Forcer affichage puisqu'on contrÃ´le visibilitÃ© via onglets */
    variationsSections.style.display = 'block';

    /* paliers-section â onglet paliers */
    tabTiers.appendChild(paliersSection);

    /* Tab Stock : ajouter un widget de rÃ©sumÃ© */
    const stockSummary = document.createElement('div');
    stockSummary.className = 'prod-summary-box';
    stockSummary.innerHTML = `
      <span style="font-size:20px;">ð¦</span>
      <div style="flex:1;">
        <div style="font-weight:600;" id="stock-summary-total">Stock total : â</div>
        <div style="font-size:12px;color:var(--text-muted);">
          RÃ©partition entre entrepÃ´t magasin et entrepÃ´t fournisseur
        </div>
      </div>
    `;
    tabStock.insertBefore(stockSummary, tabStock.firstChild);

    /* Vider le formContainer puisque tout a Ã©tÃ© dÃ©placÃ© */
    formContainer.innerHTML = '';
  }

  /* ================================================================
     4. BADGES COMPTEURS D'ONGLETS
     ================================================================ */
  function _updateTabBadges() {
    /* Compter les variantes visibles */
    const varTable = document.querySelector('#variantes-table tbody, .variantes-table tbody');
    const varCount = varTable ? varTable.querySelectorAll('tr').length : 0;
    const badge = document.getElementById('tab-badge-variants');
    if (badge) {
      badge.textContent = varCount;
      badge.style.display = varCount > 0 ? 'inline-block' : 'none';
    }
  }

  /* ================================================================
     5. SYNC STICKY HEADER
     ================================================================ */
  function _bindStickyHeaderSync() {
    const nomField = document.querySelector('[data-field-key="nom"]');
    const refField = document.querySelector('[data-field-key="ref"]');
    const prixField = document.querySelector('[data-field-key="prix"]');
    const stockMagField = document.querySelector('[data-field-key="stockMagasin"]');
    const stockFourField = document.querySelector('[data-field-key="stockFournisseur"]');
    const stockMinField = document.querySelector('[data-field-key="stockMin"]');

    function updateSticky() {
      const phName = document.getElementById('ph-name');
      const phRef = document.getElementById('ph-ref');
      const phPrix = document.getElementById('ph-prix');
      const phStock = document.getElementById('ph-stock');

      if (phName && nomField) phName.textContent = nomField.value || 'Nouveau produit';
      if (phRef && refField) phRef.textContent = refField.value ? 'RÃ©f: ' + refField.value : 'Sans rÃ©fÃ©rence';
      if (phPrix && prixField) phPrix.textContent = _fmt(parseFloat(prixField.value) || 0);

      if (phStock) {
        const mag = parseFloat(stockMagField?.value) || 0;
        const four = parseFloat(stockFourField?.value) || 0;
        const min = parseFloat(stockMinField?.value) || 0;
        const total = mag + four;
        phStock.textContent = total;
        phStock.classList.toggle('zero', total === 0);
        phStock.classList.toggle('low', total > 0 && total <= min);

        /* Stock summary dans l'onglet stock */
        const summary = document.getElementById('stock-summary-total');
        if (summary) {
          summary.textContent = `Stock total : ${total} (ðª ${mag} Â· ð¦ ${four})`;
        }
      }
    }

    [nomField, refField, prixField, stockMagField, stockFourField, stockMinField]
      .filter(Boolean)
      .forEach(f => f.addEventListener('input', updateSticky));

    updateSticky();
  }

  /* ================================================================
     6. SYNC PRIX HT â TTC (bug #6)
     ================================================================ */
  function _bindHtTtcSync() {
    const htField = document.querySelector('[data-field-key="prix"]');
    const ttcField = document.querySelector('[data-field-key="prixTTC"]');
    const tvaField = document.querySelector('[data-field-key="tva"]');

    if (!htField || !ttcField) return;

    function getTVA() {
      return parseFloat(tvaField?.value) || 16;
    }

    /* Quand HT change â recalculer TTC */
    htField.addEventListener('input', () => {
      if (htField.dataset.userEditing === 'ttc') return;
      htField.dataset.userEditing = 'ht';
      const ht = parseFloat(htField.value) || 0;
      const tva = getTVA();
      ttcField.value = Math.round(ht * (1 + tva / 100));
      setTimeout(() => { htField.dataset.userEditing = ''; }, 100);
    });

    /* Quand TTC change â recalculer HT */
    ttcField.addEventListener('input', () => {
      if (ttcField.dataset.userEditing === 'ht') return;
      ttcField.dataset.userEditing = 'ttc';
      const ttc = parseFloat(ttcField.value) || 0;
      const tva = getTVA();
      htField.value = Math.round(ttc / (1 + tva / 100));
      setTimeout(() => { ttcField.dataset.userEditing = ''; }, 100);
    });

    /* Quand TVA change â recalculer TTC Ã  partir du HT */
    if (tvaField) {
      tvaField.addEventListener('change', () => {
        const ht = parseFloat(htField.value) || 0;
        const tva = getTVA();
        ttcField.value = Math.round(ht * (1 + tva / 100));
      });
    }
  }

  /* ================================================================
     7. RENDU ONGLET HISTORIQUE
     ================================================================ */
  function _renderHistory(container) {
    if (!container) return;

    /* Retrouver l'id du produit courant */
    const id = Inventory && Inventory._getCurrentId ? Inventory._getCurrentId() : null;
    /* Fallback : lire depuis le champ cachÃ© ou depuis le nom */
    const produitNom = document.querySelector('[data-field-key="nom"]')?.value || '';

    /* Collecter tous les documents rÃ©fÃ©renÃ§ant ce produit */
    const devis = Store.getAll('devis') || [];
    const commandes = Store.getAll('commandes') || [];
    const factures = Store.getAll('factures') || [];

    const timeline = [];

    function scan(docs, typeLabel, icon, color) {
      docs.forEach(doc => {
        (doc.lignes || []).forEach(l => {
          if (l.produitId === id || 
              (produitNom && (l.description || '').includes(produitNom))) {
            timeline.push({
              date: doc.date || doc._createdAt,
              type: typeLabel,
              icon,
              color,
              ref: doc.ref,
              client: doc.client,
              qte: l.qte || 0,
              pu: l.prixUnitaire || 0,
              sousTotal: (l.qte || 0) * (l.prixUnitaire || 0) * (1 - (l.remise || 0) / 100)
            });
          }
        });
      });
    }

    scan(devis, 'Devis', 'ð', '#4a5fff');
    scan(commandes, 'Commande', 'ð¦', '#00d4aa');
    scan(factures, 'Facture', 'ð§¾', '#ffc857');

    /* Trier par date dÃ©croissante */
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (timeline.length === 0) {
      container.innerHTML = `
        <div class="prod-summary-box">
          <span style="font-size:20px;">ð</span>
          <div>
            <div style="font-weight:600;">Aucun historique pour le moment</div>
            <div style="font-size:12px;color:var(--text-muted);">
              Les devis, commandes et factures contenant ce produit apparaÃ®tront ici.
            </div>
          </div>
        </div>`;
      return;
    }

    /* Stats globales */
    const totalVendu = timeline
      .filter(t => t.type === 'Facture')
      .reduce((s, t) => s + t.qte, 0);
    const caTotal = timeline
      .filter(t => t.type === 'Facture')
      .reduce((s, t) => s + t.sousTotal, 0);

    let html = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;">
        <div class="prod-summary-box" style="flex-direction:column;align-items:flex-start;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;">EntrÃ©es historique</div>
          <div style="font-size:24px;font-weight:700;">${timeline.length}</div>
        </div>
        <div class="prod-summary-box" style="flex-direction:column;align-items:flex-start;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;">QuantitÃ© vendue</div>
          <div style="font-size:24px;font-weight:700;">${totalVendu}</div>
        </div>
        <div class="prod-summary-box" style="flex-direction:column;align-items:flex-start;">
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:600;">CA facturÃ©</div>
          <div style="font-size:24px;font-weight:700;color:var(--accent-green);">${_fmt(caTotal)}</div>
        </div>
      </div>
      <div class="prod-timeline">`;

    timeline.slice(0, 30).forEach(t => {
      html += `
        <div class="prod-timeline-item">
          <div class="prod-timeline-icon" style="background:${t.color}20;color:${t.color};">
            ${t.icon}
          </div>
          <div class="prod-timeline-body">
            <div class="prod-timeline-title">${t.type} ${_esc(t.ref)} â ${_esc(t.client || 'Sans client')}</div>
            <div class="prod-timeline-meta">
              ${_fmtDate(t.date)} Â· ${t.qte} Ã ${_fmt(t.pu)}
            </div>
          </div>
          <div class="prod-timeline-amount">${_fmt(t.sousTotal)}</div>
        </div>`;
    });

    html += `</div>`;
    if (timeline.length > 30) {
      html += `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:12px;">
        ${timeline.length - 30} autres entrÃ©es masquÃ©es
      </div>`;
    }
    container.innerHTML = html;
  }

  /* ================================================================
     8. FILTRES RAPIDES DANS LA LISTE ARTICLES
     ================================================================ */
  function enhanceProductList() {
    const toolbar = document.getElementById('toolbar-actions');
    if (!toolbar) return;
    if (!toolbar.querySelector('#btn-new-product')) return; // pas sur la liste produits
    if (toolbar.dataset.filtersAdded) return;
    toolbar.dataset.filtersAdded = '1';

    /* CrÃ©er la barre de filtres */
    const area = document.getElementById('view-content');
    if (!area) return;

    const filters = document.createElement('div');
    filters.className = 'prod-filters';
    filters.id = 'prod-filters';

    const produits = Store.getAll('produits').filter(p => p.status !== 'archived');
    const countAll = produits.length;
    const countMarchandise = produits.filter(p => p.type === 'marchandise').length;
    const countService = produits.filter(p => p.type === 'service').length;
    const countConsommable = produits.filter(p => p.type === 'consommable').length;
    const countLow = produits.filter(p => {
      const s = p.stock || ((p.stockMagasin || 0) + (p.stockFournisseur || 0));
      return s > 0 && s <= (p.stockMin || 0);
    }).length;
    const countZero = produits.filter(p => {
      const s = p.stock || ((p.stockMagasin || 0) + (p.stockFournisseur || 0));
      return s === 0;
    }).length;

    filters.innerHTML = `
      <span class="prod-filter-label">Filtres :</span>
      <button class="prod-filter-chip active" data-filter="all">
        Tous <span class="prod-filter-chip-count">${countAll}</span>
      </button>
      <button class="prod-filter-chip" data-filter="marchandise">
        ð Marchandises <span class="prod-filter-chip-count">${countMarchandise}</span>
      </button>
      <button class="prod-filter-chip" data-filter="service">
        ð§ Services <span class="prod-filter-chip-count">${countService}</span>
      </button>
      <button class="prod-filter-chip" data-filter="consommable">
        ð§´ Consommables <span class="prod-filter-chip-count">${countConsommable}</span>
      </button>
      <button class="prod-filter-chip" data-filter="stock-low"
        style="color:var(--accent-orange);border-color:var(--accent-orange);">
        â ï¸ Stock bas <span class="prod-filter-chip-count">${countLow}</span>
      </button>
      <button class="prod-filter-chip" data-filter="stock-zero"
        style="color:var(--accent-red);border-color:var(--accent-red);">
        ð« En rupture <span class="prod-filter-chip-count">${countZero}</span>
      </button>
    `;

    /* InsÃ©rer avant la table */
    area.insertBefore(filters, area.firstChild);

    filters.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter]');
      if (!chip) return;
      filters.querySelectorAll('.prod-filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      _applyProductFilter(chip.dataset.filter);
    });
  }

  function _applyProductFilter(filter) {
    /* On filtre visuellement les lignes du tableau */
    const rows = document.querySelectorAll('#inv-products-table tbody tr');
    const produits = Store.getAll('produits').filter(p => p.status !== 'archived');
    const prodByName = {};
    produits.forEach(p => { prodByName[p.nom] = p; });

    rows.forEach(tr => {
      /* RÃ©cupÃ©rer le produit Ã  partir du contenu de la premiÃ¨re cellule */
      const nameCell = tr.querySelector('td:first-child');
      if (!nameCell) return;
      const name = nameCell.textContent.split('ArchivÃ©')[0].trim().split('\n')[0].trim();
      const prod = produits.find(p => name.includes(p.nom));
      if (!prod) return;

      let show = true;
      const stock = prod.stock || ((prod.stockMagasin || 0) + (prod.stockFournisseur || 0));

      switch (filter) {
        case 'all': show = true; break;
        case 'marchandise': show = prod.type === 'marchandise'; break;
        case 'service': show = prod.type === 'service'; break;
        case 'consommable': show = prod.type === 'consommable'; break;
        case 'stock-low': show = stock > 0 && stock <= (prod.stockMin || 0); break;
        case 'stock-zero': show = stock === 0; break;
      }
      tr.style.display = show ? '' : 'none';
    });
  }

  /* ================================================================
     9. BOUTON "DUPLIQUER PRODUIT"
     AjoutÃ© dans le toolbar de la fiche produit via observer
     ================================================================ */
  function addDuplicateButton() {
    const toolbar = document.getElementById('toolbar-actions');
    if (!toolbar) return;
    const saveBtn = toolbar.querySelector('#btn-save-prod');
    const archiveBtn = toolbar.querySelector('#btn-archive-prod');
    if (!archiveBtn) return; // pas en mode Ã©dition
    if (toolbar.querySelector('#btn-duplicate-prod')) return; // dÃ©jÃ  ajoutÃ©

    const dupBtn = document.createElement('button');
    dupBtn.className = 'btn btn-ghost btn-sm';
    dupBtn.id = 'btn-duplicate-prod';
    dupBtn.innerHTML = 'â Dupliquer';
    dupBtn.title = 'CrÃ©er une copie de ce produit';
    archiveBtn.parentNode.insertBefore(dupBtn, archiveBtn);

    dupBtn.addEventListener('click', () => {
      const nomField = document.querySelector('[data-field-key="nom"]');
      if (!nomField) return;

      if (!confirm('CrÃ©er une copie de "' + nomField.value + '" ?')) return;

      /* Collecter tous les champs */
      const newData = {};
      document.querySelectorAll('[data-field-key]').forEach(el => {
        const k = el.dataset.fieldKey;
        if (!k) return;
        newData[k] = el.type === 'number' ? Number(el.value) : el.value;
      });

      newData.nom = newData.nom + ' (copie)';
      newData.ref = '';
      newData.sku = '';
      delete newData.id;
      newData._createdAt = new Date().toISOString();

      const created = Store.create('produits', newData);
      if (typeof toast === 'function') {
        toast('Produit dupliquÃ© : ' + created.nom, 'success');
      }

      /* Retour Ã  la liste */
      const backBtn = document.getElementById('btn-prod-back');
      if (backBtn) backBtn.click();
    });
  }

  /* ================================================================
     HELPERS
     ================================================================ */
  function _fmt(n) {
    if (typeof fmt === 'function') return fmt(n);
    return Math.round(n || 0).toLocaleString('fr-FR') + ' XPF';
  }
  function _fmtDate(d) {
    if (typeof fmtDate === 'function') return fmtDate(d);
    if (!d) return 'â';
    return new Date(d).toLocaleDateString('fr-FR');
  }
  function _esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ================================================================
     INITIALISATION â OBSERVER DU DOM
     ================================================================ */
  _injectStyles();

  const observer = new MutationObserver(() => {
    /* Formulaire produit ouvert ? */
    if (document.getElementById('product-form-container') &&
        document.getElementById('variations-sections') &&
        document.getElementById('paliers-section')) {
      enhanceProductForm();
      addDuplicateButton();
    }

    /* Liste produits affichÃ©e ? */
    if (document.getElementById('inv-products-table') &&
        document.querySelector('#btn-new-product')) {
      enhanceProductList();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  console.info('[InventoryUX] â Module UX articles chargÃ© â onglets, filtres, duplication, sync HT/TTC');

  window.InventoryUX = {
    version: '1.3.0',
    enhanceProductForm,
    enhanceProductList
  };

})();
