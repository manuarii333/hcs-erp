/* ================================================================
   HCS ERP — js/modules/manufacturing.js
   Module Production : ordres de fab., nomenclatures, postes de travail.
   Pattern IIFE — exposé via window.Manufacturing
   ================================================================ */

'use strict';

const Manufacturing = (() => {

  /* ----------------------------------------------------------------
     État interne du module
     ---------------------------------------------------------------- */
  const _state = {
    view:      'mo',
    mode:      'list',    // 'list' | 'form'
    viewMode:  'kanban',  // 'kanban' | 'list'  — persistant pour vue mo
    currentId: null,
    lignesBOM: []         // lignes de nomenclature en édition
  };

  /* ----------------------------------------------------------------
     Constantes
     ---------------------------------------------------------------- */
  const STAGES_MO = [
    { id: 'Brouillon',  label: 'Brouillon',  color: 'gray'   },
    { id: 'Prêt',       label: 'Prêt',       color: 'blue'   },
    { id: 'En cours',   label: 'En cours',   color: 'orange' },
    { id: 'En attente', label: 'En attente', color: 'violet' },
    { id: 'Terminé',    label: 'Terminé',    color: 'green'  }
  ];

  const PRIORITE_EMOJI = {
    'Basse':   '🟢',
    'Moyenne': '🟡',
    'Haute':   '🔴',
    'Urgente': '🆘'
  };

  const PRIORITE_BADGE = {
    'Basse':   'green',
    'Moyenne': 'blue',
    'Haute':   'orange',
    'Urgente': 'red'
  };

  /* Postes de travail par défaut — créés si la collection est vide */
  const POSTES_DEFAULT = [
    { nom: 'BN20 Yannick',       responsable: 'Yannick', capaciteJour: 50, description: 'Impression numérique grand format' },
    { nom: 'Presse Sublimation', responsable: 'Marie',   capaciteJour: 30, description: 'Transfert sublimation textiles' },
    { nom: 'Découpe SignMaster', responsable: 'Pierre',  capaciteJour: 40, description: 'Découpe vinyle et signalétique' },
    { nom: 'Atelier DTF USA',    responsable: 'John',    capaciteJour: 60, description: 'Impression DTF sur textiles' },
    { nom: 'Broderie',           responsable: 'Sophie',  capaciteJour: 20, description: 'Broderie numérique sur vêtements' },
    { nom: 'Presse Transfert',   responsable: 'Marc',    capaciteJour: 35, description: 'Application transferts thermiques' }
  ];

  /* ================================================================
     POINT D'ENTRÉE — init(toolbar, area, viewId)
     ================================================================ */
  function init(toolbar, area, viewId) {
    if (viewId !== _state.view) {
      _state.view      = viewId;
      _state.mode      = 'list';
      _state.currentId = null;
      _state.lignesBOM = [];
    }

    /* Initialiser les postes par défaut si nécessaire */
    if (Store.getAll('postes').length === 0) {
      POSTES_DEFAULT.forEach(p => Store.create('postes', p));
    }

    switch (_state.view) {
      case 'mo':           _renderMO(toolbar, area);           break;
      case 'bom':          _renderBOM(toolbar, area);          break;
      case 'work-centers': _renderWorkCenters(toolbar, area);  break;
      default:             _renderMO(toolbar, area);
    }
  }

  /* ================================================================
     VUE : ORDRES DE FABRICATION
     ================================================================ */
  function _renderMO(toolbar, area) {
    if (_state.mode === 'form') {
      _renderMOForm(toolbar, area);
      return;
    }

    /* ---- Toolbar MO ---- */
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-new-mo">+ Nouvel OF</button>
      <div style="display:inline-flex;gap:4px;margin-left:8px;">
        <button class="btn ${_state.viewMode === 'kanban' ? 'btn-secondary' : 'btn-ghost'}"
          id="btn-mo-kanban" title="Vue Kanban">⊞ Kanban</button>
        <button class="btn ${_state.viewMode === 'list' ? 'btn-secondary' : 'btn-ghost'}"
          id="btn-mo-list" title="Vue Liste">☰ Liste</button>
      </div>`;

    toolbar.querySelector('#btn-new-mo').addEventListener('click', () => {
      _state.mode      = 'form';
      _state.currentId = null;
      _renderMOForm(
        document.getElementById('toolbar-actions'),
        document.getElementById('view-content')
      );
    });

    toolbar.querySelector('#btn-mo-kanban').addEventListener('click', () => {
      _state.viewMode = 'kanban';
      _renderMO(
        document.getElementById('toolbar-actions'),
        document.getElementById('view-content')
      );
    });

    toolbar.querySelector('#btn-mo-list').addEventListener('click', () => {
      _state.viewMode = 'list';
      _renderMO(
        document.getElementById('toolbar-actions'),
        document.getElementById('view-content')
      );
    });

    if (_state.viewMode === 'kanban') {
      _renderMOKanban(area);
    } else {
      _renderMOList(area);
    }
  }

  /* ---- Kanban OF ---- */
  function _renderMOKanban(area) {
    area.innerHTML = `
      <div style="padding:8px 0 4px;">
        <div id="mfg-mo-kanban"></div>
      </div>`;

    const ordres = _getAllOrdres();

    renderKanban('mfg-mo-kanban', {
      stages:  STAGES_MO,
      cards:   ordres,
      groupBy: 'statut',

      cardTemplate: (of) => {
        const prio    = of.priorite || 'Basse';
        const prog    = Math.min(100, Math.max(0, of.progression || 0));
        const butoir  = of.dateFin ? fmtDate(of.dateFin) : '—';
        const progColor = prog >= 100 ? 'var(--accent-green)'
          : prog >= 50 ? 'var(--accent-blue)'
          : 'var(--accent-orange)';

        return `
          <div style="padding:12px;cursor:pointer;" data-id="${of.id}">
            <!-- Référence + priorité -->
            <div style="display:flex;justify-content:space-between;align-items:center;
              margin-bottom:6px;">
              <span style="font-size:11px;font-family:var(--font-mono);
                color:var(--text-muted);">${_escM(of.reference || '—')}</span>
              <span title="${_escM(prio)}">${PRIORITE_EMOJI[prio] || '🟡'}</span>
            </div>
            <!-- Produit -->
            <div style="font-weight:600;font-size:13px;color:var(--text-primary);
              margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${_escM(of.produit || '—')}
            </div>
            <!-- Quantité + assigné -->
            <div style="display:flex;justify-content:space-between;
              font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
              <span>Qté : <strong>${of.quantite || 0}</strong></span>
              <span>${_escM(of.assigneA || '—')}</span>
            </div>
            <!-- Barre de progression -->
            <div style="height:4px;background:var(--bg-elevated);border-radius:2px;
              overflow:hidden;margin-bottom:6px;">
              <div style="height:100%;width:${prog}%;background:${progColor};
                border-radius:2px;transition:width 0.4s ease;"></div>
            </div>
            <!-- Date butoir -->
            <div style="font-size:11px;color:var(--text-muted);">
              📅 Butoir : ${_escM(butoir)}
            </div>
          </div>`;
      },

      onCardClick: (of) => {
        _state.mode      = 'form';
        _state.currentId = of.id;
        _renderMOForm(
          document.getElementById('toolbar-actions'),
          document.getElementById('view-content')
        );
      },

      onStageChange: (of, newStage) => {
        Store.update('ordresFab', of.id, { statut: newStage });
      },

      addLabel: '+ Nouvel OF',
      onAdd: (stageId) => {
        _state.mode      = 'form';
        _state.currentId = null;
        /* pré-remplir le statut avec la colonne cliquée */
        _state._defaultStatut = stageId;
        _renderMOForm(
          document.getElementById('toolbar-actions'),
          document.getElementById('view-content')
        );
      }
    });
  }

  /* ---- Liste OF ---- */
  function _renderMOList(area) {
    const ordres = _getAllOrdres();

    area.innerHTML = '<div id="mfg-mo-table"></div>';

    renderTable('mfg-mo-table', {
      title: `Ordres de fabrication (${ordres.length})`,
      data:  ordres,
      searchable: true,
      columns: [
        { key: 'reference', label: 'Référence',  type: 'text', sortable: true,
          render: (r) => `<span style="font-family:var(--font-mono);font-size:12px;">${_escM(r.reference||'—')}</span>` },
        { key: 'produit',   label: 'Produit',    type: 'text', sortable: true },
        { key: 'quantite',  label: 'Qté',        type: 'text',
          render: (r) => `<span style="font-family:var(--font-mono);">${r.quantite||0}</span>` },
        { key: 'priorite',  label: 'Priorité',   type: 'badge', badgeMap: PRIORITE_BADGE,
          render: (r) => `${PRIORITE_EMOJI[r.priorite]||'🟡'} ${r.priorite||'—'}` },
        { key: 'statut',    label: 'Statut',     type: 'badge',
          badgeMap: { 'Brouillon':'gray','Prêt':'blue','En cours':'orange','En attente':'violet','Terminé':'green' },
          sortable: true },
        { key: 'assigneA',  label: 'Assigné à',  type: 'text' },
        {
          key: 'progression', label: 'Progression', type: 'text',
          render: (r) => {
            const p = r.progression || 0;
            return `
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:6px;background:var(--bg-elevated);border-radius:3px;overflow:hidden;min-width:80px;">
                  <div style="height:100%;width:${p}%;background:var(--accent-blue);border-radius:3px;"></div>
                </div>
                <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">${p}%</span>
              </div>`;
          }
        },
        { key: 'dateFin', label: 'Date butoir', type: 'date', sortable: true },
        {
          key: '_actions', label: '', type: 'actions',
          actions: [
            { label: '✏️ Ouvrir', className: 'btn-ghost', onClick: (row) => {
              _state.mode      = 'form';
              _state.currentId = row.id;
              _renderMOForm(
                document.getElementById('toolbar-actions'),
                document.getElementById('view-content')
              );
            }}
          ]
        }
      ],
      emptyMsg: 'Aucun ordre de fabrication.',
      onRowClick: (row) => {
        _state.mode      = 'form';
        _state.currentId = row.id;
        _renderMOForm(
          document.getElementById('toolbar-actions'),
          document.getElementById('view-content')
        );
      }
    });
  }

  /* ---- Formulaire OF ---- */
  function _renderMOForm(toolbar, area) {
    const isNew = !_state.currentId;
    const of    = isNew ? {} : (Store.getById('ordresFab', _state.currentId) || {});
    const statut = of.statut || _state._defaultStatut || 'Brouillon';

    /* Nettoyer le statut par défaut */
    delete _state._defaultStatut;

    /* ---- Toolbar ---- */
    let tbHtml = `<button class="btn btn-ghost" id="btn-mo-back">← Retour</button>`;

    if (statut === 'Brouillon' || statut === 'Prêt') {
      tbHtml += `<button class="btn btn-primary" id="btn-save-mo">💾 Enregistrer</button>`;
      if (statut === 'Prêt') {
        tbHtml += `<button class="btn btn-secondary" id="btn-start-mo">▶ Démarrer</button>`;
      }
    }
    if (statut === 'En cours') {
      tbHtml += `<button class="btn btn-primary" id="btn-save-mo">💾 Enregistrer</button>`;
      tbHtml += `<button class="btn btn-ghost" id="btn-pause-mo">⏸ Mettre en pause</button>`;
      tbHtml += `<button class="btn btn-success" id="btn-done-mo">✅ Terminer</button>`;
    }
    if (statut === 'En attente') {
      tbHtml += `<button class="btn btn-primary" id="btn-save-mo">💾 Enregistrer</button>`;
      tbHtml += `<button class="btn btn-secondary" id="btn-start-mo">▶ Reprendre</button>`;
    }
    if (statut === 'Brouillon') {
      tbHtml += `<button class="btn btn-secondary" id="btn-ready-mo">✓ Marquer Prêt</button>`;
    }
    if (statut !== 'Terminé') {
      tbHtml += `<button class="btn btn-ghost danger" id="btn-cancel-mo">✕ Annuler</button>`;
    }

    toolbar.innerHTML = tbHtml;

    /* Listeners */
    toolbar.querySelector('#btn-mo-back').addEventListener('click', () => {
      _state.mode = 'list';
      _renderMO(toolbar, area);
    });

    const btnSave   = toolbar.querySelector('#btn-save-mo');
    const btnStart  = toolbar.querySelector('#btn-start-mo');
    const btnPause  = toolbar.querySelector('#btn-pause-mo');
    const btnDone   = toolbar.querySelector('#btn-done-mo');
    const btnReady  = toolbar.querySelector('#btn-ready-mo');
    const btnCancel = toolbar.querySelector('#btn-cancel-mo');

    if (btnSave)   btnSave.addEventListener('click',   () => _saveMO(null));
    if (btnReady)  btnReady.addEventListener('click',  () => _saveMO('Prêt'));
    if (btnStart)  btnStart.addEventListener('click',  () => _saveMO('En cours'));
    if (btnPause)  btnPause.addEventListener('click',  () => _saveMO('En attente'));
    if (btnDone)   btnDone.addEventListener('click',   () => _confirmTerminer());
    if (btnCancel) btnCancel.addEventListener('click', () => {
      showConfirm('Annuler cet ordre de fabrication ?', () => _saveMO('Annulé'), null, 'Annuler l\'OF', true);
    });

    /* ---- Options sélects ---- */
    const postes   = Store.getAll('postes');
    const commandes = Store.getAll('commandes');
    const postesOpts  = postes.map(p => ({ value: p.nom, label: p.nom }));
    const cmdOpts     = [{ value: '', label: '— Aucune —' },
      ...commandes.map(c => ({ value: c.id, label: `${c.reference || c.ref || c.id} — ${c.client || ''}` }))];

    const ref        = of.reference  || _genRefOF();
    const prog       = of.progression !== undefined ? of.progression : 0;
    const dateDebut  = of.dateDebut  || new Date().toISOString().slice(0, 10);
    const dateFin    = of.dateFin    || '';
    const commandeId = of.commandeId || '';
    const poste      = of.poste      || '';
    const assigneA   = of.assigneA   || '';
    const notes      = of.notes      || '';
    const priorite   = of.priorite   || 'Moyenne';
    const produit    = of.produit    || '';
    const quantite   = of.quantite   || 1;
    const readonly   = statut === 'Terminé' || statut === 'Annulé';

    /* ---- HTML formulaire ---- */
    area.innerHTML = `
      <div style="max-width:860px;margin:0 auto;padding:24px 0;">

        <!-- En-tête -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">
          <div>
            <div style="font-size:22px;font-weight:700;color:var(--text-primary);">
              ${_escM(ref)}
            </div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
              Statut :
              <span style="font-weight:600;color:${_statutColor(statut)};">${statut}</span>
            </div>
          </div>
        </div>

        <!-- Champs principaux -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;">
          <div class="form-group" style="grid-column:span 2;">
            <label class="form-label">Produit à fabriquer *</label>
            <input id="of-produit" type="text" class="form-input"
              value="${_escM(produit)}" placeholder="Ex. : Polo brodé HCS…"
              ${readonly ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Quantité *</label>
            <input id="of-quantite" type="number" min="1" class="form-input"
              value="${quantite}" ${readonly ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Priorité</label>
            <select id="of-priorite" class="form-input" ${readonly ? 'disabled' : ''}>
              ${['Basse','Moyenne','Haute','Urgente'].map(p =>
                `<option value="${p}" ${priorite === p ? 'selected' : ''}>${PRIORITE_EMOJI[p]} ${p}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Assigné à</label>
            <input id="of-assigne" type="text" class="form-input"
              value="${_escM(assigneA)}" placeholder="Nom du responsable"
              ${readonly ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Poste de travail</label>
            <select id="of-poste" class="form-input" ${readonly ? 'disabled' : ''}>
              <option value="">— Sélectionner —</option>
              ${postesOpts.map(o => `<option value="${_escM(o.value)}" ${poste === o.value ? 'selected' : ''}>${_escM(o.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Commande liée</label>
            <select id="of-commande" class="form-input" ${readonly ? 'disabled' : ''}>
              ${cmdOpts.map(o => `<option value="${_escM(o.value)}" ${commandeId === o.value ? 'selected' : ''}>${_escM(o.label)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date début</label>
            <input id="of-date-debut" type="date" class="form-input"
              value="${dateDebut}" ${readonly ? 'disabled' : ''}>
          </div>
          <div class="form-group">
            <label class="form-label">Date butoir</label>
            <input id="of-date-fin" type="date" class="form-input"
              value="${dateFin}" ${readonly ? 'disabled' : ''}>
          </div>
        </div>

        <!-- Progression -->
        <div class="form-group" style="margin-bottom:20px;">
          <label class="form-label">
            Progression :
            <span id="of-prog-display" style="font-family:var(--font-mono);
              color:var(--accent-blue);">${prog}%</span>
          </label>
          <div style="display:flex;align-items:center;gap:12px;">
            <input id="of-progression" type="range" min="0" max="100" value="${prog}"
              style="flex:1;accent-color:var(--accent-blue);"
              ${readonly ? 'disabled' : ''}>
            <div style="flex:1;height:8px;background:var(--bg-elevated);
              border-radius:4px;overflow:hidden;">
              <div id="of-prog-bar" style="height:100%;width:${prog}%;
                background:var(--accent-blue);border-radius:4px;
                transition:width 0.2s ease;"></div>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="form-group" style="margin-bottom:24px;">
          <label class="form-label">Notes</label>
          <textarea id="of-notes" class="form-input" rows="3"
            style="resize:vertical;" ${readonly ? 'disabled' : ''}
            placeholder="Instructions de fabrication, remarques…">${notes}</textarea>
        </div>

      </div>`;

    /* Slider live */
    const slider  = document.getElementById('of-progression');
    const display = document.getElementById('of-prog-display');
    const bar     = document.getElementById('of-prog-bar');
    if (slider) {
      slider.addEventListener('input', () => {
        const v = slider.value;
        if (display) display.textContent = v + '%';
        if (bar)     bar.style.width     = v + '%';
      });
    }
  }

  /* Sauvegarde OF */
  function _saveMO(nouveauStatut) {
    const produit = document.getElementById('of-produit')?.value?.trim();
    if (!produit) { toastError('Le produit est obligatoire.'); return; }

    const isNew  = !_state.currentId;
    const ofActuel = isNew ? {} : (Store.getById('ordresFab', _state.currentId) || {});

    const data = {
      produit,
      quantite:    parseFloat(document.getElementById('of-quantite')?.value) || 1,
      priorite:    document.getElementById('of-priorite')?.value  || 'Moyenne',
      assigneA:    document.getElementById('of-assigne')?.value   || '',
      poste:       document.getElementById('of-poste')?.value     || '',
      commandeId:  document.getElementById('of-commande')?.value  || '',
      dateDebut:   document.getElementById('of-date-debut')?.value || '',
      dateFin:     document.getElementById('of-date-fin')?.value   || '',
      progression: parseInt(document.getElementById('of-progression')?.value || 0),
      notes:       document.getElementById('of-notes')?.value     || '',
      statut:      nouveauStatut || ofActuel.statut || 'Brouillon'
    };

    if (isNew) {
      const ref  = _genRefOF();
      const created = Store.create('ordresFab', { ...data, reference: ref });
      _state.currentId = created.id;
      toastSuccess('Ordre de fabrication créé.');
    } else {
      Store.update('ordresFab', _state.currentId, data);
      toastSuccess('OF mis à jour.');
    }

    /* Re-render le formulaire avec le nouveau statut */
    _renderMOForm(
      document.getElementById('toolbar-actions'),
      document.getElementById('view-content')
    );
  }

  /* Confirmation de terminaison (avec mise à jour stock si produit lié) */
  function _confirmTerminer() {
    const of = Store.getById('ordresFab', _state.currentId);
    if (!of) return;

    /* Chercher si un produit du catalogue correspond */
    const produits = Store.getAll('produits');
    const match    = produits.find(p =>
      p.nom.toLowerCase().includes(of.produit.toLowerCase()) ||
      of.produit.toLowerCase().includes(p.nom.toLowerCase())
    );

    const msgStock = match
      ? `\nLe stock de "${match.nom}" sera augmenté de ${of.quantite} unités.`
      : '';

    showConfirm(
      `Terminer l'OF "${of.reference}" ?${msgStock}`,
      () => {
        /* Mise à jour stock si produit trouvé */
        if (match) {
          const newStock = (match.stock || 0) + (of.quantite || 0);
          Store.update('produits', match.id, { stock: newStock });

          Store.create('mouvements', {
            date:       new Date().toISOString().slice(0, 10),
            produitId:  match.id,
            produitNom: match.nom,
            type:       'Entrée',
            quantite:   of.quantite,
            motif:      `Production OF ${of.reference}`,
            reference:  of.reference
          });

          toastSuccess(`Stock "${match.nom}" mis à jour → ${newStock} u.`);
        }

        Store.update('ordresFab', _state.currentId, {
          statut:      'Terminé',
          progression: 100,
          dateTermine: new Date().toISOString().slice(0, 10)
        });
        toastSuccess('OF terminé.');
        _renderMOForm(
          document.getElementById('toolbar-actions'),
          document.getElementById('view-content')
        );
      },
      null,
      'Terminer',
      false
    );
  }

  /* ================================================================
     VUE : NOMENCLATURES (BOM)
     ================================================================ */
  function _renderBOM(toolbar, area) {
    if (_state.mode === 'form') {
      _renderBOMForm(toolbar, area);
      return;
    }
    _renderBOMList(toolbar, area);
  }

  /* ---- Liste nomenclatures ---- */
  function _renderBOMList(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-new-bom">+ Nouvelle nomenclature</button>`;

    toolbar.querySelector('#btn-new-bom').addEventListener('click', () => {
      _state.mode      = 'form';
      _state.currentId = null;
      _state.lignesBOM = [_newLigneBOM()];
      _renderBOMForm(toolbar, area);
    });

    const boms    = Store.getAll('nomenclatures');
    const produits = Store.getAll('produits');

    /* Enrichir les BOMs avec nb composants et coût total */
    const data = boms.map(bom => {
      const nbComposants = (bom.lignes || []).length;
      const coutTotal    = (bom.lignes || []).reduce((s, l) => {
        const prod = l.composantId ? Store.getById('produits', l.composantId) : null;
        return s + (prod ? (prod.cout || 0) * (l.quantite || 0) : 0);
      }, 0);
      return { ...bom, nbComposants, coutTotal };
    });

    area.innerHTML = '<div id="mfg-bom-table"></div>';
    renderTable('mfg-bom-table', {
      title: `Nomenclatures (${boms.length})`,
      data,
      searchable: true,
      columns: [
        { key: 'produitFini', label: 'Produit fini',    type: 'text', sortable: true },
        { key: 'nbComposants',label: 'Nb composants',   type: 'text' },
        {
          key: 'coutTotal', label: 'Coût composants', type: 'money',
          render: (r) => fmt(Math.round(r.coutTotal))
        },
        {
          key: '_actions', label: '', type: 'actions',
          actions: [
            { label: '✏️ Modifier',  className: 'btn-ghost', onClick: (row) => _openBOM(row) },
            { label: '🗑 Supprimer', className: 'btn-ghost danger', onClick: (row) => _deleteBOM(row) }
          ]
        }
      ],
      emptyMsg: 'Aucune nomenclature.',
      onRowClick: (row) => _openBOM(row)
    });
  }

  function _openBOM(bom) {
    _state.mode      = 'form';
    _state.currentId = bom.id;
    _state.lignesBOM = deepClone(bom.lignes || [_newLigneBOM()]);
    _renderBOMForm(
      document.getElementById('toolbar-actions'),
      document.getElementById('view-content')
    );
  }

  /* ---- Formulaire BOM ---- */
  function _renderBOMForm(toolbar, area) {
    const isNew = !_state.currentId;
    const bom   = isNew ? {} : (Store.getById('nomenclatures', _state.currentId) || {});
    const titre = isNew ? 'Nouvelle nomenclature' : `Nomenclature — ${bom.produitFini || ''}`;

    toolbar.innerHTML = `
      <button class="btn btn-ghost" id="btn-bom-back">← Retour</button>
      <button class="btn btn-primary" id="btn-save-bom">💾 Enregistrer</button>`;

    toolbar.querySelector('#btn-bom-back').addEventListener('click', () => {
      _state.mode = 'list';
      _renderBOMList(toolbar, area);
    });
    toolbar.querySelector('#btn-save-bom').addEventListener('click', () => _saveBOM(bom));

    const produits = Store.getAll('produits');
    const prodOpts = produits.map(p => ({ value: p.id, label: `${p.emoji || '📦'} ${p.nom}` }));

    area.innerHTML = `
      <div style="max-width:860px;margin:0 auto;padding:24px 0;">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:24px;">
          ${_escM(titre)}
        </div>

        <!-- Produit fini -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
          <div class="form-group" style="grid-column:span 1;">
            <label class="form-label">Produit fini *</label>
            <input id="bom-produit" type="text" class="form-input"
              value="${_escM(bom.produitFini || '')}"
              placeholder="Nom du produit fini (ex : Polo brodé)">
          </div>
          <div class="form-group">
            <label class="form-label">Produit catalogue (optionnel)</label>
            <select id="bom-produit-id" class="form-input">
              <option value="">— Lier un produit catalogue —</option>
              ${prodOpts.map(o => `<option value="${_escM(o.value)}"
                ${bom.produitFiniId === o.value ? 'selected' : ''}>${_escM(o.label)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Table des composants -->
        <div style="font-size:13px;font-weight:600;color:var(--text-secondary);
          text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">
          Composants
        </div>
        <table style="width:100%;border-collapse:collapse;" id="bom-table">
          <thead>
            <tr style="border-bottom:1px solid var(--border);">
              <th style="${_th()}">Composant</th>
              <th style="${_th()}">Produit catalogue</th>
              <th style="${_th()} text-align:right;">Quantité</th>
              <th style="${_th()}">Unité</th>
              <th style="${_th()} text-align:right;">Coût unit.</th>
              <th style="${_th()}"></th>
            </tr>
          </thead>
          <tbody id="bom-lignes-body">
            ${_renderBOMLignesHTML(produits)}
          </tbody>
        </table>
        <button id="btn-add-bom-ligne" class="btn btn-ghost" style="margin-top:10px;">
          + Ajouter un composant
        </button>

        <!-- Coût total -->
        <div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <div style="border:1px solid var(--border);border-radius:8px;padding:12px 20px;">
            <span style="color:var(--text-secondary);font-size:14px;">Coût total composants : </span>
            <span id="bom-cout-total" style="font-family:var(--font-mono);
              font-weight:700;color:var(--accent-blue);">0 XPF</span>
          </div>
        </div>
      </div>`;

    /* Auto-fill nom depuis select catalogue */
    document.getElementById('bom-produit-id')?.addEventListener('change', (e) => {
      if (e.target.value) {
        const prod = Store.getById('produits', e.target.value);
        if (prod) {
          const nomInput = document.getElementById('bom-produit');
          if (nomInput && !nomInput.value) nomInput.value = prod.nom;
        }
      }
    });

    _bindBOMLigneEvents(produits);
    _updateBOMCout(produits);
  }

  /* HTML des lignes BOM */
  function _renderBOMLignesHTML(produits) {
    return _state.lignesBOM.map((l, i) => {
      const prod = l.composantId ? produits.find(p => p.id === l.composantId) : null;
      const cout = prod ? (prod.cout || 0) : 0;
      return `
        <tr data-idx="${i}" style="border-bottom:1px solid var(--border-subtle);">
          <td style="${_td()}">
            <input class="form-input bom-composant" data-idx="${i}" type="text"
              value="${_escM(l.composant || '')}"
              placeholder="Ex : Polo Blanc, Fil broderie…"
              style="font-size:13px;padding:6px 8px;">
          </td>
          <td style="${_td()}">
            <select class="form-input bom-produit-id" data-idx="${i}"
              style="font-size:13px;padding:6px 8px;">
              <option value="">— Aucun —</option>
              ${produits.map(p => `<option value="${p.id}" ${l.composantId === p.id ? 'selected' : ''}>
                ${_escM(p.emoji||'')} ${_escM(p.nom)}</option>`).join('')}
            </select>
          </td>
          <td style="${_td()} width:90px; text-align:right;">
            <input class="form-input bom-qte" data-idx="${i}" type="number"
              value="${l.quantite || 1}" min="0" step="0.1"
              style="font-size:13px;padding:6px 8px;text-align:right;width:75px;">
          </td>
          <td style="${_td()} width:90px;">
            <input class="form-input bom-unite" data-idx="${i}" type="text"
              value="${_escM(l.unite || 'u')}"
              style="font-size:13px;padding:6px 8px;width:70px;">
          </td>
          <td style="${_td()} text-align:right;width:140px;font-family:var(--font-mono);font-size:13px;">
            ${fmt(cout)}
          </td>
          <td style="${_td()} width:40px;">
            <button class="btn btn-ghost danger btn-del-bom" data-idx="${i}"
              style="padding:4px 8px;font-size:12px;">✕</button>
          </td>
        </tr>`;
    }).join('');
  }

  /* Événements table BOM */
  function _bindBOMLigneEvents(produits) {
    const tbody = document.getElementById('bom-lignes-body');
    if (!tbody) return;

    tbody.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (isNaN(idx)) return;

      if (e.target.classList.contains('bom-produit-id')) {
        const id = e.target.value;
        _state.lignesBOM[idx].composantId = id || null;
        if (id) {
          const prod = Store.getById('produits', id);
          if (prod && !_state.lignesBOM[idx].composant) {
            _state.lignesBOM[idx].composant = prod.nom;
            _state.lignesBOM[idx].unite = prod.unite || 'u';
          }
        }
        _refreshBOMLignes(produits);
      }
      if (e.target.classList.contains('bom-qte')) {
        _state.lignesBOM[idx].quantite = parseFloat(e.target.value) || 0;
        _updateBOMCout(produits);
      }
    });

    tbody.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (isNaN(idx)) return;
      if (e.target.classList.contains('bom-composant')) _state.lignesBOM[idx].composant = e.target.value;
      if (e.target.classList.contains('bom-unite'))     _state.lignesBOM[idx].unite      = e.target.value;
      if (e.target.classList.contains('bom-qte')) {
        _state.lignesBOM[idx].quantite = parseFloat(e.target.value) || 0;
        _updateBOMCout(produits);
      }
    });

    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-del-bom');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx);
      if (_state.lignesBOM.length > 1) {
        _state.lignesBOM.splice(idx, 1);
        _refreshBOMLignes(produits);
      } else {
        toastWarning('Au moins un composant est requis.');
      }
    });

    document.getElementById('btn-add-bom-ligne')?.addEventListener('click', () => {
      _state.lignesBOM.push(_newLigneBOM());
      _refreshBOMLignes(produits);
    });
  }

  function _refreshBOMLignes(produits) {
    const tbody = document.getElementById('bom-lignes-body');
    if (tbody) tbody.innerHTML = _renderBOMLignesHTML(produits);
    _bindBOMLigneEvents(produits);
    _updateBOMCout(produits);
  }

  function _updateBOMCout(produits) {
    const total = _state.lignesBOM.reduce((s, l) => {
      const prod = l.composantId ? produits.find(p => p.id === l.composantId) : null;
      return s + (prod ? (prod.cout || 0) * (l.quantite || 0) : 0);
    }, 0);
    const el = document.getElementById('bom-cout-total');
    if (el) el.textContent = fmt(Math.round(total));
  }

  /* Sauvegarde BOM */
  function _saveBOM(bomExist) {
    const produitFini = document.getElementById('bom-produit')?.value?.trim();
    if (!produitFini) { toastError('Le produit fini est obligatoire.'); return; }

    /* Lire les valeurs texte actuelles */
    document.querySelectorAll('.bom-composant').forEach((el, i) => {
      if (_state.lignesBOM[i]) _state.lignesBOM[i].composant = el.value;
    });
    document.querySelectorAll('.bom-unite').forEach((el, i) => {
      if (_state.lignesBOM[i]) _state.lignesBOM[i].unite = el.value;
    });

    const produitFiniId = document.getElementById('bom-produit-id')?.value || null;

    const data = {
      produitFini,
      produitFiniId,
      lignes: deepClone(_state.lignesBOM)
    };

    if (!_state.currentId) {
      Store.create('nomenclatures', data);
      toastSuccess('Nomenclature créée.');
    } else {
      Store.update('nomenclatures', _state.currentId, data);
      toastSuccess('Nomenclature mise à jour.');
    }

    _state.mode = 'list';
    _renderBOMList(
      document.getElementById('toolbar-actions'),
      document.getElementById('view-content')
    );
  }

  /* Suppression BOM */
  function _deleteBOM(bom) {
    showDeleteConfirm(bom.produitFini, () => {
      Store.remove('nomenclatures', bom.id);
      toastSuccess('Nomenclature supprimée.');
      _renderBOMList(
        document.getElementById('toolbar-actions'),
        document.getElementById('view-content')
      );
    });
  }

  /* ================================================================
     VUE : POSTES DE TRAVAIL
     ================================================================ */
  function _renderWorkCenters(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-new-poste">+ Nouveau poste</button>`;

    toolbar.querySelector('#btn-new-poste').addEventListener('click', () => _openPosteForm(null));

    const postes  = Store.getAll('postes');
    const ordres  = _getAllOrdres();

    /* Calculer les OF en cours par poste */
    const ofByPoste = {};
    ordres.forEach(of => {
      if (of.poste && of.statut === 'En cours') {
        ofByPoste[of.poste] = (ofByPoste[of.poste] || 0) + 1;
      }
    });

    area.innerHTML = `
      <div style="padding:24px 0;">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);
          margin-bottom:24px;">Postes de travail</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
          gap:16px;" id="postes-grid">
          ${postes.map(p => _posteCardHTML(p, ofByPoste)).join('')}
          ${postes.length === 0 ? `<div class="table-empty"><p>Aucun poste de travail.</p></div>` : ''}
        </div>
      </div>`;

    /* Bind boutons édition sur les cartes */
    area.querySelectorAll('[data-edit-poste]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editPoste;
        _openPosteForm(Store.getById('postes', id));
      });
    });
    area.querySelectorAll('[data-del-poste]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.delPoste;
        const poste = Store.getById('postes', id);
        if (!poste) return;
        showDeleteConfirm(poste.nom, () => {
          Store.remove('postes', id);
          toastSuccess('Poste supprimé.');
          _renderWorkCenters(
            document.getElementById('toolbar-actions'),
            document.getElementById('view-content')
          );
        });
      });
    });
  }

  /* HTML d'une carte poste */
  function _posteCardHTML(poste, ofByPoste) {
    const ofEnCours  = ofByPoste[poste.nom] || 0;
    const capacite   = poste.capaciteJour || 1;
    const tauxCharge = Math.min(100, Math.round((ofEnCours / Math.max(1, capacite / 10)) * 100));
    const tauxColor  = tauxCharge >= 80 ? 'var(--accent-red)'
      : tauxCharge >= 50 ? 'var(--accent-orange)'
      : 'var(--accent-green)';

    return `
      <div style="background:var(--bg-surface);border:1px solid var(--border);
        border-radius:12px;padding:20px;position:relative;
        transition:box-shadow 0.2s ease;"
        onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.35)'"
        onmouseleave="this.style.boxShadow='none'">

        <!-- Icône + nom -->
        <div style="display:flex;align-items:flex-start;justify-content:space-between;
          margin-bottom:12px;">
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--text-primary);">
              ⚙ ${_escM(poste.nom)}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              👤 ${_escM(poste.responsable || '—')}
            </div>
          </div>
          <!-- Taux de charge -->
          <div style="text-align:right;">
            <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;
              color:${tauxColor};">${tauxCharge}%</div>
            <div style="font-size:11px;color:var(--text-muted);">charge</div>
          </div>
        </div>

        <!-- Barre de charge -->
        <div style="height:6px;background:var(--bg-elevated);border-radius:3px;
          overflow:hidden;margin-bottom:12px;">
          <div style="height:100%;width:${tauxCharge}%;background:${tauxColor};
            border-radius:3px;transition:width 0.4s ease;"></div>
        </div>

        <!-- Stats -->
        <div style="display:flex;justify-content:space-between;
          font-size:12px;color:var(--text-secondary);margin-bottom:8px;">
          <span>📦 Capacité/jour : <strong>${capacite}</strong></span>
          <span>🔄 OF en cours : <strong>${ofEnCours}</strong></span>
        </div>

        ${poste.description ? `
          <div style="font-size:12px;color:var(--text-muted);
            border-top:1px solid var(--border-subtle);padding-top:8px;margin-top:4px;">
            ${_escM(poste.description)}
          </div>` : ''}

        <!-- Actions -->
        <div style="display:flex;gap:6px;margin-top:12px;">
          <button class="btn btn-ghost btn-sm" data-edit-poste="${poste.id}"
            style="flex:1;font-size:12px;">✏️ Modifier</button>
          <button class="btn btn-ghost danger btn-sm" data-del-poste="${poste.id}"
            style="font-size:12px;">🗑</button>
        </div>
      </div>`;
  }

  /* Formulaire poste (modal) */
  function _openPosteForm(poste) {
    const isNew = !poste;
    showFormModal(
      isNew ? 'Nouveau poste de travail' : `Modifier — ${poste.nom}`,
      [
        { name: 'nom',          label: 'Nom du poste *',     type: 'text',   required: true, cols: 2 },
        { name: 'responsable',  label: 'Responsable',        type: 'text',   cols: 1 },
        { name: 'capaciteJour', label: 'Capacité / jour',    type: 'number', cols: 1 },
        { name: 'description',  label: 'Description',        type: 'textarea', cols: 2 }
      ],
      poste || {},
      (data) => {
        data.capaciteJour = parseInt(data.capaciteJour) || 0;
        if (isNew) {
          Store.create('postes', data);
          toastSuccess('Poste créé.');
        } else {
          Store.update('postes', poste.id, data);
          toastSuccess('Poste mis à jour.');
        }
        _renderWorkCenters(
          document.getElementById('toolbar-actions'),
          document.getElementById('view-content')
        );
      }
    );
  }

  /* ================================================================
     UTILITAIRES PRIVÉS
     ================================================================ */

  /* Récupère tous les OFs depuis ordresFab (seed) + créations Store */
  function _getAllOrdres() {
    return Store.getAll('ordresFab');
  }

  /* Nouvelle ligne BOM vide */
  function _newLigneBOM() {
    return { composant: '', composantId: null, quantite: 1, unite: 'u' };
  }

  /* Génère référence OF-YYYY-NNNNN */
  function _genRefOF() {
    const annee = new Date().getFullYear();
    const num   = Store.nextCounter('of');
    return `OF-${annee}-${String(num).padStart(5, '0')}`;
  }

  /* Couleur statut */
  function _statutColor(statut) {
    const map = {
      'Brouillon':  'var(--text-muted)',
      'Prêt':       'var(--accent-blue)',
      'En cours':   'var(--accent-orange)',
      'En attente': 'var(--accent-violet)',
      'Terminé':    'var(--accent-green)',
      'Annulé':     'var(--accent-red)'
    };
    return map[statut] || 'var(--text-secondary)';
  }

  /* Styles th/td réutilisables */
  function _th() {
    return 'padding:8px 12px;font-size:12px;font-weight:600;color:var(--text-secondary);' +
      'text-transform:uppercase;letter-spacing:.06em;';
  }
  function _td() {
    return 'padding:8px 12px;font-size:14px;color:var(--text-primary);';
  }

  /* Échappement HTML */
  function _escM(str) {
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

window.Manufacturing = Manufacturing;
