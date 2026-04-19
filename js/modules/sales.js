/* ================================================================
   HCS ERP — js/modules/sales.js
   Module Ventes : Devis (quotes), Commandes (orders),
   Factures (invoices), Rapport de ventes (sales-report).
   Exporté via window.Sales — initialisé par app.js via Sales.init()
   ================================================================ */

'use strict';

const Sales = (() => {

  /* ----------------------------------------------------------------
     ÉTAT INTERNE — navigation liste ↔ formulaire
     ---------------------------------------------------------------- */
  const _state = {
    view:      'quotes',  // vue active
    mode:      'list',    // 'list' | 'form'
    listMode:  'list',    // 'list' | 'kanban'
    currentId: null,      // id du document en cours d'édition
    lignes:    [],        // lignes du formulaire courant
    paiements: []         // paiements de la facture courante
  };

  /* Lignes de règlement du devis en cours (multi-mode/montant) */
  let _paiementsDevis = []; // [{mode, montant}]
  const REG_ICONS = { 'Espèces': '💵', 'Carte bancaire': '💳', 'Virement': '🏦', 'Chèque': '📋' };
  const REG_MODES = ['Espèces', 'Carte bancaire', 'Virement', 'Chèque'];

  /* ----------------------------------------------------------------
     CONSTANTES MÉTIER
     ---------------------------------------------------------------- */

  const STATUTS_DEVIS = ['Brouillon', 'Envoyé', 'Confirmé', 'Annulé'];

  const STATUTS_CMD = [
    'Brouillon', 'Confirmé', 'En production', 'Prêt', 'Livré', 'Terminé'
  ];

  const STATUTS_FAC = [
    'Brouillon', 'Envoyé', 'Payé partiel', 'Payé', 'En retard'
  ];

  const BADGE_DEVIS = {
    'Brouillon': 'badge-gray',
    'Envoyé':    'badge-blue',
    'Confirmé':  'badge-green',
    'Annulé':    'badge-red'
  };

  const BADGE_CMD = {
    'Brouillon':     'badge-gray',
    'Confirmé':      'badge-blue',
    'En production': 'badge-orange',
    'Prêt':          'badge-violet',
    'Livré':         'badge-green',
    'Terminé':       'badge-green'
  };

  const BADGE_FAC = {
    'Brouillon':    'badge-gray',
    'Envoyé':       'badge-blue',
    'Payé partiel': 'badge-orange',
    'Payé':         'badge-green',
    'En retard':    'badge-red'
  };

  const METHODES_PAIEMENT = ['Espèces', 'Carte bancaire', 'Virement', 'Chèque'];

  const STATUTS_BL = ['En attente', 'Reçu partiel', 'Reçu complet', 'Annulé'];

  const BADGE_BL = {
    'En attente':    'badge-gray',
    'Reçu partiel':  'badge-orange',
    'Reçu complet':  'badge-green',
    'Annulé':        'badge-red'
  };

  const TYPES_PAIEMENT = ['Acompte', 'Paiement', 'Solde'];

  /* Types de clients */
  const CLIENT_TYPES = [
    'Particulier', 'Entreprise', 'Association', 'CE',
    'Club de sport', 'Administration', 'Touriste'
  ];

  /* Îles de Polynésie française */
  const ILES_PF = [
    'Tahiti', 'Moorea', 'Bora Bora', 'Huahine', 'Raiatea',
    'Tahaa', 'Maupiti', 'Rangiroa', 'Fakarava', 'Tikehau',
    'Nuku Hiva', 'Hiva Oa', 'Papeete', 'Autre'
  ];

  /* ----------------------------------------------------------------
     UTILITAIRES INTERNES
     ---------------------------------------------------------------- */

  /** Échappe le HTML pour éviter les injections */
  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Génère un badge HTML */
  function _badge(statut, map) {
    const cls = map[statut] || 'badge-gray';
    return `<span class="badge ${cls}">${_esc(statut || '—')}</span>`;
  }

  /** Calcule HT / TVA (16% produits, 13% services) / TTC depuis les lignes */
  function _calcTotaux(lignes) {
    let totalHT  = 0;
    let totalTVA = 0;
    (lignes || []).forEach(l => {
      const brut   = (l.qte || 0) * (l.prixUnitaire || 0);
      const remise = brut * ((l.remise || 0) / 100);
      const ht     = brut - remise;
      /* tauxTVA stocké en % (16 ou 13), défaut 16 pour les produits */
      const taux   = ((l.tauxTVA !== undefined ? l.tauxTVA : 16)) / 100;
      totalHT  += ht;
      totalTVA += ht * taux;
    });
    return {
      totalHT:  Math.round(totalHT),
      totalTVA: Math.round(totalTVA),
      totalTTC: Math.round(totalHT + totalTVA)
    };
  }

  /** Somme des paiements enregistrés */
  function _totalPaiements(paiements) {
    return (paiements || []).reduce((s, p) => s + (p.montant || 0), 0);
  }

  /** Nom d'un contact depuis son id */
  function _contactNom(contactId) {
    const c = Store.getById('contacts', contactId);
    return c ? c.nom : (contactId || '—');
  }

  /** Options <option> pour le select de produits (dans les lignes) — exclut les archivés */
  function _produitOptions(selectedId) {
    const produits = Store.getAll('produits').filter(p => p.status !== 'archived');
    return `<option value="">— Produit —</option>` +
      produits.map(p =>
        `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${_esc(p.emoji || '')} ${_esc(p.nom)}</option>`
      ).join('');
  }

  /** Génère le prochain numéro de document */
  function _genRef(prefix, serie) {
    const n = Store.nextCounter(serie);
    return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
  }

  /** Formate un montant (utilise fmt() de utils.js) */
  function _fmt(v) {
    return typeof fmt === 'function' ? fmt(v || 0) : (v || 0) + ' XPF';
  }

  /** Formate une date (utilise fmtDate() de utils.js) */
  function _fmtDate(d) {
    return typeof fmtDate === 'function' ? fmtDate(d) : (d || '—');
  }

  /* ----------------------------------------------------------------
     NAVIGATION INTERNE liste ↔ formulaire
     ---------------------------------------------------------------- */

  /** Revenir à la liste d'une vue */
  function _goList(view, toolbar, area) {
    _state.mode      = 'list';
    _state.currentId = null;
    _state.lignes    = [];
    _state.paiements = [];
    init(toolbar, area, view);
  }

  /** Ouvrir le formulaire d'un document */
  function _goForm(view, id, toolbar, area) {
    _state.mode      = 'form';
    _state.currentId = id;
    init(toolbar, area, view);
  }

  /* ================================================================
     TABLE DE LIGNES RÉUTILISABLE
     Partagée entre Devis, Commandes, Factures
     ================================================================ */

  /** Génère le HTML complet de la table de lignes */
  function _renderLineTable(lignes) {
    return `
      <div class="line-table-wrapper">
        <table class="line-table">
          <thead>
            <tr>
              <th style="width:210px;">Produit</th>
              <th>Description</th>
              <th class="col-num" style="width:72px;">Qté</th>
              <th class="col-num" style="width:120px;">Prix HT</th>
              <th class="col-num" style="width:72px;">Remise %</th>
              <th class="col-num" style="width:70px;">TVA %</th>
              <th class="col-num" style="width:120px;">Sous-total</th>
              <th style="width:36px;"></th>
            </tr>
          </thead>
          <tbody id="line-tbody">
            ${lignes.map((l, i) => _renderLineRow(l, i)).join('')}
          </tbody>
        </table>
        <div style="padding:8px 12px;">
          <button class="btn-add-line" id="btn-add-line">+ Ajouter une ligne</button>
        </div>
      </div>`;
  }

  /** Génère le HTML d'une ligne (avec variantes textile + design) */
  function _renderLineRow(l, i) {
    const sousTotal = Math.round(
      (l.qte || 0) * (l.prixUnitaire || 0) * (1 - (l.remise || 0) / 100)
    );

    /* Vérifier si le produit sélectionné a des variantes */
    const produitLigne = l.produitId ? Store.getById('produits', l.produitId) : null;
    const hasVariantes = produitLigne && (produitLigne.variantes || []).length > 0;

    return `
      <tr data-line="${i}">
        <td>
          <select class="line-input" data-field="produitId" data-line="${i}">
            ${_produitOptions(l.produitId)}
          </select>
          ${hasVariantes ? `<button class="btn btn-ghost btn-sm" data-pick-variante="${i}"
            title="Choisir une variante"
            style="margin-top:3px;font-size:10px;padding:2px 6px;width:100%;justify-content:center;">
            ⚡ Variantes
          </button>` : ''}
        </td>
        <td>
          <input type="text" class="line-input" data-field="description"
            data-line="${i}" value="${_esc(l.description || '')}"
            placeholder="Description…" />
          <!-- Variantes textile -->
          <div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap;">
            <input type="text" class="line-input" data-field="taille" data-line="${i}"
              value="${_esc(l.taille || '')}" placeholder="Taille"
              style="width:60px;height:22px;font-size:11px;padding:0 4px;background:${l.taille ? '#EEF2FF' : 'transparent'};" />
            <input type="text" class="line-input" data-field="couleur" data-line="${i}"
              value="${_esc(l.couleur || '')}" placeholder="Couleur"
              style="width:70px;height:22px;font-size:11px;padding:0 4px;background:${l.couleur ? '#EEF2FF' : 'transparent'};" />
            <input type="text" class="line-input" data-field="technique" data-line="${i}"
              value="${_esc(l.technique || '')}" placeholder="Technique"
              style="width:70px;height:22px;font-size:11px;padding:0 4px;background:${l.technique ? '#EEF2FF' : 'transparent'};" />
            <input type="text" class="line-input" data-field="emplacement" data-line="${i}"
              value="${_esc(l.emplacement || '')}" placeholder="Emplac."
              style="width:65px;height:22px;font-size:11px;padding:0 4px;background:${l.emplacement ? '#FFF7ED' : 'transparent'};" />
            <input type="text" class="line-input" data-field="notes_design" data-line="${i}"
              value="${_esc(l.notes_design || '')}" placeholder="Notes design"
              style="flex:1;min-width:80px;height:22px;font-size:11px;padding:0 4px;background:${l.notes_design ? '#FFF7ED' : 'transparent'};" />
          </div>
        </td>
        <td>
          <input type="number" class="line-input num-input" data-field="qte"
            data-line="${i}" value="${l.qte || 1}" min="0" step="1" />
        </td>
        <td>
          <input type="number" class="line-input num-input" data-field="prixUnitaire"
            data-line="${i}" value="${l.prixUnitaire || 0}" min="0" step="1" />
        </td>
        <td>
          <input type="number" class="line-input num-input" data-field="remise"
            data-line="${i}" value="${l.remise || 0}" min="0" max="100" step="0.5" />
        </td>
        <td>
          <select class="line-input" data-field="tauxTVA" data-line="${i}"
            style="width:65px;font-size:12px;">
            <option value="16" ${(l.tauxTVA === undefined || l.tauxTVA == 16) ? 'selected' : ''}>16%</option>
            <option value="13" ${l.tauxTVA == 13 ? 'selected' : ''}>13%</option>
            <option value="5"  ${l.tauxTVA == 5  ? 'selected' : ''}>5%</option>
          </select>
        </td>
        <td class="col-num line-sous-total" data-line="${i}">
          ${_fmt(sousTotal)}
        </td>
        <td>
          <button class="btn-remove-line" data-remove="${i}" title="Supprimer la ligne">✕</button>
        </td>
      </tr>`;
  }

  /** Calcule la TVA par taux depuis les lignes */
  function _calcTVAParTaux(lignes) {
    let tva16 = 0, tva13 = 0, tva5 = 0;
    (lignes || []).forEach(l => {
      const brut = (l.qte || 0) * (l.prixUnitaire || 0);
      const ht   = brut * (1 - (l.remise || 0) / 100);
      const taux = Number(l.tauxTVA !== undefined ? l.tauxTVA : 16);
      if (taux === 13)     tva13 += ht * 0.13;
      else if (taux === 5) tva5  += ht * 0.05;
      else                 tva16 += ht * 0.16;
    });
    return { tva16: Math.round(tva16), tva13: Math.round(tva13), tva5: Math.round(tva5) };
  }

  /** Bloc totaux HT / TVA 16% / TVA 13% / TTC */
  function _renderTotalsBlock(lignes) {
    const { totalHT, totalTVA, totalTTC } = _calcTotaux(lignes);
    const { tva16, tva13, tva5 } = _calcTVAParTaux(lignes);
    /* N'afficher que les lignes TVA dont le montant est > 0 */
    const row16 = tva16 > 0 ? `
        <div class="total-row">
          <span class="total-label">TVA 16% (produits)</span>
          <span class="total-value" id="t-tva16">${_fmt(tva16)}</span>
        </div>` : `<div id="t-tva16" style="display:none;"></div>`;
    const row13 = tva13 > 0 ? `
        <div class="total-row">
          <span class="total-label">TVA 13% (services)</span>
          <span class="total-value" id="t-tva13">${_fmt(tva13)}</span>
        </div>` : `<div id="t-tva13" style="display:none;"></div>`;
    const row5 = tva5 > 0 ? `
        <div class="total-row">
          <span class="total-label">TVA 5%</span>
          <span class="total-value" id="t-tva5">${_fmt(tva5)}</span>
        </div>` : `<div id="t-tva5" style="display:none;"></div>`;
    return `
      <div class="line-table-totals" id="totals-block">
        <div class="total-row">
          <span class="total-label">Sous-total HT</span>
          <span class="total-value" id="t-ht">${_fmt(totalHT)}</span>
        </div>
        ${row16}${row13}${row5}
        <div class="total-row" style="border-top:1px dashed var(--border);margin-top:2px;padding-top:4px;">
          <span class="total-label">Total TVA</span>
          <span class="total-value" id="t-tva">${_fmt(totalTVA)}</span>
        </div>
        <div class="total-row grand-total">
          <span class="total-label">TOTAL TTC</span>
          <span class="total-value" id="t-ttc">${_fmt(totalTTC)}</span>
        </div>
      </div>`;
  }

  /** Lie les événements sur la table de lignes (délégation) */
  function _bindLineTableEvents() {
    /* Ajouter une ligne vide */
    document.getElementById('btn-add-line')?.addEventListener('click', () => {
      _state.lignes.push({ produitId: '', description: '', qte: 1, prixUnitaire: 0, remise: 0, tauxTVA: 16, taille: '', couleur: '', technique: '', emplacement: '', notes_design: '' });
      _refreshLineTable();
    });

    const tbody = document.getElementById('line-tbody');
    if (!tbody) return;

    /* Sélection produit → auto-remplissage description + prix */
    tbody.addEventListener('change', (e) => {
      const el  = e.target;
      const idx = parseInt(el.dataset.line, 10);
      if (isNaN(idx) || !el.dataset.field) return;

      if (el.dataset.field === 'produitId') {
        const produit = Store.getById('produits', el.value);
        if (produit) {
          _state.lignes[idx].produitId    = el.value;
          _state.lignes[idx].prixUnitaire = produit.prix || 0;
          _state.lignes[idx].tauxTVA      = (produit.categorie === 'Service') ? 13 : 16;
          /* Description : nom + attributs principaux si définis */
          const descParts = [produit.nom];
          if (produit.attrPrix && produit.variantes && produit.variantes.length > 0) {
            descParts.push(`(${produit.variantes.length} variante${produit.variantes.length > 1 ? 's' : ''})`);
          }
          _state.lignes[idx].description = descParts.join(' ');
          _applyPalierPrix(idx);
        } else {
          _state.lignes[idx].produitId   = '';
          _state.lignes[idx].description = '';
        }
        _refreshLineTable();
        return;
      }

      /* Mise à jour des champs numériques ou texte */
      const numFields = ['qte', 'prixUnitaire', 'remise', 'tauxTVA'];
      _state.lignes[idx][el.dataset.field] = numFields.includes(el.dataset.field)
        ? parseFloat(el.value) || 0
        : el.value;

      _updateLineSousTotal(idx);
      _updateTotals();
    });

    /* Saisie en temps réel → mise à jour des totaux + paliers auto */
    tbody.addEventListener('input', (e) => {
      const el  = e.target;
      const idx = parseInt(el.dataset.line, 10);
      if (isNaN(idx) || !el.dataset.field) return;

      const numFields = ['qte', 'prixUnitaire', 'remise', 'tauxTVA'];
      if (numFields.includes(el.dataset.field)) {
        _state.lignes[idx][el.dataset.field] = parseFloat(el.value) || 0;

        /* Tarification dégressive : recalculer le prix si qte change */
        if (el.dataset.field === 'qte') {
          _applyPalierPrix(idx);
        }

        _updateLineSousTotal(idx);
        _updateTotals();
      } else {
        _state.lignes[idx][el.dataset.field] = el.value;
      }
    });

    /* Supprimer une ligne */
    tbody.addEventListener('click', (e) => {
      const btnRemove = e.target.closest('[data-remove]');
      if (btnRemove) {
        _state.lignes.splice(parseInt(btnRemove.dataset.remove, 10), 1);
        _refreshLineTable();
        return;
      }

      /* Picker de variantes */
      const btnPick = e.target.closest('[data-pick-variante]');
      if (btnPick) {
        const idx = parseInt(btnPick.dataset.pickVariante, 10);
        const ligne = _state.lignes[idx];
        const produit = ligne.produitId ? Store.getById('produits', ligne.produitId) : null;
        if (!produit || !(produit.variantes || []).length) return;
        if (typeof Inventory !== 'undefined' && Inventory.showVariantePicker) {
          Inventory.showVariantePicker(produit, (variante, descriptionAuto) => {
            if (!variante) return;
            _state.lignes[idx].taille       = variante.taille  || ligne.taille  || '';
            _state.lignes[idx].couleur      = variante.couleur || ligne.couleur || '';
            _state.lignes[idx].coupe        = variante.coupe   || '';
            _state.lignes[idx].prixUnitaire = variante.prix    || ligne.prixUnitaire || 0;
            _state.lignes[idx].description  = descriptionAuto  || ligne.description  || produit.nom;
            _applyPalierPrix(idx);
            _refreshLineTable();
          });
        }
      }
    });
  }

  /**
   * Tarification dégressive : applique le meilleur prix palier selon la qte.
   * Si aucun palier ne correspond, revient au prix de base du produit.
   * Met à jour _state.lignes[idx].prixUnitaire en silence (sans redessiner).
   */
  function _applyPalierPrix(idx) {
    const ligne = _state.lignes[idx];
    if (!ligne.produitId) return;

    const produit = Store.getById('produits', ligne.produitId);
    if (!produit) return;

    const paliers = (produit.paliers || [])
      .filter(p => p.qteMin > 0 && p.prix > 0)
      .sort((a, b) => b.qteMin - a.qteMin); // du plus grand au plus petit

    const qte = ligne.qte || 1;
    /* Trouver le palier applicable : le premier dont qteMin <= qte */
    const palierOK = paliers.find(p => qte >= p.qteMin);

    if (palierOK) {
      ligne.prixUnitaire = palierOK.prix;
    } else {
      /* Aucun palier → prix de base */
      ligne.prixUnitaire = produit.prix || 0;
    }

    /* Mettre à jour l'input prixUnitaire dans le DOM si visible */
    const inputPrix = document.querySelector(
      `[data-field="prixUnitaire"][data-line="${idx}"]`
    );
    if (inputPrix) inputPrix.value = ligne.prixUnitaire;
  }

  /**
   * Remise client spéciale : applique remiseClient (%) sur toutes les lignes
   * quand un client est sélectionné dans le formulaire.
   * @param {string} selectId — id du <select> client
   */
  function _applyRemiseClient(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel || !sel.value || sel.value === '__new__') return;

    const contact = Store.getById('contacts', sel.value);
    if (!contact || !contact.remiseClient || contact.remiseClient <= 0) return;

    const taux = parseFloat(contact.remiseClient) || 0;
    if (taux <= 0 || taux > 100) return;

    /* Appliquer la remise client sur toutes les lignes */
    _state.lignes.forEach(l => {
      l.remise = taux;
    });

    _refreshLineTable();

    /* Feedback visuel discret */
    const nom = contact.nom || 'ce client';
    toast(`Remise client ${taux}% appliquée pour ${nom}.`, 'info');
  }

  /** Met à jour le sous-total affiché d'une ligne */
  function _updateLineSousTotal(idx) {
    const l  = _state.lignes[idx];
    const st = Math.round((l.qte || 0) * (l.prixUnitaire || 0) * (1 - (l.remise || 0) / 100));
    const el = document.querySelector(`.line-sous-total[data-line="${idx}"]`);
    if (el) el.textContent = _fmt(st);
  }

  /** Met à jour les totaux affichés en bas du formulaire */
  function _updateTotals() {
    const { totalHT, totalTVA, totalTTC } = _calcTotaux(_state.lignes);
    const { tva16, tva13, tva5 } = _calcTVAParTaux(_state.lignes);

    const elHT  = document.getElementById('t-ht');
    const elTVA = document.getElementById('t-tva');
    const elTTC = document.getElementById('t-ttc');
    const el16  = document.getElementById('t-tva16');
    const el13  = document.getElementById('t-tva13');
    const el5   = document.getElementById('t-tva5');

    if (elHT)  elHT.textContent  = _fmt(totalHT);
    if (elTVA) elTVA.textContent = _fmt(totalTVA);
    if (elTTC) elTTC.textContent = _fmt(totalTTC);

    const _updateTaxRow = (el, val) => {
      if (!el) return;
      el.style.display = val > 0 ? '' : 'none';
      el.textContent   = val > 0 ? _fmt(val) : '';
    };
    _updateTaxRow(el16, tva16);
    _updateTaxRow(el13, tva13);
    _updateTaxRow(el5,  tva5);
  }

  /** Redessine le corps de la table de lignes */
  function _refreshLineTable() {
    const tbody = document.getElementById('line-tbody');
    if (!tbody) return;
    tbody.innerHTML = _state.lignes.map((l, i) => _renderLineRow(l, i)).join('');
    _updateTotals();
    /* La délégation sur tbody est toujours active — pas besoin de rebind */
  }

  /* ----------------------------------------------------------------
     HEADER DE FORMULAIRE DOCUMENT (commun aux 3 types)
     ---------------------------------------------------------------- */
  function _renderFormHeader(ref, statut, badgeMap, chips = '') {
    return `
      <div class="breadcrumb" style="margin-bottom:12px;">
        <span style="color:var(--text-muted)">Ventes</span>
        <span>›</span>
        <span style="color:var(--text-muted)">${_esc(_state.view === 'quotes' ? 'Devis' : _state.view === 'orders' ? 'Commandes' : 'Factures')}</span>
        <span>›</span>
        <span>${_esc(ref)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
        <div class="page-title" style="margin-bottom:0;">${_esc(ref)}</div>
        ${_badge(statut, badgeMap)}
        ${chips}
      </div>`;
  }

  /* ================================================================
     KANBAN GÉNÉRIQUE — réutilisé par devis, commandes, factures
     ================================================================ */

  /**
   * Affiche un kanban par colonnes de statut.
   * @param {Array}  data      - documents
   * @param {Array}  statuts   - liste ordonnée des statuts (colonnes)
   * @param {Object} badgeMap  - { statut: 'badge-xxx' }
   * @param {string} viewName  - 'quotes' | 'orders' | 'invoices'
   * @param {Element} toolbar
   * @param {Element} area
   */
  function _drawKanban(data, statuts, badgeMap, viewName, toolbar, area) {
    const container = document.getElementById('sales-quotes-table') ||
                      document.getElementById('sales-orders-table') ||
                      document.getElementById('sales-invoices-table') ||
                      document.getElementById('sales-bl-table');

    /* Grouper par statut */
    const groups = {};
    statuts.forEach(s => { groups[s] = []; });
    data.forEach(d => {
      const s = d.statut || statuts[0];
      if (groups[s]) groups[s].push(d);
      else groups[statuts[0]].push(d);
    });

    /* Couleur de la colonne */
    const colColor = {
      'badge-gray':   '#6b7280', 'badge-blue':   '#4a5fff',
      'badge-green':  '#22c55e', 'badge-red':    '#ef4444',
      'badge-orange': '#f97316', 'badge-violet': '#9c5de5'
    };

    let html = `<div style="display:flex;gap:14px;overflow-x:auto;padding-bottom:12px;min-height:300px;">`;

    statuts.forEach(statut => {
      const items = groups[statut] || [];
      const cls   = badgeMap[statut] || 'badge-gray';
      const color = colColor[cls] || '#6b7280';

      html += `
        <div style="flex:0 0 230px;min-width:230px;">
          <div style="display:flex;align-items:center;justify-content:space-between;
            margin-bottom:10px;padding:8px 10px;background:${color}18;
            border-radius:8px;border-left:3px solid ${color};">
            <span style="font-size:12px;font-weight:700;color:${color};">${_esc(statut)}</span>
            <span style="font-size:11px;color:var(--text-muted);">${items.length}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${items.map(item => _renderKanbanCard(item, viewName, badgeMap)).join('')}
          </div>
        </div>`;
    });

    html += `</div>`;

    /* Injecter dans le conteneur existant */
    const target = document.getElementById('sales-quotes-table') ||
                   document.getElementById('sales-orders-table') ||
                   document.getElementById('sales-invoices-table') ||
                   document.getElementById('sales-bl-table');
    if (target) {
      target.innerHTML = html;
      target.querySelectorAll('[data-kanban-id]').forEach(card => {
        card.addEventListener('click', () => {
          _goForm(viewName, card.dataset.kanbanId, toolbar, area);
        });
      });
    }
  }

  /** Carte Kanban individuelle */
  function _renderKanbanCard(item, viewName, badgeMap) {
    const isInvoice = viewName === 'invoices';
    const reste = isInvoice
      ? Math.max(0, (item.totalTTC || 0) - _totalPaiements(item.paiements))
      : null;

    return `
      <div data-kanban-id="${item.id}" style="
          background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;
          padding:12px 14px;cursor:pointer;transition:box-shadow 0.2s,transform 0.15s;"
        onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.3)';this.style.transform='translateY(-1px)'"
        onmouseleave="this.style.boxShadow='none';this.style.transform='none'">
        <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);
          margin-bottom:4px;">${_esc(item.ref || '—')}</div>
        <div style="font-weight:600;font-size:13px;color:var(--text-primary);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:6px;">
          ${_esc(item.client || '—')}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);">
            ${_fmt(item.totalTTC || 0)}
          </span>
          ${isInvoice && reste !== null ? `<span style="font-size:11px;font-weight:700;color:${reste > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">
            ${reste > 0 ? '−' + _fmt(reste) : '✓ Payé'}
          </span>` : `<span style="font-size:11px;color:var(--text-muted);">${_fmtDate(item.date || '')}</span>`}
        </div>
      </div>`;
  }

  /* ================================================================
     VUE DEVIS (QUOTES)
     ================================================================ */

  /* ---- Liste des devis ---- */
  function _renderQuotesList(toolbar, area) {
    let allDevis = Store.getAll('devis');
    const isKanban = _state.listMode === 'kanban';

    toolbar.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btn-new-quote">+ Nouveau Devis</button>
      <select class="form-control" id="filter-quote-statut"
        style="height:28px;width:140px;font-size:12px;">
        <option value="">Tous les statuts</option>
        ${STATUTS_DEVIS.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <input type="text" id="filter-quote-client" placeholder="🔍 Client..."
        class="form-control" style="height:28px;width:140px;font-size:12px;">
      <input type="date" id="filter-quote-from" title="Date début"
        class="form-control" style="height:28px;width:130px;font-size:12px;">
      <input type="date" id="filter-quote-to" title="Date fin"
        class="form-control" style="height:28px;width:130px;font-size:12px;">
      <div style="display:flex;gap:4px;margin-left:4px;">
        <button class="btn ${!isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-q-list">☰</button>
        <button class="btn ${isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-q-kanban">⊞</button>
      </div>`;

    const _applyQuoteFilters = () => {
      const statut = document.getElementById('filter-quote-statut')?.value || '';
      const client = (document.getElementById('filter-quote-client')?.value || '').toLowerCase();
      const from   = document.getElementById('filter-quote-from')?.value || '';
      const to     = document.getElementById('filter-quote-to')?.value || '';
      let filtered = allDevis;
      if (statut) filtered = filtered.filter(d => d.statut === statut);
      if (client) filtered = filtered.filter(d => (d.client || '').toLowerCase().includes(client));
      if (from)   filtered = filtered.filter(d => (d.date || '') >= from);
      if (to)     filtered = filtered.filter(d => (d.date || '') <= to);
      if (isKanban) _drawKanban(filtered, STATUTS_DEVIS, BADGE_DEVIS, 'quotes', toolbar, area);
      else _drawQuotesTable(filtered, toolbar, area);
    };

    document.getElementById('btn-new-quote')
      ?.addEventListener('click', () => _goForm('quotes', null, toolbar, area));
    document.getElementById('btn-q-list')?.addEventListener('click', () => {
      _state.listMode = 'list'; _renderQuotesList(toolbar, area);
    });
    document.getElementById('btn-q-kanban')?.addEventListener('click', () => {
      _state.listMode = 'kanban'; _renderQuotesList(toolbar, area);
    });
    document.getElementById('filter-quote-statut')?.addEventListener('change', _applyQuoteFilters);
    document.getElementById('filter-quote-client')?.addEventListener('input', _applyQuoteFilters);
    document.getElementById('filter-quote-from')?.addEventListener('change', _applyQuoteFilters);
    document.getElementById('filter-quote-to')?.addEventListener('change', _applyQuoteFilters);

    area.innerHTML = `
      <div class="page-header">
        <div class="page-title">Devis</div>
        <div class="page-subtitle">${allDevis.length} document(s)</div>
      </div>
      <div id="sales-quotes-table"></div>`;

    if (isKanban) _drawKanban(allDevis, STATUTS_DEVIS, BADGE_DEVIS, 'quotes', toolbar, area);
    else _drawQuotesTable(allDevis, toolbar, area);
  }

  function _drawQuotesTable(data, toolbar, area) {
    renderTable('sales-quotes-table', {
      searchable: true,
      sortable:   true,
      data,
      columns: [
        { key: 'ref',      label: 'Numéro',    render: (v) => `<span class="col-ref">${_esc(v)}</span>` },
        { key: 'date',     label: 'Date',       type: 'date' },
        { key: 'client',   label: 'Client',     type: 'text' },
        { key: 'dateExpiration', label: 'Validité', type: 'date' },
        { key: 'modeReglement', label: 'Règlement', render: (v, row) => {
            const parts = [];
            if (v) parts.push(`<span class="chip no-dot">${REG_ICONS[v] || '💰'} ${_esc(v)}</span>`);
            if (row.resteAPayer > 0.01)
              parts.push(`<span style="color:var(--accent-red);font-size:11px;font-weight:600;">
                Reste ${_fmt(row.resteAPayer)}</span>`);
            else if (row.totalRegle > 0)
              parts.push(`<span style="color:var(--accent-green);font-size:11px;">✔ Soldé</span>`);
            return parts.length ? `<div style="display:flex;flex-direction:column;gap:2px;">${parts.join('')}</div>`
                                : '<span style="color:var(--text-muted)">—</span>';
          }
        },
        { key: 'totalTTC', label: 'Total TTC',  render: (v) => `<span class="mono">${_fmt(v)}</span>` },
        { key: 'statut',   label: 'Statut',     type: 'badge', badgeMap: BADGE_DEVIS }
      ],
      onRowClick: (item) => _goForm('quotes', item.id, toolbar, area),
      emptyMsg:   'Aucun devis. Cliquez sur "+ Nouveau Devis" pour commencer.'
    });
  }

  /* ---- Formulaire devis ---- */
  function _renderQuoteForm(toolbar, area) {
    const isNew = !_state.currentId;
    const doc   = isNew ? null : Store.getById('devis', _state.currentId);

    if (!isNew && !doc) {
      toast('Devis introuvable.', 'error');
      return _goList('quotes', toolbar, area);
    }

    _state.lignes = doc ? doc.lignes.map(l => ({ ...l })) : [];

    const ref    = doc?.ref    || _genRef('DEV', 'devis');
    const statut = doc?.statut || 'Brouillon';

    /* Toolbar : retour + boutons d'actions */
    toolbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-back">← Retour</button>
      ${_quoteActionBtns(statut, isNew)}`;

    document.getElementById('btn-back')
      ?.addEventListener('click', () => _goList('quotes', toolbar, area));

    const reglChip = (() => {
      if (!doc?.paiementsDevis?.length && !doc?.modeReglement) return '';
      const chips = [];
      if (doc.modeReglement) {
        const icon = REG_ICONS[doc.modeReglement] || '💰';
        chips.push(`<span class="chip no-dot">${icon} ${_esc(doc.modeReglement)}</span>`);
      }
      if (doc.totalRegle > 0) {
        chips.push(`<span class="chip no-dot" style="color:var(--accent-green);">✔ Réglé : ${_fmt(doc.totalRegle)}</span>`);
      }
      if (doc.resteAPayer > 0.01) {
        chips.push(`<span class="chip no-dot" style="color:var(--accent-red);">Reste : ${_fmt(doc.resteAPayer)}</span>`);
      }
      return chips.join('');
    })();

    area.innerHTML = `
      ${_renderFormHeader(ref, statut, BADGE_DEVIS, reglChip)}

      <!-- Informations générales -->
      <div class="form-section">
        <div class="form-section-title">Informations générales</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label required">Client</label>
            <select class="form-control" id="q-client" required>
              <option value="">— Choisir un client —</option>
              <option value="__new__" style="color:var(--accent-blue);font-weight:600;">➕ Créer nouveau client</option>
              ${Store.getAll('contacts').map(c =>
                `<option value="${c.id}" ${doc?.contactId === c.id ? 'selected' : ''}>${_esc(c.nom)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label required">Date du devis</label>
            <input type="date" class="form-control" id="q-date"
              value="${doc?.date || new Date().toISOString().slice(0,10)}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Validité jusqu'au</label>
            <input type="date" class="form-control" id="q-validite"
              value="${doc?.dateExpiration || ''}" />
          </div>
          <div class="form-group span-full">
            <label class="form-label">Notes / Conditions</label>
            <textarea class="form-control" id="q-notes" rows="2"
              placeholder="Délais, conditions particulières…">${_esc(doc?.notes || '')}</textarea>
          </div>
        </div>
      </div>

      <!-- Articles -->
      <div class="form-section">
        <div class="form-section-title">Articles</div>
        ${_renderLineTable(_state.lignes)}
      </div>

      <!-- Totaux -->
      <div class="form-section" style="padding:0;">
        ${_renderTotalsBlock(_state.lignes)}
      </div>

      <!-- Règlement -->
      <div class="form-section" id="reglement-section">
        <div class="form-section-title">Règlement</div>
        <div id="reg-lines"></div>
        <button class="btn-add-line" id="btn-add-reg" style="margin-top:8px;">
          + Ajouter un mode de règlement
        </button>
        <div id="reg-totaux" style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px;"></div>
      </div>

      <!-- Pied de formulaire -->
      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:16px;">
        <button class="btn btn-ghost" id="q-cancel">Annuler</button>
        <button class="btn btn-primary" id="q-save">✔ Sauvegarder</button>
      </div>`;

    /* Initialiser les lignes de règlement depuis le doc existant */
    _paiementsDevis = doc?.paiementsDevis ? doc.paiementsDevis.map(p => ({ ...p })) : [];
    _renderReglementLines(area);
    _refreshReglementTotaux(area);
    _bindReglementEvents(area);

    _bindLineTableEvents();
    _bindQuoteFormEvents(isNew, doc, ref, toolbar, area);
  }

  /* ----------------------------------------------------------------
     RÈGLEMENT DEVIS — affichage, calcul et interactions
     ---------------------------------------------------------------- */

  /** Redessine la liste des lignes de règlement dans le DOM */
  function _renderReglementLines(area) {
    const container = area.querySelector('#reg-lines');
    if (!container) return;
    if (_paiementsDevis.length === 0) {
      container.innerHTML = `<p style="color:var(--text-muted);font-size:12px;margin-bottom:4px;">
        Aucun règlement enregistré — cliquez sur "+ Ajouter" ci-dessous.</p>`;
      return;
    }
    container.innerHTML = _paiementsDevis.map((p, i) => `
      <div class="reglement-line" data-idx="${i}"
           style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <select class="form-control reg-mode" data-idx="${i}"
                style="width:180px;flex-shrink:0;">
          ${REG_MODES.map(m =>
            `<option value="${m}" ${p.mode === m ? 'selected' : ''}>
              ${REG_ICONS[m]} ${m}
            </option>`
          ).join('')}
        </select>
        <div class="input-suffix" style="flex:1;max-width:200px;">
          <input type="number" class="form-control reg-montant" data-idx="${i}"
                 value="${p.montant || ''}" min="0" placeholder="0"
                 style="text-align:right;" />
          <span class="suffix-label">XPF</span>
        </div>
        <button class="btn btn-ghost btn-sm btn-rem-reg" data-idx="${i}"
                title="Supprimer cette ligne" style="flex-shrink:0;">✕</button>
      </div>`).join('');
  }

  /** Recalcule et affiche le résumé règlement + reste à payer */
  function _refreshReglementTotaux(area) {
    const box = area.querySelector('#reg-totaux');
    if (!box) return;
    const totalTTC    = _calcTotaux(_state.lignes).totalTTC || 0;
    const totalRegle  = _paiementsDevis.reduce((s, p) => s + (parseFloat(p.montant) || 0), 0);
    const reste       = totalTTC - totalRegle;
    const resteColor  = reste > 0.01  ? 'var(--accent-red)'
                      : reste < -0.01 ? 'var(--accent-orange)'
                      : 'var(--accent-green)';
    const resteLabel  = reste > 0.01  ? 'Reste à payer'
                      : reste < -0.01 ? 'Trop-perçu'
                      : 'Solde';

    box.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <div style="display:flex;gap:32px;font-size:13px;">
          <span style="color:var(--text-secondary);">Total TTC</span>
          <span class="mono" style="font-weight:600;">${_fmt(totalTTC)}</span>
        </div>
        <div style="display:flex;gap:32px;font-size:13px;">
          <span style="color:var(--text-secondary);">Total réglé</span>
          <span class="mono" style="font-weight:600;">${_fmt(totalRegle)}</span>
        </div>
        <div style="display:flex;gap:32px;align-items:center;font-size:14px;
                    font-weight:700;border-top:1px solid var(--border);
                    padding-top:8px;margin-top:2px;">
          <span style="color:${resteColor};">${resteLabel}</span>
          <span class="mono" style="color:${resteColor};">${_fmt(Math.abs(reste))}</span>
        </div>
        ${totalRegle > 0 && reste > 0.01 ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;
                    padding:8px 12px;background:#FFFBEB;border:1px solid #FDE68A;
                    border-radius:var(--radius-md);font-size:12px;">
          <span>📄</span>
          <span style="color:var(--accent-orange);">
            <strong>Facture partielle</strong> de ${_fmt(totalRegle)} sera générée à la sauvegarde —
            reste <strong>${_fmt(reste)}</strong> à régler.
          </span>
        </div>` : ''}
        ${totalRegle > 0 && reste <= 0.01 ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;
                    padding:8px 12px;background:#F0FDF4;border:1px solid #BBF7D0;
                    border-radius:var(--radius-md);font-size:12px;">
          <span>✅</span>
          <span style="color:var(--accent-green);">
            <strong>Facture totale</strong> sera générée et le devis passera en Confirmé à la sauvegarde.
          </span>
        </div>` : ''}
        ${reste < -0.01 ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;
                    padding:8px 12px;background:#FEF2F2;border:1px solid #FECACA;
                    border-radius:var(--radius-md);font-size:12px;">
          <span>⚠️</span>
          <span style="color:var(--accent-red);">Montant réglé supérieur au total — vérifiez les montants.</span>
        </div>` : ''}
      </div>`;
  }

  /** Gère les événements de la section règlement (ajout, suppression, saisie) */
  function _bindReglementEvents(area) {
    /* Ajouter une ligne */
    area.querySelector('#btn-add-reg')?.addEventListener('click', () => {
      _paiementsDevis.push({ mode: REG_MODES[0], montant: '' });
      _renderReglementLines(area);
      _refreshReglementTotaux(area);
      _bindReglementEvents(area);
    });

    /* Suppression ligne */
    area.querySelectorAll('.btn-rem-reg').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        _paiementsDevis.splice(idx, 1);
        _renderReglementLines(area);
        _refreshReglementTotaux(area);
        _bindReglementEvents(area);
      });
    });

    /* Changement mode */
    area.querySelectorAll('.reg-mode').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.idx);
        _paiementsDevis[idx].mode = sel.value;
      });
    });

    /* Saisie montant → recalcul en temps réel */
    area.querySelectorAll('.reg-montant').forEach(inp => {
      inp.addEventListener('input', () => {
        const idx = parseInt(inp.dataset.idx);
        _paiementsDevis[idx].montant = parseFloat(inp.value) || 0;
        _refreshReglementTotaux(area);
        /* Rebind uniquement le bouton facture partielle (pas toute la section) */
        area.querySelector('#btn-facture-partielle')?.addEventListener('click', () => {
          const currentDoc = Store.getById('devis', _state.currentId);
          if (!currentDoc) { toast('Sauvegardez d\'abord le devis.', 'warning'); return; }
          const totalTTC   = _calcTotaux(_state.lignes).totalTTC || 0;
          const totalRegle = _paiementsDevis.reduce((s, p) => s + (parseFloat(p.montant)||0), 0);
          _createPartialInvoice(currentDoc, totalTTC - totalRegle, area);
        });
      });
    });
  }

  /** Crée une facture partielle pour le montant restant */
  function _createPartialInvoice(devis, reste, area) {
    const ref = _genRef('FAC', 'factures');
    const ligne = {
      id:            'l-' + Date.now(),
      produit:       `Acompte sur devis ${devis.ref}`,
      qte:           1,
      prixUnitaire:  Math.round(reste / 1.13),  // montant HT depuis TTC
      remise:        0
    };
    const totaux = _calcTotaux([ligne]);
    Store.create('factures', {
      ref,
      _type:         'Facture',
      contactId:     devis.contactId,
      client:        devis.client,
      date:          new Date().toISOString().slice(0, 10),
      statut:        'Brouillon',
      devisId:       devis.id,
      lignes:        [ligne],
      paiements:     [],
      ...totaux,
      notes:         `Facture partielle — solde restant sur ${devis.ref}`
    });
    toast(`📄 Facture partielle ${ref} créée (${_fmt(reste)}).`, 'success');
  }

  /**
   * Génère ou met à jour la facture liée à un devis réglé.
   * - Règlement total (resteAPayer ≤ 0) → facture avec toutes les lignes du devis, statut "Payé"
   * - Règlement partiel (resteAPayer > 0) → facture d'acompte pour le montant réglé, statut "Payé partiel"
   * Détecte si une facture existe déjà (devisId) pour mettre à jour plutôt que créer.
   */
  function _genererFactureDepuisDevis(devis, paiementsDevis, totalRegle, resteAPayer, totauxDevis) {
    const isTotal = resteAPayer <= 0.01;

    /* Paiements à enregistrer dans la facture */
    const facPaiements = paiementsDevis.map((p, i) => ({
      id:      `pay-${Date.now()}-${i}`,
      date:    new Date().toISOString().slice(0, 10),
      methode: p.mode,
      montant: p.montant,
      type:    'Paiement'
    }));

    let lignesFac, totauxFac, facStatut, typeLabel;

    if (isTotal) {
      /* Facture totale : reprend toutes les lignes du devis */
      lignesFac  = devis.lignes;
      totauxFac  = totauxDevis;
      facStatut  = 'Payé';
      typeLabel  = 'totale';
    } else {
      /* Facture partielle : une ligne d'acompte = montant HT calculé depuis TTC */
      const htAcompte = Math.round(totalRegle / 1.13);
      const ligne = {
        id:           `l-${Date.now()}`,
        produit:      `Acompte sur devis ${devis.ref}`,
        qte:          1,
        prixUnitaire: htAcompte,
        remise:       0
      };
      lignesFac = [ligne];
      totauxFac = _calcTotaux(lignesFac);
      facStatut = 'Payé partiel';
      typeLabel = 'partielle';
    }

    const today   = new Date().toISOString().slice(0, 10);
    const facData = {
      _type:     'Facture',
      contactId: devis.contactId,
      client:    devis.client,
      date:      today,
      statut:    facStatut,
      devisId:   devis.id,
      lignes:    lignesFac,
      paiements: facPaiements,
      notes:     `Facture ${typeLabel} — ${devis.ref}${resteAPayer > 0.01 ? ` — Reste à payer : ${_fmt(resteAPayer)}` : ''}`,
      ...totauxFac
    };

    /* Cherche une facture déjà liée à ce devis */
    const existante = Store.getAll('factures').find(f => f.devisId === devis.id);
    let facRef;

    if (existante) {
      /* Mise à jour de la facture existante */
      facRef = existante.ref;
      Store.update('factures', existante.id, facData);
      toast(`📄 Facture ${facRef} mise à jour (${typeLabel}, ${_fmt(totalRegle)} réglé).`, 'info');
    } else {
      /* Création d'une nouvelle facture */
      facRef = _genRef('FAC', 'factures');
      Store.create('factures', { ref: facRef, ...facData });
      toast(`📄 Facture ${facRef} créée (${typeLabel}, ${_fmt(totalRegle)} réglé).`, 'success');
    }

    /* ----------------------------------------------------------------
       ÉCRITURES COMPTABLES AUTOMATIQUES
       Supprimer les écritures précédentes de cette pièce, puis recréer
       ---------------------------------------------------------------- */
    const now = new Date().toISOString();

    /* Nettoyer les anciennes écritures automatiques pour cette pièce */
    Store.getAll('ecritures')
      .filter(e => e.pieceRef === facRef && e.type === 'vente')
      .forEach(e => Store.remove('ecritures', e.id));

    /* 1 — Constatation de la vente : Débit Clients / Crédit Ventes + TVA */
    const totalHT  = totauxFac.totalHT  || 0;
    const totalTVA = (totauxFac.totalTTC || 0) - totalHT;
    const totalTTC = totauxFac.totalTTC  || 0;

    Store.create('ecritures', {
      date: today, createdAt: now,
      compte:   '411000',
      journal:  'Ventes',
      libelle:  `Vente — ${devis.client} / ${facRef}`,
      debit:    Math.round(totalTTC),
      credit:   0,
      pieceRef: facRef,
      type:     'vente'
    });
    Store.create('ecritures', {
      date: today, createdAt: now,
      compte:   '700000',
      journal:  'Ventes',
      libelle:  `CA — ${devis.client} / ${facRef}`,
      debit:    0,
      credit:   Math.round(totalHT),
      pieceRef: facRef,
      type:     'vente'
    });
    if (totalTVA > 0) {
      Store.create('ecritures', {
        date: today, createdAt: now,
        compte:   '445700',
        journal:  'Ventes',
        libelle:  `TVA collectée — ${facRef}`,
        debit:    0,
        credit:   Math.round(totalTVA),
        pieceRef: facRef,
        type:     'vente'
      });
    }

    /* 2 — Règlements reçus : Débit Trésorerie / Crédit Clients */
    const COMPTE_TRESORERIE = {
      'Espèces':   '530000', // Caisse
      'Chèque':    '512000',
      'Virement':  '512000',
      'CB':        '512000',
      'Carte':     '512000',
      'Mobile':    '512000',
      'Mixte':     '512000'
    };

    facPaiements.forEach(p => {
      const compteTresor = COMPTE_TRESORERIE[p.methode] || '512000';
      const libTresor    = compteTresor === '530000' ? 'Caisse' : 'Banque';

      /* Débit trésorerie */
      Store.create('ecritures', {
        date: today, createdAt: now,
        compte:   compteTresor,
        journal:  'Trésorerie',
        libelle:  `${libTresor} — ${p.methode} / ${facRef}`,
        debit:    Math.round(p.montant || 0),
        credit:   0,
        pieceRef: facRef,
        type:     'vente'
      });
      /* Crédit 411 Clients */
      Store.create('ecritures', {
        date: today, createdAt: now,
        compte:   '411000',
        journal:  'Trésorerie',
        libelle:  `Règlement ${devis.client} — ${facRef}`,
        debit:    0,
        credit:   Math.round(p.montant || 0),
        pieceRef: facRef,
        type:     'vente'
      });
    });
  }

  function _quoteActionBtns(statut, isNew) {
    if (isNew) return '';
    const btns = [];
    /* Aperçu disponible pour tous les devis enregistrés */
    btns.push(`<button class="btn btn-ghost btn-sm" data-q-action="apercu" title="Aperçu du document devis">📄 Aperçu</button>`);
    if (statut === 'Brouillon') {
      btns.push(`<button class="btn btn-ghost btn-sm" data-q-action="envoyer">📤 Envoyer</button>`);
    }
    if (['Brouillon', 'Envoyé'].includes(statut)) {
      btns.push(`<button class="btn btn-success btn-sm" data-q-action="confirmer">✔ Confirmer</button>`);
      btns.push(`<button class="btn btn-danger btn-sm"  data-q-action="annuler">✕ Annuler</button>`);
    }
    /* Conversion facture disponible dès "Envoyé" (client valide) ou "Confirmé" */
    if (['Envoyé', 'Confirmé'].includes(statut)) {
      btns.push(`<button class="btn btn-success btn-sm" data-q-action="facturer" title="Le client valide — convertir en facture">🧾 → Facture</button>`);
    }
    if (statut === 'Confirmé') {
      btns.push(`<button class="btn btn-primary btn-sm" data-q-action="convertir">📦 → Commande</button>`);
    }
    return btns.join('');
  }

  function _bindQuoteFormEvents(isNew, doc, ref, toolbar, area) {
    /* Création rapide client depuis la liste déroulante */
    _bindClientSelectCreation('q-client');

    /* Remise client spéciale : appliquée dès la sélection */
    document.getElementById('q-client')?.addEventListener('change', () => {
      _applyRemiseClient('q-client');
    });

    /* Sauvegarder */
    document.getElementById('q-save')?.addEventListener('click', () => {
      const contactId = document.getElementById('q-client')?.value;
      if (!contactId || contactId === '__new__') { toast('Veuillez sélectionner un client.', 'error'); return; }
      if (_state.lignes.length === 0) { toast('Ajoutez au moins un article.', 'error'); return; }

      /* Collecter les montants saisis dans le DOM (évite désync) */
      area.querySelectorAll('.reg-montant').forEach(inp => {
        const idx = parseInt(inp.dataset.idx);
        if (_paiementsDevis[idx]) _paiementsDevis[idx].montant = parseFloat(inp.value) || 0;
      });
      area.querySelectorAll('.reg-mode').forEach(sel => {
        const idx = parseInt(sel.dataset.idx);
        if (_paiementsDevis[idx]) _paiementsDevis[idx].mode = sel.value;
      });

      const paiementsDevis = _paiementsDevis.filter(p => p.montant > 0);
      const totalRegle  = paiementsDevis.reduce((s, p) => s + (p.montant || 0), 0);
      const totaux      = _calcTotaux(_state.lignes);
      const resteAPayer = Math.max(0, (totaux.totalTTC || 0) - totalRegle);

      /* Mode de règlement principal (pour la liste) */
      const modeReglement = paiementsDevis.length === 1
        ? paiementsDevis[0].mode
        : paiementsDevis.length > 1 ? 'Mixte' : '';

      /* Si un règlement est saisi → confirmer automatiquement le devis */
      const statutFinal = (totalRegle > 0 && (doc?.statut || 'Brouillon') !== 'Annulé')
        ? 'Confirmé'
        : (doc?.statut || 'Brouillon');

      const record = {
        ref,
        _type:          'Devis',
        contactId,
        client:         _contactNom(contactId),
        date:           document.getElementById('q-date')?.value    || '',
        dateExpiration: document.getElementById('q-validite')?.value || '',
        modeReglement,
        paiementsDevis,
        totalRegle,
        resteAPayer,
        notes:          document.getElementById('q-notes')?.value   || '',
        statut:         statutFinal,
        lignes:         _state.lignes,
        ...totaux
      };

      /* 1 — Sauvegarder le devis */
      let savedDevis;
      if (isNew) {
        savedDevis = Store.create('devis', record);
        toast('Devis créé.', 'success');
      } else {
        Store.update('devis', doc.id, record);
        savedDevis = { ...record, id: doc.id };
        toast('Devis sauvegardé.', 'success');
      }

      /* 2 — Si règlement > 0 : générer ou mettre à jour la facture */
      if (totalRegle > 0) {
        _genererFactureDepuisDevis(savedDevis, paiementsDevis, totalRegle, resteAPayer, totaux);
      }

      _goList('quotes', toolbar, area);
    });

    document.getElementById('q-cancel')
      ?.addEventListener('click', () => _goList('quotes', toolbar, area));

    /* Boutons d'action statut */
    toolbar.querySelectorAll('[data-q-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.qAction;

        if (action === 'apercu') {
          _previewDevis(doc, toolbar, area);
          return;
        }

        if (action === 'convertir') {
          _convertQuoteToOrder(doc, toolbar, area);
          return;
        }

        if (action === 'facturer') {
          _createInvoiceFromQuote(doc, toolbar, area);
          return;
        }

        const newStatut = { envoyer: 'Envoyé', confirmer: 'Confirmé', annuler: 'Annulé' }[action];
        if (newStatut) {
          showConfirm(`Passer ce devis en "${newStatut}" ?`, () => {
            Store.update('devis', doc.id, { statut: newStatut });
            toast(`Devis ${newStatut.toLowerCase()}.`, 'success');
            _goList('quotes', toolbar, area);
          });
        }
      });
    });
  }

  /* ----------------------------------------------------------------
     APERÇU DEVIS — document mis en forme + options impression / facture
     ---------------------------------------------------------------- */

  /**
   * Ouvre une fenêtre d'aperçu du devis avec mise en forme professionnelle.
   * Propose d'imprimer le document et, si le statut le permet, de convertir en facture.
   */
  function _previewDevis(devis, toolbar, area) {
    const contact = Store.getById('contacts', devis.contactId) || {};
    const peutFacturer = ['Envoyé', 'Confirmé'].includes(devis.statut);

    /* Calcul des totaux ligne par ligne pour affichage détaillé */
    const lignesHtml = (devis.lignes || []).map(l => {
      const brut   = (l.qte || 0) * (l.prixUnitaire || 0);
      const remise = brut * ((l.remise || 0) / 100);
      const ht     = brut - remise;
      const taux   = (l.tauxTVA !== undefined ? l.tauxTVA : 16);
      const tva    = Math.round(ht * taux / 100);
      const ttc    = Math.round(ht + tva);
      return `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">
            ${_esc(l.produit || l.description || '—')}
            ${l.description && l.produit ? `<br><span style="color:#6b7280;font-size:11px;">${_esc(l.description)}</span>` : ''}
          </td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">${l.qte || 0}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-family:monospace;">${_fmt(l.prixUnitaire || 0)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">${l.remise ? l.remise + ' %' : '—'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:12px;color:#6b7280;">${taux} %</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-size:13px;font-weight:600;font-family:monospace;">${_fmt(ttc)}</td>
        </tr>`;
    }).join('');

    /* Ligne de règlements déjà enregistrés */
    const reglHtml = (devis.paiementsDevis || []).filter(p => p.montant > 0).map(p =>
      `<div style="display:flex;justify-content:space-between;font-size:12px;color:#374151;padding:3px 0;">
        <span>${REG_ICONS[p.mode] || '💰'} ${_esc(p.mode)}</span>
        <span style="font-family:monospace;font-weight:600;">${_fmt(p.montant)}</span>
      </div>`
    ).join('');

    /* Statut badge couleurs */
    const BADGE_COLORS = {
      'Brouillon': { bg: '#f3f4f6', color: '#374151' },
      'Envoyé':    { bg: '#dbeafe', color: '#1d4ed8' },
      'Confirmé':  { bg: '#dcfce7', color: '#15803d' },
      'Annulé':    { bg: '#fee2e2', color: '#dc2626' }
    };
    const badgeStyle = BADGE_COLORS[devis.statut] || BADGE_COLORS['Brouillon'];

    const documentHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Devis ${_esc(devis.ref)}</title>
        <style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color:#111827; background:#fff; }
          .page { max-width:800px; margin:0 auto; padding:40px 32px; }

          /* En-tête société */
          .header { display:flex; justify-content:space-between; align-items:flex-start;
                    padding-bottom:24px; border-bottom:3px solid #4a5fff; margin-bottom:28px; }
          .brand-name { font-size:22px; font-weight:800; color:#4a5fff; letter-spacing:-0.5px; }
          .brand-sub  { font-size:11px; color:#6b7280; margin-top:2px; }
          .brand-contact { text-align:right; font-size:11px; color:#6b7280; line-height:1.8; }

          /* Bloc doc info */
          .doc-meta { display:flex; justify-content:space-between; align-items:flex-start;
                      margin-bottom:28px; }
          .doc-title { font-size:26px; font-weight:800; color:#111827; }
          .doc-ref   { font-size:13px; color:#6b7280; font-family:monospace; margin-top:4px; }
          .doc-badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px;
                       font-weight:700; background:${badgeStyle.bg}; color:${badgeStyle.color};
                       margin-top:8px; }
          .doc-dates { text-align:right; font-size:12px; color:#374151; line-height:2; }
          .doc-dates strong { color:#111827; }

          /* Bloc client */
          .section-title { font-size:10px; font-weight:700; color:#6b7280; text-transform:uppercase;
                           letter-spacing:1px; margin-bottom:8px; }
          .client-box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px;
                        padding:14px 18px; margin-bottom:28px; }
          .client-name { font-size:15px; font-weight:700; color:#111827; margin-bottom:4px; }
          .client-detail { font-size:12px; color:#6b7280; line-height:1.8; }

          /* Tableau articles */
          table { width:100%; border-collapse:collapse; margin-bottom:24px; }
          thead th { background:#4a5fff; color:#fff; padding:10px 10px; text-align:left;
                     font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
          thead th:not(:first-child) { text-align:center; }
          thead th:last-child { text-align:right; }
          tbody tr:last-child td { border-bottom:none; }

          /* Totaux */
          .totaux { display:flex; justify-content:flex-end; margin-bottom:24px; }
          .totaux-box { width:280px; }
          .totaux-row { display:flex; justify-content:space-between; padding:5px 0;
                        font-size:13px; color:#374151; border-bottom:1px solid #f3f4f6; }
          .totaux-row.ttc { font-size:16px; font-weight:800; color:#111827;
                            border-top:2px solid #4a5fff; border-bottom:none;
                            padding-top:10px; margin-top:4px; }
          .mono { font-family:monospace; }

          /* Règlements */
          .regl-box { background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;
                      padding:12px 16px; margin-bottom:24px; }
          .regl-title { font-size:11px; font-weight:700; color:#15803d; margin-bottom:8px; }

          /* Notes */
          .notes-box { background:#fffbeb; border:1px solid #fde68a; border-radius:8px;
                       padding:12px 16px; margin-bottom:28px; font-size:12px; color:#374151;
                       line-height:1.7; }

          /* Footer doc */
          .doc-footer { text-align:center; font-size:10px; color:#9ca3af;
                        border-top:1px solid #e5e7eb; padding-top:16px; margin-top:8px; }

          /* Boutons interface (masqués à l'impression) */
          .ui-actions { display:flex; gap:10px; justify-content:flex-end;
                        padding:16px 0 4px 0; margin-bottom:16px; }
          .btn-print   { padding:9px 20px; background:#4a5fff; color:#fff; border:none;
                         border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
          .btn-facture { padding:9px 20px; background:#22c55e; color:#fff; border:none;
                         border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
          .btn-email   { padding:9px 20px; background:#f97316; color:#fff; border:none;
                         border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
          .btn-close   { padding:9px 16px; background:#f3f4f6; color:#374151; border:none;
                         border-radius:8px; font-size:13px; cursor:pointer; }
          .email-tip   { background:#fffbeb; border:1px solid #fde68a; border-radius:8px;
                         padding:12px 16px; font-size:12px; color:#374151; margin-bottom:12px;
                         display:none; line-height:1.7; }

          @media print {
            .ui-actions { display:none !important; }
            body { padding:0; }
            .page { padding:20px; }
          }
        </style>
      </head>
      <body>
        <div class="page">

          <!-- Boutons interface -->
          <div class="email-tip" id="email-tip">
            <strong>📧 Comment envoyer par email :</strong><br>
            1. Clique sur <strong>🖨 Imprimer</strong> → dans la boîte d'impression, choisis <strong>"Enregistrer en PDF"</strong><br>
            2. Reviens ici et clique <strong>📧 Composer l'email</strong> — ton client de messagerie s'ouvrira avec le devis pré-rempli<br>
            3. Joint le PDF que tu viens de sauvegarder et envoie !
          </div>
          <div class="ui-actions">
            <button class="btn-close" onclick="window.close()">✕ Fermer</button>
            ${peutFacturer
              ? `<button class="btn-facture" id="btn-doc-facturer">🧾 Convertir en Facture</button>`
              : ''}
            <button class="btn-email" id="btn-doc-email">📧 Envoyer par email</button>
            <button class="btn-print" id="btn-doc-print">🖨 Imprimer / PDF</button>
          </div>

          <!-- En-tête société -->
          <div class="header">
            <div>
              <div class="brand-name">HCS — High Coffee Shirts</div>
              <div class="brand-sub">Tenue · Sublimation · DTF · Broderie · Impression textile</div>
            </div>
            <div class="brand-contact">
              Tahiti, Polynésie française<br>
              contact@highcoffeeshirts.com<br>
              highcoffeeshirts.com
            </div>
          </div>

          <!-- Identité du document -->
          <div class="doc-meta">
            <div>
              <div class="doc-title">DEVIS</div>
              <div class="doc-ref">${_esc(devis.ref)}</div>
              <div class="doc-badge">${_esc(devis.statut)}</div>
            </div>
            <div class="doc-dates">
              <div>Date : <strong>${_fmtDate(devis.date)}</strong></div>
              ${devis.dateExpiration
                ? `<div>Validité : <strong>${_fmtDate(devis.dateExpiration)}</strong></div>`
                : ''}
            </div>
          </div>

          <!-- Client -->
          <div class="section-title">Client</div>
          <div class="client-box">
            <div class="client-name">${_esc(devis.client || contact.nom || '—')}</div>
            <div class="client-detail">
              ${contact.email ? `📧 ${_esc(contact.email)}<br>` : ''}
              ${contact.tel   ? `📞 ${_esc(contact.tel)}<br>`   : ''}
              ${contact.type  ? `🏷 ${_esc(contact.type)}`      : ''}
            </div>
          </div>

          <!-- Articles -->
          <div class="section-title">Articles</div>
          <table>
            <thead>
              <tr>
                <th style="width:40%;">Désignation</th>
                <th style="width:8%;">Qté</th>
                <th style="width:14%;">PU HT</th>
                <th style="width:10%;">Remise</th>
                <th style="width:10%;">TVA</th>
                <th style="width:18%;">Total TTC</th>
              </tr>
            </thead>
            <tbody>
              ${lignesHtml || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#6b7280;">Aucun article</td></tr>'}
            </tbody>
          </table>

          <!-- Totaux -->
          <div class="totaux">
            <div class="totaux-box">
              <div class="totaux-row">
                <span>Total HT</span>
                <span class="mono">${_fmt(devis.totalHT || 0)}</span>
              </div>
              <div class="totaux-row">
                <span>TVA</span>
                <span class="mono">${_fmt(devis.totalTVA || 0)}</span>
              </div>
              <div class="totaux-row ttc">
                <span>Total TTC</span>
                <span class="mono">${_fmt(devis.totalTTC || 0)}</span>
              </div>
            </div>
          </div>

          <!-- Règlements enregistrés -->
          ${reglHtml ? `
          <div class="regl-box">
            <div class="regl-title">✅ Règlements enregistrés</div>
            ${reglHtml}
            ${devis.resteAPayer > 0.01
              ? `<div style="font-size:12px;color:#dc2626;font-weight:700;margin-top:8px;padding-top:8px;border-top:1px solid #bbf7d0;">
                  Reste à payer : ${_fmt(devis.resteAPayer)}
                </div>`
              : `<div style="font-size:12px;color:#15803d;font-weight:700;margin-top:8px;">✔ Entièrement réglé</div>`}
          </div>` : ''}

          <!-- Notes / Conditions -->
          ${devis.notes ? `
          <div class="section-title">Notes &amp; Conditions</div>
          <div class="notes-box">${_esc(devis.notes).replace(/\n/g, '<br>')}</div>` : ''}

          <!-- Pied de page -->
          <div class="doc-footer">
            Document généré le ${new Date().toLocaleDateString('fr-FR')} — HCS ERP
            ${peutFacturer ? '' : '<br>Ce devis est en statut <strong>' + _esc(devis.statut) + '</strong> — envoyez-le au client pour qu\'il le valide.'}
          </div>

        </div>
      </body>
      </html>`;

    /* Ouvrir dans une nouvelle fenêtre navigateur */
    const win = window.open('', '_blank', 'width=860,height=750,scrollbars=yes,toolbar=no,menubar=no');
    if (!win) {
      toast('Le navigateur a bloqué l\'ouverture de la fenêtre. Autorisez les popups pour ce site.', 'warning');
      return;
    }
    win.document.write(documentHtml);
    win.document.close();

    /* Bouton "Convertir en Facture" dans la nouvelle fenêtre */
    if (peutFacturer) {
      win.document.getElementById('btn-doc-facturer')?.addEventListener('click', () => {
        win.close();
        _createInvoiceFromQuote(devis, toolbar, area);
      });
    }

    /* Bouton "Imprimer / PDF" */
    win.document.getElementById('btn-doc-print')?.addEventListener('click', () => {
      win.print();
    });

    /* Bouton "Envoyer par email" — génère un mailto: avec le résumé du devis */
    win.document.getElementById('btn-doc-email')?.addEventListener('click', () => {
      /* Afficher le guide étape par étape */
      const tip = win.document.getElementById('email-tip');
      if (tip) tip.style.display = tip.style.display === 'block' ? 'none' : 'block';

      /* Construire le corps de l'email */
      const lignesTxt = (devis.lignes || []).map(l => {
        const brut = (l.qte || 0) * (l.prixUnitaire || 0);
        const ht   = brut * (1 - ((l.remise || 0) / 100));
        const taux = (l.tauxTVA !== undefined ? l.tauxTVA : 16) / 100;
        const ttc  = Math.round(ht * (1 + taux));
        return `- ${l.produit || l.description || '?'} × ${l.qte || 0}  →  ${ttc.toLocaleString('fr-FR')} XPF`;
      }).join('\n');

      const corps = [
        `Bonjour,`,
        ``,
        `Veuillez trouver ci-joint le devis ${devis.ref} établi à votre attention.`,
        ``,
        `─── Récapitulatif ───`,
        `Référence : ${devis.ref}`,
        `Date      : ${devis.date || ''}`,
        devis.dateExpiration ? `Validité  : ${devis.dateExpiration}` : '',
        ``,
        `Articles :`,
        lignesTxt,
        ``,
        `Total HT  : ${(devis.totalHT || 0).toLocaleString('fr-FR')} XPF`,
        `TVA       : ${(devis.totalTVA || 0).toLocaleString('fr-FR')} XPF`,
        `Total TTC : ${(devis.totalTTC || 0).toLocaleString('fr-FR')} XPF`,
        ``,
        devis.notes ? `Conditions : ${devis.notes}` : '',
        ``,
        `Pour toute question, n'hésitez pas à nous contacter.`,
        ``,
        `Cordialement,`,
        `High Coffee Shirts — HCS`,
        `contact@highcoffeeshirts.com`
      ].filter(l => l !== '').join('\n');

      const email    = (contact.email || '').trim();
      const sujet    = encodeURIComponent(`Devis ${devis.ref} — High Coffee Shirts`);
      const body     = encodeURIComponent(corps);
      const mailto   = `mailto:${email}?subject=${sujet}&body=${body}`;

      win.location.href = mailto;
    });
  }

  function _convertQuoteToOrder(devis, toolbar, area) {
    showConfirm(
      `Convertir "${devis.ref}" en commande ? Le devis passera en "Confirmé".`,
      () => {
        const ref = _genRef('CMD', 'commandes');
        Store.create('commandes', {
          ref,
          _type:        'Commande',
          contactId:    devis.contactId,
          client:       devis.client,
          date:         new Date().toISOString().slice(0, 10),
          dateLivraison:'',
          statut:       'Confirmé',
          quoteId:      devis.id,
          lignes:       devis.lignes,
          totalHT:      devis.totalHT,
          totalTVA:     devis.totalTVA,
          totalTTC:     devis.totalTTC,
          notes:        devis.notes || ''
        });
        Store.update('devis', devis.id, { statut: 'Confirmé' });
        toast(`✔ Commande ${ref} créée depuis ${devis.ref}.`, 'success');
        _goList('quotes', toolbar, area);
      }
    );
  }

  /** Crée une facture directement depuis un devis confirmé */
  function _createInvoiceFromQuote(devis, toolbar, area) {
    showFormModal(
      `Facturer le devis ${devis.ref}`,
      [
        {
          name: 'type',
          label: 'Type de facture',
          type: 'select',
          options: [
            { value: 'totale',  label: 'Facture totale (100%)' },
            { value: 'acompte', label: 'Acompte / Facture partielle' }
          ]
        },
        {
          name: 'montantAcompte',
          label: 'Montant de l\'acompte (XPF) — si partiel',
          type: 'number'
        },
        {
          name: 'dateEcheance',
          label: 'Date d\'échéance',
          type: 'date'
        }
      ],
      { type: 'totale', dateEcheance: '' },
      (data) => {
        const ref = _genRef('FAC', 'factures');
        const isAcompte = data.type === 'acompte';
        let lignes = devis.lignes;
        let totalHT  = devis.totalHT;
        let totalTVA = devis.totalTVA;
        let totalTTC = devis.totalTTC;

        if (isAcompte && data.montantAcompte) {
          const montant = parseFloat(data.montantAcompte) || 0;
          /* Ligne unique acompte */
          lignes = [{
            produitId:    '',
            description:  `Acompte sur devis ${_esc(devis.ref)}`,
            qte:          1,
            prixUnitaire: Math.round(montant / 1.13),
            remise:       0
          }];
          const t = _calcTotaux(lignes);
          totalHT  = t.totalHT;
          totalTVA = t.totalTVA;
          totalTTC = t.totalTTC;
        }

        Store.create('factures', {
          ref,
          _type:        'Facture',
          contactId:    devis.contactId,
          client:       devis.client,
          devisId:      devis.id,
          date:         new Date().toISOString().slice(0, 10),
          dateEcheance: data.dateEcheance || '',
          statut:       'Brouillon',
          lignes,
          paiements:    [],
          totalHT,
          totalTVA,
          totalTTC,
          notes:        (isAcompte ? `Acompte sur devis ${devis.ref}` : `Facture devis ${devis.ref}`)
                        + (devis.notes ? '\n' + devis.notes : '')
        });

        toast(`✔ Facture ${ref} créée depuis ${devis.ref}.`, 'success');
        _goList('quotes', toolbar, area);
      }
    );
  }

  /* ================================================================
     VUE COMMANDES (ORDERS)
     ================================================================ */

  function _renderOrdersList(toolbar, area) {
    let allCmds = Store.getAll('commandes');
    const isKanban = _state.listMode === 'kanban';

    /* Les commandes sont créées depuis les devis — pas de création manuelle */
    toolbar.innerHTML = `
      <select class="form-control" id="filter-order-statut"
        style="height:28px;width:155px;font-size:12px;">
        <option value="">Tous les statuts</option>
        ${STATUTS_CMD.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <input type="text" id="filter-order-client" placeholder="🔍 Client..."
        class="form-control" style="height:28px;width:140px;font-size:12px;">
      <input type="date" id="filter-order-from" title="Date début"
        class="form-control" style="height:28px;width:130px;font-size:12px;">
      <input type="date" id="filter-order-to" title="Date fin"
        class="form-control" style="height:28px;width:130px;font-size:12px;">
      <div style="display:flex;gap:4px;margin-left:4px;">
        <button class="btn ${!isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-o-list">☰</button>
        <button class="btn ${isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-o-kanban">⊞</button>
      </div>`;

    const _applyOrderFilters = () => {
      const statut = document.getElementById('filter-order-statut')?.value || '';
      const client = (document.getElementById('filter-order-client')?.value || '').toLowerCase();
      const from   = document.getElementById('filter-order-from')?.value || '';
      const to     = document.getElementById('filter-order-to')?.value || '';
      let filtered = allCmds;
      if (statut) filtered = filtered.filter(c => c.statut === statut);
      if (client) filtered = filtered.filter(c => (c.client || '').toLowerCase().includes(client));
      if (from)   filtered = filtered.filter(c => (c.date || '') >= from);
      if (to)     filtered = filtered.filter(c => (c.date || '') <= to);
      if (isKanban) _drawKanban(filtered, STATUTS_CMD, BADGE_CMD, 'orders', toolbar, area);
      else _drawOrdersTable(filtered, toolbar, area);
    };

    document.getElementById('btn-o-list')?.addEventListener('click', () => {
      _state.listMode = 'list'; _renderOrdersList(toolbar, area);
    });
    document.getElementById('btn-o-kanban')?.addEventListener('click', () => {
      _state.listMode = 'kanban'; _renderOrdersList(toolbar, area);
    });
    document.getElementById('filter-order-statut')?.addEventListener('change', _applyOrderFilters);
    document.getElementById('filter-order-client')?.addEventListener('input', _applyOrderFilters);
    document.getElementById('filter-order-from')?.addEventListener('change', _applyOrderFilters);
    document.getElementById('filter-order-to')?.addEventListener('change', _applyOrderFilters);

    area.innerHTML = `
      <div class="page-header">
        <div class="page-title">Commandes</div>
        <div class="page-subtitle">${allCmds.length} document(s)</div>
      </div>
      <div id="sales-orders-table"></div>`;

    if (isKanban) _drawKanban(allCmds, STATUTS_CMD, BADGE_CMD, 'orders', toolbar, area);
    else _drawOrdersTable(allCmds, toolbar, area);
  }

  function _drawOrdersTable(data, toolbar, area) {
    renderTable('sales-orders-table', {
      searchable: true,
      sortable:   true,
      data,
      columns: [
        { key: 'ref',          label: 'Numéro',    render: (v) => `<span class="col-ref">${_esc(v)}</span>` },
        { key: 'date',         label: 'Date',       type: 'date' },
        { key: 'client',       label: 'Client',     type: 'text' },
        { key: 'dateLivraison',label: 'Livraison',  type: 'date' },
        { key: 'totalTTC',     label: 'Total TTC',  render: (v) => `<span class="mono">${_fmt(v)}</span>` },
        { key: 'statut',       label: 'Statut',     type: 'badge', badgeMap: BADGE_CMD }
      ],
      onRowClick: (item) => _goForm('orders', item.id, toolbar, area),
      emptyMsg:   'Aucune commande.'
    });
  }

  /* ---- Formulaire commande ---- */
  function _renderOrderForm(toolbar, area) {
    const isNew = !_state.currentId;
    const doc   = isNew ? null : Store.getById('commandes', _state.currentId);

    if (!isNew && !doc) {
      toast('Commande introuvable.', 'error');
      return _goList('orders', toolbar, area);
    }

    _state.lignes = doc ? doc.lignes.map(l => ({ ...l })) : [];

    const ref    = doc?.ref    || _genRef('CMD', 'commandes');
    const statut = doc?.statut || 'Brouillon';
    const chips  = doc?.quoteId ? `<span class="chip">📄 ${_esc(doc.quoteId)}</span>` : '';

    toolbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-back">← Retour</button>
      ${_orderActionBtns(statut, isNew)}`;

    document.getElementById('btn-back')
      ?.addEventListener('click', () => _goList('orders', toolbar, area));

    area.innerHTML = `
      ${_renderFormHeader(ref, statut, BADGE_CMD, chips)}

      <div class="form-section">
        <div class="form-section-title">Informations générales</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label required">Client</label>
            <select class="form-control" id="o-client" required>
              <option value="">— Choisir un client —</option>
              <option value="__new__" style="color:var(--accent-blue);font-weight:600;">➕ Créer nouveau client</option>
              ${Store.getAll('contacts').map(c =>
                `<option value="${c.id}" ${doc?.contactId === c.id ? 'selected' : ''}>${_esc(c.nom)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label required">Date commande</label>
            <input type="date" class="form-control" id="o-date"
              value="${doc?.date || new Date().toISOString().slice(0,10)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Livraison prévue</label>
            <input type="date" class="form-control" id="o-livraison"
              value="${doc?.dateLivraison || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-control" id="o-notes" rows="2"
              placeholder="Instructions de livraison, références client…">${_esc(doc?.notes || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">Articles</div>
        ${_renderLineTable(_state.lignes)}
      </div>

      <div class="form-section" style="padding:0;">
        ${_renderTotalsBlock(_state.lignes)}
      </div>

      <!-- Section livraison -->
      <div class="form-section">
        <div class="form-section-title">🚚 Livraison</div>
        <div class="form-grid cols-3">
          <div class="form-group">
            <label class="form-label">Mode de livraison</label>
            <select class="form-control" id="o-livraison-mode">
              <option value="retrait" ${(doc?.livraisonMode||'retrait')==='retrait'?'selected':''}>🏪 Retrait boutique</option>
              <option value="livraison" ${doc?.livraisonMode==='livraison'?'selected':''}>🚚 Livraison à domicile</option>
              <option value="coursier" ${doc?.livraisonMode==='coursier'?'selected':''}>🛵 Coursier</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date de retrait / livraison</label>
            <input type="date" class="form-control" id="o-retrait-date"
              value="${doc?.retraitDate || doc?.dateLivraison || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Adresse de livraison</label>
            <input type="text" class="form-control" id="o-livraison-adresse"
              value="${_esc(doc?.livraisonAdresse || '')}"
              placeholder="Ex: BP 123, Papeete" />
          </div>
        </div>
      </div>

      <!-- Section acompte / paiement -->
      <div class="form-section">
        <div class="form-section-title">💳 Acompte &amp; paiement</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Acompte reçu (XPF)</label>
            <input type="number" class="form-control" id="o-acompte"
              value="${doc?.acompte || 0}" min="0" step="100"
              placeholder="0" />
          </div>
          <div class="form-group">
            <label class="form-label">Statut paiement</label>
            <select class="form-control" id="o-statut-paiement">
              <option value="non_paye"   ${(doc?.statutPaiement||'non_paye')==='non_paye'  ?'selected':''}>🔴 Non payé</option>
              <option value="acompte"    ${doc?.statutPaiement==='acompte'  ?'selected':''}>🟡 Acompte reçu</option>
              <option value="paye"       ${doc?.statutPaiement==='paye'     ?'selected':''}>✅ Payé intégralement</option>
            </select>
          </div>
        </div>
        <div id="o-reste-payer" style="margin-top:8px;padding:10px 14px;background:#F5F8FF;border-radius:8px;font-size:13px;display:none;"></div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:16px;">
        <button class="btn btn-ghost" id="o-cancel">Annuler</button>
        <button class="btn btn-primary" id="o-save">✔ Sauvegarder</button>
      </div>`;

    _bindLineTableEvents();
    _bindOrderFormEvents(isNew, doc, ref, toolbar, area);
  }

  function _orderActionBtns(statut, isNew) {
    if (isNew) return '';
    const flow = ['Brouillon', 'Confirmé', 'En production', 'Prêt', 'Livré', 'Terminé'];
    const idx  = flow.indexOf(statut);
    const btns = [];

    if (idx >= 0 && idx < flow.length - 1) {
      const next = flow[idx + 1];
      btns.push(`<button class="btn btn-primary btn-sm" data-o-action="next"
        data-next="${_esc(next)}">→ ${_esc(next)}</button>`);
    }
    /* Lancer en production (OF) dès "Confirmé" */
    if (statut === 'Confirmé') {
      btns.push(`<button class="btn btn-primary btn-sm" data-o-action="lancer-prod">▶ Lancer en production</button>`);
    }
    /* Bon de production dès "En production" */
    if (statut === 'En production') {
      btns.push(`<button class="btn btn-ghost btn-sm" data-o-action="production">⚙ Bon de production</button>`);
    }
    /* Bon de livraison quand prêt ou livré */
    if (['Prêt', 'Livré'].includes(statut)) {
      btns.push(`<button class="btn btn-ghost btn-sm" data-o-action="livraison">📋 Bon de livraison</button>`);
    }
    if (['Livré', 'Terminé'].includes(statut)) {
      btns.push(`<button class="btn btn-success btn-sm" data-o-action="facturer">🧾 Créer Facture</button>`);
    }
    return btns.join('');
  }

  function _bindOrderFormEvents(isNew, doc, ref, toolbar, area) {
    /* Création rapide client depuis la liste déroulante */
    _bindClientSelectCreation('o-client');

    /* Remise client spéciale : appliquée dès la sélection */
    document.getElementById('o-client')?.addEventListener('change', () => {
      _applyRemiseClient('o-client');
    });

    document.getElementById('o-save')?.addEventListener('click', () => {
      const contactId = document.getElementById('o-client')?.value;
      if (!contactId || contactId === '__new__') { toast('Veuillez sélectionner un client.', 'error'); return; }
      if (_state.lignes.length === 0) { toast('Ajoutez au moins un article.', 'error'); return; }

      const record = {
        ref,
        _type:            'Commande',
        contactId,
        client:           _contactNom(contactId),
        date:             document.getElementById('o-date')?.value      || '',
        dateLivraison:    document.getElementById('o-livraison')?.value || '',
        notes:            document.getElementById('o-notes')?.value     || '',
        statut:           doc?.statut || 'Brouillon',
        quoteId:          doc?.quoteId || null,
        lignes:           _state.lignes,
        livraisonMode:    document.getElementById('o-livraison-mode')?.value    || 'retrait',
        retraitDate:      document.getElementById('o-retrait-date')?.value      || '',
        livraisonAdresse: document.getElementById('o-livraison-adresse')?.value || '',
        acompte:          parseFloat(document.getElementById('o-acompte')?.value) || 0,
        statutPaiement:   document.getElementById('o-statut-paiement')?.value   || 'non_paye',
        ..._calcTotaux(_state.lignes)
      };

      if (isNew) {
        Store.create('commandes', record);
        toast('Commande créée.', 'success');
      } else {
        Store.update('commandes', doc.id, record);
        toast('Commande sauvegardée.', 'success');
      }
      _goList('orders', toolbar, area);
    });

    document.getElementById('o-cancel')
      ?.addEventListener('click', () => _goList('orders', toolbar, area));

    /* Calcul du reste à payer en temps réel */
    function _updateRestePayer() {
      const acompte = parseFloat(document.getElementById('o-acompte')?.value) || 0;
      const total   = _calcTotaux(_state.lignes).totalTTC;
      const reste   = total - acompte;
      const el      = document.getElementById('o-reste-payer');
      if (!el) return;
      if (acompte > 0 || total > 0) {
        el.style.display = 'block';
        el.innerHTML = `
          <div style="display:flex;gap:24px;flex-wrap:wrap;">
            <span>💰 Total TTC : <strong style="font-family:var(--font-mono);">${_fmt(total)}</strong></span>
            <span>✅ Acompte : <strong style="font-family:var(--font-mono);color:#16A34A;">${_fmt(acompte)}</strong></span>
            <span>🔴 Reste à payer : <strong style="font-family:var(--font-mono);color:${reste > 0 ? '#DC2626' : '#16A34A'};">${_fmt(Math.max(0, reste))}</strong></span>
          </div>`;
      } else {
        el.style.display = 'none';
      }
    }
    document.getElementById('o-acompte')?.addEventListener('input', _updateRestePayer);
    _updateRestePayer(); /* état initial */

    toolbar.querySelectorAll('[data-o-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.oAction;
        if (action === 'next') {
          const next = btn.dataset.next;
          showConfirm(`Passer la commande en "${next}" ?`, () => {
            Store.update('commandes', doc.id, { statut: next });
            toast(`Commande : ${next}`, 'success');
            _goList('orders', toolbar, area);
          });
        } else if (action === 'lancer-prod') {
          _createOFFromOrder(doc, toolbar, area);
        } else if (action === 'facturer') {
          _createInvoiceFromOrder(doc, toolbar, area);
        } else if (action === 'production') {
          _createBonProduction(doc, toolbar, area);
        } else if (action === 'livraison') {
          _createBonLivraison(doc, toolbar, area);
        }
      });
    });
  }

  function _createInvoiceFromOrder(cmd, toolbar, area) {
    showConfirm(
      `Créer une facture depuis la commande ${cmd.ref} ?`,
      () => {
        const ref = _genRef('FAC', 'factures');
        Store.create('factures', {
          ref,
          _type:        'Facture',
          contactId:    cmd.contactId,
          client:       cmd.client,
          commandeId:   cmd.id,
          date:         new Date().toISOString().slice(0, 10),
          dateEcheance: '',
          statut:       'Brouillon',
          lignes:       cmd.lignes,
          paiements:    [],
          totalHT:      cmd.totalHT,
          totalTVA:     cmd.totalTVA,
          totalTTC:     cmd.totalTTC,
          notes:        cmd.notes || ''
        });
        Store.update('commandes', cmd.id, { statut: 'Terminé' });
        /* Déduire le stock automatiquement */
        _deductStockFromLines(cmd.lignes || []);
        toast(`✔ Facture ${ref} créée depuis ${cmd.ref}.`, 'success');
        _goList('orders', toolbar, area);
      }
    );
  }

  /* ================================================================
     VUE FACTURES (INVOICES)
     ================================================================ */

  function _renderInvoicesList(toolbar, area) {
    let allFacs = Store.getAll('factures');
    const isKanban = _state.listMode === 'kanban';

    /* Totaux rapides pour résumé */
    const enCours  = allFacs.filter(f => !['Payé'].includes(f.statut));
    const reglees  = allFacs.filter(f => f.statut === 'Payé');
    const totalReste = enCours.reduce((s, f) =>
      s + Math.max(0, (f.totalTTC || 0) - _totalPaiements(f.paiements)), 0);

    toolbar.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btn-new-invoice">+ Nouveau</button>
      <select class="form-control" id="filter-invoice-tab"
        style="height:28px;width:140px;font-size:12px;">
        <option value="en_cours">En cours (${enCours.length})</option>
        <option value="reglees">Réglées (${reglees.length})</option>
        <option value="toutes">Toutes (${allFacs.length})</option>
      </select>
      <select class="form-control" id="filter-invoice-statut"
        style="height:28px;width:145px;font-size:12px;">
        <option value="">Tous les statuts</option>
        ${STATUTS_FAC.map(s => `<option value="${s}">${s}</option>`).join('')}
      </select>
      <input type="text" id="filter-invoice-client" placeholder="🔍 Client..."
        class="form-control" style="height:28px;width:135px;font-size:12px;">
      <input type="date" id="filter-invoice-from" title="Date début"
        class="form-control" style="height:28px;width:130px;font-size:12px;">
      <input type="date" id="filter-invoice-to" title="Date fin"
        class="form-control" style="height:28px;width:130px;font-size:12px;">
      <div style="display:flex;gap:4px;margin-left:4px;">
        <button class="btn ${!isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-i-list">☰</button>
        <button class="btn ${isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-i-kanban">⊞</button>
      </div>`;

    let currentData = enCours;

    const _applyFilters = () => {
      const tab    = document.getElementById('filter-invoice-tab')?.value || 'en_cours';
      const statut = document.getElementById('filter-invoice-statut')?.value || '';
      const client = (document.getElementById('filter-invoice-client')?.value || '').toLowerCase();
      const from   = document.getElementById('filter-invoice-from')?.value || '';
      const to     = document.getElementById('filter-invoice-to')?.value || '';
      let base = tab === 'reglees' ? reglees : tab === 'toutes' ? allFacs : enCours;
      if (statut) base = base.filter(f => f.statut === statut);
      if (client) base = base.filter(f => (f.client || '').toLowerCase().includes(client));
      if (from)   base = base.filter(f => (f.date || '') >= from);
      if (to)     base = base.filter(f => (f.date || '') <= to);
      currentData = base;
      if (isKanban) _drawKanban(base, STATUTS_FAC, BADGE_FAC, 'invoices', toolbar, area);
      else _drawInvoicesTable(base, toolbar, area);
    };

    document.getElementById('btn-new-invoice')
      ?.addEventListener('click', () => _goForm('invoices', null, toolbar, area));
    document.getElementById('btn-i-list')?.addEventListener('click', () => {
      _state.listMode = 'list'; _renderInvoicesList(toolbar, area);
    });
    document.getElementById('btn-i-kanban')?.addEventListener('click', () => {
      _state.listMode = 'kanban'; _renderInvoicesList(toolbar, area);
    });
    document.getElementById('filter-invoice-tab')?.addEventListener('change', _applyFilters);
    document.getElementById('filter-invoice-statut')?.addEventListener('change', _applyFilters);
    document.getElementById('filter-invoice-client')?.addEventListener('input', _applyFilters);
    document.getElementById('filter-invoice-from')?.addEventListener('change', _applyFilters);
    document.getElementById('filter-invoice-to')?.addEventListener('change', _applyFilters);

    area.innerHTML = `
      <div class="page-header">
        <div class="page-title">Factures</div>
        <div class="page-subtitle">${allFacs.length} document(s) ·
          <span style="color:var(--accent-red);font-weight:600;">
            ${typeof fmt === 'function' ? fmt(totalReste) : totalReste + ' XPF'} à encaisser
          </span>
        </div>
      </div>
      <div id="sales-invoices-table"></div>`;

    if (isKanban) _drawKanban(enCours, STATUTS_FAC, BADGE_FAC, 'invoices', toolbar, area);
    else _drawInvoicesTable(enCours, toolbar, area);
  }

  function _drawInvoicesTable(data, toolbar, area) {
    renderTable('sales-invoices-table', {
      searchable: true,
      sortable:   true,
      data: data.map(f => ({
        ...f,
        _reste: Math.max(0, (f.totalTTC || 0) - _totalPaiements(f.paiements))
      })),
      columns: [
        { key: 'ref',      label: 'Numéro',       render: (v) => `<span class="col-ref">${_esc(v)}</span>` },
        { key: 'date',     label: 'Date',           type: 'date' },
        { key: 'client',   label: 'Client',         type: 'text' },
        { key: 'dateEcheance', label: 'Échéance',   type: 'date' },
        { key: 'totalTTC', label: 'Total TTC',      render: (v) => `<span class="mono">${_fmt(v)}</span>` },
        {
          key: '_reste',   label: 'Reste à payer',
          render: (v) => {
            const color = v > 0 ? 'var(--accent-red)' : 'var(--accent-green)';
            return `<span class="mono" style="color:${color};font-weight:600;">${_fmt(v)}</span>`;
          }
        },
        { key: 'statut',   label: 'Statut', type: 'badge', badgeMap: BADGE_FAC }
      ],
      onRowClick: (item) => _goForm('invoices', item.id, toolbar, area),
      emptyMsg:   'Aucune facture.'
    });
  }

  /* ---- Formulaire facture ---- */
  function _renderInvoiceForm(toolbar, area) {
    const isNew = !_state.currentId;
    const doc   = isNew ? null : Store.getById('factures', _state.currentId);

    if (!isNew && !doc) {
      toast('Facture introuvable.', 'error');
      return _goList('invoices', toolbar, area);
    }

    _state.lignes    = doc ? doc.lignes.map(l => ({ ...l })) : [];
    _state.paiements = doc ? (doc.paiements || []).map(p => ({ ...p })) : [];

    const ref    = doc?.ref    || _genRef('FAC', 'factures');
    const statut = doc?.statut || 'Brouillon';
    const chips  = doc?.commandeId ? `<span class="chip">📦 ${_esc(doc.commandeId)}</span>` : '';

    toolbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-back">← Retour</button>
      ${_invoiceActionBtns(statut, isNew)}`;

    document.getElementById('btn-back')
      ?.addEventListener('click', () => _goList('invoices', toolbar, area));

    const totaux    = _calcTotaux(_state.lignes);
    const totalPaye = _totalPaiements(_state.paiements);
    const reste     = Math.max(0, totaux.totalTTC - totalPaye);

    area.innerHTML = `
      ${_renderFormHeader(ref, statut, BADGE_FAC, chips)}

      <div class="form-section">
        <div class="form-section-title">Informations générales</div>
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label required">Client</label>
            <select class="form-control" id="i-client" required>
              <option value="">— Choisir un client —</option>
              <option value="__new__" style="color:var(--accent-blue);font-weight:600;">➕ Créer nouveau client</option>
              ${Store.getAll('contacts').map(c =>
                `<option value="${c.id}" ${doc?.contactId === c.id ? 'selected' : ''}>${_esc(c.nom)}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label required">Date de facture</label>
            <input type="date" class="form-control" id="i-date"
              value="${doc?.date || new Date().toISOString().slice(0,10)}" />
          </div>
          <div class="form-group">
            <label class="form-label">Date d'échéance</label>
            <input type="date" class="form-control" id="i-echeance"
              value="${doc?.dateEcheance || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-control" id="i-notes" rows="2"
              placeholder="Mode de règlement, instructions…">${_esc(doc?.notes || '')}</textarea>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-section-title">Articles</div>
        ${_renderLineTable(_state.lignes)}
      </div>

      <div class="form-section" style="padding:0;">
        ${_renderTotalsBlock(_state.lignes)}
      </div>

      <!-- Section Paiements -->
      <div class="form-section" id="section-paiements">
        ${_renderPaiementsSection(doc?.id, reste)}
      </div>

      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:16px;">
        <button class="btn btn-ghost" id="i-cancel">Annuler</button>
        <button class="btn btn-primary" id="i-save">✔ Sauvegarder</button>
      </div>`;

    _bindLineTableEvents();
    _bindInvoiceFormEvents(isNew, doc, ref, toolbar, area);
    _bindPaiementEvents(doc, toolbar, area);
  }

  function _invoiceActionBtns(statut, isNew) {
    if (isNew) return '';
    const btns = [];
    if (statut === 'Brouillon') {
      btns.push(`<button class="btn btn-ghost btn-sm" data-i-action="envoyer">📤 Envoyer</button>`);
    }
    if (statut === 'En retard') {
      btns.push(`<span class="badge badge-red" style="align-self:center;">⏰ En retard</span>`);
    }
    return btns.join('');
  }

  /* ---- Section paiements ---- */
  function _renderPaiementsSection(invoiceId, reste) {
    const paiements  = _state.paiements;
    const totalPaye  = _totalPaiements(paiements);
    const resteAff   = reste !== undefined ? reste : 0;
    const resteColor = resteAff <= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

    let html = `
      <div class="form-section-title" style="display:flex;justify-content:space-between;align-items:center;">
        <span>Paiements</span>
        <span style="font-family:var(--font-mono);font-size:13px;color:${resteColor};">
          Payé : ${_fmt(totalPaye)} · Reste : ${_fmt(resteAff)}
        </span>
      </div>`;

    /* Table des paiements existants */
    if (paiements.length > 0) {
      html += `
        <div class="table-wrapper" style="margin-bottom:16px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Méthode</th>
                <th>Montant</th>
                <th style="width:40px;"></th>
              </tr>
            </thead>
            <tbody>
              ${paiements.map((p, i) => `
                <tr>
                  <td>${_fmtDate(p.date)}</td>
                  <td><span class="badge ${p.type === 'Acompte' ? 'badge-orange' : p.type === 'Solde' ? 'badge-green' : 'badge-blue'}">${_esc(p.type || 'Paiement')}</span></td>
                  <td><span class="badge badge-gray">${_esc(p.methode)}</span></td>
                  <td class="col-amount"><strong>${_fmt(p.montant)}</strong></td>
                  <td>
                    <button class="btn-remove-line" data-del-pay="${i}" title="Supprimer ce paiement">✕</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`;
    }

    /* Formulaire d'enregistrement de paiement — toujours visible */
    {
      /* Pour une nouvelle facture, les paiements seront sauvegardés avec la facture */
      const newInvoiceNote = !invoiceId
        ? `<p style="color:var(--accent-blue);font-size:11px;margin-bottom:10px;">
            ℹ️ Les paiements ajoutés ici seront sauvegardés avec la facture.</p>`
        : '';
      html += `
        <div style="background:var(--bg-elevated);border-radius:10px;padding:14px;margin-top:8px;">
          ${newInvoiceNote}
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);
            margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">
            Enregistrer un paiement
          </div>
          <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;">
            <div class="form-group" style="min-width:130px;">
              <label class="form-label">Type</label>
              <select class="form-control" id="pay-type">
                ${TYPES_PAIEMENT.map(t => `<option>${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="min-width:140px;">
              <label class="form-label">Date</label>
              <input type="date" class="form-control" id="pay-date"
                value="${new Date().toISOString().slice(0,10)}" />
            </div>
            <div class="form-group" style="min-width:160px;">
              <label class="form-label">Méthode</label>
              <select class="form-control" id="pay-methode">
                ${METHODES_PAIEMENT.map(m => `<option>${m}</option>`).join('')}
              </select>
            </div>
            <div class="form-group" style="min-width:160px;">
              <label class="form-label">Montant (XPF)</label>
              <input type="number" class="form-control" id="pay-montant"
                value="${resteAff > 0 ? resteAff : ''}"
                placeholder="0" min="1" step="1" />
            </div>
            <button class="btn btn-success" id="btn-add-paiement" style="height:36px;">
              + Enregistrer
            </button>
          </div>
          ${resteAff > 0 ? `
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
              <button class="btn btn-ghost btn-sm" id="btn-pay-30pct">Acompte 30%</button>
              <button class="btn btn-ghost btn-sm" id="btn-pay-50pct">Acompte 50%</button>
              <button class="btn btn-ghost btn-sm" id="btn-pay-solde">Solde total</button>
            </div>` : ''}
        </div>`;
    }

    return html;
  }

  function _bindPaiementEvents(doc, toolbar, area) {
    /* Supprimer un paiement */
    document.querySelectorAll('[data-del-pay]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.delPay, 10);
        _state.paiements.splice(idx, 1);
        _refreshPaiementsSection(doc, toolbar, area);
      });
    });

    /* Boutons acompte rapide */
    const totaux    = _calcTotaux(_state.lignes);
    const totalPaye = _totalPaiements(_state.paiements);
    const reste     = Math.max(0, totaux.totalTTC - totalPaye);
    const inputMontant = document.getElementById('pay-montant');
    document.getElementById('btn-pay-30pct')?.addEventListener('click', () => {
      if (inputMontant) { inputMontant.value = Math.round(totaux.totalTTC * 0.3); }
      document.getElementById('pay-type')?.value && (document.getElementById('pay-type').value = 'Acompte');
    });
    document.getElementById('btn-pay-50pct')?.addEventListener('click', () => {
      if (inputMontant) { inputMontant.value = Math.round(totaux.totalTTC * 0.5); }
      document.getElementById('pay-type')?.value && (document.getElementById('pay-type').value = 'Acompte');
    });
    document.getElementById('btn-pay-solde')?.addEventListener('click', () => {
      if (inputMontant) { inputMontant.value = reste; }
      document.getElementById('pay-type')?.value && (document.getElementById('pay-type').value = 'Solde');
    });

    /* Ajouter un paiement */
    document.getElementById('btn-add-paiement')?.addEventListener('click', () => {
      const montant = parseInt(document.getElementById('pay-montant')?.value || '0', 10);
      const date    = document.getElementById('pay-date')?.value;
      const methode = document.getElementById('pay-methode')?.value || 'Virement';
      const type    = document.getElementById('pay-type')?.value || 'Paiement';

      if (!montant || montant <= 0) { toast('Montant invalide.', 'error'); return; }
      if (!date) { toast('Date requise.', 'error'); return; }

      const paiement = { id: 'pay-' + Date.now(), date, methode, montant, type: type || 'Paiement' };
      _state.paiements.push(paiement);

      /* Mise à jour immédiate du document en base */
      if (doc) {
        const totalPaye = _totalPaiements(_state.paiements);
        const totaux    = _calcTotaux(_state.lignes);
        let newStatut   = doc.statut;

        if (totalPaye >= totaux.totalTTC) {
          newStatut = 'Payé';
        } else if (totalPaye > 0) {
          newStatut = 'Payé partiel';
        }

        Store.update('factures', doc.id, { paiements: _state.paiements, statut: newStatut });

        /* Écritures comptables automatiques */
        _createPaiementEcritures(doc, paiement);

        if (newStatut === 'Payé') {
          toast('Facture intégralement réglée ! Écritures comptables générées. ✅', 'success', 4500);
        } else {
          toast(`Paiement de ${_fmt(montant)} enregistré.`, 'success');
        }
      }

      _refreshPaiementsSection(doc, toolbar, area);
    });
  }

  /** Rafraîchit uniquement la section paiements sans recharger tout le formulaire */
  function _refreshPaiementsSection(doc, toolbar, area) {
    const section = document.getElementById('section-paiements');
    if (!section) return;

    const totaux    = _calcTotaux(_state.lignes);
    const totalPaye = _totalPaiements(_state.paiements);
    const reste     = Math.max(0, totaux.totalTTC - totalPaye);

    section.innerHTML = _renderPaiementsSection(doc?.id, reste);
    _bindPaiementEvents(doc, toolbar, area);
  }

  /** Crée les 2 écritures comptables lors d'un paiement */
  function _createPaiementEcritures(facture, paiement) {
    const isEspeces  = paiement.methode === 'Espèces';
    const compte     = isEspeces ? '530000' : '512000'; // Caisse ou Banque
    const journal    = isEspeces ? 'Caisse' : 'Banque';

    /* Débit compte de trésorerie */
    Store.create('ecritures', {
      date:    paiement.date,
      libelle: `Paiement ${facture.ref} — ${paiement.methode}`,
      compte,
      debit:   paiement.montant,
      credit:  0,
      journal
    });

    /* Crédit compte client 411 */
    Store.create('ecritures', {
      date:    paiement.date,
      libelle: `Solde client — ${facture.ref}`,
      compte:  '411000',
      debit:   0,
      credit:  paiement.montant,
      journal
    });
  }

  function _bindInvoiceFormEvents(isNew, doc, ref, toolbar, area) {
    /* Création rapide client depuis la liste déroulante */
    _bindClientSelectCreation('i-client');

    document.getElementById('i-save')?.addEventListener('click', () => {
      const contactId = document.getElementById('i-client')?.value;
      if (!contactId || contactId === '__new__') { toast('Veuillez sélectionner un client.', 'error'); return; }
      if (_state.lignes.length === 0) { toast('Ajoutez au moins un article.', 'error'); return; }

      const record = {
        ref,
        _type:        'Facture',
        contactId,
        client:       _contactNom(contactId),
        date:         document.getElementById('i-date')?.value      || '',
        dateEcheance: document.getElementById('i-echeance')?.value  || '',
        notes:        document.getElementById('i-notes')?.value     || '',
        statut:       doc?.statut || 'Brouillon',
        commandeId:   doc?.commandeId || null,
        lignes:       _state.lignes,
        paiements:    _state.paiements,
        ..._calcTotaux(_state.lignes)
      };

      if (isNew) {
        Store.create('factures', record);
        toast('Facture créée et paiements enregistrés. ✓', 'success', 3500);
        _goList('invoices', toolbar, area);
      } else {
        Store.update('factures', doc.id, record);
        toast('Facture sauvegardée.', 'success');
        _goList('invoices', toolbar, area);
      }
    });

    document.getElementById('i-cancel')
      ?.addEventListener('click', () => _goList('invoices', toolbar, area));

    toolbar.querySelectorAll('[data-i-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.iAction === 'envoyer') {
          showConfirm('Marquer cette facture comme envoyée ?', () => {
            Store.update('factures', doc.id, { statut: 'Envoyé' });
            toast('Facture marquée comme envoyée.', 'success');
            _goList('invoices', toolbar, area);
          });
        }
      });
    });
  }

  /* ================================================================
     LANCER EN PRODUCTION — crée un Ordre de Fabrication (OF)
     ================================================================ */

  function _createOFFromOrder(cmd, toolbar, area) {
    showConfirm(
      `Créer un Ordre de Fabrication pour la commande ${cmd.ref} ?`,
      () => {
        /* Générer la référence OF */
        const ofs  = Store.getAll('ordresFab');
        const num  = String(ofs.length + 1).padStart(3, '0');
        const ref  = `OF-${num}`;

        /* Créer l'OF pré-rempli */
        Store.create('ordresFab', {
          reference:  ref,
          _type:      'OF',
          commandeId: cmd.id,
          cmdRef:     cmd.ref,
          client:     cmd.client,
          produit:    (cmd.lignes || []).map(l => l.description || l.produit || '').filter(Boolean).join(', ') || cmd.client,
          quantite:   (cmd.lignes || []).reduce((s, l) => s + (Number(l.qte) || 1), 0) || 1,
          statut:     'Prêt',
          priorite:   'Haute',
          dateDebut:  new Date().toISOString().slice(0, 10),
          dateFin:    cmd.dateLivraison || '',
          notes:      `Depuis commande ${cmd.ref} — Client : ${cmd.client}`,
          progression: 0
        });

        /* Passer la commande en production */
        Store.update('commandes', cmd.id, { statut: 'En production' });

        toast(`✔ OF ${ref} créé et commande passée "En production".`, 'success');
        _goList('orders', toolbar, area);
      }
    );
  }

  /* ================================================================
     BONS DE PRODUCTION (création depuis commande)
     ================================================================ */

  function _createBonProduction(cmd, toolbar, area) {
    showConfirm(
      `Créer un bon de production pour la commande ${cmd.ref} ?`,
      () => {
        const ref = _genRef('BP', 'bons_production');
        Store.create('bons_production', {
          ref,
          _type:      'BonProduction',
          commandeId: cmd.id,
          cmdRef:     cmd.ref,
          contactId:  cmd.contactId,
          client:     cmd.client,
          date:       new Date().toISOString().slice(0, 10),
          datePrevue: cmd.dateLivraison || '',
          statut:     'En attente',
          lignes:     cmd.lignes.map(l => ({ ...l, qteRealisee: 0 })),
          notes:      cmd.notes || ''
        });
        /* Passer la commande en production */
        if (cmd.statut === 'Confirmé') {
          Store.update('commandes', cmd.id, { statut: 'En production' });
        }
        toast(`✔ Bon de production ${ref} créé.`, 'success');
        _goList('orders', toolbar, area);
      }
    );
  }

  /* ================================================================
     BONS DE LIVRAISON / RÉCEPTION
     ================================================================ */

  function _createBonLivraison(cmd, toolbar, area) {
    showConfirm(
      `Créer un bon de livraison pour la commande ${cmd.ref} ?`,
      () => {
        const ref = _genRef('BL', 'bons_livraison');
        Store.create('bons_livraison', {
          ref,
          _type:      'BonLivraison',
          commandeId: cmd.id,
          cmdRef:     cmd.ref,
          contactId:  cmd.contactId,
          client:     cmd.client,
          date:       new Date().toISOString().slice(0, 10),
          statut:     'En attente',
          lignes:     cmd.lignes.map(l => ({ ...l, qteRecue: 0 })),
          notes:      ''
        });
        toast(`✔ Bon de livraison ${ref} créé.`, 'success');
        _goList('orders', toolbar, area);
      }
    );
  }

  /* ---- Liste des Bons de Livraison ---- */
  function _renderReceiptsList(toolbar, area) {
    const allBL = Store.getAll('bons_livraison');
    const isKanban = _state.listMode === 'kanban';

    toolbar.innerHTML = `
      <div style="display:flex;gap:4px;margin-left:auto;">
        <button class="btn ${!isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-bl-list">☰</button>
        <button class="btn ${isKanban ? 'btn-primary' : 'btn-ghost'} btn-sm" id="btn-bl-kanban">⊞</button>
      </div>`;

    document.getElementById('btn-bl-list')?.addEventListener('click', () => {
      _state.listMode = 'list'; _renderReceiptsList(toolbar, area);
    });
    document.getElementById('btn-bl-kanban')?.addEventListener('click', () => {
      _state.listMode = 'kanban'; _renderReceiptsList(toolbar, area);
    });

    area.innerHTML = `
      <div class="page-header">
        <div class="page-title">Bons de Livraison</div>
        <div class="page-subtitle">${allBL.length} document(s)</div>
      </div>
      <div id="sales-bl-table"></div>`;

    if (isKanban) {
      _drawKanban(allBL, STATUTS_BL, BADGE_BL, 'receipts', toolbar, area);
    } else {
      renderTable('sales-bl-table', {
        searchable: true,
        sortable:   true,
        data: allBL,
        columns: [
          { key: 'ref',       label: 'Numéro',   render: (v) => `<span class="col-ref">${_esc(v)}</span>` },
          { key: 'date',      label: 'Date',      type: 'date' },
          { key: 'cmdRef',    label: 'Commande',  type: 'text' },
          { key: 'client',    label: 'Client',    type: 'text' },
          { key: 'statut',    label: 'Statut',    type: 'badge', badgeMap: BADGE_BL },
          {
            key: '_actions', label: '', type: 'actions',
            actions: [
              {
                label: '📋 Voir/Valider', className: 'btn-ghost',
                onClick: (row) => _renderBLForm(toolbar, area, row)
              }
            ]
          }
        ],
        onRowClick: (row) => _renderBLForm(toolbar, area, row),
        emptyMsg: 'Aucun bon de livraison. Créez-les depuis les commandes (statut Prêt ou Livré).'
      });
    }
  }

  /** Formulaire / détail d'un bon de livraison */
  function _renderBLForm(toolbar, area, bl) {
    toolbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-bl-back">← Retour</button>
      ${bl.statut !== 'Reçu complet' ? `<button class="btn btn-success btn-sm" id="btn-bl-valider">✔ Marquer Reçu</button>` : ''}`;

    document.getElementById('btn-bl-back')?.addEventListener('click', () => {
      _state.mode = 'list';
      _renderReceiptsList(toolbar, area);
    });

    const lignesHtml = (bl.lignes || []).map((l, i) => `
      <tr>
        <td>${_esc(l.description || l.produitId || '—')}</td>
        <td class="col-num">${l.qte || 0}</td>
        <td class="col-num">
          <input type="number" class="line-input num-input" id="bl-qte-${i}"
            value="${l.qteRecue || 0}" min="0" max="${l.qte || 999}" step="1" style="width:70px;" />
        </td>
        <td>
          <span style="font-size:11px;color:${(l.qteRecue || 0) >= (l.qte || 0)
            ? 'var(--accent-green)' : 'var(--accent-orange)'};">
            ${(l.qteRecue || 0) >= (l.qte || 0) ? '✓ OK' : `Manque ${(l.qte || 0) - (l.qteRecue || 0)}`}
          </span>
        </td>
      </tr>`).join('');

    area.innerHTML = `
      <div style="max-width:760px;margin:0 auto;padding:24px 0;">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:8px;">
          ${_esc(bl.ref)} <span class="badge ${BADGE_BL[bl.statut] || 'badge-gray'}">${_esc(bl.statut)}</span>
        </div>
        <div style="color:var(--text-muted);font-size:13px;margin-bottom:24px;">
          Client : ${_esc(bl.client)} · Commande : ${_esc(bl.cmdRef)} · Date : ${_fmtDate(bl.date)}
        </div>

        <div class="form-section">
          <div class="form-section-title">Articles à réceptionner</div>
          <div class="table-wrapper">
            <table class="data-table">
              <thead><tr>
                <th>Article</th>
                <th class="col-num">Qté commandée</th>
                <th class="col-num">Qté reçue</th>
                <th>État</th>
              </tr></thead>
              <tbody>${lignesHtml}</tbody>
            </table>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Notes</div>
          <textarea class="form-control" id="bl-notes" rows="3"
            placeholder="Remarques sur la réception, dommages, manquants…">${_esc(bl.notes || '')}</textarea>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:16px;">
          <button class="btn btn-ghost" id="bl-save-partiel">💾 Sauvegarder partiel</button>
          ${bl.statut !== 'Reçu complet' ? `<button class="btn btn-success" id="bl-save-complet">✔ Reçu complet</button>` : ''}
        </div>
      </div>`;

    const _saveBL = (complet) => {
      const lignesMAJ = (bl.lignes || []).map((l, i) => ({
        ...l,
        qteRecue: parseInt(document.getElementById(`bl-qte-${i}`)?.value || '0', 10)
      }));
      const notes    = document.getElementById('bl-notes')?.value || '';
      const totalQte = lignesMAJ.reduce((s, l) => s + (l.qte || 0), 0);
      const recuQte  = lignesMAJ.reduce((s, l) => s + (l.qteRecue || 0), 0);
      const newStatut = complet ? 'Reçu complet'
        : recuQte > 0 ? 'Reçu partiel' : 'En attente';

      Store.update('bons_livraison', bl.id, { lignes: lignesMAJ, notes, statut: newStatut });

      /* Mettre à jour le stock si réception */
      if (recuQte > 0) {
        lignesMAJ.forEach(l => {
          if (l.produitId && l.qteRecue > 0) {
            const prod = Store.getById('produits', l.produitId);
            if (prod) {
              Store.update('produits', prod.id, { stock: (prod.stock || 0) + l.qteRecue });
              Store.create('mouvements', {
                date:       new Date().toISOString().slice(0, 10),
                produitId:  prod.id,
                produitNom: prod.nom,
                type:       'Entrée',
                quantite:   l.qteRecue,
                motif:      `Réception ${bl.ref} — ${bl.cmdRef}`,
                reference:  bl.ref
              });
            }
          }
        });
      }

      toast(`Bon de livraison ${bl.ref} — ${newStatut}.`, 'success');
      _renderReceiptsList(toolbar, area);
    };

    document.getElementById('bl-save-partiel')?.addEventListener('click', () => _saveBL(false));
    document.getElementById('bl-save-complet')?.addEventListener('click', () => _saveBL(true));
    document.getElementById('btn-bl-valider')?.addEventListener('click', () => _saveBL(true));
  }

  /* ================================================================
     VUE RAPPORT DE VENTES (SALES-REPORT)
     ================================================================ */

  function _renderSalesReport(toolbar, area) {
    toolbar.innerHTML = '';

    const db       = Store.getDB();
    const factures = db.factures  || [];
    const commandes= db.commandes || [];
    const devis    = db.devis     || [];
    const now      = new Date();
    const moisPfx  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    /* ---- KPIs ---- */
    const facMois  = factures.filter(f => (f.date || '').startsWith(moisPfx));
    const caMois   = facMois.reduce((s, f) => s + (f.totalTTC || 0), 0);
    const nbVentes = facMois.length;
    const ticket   = nbVentes > 0 ? Math.round(caMois / nbVentes) : 0;
    const devisAtt = devis.filter(d => d.statut === 'Envoyé').length;

    /* ---- CA par semaine (4 dernières) ---- */
    const semaines = _caBySemaine(factures, 4);

    /* ---- Top 5 produits commandés ---- */
    const top5 = _top5Produits(commandes);

    area.innerHTML = `
      <div class="page-header">
        <div class="page-title">Rapport de ventes</div>
        <div class="page-subtitle">${_fmtDate(now.toISOString())}</div>
      </div>

      <!-- KPIs : 4 statCards -->
      <div class="dash-grid" style="margin-bottom:24px;">
        <div id="kpi-ca"></div>
        <div id="kpi-ventes"></div>
        <div id="kpi-ticket"></div>
        <div id="kpi-devis-att"></div>
      </div>

      <!-- Graphiques côte à côte -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div class="card">
          <div class="card-header"><div class="card-title">CA par semaine</div></div>
          <div id="chart-weekly" style="padding:8px 0 4px;"></div>
        </div>
        <div class="card">
          <div class="card-header"><div class="card-title">Top 5 produits</div></div>
          <div id="chart-top5" style="padding:8px 0 4px;"></div>
        </div>
      </div>

      <!-- Dernières 10 factures -->
      <div class="card">
        <div class="card-header"><div class="card-title">Dernières factures</div></div>
        <div id="report-last-invoices"></div>
      </div>`;

    /* Rendre les KPIs via chart.js */
    statCard('kpi-ca',       { icon: '💰', value: caMois,   label: 'CA du mois',        color: 'var(--accent-green)',  format: true });
    statCard('kpi-ventes',   { icon: '🧾', value: nbVentes, label: 'Factures ce mois',  color: 'var(--accent-blue)'  });
    statCard('kpi-ticket',   { icon: '📊', value: ticket,   label: 'Ticket moyen',      color: 'var(--accent-violet)', format: true });
    statCard('kpi-devis-att',{ icon: '📄', value: devisAtt, label: 'Devis en attente',  color: 'var(--accent-orange)' });

    /* Graphique CA par semaine */
    barChart('chart-weekly', {
      labels:    semaines.map(s => s.label),
      values:    semaines.map(s => s.ca),
      colors:    semaines.map((_, i) => i === semaines.length - 1 ? '#00d4aa' : '#4a5fff'),
      height:    32,
      formatter: (v) => _fmt(v)
    });

    /* Graphique Top 5 produits */
    barChart('chart-top5', {
      labels:    top5.map(p => p.nom),
      values:    top5.map(p => p.qte),
      colors:    ['#b07bff', '#00d4aa', '#ffc857', '#ff6b6b', '#4a5fff'],
      height:    28,
      title:     '',
      formatter: (v) => `${v} unité${v > 1 ? 's' : ''}`
    });

    /* Table des 10 dernières factures */
    renderTable('report-last-invoices', {
      searchable: false,
      sortable:   false,
      data: [...factures]
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 10),
      columns: [
        { key: 'ref',      label: 'Référence',   render: (v) => `<span class="col-ref">${_esc(v)}</span>` },
        { key: 'date',     label: 'Date',         type: 'date' },
        { key: 'client',   label: 'Client',       type: 'text' },
        { key: 'totalTTC', label: 'Total TTC',    render: (v) => `<span class="mono">${_fmt(v)}</span>` },
        { key: 'statut',   label: 'Statut',       type: 'badge', badgeMap: BADGE_FAC }
      ],
      onRowClick: (item) => _goForm('invoices', item.id, toolbar, area)
    });
  }

  /** Calcule le CA par semaine sur les n dernières semaines */
  function _caBySemaine(factures, n) {
    const result = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = n - 1; i >= 0; i--) {
      /* Lundi de la semaine */
      const debut = new Date(now);
      debut.setDate(debut.getDate() - (i * 7) - ((debut.getDay() + 6) % 7));
      const fin = new Date(debut);
      fin.setDate(debut.getDate() + 6);
      fin.setHours(23, 59, 59, 999);

      const ca = factures
        .filter(f => { const d = new Date(f.date); return d >= debut && d <= fin; })
        .reduce((s, f) => s + (f.totalTTC || 0), 0);

      result.push({
        label: `S${n - i} (${debut.getDate()}/${debut.getMonth() + 1})`,
        ca
      });
    }
    return result;
  }

  /** Calcule le top 5 des produits par quantité commandée */
  function _top5Produits(commandes) {
    const compteur = {};
    const nomMap   = {};
    Store.getAll('produits').forEach(p => { nomMap[p.id] = p.nom; });

    commandes.forEach(cmd => {
      (cmd.lignes || []).forEach(l => {
        if (!l.produitId) return;
        compteur[l.produitId] = (compteur[l.produitId] || 0) + (l.qte || 0);
      });
    });

    return Object.entries(compteur)
      .map(([id, qte]) => ({ id, qte, nom: nomMap[id] || id }))
      .sort((a, b) => b.qte - a.qte)
      .slice(0, 5);
  }

  /* ================================================================
     CRÉATION RAPIDE CLIENT (depuis Devis / Commande / Facture)
     ================================================================ */

  /**
   * Attache l'écouteur sur un select client pour détecter "__new__"
   * et ouvrir la modale de création rapide.
   * @param {string} selectId  — id du <select> (ex: 'q-client')
   */
  function _bindClientSelectCreation(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.addEventListener('change', function () {
      if (this.value !== '__new__') return;
      this.value = ''; /* reset pendant la saisie */
      _openQuickClientModal(selectId);
    });
  }

  /**
   * Modale légère de création rapide d'un client.
   * Une fois créé, le client est injecté et sélectionné dans le select cible.
   * @param {string} selectId — id du <select> à mettre à jour
   */
  function _openQuickClientModal(selectId) {
    const typeOpts = CLIENT_TYPES.map(t =>
      `<option value="${_esc(t)}">${_esc(t)}</option>`).join('');
    const ileOpts = ILES_PF.map(ile =>
      `<option value="${_esc(ile)}">${_esc(ile)}</option>`).join('');

    showModal('Nouveau client', `
      <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:14px;">
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label required">Nom / Raison sociale</label>
          <input type="text" class="form-control" id="qc-nom"
            placeholder="Nom complet ou raison sociale" autofocus />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-control" id="qc-type">
            <option value="">— Choisir —</option>
            ${typeOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Île</label>
          <select class="form-control" id="qc-ile">
            <option value="">— Choisir —</option>
            ${ileOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone</label>
          <input type="tel" class="form-control" id="qc-tel" placeholder="87 xx xx xx" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-control" id="qc-email" placeholder="exemple@mail.pf" />
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Adresse</label>
          <input type="text" class="form-control" id="qc-adresse" placeholder="Quartier, PK, BP…" />
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
        <button class="btn btn-ghost" id="qc-cancel">Annuler</button>
        <button class="btn btn-primary" id="qc-save">✔ Créer et sélectionner</button>
      </div>
    `);

    document.getElementById('qc-cancel')?.addEventListener('click', () => closeModal());
    document.getElementById('qc-save')?.addEventListener('click', async () => {
      const nom = (document.getElementById('qc-nom')?.value || '').trim();
      if (!nom) { toast('Le nom est obligatoire.', 'error'); return; }

      /* 1 — Sauvegarde localStorage (instantanée) */
      const newClient = Store.create('contacts', {
        nom,
        type:      document.getElementById('qc-type')?.value    || '',
        ile:       document.getElementById('qc-ile')?.value     || '',
        telephone: document.getElementById('qc-tel')?.value     || '',
        email:     document.getElementById('qc-email')?.value   || '',
        adresse:   document.getElementById('qc-adresse')?.value || ''
      });
      Store.addAuditLog(`Créé client "${nom}" (création rapide)`, 'ventes');

      /* 2 — Injecter et sélectionner dans le select */
      closeModal();
      const sel = document.getElementById(selectId);
      if (sel) {
        const opt    = document.createElement('option');
        opt.value    = newClient.id;
        opt.text     = newClient.nom;
        opt.selected = true;
        sel.appendChild(opt);
      }

      /* 3 — Vérifier la sync MySQL et afficher le statut */
      if (window.MYSQL) {
        try {
          const ping = await window.MYSQL.ping();
          if (ping.ok) {
            toast(`✅ Client "${_esc(nom)}" créé — enregistré dans la base MySQL.`, 'success');
          } else {
            toast(`⚠ Client "${_esc(nom)}" créé en local — MySQL hors-ligne (sera sync à la reconnexion).`, 'warning');
          }
        } catch (_) {
          toast(`⚠ Client "${_esc(nom)}" créé en local — MySQL non disponible.`, 'warning');
        }
      } else {
        toast(`Client "${_esc(nom)}" créé.`, 'success');
      }
    });
  }

  /* ================================================================
     MODULE CLIENTS
     Liste, fiche détaillée, formulaire création/modification
     ================================================================ */

  /* ---- Liste des clients ---- */
  function _renderClientsList(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btn-new-client">+ Nouveau client</button>`;

    document.getElementById('btn-new-client')?.addEventListener('click', () => {
      _openClientModal(null, toolbar, area);
    });

    _drawClientsList('', toolbar, area);
  }

  /* Filtre actif sur la liste clients */
  let _clientTypeFilter = 'Tous';
  let _clientIleFilter  = 'Toutes';

  function _drawClientsList(query, toolbar, area) {
    const tous    = Store.getAll('contacts');
    const q       = (query || '').toLowerCase();

    /* Filtrage texte + type + île */
    const filtered = tous.filter(c => {
      const matchQ   = !q
        || (c.nom       || '').toLowerCase().includes(q)
        || (c.email     || '').toLowerCase().includes(q)
        || (c.telephone || '').toLowerCase().includes(q)
        || (c.mobile    || '').toLowerCase().includes(q);
      const matchType = _clientTypeFilter === 'Tous' || c.type === _clientTypeFilter;
      const matchIle  = _clientIleFilter  === 'Toutes' || c.ile === _clientIleFilter;
      return matchQ && matchType && matchIle;
    });

    /* Listes uniques pour les selects */
    const types = ['Tous', ...new Set(tous.map(c => c.type).filter(Boolean))];
    const iles  = ['Toutes', ...new Set(tous.map(c => c.ile).filter(Boolean))];

    /* Stats CA par client depuis les factures */
    const factures     = Store.getAll('factures');
    const clientStats  = {};
    factures.forEach(f => {
      if (!f.contactId) return;
      if (!clientStats[f.contactId]) clientStats[f.contactId] = { nb: 0, ca: 0 };
      clientStats[f.contactId].nb++;
      clientStats[f.contactId].ca += (f.totalTTC || 0);
    });

    const hasActiveFilter = _clientTypeFilter !== 'Tous' || _clientIleFilter !== 'Toutes' || q;

    area.innerHTML = `
      <div class="page-header">
        <div class="page-title">Clients
          <span style="font-size:0.65em;color:var(--text-muted);font-weight:400;margin-left:6px;">
            ${filtered.length} / ${tous.length}
          </span>
        </div>
      </div>

      <!-- Barre de filtres compacte -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;flex-wrap:wrap;">
        <div style="position:relative;flex:1;min-width:180px;max-width:280px;">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;pointer-events:none;">🔍</span>
          <input type="text" id="cl-search"
            placeholder="Nom, email, téléphone…"
            class="form-control"
            style="height:34px;padding-left:32px;font-size:13px;border-radius:8px;border:1px solid var(--border);"
            value="${_esc(query)}" />
        </div>

        <select id="cl-type-select" class="form-control"
          style="height:34px;width:155px;font-size:13px;border-radius:8px;border:1px solid var(--border);
                 color:${_clientTypeFilter !== 'Tous' ? 'var(--accent-blue)' : 'inherit'};
                 font-weight:${_clientTypeFilter !== 'Tous' ? '600' : '400'};">
          ${types.map(t => `<option value="${_esc(t)}"${t === _clientTypeFilter ? ' selected' : ''}>${_esc(t)}</option>`).join('')}
        </select>

        <select id="cl-ile-select" class="form-control"
          style="height:34px;width:135px;font-size:13px;border-radius:8px;border:1px solid var(--border);
                 color:${_clientIleFilter !== 'Toutes' ? 'var(--accent-blue)' : 'inherit'};
                 font-weight:${_clientIleFilter !== 'Toutes' ? '600' : '400'};">
          ${iles.map(i => `<option value="${_esc(i)}"${i === _clientIleFilter ? ' selected' : ''}>${_esc(i)}</option>`).join('')}
        </select>

        ${hasActiveFilter
          ? `<button id="cl-clear" title="Effacer les filtres"
              style="height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--border);
                     background:transparent;color:var(--text-muted);font-size:12px;cursor:pointer;
                     display:flex;align-items:center;gap:4px;white-space:nowrap;transition:all .15s;"
              onmouseover="this.style.borderColor='var(--accent-red)';this.style.color='var(--accent-red)';"
              onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)';">
              ✕ Effacer
            </button>`
          : ''}
      </div>

      ${filtered.length === 0
        ? `<div class="table-empty"><div class="empty-icon">👥</div>
            <p>Aucun client pour ces filtres.</p>
            ${hasActiveFilter ? `<button id="cl-clear-empty" class="btn btn-ghost btn-sm" style="margin-top:8px;">Effacer les filtres</button>` : ''}
           </div>`
        : `<div class="card" style="overflow:auto;">
            <table class="table" id="clients-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Île</th>
                  <th>Téléphone / Mobile</th>
                  <th>Email</th>
                  <th>VIP</th>
                  <th style="text-align:center;">Factures</th>
                  <th>CA Total</th>
                  <th>Créé le</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(c => {
                  const stats = clientStats[c.id] || { nb: 0, ca: 0 };
                  return `
                  <tr style="cursor:pointer;" data-cid="${_esc(c.id)}">
                    <td><strong>${_esc(c.nom)}</strong></td>
                    <td style="font-size:0.82em;">${_esc(c.type || '—')}</td>
                    <td style="font-size:0.82em;">${_esc(c.ile  || '—')}</td>
                    <td style="font-size:0.82em;">${_esc(c.mobile || c.telephone || '—')}</td>
                    <td style="font-size:0.82em;">${_esc(c.email || '—')}</td>
                    <td style="text-align:center;">${c.vip ? '⭐' : '—'}</td>
                    <td style="text-align:center;">${stats.nb || '—'}</td>
                    <td class="mono" style="font-size:0.82em;">${stats.ca > 0 ? _fmt(stats.ca) + ' XPF' : '—'}</td>
                    <td style="font-size:0.82em;">${c._createdAt ? _fmtDate(c._createdAt) : '—'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
           </div>`
      }`;

    const _refresh = () => {
      const q2 = document.getElementById('cl-search')?.value || '';
      _drawClientsList(q2, toolbar, area);
    };
    const _clearAll = () => {
      _clientTypeFilter = 'Tous';
      _clientIleFilter  = 'Toutes';
      _drawClientsList('', toolbar, area);
    };

    /* Recherche en temps réel */
    document.getElementById('cl-search')?.addEventListener('input', _refresh);

    /* Select Type */
    document.getElementById('cl-type-select')?.addEventListener('change', (e) => {
      _clientTypeFilter = e.target.value;
      _refresh();
    });

    /* Select Île */
    document.getElementById('cl-ile-select')?.addEventListener('change', (e) => {
      _clientIleFilter = e.target.value;
      _refresh();
    });

    /* Bouton Effacer */
    document.getElementById('cl-clear')?.addEventListener('click', _clearAll);
    document.getElementById('cl-clear-empty')?.addEventListener('click', _clearAll);

    /* Clic sur une ligne → fiche client */
    area.querySelectorAll('[data-cid]').forEach(row => {
      row.addEventListener('click', () => {
        _renderClientFiche(row.dataset.cid, toolbar, area);
      });
    });
  }

  /* ---- Fiche client ---- */
  function _renderClientFiche(contactId, toolbar, area) {
    const c = Store.getById('contacts', contactId);
    if (!c) { toast('Client introuvable.', 'error'); return; }

    /* Factures du client */
    const mesFactures = Store.getAll('factures').filter(f => f.contactId === contactId);

    /* Historique des remises : toutes les lignes avec remise > 0 */
    const remiseHistory = [];
    mesFactures.forEach(f => {
      (f.lignes || []).forEach(l => {
        if ((l.remise || 0) > 0) {
          remiseHistory.push({
            date:         f.date,
            ref:          f.ref,
            article:      l.description || '—',
            qte:          l.qte || 1,
            prixUnit:     l.prixUnitaire || 0,
            remise:       l.remise,
            montantRemise: Math.round((l.qte || 1) * (l.prixUnitaire || 0) * (l.remise / 100))
          });
        }
      });
    });

    /* Synthèse remises par taux */
    const parTaux = {};
    remiseHistory.forEach(r => {
      const k = r.remise + '%';
      if (!parTaux[k]) parTaux[k] = { taux: r.remise, nb: 0, total: 0 };
      parTaux[k].nb++;
      parTaux[k].total += r.montantRemise;
    });

    /* Synthèse par article (description) */
    const parArticle = {};
    remiseHistory.forEach(r => {
      const k = r.article;
      if (!parArticle[k]) parArticle[k] = { article: r.article, nb: 0, total: 0 };
      parArticle[k].nb++;
      parArticle[k].total += r.montantRemise;
    });

    const caTotal     = mesFactures.reduce((s, f) => s + (f.totalTTC || 0), 0);
    const totalRemise = remiseHistory.reduce((s, r) => s + r.montantRemise, 0);

    toolbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-back-clients">← Clients</button>
      <button class="btn btn-secondary btn-sm" id="btn-edit-client">✏ Modifier</button>`;

    document.getElementById('btn-back-clients')?.addEventListener('click', () => {
      _renderClientsList(toolbar, area);
    });
    document.getElementById('btn-edit-client')?.addEventListener('click', () => {
      _openClientModal(contactId, toolbar, area);
    });

    area.innerHTML = `
      <!-- En-tête client -->
      <div class="page-header">
        <div class="page-title">👤 ${_esc(c.nom)}</div>
        <div class="page-subtitle">${_esc(c.type || 'Client')}${c.ile ? ' · ' + _esc(c.ile) : ''}</div>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
        <div class="card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6em;">🧾</div>
          <div style="font-size:1.4em;font-weight:700;color:var(--accent-blue);">${mesFactures.length}</div>
          <div style="font-size:0.78em;color:var(--text-muted);">Factures</div>
        </div>
        <div class="card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6em;">💰</div>
          <div style="font-size:1.2em;font-weight:700;color:var(--accent-green);font-family:monospace;">${_fmt(caTotal)}</div>
          <div style="font-size:0.78em;color:var(--text-muted);">CA Total TTC</div>
        </div>
        <div class="card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6em;">🏷️</div>
          <div style="font-size:1.4em;font-weight:700;color:var(--accent-orange);">${remiseHistory.length}</div>
          <div style="font-size:0.78em;color:var(--text-muted);">Lignes remisées</div>
        </div>
        <div class="card" style="padding:16px;text-align:center;">
          <div style="font-size:1.6em;">💸</div>
          <div style="font-size:1.2em;font-weight:700;color:var(--accent-red);font-family:monospace;">${totalRemise > 0 ? '−' + _fmt(totalRemise) : '0 XPF'}</div>
          <div style="font-size:0.78em;color:var(--text-muted);">Total remises</div>
        </div>
      </div>

      <!-- Informations + Synthèse remises par taux -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">

        <!-- Infos -->
        <div class="card">
          <div class="card-header"><div class="card-title">Informations</div></div>
          <div style="padding:14px 16px;">
            <table style="width:100%;border-collapse:collapse;">
              ${_clientInfoRow('Type',            c.type)}
              ${_clientInfoRow('Téléphone',       c.telephone)}
              ${_clientInfoRow('Email',           c.email)}
              ${_clientInfoRow('Île',             c.ile)}
              ${_clientInfoRow('Adresse',         c.adresse)}
              ${_clientInfoRow('Interlocuteur',   c.interlocuteur)}
              ${_clientInfoRow('SIRET',           c.siret)}
              ${c.dateNaissance ? _clientInfoRow('Date de naissance', _fmtDate(c.dateNaissance)) : ''}
              ${_clientInfoRow('Créé le', c._createdAt ? _fmtDate(c._createdAt) : '—')}
            </table>
          </div>
        </div>

        <!-- Remises par taux -->
        <div class="card">
          <div class="card-header"><div class="card-title">Remises accordées par taux</div></div>
          <div style="padding:14px 16px;">
            ${Object.keys(parTaux).length === 0
              ? '<p style="color:var(--text-muted);font-size:0.85em;text-align:center;padding:16px 0;">Aucune remise accordée à ce client.</p>'
              : Object.values(parTaux)
                  .sort((a, b) => b.taux - a.taux)
                  .map(t => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
                  <div>
                    <span style="font-weight:700;color:var(--accent-orange);font-size:1em;">Remise ${t.taux}%</span>
                    <span style="color:var(--text-muted);font-size:0.8em;margin-left:8px;">(${t.nb} ligne${t.nb > 1 ? 's' : ''})</span>
                  </div>
                  <span style="font-family:monospace;color:var(--accent-red);font-weight:600;">−${_fmt(t.total)}</span>
                </div>`).join('')
            }
          </div>
        </div>
      </div>

      <!-- Remises par article -->
      ${Object.keys(parArticle).length > 0 ? `
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><div class="card-title">Remises par article</div></div>
        <div style="overflow:auto;">
          <table class="table">
            <thead>
              <tr>
                <th>Article</th>
                <th style="text-align:center;">Nb occurrences</th>
                <th>Total remisé</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(parArticle).sort((a, b) => b.total - a.total).map(a => `
              <tr>
                <td>${_esc(a.article)}</td>
                <td style="text-align:center;">${a.nb}</td>
                <td class="mono" style="color:var(--accent-red);">−${_fmt(a.total)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>` : ''}

      <!-- Historique détaillé des remises -->
      <div class="card">
        <div class="card-header"><div class="card-title">Historique détaillé des remises</div></div>
        ${remiseHistory.length === 0
          ? '<div class="table-empty" style="padding:24px;"><p>Aucune remise enregistrée pour ce client.</p></div>'
          : `<div style="overflow:auto;">
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Facture</th>
                    <th>Article</th>
                    <th style="text-align:center;">Qté</th>
                    <th>Prix unit.</th>
                    <th style="text-align:center;">Remise %</th>
                    <th>Montant remisé</th>
                  </tr>
                </thead>
                <tbody>
                  ${remiseHistory
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(r => `
                  <tr>
                    <td>${_fmtDate(r.date)}</td>
                    <td><span class="col-ref">${_esc(r.ref)}</span></td>
                    <td>${_esc(r.article)}</td>
                    <td style="text-align:center;">${r.qte}</td>
                    <td class="mono">${_fmt(r.prixUnit)}</td>
                    <td style="text-align:center;color:var(--accent-orange);font-weight:700;">${r.remise}%</td>
                    <td class="mono" style="color:var(--accent-red);">−${_fmt(r.montantRemise)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
             </div>`
        }
      </div>`;
  }

  /** Ligne info pour la fiche client */
  function _clientInfoRow(label, value) {
    if (!value) return '';
    return `
      <tr>
        <td style="color:var(--text-muted);font-size:0.82em;padding:5px 10px 5px 0;width:42%;vertical-align:top;">${_esc(label)}</td>
        <td style="font-size:0.88em;padding:5px 0;">${_esc(value)}</td>
      </tr>`;
  }

  /* ---- Modal création / modification client (alignée avec CRM Contacts) ---- */
  function _openClientModal(contactId, toolbar, area) {
    const c    = contactId ? Store.getById('contacts', contactId) : null;
    const isNew = !c;

    const typeOpts = CLIENT_TYPES.map(t =>
      `<option value="${_esc(t)}" ${c?.type === t ? 'selected' : ''}>${_esc(t)}</option>`
    ).join('');
    const ileOpts = ILES_PF.map(ile =>
      `<option value="${_esc(ile)}" ${c?.ile === ile ? 'selected' : ''}>${_esc(ile)}</option>`
    ).join('');

    showModal(isNew ? 'Nouveau client' : 'Modifier : ' + c.nom, `
      <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:14px;">
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label required">Nom / Raison sociale</label>
          <input type="text" class="form-control" id="cl-nom"
            value="${_esc(c?.nom || '')}" placeholder="Nom complet ou raison sociale" />
        </div>
        <div class="form-group">
          <label class="form-label">Type de client</label>
          <select class="form-control" id="cl-type">
            <option value="">— Choisir —</option>${typeOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Île</label>
          <select class="form-control" id="cl-ile">
            <option value="">— Choisir —</option>${ileOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone fixe</label>
          <input type="tel" class="form-control" id="cl-tel"
            value="${_esc(c?.telephone || '')}" placeholder="40 xx xx xx" />
        </div>
        <div class="form-group">
          <label class="form-label">Mobile</label>
          <input type="tel" class="form-control" id="cl-mobile"
            value="${_esc(c?.mobile || '')}" placeholder="87 xx xx xx" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-control" id="cl-email"
            value="${_esc(c?.email || '')}" placeholder="exemple@mail.pf" />
        </div>
        <div class="form-group">
          <label class="form-label">Date de naissance</label>
          <input type="date" class="form-control" id="cl-datenaissance"
            value="${c?.dateNaissance || ''}" />
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Adresse</label>
          <input type="text" class="form-control" id="cl-adresse"
            value="${_esc(c?.adresse || '')}" placeholder="Quartier, PK, BP…" />
        </div>
        <div class="form-group">
          <label class="form-label">Interlocuteur principal</label>
          <input type="text" class="form-control" id="cl-interlocuteur"
            value="${_esc(c?.interlocuteur || '')}" placeholder="Prénom Nom" />
        </div>
        <div class="form-group">
          <label class="form-label">N° Tahiti / Registre commerce</label>
          <input type="text" class="form-control" id="cl-numerotahiti"
            value="${_esc(c?.numeroTahiti || c?.siret || '')}" placeholder="N° d'identification" />
        </div>
        <div class="form-group" style="grid-column:1/-1;display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="cl-vip" ${c?.vip ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;" />
          <label for="cl-vip" style="cursor:pointer;font-size:0.88em;">⭐ Client VIP</label>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
        <button class="btn btn-ghost" id="cl-cancel">Annuler</button>
        <button class="btn btn-primary" id="cl-save">${isNew ? '+ Créer le client' : '✔ Sauvegarder'}</button>
      </div>
    `);

    document.getElementById('cl-cancel')?.addEventListener('click', () => closeModal());
    document.getElementById('cl-save')?.addEventListener('click', () => _saveClient(contactId, toolbar, area));
  }

  /* ---- Sauvegarde client ---- */
  function _saveClient(contactId, toolbar, area) {
    const nom = (document.getElementById('cl-nom')?.value || '').trim();
    if (!nom) { toast('Le nom est obligatoire.', 'error'); return; }

    const record = {
      nom,
      type:          document.getElementById('cl-type')?.value          || '',
      ile:           document.getElementById('cl-ile')?.value           || '',
      telephone:     document.getElementById('cl-tel')?.value           || '',
      mobile:        document.getElementById('cl-mobile')?.value        || '',
      email:         document.getElementById('cl-email')?.value         || '',
      dateNaissance: document.getElementById('cl-datenaissance')?.value || '',
      adresse:       document.getElementById('cl-adresse')?.value       || '',
      interlocuteur: document.getElementById('cl-interlocuteur')?.value || '',
      numeroTahiti:  document.getElementById('cl-numerotahiti')?.value  || '',
      vip:           document.getElementById('cl-vip')?.checked         || false
    };

    let savedId = contactId;
    if (contactId) {
      Store.update('contacts', contactId, record);
      Store.addAuditLog(`Modifié client "${nom}"`, 'ventes');
      toast('Client mis à jour.', 'success');
    } else {
      const newC = Store.create('contacts', record);
      Store.addAuditLog(`Créé client "${nom}"`, 'ventes');
      toast('Client créé.', 'success');
      savedId = newC.id;
    }

    closeModal();
    _renderClientFiche(savedId, toolbar, area);
  }

  /* ================================================================
     POINT D'ENTRÉE PUBLIC
     init(toolbar, area, viewId) — appelé par app.js
     ================================================================ */

  function init(toolbar, area, viewId) {
    /* Changement de vue → reset mode liste */
    if (viewId !== _state.view) {
      _state.mode      = 'list';
      _state.currentId = null;
      _state.lignes    = [];
      _state.paiements = [];
    }
    _state.view = viewId;

    /* Mode formulaire (navigation interne) */
    if (_state.mode === 'form') {
      switch (viewId) {
        case 'quotes':   _renderQuoteForm(toolbar, area);   break;
        case 'orders':   _renderOrderForm(toolbar, area);   break;
        case 'invoices': _renderInvoiceForm(toolbar, area); break;
      }
      return;
    }

    /* Mode liste */
    switch (viewId) {
      case 'clients':      _renderClientsList(toolbar, area);  break;
      case 'quotes':       _renderQuotesList(toolbar, area);   break;
      case 'orders':       _renderOrdersList(toolbar, area);   break;
      case 'invoices':     _renderInvoicesList(toolbar, area); break;
      case 'receipts':     _renderReceiptsList(toolbar, area); break;
      case 'sales-report': _renderSalesReport(toolbar, area);  break;
      default:
        area.innerHTML = `
          <div class="table-empty">
            <div class="empty-icon">🛒</div>
            <p>Vue Ventes "${_esc(viewId)}" inconnue.</p>
          </div>`;
    }
  }

  /* ================================================================
     DÉDUCTION STOCK AUTOMATIQUE (Étape 7)
     Appelée quand une facture est payée / créée depuis commande
     ================================================================ */
  function _deductStockFromLines(lignes) {
    if (!Array.isArray(lignes)) return;
    const produits = Store.getAll('produits');
    lignes.forEach(l => {
      const desc  = (l.description || l.produit || '').toLowerCase().trim();
      const qte   = Number(l.qte) || 0;
      if (!desc || qte <= 0) return;
      /* Chercher le produit par correspondance de nom */
      const prod = produits.find(p =>
        (p.nom || '').toLowerCase().trim() === desc ||
        (p.ref || '').toLowerCase().trim() === desc
      );
      if (prod && prod.stock !== undefined) {
        const newStock = Math.max(0, (Number(prod.stock) || 0) - qte);
        Store.update('produits', prod.id, { stock: newStock });
      }
    });
  }

  return { init };

})();

window.Sales = Sales;
