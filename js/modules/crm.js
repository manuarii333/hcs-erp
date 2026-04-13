/* ================================================================
   HCS ERP — js/modules/crm.js
   Module CRM : Pipeline, Contacts (unifiés tous types), fiche client enrichie.
   Exporté via window.CRM — initialisé par app.js via CRM.init()
   ================================================================ */

'use strict';

const CRM = (() => {

  /* ----------------------------------------------------------------
     CONSTANTES
     ---------------------------------------------------------------- */

  const STAGES = [
    { id: 'Nouveau',      label: 'Nouveau',      color: 'gray'   },
    { id: 'Qualifié',     label: 'Qualifié',     color: 'blue'   },
    { id: 'Proposition',  label: 'Proposition',  color: 'orange' },
    { id: 'Négociation',  label: 'Négociation',  color: 'violet' },
    { id: 'Gagné',        label: 'Gagné',        color: 'green'  },
    { id: 'Perdu',        label: 'Perdu',        color: 'red'    }
  ];

  /* Types de contacts unifiés (Particuliers + Organisations) */
  const CONTACT_TYPES = [
    'Particulier', 'Entreprise', 'Comité d\'Entreprise',
    'Association', 'Club sportif', 'Touriste', 'Autre'
  ];

  /* Îles de Polynésie française */
  const ILES_PF = [
    'Tahiti', 'Moorea', 'Bora Bora', 'Huahine', 'Raiatea',
    'Tahaa', 'Maupiti', 'Rangiroa', 'Fakarava', 'Tikehau',
    'Nuku Hiva', 'Hiva Oa', 'Papeete', 'Autre'
  ];

  /* Techniques d'impression */
  const TECHNIQUES = ['DTF', 'Vinyle', 'Flocage', 'Broderie', 'Sublimation', 'Sérigraphie', 'Autre'];

  /* ----------------------------------------------------------------
     SYSTÈME DE FIDÉLITÉ — badges + médailles (calculés à la volée)
     ---------------------------------------------------------------- */

  /**
   * Pastille fidélité basée sur le nombre de factures.
   * Vert 1-10 / Bleu 11-30 / Bronze 31-50 / Doré 51+
   */
  function _badge(nbAchats) {
    if (nbAchats >= 51) return { label: 'Doré',   icon: '⭐', bg: '#FFD700', color: '#000' };
    if (nbAchats >= 31) return { label: 'Bronze',  icon: '🥉', bg: '#CD7F32', color: '#fff' };
    if (nbAchats >= 11) return { label: 'Bleu',    icon: '💎', bg: '#4a5fff', color: '#fff' };
    if (nbAchats >= 1)  return { label: 'Vert',    icon: '🌱', bg: '#00d4aa', color: '#000' };
    return null;
  }

  /**
   * Médaille basée sur le total TTC cumulé.
   * Argent 20k / Bronze 60k / Or 100k+
   */
  function _medaille(totalTTC) {
    if (totalTTC >= 100000) return { label: 'Or',     icon: '🥇', bg: '#FFD700', color: '#000' };
    if (totalTTC >= 60000)  return { label: 'Bronze',  icon: '🥉', bg: '#CD7F32', color: '#fff' };
    if (totalTTC >= 20000)  return { label: 'Argent',  icon: '🥈', bg: '#C0C0C0', color: '#000' };
    return null;
  }

  /** Rendu HTML d'une pastille */
  function _badgeHtml(b, small) {
    if (!b) return '';
    const sz = small ? 'font-size:0.7em;padding:2px 7px;' : 'font-size:0.75em;padding:3px 9px;';
    return `<span style="background:${b.bg};color:${b.color};border-radius:20px;font-weight:700;${sz}white-space:nowrap;">
      ${b.icon} ${b.label}
    </span>`;
  }

  /* ----------------------------------------------------------------
     CALCUL STATS CLIENT (à la volée depuis le store)
     ---------------------------------------------------------------- */

  function _clientStats(contactId) {
    const db        = Store.getDB();
    const factures  = (db.factures  || []).filter(f => f.contactId === contactId);
    const devis     = (db.devis     || []).filter(d => d.contactId === contactId);
    const commandes = (db.commandes || []).filter(c => c.contactId === contactId);

    const nbAchats  = factures.length;
    const totalTTC  = factures.reduce((s, f) => s + (f.totalTTC || 0), 0);

    /* Remise moyenne sur les lignes avec remise */
    let sumRemise = 0, nbRemise = 0;
    const remiseTags = new Set();
    factures.forEach(f => {
      (f.lignes || []).forEach(l => {
        if ((l.remise || 0) > 0) {
          sumRemise += l.remise;
          nbRemise++;
          remiseTags.add(l.remise + '%');
        }
      });
    });
    const remiseMoyenne = nbRemise > 0 ? Math.round(sumRemise / nbRemise * 10) / 10 : 0;

    /* Dernière commande */
    const dates = [...factures, ...commandes]
      .map(x => x.date || x._createdAt).filter(Boolean).sort().reverse();
    const derniereCmd = dates[0] || null;

    /* Inférence types de produits depuis les lignes */
    const typesProduits = new Set();
    const techniquesTrouvees = new Set();
    factures.forEach(f => {
      (f.lignes || []).forEach(l => {
        const d = (l.description || '').toLowerCase();
        if (d.includes('polo') || d.includes('t-shirt') || d.includes('tee')) typesProduits.add('T-shirt / Polo');
        if (d.includes('casquette') || d.includes('bonnet'))                   typesProduits.add('Casquette');
        if (d.includes('mug'))                                                  typesProduits.add('Mug');
        if (d.includes('coussin'))                                              typesProduits.add('Coussin');
        if (d.includes('sac') || d.includes('tote'))                           typesProduits.add('Sac');
        if (d.includes('sticker') || d.includes('autocollant'))                typesProduits.add('Sticker');
        if (d.includes('plaque') || d.includes('alu'))                         typesProduits.add('Plaque alu');
        if (d.includes('dtf') || d.includes('transfert'))                      techniquesTrouvees.add('DTF');
        if (d.includes('vinyl') || d.includes('vinyle'))                       techniquesTrouvees.add('Vinyle');
        if (d.includes('flocage'))                                              techniquesTrouvees.add('Flocage');
        if (d.includes('broderi') || d.includes('brodé'))                      techniquesTrouvees.add('Broderie');
        if (d.includes('sublim'))                                               techniquesTrouvees.add('Sublimation');
        if (d.includes('sérigraph') || d.includes('serigraph'))                techniquesTrouvees.add('Sérigraphie');
      });
    });

    return {
      nbAchats,
      totalTTC,
      remiseMoyenne,
      derniereCmd,
      nbDevis:     devis.length,
      nbCommandes: commandes.length,
      typesProduits:    [...typesProduits],
      techniquesTrouvees: [...techniquesTrouvees],
      remiseTags:  [...remiseTags],
      badge:    _badge(nbAchats),
      medaille: _medaille(totalTTC),
      factures,
      devis,
      commandes
    };
  }

  /* ----------------------------------------------------------------
     UTILITAIRES INTERNES
     ---------------------------------------------------------------- */

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _fmt(n) {
    return typeof window.fmt === 'function' ? window.fmt(n || 0) : (n || 0).toLocaleString('fr-FR');
  }

  function _fmtD(d) {
    return typeof fmtDate === 'function' ? fmtDate(d) : (d ? d.slice(0, 10) : '—');
  }

  function _initiales(nom) {
    if (!nom) return '?';
    return nom.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  function _avatarColor(nom) {
    const colors = ['#4a5fff', '#00d4aa', '#ffc857', '#b07bff', '#ff6b6b'];
    let h = 0;
    for (let i = 0; i < (nom || '').length; i++) h = nom.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  }

  function _contactOptions() {
    return Store.getAll('contacts').map(c => ({ value: c.id, label: c.nom }));
  }

  function _contactNom(contactId) {
    const c = Store.getById('contacts', contactId);
    return c ? c.nom : contactId || '—';
  }

  /* ----------------------------------------------------------------
     VUE PIPELINE — Kanban + top clients de la semaine
     ---------------------------------------------------------------- */

  function _renderPipeline(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary btn-sm" id="crm-btn-new-opp">+ Opportunité</button>`;

    document.getElementById('crm-btn-new-opp')
      ?.addEventListener('click', () => _openOppForm(null));

    /* Top clients de la semaine (factures des 7 derniers jours) */
    const now      = new Date();
    const semDebut = new Date(now); semDebut.setDate(now.getDate() - 7); semDebut.setHours(0,0,0,0);
    const factures = Store.getAll('factures');
    const ventes7j = factures.filter(f => new Date(f.date) >= semDebut);

    /* Agrégation par contactId */
    const parClient = {};
    ventes7j.forEach(f => {
      const cid = f.contactId || '__anon__';
      if (!parClient[cid]) parClient[cid] = { nom: f.client || 'Anonyme', total: 0, nb: 0 };
      parClient[cid].total += (f.totalTTC || 0);
      parClient[cid].nb++;
    });
    const top5 = Object.entries(parClient)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);

    const topHtml = top5.length === 0
      ? '<p style="color:var(--text-muted);font-size:0.82em;text-align:center;padding:12px 0;">Aucune vente cette semaine.</p>'
      : top5.map(([cid, d], i) => {
          const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
          return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:1.1em;">${medals[i]}</span>
              <div>
                <div style="font-size:0.85em;font-weight:600;">${_esc(d.nom)}</div>
                <div style="font-size:0.72em;color:var(--text-muted);">${d.nb} facture${d.nb > 1 ? 's' : ''}</div>
              </div>
            </div>
            <span style="font-family:monospace;font-weight:700;color:var(--accent-green);font-size:0.88em;">${_fmt(d.total)} XPF</span>
          </div>`;
        }).join('');

    area.innerHTML = `
      <div class="page-header">
        <div class="page-title">Pipeline CRM</div>
        <div class="page-subtitle">${Store.getAll('opportunites').length} opportunité(s)</div>
      </div>

      <!-- Top clients de la semaine -->
      <div class="card" style="margin-bottom:18px;">
        <div class="card-header">
          <div class="card-title">🏆 Top clients — 7 derniers jours</div>
        </div>
        <div style="padding:4px 16px 12px;">${topHtml}</div>
      </div>

      <div id="crm-pipeline-board"></div>`;

    renderKanban('crm-pipeline-board', {
      stages:    STAGES,
      cards:     Store.getAll('opportunites'),
      groupBy:   'stade',
      amountKey: 'montant',
      addLabel:  '+ Opportunité',
      cardTemplate: (opp) => {
        const cn    = _contactNom(opp.contactId);
        const color = _avatarColor(cn);
        const pct   = opp.probabilite || 0;
        const pctC  = pct >= 70 ? 'var(--accent-green)' : pct >= 40 ? 'var(--accent-orange)' : 'var(--accent-red)';
        return `
          <div class="kanban-card-title">${_esc(opp.nom)}</div>
          <div class="kanban-card-sub" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <div class="avatar" style="width:20px;height:20px;font-size:9px;background:${color};">${_initiales(cn)}</div>
            <span>${_esc(cn)}</span>
          </div>
          <div class="kanban-card-amount">${_fmt(opp.montant || 0)}</div>
          <div style="margin-top:8px;">
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:3px;">
              <span>Probabilité</span>
              <span style="color:${pctC};font-weight:600;">${pct}%</span>
            </div>
            <div class="kanban-progress">
              <div class="kanban-progress-bar" style="width:${pct}%;background:${pctC};"></div>
            </div>
          </div>
          ${opp.echeance ? `<div class="kanban-card-meta"><span>📅 ${_fmtD(opp.echeance)}</span></div>` : ''}`;
      },
      onCardClick:   (opp) => _openOppForm(opp),
      onStageChange: (id, s) => { Store.update('opportunites', id, { stade: s }); toast(`Déplacé vers "${s}"`, 'info', 2000); },
      onAdd:         (s) => _openOppForm(null, s)
    });
  }

  /* ---- Formulaire opportunité ---- */
  function _openOppForm(opp, defaultStage = 'Nouveau') {
    const isNew = !opp;
    const OPP_FIELDS = [
      { key: 'nom',         label: 'Nom de l\'opportunité', type: 'text',   required: true, colSpan: 2, placeholder: 'Ex: Uniformes Mairie 2026' },
      { key: 'contactId',   label: 'Contact',               type: 'select', required: true, options: _contactOptions() },
      { key: 'stade',       label: 'Stade',                 type: 'select', required: true, options: STAGES.map(s => ({ value: s.id, label: s.label })) },
      { key: 'montant',     label: 'Montant estimé',        type: 'money',  required: true },
      { key: 'probabilite', label: 'Probabilité (%)',        type: 'number', min: 0, max: 100 },
      { key: 'echeance',    label: 'Date de clôture',        type: 'date' },
      { key: 'notes',       label: 'Notes',                  type: 'textarea', colSpan: 2 }
    ];

    showFormModal(isNew ? 'Nouvelle opportunité' : 'Modifier l\'opportunité',
      OPP_FIELDS,
      opp ? { ...opp } : { stade: defaultStage, probabilite: 20, montant: 0 },
      (formData) => {
        formData.montant     = Number(formData.montant)     || 0;
        formData.probabilite = Number(formData.probabilite) || 0;
        isNew ? Store.create('opportunites', formData) : Store.update('opportunites', opp.id, formData);
        toast(isNew ? 'Opportunité créée.' : 'Opportunité mise à jour.', 'success');
        _renderPipeline(document.getElementById('toolbar-actions'), document.getElementById('view-content'));
      }, 'lg');

    if (!isNew) {
      setTimeout(() => {
        const footer = document.querySelector('.modal-footer');
        if (!footer) return;
        const del = document.createElement('button');
        del.className = 'btn btn-danger'; del.style.marginRight = 'auto'; del.textContent = '🗑 Supprimer';
        del.addEventListener('click', () => {
          closeModal();
          showConfirm(`Supprimer "${opp.nom}" ?`, () => {
            Store.remove('opportunites', opp.id);
            toast('Opportunité supprimée.', 'success');
            _renderPipeline(document.getElementById('toolbar-actions'), document.getElementById('view-content'));
          }, null, 'Supprimer', true);
        });
        footer.prepend(del);
      }, 50);
    }
  }

  /* ----------------------------------------------------------------
     VUE CONTACTS — tous types réunis avec filtres par type
     ---------------------------------------------------------------- */

  let _activeTypeFilter = 'Tous';
  let _crmSearch        = '';

  function _renderContacts(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary btn-sm" id="crm-btn-new-contact">+ Nouveau contact</button>`;

    document.getElementById('crm-btn-new-contact')
      ?.addEventListener('click', () => _openContactModal(null, toolbar, area));

    _drawContactsList(toolbar, area);
  }

  function _drawContactsList(toolbar, area) {
    const tous = Store.getAll('contacts');
    const q    = (_crmSearch || '').toLowerCase();

    /* Filtrage texte + type */
    const filtered = tous.filter(c => {
      const matchQ    = !q
        || (c.nom       || '').toLowerCase().includes(q)
        || (c.email     || '').toLowerCase().includes(q)
        || (c.telephone || '').toLowerCase().includes(q)
        || (c.mobile    || '').toLowerCase().includes(q);
      const matchType = _activeTypeFilter === 'Tous' || c.type === _activeTypeFilter;
      return matchQ && matchType;
    });

    /* Enrichir avec stats */
    const enriched = filtered.map(c => ({ ...c, _stats: _clientStats(c.id) }));

    const types = ['Tous', ...CONTACT_TYPES];
    const hasActiveFilter = _activeTypeFilter !== 'Tous' || q;

    area.innerHTML = `
      <div class="page-header">
        <div class="page-title">Contacts
          <span style="font-size:0.65em;color:var(--text-muted);font-weight:400;margin-left:6px;">
            ${filtered.length} / ${tous.length}
          </span>
        </div>
      </div>

      <!-- Barre de filtres compacte -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:18px;flex-wrap:wrap;">
        <div style="position:relative;flex:1;min-width:180px;max-width:280px;">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-muted);font-size:13px;pointer-events:none;">🔍</span>
          <input type="text" id="crm-search"
            placeholder="Nom, email, téléphone…"
            class="form-control"
            style="height:34px;padding-left:32px;font-size:13px;border-radius:8px;border:1px solid var(--border);"
            value="${_esc(_crmSearch)}" />
        </div>

        <select id="crm-type-select" class="form-control"
          style="height:34px;width:170px;font-size:13px;border-radius:8px;border:1px solid var(--border);
                 color:${_activeTypeFilter !== 'Tous' ? 'var(--accent-blue)' : 'inherit'};
                 font-weight:${_activeTypeFilter !== 'Tous' ? '600' : '400'};">
          ${types.map(t => `<option value="${_esc(t)}"${t === _activeTypeFilter ? ' selected' : ''}>${_esc(t)}</option>`).join('')}
        </select>

        ${hasActiveFilter
          ? `<button id="crm-clear" title="Effacer les filtres"
              style="height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--border);
                     background:transparent;color:var(--text-muted);font-size:12px;cursor:pointer;
                     display:flex;align-items:center;gap:4px;white-space:nowrap;transition:all .15s;"
              onmouseover="this.style.borderColor='var(--accent-red)';this.style.color='var(--accent-red)';"
              onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)';">
              ✕ Effacer
            </button>`
          : ''}
      </div>

      ${enriched.length === 0
        ? `<div class="table-empty"><div class="empty-icon">👥</div>
            <p>Aucun contact pour ces filtres.</p>
            ${hasActiveFilter ? `<button id="crm-clear-empty" class="btn btn-ghost btn-sm" style="margin-top:8px;">Effacer les filtres</button>` : ''}
           </div>`
        : `<div class="card" style="overflow:auto;">
            <table class="table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Île</th>
                  <th>Téléphone</th>
                  <th>Email</th>
                  <th>Fidélité</th>
                  <th>Médaille</th>
                  <th>CA Total</th>
                  <th>Factures</th>
                </tr>
              </thead>
              <tbody>
                ${enriched.map(c => `
                <tr style="cursor:pointer;" data-cid="${_esc(c.id)}">
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <div class="avatar" style="background:${_avatarColor(c.nom)};flex-shrink:0;">${_initiales(c.nom)}</div>
                      <div>
                        <strong>${_esc(c.nom)}</strong>
                        ${c.vip ? '<span style="color:#FFD700;font-size:0.75em;margin-left:4px;">⭐ VIP</span>' : ''}
                      </div>
                    </div>
                  </td>
                  <td style="font-size:0.82em;">${_esc(c.type || '—')}</td>
                  <td style="font-size:0.82em;">${_esc(c.ile  || '—')}</td>
                  <td style="font-size:0.82em;">${_esc(c.mobile || c.telephone || '—')}</td>
                  <td style="font-size:0.82em;">${_esc(c.email || '—')}</td>
                  <td>${_badgeHtml(c._stats.badge, true)}</td>
                  <td>${c._stats.medaille ? `<span style="font-size:1.2em;" title="${c._stats.medaille.label}">${c._stats.medaille.icon}</span>` : '—'}</td>
                  <td style="font-family:monospace;font-size:0.82em;color:var(--accent-green);">${c._stats.totalTTC > 0 ? _fmt(c._stats.totalTTC) + ' XPF' : '—'}</td>
                  <td style="text-align:center;">${c._stats.nbAchats || '—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
           </div>`
      }`;

    const _clearAll = () => {
      _activeTypeFilter = 'Tous';
      _crmSearch        = '';
      _drawContactsList(toolbar, area);
    };

    /* Recherche en temps réel */
    document.getElementById('crm-search')?.addEventListener('input', (e) => {
      _crmSearch = e.target.value;
      _drawContactsList(toolbar, area);
    });

    /* Select Type */
    document.getElementById('crm-type-select')?.addEventListener('change', (e) => {
      _activeTypeFilter = e.target.value;
      _drawContactsList(toolbar, area);
    });

    /* Bouton Effacer */
    document.getElementById('crm-clear')?.addEventListener('click', _clearAll);
    document.getElementById('crm-clear-empty')?.addEventListener('click', _clearAll);

    /* Clic ligne → fiche */
    area.querySelectorAll('[data-cid]').forEach(row => {
      row.addEventListener('click', () => _renderContactFiche(row.dataset.cid, toolbar, area));
    });
  }

  /* ----------------------------------------------------------------
     FICHE CONTACT ENRICHIE
     ---------------------------------------------------------------- */

  function _renderContactFiche(contactId, toolbar, area) {
    const c = Store.getById('contacts', contactId);
    if (!c) { toast('Contact introuvable.', 'error'); return; }

    const s = _clientStats(contactId);

    toolbar.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="btn-back-contacts">← Contacts</button>
      <button class="btn btn-secondary btn-sm" id="btn-edit-contact">✏ Modifier</button>`;

    document.getElementById('btn-back-contacts')?.addEventListener('click', () => {
      _renderContacts(toolbar, area);
    });
    document.getElementById('btn-edit-contact')?.addEventListener('click', () => {
      _openContactModal(contactId, toolbar, area);
    });

    const remiseTags = s.remiseTags.map(r =>
      `<span style="background:rgba(255,200,87,.15);color:var(--accent-orange);border-radius:12px;padding:2px 8px;font-size:0.72em;font-weight:600;">🏷 Remise ${r}</span>`
    ).join(' ');

    area.innerHTML = `
      <!-- En-tête -->
      <div style="display:flex;align-items:flex-start;gap:18px;margin-bottom:20px;flex-wrap:wrap;">
        <div class="avatar" style="width:64px;height:64px;font-size:1.4em;background:${_avatarColor(c.nom)};border-radius:50%;flex-shrink:0;">
          ${_initiales(c.nom)}
        </div>
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
            <h2 style="font-size:1.3em;font-weight:700;">${_esc(c.nom)}</h2>
            ${c.vip ? '<span style="background:#FFD700;color:#000;border-radius:12px;padding:2px 10px;font-size:0.75em;font-weight:700;">⭐ VIP</span>' : ''}
            ${_badgeHtml(s.badge, false)}
            ${s.medaille ? `<span title="Médaille ${s.medaille.label}" style="background:${s.medaille.bg};color:${s.medaille.color};border-radius:12px;padding:3px 10px;font-size:0.75em;font-weight:700;">${s.medaille.icon} ${s.medaille.label}</span>` : ''}
          </div>
          <div style="color:var(--text-muted);font-size:0.85em;margin-bottom:8px;">
            ${_esc(c.type || 'Contact')}${c.ile ? ' · ' + _esc(c.ile) : ''}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">${remiseTags}</div>
        </div>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:18px;">
        ${_kpi('🧾', s.nbAchats, 'Factures', 'var(--accent-blue)')}
        ${_kpi('💰', _fmt(s.totalTTC) + ' XPF', 'CA Total TTC', 'var(--accent-green)', true)}
        ${_kpi('📄', s.nbDevis, 'Devis', 'var(--accent-violet)')}
        ${_kpi('🏷️', s.remiseMoyenne > 0 ? s.remiseMoyenne + '%' : '—', 'Remise moy.', 'var(--accent-orange)', true)}
        ${_kpi('📅', s.derniereCmd ? _fmtD(s.derniereCmd) : '—', 'Dernière commande', 'var(--text)', true)}
      </div>

      <!-- 2 colonnes : infos + informations business -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">

        <!-- Coordonnées -->
        <div class="card">
          <div class="card-header"><div class="card-title">📋 Coordonnées</div></div>
          <div style="padding:14px 16px;">
            <table style="width:100%;border-collapse:collapse;">
              ${_infoRow('Type',            c.type)}
              ${_infoRow('Téléphone',       c.telephone)}
              ${_infoRow('Mobile',          c.mobile)}
              ${_infoRow('Email',           c.email)}
              ${_infoRow('Île',             c.ile)}
              ${_infoRow('Adresse',         c.adresse)}
              ${_infoRow('Interlocuteur',   c.interlocuteur)}
              ${_infoRow('N° Tahiti',       c.numeroTahiti)}
              ${c.dateNaissance ? _infoRow('Date de naissance', _fmtD(c.dateNaissance)) : ''}
              ${_infoRow('Créé le', c._createdAt ? _fmtD(c._createdAt) : '—')}
            </table>
          </div>
        </div>

        <!-- Informations business (auto) -->
        <div class="card">
          <div class="card-header"><div class="card-title">📊 Informations business</div></div>
          <div style="padding:14px 16px;">
            <table style="width:100%;border-collapse:collapse;">
              ${_infoRow('Total dépensé TTC', s.totalTTC > 0 ? _fmt(s.totalTTC) + ' XPF' : '—')}
              ${_infoRow('Nb commandes',   String(s.nbCommandes))}
              ${_infoRow('Nb devis',       String(s.nbDevis))}
              ${_infoRow('Nb factures',    String(s.nbAchats))}
              ${_infoRow('Remise habituelle', s.remiseMoyenne > 0 ? s.remiseMoyenne + '%' : '—')}
              ${_infoRow('Dernière commande', s.derniereCmd ? _fmtD(s.derniereCmd) : '—')}
              ${_infoRow('Client VIP', c.vip ? 'Oui ⭐' : 'Non')}
              ${_infoRow('Pastille fidélité', s.badge ? s.badge.icon + ' ' + s.badge.label : '—')}
              ${_infoRow('Médaille dépenses', s.medaille ? s.medaille.icon + ' ' + s.medaille.label : '—')}
            </table>
          </div>
        </div>
      </div>

      <!-- Préférences client -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><div class="card-title">🎨 Préférences client</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;padding:0 4px;">

          <!-- Auto-inférées depuis les commandes -->
          <div style="padding:14px;">
            <div style="font-size:0.78em;color:var(--text-muted);font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">Détectées automatiquement</div>
            ${_infoRow('Types produits', s.typesProduits.length ? s.typesProduits.join(', ') : '—')}
            ${_infoRow('Techniques impression', s.techniquesTrouvees.length ? s.techniquesTrouvees.join(', ') : '—')}
            ${_infoRow('Remises accordées', s.remiseTags.length ? s.remiseTags.join(', ') : '—')}
          </div>

          <!-- Saisies manuellement -->
          <div style="padding:14px;border-left:1px solid var(--border);">
            <div style="font-size:0.78em;color:var(--text-muted);font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">Tailles habituelles</div>
            <div id="pref-tailles" style="font-size:0.85em;">${_prefTags(c.prefTailles)}</div>
            <div style="font-size:0.78em;color:var(--text-muted);font-weight:600;margin:12px 0 8px;text-transform:uppercase;letter-spacing:.5px;">Couleurs préférées</div>
            <div id="pref-couleurs" style="font-size:0.85em;">${_prefTags(c.prefCouleurs)}</div>
          </div>

          <!-- Notes / logos / fichiers -->
          <div style="padding:14px;border-left:1px solid var(--border);">
            <div style="font-size:0.78em;color:var(--text-muted);font-weight:600;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px;">Fichiers / Logos / Designs</div>
            <div style="font-size:0.82em;color:var(--text-muted);">${_esc(c.prefFichiers || 'Aucune info renseignée')}</div>
            <div style="font-size:0.78em;color:var(--text-muted);font-weight:600;margin:12px 0 8px;text-transform:uppercase;letter-spacing:.5px;">Notes préférences</div>
            <div style="font-size:0.82em;color:var(--text-muted);">${_esc(c.prefNotes || '—')}</div>
          </div>
        </div>
      </div>

      <!-- Historique : devis, commandes, factures -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">📁 Historique des activités</div>
        </div>
        ${_renderHistorique(s)}
      </div>`;
  }

  function _kpi(icon, value, label, color, small) {
    return `
      <div class="card" style="padding:14px;text-align:center;">
        <div style="font-size:1.4em;">${icon}</div>
        <div style="font-size:${small ? '0.9' : '1.3'}em;font-weight:700;color:${color};font-family:monospace;margin:4px 0;">${value}</div>
        <div style="font-size:0.72em;color:var(--text-muted);">${label}</div>
      </div>`;
  }

  function _infoRow(label, value) {
    if (!value || value === 'undefined') return '';
    return `
      <tr>
        <td style="color:var(--text-muted);font-size:0.8em;padding:4px 10px 4px 0;width:45%;vertical-align:top;">${_esc(label)}</td>
        <td style="font-size:0.85em;padding:4px 0;">${_esc(value)}</td>
      </tr>`;
  }

  function _prefTags(val) {
    if (!val) return '<span style="color:var(--text-muted);">—</span>';
    return val.split(',').map(v => v.trim()).filter(Boolean).map(v =>
      `<span style="display:inline-block;background:var(--border);border-radius:12px;padding:2px 8px;margin:2px;font-size:0.82em;">${_esc(v)}</span>`
    ).join('');
  }

  function _renderHistorique(s) {
    const rows = [];

    s.devis.forEach(d => rows.push({
      type: 'Devis', ref: d.ref, date: d.date, montant: d.totalTTC || 0, statut: d.statut
    }));
    s.commandes.forEach(c => rows.push({
      type: 'Commande', ref: c.ref, date: c.date, montant: c.totalTTC || 0, statut: c.statut
    }));
    s.factures.forEach(f => rows.push({
      type: 'Facture', ref: f.ref, date: f.date, montant: f.totalTTC || 0, statut: f.statut
    }));

    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (rows.length === 0) {
      return '<div class="table-empty" style="padding:24px;"><p>Aucune activité enregistrée pour ce contact.</p></div>';
    }

    const typeBadge = { 'Devis': 'badge-blue', 'Commande': 'badge-orange', 'Facture': 'badge-green' };

    return `
      <div style="overflow:auto;">
        <table class="table">
          <thead>
            <tr><th>Type</th><th>Référence</th><th>Date</th><th>Montant TTC</th><th>Statut</th></tr>
          </thead>
          <tbody>
            ${rows.map(r => `
            <tr>
              <td><span class="badge ${typeBadge[r.type] || 'badge-gray'}">${r.type}</span></td>
              <td><span class="col-ref">${_esc(r.ref || '—')}</span></td>
              <td>${_fmtD(r.date)}</td>
              <td class="mono">${r.montant > 0 ? _fmt(r.montant) + ' XPF' : '—'}</td>
              <td>${_esc(r.statut || '—')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  /* ----------------------------------------------------------------
     FORMULAIRE CONTACT (création / modification)
     ---------------------------------------------------------------- */

  function _openContactModal(contactId, toolbar, area) {
    const c    = contactId ? Store.getById('contacts', contactId) : null;
    const isNew = !c;

    const typeOpts  = CONTACT_TYPES.map(t => `<option value="${_esc(t)}" ${c?.type === t ? 'selected' : ''}>${_esc(t)}</option>`).join('');
    const ileOpts   = ILES_PF.map(i => `<option value="${_esc(i)}" ${c?.ile === i ? 'selected' : ''}>${_esc(i)}</option>`).join('');
    const techOpts  = TECHNIQUES.map(t => {
      const checked = (c?.prefTechniques || []).includes(t);
      return `<label style="display:flex;align-items:center;gap:5px;font-size:0.82em;cursor:pointer;">
        <input type="checkbox" value="${_esc(t)}" ${checked ? 'checked' : ''} class="tech-check" /> ${_esc(t)}
      </label>`;
    }).join('');

    showModal(isNew ? 'Nouveau contact' : 'Modifier : ' + c.nom, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">

        <!-- Identité -->
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label required">Nom / Raison sociale</label>
          <input type="text" class="form-control" id="ct-nom" value="${_esc(c?.nom || '')}" placeholder="Nom complet ou raison sociale" />
        </div>
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-control" id="ct-type">
            <option value="">— Choisir —</option>${typeOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Île</label>
          <select class="form-control" id="ct-ile">
            <option value="">— Choisir —</option>${ileOpts}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Téléphone fixe</label>
          <input type="tel" class="form-control" id="ct-tel" value="${_esc(c?.telephone || '')}" placeholder="40 xx xx xx" />
        </div>
        <div class="form-group">
          <label class="form-label">Mobile</label>
          <input type="tel" class="form-control" id="ct-mobile" value="${_esc(c?.mobile || '')}" placeholder="87 xx xx xx" />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-control" id="ct-email" value="${_esc(c?.email || '')}" placeholder="exemple@mail.pf" />
        </div>
        <div class="form-group">
          <label class="form-label">Date de naissance</label>
          <input type="date" class="form-control" id="ct-datenaissance" value="${c?.dateNaissance || ''}" />
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Adresse</label>
          <input type="text" class="form-control" id="ct-adresse" value="${_esc(c?.adresse || '')}" placeholder="Quartier, PK, BP…" />
        </div>
        <div class="form-group">
          <label class="form-label">Interlocuteur principal</label>
          <input type="text" class="form-control" id="ct-interlocuteur" value="${_esc(c?.interlocuteur || '')}" placeholder="Mme. Dupont — Directrice achats" />
        </div>
        <div class="form-group">
          <label class="form-label">N° Tahiti / Registre commerce</label>
          <input type="text" class="form-control" id="ct-numerotahiti" value="${_esc(c?.numeroTahiti || c?.siret || '')}" placeholder="N° d'identification" />
        </div>

        <!-- Remise client spéciale -->
        <div class="form-group">
          <label class="form-label">🏷 Remise client (%)</label>
          <input type="number" class="form-control" id="ct-remise"
            value="${c?.remiseClient || 0}" min="0" max="100" step="0.5"
            placeholder="0" />
          <div style="font-size:11px;color:var(--text-muted);margin-top:3px;">
            Appliquée automatiquement sur toutes les lignes lors de la création d'un devis / commande.
          </div>
        </div>

        <!-- Client VIP -->
        <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-top:8px;">
          <input type="checkbox" id="ct-vip" ${c?.vip ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;" />
          <label for="ct-vip" style="cursor:pointer;font-size:0.88em;">⭐ Client VIP</label>
        </div>

        <!-- Séparateur préférences -->
        <div style="grid-column:1/-1;border-top:1px solid var(--border);padding-top:12px;margin-top:4px;">
          <div style="font-size:0.78em;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">Préférences client</div>
        </div>

        <div class="form-group">
          <label class="form-label">Tailles habituelles</label>
          <input type="text" class="form-control" id="ct-tailles" value="${_esc(c?.prefTailles || '')}" placeholder="XS, S, M, L, XL… (séparés par virgule)" />
        </div>
        <div class="form-group">
          <label class="form-label">Couleurs préférées</label>
          <input type="text" class="form-control" id="ct-couleurs" value="${_esc(c?.prefCouleurs || '')}" placeholder="Blanc, Noir, Bleu… (séparés par virgule)" />
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Techniques d'impression</label>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:4px;">${techOpts}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Fichiers / Logos / Designs</label>
          <input type="text" class="form-control" id="ct-fichiers" value="${_esc(c?.prefFichiers || '')}" placeholder="Dropbox lien, Google Drive, noms fichiers…" />
        </div>
        <div class="form-group">
          <label class="form-label">Notes préférences</label>
          <input type="text" class="form-control" id="ct-notes" value="${_esc(c?.prefNotes || '')}" placeholder="Toujours fond blanc, pas de fantaisie…" />
        </div>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px;">
        <button class="btn btn-ghost" id="ct-cancel">Annuler</button>
        <button class="btn btn-primary" id="ct-save">${isNew ? '+ Créer le contact' : '✔ Sauvegarder'}</button>
      </div>
    `);

    document.getElementById('ct-cancel')?.addEventListener('click', () => closeModal());
    document.getElementById('ct-save')?.addEventListener('click', () => _saveContact(contactId, toolbar, area));
  }

  function _saveContact(contactId, toolbar, area) {
    const nom = (document.getElementById('ct-nom')?.value || '').trim();
    if (!nom) { toast('Le nom est obligatoire.', 'error'); return; }

    /* Techniques cochées */
    const techs = [...document.querySelectorAll('.tech-check')]
      .filter(cb => cb.checked).map(cb => cb.value);

    const record = {
      nom,
      type:           document.getElementById('ct-type')?.value          || '',
      ile:            document.getElementById('ct-ile')?.value           || '',
      telephone:      document.getElementById('ct-tel')?.value           || '',
      mobile:         document.getElementById('ct-mobile')?.value        || '',
      email:          document.getElementById('ct-email')?.value         || '',
      dateNaissance:  document.getElementById('ct-datenaissance')?.value || '',
      adresse:        document.getElementById('ct-adresse')?.value       || '',
      interlocuteur:  document.getElementById('ct-interlocuteur')?.value || '',
      numeroTahiti:   document.getElementById('ct-numerotahiti')?.value  || '',
      remiseClient:   parseFloat(document.getElementById('ct-remise')?.value) || 0,
      vip:            document.getElementById('ct-vip')?.checked         || false,
      prefTailles:    document.getElementById('ct-tailles')?.value       || '',
      prefCouleurs:   document.getElementById('ct-couleurs')?.value      || '',
      prefTechniques: techs,
      prefFichiers:   document.getElementById('ct-fichiers')?.value      || '',
      prefNotes:      document.getElementById('ct-notes')?.value         || ''
    };

    let savedId = contactId;
    if (contactId) {
      Store.update('contacts', contactId, record);
      Store.addAuditLog(`Modifié contact "${nom}"`, 'crm');
      toast('Contact mis à jour.', 'success');
    } else {
      const nc = Store.create('contacts', record);
      Store.addAuditLog(`Créé contact "${nom}"`, 'crm');
      toast('Contact créé.', 'success');
      savedId = nc.id;
    }

    closeModal();
    _renderContactFiche(savedId, toolbar, area);
  }

  /* ----------------------------------------------------------------
     POINT D'ENTRÉE PUBLIC
     ---------------------------------------------------------------- */

  function init(toolbar, area, viewId) {
    switch (viewId) {
      case 'pipeline': _renderPipeline(toolbar, area); break;
      case 'contacts': _renderContacts(toolbar, area); break;
      default:
        area.innerHTML = `
          <div class="table-empty">
            <div class="empty-icon">🎯</div>
            <p>Vue CRM "${_esc(viewId)}" inconnue.</p>
          </div>`;
    }
  }

  return { init };

})();

window.CRM = CRM;
