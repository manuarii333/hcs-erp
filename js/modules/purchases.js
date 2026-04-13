/* ================================================================
   HCS ERP — js/modules/purchases.js
   Module Achats : fournisseurs, bons de commande, rapport achats.
   Pattern IIFE — exposé via window.Purchases
   ================================================================ */

'use strict';

const Purchases = (() => {

  /* ----------------------------------------------------------------
     État interne du module
     ---------------------------------------------------------------- */
  const _state = {
    view:      'suppliers',  // vue active
    mode:      'list',       // 'list' | 'form'
    currentId: null,         // id du bon de commande en cours
    lignes:    []            // lignes de la commande en édition
  };

  /* ----------------------------------------------------------------
     Constantes
     ---------------------------------------------------------------- */
  const STATUTS_PO = ['Brouillon', 'Envoyé', 'Confirmé', 'Reçu', 'Annulé'];

  const STATUT_COLORS = {
    'Brouillon':  'gray',
    'Envoyé':     'blue',
    'Confirmé':   'orange',
    'Reçu':       'green',
    'Annulé':     'red'
  };

  /* ================================================================
     POINT D'ENTRÉE — init(toolbar, area, viewId)
     ================================================================ */
  function init(toolbar, area, viewId) {
    /* Changement de vue → revenir en mode liste */
    if (viewId !== _state.view) {
      _state.view      = viewId;
      _state.mode      = 'list';
      _state.currentId = null;
      _state.lignes    = [];
    }

    switch (_state.view) {
      case 'suppliers':      _renderSuppliers(toolbar, area);     break;
      case 'po':             _renderPO(toolbar, area);            break;
      case 'purchase-report':_renderPurchaseReport(toolbar, area);break;
      default:               _renderSuppliers(toolbar, area);
    }
  }

  /* ================================================================
     VUE : FOURNISSEURS
     ================================================================ */
  function _renderSuppliers(toolbar, area) {
    /* --- Toolbar --- */
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-new-supplier">
        + Nouveau fournisseur
      </button>`;

    toolbar.querySelector('#btn-new-supplier')
      .addEventListener('click', () => _openSupplierForm(null));

    /* --- Table --- */
    const fournisseurs = Store.getAll('fournisseurs');

    area.innerHTML = '<div id="purchases-suppliers-table"></div>';
    renderTable('purchases-suppliers-table', {
      title: 'Fournisseurs',
      data: fournisseurs,
      searchable: true,
      columns: [
        { key: 'nom',            label: 'Nom',        type: 'text',  sortable: true },
        { key: 'contact',        label: 'Contact',    type: 'text'  },
        { key: 'email',          label: 'Email',      type: 'text'  },
        { key: 'telephone',      label: 'Téléphone',  type: 'text'  },
        { key: 'pays',           label: 'Pays',       type: 'text'  },
        { key: 'delaiLivraison', label: 'Délai (j)',  type: 'text'  },
        { key: 'conditions',     label: 'Conditions', type: 'text'  },
        {
          key: '_actions', label: '', type: 'actions',
          actions: [
            { label: '✏️ Modifier',   className: 'btn-ghost', onClick: (row) => _openSupplierForm(row) },
            { label: '🗑 Supprimer',   className: 'btn-ghost danger', onClick: (row) => _deleteSupplier(row) }
          ]
        }
      ],
      emptyMsg: 'Aucun fournisseur enregistré.',
      onRowClick: (row) => _openSupplierForm(row)
    });
  }

  /* Formulaire fournisseur (modal) */
  function _openSupplierForm(fournisseur) {
    const isNew = !fournisseur;
    const titre = isNew ? 'Nouveau fournisseur' : 'Modifier fournisseur';

    const fields = [
      { name: 'nom',            label: 'Nom *',              type: 'text',   required: true,  cols: 2 },
      { name: 'contact',        label: 'Interlocuteur',      type: 'text',   cols: 2 },
      { name: 'email',          label: 'Email',              type: 'email',  cols: 1 },
      { name: 'telephone',      label: 'Téléphone',          type: 'tel',    cols: 1 },
      { name: 'pays',           label: 'Pays',               type: 'text',   cols: 1 },
      { name: 'devise',         label: 'Devise',             type: 'text',   cols: 1 },
      { name: 'delaiLivraison', label: 'Délai livraison (j)',type: 'number', cols: 1 },
      { name: 'conditions',     label: 'Conditions paiement',type: 'text',   cols: 1 },
      { name: 'notes',          label: 'Notes',              type: 'textarea',cols: 2 }
    ];

    showFormModal(titre, fields, fournisseur || {}, (data) => {
      if (isNew) {
        Store.create('fournisseurs', data);
        toastSuccess('Fournisseur créé.');
      } else {
        Store.update('fournisseurs', fournisseur.id, data);
        toastSuccess('Fournisseur mis à jour.');
      }
      _renderSuppliers(
        document.getElementById('toolbar-actions'),
        document.getElementById('view-content')
      );
    }, 'lg');
  }

  /* Suppression fournisseur */
  function _deleteSupplier(fournisseur) {
    showDeleteConfirm(fournisseur.nom, () => {
      Store.remove('fournisseurs', fournisseur.id);
      toastSuccess('Fournisseur supprimé.');
      _renderSuppliers(
        document.getElementById('toolbar-actions'),
        document.getElementById('view-content')
      );
    });
  }

  /* ================================================================
     VUE : BONS DE COMMANDE ACHAT
     ================================================================ */
  function _renderPO(toolbar, area) {
    if (_state.mode === 'form') {
      _renderPOForm(toolbar, area);
    } else {
      _renderPOList(toolbar, area);
    }
  }

  /* ---- Liste des BCA ---- */
  function _renderPOList(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-new-po">
        + Nouveau bon de commande
      </button>`;

    toolbar.querySelector('#btn-new-po').addEventListener('click', () => {
      _state.mode      = 'form';
      _state.currentId = null;
      _state.lignes    = [_newLigne()];
      _renderPOForm(toolbar, area);
    });

    const bons = Store.getAll('bonsAchat');

    area.innerHTML = '<div id="purchases-po-table"></div>';
    renderTable('purchases-po-table', {
      title: 'Bons de commande achat',
      data: bons,
      searchable: true,
      columns: [
        { key: 'reference',   label: 'Référence',   type: 'text',  sortable: true },
        { key: 'fournisseur', label: 'Fournisseur', type: 'text',  sortable: true },
        { key: 'date',        label: 'Date',         type: 'date',  sortable: true },
        {
          key: 'totalTTC', label: 'Total TTC', type: 'money',
          render: (row) => fmt(row.totalTTC || 0)
        },
        {
          key: 'statut', label: 'Statut', type: 'badge',
          badgeMap: STATUT_COLORS
        },
        {
          key: '_actions', label: '', type: 'actions',
          actions: [
            { label: '👁 Ouvrir', className: 'btn-ghost', onClick: (row) => _openPO(row) }
          ]
        }
      ],
      emptyMsg: 'Aucun bon de commande.',
      onRowClick: (row) => _openPO(row)
    });
  }

  /* Ouvrir un BC existant */
  function _openPO(bon) {
    _state.mode      = 'form';
    _state.currentId = bon.id;
    _state.lignes    = deepClone(bon.lignes || [_newLigne()]);
    _renderPOForm(
      document.getElementById('toolbar-actions'),
      document.getElementById('view-content')
    );
  }

  /* ---- Formulaire BCA ---- */
  function _renderPOForm(toolbar, area) {
    const isNew = !_state.currentId;
    const bon   = isNew ? null : Store.getById('bonsAchat', _state.currentId);
    const statut = bon ? bon.statut : 'Brouillon';

    /* ---- Toolbar ---- */
    let toolbarHtml = `<button class="btn btn-ghost" id="btn-po-back">← Retour</button>`;

    if (statut === 'Brouillon') {
      toolbarHtml += `<button class="btn btn-primary" id="btn-save-po">💾 Enregistrer</button>`;
      toolbarHtml += `<button class="btn btn-secondary" id="btn-send-po">📤 Envoyer</button>`;
    }
    if (statut === 'Envoyé') {
      toolbarHtml += `<button class="btn btn-primary" id="btn-save-po">💾 Enregistrer</button>`;
      toolbarHtml += `<button class="btn btn-secondary" id="btn-confirm-po">✅ Confirmer</button>`;
    }
    if (statut === 'Confirmé') {
      toolbarHtml += `<button class="btn btn-success" id="btn-receive-po">📦 Marquer reçu</button>`;
    }
    if (statut !== 'Reçu' && statut !== 'Annulé') {
      toolbarHtml += `<button class="btn btn-ghost danger" id="btn-cancel-po">✕ Annuler</button>`;
    }

    toolbar.innerHTML = toolbarHtml;

    /* Listeners toolbar */
    toolbar.querySelector('#btn-po-back').addEventListener('click', () => {
      _state.mode = 'list';
      _renderPOList(toolbar, area);
    });

    const btnSave    = toolbar.querySelector('#btn-save-po');
    const btnSend    = toolbar.querySelector('#btn-send-po');
    const btnConfirm = toolbar.querySelector('#btn-confirm-po');
    const btnReceive = toolbar.querySelector('#btn-receive-po');
    const btnCancel  = toolbar.querySelector('#btn-cancel-po');

    if (btnSave)    btnSave.addEventListener('click',    () => _savePO('Brouillon'));
    if (btnSend)    btnSend.addEventListener('click',    () => _savePO('Envoyé'));
    if (btnConfirm) btnConfirm.addEventListener('click', () => _savePO('Confirmé'));
    if (btnReceive) btnReceive.addEventListener('click', () => _receivePO());
    if (btnCancel)  btnCancel.addEventListener('click',  () => {
      showConfirm('Annuler ce bon de commande ?', () => {
        _savePO('Annulé');
      }, null, 'Annuler le BC', true);
    });

    /* ---- Fournisseurs pour le select ---- */
    const fournisseurs = Store.getAll('fournisseurs');
    const foptions = fournisseurs.map(f => ({ value: f.nom, label: f.nom }));

    /* ---- Données actuelles ---- */
    const ref    = bon ? bon.reference : _genRef();
    const fnom   = bon ? bon.fournisseur : '';
    const date   = bon ? bon.date : new Date().toISOString().slice(0, 10);
    const notes  = bon ? (bon.notes || '') : '';
    const echeance = bon ? (bon.echeance || '') : '';

    /* ---- HTML du formulaire ---- */
    area.innerHTML = `
      <div style="max-width:900px;margin:0 auto;padding:24px 0;">

        <!-- En-tête -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
          <div>
            <div style="font-size:22px;font-weight:700;color:var(--text-primary);">${_escP(ref)}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
              Statut :
              <span style="font-weight:600;color:${_badgeColor(statut)};">${statut}</span>
            </div>
          </div>
        </div>

        <!-- Champs principaux -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:24px;">
          <div class="form-group">
            <label class="form-label">Fournisseur *</label>
            <select id="po-fournisseur" class="form-input" ${statut === 'Reçu' || statut === 'Annulé' ? 'disabled' : ''}>
              <option value="">— Sélectionner —</option>
              ${foptions.map(o => `<option value="${_escP(o.value)}" ${fnom === o.value ? 'selected' : ''}>${_escP(o.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date commande</label>
            <input id="po-date" type="date" class="form-input" value="${date}"
              ${statut === 'Reçu' || statut === 'Annulé' ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Date échéance</label>
            <input id="po-echeance" type="date" class="form-input" value="${echeance}"
              ${statut === 'Reçu' || statut === 'Annulé' ? 'disabled' : ''}>
          </div>
        </div>

        <!-- Table des lignes -->
        <div style="margin-bottom:24px;">
          <div style="font-size:13px;font-weight:600;color:var(--text-secondary);
            text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">
            Lignes de commande
          </div>
          <table style="width:100%;border-collapse:collapse;" id="po-line-table">
            <thead>
              <tr style="border-bottom:1px solid var(--border);">
                <th style="${_th()}">Produit</th>
                <th style="${_th()}">Description</th>
                <th style="${_th()} text-align:right;">Qté</th>
                <th style="${_th()} text-align:right;">Coût unitaire (XPF HT)</th>
                <th style="${_th()} text-align:right;">Total HT</th>
                ${statut !== 'Reçu' && statut !== 'Annulé' ? `<th style="${_th()}"></th>` : ''}
              </tr>
            </thead>
            <tbody id="po-lignes-body">
              ${_renderLignesHTML(statut)}
            </tbody>
          </table>
          ${statut !== 'Reçu' && statut !== 'Annulé' ? `
          <button id="btn-add-ligne" class="btn btn-ghost" style="margin-top:10px;">
            + Ajouter une ligne
          </button>` : ''}
        </div>

        <!-- Totaux -->
        <div style="display:flex;justify-content:flex-end;margin-bottom:24px;">
          <div style="min-width:280px;border:1px solid var(--border);border-radius:8px;padding:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
              <span style="color:var(--text-secondary);">Total HT</span>
              <span id="po-total-ht" style="font-family:var(--font-mono);">0 XPF</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;">
              <span style="color:var(--text-secondary);">TVA (16%)</span>
              <span id="po-total-tva" style="font-family:var(--font-mono);">0 XPF</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:16px;
              font-weight:700;border-top:1px solid var(--border);padding-top:10px;margin-top:4px;">
              <span style="color:var(--text-primary);">Total TTC</span>
              <span id="po-total-ttc" style="font-family:var(--font-mono);
                color:var(--accent-blue);">0 XPF</span>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="form-group" style="margin-bottom:24px;">
          <label class="form-label">Notes internes</label>
          <textarea id="po-notes" class="form-input" rows="3"
            style="resize:vertical;"
            ${statut === 'Reçu' || statut === 'Annulé' ? 'disabled' : ''}
            placeholder="Instructions au fournisseur, références internes…">${notes}</textarea>
        </div>

      </div>`;

    /* Bind événements lignes */
    _bindPOLigneEvents(statut);
    _updatePOTotaux();
  }

  /* Génère le HTML des lignes */
  function _renderLignesHTML(statut) {
    const produits = Store.getAll('produits');
    const readonly = statut === 'Reçu' || statut === 'Annulé';

    return _state.lignes.map((l, i) => {
      const totalLigne = (l.qte || 0) * (l.prixUnitaire || 0);
      return `
        <tr data-idx="${i}" style="border-bottom:1px solid var(--border-subtle);">
          <td style="${_td()}">
            ${readonly
              ? `<span>${_escP(l.produitNom || '—')}</span>`
              : `<select class="form-input ligne-produit" data-idx="${i}"
                  style="font-size:13px;padding:6px 8px;">
                  <option value="">— Aucun —</option>
                  ${produits.map(p =>
                    `<option value="${p.id}" ${l.produitId === p.id ? 'selected' : ''}>
                      ${_escP(p.emoji || '')} ${_escP(p.nom)}</option>`
                  ).join('')}
                </select>`
            }
          </td>
          <td style="${_td()}">
            ${readonly
              ? `<span>${_escP(l.description || '')}</span>`
              : `<input class="form-input ligne-desc" data-idx="${i}" type="text"
                  value="${_escP(l.description || '')}" placeholder="Description…"
                  style="font-size:13px;padding:6px 8px;">`
            }
          </td>
          <td style="${_td()} text-align:right;width:80px;">
            ${readonly
              ? `<span>${l.qte || 0}</span>`
              : `<input class="form-input ligne-qte" data-idx="${i}" type="number"
                  value="${l.qte || 1}" min="1"
                  style="font-size:13px;padding:6px 8px;text-align:right;width:70px;">`
            }
          </td>
          <td style="${_td()} text-align:right;width:180px;">
            ${readonly
              ? `<span>${fmt(l.prixUnitaire || 0)}</span>`
              : `<input class="form-input ligne-prix" data-idx="${i}" type="number"
                  value="${l.prixUnitaire || 0}" min="0"
                  style="font-size:13px;padding:6px 8px;text-align:right;width:130px;">`
            }
          </td>
          <td style="${_td()} text-align:right;font-family:var(--font-mono);font-size:13px;"
            id="po-ligne-total-${i}">
            ${fmt(totalLigne)}
          </td>
          ${!readonly ? `
          <td style="${_td()} width:40px;">
            <button class="btn btn-ghost danger btn-del-ligne" data-idx="${i}"
              style="padding:4px 8px;font-size:12px;">✕</button>
          </td>` : ''}
        </tr>`;
    }).join('');
  }

  /* Bind événements sur la table des lignes */
  function _bindPOLigneEvents(statut) {
    if (statut === 'Reçu' || statut === 'Annulé') return;

    const tbody = document.getElementById('po-lignes-body');
    if (!tbody) return;

    /* Délégation sur le tbody */
    tbody.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (isNaN(idx)) return;

      if (e.target.classList.contains('ligne-produit')) {
        const produitId = e.target.value;
        if (produitId) {
          const produit = Store.getById('produits', produitId);
          if (produit) {
            _state.lignes[idx].produitId    = produitId;
            _state.lignes[idx].produitNom   = produit.nom;
            _state.lignes[idx].description  = produit.nom;
            _state.lignes[idx].prixUnitaire = produit.cout || 0;
          }
        } else {
          _state.lignes[idx].produitId  = null;
          _state.lignes[idx].produitNom = '';
        }
        _refreshPOLignes(statut);
      }
      if (e.target.classList.contains('ligne-qte')) {
        _state.lignes[idx].qte = parseFloat(e.target.value) || 0;
        _updateLigneTotaux(idx);
        _updatePOTotaux();
      }
      if (e.target.classList.contains('ligne-prix')) {
        _state.lignes[idx].prixUnitaire = parseFloat(e.target.value) || 0;
        _updateLigneTotaux(idx);
        _updatePOTotaux();
      }
      if (e.target.classList.contains('ligne-desc')) {
        _state.lignes[idx].description = e.target.value;
      }
    });

    tbody.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (isNaN(idx)) return;
      if (e.target.classList.contains('ligne-qte') ||
          e.target.classList.contains('ligne-prix')) {
        const val = parseFloat(e.target.value) || 0;
        if (e.target.classList.contains('ligne-qte')) _state.lignes[idx].qte = val;
        else _state.lignes[idx].prixUnitaire = val;
        _updateLigneTotaux(idx);
        _updatePOTotaux();
      }
    });

    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-del-ligne');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      if (_state.lignes.length > 1) {
        _state.lignes.splice(idx, 1);
        _refreshPOLignes(statut);
        _updatePOTotaux();
      } else {
        toastWarning('Au moins une ligne est requise.');
      }
    });

    const btnAdd = document.getElementById('btn-add-ligne');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        _state.lignes.push(_newLigne());
        _refreshPOLignes(statut);
      });
    }
  }

  /* Rafraîchit le tableau des lignes (sans rerender tout le formulaire) */
  function _refreshPOLignes(statut) {
    const tbody = document.getElementById('po-lignes-body');
    if (tbody) tbody.innerHTML = _renderLignesHTML(statut);
    _bindPOLigneEvents(statut);
    _updatePOTotaux();
  }

  /* Met à jour le total d'une ligne individuelle */
  function _updateLigneTotaux(idx) {
    const l     = _state.lignes[idx];
    const total = (l.qte || 0) * (l.prixUnitaire || 0);
    const el    = document.getElementById(`po-ligne-total-${idx}`);
    if (el) el.textContent = fmt(total);
  }

  /* Recalcule et affiche les totaux HT/TVA/TTC */
  function _updatePOTotaux() {
    const totalHT  = _state.lignes.reduce((s, l) => s + (l.qte || 0) * (l.prixUnitaire || 0), 0);
    const totalTVA = calcTVA(totalHT, TVA_RATE_PRODUITS); // achats fournisseurs = produits 16%
    const totalTTC = calcTTC(totalHT, TVA_RATE_PRODUITS);

    const elHT  = document.getElementById('po-total-ht');
    const elTVA = document.getElementById('po-total-tva');
    const elTTC = document.getElementById('po-total-ttc');

    if (elHT)  elHT.textContent  = fmt(Math.round(totalHT));
    if (elTVA) elTVA.textContent = fmt(Math.round(totalTVA));
    if (elTTC) elTTC.textContent = fmt(Math.round(totalTTC));
  }

  /* Sauvegarde le BC avec le statut indiqué */
  function _savePO(statut) {
    const fournisseur = document.getElementById('po-fournisseur')?.value;
    if (!fournisseur) { toastError('Veuillez sélectionner un fournisseur.'); return; }

    const date      = document.getElementById('po-date')?.value    || new Date().toISOString().slice(0,10);
    const echeance  = document.getElementById('po-echeance')?.value || '';
    const notes     = document.getElementById('po-notes')?.value    || '';

    /* Lire les descriptions saisies manuellement */
    document.querySelectorAll('.ligne-desc').forEach((el, i) => {
      if (_state.lignes[i]) _state.lignes[i].description = el.value;
    });

    const totalHT  = _state.lignes.reduce((s, l) => s + (l.qte || 0) * (l.prixUnitaire || 0), 0);
    const totalTTC = calcTTC(totalHT);

    const data = {
      fournisseur,
      date,
      echeance,
      notes,
      statut,
      lignes:   deepClone(_state.lignes),
      totalHT:  Math.round(totalHT),
      totalTTC: Math.round(totalTTC)
    };

    if (_state.currentId) {
      Store.update('bonsAchat', _state.currentId, data);
      toastSuccess('Bon de commande mis à jour.');
    } else {
      const ref = _genRef();
      const created = Store.create('bonsAchat', { ...data, reference: ref });
      _state.currentId = created.id;
      toastSuccess('Bon de commande créé.');
    }

    /* Re-render le formulaire pour refléter le nouveau statut */
    _renderPOForm(
      document.getElementById('toolbar-actions'),
      document.getElementById('view-content')
    );
  }

  /* Marquer le BC comme reçu → mise à jour stock + mouvements + comptabilité */
  function _receivePO() {
    if (!_state.currentId) return;
    const bon = Store.getById('bonsAchat', _state.currentId);
    if (!bon) return;

    showConfirm(
      `Confirmer la réception de "${bon.reference}" ?\nLes stocks seront mis à jour automatiquement.`,
      () => {
        const today = new Date().toISOString().slice(0, 10);

        /* 1. Mise à jour du stock pour chaque ligne ayant un produitId */
        bon.lignes.forEach(ligne => {
          if (!ligne.produitId) return;
          const produit = Store.getById('produits', ligne.produitId);
          if (!produit) return;

          const newStock = (produit.stock || 0) + (ligne.qte || 0);
          Store.update('produits', ligne.produitId, { stock: newStock });

          /* 2. Enregistrement du mouvement de stock */
          Store.create('mouvements', {
            date:        today,
            produitId:   ligne.produitId,
            produitNom:  produit.nom,
            type:        'Entrée',
            quantite:    ligne.qte,
            motif:       `Réception BC ${bon.reference}`,
            reference:   bon.reference
          });
        });

        /* 3. Écritures comptables */
        const now = new Date().toISOString();
        /* Débit 607 — Achats de marchandises */
        Store.create('ecritures', {
          date:        today,
          createdAt:   now,
          compte:      '607000',
          libelle:     `Achat - ${bon.reference}`,
          debit:       bon.totalHT,
          credit:      0,
          reference:   bon.reference,
          type:        'achat'
        });
        /* Crédit 401 — Fournisseurs */
        Store.create('ecritures', {
          date:        today,
          createdAt:   now,
          compte:      '401000',
          libelle:     `Fournisseur - ${bon.fournisseur} / ${bon.reference}`,
          debit:       0,
          credit:      bon.totalTTC,
          reference:   bon.reference,
          type:        'achat'
        });

        /* 4. Statut → Reçu */
        Store.update('bonsAchat', _state.currentId, { statut: 'Reçu', dateReception: today });
        toastSuccess('Réception enregistrée. Stocks et comptabilité mis à jour.');

        _renderPOForm(
          document.getElementById('toolbar-actions'),
          document.getElementById('view-content')
        );
      },
      null,
      'Confirmer réception',
      false
    );
  }

  /* ================================================================
     VUE : RAPPORT ACHATS
     ================================================================ */
  function _renderPurchaseReport(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-ghost" id="btn-export-achats">⬇ Exporter</button>`;

    const bons     = Store.getAll('bonsAchat');
    const now      = new Date();
    const mois     = now.getMonth();
    const annee    = now.getFullYear();

    /* Filtrage mois courant */
    const bonsMois = bons.filter(b => {
      if (!b.date) return false;
      const d = new Date(b.date);
      return d.getMonth() === mois && d.getFullYear() === annee;
    });

    const totalMois   = bonsMois.reduce((s, b) => s + (b.totalTTC || 0), 0);
    const nbCmds      = bonsMois.length;
    const recus       = bons.filter(b => b.statut === 'Reçu');
    const nbRecus     = recus.length;

    /* Top fournisseur (tous temps) */
    const foMap = {};
    bons.forEach(b => {
      if (b.fournisseur) {
        foMap[b.fournisseur] = (foMap[b.fournisseur] || 0) + (b.totalTTC || 0);
      }
    });
    const topFo = Object.entries(foMap).sort((a, b) => b[1] - a[1])[0];

    /* Délai moyen livraison (jours) */
    let delaiMoyen = 0;
    const fournisseurs = Store.getAll('fournisseurs');
    if (fournisseurs.length > 0) {
      const total = fournisseurs.reduce((s, f) => s + (parseInt(f.delaiLivraison) || 0), 0);
      delaiMoyen = Math.round(total / fournisseurs.length);
    }

    area.innerHTML = `
      <div style="padding:24px 0;max-width:1100px;margin:0 auto;">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:24px;">
          Rapport Achats — ${now.toLocaleDateString('fr-FR', { month:'long', year:'numeric' })}
        </div>

        <!-- KPI -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px;">
          <div id="kpi-achats-mois"></div>
          <div id="kpi-nb-cmds"></div>
          <div id="kpi-top-fo"></div>
          <div id="kpi-delai-moyen"></div>
        </div>

        <!-- Graphiques -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
          <div style="background:var(--bg-surface);border:1px solid var(--border);
            border-radius:12px;padding:20px;">
            <div id="chart-achats-fournisseur"></div>
          </div>
          <div style="background:var(--bg-surface);border:1px solid var(--border);
            border-radius:12px;padding:20px;">
            <div id="chart-achats-statuts"></div>
          </div>
        </div>

        <!-- Derniers BC -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);
          border-radius:12px;padding:20px;">
          <div style="font-size:14px;font-weight:600;color:var(--text-secondary);
            margin-bottom:16px;">Derniers bons de commande</div>
          <div id="table-derniers-bc"></div>
        </div>
      </div>`;

    /* Stat cards */
    statCard('kpi-achats-mois', {
      icon: '💰', value: fmt(Math.round(totalMois)),
      label: 'Achats du mois', color: 'var(--accent-blue)'
    });
    statCard('kpi-nb-cmds', {
      icon: '📋', value: nbCmds,
      label: 'Commandes mois', color: 'var(--accent-orange)'
    });
    statCard('kpi-top-fo', {
      icon: '🏆',
      value: topFo ? truncate(topFo[0], 18) : '—',
      label: 'Top fournisseur',
      color: 'var(--accent-green)',
      sub: topFo ? fmt(Math.round(topFo[1])) : ''
    });
    statCard('kpi-delai-moyen', {
      icon: '⏱', value: delaiMoyen + 'j',
      label: 'Délai moyen livraison', color: 'var(--accent-violet)'
    });

    /* Bar chart fournisseurs */
    const foEntries = Object.entries(foMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    barChart('chart-achats-fournisseur', {
      title: 'Achats par fournisseur',
      labels: foEntries.map(e => e[0]),
      values: foEntries.map(e => e[1]),
      formatter: (v) => fmt(Math.round(v)),
      colors: ['#4a5fff','#00d4aa','#ffc857','#ff6b6b','#b07bff','#00b4d8']
    });

    /* Pie chart statuts */
    const statutMap = {};
    bons.forEach(b => {
      statutMap[b.statut] = (statutMap[b.statut] || 0) + 1;
    });
    const statutColors = {
      'Brouillon': '#4a5270',
      'Envoyé':    '#4a5fff',
      'Confirmé':  '#ffc857',
      'Reçu':      '#00d4aa',
      'Annulé':    '#ff6b6b'
    };
    pieChart('chart-achats-statuts', {
      title: 'Répartition des statuts',
      segments: Object.entries(statutMap).map(([s, count]) => ({
        label: s, value: count, color: statutColors[s] || '#4a5270'
      })),
      size: 140,
      donut: true
    });

    /* Table derniers BC */
    const derniers = [...bons].sort((a, b) =>
      new Date(b.date || 0) - new Date(a.date || 0)
    ).slice(0, 10);

    renderTable('table-derniers-bc', {
      data: derniers,
      columns: [
        { key: 'reference',   label: 'Référence',   type: 'text'  },
        { key: 'fournisseur', label: 'Fournisseur', type: 'text'  },
        { key: 'date',        label: 'Date',         type: 'date'  },
        { key: 'totalTTC',    label: 'Total TTC',    type: 'money', render: (r) => fmt(r.totalTTC||0) },
        { key: 'statut',      label: 'Statut',       type: 'badge', badgeMap: STATUT_COLORS }
      ],
      emptyMsg: 'Aucun bon de commande.',
      onRowClick: (row) => {
        _state.view = 'po';
        _openPO(row);
        init(
          document.getElementById('toolbar-actions'),
          document.getElementById('view-content'),
          'po'
        );
      }
    });
  }

  /* ================================================================
     UTILITAIRES PRIVÉS
     ================================================================ */

  /* Nouvelle ligne vide */
  function _newLigne() {
    return { produitId: null, produitNom: '', description: '', qte: 1, prixUnitaire: 0 };
  }

  /* Génère une référence ACH-YYYY-NNNNN */
  function _genRef() {
    const annee = new Date().getFullYear();
    const num   = Store.nextCounter('ach');
    return `ACH-${annee}-${String(num).padStart(5, '0')}`;
  }

  /* Couleur du badge statut */
  function _badgeColor(statut) {
    const map = {
      'Brouillon': 'var(--text-muted)',
      'Envoyé':    'var(--accent-blue)',
      'Confirmé':  'var(--accent-orange)',
      'Reçu':      'var(--accent-green)',
      'Annulé':    'var(--accent-red)'
    };
    return map[statut] || 'var(--text-secondary)';
  }

  /* Styles communs th/td */
  function _th() {
    return 'padding:8px 12px;font-size:12px;font-weight:600;color:var(--text-secondary);' +
      'text-transform:uppercase;letter-spacing:.06em;';
  }
  function _td() {
    return 'padding:8px 12px;font-size:14px;color:var(--text-primary);';
  }

  /* Échappement HTML */
  function _escP(str) {
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

window.Purchases = Purchases;
