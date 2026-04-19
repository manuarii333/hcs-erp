/* ================================================================
   HCS ERP — js/modules/accounting.js
   Module Comptabilité : journal, plan comptable, P&L, balance, TGC.
   Pattern IIFE — exposé via window.Accounting
   ================================================================ */

'use strict';

const Accounting = (() => {

  /* ----------------------------------------------------------------
     État interne
     ---------------------------------------------------------------- */
  const _state = {
    view:    'journal',
    year:    new Date().getFullYear(),
    filters: { dateFrom: '', dateTo: '', compte: '', type: '' }
  };

  /* ----------------------------------------------------------------
     Plan comptable HCS Polynésie
     ---------------------------------------------------------------- */
  const PLAN_COMPTABLE = [
    { numero: '401000', libelle: 'Fournisseurs',              type: 'Passif',  classe: '4' },
    { numero: '411000', libelle: 'Clients',                   type: 'Actif',   classe: '4' },
    { numero: '445661', libelle: 'TVA déductible 16% (produits)',   type: 'Actif',   classe: '4' },
    { numero: '445662', libelle: 'TVA déductible 13% (services)',  type: 'Actif',   classe: '4' },
    { numero: '445663', libelle: 'TVA déductible 5%',              type: 'Actif',   classe: '4' },
    { numero: '445660', libelle: 'TVA déductible (total)',         type: 'Actif',   classe: '4' },
    { numero: '445811', libelle: 'TVA collectée 16% (produits)',   type: 'Passif',  classe: '4' },
    { numero: '445812', libelle: 'TVA collectée 13% (services)',   type: 'Passif',  classe: '4' },
    { numero: '445813', libelle: 'TVA collectée 5%',               type: 'Passif',  classe: '4' },
    { numero: '445810', libelle: 'TVA collectée (total)',          type: 'Passif',  classe: '4' },
    { numero: '512000', libelle: 'Banque',                    type: 'Actif',   classe: '5' },
    { numero: '530000', libelle: 'Caisse',                    type: 'Actif',   classe: '5' },
    { numero: '601000', libelle: 'Achats matières premières', type: 'Charge',  classe: '6' },
    { numero: '607000', libelle: 'Achats marchandises',       type: 'Charge',  classe: '6' },
    { numero: '701000', libelle: 'Ventes de produits',        type: 'Produit', classe: '7' },
    { numero: '706000', libelle: 'Prestations de services',   type: 'Produit', classe: '7' }
  ];

  const TYPES_ECRITURE = [
    { value: 'vente',   label: 'Vente'   },
    { value: 'achat',   label: 'Achat'   },
    { value: 'salaire', label: 'Salaire' },
    { value: 'tgc',     label: 'TVA'     },
    { value: 'autre',   label: 'Autre'   }
  ];

  const TYPE_BADGE = {
    vente:   'green',
    achat:   'orange',
    salaire: 'blue',
    tgc:     'violet',
    autre:   'gray'
  };

  /* ================================================================
     POINT D'ENTRÉE
     ================================================================ */
  function init(toolbar, area, viewId) {
    if (viewId !== _state.view) _state.view = viewId;

    switch (_state.view) {
      case 'tableau-de-bord': _renderTableauBord(toolbar, area); break;
      case 'conseiller':      _renderConseiller(toolbar, area);  break;
      case 'journal':         _renderJournal(toolbar, area);     break;
      case 'accounts':        _renderAccounts(toolbar, area);    break;
      case 'grand-livre':     _renderGrandLivre(toolbar, area);  break;
      case 'paiements':       _renderPaiements(toolbar, area);   break;
      case 'depenses':        _renderDepenses(toolbar, area);    break;
      case 'pl-report':       _renderPLReport(toolbar, area);    break;
      case 'bilan':           _renderBilan(toolbar, area);       break;
      case 'balance':         _renderBalance(toolbar, area);     break;
      case 'tax-report':      _renderTaxReport(toolbar, area);    break;
      case 'stats-ventes':   _renderStatsVentes(toolbar, area);  break;
      case 'assistant':       _renderAssistant(toolbar, area);   break;
      default:                _renderTableauBord(toolbar, area);
    }
  }

  /* ================================================================
     VUE : JOURNAL COMPTABLE
     ================================================================ */
  function _renderJournal(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-new-ecriture">+ Écriture manuelle</button>
      <div style="display:flex;gap:6px;margin-left:auto;">
        <button class="btn btn-ghost btn-sm" id="jnl-imp"   title="Importer CSV / JSON">⬆️ Importer</button>
        <button class="btn btn-ghost btn-sm" id="jnl-csv"   title="Exporter CSV">📥 CSV</button>
        <button class="btn btn-ghost btn-sm" id="jnl-xls"   title="Exporter Excel">📊 XLS</button>
        <button class="btn btn-ghost btn-sm" id="jnl-pdf"   title="Exporter PDF">🖨️ PDF</button>
      </div>`;

    toolbar.querySelector('#btn-new-ecriture').addEventListener('click', _openEcritureModal);

    /* Données courantes filtrées */
    const _getData = () => _getFilteredEcritures();

    const _hdrs = ['Date','Libellé','Compte','Journal','Débit (XPF)','Crédit (XPF)','Réf. pièce'];
    const _rows = () => _getData().map(e => [
      e.date, e.libelle, e.compte, e.journal || '', e.debit || 0, e.credit || 0, e.pieceRef || ''
    ]);

    toolbar.querySelector('#jnl-csv').addEventListener('click', () =>
      _dlCSV('hcs-journal', _hdrs, _rows())
    );
    toolbar.querySelector('#jnl-xls').addEventListener('click', () =>
      _dlXLS('hcs-journal', _hdrs, _rows(), 'Journal')
    );
    toolbar.querySelector('#jnl-pdf').addEventListener('click', () =>
      _dlPDF('Journal comptable', `Exercice ${_state.year}`, _hdrs, _rows())
    );
    toolbar.querySelector('#jnl-imp').addEventListener('click', () =>
      _openImportModal(
        'ecritures',
        ['Date','Libellé','Compte','Journal','Débit','Crédit','Réf. pièce'],
        cells => {
          if (!cells[0] || !cells[1]) return null;
          return { date: cells[0], libelle: cells[1], compte: cells[2] || '', journal: cells[3] || 'Achats', debit: parseFloat(cells[4]) || 0, credit: parseFloat(cells[5]) || 0, pieceRef: cells[6] || '' };
        },
        () => _renderJournal(toolbar, area)
      )
    );

    const f = _state.filters;

    area.innerHTML = `
      <div style="padding:16px 0 0;">

        <!-- Barre de filtres -->
        <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;
          margin-bottom:16px;padding:16px;
          background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);
              text-transform:uppercase;letter-spacing:.06em;">Du</label>
            <input id="flt-date-from" type="date" class="form-input"
              style="font-size:13px;padding:6px 8px;width:140px;" value="${f.dateFrom}">
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);
              text-transform:uppercase;letter-spacing:.06em;">Au</label>
            <input id="flt-date-to" type="date" class="form-input"
              style="font-size:13px;padding:6px 8px;width:140px;" value="${f.dateTo}">
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:200px;">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);
              text-transform:uppercase;letter-spacing:.06em;">Compte</label>
            <select id="flt-compte" class="form-input" style="font-size:13px;padding:6px 8px;">
              <option value="">Tous les comptes</option>
              ${PLAN_COMPTABLE.map(c =>
                `<option value="${c.numero}" ${f.compte === c.numero ? 'selected' : ''}>
                  ${c.numero} — ${_escA(c.libelle)}</option>`
              ).join('')}
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;min-width:140px;">
            <label style="font-size:11px;font-weight:600;color:var(--text-muted);
              text-transform:uppercase;letter-spacing:.06em;">Catégorie</label>
            <select id="flt-type" class="form-input" style="font-size:13px;padding:6px 8px;">
              <option value="">Toutes</option>
              ${TYPES_ECRITURE.map(t =>
                `<option value="${t.value}" ${f.type === t.value ? 'selected' : ''}>${t.label}</option>`
              ).join('')}
            </select>
          </div>
          <div style="display:flex;gap:6px;align-self:flex-end;">
            <button class="btn btn-secondary btn-sm" id="btn-apply-filters">Filtrer</button>
            <button class="btn btn-ghost btn-sm" id="btn-reset-filters">✕</button>
          </div>
        </div>

        <!-- Table -->
        <div id="acct-journal-table"></div>

        <!-- Totaux pied de table -->
        <div id="acct-journal-totals"></div>
      </div>`;

    document.getElementById('btn-apply-filters').addEventListener('click', () => {
      _state.filters.dateFrom = document.getElementById('flt-date-from').value;
      _state.filters.dateTo   = document.getElementById('flt-date-to').value;
      _state.filters.compte   = document.getElementById('flt-compte').value;
      _state.filters.type     = document.getElementById('flt-type').value;
      _refreshJournalTable();
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
      _state.filters = { dateFrom: '', dateTo: '', compte: '', type: '' };
      _renderJournal(
        document.getElementById('toolbar-actions'),
        document.getElementById('view-content')
      );
    });

    _refreshJournalTable();
  }

  function _refreshJournalTable() {
    const ecritures = _getFilteredEcritures();
    const sorted    = [...ecritures].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const totalDebit  = ecritures.reduce((s, e) => s + (e.debit  || 0), 0);
    const totalCredit = ecritures.reduce((s, e) => s + (e.credit || 0), 0);
    const balanced    = Math.abs(totalDebit - totalCredit) < 1;

    renderTable('acct-journal-table', {
      title:      `Journal comptable (${sorted.length} écriture${sorted.length > 1 ? 's' : ''})`,
      data:       sorted,
      searchable: true,
      columns: [
        { key: 'date',      label: 'Date',      type: 'date',  sortable: true },
        {
          key: 'reference', label: 'Référence', type: 'text',
          render: (r) => `<span style="font-family:var(--font-mono);font-size:12px;">
            ${_escA(r.reference || '—')}</span>`
        },
        { key: 'libelle',   label: 'Libellé',   type: 'text'  },
        {
          key: 'compte', label: 'Compte', type: 'text',
          render: (r) => {
            const c = _findCompte(r.compte);
            return `
              <div>
                <span style="font-family:var(--font-mono);font-size:12px;
                  color:var(--accent-blue);">${_escA(r.compte || '—')}</span>
                ${c ? `<div style="font-size:11px;color:var(--text-muted);">${_escA(c.libelle)}</div>` : ''}
              </div>`;
          }
        },
        {
          key: 'type', label: 'Catégorie', type: 'badge', badgeMap: TYPE_BADGE,
          render: (r) => _typeLabel(r.type)
        },
        {
          key: 'debit', label: 'Débit', type: 'money',
          render: (r) => r.debit
            ? `<span style="font-family:var(--font-mono);color:var(--accent-red);">${fmt(Math.round(r.debit))}</span>`
            : '<span style="color:var(--text-muted);">—</span>'
        },
        {
          key: 'credit', label: 'Crédit', type: 'money',
          render: (r) => r.credit
            ? `<span style="font-family:var(--font-mono);color:var(--accent-green);">${fmt(Math.round(r.credit))}</span>`
            : '<span style="color:var(--text-muted);">—</span>'
        },
        {
          key: '_actions', label: '', type: 'actions',
          actions: [{
            label: '🗑', className: 'btn-ghost danger',
            onClick: (row) => {
              if (row.type !== 'autre' && row.type !== 'manuel' && row.type) {
                /* Permettre suppression uniquement des écritures manuelles */
                showConfirm(
                  'Cette écriture a été générée automatiquement. Supprimer quand même ?',
                  () => { Store.remove('ecritures', row.id); _refreshJournalTable(); },
                  null, 'Supprimer', true
                );
                return;
              }
              showDeleteConfirm('cette écriture', () => {
                Store.remove('ecritures', row.id);
                toastSuccess('Écriture supprimée.');
                _refreshJournalTable();
              });
            }
          }]
        }
      ],
      emptyMsg: 'Aucune écriture pour ces critères.'
    });

    /* Totaux en pied */
    const totalsEl = document.getElementById('acct-journal-totals');
    if (totalsEl) {
      totalsEl.innerHTML = `
        <div style="display:flex;justify-content:flex-end;align-items:center;gap:32px;
          padding:12px 16px;background:var(--bg-elevated);border:1px solid var(--border);
          border-top:none;border-radius:0 0 8px 8px;">
          <div style="font-size:13px;">
            <span style="color:var(--text-muted);">Total Débit : </span>
            <span style="font-family:var(--font-mono);font-weight:700;
              color:var(--accent-red);">${fmt(Math.round(totalDebit))}</span>
          </div>
          <div style="font-size:13px;">
            <span style="color:var(--text-muted);">Total Crédit : </span>
            <span style="font-family:var(--font-mono);font-weight:700;
              color:var(--accent-green);">${fmt(Math.round(totalCredit))}</span>
          </div>
          <div style="font-size:13px;padding-left:16px;border-left:1px solid var(--border);">
            <span style="color:var(--text-muted);">Équilibre : </span>
            <span style="font-family:var(--font-mono);font-weight:700;
              color:${balanced ? 'var(--accent-green)' : 'var(--accent-red)'};">
              ${balanced ? '✓ Équilibré' : `⚠ Écart ${fmt(Math.abs(totalDebit - totalCredit))}`}
            </span>
          </div>
        </div>`;
    }
  }

  /* Modal : nouvelle écriture manuelle */
  function _openEcritureModal() {
    showFormModal(
      'Nouvelle écriture manuelle',
      [
        { name: 'date',      label: 'Date *',         type: 'date',    required: true, cols: 1 },
        { name: 'reference', label: 'Référence',      type: 'text',    cols: 1 },
        { name: 'libelle',   label: 'Libellé *',      type: 'text',    required: true, cols: 2 },
        {
          name: 'compte', label: 'Compte *', type: 'select', required: true, cols: 2,
          options: [
            { value: '', label: '— Sélectionner un compte —' },
            ...PLAN_COMPTABLE.map(c => ({ value: c.numero, label: `${c.numero} — ${c.libelle}` }))
          ]
        },
        { name: 'debit',  label: 'Débit (XPF)',  type: 'number', cols: 1 },
        { name: 'credit', label: 'Crédit (XPF)', type: 'number', cols: 1 },
        {
          name: 'type', label: 'Catégorie', type: 'select', cols: 2,
          options: TYPES_ECRITURE
        }
      ],
      { date: new Date().toISOString().slice(0, 10), type: 'autre' },
      (data) => {
        if (!data.compte) { toastError('Compte obligatoire.'); return; }
        const debit  = parseFloat(data.debit)  || 0;
        const credit = parseFloat(data.credit) || 0;
        if (!debit && !credit) { toastError('Renseignez un débit ou un crédit.'); return; }

        const annee = new Date().getFullYear();
        const num   = Store.nextCounter('ecr');
        const ref   = data.reference || `ECR-${annee}-${String(num).padStart(5, '0')}`;

        Store.create('ecritures', {
          date:      data.date,
          reference: ref,
          libelle:   data.libelle,
          compte:    data.compte,
          debit,
          credit,
          type:      data.type || 'autre',
          createdAt: new Date().toISOString()
        });

        toastSuccess('Écriture créée.');
        _refreshJournalTable();
      },
      'lg'
    );
  }

  /* ================================================================
     VUE : PLAN COMPTABLE
     ================================================================ */
  function _renderAccounts(toolbar, area) {
    toolbar.innerHTML = `
      <span style="font-size:13px;color:var(--text-muted);align-self:center;">
        Plan comptable HCS Polynésie — Classe 4 à 7
      </span>`;

    const ecritures = Store.getAll('ecritures');

    const TYPE_COLORS = { Actif:'green', Passif:'blue', Charge:'red', Produit:'orange' };

    const data = PLAN_COMPTABLE.map(compte => {
      const entries     = ecritures.filter(e => _matchesCompte(e.compte, compte.numero));
      const totalDebit  = entries.reduce((s, e) => s + (e.debit  || 0), 0);
      const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
      const solde = (compte.type === 'Actif' || compte.type === 'Charge')
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;
      return { ...compte, totalDebit, totalCredit, solde };
    });

    area.innerHTML = '<div id="acct-accounts-table"></div>';
    renderTable('acct-accounts-table', {
      title: 'Plan comptable',
      data,
      columns: [
        {
          key: 'numero', label: 'N° Compte', type: 'text',
          render: (r) => `<span style="font-family:var(--font-mono);font-weight:600;
            color:var(--accent-blue);">${r.numero}</span>`
        },
        { key: 'libelle', label: 'Libellé',     type: 'text', sortable: true },
        { key: 'type',    label: 'Type',         type: 'badge', badgeMap: TYPE_COLORS },
        {
          key: 'totalDebit', label: 'Mvts Débit', type: 'money',
          render: (r) => r.totalDebit
            ? `<span style="font-family:var(--font-mono);color:var(--accent-red);">${fmt(Math.round(r.totalDebit))}</span>`
            : '<span style="color:var(--text-muted);">—</span>'
        },
        {
          key: 'totalCredit', label: 'Mvts Crédit', type: 'money',
          render: (r) => r.totalCredit
            ? `<span style="font-family:var(--font-mono);color:var(--accent-green);">${fmt(Math.round(r.totalCredit))}</span>`
            : '<span style="color:var(--text-muted);">—</span>'
        },
        {
          key: 'solde', label: 'Solde', type: 'money', sortable: true,
          render: (r) => {
            const abs   = Math.abs(r.solde);
            const color = r.solde >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
            const sens  = r.solde >= 0 ? '(D)' : '(C)';
            return abs > 0
              ? `<span style="font-family:var(--font-mono);font-weight:700;color:${color};">${fmt(Math.round(abs))} ${sens}</span>`
              : '<span style="color:var(--text-muted);">—</span>';
          }
        }
      ],
      emptyMsg: 'Aucune donnée.'
    });
  }

  /* ================================================================
     VUE : COMPTE DE RÉSULTAT (P&L)
     ================================================================ */
  function _renderPLReport(toolbar, area) {
    const now   = new Date().getFullYear();
    const years = [now, now - 1, now - 2];

    toolbar.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:13px;color:var(--text-secondary);">Exercice :</label>
        <select id="pl-year" class="form-input"
          style="width:100px;font-size:13px;padding:6px 8px;">
          ${years.map(y => `<option value="${y}" ${_state.year === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>`;

    toolbar.querySelector('#pl-year').addEventListener('change', (e) => {
      _state.year = parseInt(e.target.value);
      _renderPLReport(toolbar, area);
    });

    const year   = _state.year;
    const MOIS_C = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

    /* Données brutes filtrées sur l'année */
    const factures  = Store.getAll('factures').filter(f =>
      f.date && new Date(f.date).getFullYear() === year
    );
    const bonsAchat = Store.getAll('bonsAchat').filter(b =>
      b.statut === 'Reçu' && b.date && new Date(b.date).getFullYear() === year
    );

    const totalVentes  = factures.reduce((s, f)  => s + (f.totalHT  || 0), 0);
    const totalAchats  = bonsAchat.reduce((s, b)  => s + (b.totalHT  || 0), 0);
    const resultat     = totalVentes - totalAchats;
    const marge        = totalVentes > 0 ? Math.round((resultat / totalVentes) * 100) : 0;

    /* Mensuel */
    const mventes  = new Array(12).fill(0);
    const mcharges = new Array(12).fill(0);
    factures.forEach(f  => { mventes[new Date(f.date).getMonth()]  += f.totalHT  || 0; });
    bonsAchat.forEach(b => { mcharges[new Date(b.date).getMonth()] += b.totalHT  || 0; });

    area.innerHTML = `
      <div style="padding:24px 0;max-width:1100px;margin:0 auto;">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:24px;">
          Compte de résultat — ${year}
        </div>

        <!-- KPIs -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;">
          <div id="pl-kpi-ca"></div>
          <div id="pl-kpi-charges"></div>
          <div id="pl-kpi-resultat"></div>
          <div id="pl-kpi-marge"></div>
        </div>

        <!-- Graphique mensuel groupé -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);
          border-radius:12px;padding:20px;margin-bottom:24px;">
          <div style="font-size:14px;font-weight:600;color:var(--text-secondary);
            margin-bottom:16px;">Produits vs Charges par mois</div>
          <div id="pl-chart-monthly"></div>
        </div>

        <!-- Détails produits / charges -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <div style="background:var(--bg-surface);border:1px solid var(--border);
            border-radius:12px;padding:20px;">
            <div style="font-size:14px;font-weight:600;color:var(--accent-green);
              margin-bottom:16px;">+ Produits</div>
            <div id="pl-bar-produits"></div>
            <div style="display:flex;justify-content:space-between;
              border-top:1px solid var(--border);padding-top:12px;margin-top:12px;font-weight:700;">
              <span style="color:var(--text-primary);">Total produits</span>
              <span style="font-family:var(--font-mono);color:var(--accent-green);">
                ${fmt(Math.round(totalVentes))}</span>
            </div>
          </div>
          <div style="background:var(--bg-surface);border:1px solid var(--border);
            border-radius:12px;padding:20px;">
            <div style="font-size:14px;font-weight:600;color:var(--accent-red);
              margin-bottom:16px;">− Charges</div>
            <div id="pl-bar-charges"></div>
            <div style="display:flex;justify-content:space-between;
              border-top:1px solid var(--border);padding-top:12px;margin-top:12px;font-weight:700;">
              <span style="color:var(--text-primary);">Total charges</span>
              <span style="font-family:var(--font-mono);color:var(--accent-red);">
                ${fmt(Math.round(totalAchats))}</span>
            </div>
          </div>
        </div>

        <!-- Résultat net -->
        <div style="background:var(--bg-surface);
          border:2px solid ${resultat >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};
          border-radius:12px;padding:24px;
          display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:18px;font-weight:700;color:var(--text-primary);">
              Résultat net ${year}
            </div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">
              Produits ${fmt(Math.round(totalVentes))} − Charges ${fmt(Math.round(totalAchats))}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-family:var(--font-mono);font-size:30px;font-weight:700;
              color:${resultat >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'};">
              ${resultat >= 0 ? '+' : ''}${fmt(Math.round(resultat))}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
              ${resultat >= 0 ? 'Bénéfice' : 'Déficit'}
            </div>
          </div>
        </div>
      </div>`;

    /* KPIs */
    statCard('pl-kpi-ca', {
      icon: '💰', value: fmt(Math.round(totalVentes)),
      label: `CA HT ${year}`, color: 'var(--accent-green)'
    });
    statCard('pl-kpi-charges', {
      icon: '🛒', value: fmt(Math.round(totalAchats)),
      label: 'Total charges', color: 'var(--accent-red)'
    });
    statCard('pl-kpi-resultat', {
      icon: resultat >= 0 ? '📈' : '📉',
      value: fmt(Math.round(Math.abs(resultat))),
      label: resultat >= 0 ? 'Bénéfice net' : 'Déficit',
      color: resultat >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'
    });
    statCard('pl-kpi-marge', {
      icon: '〒',
      value: `${marge}%`,
      label: 'Marge nette',
      color: marge >= 20 ? 'var(--accent-green)' : marge >= 5 ? 'var(--accent-orange)' : 'var(--accent-red)'
    });

    /* Graphique mensuel groupé */
    _renderGroupedBars('pl-chart-monthly', MOIS_C, mventes, mcharges,
      'Produits', 'Charges', '#00d4aa', '#ff6b6b');

    /* Barres mensuelles produits */
    const moisAvecVentes  = MOIS_C.filter((_, i) => mventes[i]  > 0);
    const moisAvecCharges = MOIS_C.filter((_, i) => mcharges[i] > 0);

    barChart('pl-bar-produits', {
      labels: moisAvecVentes.length ? moisAvecVentes : ['Aucune vente'],
      values: moisAvecVentes.length ? mventes.filter(v => v > 0) : [0],
      formatter: v => fmt(Math.round(v)),
      colors:  Array(12).fill('#00d4aa'),
      height:  22
    });
    barChart('pl-bar-charges', {
      labels: moisAvecCharges.length ? moisAvecCharges : ['Aucun achat'],
      values: moisAvecCharges.length ? mcharges.filter(v => v > 0) : [0],
      formatter: v => fmt(Math.round(v)),
      colors:  Array(12).fill('#ff6b6b'),
      height:  22
    });
  }

  /* ================================================================
     VUE : BALANCE GÉNÉRALE
     ================================================================ */
  function _renderBalance(toolbar, area) {
    toolbar.innerHTML = `
      <span style="font-size:13px;color:var(--text-muted);align-self:center;">
        Balance générale — tous exercices
      </span>
      <div style="display:flex;gap:6px;margin-left:auto;">
        <button class="btn btn-ghost btn-sm" id="bal-csv" title="Exporter CSV">📥 CSV</button>
        <button class="btn btn-ghost btn-sm" id="bal-xls" title="Exporter Excel">📊 XLS</button>
        <button class="btn btn-ghost btn-sm" id="bal-pdf" title="Exporter PDF">🖨️ PDF</button>
      </div>`;

    const ecritures = Store.getAll('ecritures');

    const data = PLAN_COMPTABLE.map(compte => {
      const entries     = ecritures.filter(e => _matchesCompte(e.compte, compte.numero));
      const totalDebit  = entries.reduce((s, e) => s + (e.debit  || 0), 0);
      const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
      return {
        ...compte,
        totalDebit,
        totalCredit,
        soldeD: Math.max(0, totalDebit  - totalCredit),
        soldeC: Math.max(0, totalCredit - totalDebit)
      };
    });

    const gtDebit  = data.reduce((s, r) => s + r.totalDebit,  0);
    const gtCredit = data.reduce((s, r) => s + r.totalCredit, 0);
    const gtSoldeD = data.reduce((s, r) => s + r.soldeD,      0);
    const gtSoldeC = data.reduce((s, r) => s + r.soldeC,      0);
    const balanced = Math.abs(gtDebit - gtCredit) < 1;

    const TYPE_COLORS = { Actif:'green', Passif:'blue', Charge:'red', Produit:'orange' };

    area.innerHTML = `
      <div style="padding:16px 0 0;">
        ${!balanced ? `
          <div style="background:rgba(255,107,107,0.1);border:1px solid var(--accent-red);
            border-radius:8px;padding:12px 16px;margin-bottom:16px;color:var(--accent-red);
            font-size:14px;">
            ⚠ Balance déséquilibrée — écart de ${fmt(Math.round(Math.abs(gtDebit - gtCredit)))} XPF
          </div>` : ''}

        <div id="acct-balance-table"></div>

        <!-- Totaux généraux -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);
          background:var(--bg-elevated);border:1px solid var(--border);
          border-top:2px solid var(--border);border-radius:0 0 8px 8px;
          padding:14px 16px;margin-top:-1px;">
          ${[
            ['Total Débit',    fmt(Math.round(gtDebit)),  'var(--accent-red)'   ],
            ['Total Crédit',   fmt(Math.round(gtCredit)), 'var(--accent-green)' ],
            ['Soldes Déb.',    fmt(Math.round(gtSoldeD)), 'var(--accent-orange)'],
            ['Soldes Créd.',   fmt(Math.round(gtSoldeC)), 'var(--accent-blue)'  ]
          ].map(([lbl, val, color]) => `
            <div style="text-align:center;">
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;
                letter-spacing:.06em;margin-bottom:4px;">${lbl}</div>
              <div style="font-family:var(--font-mono);font-weight:700;
                color:${color};font-size:15px;">${val}</div>
            </div>`).join('')}
        </div>

        <div style="text-align:right;margin-top:8px;font-size:13px;">
          <span style="color:${balanced ? 'var(--accent-green)' : 'var(--accent-red)'};">
            ${balanced ? '✓ Balance équilibrée (Débit = Crédit)' : '⚠ Balance déséquilibrée'}
          </span>
        </div>
      </div>`;

    renderTable('acct-balance-table', {
      title: 'Balance générale des comptes',
      data,
      columns: [
        {
          key: 'numero', label: 'Compte', type: 'text',
          render: (r) => `<span style="font-family:var(--font-mono);font-weight:600;
            color:var(--accent-blue);">${r.numero}</span>`
        },
        { key: 'libelle',     label: 'Libellé',      type: 'text' },
        { key: 'type',        label: 'Type',          type: 'badge', badgeMap: TYPE_COLORS },
        {
          key: 'totalDebit',  label: 'Total Débit',   type: 'money',
          render: (r) => r.totalDebit
            ? `<span style="font-family:var(--font-mono);">${fmt(Math.round(r.totalDebit))}</span>`
            : '—'
        },
        {
          key: 'totalCredit', label: 'Total Crédit',  type: 'money',
          render: (r) => r.totalCredit
            ? `<span style="font-family:var(--font-mono);">${fmt(Math.round(r.totalCredit))}</span>`
            : '—'
        },
        {
          key: 'soldeD', label: 'Solde Déb.', type: 'money',
          render: (r) => r.soldeD > 0
            ? `<span style="font-family:var(--font-mono);font-weight:700;
                color:var(--accent-orange);">${fmt(Math.round(r.soldeD))}</span>`
            : '—'
        },
        {
          key: 'soldeC', label: 'Solde Créd.', type: 'money',
          render: (r) => r.soldeC > 0
            ? `<span style="font-family:var(--font-mono);font-weight:700;
                color:var(--accent-blue);">${fmt(Math.round(r.soldeC))}</span>`
            : '—'
        }
      ],
      emptyMsg: 'Aucun mouvement comptable.'
    });

    /* Export balance */
    const balHdrs = ['Compte', 'Libellé', 'Type', 'Total Débit (XPF)', 'Total Crédit (XPF)', 'Solde Déb. (XPF)', 'Solde Créd. (XPF)'];
    const balRows = () => data.map(r => [r.numero, r.libelle, r.type, r.totalDebit, r.totalCredit, r.soldeD, r.soldeC]);
    toolbar.querySelector('#bal-csv').addEventListener('click', () => _dlCSV('hcs-balance', balHdrs, balRows()));
    toolbar.querySelector('#bal-xls').addEventListener('click', () => _dlXLS('hcs-balance', balHdrs, balRows(), 'Balance'));
    toolbar.querySelector('#bal-pdf').addEventListener('click', () => _dlPDF('Balance générale des comptes', 'Tous exercices', balHdrs, balRows()));
  }

  /* ================================================================
     VUE : STATISTIQUES VENTES & TVA
     Articles vendus par catégorie + TVA encaissée + TVA déductible
     ================================================================ */
  function _renderStatsVentes(toolbar, area) {

    /* Sélecteur de période */
    toolbar.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        <label style="font-size:13px;color:var(--text-muted);font-weight:600;">Période :</label>
        <select id="sv-period" class="form-control" style="width:180px;padding:5px 10px;">
          <option value="all">Tout l'historique</option>
          <option value="month">Ce mois</option>
          <option value="quarter">Ce trimestre</option>
          <option value="year" selected>Cette année</option>
        </select>
        <button class="btn btn-ghost btn-sm" id="sv-refresh">↺ Actualiser</button>
      </div>`;

    const _build = () => _buildStatsVentes(area,
      document.getElementById('sv-period')?.value || 'year'
    );

    toolbar.querySelector('#sv-period').addEventListener('change', _build);
    toolbar.querySelector('#sv-refresh').addEventListener('click',  _build);

    _build();
  }

  /** Construit le contenu du panneau Stats ventes selon la période */
  function _buildStatsVentes(area, period) {
    const now    = new Date();
    const year   = now.getFullYear();
    const month  = now.getMonth();
    const q      = Math.floor(month / 3);

    /* Filtre date selon période */
    const _inPeriod = (dateStr) => {
      if (!dateStr || period === 'all') return true;
      const d = new Date(dateStr);
      if (isNaN(d)) return true;
      if (period === 'year')    return d.getFullYear() === year;
      if (period === 'month')   return d.getFullYear() === year && d.getMonth() === month;
      if (period === 'quarter') {
        const dq = Math.floor(d.getMonth() / 3);
        return d.getFullYear() === year && dq === q;
      }
      return true;
    };

    /* ---- Données sources ---- */
    const factures  = Store.getAll('factures').filter(f => _inPeriod(f.date));
    const produits  = Store.getAll('produits');
    const ecritures = Store.getAll('ecritures').filter(e => _inPeriod(e.date));

    /* Index produits : par id et par nom */
    const prodById  = {};
    const prodByNom = {};
    produits.forEach(p => {
      if (p.id)  prodById[p.id]                         = p;
      if (p.nom) prodByNom[(p.nom || '').toLowerCase()] = p;
    });

    /* ---- 1. Articles vendus par catégorie ---- */
    const catStats = {};   /* { cat: { qte, ht, tva, ttc, articles: Set } } */
    let totalQteGlobal = 0, totalHTGlobal = 0, totalTTCGlobal = 0;

    factures.forEach(fac => {
      (fac.lignes || []).forEach(l => {
        const prod = prodById[l.produitId]
          || prodByNom[(l.produit || '').toLowerCase()]
          || {};
        const cat  = prod.categorie || l.categorie || '(Non classé)';
        const qte  = parseFloat(l.qte)          || 0;
        const pu   = parseFloat(l.prixUnitaire)  || 0;
        const rem  = parseFloat(l.remise)        || 0;
        const ht   = Math.round(qte * pu * (1 - rem / 100));
        const taux = l.tauxTVA !== undefined ? parseFloat(l.tauxTVA) : 16;
        const tva  = Math.round(ht * taux / 100);
        const ttc  = ht + tva;

        if (!catStats[cat]) catStats[cat] = { qte: 0, ht: 0, tva: 0, ttc: 0, articles: new Set() };
        catStats[cat].qte     += qte;
        catStats[cat].ht      += ht;
        catStats[cat].tva     += tva;
        catStats[cat].ttc     += ttc;
        catStats[cat].articles.add(l.produit || l.description || '?');

        totalQteGlobal  += qte;
        totalHTGlobal   += ht;
        totalTTCGlobal  += ttc;
      });
    });

    /* Trier par CA HT décroissant */
    const catRows = Object.entries(catStats)
      .sort((a, b) => b[1].ht - a[1].ht);

    /* ---- 2. TVA encaissée — comptes 445700 / 4458xx (crédit) ---- */
    const tvaEncaissee = ecritures
      .filter(e => e.compte && (
        e.compte.startsWith('44570') ||
        e.compte.startsWith('44581') ||
        e.compte.startsWith('44582') ||
        e.compte.startsWith('44583') ||
        e.compte.startsWith('44580')
      ) && (e.credit || 0) > 0)
      .reduce((s, e) => s + (e.credit || 0), 0);

    /* Aussi somme des TVA des lignes de factures (source secondaire) */
    const tvaEncaisseeLignes = factures.reduce((s, f) =>
      s + ((f.totalTVA || (f.totalTTC || 0) - (f.totalHT || 0)) || 0), 0
    );
    const tvaEncFinal = tvaEncaissee > 0 ? Math.round(tvaEncaissee) : Math.round(tvaEncaisseeLignes);

    /* ---- 3. TVA déductible — comptes 4456xx (débit) ---- */
    const tvaDed = ecritures
      .filter(e => e.compte && (
        e.compte.startsWith('44566') ||
        e.compte.startsWith('44560')
      ) && (e.debit || 0) > 0)
      .reduce((s, e) => s + (e.debit || 0), 0);

    /* TVA nette à payer */
    const tvaNette = Math.max(0, tvaEncFinal - Math.round(tvaDed));

    /* ---- Libellé période ---- */
    const PERIOD_LABEL = {
      all: 'Tout l\'historique',
      year: `Exercice ${year}`,
      month: now.toLocaleString('fr-FR', { month: 'long', year: 'numeric' }),
      quarter: `T${q + 1} ${year}`
    };
    const periodLabel = PERIOD_LABEL[period] || period;

    /* ---- Couleurs par catégorie (palette) ---- */
    const PALETTE = ['#4a5fff','#00d4aa','#ffc857','#ff6b6b','#b07bff',
                     '#00b4d8','#f77f00','#9b5de5','#06d6a0','#ef476f'];

    /* ---- HTML ---- */
    const catTableRows = catRows.length === 0
      ? `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">
           Aucune vente sur cette période.</td></tr>`
      : catRows.map(([cat, s], i) => {
          const pct = totalHTGlobal > 0 ? Math.round((s.ht / totalHTGlobal) * 100) : 0;
          const col = PALETTE[i % PALETTE.length];
          return `
            <tr>
              <td style="padding:10px 12px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:10px;height:10px;border-radius:3px;background:${col};flex-shrink:0;"></div>
                  <span style="font-weight:600;color:var(--text-primary);">${_escA(cat)}</span>
                </div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:2px;padding-left:18px;">
                  ${[...s.articles].slice(0, 3).map(_escA).join(', ')}${s.articles.size > 3 ? ' …' : ''}
                </div>
              </td>
              <td style="text-align:center;padding:10px 8px;font-family:var(--font-mono);
                font-weight:700;color:var(--text-primary);">${s.qte}</td>
              <td style="text-align:right;padding:10px 8px;font-family:var(--font-mono);">
                ${_fmtA(Math.round(s.ht))}</td>
              <td style="text-align:right;padding:10px 8px;font-family:var(--font-mono);
                color:var(--accent-orange);">${_fmtA(Math.round(s.tva))}</td>
              <td style="text-align:right;padding:10px 8px;font-family:var(--font-mono);
                font-weight:700;color:var(--text-primary);">${_fmtA(Math.round(s.ttc))}</td>
              <td style="padding:10px 8px;min-width:100px;">
                <div style="background:var(--bg-elevated);border-radius:4px;height:8px;overflow:hidden;">
                  <div style="background:${col};height:100%;width:${pct}%;transition:width .4s;"></div>
                </div>
                <div style="font-size:10px;color:var(--text-muted);text-align:right;margin-top:2px;">${pct}%</div>
              </td>
            </tr>`;
        }).join('');

    area.innerHTML = `
      <div style="max-width:1100px;margin:0 auto;padding:24px 0;">

        <!-- Titre période -->
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:24px;">
          Statistiques ventes &amp; TVA
          <span style="font-size:13px;font-weight:400;color:var(--text-muted);margin-left:10px;">${_escA(periodLabel)}</span>
        </div>

        <!-- KPI bande supérieure -->
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:28px;">

          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;
            padding:16px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
              letter-spacing:.07em;margin-bottom:6px;">Articles vendus</div>
            <div style="font-size:22px;font-weight:800;font-family:var(--font-mono);
              color:var(--text-primary);">${totalQteGlobal}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${catRows.length} catégorie${catRows.length > 1 ? 's' : ''}</div>
          </div>

          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;
            padding:16px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
              letter-spacing:.07em;margin-bottom:6px;">CA HT total</div>
            <div style="font-size:20px;font-weight:800;font-family:var(--font-mono);
              color:var(--accent-blue);">${_fmtA(Math.round(totalHTGlobal))}</div>
          </div>

          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;
            padding:16px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
              letter-spacing:.07em;margin-bottom:6px;">TVA encaissée</div>
            <div style="font-size:20px;font-weight:800;font-family:var(--font-mono);
              color:var(--accent-orange);">${_fmtA(tvaEncFinal)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">Collectée sur ventes</div>
          </div>

          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;
            padding:16px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
              letter-spacing:.07em;margin-bottom:6px;">TVA déductible</div>
            <div style="font-size:20px;font-weight:800;font-family:var(--font-mono);
              color:var(--accent-green);">${_fmtA(Math.round(tvaDed))}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:4px;">Sur achats &amp; charges</div>
          </div>

          <div style="background:${tvaNette > 0 ? '#FEF3C7' : '#DCFCE7'};
            border:1px solid ${tvaNette > 0 ? '#FCD34D' : '#86EFAC'};
            border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:10px;font-weight:700;color:${tvaNette > 0 ? '#92400E' : '#15803D'};
              text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">TVA nette à payer</div>
            <div style="font-size:20px;font-weight:800;font-family:var(--font-mono);
              color:${tvaNette > 0 ? '#D97706' : '#16A34A'};">${_fmtA(tvaNette)}</div>
            <div style="font-size:10px;color:${tvaNette > 0 ? '#92400E' : '#15803D'};margin-top:4px;">
              Encaissée − Déductible</div>
          </div>
        </div>

        <!-- Tableau catégories -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);
          border-radius:12px;overflow:hidden;margin-bottom:28px;">
          <div style="padding:16px 20px;border-bottom:1px solid var(--border);
            display:flex;align-items:center;justify-content:space-between;">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary);">
              Articles vendus par catégorie
            </div>
            <div style="font-size:12px;color:var(--text-muted);">
              ${factures.length} facture${factures.length > 1 ? 's' : ''} analysée${factures.length > 1 ? 's' : ''}
            </div>
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:var(--bg-elevated);">
                  <th style="text-align:left;padding:10px 12px;font-size:11px;font-weight:700;
                    color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">Catégorie</th>
                  <th style="text-align:center;padding:10px 8px;font-size:11px;font-weight:700;
                    color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">Qté vendue</th>
                  <th style="text-align:right;padding:10px 8px;font-size:11px;font-weight:700;
                    color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">CA HT</th>
                  <th style="text-align:right;padding:10px 8px;font-size:11px;font-weight:700;
                    color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">TVA</th>
                  <th style="text-align:right;padding:10px 8px;font-size:11px;font-weight:700;
                    color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;">TTC</th>
                  <th style="padding:10px 8px;font-size:11px;font-weight:700;
                    color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;min-width:120px;">
                    Part CA</th>
                </tr>
              </thead>
              <tbody>${catTableRows}</tbody>
              <tfoot>
                <tr style="background:var(--bg-elevated);border-top:2px solid var(--border);">
                  <td style="padding:10px 12px;font-weight:700;color:var(--text-primary);">Total</td>
                  <td style="text-align:center;padding:10px 8px;font-family:var(--font-mono);
                    font-weight:700;color:var(--text-primary);">${totalQteGlobal}</td>
                  <td style="text-align:right;padding:10px 8px;font-family:var(--font-mono);
                    font-weight:700;color:var(--accent-blue);">${_fmtA(Math.round(totalHTGlobal))}</td>
                  <td style="text-align:right;padding:10px 8px;font-family:var(--font-mono);
                    font-weight:700;color:var(--accent-orange);">${_fmtA(tvaEncFinal)}</td>
                  <td style="text-align:right;padding:10px 8px;font-family:var(--font-mono);
                    font-weight:700;color:var(--text-primary);">${_fmtA(Math.round(totalTTCGlobal))}</td>
                  <td style="padding:10px 8px;"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Détail TVA -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">

          <!-- TVA encaissée par taux -->
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:20px;">
            <div style="font-size:13px;font-weight:700;color:var(--accent-orange);margin-bottom:14px;">
              TVA encaissée (sur ventes)
            </div>
            ${(function() {
              const byTaux = {};
              factures.forEach(fac => {
                (fac.lignes || []).forEach(l => {
                  const taux = l.tauxTVA !== undefined ? parseFloat(l.tauxTVA) : 16;
                  const qte  = parseFloat(l.qte) || 0;
                  const pu   = parseFloat(l.prixUnitaire) || 0;
                  const rem  = parseFloat(l.remise) || 0;
                  const ht   = Math.round(qte * pu * (1 - rem / 100));
                  const tva  = Math.round(ht * taux / 100);
                  if (!byTaux[taux]) byTaux[taux] = { ht: 0, tva: 0 };
                  byTaux[taux].ht  += ht;
                  byTaux[taux].tva += tva;
                });
              });
              return Object.entries(byTaux).length === 0
                ? '<div style="color:var(--text-muted);font-size:13px;">Aucune vente.</div>'
                : Object.entries(byTaux).sort((a,b) => b[0]-a[0]).map(([taux, s]) => `
                  <div style="display:flex;justify-content:space-between;align-items:center;
                    padding:10px 0;border-bottom:1px solid var(--border-light);">
                    <div>
                      <span style="font-weight:600;color:var(--text-primary);">TVA ${taux}%</span>
                      <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">
                        Base HT : ${_fmtA(Math.round(s.ht))}</span>
                    </div>
                    <span style="font-family:var(--font-mono);font-weight:700;
                      color:var(--accent-orange);">${_fmtA(Math.round(s.tva))}</span>
                  </div>`).join('');
            })()}
            <div style="display:flex;justify-content:space-between;padding-top:12px;
              font-weight:700;color:var(--accent-orange);">
              <span>Total TVA collectée</span>
              <span style="font-family:var(--font-mono);">${_fmtA(tvaEncFinal)}</span>
            </div>
          </div>

          <!-- TVA déductible depuis journal -->
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:20px;">
            <div style="font-size:13px;font-weight:700;color:var(--accent-green);margin-bottom:14px;">
              TVA déductible (sur achats)
            </div>
            ${(function() {
              const dedLines = ecritures.filter(e =>
                e.compte && (e.compte.startsWith('44566') || e.compte.startsWith('44560')) &&
                (e.debit || 0) > 0
              );
              if (dedLines.length === 0) return `
                <div style="color:var(--text-muted);font-size:13px;padding:8px 0;">
                  Aucune écriture de TVA déductible sur la période.<br>
                  <span style="font-size:11px;">Les achats fournisseurs génèrent des écritures 4456xx automatiquement.</span>
                </div>`;
              const byCompte = {};
              dedLines.forEach(e => {
                const c = e.compte;
                if (!byCompte[c]) byCompte[c] = { libelle: e.libelle || c, total: 0 };
                byCompte[c].total += (e.debit || 0);
              });
              return Object.entries(byCompte).map(([c, s]) => `
                <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:10px 0;border-bottom:1px solid var(--border-light);">
                  <div>
                    <span style="font-weight:600;color:var(--text-primary);">${c}</span>
                    <span style="font-size:11px;color:var(--text-muted);margin-left:8px;">
                      ${_escA(PLAN_COMPTABLE.find(p => p.numero === c)?.libelle || s.libelle)}</span>
                  </div>
                  <span style="font-family:var(--font-mono);font-weight:700;
                    color:var(--accent-green);">${_fmtA(Math.round(s.total))}</span>
                </div>`).join('');
            })()}
            <div style="display:flex;justify-content:space-between;padding-top:12px;
              font-weight:700;color:var(--accent-green);">
              <span>Total TVA déductible</span>
              <span style="font-family:var(--font-mono);">${_fmtA(Math.round(tvaDed))}</span>
            </div>
          </div>
        </div>

      </div>`;
  }

  /* Helpers locaux pour Stats ventes */
  function _fmtA(n) {
    return (n || 0).toLocaleString('fr-FR') + ' XPF';
  }
  function _escA(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ================================================================
     VUE : RAPPORT TVA
     ================================================================ */
  function _renderTaxReport(toolbar, area) {
    const now   = new Date().getFullYear();
    const years = [now, now - 1, now - 2];

    toolbar.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:13px;color:var(--text-secondary);">Exercice :</label>
        <select id="tgc-year" class="form-input"
          style="width:100px;font-size:13px;padding:6px 8px;">
          ${years.map(y => `<option value="${y}" ${_state.year === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:6px;margin-left:auto;">
        <button class="btn btn-ghost btn-sm" id="tgc-csv" title="Exporter CSV">📥 CSV</button>
        <button class="btn btn-ghost btn-sm" id="tgc-xls" title="Exporter Excel">📊 XLS</button>
        <button class="btn btn-ghost btn-sm" id="tgc-pdf" title="Exporter PDF">🖨️ PDF</button>
      </div>`;

    toolbar.querySelector('#tgc-year').addEventListener('change', (e) => {
      _state.year = parseInt(e.target.value);
      _renderTaxReport(toolbar, area);
    });

    const year = _state.year;
    const MOIS_LONG = ['Janvier','Février','Mars','Avril','Mai','Juin',
      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

    /* TVA collectée = TTC - HT sur factures payées */
    const factures  = Store.getAll('factures').filter(f =>
      f.statut === 'Payé' && f.date && new Date(f.date).getFullYear() === year
    );
    /* TVA déductible = TTC - HT sur achats reçus */
    const bonsAchat = Store.getAll('bonsAchat').filter(b =>
      b.statut === 'Reçu' && b.date && new Date(b.date).getFullYear() === year
    );

    /* Calcule la TVA par taux depuis les lignes d'un document */
    const _tvaParTaux = (lignes = []) => {
      const r = { 16: 0, 13: 0, 5: 0, autres: 0 };
      lignes.forEach(l => {
        const brut = (l.qte || 0) * (l.prixUnitaire || 0);
        const ht   = brut * (1 - (l.remise || 0) / 100);
        const t    = l.tauxTVA !== undefined ? Number(l.tauxTVA) : 16;
        if (r[t] !== undefined) r[t] += ht * (t / 100);
        else r.autres += ht * (t / 100);
      });
      return r;
    };

    /* Arrays mensuels : total + ventilation par taux */
    const mcoll    = new Array(12).fill(0);
    const mcoll16  = new Array(12).fill(0);
    const mcoll13  = new Array(12).fill(0);
    const mcoll5   = new Array(12).fill(0);
    const mdedu    = new Array(12).fill(0);
    const mdedu16  = new Array(12).fill(0);
    const mdedu13  = new Array(12).fill(0);
    const mdedu5   = new Array(12).fill(0);

    factures.forEach(f => {
      const m   = new Date(f.date).getMonth();
      const tva = _tvaParTaux(f.lignes || []);
      mcoll[m]   += tva[16] + tva[13] + tva[5] + tva.autres;
      mcoll16[m] += tva[16];
      mcoll13[m] += tva[13];
      mcoll5[m]  += tva[5];
    });
    bonsAchat.forEach(b => {
      const m   = new Date(b.date).getMonth();
      /* Les BCs n'ont pas toujours de lignes avec tauxTVA → fallback TTC-HT */
      const hasLignes = Array.isArray(b.lignes) && b.lignes.length > 0;
      if (hasLignes) {
        const tva = _tvaParTaux(b.lignes);
        mdedu[m]   += tva[16] + tva[13] + tva[5] + tva.autres;
        mdedu16[m] += tva[16];
        mdedu13[m] += tva[13];
        mdedu5[m]  += tva[5];
      } else {
        const diff = (b.totalTTC || 0) - (b.totalHT || 0);
        mdedu[m]   += diff;
        mdedu16[m] += diff; // on attribue au taux principal par défaut
      }
    });

    const mnette = mcoll.map((c, i) => c - mdedu[i]);

    const totalColl   = mcoll.reduce((s, v)   => s + v, 0);
    const totalColl16 = mcoll16.reduce((s, v) => s + v, 0);
    const totalColl13 = mcoll13.reduce((s, v) => s + v, 0);
    const totalColl5  = mcoll5.reduce((s, v)  => s + v, 0);
    const totalDedu   = mdedu.reduce((s, v)   => s + v, 0);
    const totalDedu16 = mdedu16.reduce((s, v) => s + v, 0);
    const totalDedu13 = mdedu13.reduce((s, v) => s + v, 0);
    const totalDedu5  = mdedu5.reduce((s, v)  => s + v, 0);
    const totalNette  = totalColl - totalDedu;

    const TRIMESTRES = [
      { label: 'T1 (Jan–Mar)', months: [0,1,2]   },
      { label: 'T2 (Avr–Jun)', months: [3,4,5]   },
      { label: 'T3 (Jul–Sep)', months: [6,7,8]   },
      { label: 'T4 (Oct–Déc)', months: [9,10,11] }
    ];

    area.innerHTML = `
      <div style="padding:24px 0;max-width:1000px;margin:0 auto;">
        <div style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:24px;">
          Rapport TVA — ${year}
        </div>

        ${totalNette > 1000 ? `
          <div style="background:rgba(255,200,87,0.12);border:1px solid var(--accent-orange);
            border-radius:8px;padding:12px 16px;margin-bottom:20px;font-size:14px;
            color:var(--accent-orange);">
            ⚠ TVA nette à reverser : <strong>${fmt(Math.round(totalNette))}</strong>
          </div>` : ''}

        <!-- KPIs totaux -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:16px;">
          <div id="kpi-tgc-coll"></div>
          <div id="kpi-tgc-dedu"></div>
          <div id="kpi-tgc-nette"></div>
        </div>

        <!-- Ventilation par taux -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
          <!-- TVA collectée par taux -->
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:16px;">
            <div style="font-size:13px;font-weight:600;color:var(--accent-green);margin-bottom:12px;">
              TVA Collectée — détail par taux
            </div>
            ${[{t:'16%',v:totalColl16,c:'#0891B2'},{t:'13%',v:totalColl13,c:'#0D9488'},{t:'5%',v:totalColl5,c:'#7C3AED'}].map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:13px;">
              <span style="color:var(--text-secondary);">Taux ${r.t}</span>
              <span style="font-family:var(--font-mono);font-weight:600;color:${r.c};">
                ${fmt(Math.round(r.v))}
              </span>
            </div>`).join('')}
            <div style="display:flex;justify-content:space-between;margin-top:8px;
              font-weight:700;font-size:14px;">
              <span>Total collectée</span>
              <span style="font-family:var(--font-mono);color:var(--accent-green);">
                ${fmt(Math.round(totalColl))}
              </span>
            </div>
          </div>
          <!-- TVA déductible par taux -->
          <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:16px;">
            <div style="font-size:13px;font-weight:600;color:var(--accent-orange);margin-bottom:12px;">
              TVA Déductible — détail par taux
            </div>
            ${[{t:'16%',v:totalDedu16,c:'#0891B2'},{t:'13%',v:totalDedu13,c:'#0D9488'},{t:'5%',v:totalDedu5,c:'#7C3AED'}].map(r => `
            <div style="display:flex;justify-content:space-between;align-items:center;
              padding:6px 0;border-bottom:1px solid var(--border-subtle);font-size:13px;">
              <span style="color:var(--text-secondary);">Taux ${r.t}</span>
              <span style="font-family:var(--font-mono);font-weight:600;color:${r.c};">
                ${fmt(Math.round(r.v))}
              </span>
            </div>`).join('')}
            <div style="display:flex;justify-content:space-between;margin-top:8px;
              font-weight:700;font-size:14px;">
              <span>Total déductible</span>
              <span style="font-family:var(--font-mono);color:var(--accent-orange);">
                ${fmt(Math.round(totalDedu))}
              </span>
            </div>
          </div>
        </div>

        <!-- Tableau mensuel -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);
          border-radius:12px;overflow:hidden;margin-bottom:24px;">
          <div style="padding:16px 20px;font-size:14px;font-weight:600;
            color:var(--text-secondary);border-bottom:1px solid var(--border);">
            Déclaration mensuelle (tous taux confondus)
          </div>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:var(--bg-elevated);">
                <th style="${_th()}">Mois</th>
                <th style="${_th()} text-align:right;">Collectée 16%</th>
                <th style="${_th()} text-align:right;">Collectée 13%</th>
                <th style="${_th()} text-align:right;">Collectée 5%</th>
                <th style="${_th()} text-align:right;">Déductible</th>
                <th style="${_th()} text-align:right;font-weight:700;">Nette</th>
                <th style="${_th()} text-align:center;">Situation</th>
              </tr>
            </thead>
            <tbody>
              ${MOIS_LONG.map((m, i) => {
                if (mcoll[i] === 0 && mdedu[i] === 0) return '';
                const nette  = mnette[i];
                const eotrim = (i + 1) % 3 === 0;
                return `
                  <tr style="border-bottom:${eotrim ? '2px solid var(--border)' : '1px solid var(--border-subtle)'};">
                    <td style="${_td()}">${m}</td>
                    <td style="${_td()} text-align:right;font-family:var(--font-mono);
                      color:#0891B2;">${fmt(Math.round(mcoll16[i]))}</td>
                    <td style="${_td()} text-align:right;font-family:var(--font-mono);
                      color:#0D9488;">${fmt(Math.round(mcoll13[i]))}</td>
                    <td style="${_td()} text-align:right;font-family:var(--font-mono);
                      color:#7C3AED;">${fmt(Math.round(mcoll5[i]))}</td>
                    <td style="${_td()} text-align:right;font-family:var(--font-mono);
                      color:var(--accent-orange);">${fmt(Math.round(mdedu[i]))}</td>
                    <td style="${_td()} text-align:right;font-family:var(--font-mono);font-weight:700;
                      color:${nette >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)'};">
                      ${fmt(Math.round(Math.abs(nette)))}
                    </td>
                    <td style="${_td()} text-align:center;">
                      <span style="font-size:11px;padding:3px 8px;border-radius:4px;font-weight:600;
                        background:${nette > 0 ? 'rgba(255,107,107,0.15)' : 'rgba(0,212,170,0.15)'};
                        color:${nette > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">
                        ${nette > 0 ? '↑ À reverser' : '↓ Crédit'}
                      </span>
                    </td>
                  </tr>`;
              }).join('')}
              ${(mcoll.every(v => v === 0) && mdedu.every(v => v === 0))
                ? `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">
                    Aucun mouvement TVA pour ${year}</td></tr>` : ''}
            </tbody>
          </table>
        </div>

        <!-- Récap trimestriel -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);
          border-radius:12px;padding:20px;">
          <div style="font-size:14px;font-weight:600;color:var(--text-secondary);
            margin-bottom:16px;">Total trimestriel</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
            ${TRIMESTRES.map(t => {
              const coll  = t.months.reduce((s, m) => s + mcoll[m], 0);
              const dedu  = t.months.reduce((s, m) => s + mdedu[m], 0);
              const nette = coll - dedu;
              return `
                <div style="background:var(--bg-elevated);border:1px solid var(--border);
                  border-radius:8px;padding:14px;text-align:center;">
                  <div style="font-weight:700;color:var(--text-primary);
                    font-size:15px;margin-bottom:10px;">${t.label}</div>
                  <div style="font-size:12px;color:var(--text-secondary);margin-bottom:3px;">
                    Collectée
                    <span style="color:var(--accent-green);font-family:var(--font-mono);
                      font-weight:600;">${fmt(Math.round(coll))}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">
                    Déductible
                    <span style="color:var(--accent-orange);font-family:var(--font-mono);
                      font-weight:600;">${fmt(Math.round(dedu))}</span>
                  </div>
                  <div style="font-family:var(--font-mono);font-weight:700;font-size:15px;
                    color:${nette >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)'};">
                    ${nette >= 0 ? '▲ ' : '▼ '}${fmt(Math.round(Math.abs(nette)))}
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                    ${nette >= 0 ? 'À reverser' : 'Crédit d\'impôt'}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>`;

    /* KPIs */
    statCard('kpi-tgc-coll', {
      icon: '📊', value: fmt(Math.round(totalColl)),
      label: 'TVA collectée (ventes)', color: 'var(--accent-green)'
    });
    statCard('kpi-tgc-dedu', {
      icon: '🔄', value: fmt(Math.round(totalDedu)),
      label: 'TVA déductible (achats)', color: 'var(--accent-orange)'
    });
    statCard('kpi-tgc-nette', {
      icon: totalNette >= 0 ? '⬆' : '⬇',
      value: fmt(Math.round(Math.abs(totalNette))),
      label: totalNette >= 0 ? 'TVA nette à reverser' : 'Crédit de TVA',
      color: totalNette >= 0 ? 'var(--accent-red)' : 'var(--accent-blue)'
    });

    /* Export TVA — ventilé par taux */
    const tgcHdrs = ['Mois','Collectée 16%','Collectée 13%','Collectée 5%','Total Collectée','Total Déductible','TVA Nette (XPF)'];
    const tgcRows = MOIS_LONG
      .map((m, i) => (mcoll[i] || mdedu[i]) ? [
        m,
        Math.round(mcoll16[i]), Math.round(mcoll13[i]), Math.round(mcoll5[i]),
        Math.round(mcoll[i]), Math.round(mdedu[i]), Math.round(mnette[i])
      ] : null)
      .filter(Boolean);
    tgcRows.push(['TOTAL',
      Math.round(totalColl16), Math.round(totalColl13), Math.round(totalColl5),
      Math.round(totalColl), Math.round(totalDedu), Math.round(totalNette)
    ]);
    toolbar.querySelector('#tgc-csv').addEventListener('click', () => _dlCSV(`hcs-tva-${year}`, tgcHdrs, tgcRows));
    toolbar.querySelector('#tgc-xls').addEventListener('click', () => _dlXLS(`hcs-tva-${year}`, tgcHdrs, tgcRows, `TVA ${year}`));
    toolbar.querySelector('#tgc-pdf').addEventListener('click', () => _dlPDF(`Rapport TVA — ${year}`, `Exercice ${year}`, tgcHdrs, tgcRows));
  }

  /* ================================================================
     UTILITAIRES
     ================================================================ */

  /* Graphique barres groupées (2 séries) */
  function _renderGroupedBars(containerId, labels, s1, s2, lbl1, lbl2, col1, col2) {
    const el  = document.getElementById(containerId);
    if (!el) return;
    const max = Math.max(...s1, ...s2, 1);
    const H   = 120;

    el.innerHTML = `
      <div style="display:flex;gap:4px;align-items:flex-end;height:${H + 30}px;overflow-x:auto;">
        ${labels.map((lbl, i) => {
          const h1 = Math.max(2, Math.round((s1[i] / max) * H));
          const h2 = Math.max(2, Math.round((s2[i] / max) * H));
          return `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:26px;">
              <div style="display:flex;gap:2px;align-items:flex-end;height:${H}px;">
                <div title="${lbl1}: ${fmt(Math.round(s1[i]))}"
                  style="width:10px;height:${h1}px;background:${col1};border-radius:2px 2px 0 0;
                    opacity:0.85;" onmouseenter="this.style.opacity=1"
                    onmouseleave="this.style.opacity=0.85"></div>
                <div title="${lbl2}: ${fmt(Math.round(s2[i]))}"
                  style="width:10px;height:${h2}px;background:${col2};border-radius:2px 2px 0 0;
                    opacity:0.85;" onmouseenter="this.style.opacity=1"
                    onmouseleave="this.style.opacity=0.85"></div>
              </div>
              <div style="font-size:9px;color:var(--text-muted);margin-top:3px;
                text-align:center;">${_escA(lbl)}</div>
            </div>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:16px;margin-top:6px;font-size:12px;color:var(--text-secondary);">
        <span><span style="display:inline-block;width:10px;height:10px;background:${col1};
          border-radius:2px;margin-right:4px;vertical-align:middle;"></span>${lbl1}</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:${col2};
          border-radius:2px;margin-right:4px;vertical-align:middle;"></span>${lbl2}</span>
      </div>`;
  }

  /* Filtre écritures selon _state.filters */
  function _getFilteredEcritures() {
    const f = _state.filters;
    return Store.getAll('ecritures').filter(e => {
      if (f.dateFrom && e.date < f.dateFrom) return false;
      if (f.dateTo   && e.date > f.dateTo)   return false;
      if (f.compte   && !_matchesCompte(e.compte, f.compte)) return false;
      if (f.type     && e.type !== f.type)   return false;
      return true;
    });
  }

  /* Vérifie si un numéro de compte correspond (exact ou même racine 3 chiffres) */
  function _matchesCompte(eCompte, ref) {
    if (!eCompte || !ref) return false;
    return eCompte === ref || eCompte.slice(0, 3) === ref.slice(0, 3);
  }

  /* Trouve un compte dans le plan par son numéro */
  function _findCompte(numero) {
    if (!numero) return null;
    return PLAN_COMPTABLE.find(c => c.numero === numero || c.numero.slice(0, 3) === numero.slice(0, 3));
  }

  function _typeLabel(type) {
    const map = { vente:'Vente', achat:'Achat', salaire:'Salaire', tgc:'TGC', autre:'Autre' };
    return map[type] || type || '—';
  }

  function _th() {
    return 'padding:8px 12px;font-size:12px;font-weight:600;color:var(--text-secondary);' +
      'text-transform:uppercase;letter-spacing:.06em;text-align:left;';
  }
  function _td() {
    return 'padding:8px 12px;font-size:14px;color:var(--text-primary);';
  }

  function _escA(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ================================================================
     VUE : DÉPENSES & TVA
     Suivi des dépenses du magasin avec TVA 13% / 16%,
     comparaison Ventes vs Dépenses sur la période choisie.
     ================================================================ */

  /* --- Constantes de la vue Dépenses --- */
  const DEP_CATEGORIES = [
    { id: 'Matières premières',     icon: '🏭' },
    { id: 'Textile & fournitures',  icon: '🧵' },
    { id: 'Énergie & utilités',     icon: '💡' },
    { id: 'Équipement & maintenance', icon: '🛠️' },
    { id: 'Loyer & charges',        icon: '🏠' },
    { id: 'Sous-traitance',         icon: '👥' },
    { id: 'Livraison & transport',  icon: '📦' },
    { id: 'Abonnements & services', icon: '📱' },
    { id: 'Divers',                 icon: '🏪' }
  ];

  const DEP_TAUX_TVA = [0, 13, 16];

  const DEP_MODES_PAIEMENT = [
    'Virement', 'Carte', 'Espèces', 'Chèque', 'Prélèvement'
  ];

  /* État de la vue dépenses */
  const _depState = {
    periode: 'mois',       // 'semaine' | 'mois' | 'annee'
    annee:   new Date().getFullYear(),
    mois:    new Date().getMonth(),   // 0–11
    semaine: _getISOWeek(new Date()),
    filtreCategorie: '',
    filtreTVA: '',
    sortCol: 'date',
    sortAsc: false
  };

  function _getISOWeek(d) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  }

  /* --- Calculs TVA --- */
  function _calcFromHT(ht, taux) {
    const mTVA = Math.round(ht * taux / 100);
    return { montantHT: Math.round(ht), tauxTVA: taux, montantTVA: mTVA, montantTTC: Math.round(ht) + mTVA };
  }
  function _calcFromTTC(ttc, taux) {
    const ht   = Math.round(ttc / (1 + taux / 100));
    const mTVA = ttc - ht;
    return { montantHT: ht, tauxTVA: taux, montantTVA: mTVA, montantTTC: ttc };
  }

  /* --- Filtrage des dépenses selon la période --- */
  function _filtrerDepenses(depenses) {
    return depenses.filter(d => {
      if (!d.date) return false;
      const dt = new Date(d.date);
      const an = dt.getFullYear();
      const mo = dt.getMonth();

      if (_depState.periode === 'annee') return an === _depState.annee;
      if (_depState.periode === 'mois')  return an === _depState.annee && mo === _depState.mois;
      if (_depState.periode === 'semaine') {
        const wk = _getISOWeek(dt);
        return an === _depState.annee && wk === _depState.semaine;
      }
      return true;
    }).filter(d => {
      if (_depState.filtreCategorie && d.categorie !== _depState.filtreCategorie) return false;
      if (_depState.filtreTVA !== '' && String(d.tauxTVA) !== String(_depState.filtreTVA)) return false;
      return true;
    });
  }

  /* --- Filtrage des factures (ventes) pour la même période --- */
  function _filtrerVentes() {
    return (Store.getAll('factures') || []).filter(f => {
      const dt = new Date(f.date || f._createdAt || '');
      if (isNaN(dt)) return false;
      const an = dt.getFullYear();
      const mo = dt.getMonth();
      if (_depState.periode === 'annee')   return an === _depState.annee;
      if (_depState.periode === 'mois')    return an === _depState.annee && mo === _depState.mois;
      if (_depState.periode === 'semaine') return an === _depState.annee && _getISOWeek(dt) === _depState.semaine;
      return true;
    });
  }

  /* --- Label de la période affichée --- */
  function _labelPeriode() {
    const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin',
                  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    if (_depState.periode === 'annee')   return 'Année ' + _depState.annee;
    if (_depState.periode === 'mois')    return MOIS[_depState.mois] + ' ' + _depState.annee;
    if (_depState.periode === 'semaine') return 'Semaine ' + _depState.semaine + ' · ' + _depState.annee;
    return '';
  }

  /* === RENDU PRINCIPAL === */
  function _renderDepenses(toolbar, area) {

    /* ---- Toolbar ---- */
    toolbar.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="Accounting._depOpenForm(null)">
        + Nouvelle dépense
      </button>
      <button class="btn btn-ghost btn-sm" onclick="Accounting._depExportCSV()" title="Export CSV">📥 CSV</button>
      <button class="btn btn-ghost btn-sm" onclick="Accounting._depExportXLS()" title="Export Excel / Google Sheets">📊 XLS</button>
    `;

    /* ---- Shell de la page ---- */
    area.innerHTML = `<div style="padding:20px;" id="dep-page">

      <!-- Sélecteur de période -->
      <div class="card" style="padding:14px 18px;margin-bottom:18px;
           display:flex;align-items:center;gap:12px;flex-wrap:wrap;">

        <!-- Onglets période -->
        <div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
          ${['semaine','mois','annee'].map(p => `
            <button id="dep-tab-${p}"
              onclick="Accounting._depSetPeriode('${p}')"
              style="padding:6px 16px;font-size:13px;font-weight:600;border:none;cursor:pointer;
                transition:all .15s;
                background:${_depState.periode===p?'var(--accent-blue)':'transparent'};
                color:${_depState.periode===p?'#fff':'var(--text-secondary)'};">
              ${{semaine:'Semaine',mois:'Mois',annee:'Année'}[p]}
            </button>
          `).join('')}
        </div>

        <!-- Navigateur de période -->
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="btn btn-ghost btn-sm" onclick="Accounting._depNavPeriode(-1)">◀</button>
          <span id="dep-label-periode" style="font-weight:600;font-size:14px;min-width:160px;
            text-align:center;">${_labelPeriode()}</span>
          <button class="btn btn-ghost btn-sm" onclick="Accounting._depNavPeriode(1)">▶</button>
        </div>

        <!-- Filtres -->
        <div style="display:flex;gap:8px;margin-left:auto;flex-wrap:wrap;">
          <select id="dep-flt-cat" class="form-control"
            style="height:32px;font-size:13px;width:180px;"
            onchange="Accounting._depSetFilter('categorie', this.value)">
            <option value="">Toutes catégories</option>
            ${DEP_CATEGORIES.map(c =>
              `<option value="${c.id}" ${_depState.filtreCategorie===c.id?'selected':''}>
                ${c.icon} ${c.id}
              </option>`
            ).join('')}
          </select>
          <select id="dep-flt-tva" class="form-control"
            style="height:32px;font-size:13px;width:130px;"
            onchange="Accounting._depSetFilter('tvA', this.value)">
            <option value="">Tous taux TVA</option>
            <option value="0"  ${_depState.filtreTVA==='0'?'selected':''}>TVA 0%</option>
            <option value="13" ${_depState.filtreTVA==='13'?'selected':''}>TVA 13%</option>
            <option value="16" ${_depState.filtreTVA==='16'?'selected':''}>TVA 16%</option>
          </select>
        </div>
      </div>

      <!-- Grille KPI -->
      <div id="dep-kpis" style="display:grid;grid-template-columns:repeat(5,1fr);
           gap:12px;margin-bottom:18px;"></div>

      <!-- Barre comparaison Ventes vs Dépenses -->
      <div id="dep-compare" style="margin-bottom:18px;"></div>

      <!-- Deux colonnes : table + synthèse -->
      <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start;">

        <!-- Table dépenses -->
        <div class="card" style="overflow:hidden;">
          <div class="card-header" style="padding:14px 18px;border-bottom:1px solid var(--border);
               display:flex;align-items:center;justify-content:space-between;">
            <div class="card-title">Détail des dépenses</div>
            <span id="dep-count" style="font-size:12px;color:var(--text-muted);"></span>
          </div>
          <div id="dep-table-wrap" style="overflow-x:auto;"></div>
        </div>

        <!-- Panneaux synthèse -->
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div class="card" style="padding:18px;" id="dep-synthese-cat"></div>
          <div class="card" style="padding:18px;" id="dep-synthese-tva"></div>
        </div>
      </div>

    </div>`;

    _depRefresh();
  }

  /* --- Refresh complet de la vue --- */
  function _depRefresh() {
    const toutes  = Store.getAll('depenses') || [];
    const filtrees = _filtrerDepenses(toutes);
    const ventes   = _filtrerVentes();

    _depRenderKPIs(filtrees, ventes);
    _depRenderCompare(filtrees, ventes);
    _depRenderTable(filtrees);
    _depRenderSyntheseCategories(filtrees);
    _depRenderSyntheseTVA(filtrees);

    const label = document.getElementById('dep-label-periode');
    if (label) label.textContent = _labelPeriode();
    const cnt = document.getElementById('dep-count');
    if (cnt) cnt.textContent = filtrees.length + ' dépense' + (filtrees.length>1?'s':'');
  }

  /* --- KPI cards --- */
  function _depRenderKPIs(deps, ventes) {
    const el = document.getElementById('dep-kpis');
    if (!el) return;

    const totalHT   = deps.reduce((s,d) => s + (d.montantHT||0), 0);
    const tva13     = deps.filter(d=>d.tauxTVA===13).reduce((s,d) => s+(d.montantTVA||0), 0);
    const tva16     = deps.filter(d=>d.tauxTVA===16).reduce((s,d) => s+(d.montantTVA||0), 0);
    const totalTTC  = deps.reduce((s,d) => s + (d.montantTTC||0), 0);
    const totalVentes = ventes.reduce((s,f) => s+(f.totalTTC||0), 0);

    el.innerHTML = [
      { icon:'💸', val: totalHT,     label:'Total HT',     color:'#525C7A', fmt:true },
      { icon:'🔵', val: tva13,       label:'TVA 13%',      color:'#0891B2', fmt:true },
      { icon:'🟣', val: tva16,       label:'TVA 16%',      color:'#7C3AED', fmt:true },
      { icon:'🧾', val: totalTTC,    label:'Total TTC',    color:'#DC2626', fmt:true },
      { icon:'📊', val: totalVentes, label:'Ventes TTC',   color:'#16A34A', fmt:true }
    ].map(k => `
      <div class="card" style="padding:14px 16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <span style="font-size:20px;">${k.icon}</span>
          <span style="font-size:11px;font-weight:600;color:var(--text-muted);
            text-transform:uppercase;letter-spacing:.06em;">${k.label}</span>
        </div>
        <div style="font-size:20px;font-weight:700;color:${k.color};
          font-family:var(--font-mono);">${fmt(k.val)}</div>
      </div>
    `).join('');
  }

  /* --- Barre comparaison Ventes / Dépenses --- */
  function _depRenderCompare(deps, ventes) {
    const el = document.getElementById('dep-compare');
    if (!el) return;

    const totalDep  = deps.reduce((s,d) => s+(d.montantTTC||0), 0);
    const totalVte  = ventes.reduce((s,f) => s+(f.totalTTC||0), 0);
    const resultat  = totalVte - totalDep;
    const marge     = totalVte > 0 ? Math.round(resultat / totalVte * 100) : 0;
    const max       = Math.max(totalDep, totalVte, 1);
    const pctVte    = Math.round(totalVte / max * 100);
    const pctDep    = Math.round(totalDep / max * 100);
    const isPositif = resultat >= 0;

    el.innerHTML = `
      <div class="card" style="padding:18px 22px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-weight:700;font-size:15px;">Ventes vs Dépenses · ${_labelPeriode()}</div>
          <div style="display:flex;align-items:center;gap:16px;">
            <span style="font-size:13px;font-weight:700;
              color:${isPositif?'#16A34A':'#DC2626'};">
              ${isPositif?'Bénéfice':'Déficit'} :
              <span style="font-family:var(--font-mono);">${fmt(Math.abs(resultat))}</span>
            </span>
            <span class="badge" style="
              background:${isPositif?'#D1FAE5':'#FEF2F2'};
              color:${isPositif?'#065F46':'#B91C1C'};
              border:1px solid ${isPositif?'#A7F3D0':'#FECACA'};
              font-size:13px;padding:4px 12px;">
              Marge ${marge}%
            </span>
          </div>
        </div>

        <!-- Barres comparatives -->
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:12px;font-weight:600;color:#16A34A;">
                📈 Ventes TTC
              </span>
              <span style="font-size:13px;font-weight:700;font-family:var(--font-mono);
                color:#16A34A;">${fmt(totalVte)}</span>
            </div>
            <div style="height:12px;background:var(--bg-base);border-radius:6px;overflow:hidden;">
              <div style="height:100%;width:${pctVte}%;background:linear-gradient(90deg,#16A34A,#4ADE80);
                border-radius:6px;transition:width .4s ease;"></div>
            </div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:12px;font-weight:600;color:#DC2626;">
                💸 Dépenses TTC
              </span>
              <span style="font-size:13px;font-weight:700;font-family:var(--font-mono);
                color:#DC2626;">${fmt(totalDep)}</span>
            </div>
            <div style="height:12px;background:var(--bg-base);border-radius:6px;overflow:hidden;">
              <div style="height:100%;width:${pctDep}%;background:linear-gradient(90deg,#DC2626,#F87171);
                border-radius:6px;transition:width .4s ease;"></div>
            </div>
          </div>
        </div>

        <!-- Détail ventes par statut -->
        <div style="display:flex;gap:20px;margin-top:14px;padding-top:12px;
             border-top:1px solid var(--border);flex-wrap:wrap;">
          ${[
            { label:'Factures payées', statuts:['Payé','Payée'], color:'#16A34A' },
            { label:'En attente', statuts:['En attente','Envoyé','Brouillon'], color:'#D97706' },
            { label:'Annulées', statuts:['Annulé','Annulée'], color:'#8C96B0' }
          ].map(g => {
            const total = ventes.filter(f=>g.statuts.includes(f.statut)).reduce((s,f)=>s+(f.totalTTC||0),0);
            return `<div style="font-size:12px;color:var(--text-secondary);">
              <span style="color:${g.color};font-weight:600;">●</span>
              ${g.label} : <strong style="font-family:var(--font-mono);color:${g.color};">${fmt(total)}</strong>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  /* --- Table des dépenses --- */
  function _depRenderTable(deps) {
    const wrap = document.getElementById('dep-table-wrap');
    if (!wrap) return;

    if (!deps.length) {
      wrap.innerHTML = `
        <div class="table-empty" style="padding:48px;">
          <div style="font-size:36px;margin-bottom:12px;">💸</div>
          <p>Aucune dépense sur cette période</p>
          <button class="btn btn-primary btn-sm" style="margin-top:12px;"
            onclick="Accounting._depOpenForm(null)">+ Ajouter une dépense</button>
        </div>`;
      return;
    }

    /* Tri */
    const sorted = [...deps].sort((a, b) => {
      let va = a[_depState.sortCol], vb = b[_depState.sortCol];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      return _depState.sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    const SH = (col, label) => `
      <th onclick="Accounting._depSort('${col}')" style="cursor:pointer;user-select:none;
        padding:10px 12px;font-size:11px;font-weight:700;color:var(--text-secondary);
        text-transform:uppercase;letter-spacing:.07em;white-space:nowrap;
        background:var(--bg-base);">
        ${label}
        ${_depState.sortCol===col ? (_depState.sortAsc?'▲':'▼') : ''}
      </th>`;

    const TVA_COLOR = { 0:'#8C96B0', 13:'#0891B2', 16:'#7C3AED' };
    const CAT_ICON  = Object.fromEntries(DEP_CATEGORIES.map(c=>[c.id, c.icon]));

    wrap.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          ${SH('date','Date')}
          ${SH('description','Description')}
          ${SH('categorie','Catégorie')}
          ${SH('modePaiement','Paiement')}
          ${SH('montantHT','HT')}
          ${SH('tauxTVA','TVA %')}
          ${SH('montantTVA','Montant TVA')}
          ${SH('montantTTC','TTC')}
          <th style="width:60px;background:var(--bg-base);"></th>
        </tr></thead>
        <tbody>
          ${sorted.map(d => `
            <tr style="border-bottom:1px solid var(--border-light);cursor:pointer;"
              onmouseenter="this.style.background='var(--bg-hover)'"
              onmouseleave="this.style.background=''"
              onclick="Accounting._depOpenForm('${d.id}')">
              <td style="padding:10px 12px;font-size:13px;color:var(--text-muted);
                font-family:var(--font-mono);white-space:nowrap;">
                ${fmtDate ? fmtDate(d.date) : d.date}
              </td>
              <td style="padding:10px 12px;max-width:220px;">
                <div style="font-size:13px;font-weight:500;color:var(--text-primary);
                  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                  ${_escA(d.description)}
                </div>
                ${d.reference ? `<div style="font-size:11px;color:var(--text-muted);">
                  Réf. ${_escA(d.reference)}</div>` : ''}
              </td>
              <td style="padding:10px 12px;">
                <span style="font-size:12px;color:var(--text-secondary);">
                  ${CAT_ICON[d.categorie]||'📌'} ${_escA(d.categorie)}
                </span>
              </td>
              <td style="padding:10px 12px;font-size:12px;color:var(--text-muted);">
                ${_escA(d.modePaiement||'—')}
              </td>
              <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);
                font-size:13px;color:var(--text-primary);">
                ${fmt(d.montantHT)}
              </td>
              <td style="padding:10px 12px;text-align:center;">
                <span class="badge" style="font-size:11px;
                  background:${TVA_COLOR[d.tauxTVA]||'#8C96B0'}18;
                  color:${TVA_COLOR[d.tauxTVA]||'#8C96B0'};
                  border:1px solid ${TVA_COLOR[d.tauxTVA]||'#8C96B0'}40;">
                  ${d.tauxTVA}%
                </span>
              </td>
              <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);
                font-size:13px;color:${TVA_COLOR[d.tauxTVA]||'#8C96B0'};">
                ${fmt(d.montantTVA)}
              </td>
              <td style="padding:10px 12px;text-align:right;font-family:var(--font-mono);
                font-weight:700;font-size:13px;color:var(--accent-red);">
                ${fmt(d.montantTTC)}
              </td>
              <td style="padding:10px 12px;text-align:center;"
                onclick="event.stopPropagation();">
                <button title="Supprimer" style="background:none;border:none;cursor:pointer;
                  font-size:14px;color:var(--text-muted);"
                  onclick="Accounting._depDelete('${d.id}')">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
        <!-- TOTAUX -->
        <tfoot>
          <tr style="background:var(--bg-base);border-top:2px solid var(--border);">
            <td colspan="4" style="padding:12px;font-weight:700;font-size:13px;
              color:var(--text-primary);">TOTAUX (${sorted.length} entrées)</td>
            <td style="padding:12px;text-align:right;font-family:var(--font-mono);
              font-weight:700;font-size:14px;color:var(--text-primary);">
              ${fmt(sorted.reduce((s,d)=>s+(d.montantHT||0),0))}
            </td>
            <td></td>
            <td style="padding:12px;text-align:right;font-family:var(--font-mono);
              font-weight:700;font-size:14px;color:#0891B2;">
              ${fmt(sorted.reduce((s,d)=>s+(d.montantTVA||0),0))}
            </td>
            <td style="padding:12px;text-align:right;font-family:var(--font-mono);
              font-weight:700;font-size:14px;color:var(--accent-red);">
              ${fmt(sorted.reduce((s,d)=>s+(d.montantTTC||0),0))}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  /* --- Synthèse par catégorie --- */
  function _depRenderSyntheseCategories(deps) {
    const el = document.getElementById('dep-synthese-cat');
    if (!el) return;

    /* Grouper par catégorie */
    const groupes = {};
    deps.forEach(d => {
      const cat = d.categorie || 'Divers';
      if (!groupes[cat]) groupes[cat] = { ht:0, tva:0, ttc:0, count:0 };
      groupes[cat].ht    += d.montantHT  || 0;
      groupes[cat].tva   += d.montantTVA || 0;
      groupes[cat].ttc   += d.montantTTC || 0;
      groupes[cat].count += 1;
    });

    const totalTTC = deps.reduce((s,d)=>s+(d.montantTTC||0),0) || 1;
    const CAT_ICON = Object.fromEntries(DEP_CATEGORIES.map(c=>[c.id,c.icon]));

    const rows = Object.entries(groupes)
      .sort(([,a],[,b]) => b.ttc - a.ttc);

    el.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);
        text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px;">
        Répartition par catégorie
      </div>
      ${rows.length === 0
        ? '<div style="color:var(--text-muted);font-size:13px;">Aucune donnée</div>'
        : rows.map(([cat, g]) => {
            const pct = Math.round(g.ttc / totalTTC * 100);
            return `
              <div style="margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                  <span style="font-size:12px;font-weight:500;">
                    ${CAT_ICON[cat]||'📌'} ${_escA(cat)}
                    <span style="color:var(--text-muted);font-weight:400;">(${g.count})</span>
                  </span>
                  <span style="font-size:12px;font-weight:700;font-family:var(--font-mono);">
                    ${fmt(g.ttc)}
                  </span>
                </div>
                <div style="height:6px;background:var(--bg-base);border-radius:3px;">
                  <div style="height:100%;width:${pct}%;background:var(--accent-blue);
                    border-radius:3px;"></div>
                </div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                  HT ${fmt(g.ht)} · TVA ${fmt(g.tva)} · ${pct}%
                </div>
              </div>`;
          }).join('')
      }
    `;
  }

  /* --- Synthèse par taux de TVA --- */
  function _depRenderSyntheseTVA(deps) {
    const el = document.getElementById('dep-synthese-tva');
    if (!el) return;

    const taux0  = deps.filter(d=>d.tauxTVA===0);
    const taux13 = deps.filter(d=>d.tauxTVA===13);
    const taux16 = deps.filter(d=>d.tauxTVA===16);

    const row = (label, color, items) => {
      const ht  = items.reduce((s,d)=>s+(d.montantHT||0),0);
      const tva = items.reduce((s,d)=>s+(d.montantTVA||0),0);
      const ttc = items.reduce((s,d)=>s+(d.montantTTC||0),0);
      return `
        <div style="padding:10px 0;border-bottom:1px solid var(--border-light);">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span class="badge" style="background:${color}18;color:${color};
              border:1px solid ${color}40;">${label}</span>
            <span style="font-size:11px;color:var(--text-muted);">${items.length} dépense${items.length>1?'s':''}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">
            <div style="font-size:11px;">
              <div style="color:var(--text-muted);margin-bottom:1px;">HT</div>
              <div style="font-family:var(--font-mono);font-weight:600;">${fmt(ht)}</div>
            </div>
            <div style="font-size:11px;">
              <div style="color:${color};margin-bottom:1px;">TVA</div>
              <div style="font-family:var(--font-mono);font-weight:600;color:${color};">${fmt(tva)}</div>
            </div>
            <div style="font-size:11px;">
              <div style="color:var(--text-muted);margin-bottom:1px;">TTC</div>
              <div style="font-family:var(--font-mono);font-weight:700;">${fmt(ttc)}</div>
            </div>
          </div>
        </div>`;
    };

    const totalTVA = deps.reduce((s,d)=>s+(d.montantTVA||0),0);
    const totalHT  = deps.reduce((s,d)=>s+(d.montantHT||0),0);
    const totalTTC = deps.reduce((s,d)=>s+(d.montantTTC||0),0);

    el.innerHTML = `
      <div style="font-size:12px;font-weight:700;color:var(--text-muted);
        text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px;">
        Synthèse TVA
      </div>
      ${row('TVA 0%',  '#8C96B0', taux0)}
      ${row('TVA 13%', '#0891B2', taux13)}
      ${row('TVA 16%', '#7C3AED', taux16)}
      <div style="margin-top:12px;padding:10px;background:var(--bg-base);
        border-radius:var(--radius-md);">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">
          <div style="font-size:12px;">
            <div style="color:var(--text-muted);font-size:10px;margin-bottom:2px;">TOTAL HT</div>
            <div style="font-family:var(--font-mono);font-weight:700;">${fmt(totalHT)}</div>
          </div>
          <div style="font-size:12px;">
            <div style="color:#0891B2;font-size:10px;margin-bottom:2px;">TOTAL TVA</div>
            <div style="font-family:var(--font-mono);font-weight:700;color:#0891B2;">${fmt(totalTVA)}</div>
          </div>
          <div style="font-size:12px;">
            <div style="color:var(--accent-red);font-size:10px;margin-bottom:2px;">TOTAL TTC</div>
            <div style="font-family:var(--font-mono);font-weight:700;color:var(--accent-red);">${fmt(totalTTC)}</div>
          </div>
        </div>
      </div>
    `;
  }

  /* ================================================================
     FORMULAIRE DÉPENSE (création + édition)
     ================================================================ */
  function _depOpenForm(depId) {
    const dep    = depId ? Store.getById('depenses', depId) : null;
    const isEdit = !!dep;
    const today  = new Date().toISOString().slice(0, 10);
    const CAT_ICON = Object.fromEntries(DEP_CATEGORIES.map(c=>[c.id,c.icon]));

    openModal(`
      <div class="modal-title" style="margin-bottom:16px;">
        ${isEdit ? '✏️ Modifier la dépense' : '➕ Nouvelle dépense'}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">

        <!-- Date -->
        <div class="form-group">
          <label class="form-label">Date <span style="color:var(--accent-red);">*</span></label>
          <input type="date" id="dep-f-date" class="form-control"
            value="${dep?.date || today}" required />
        </div>

        <!-- Mode de paiement -->
        <div class="form-group">
          <label class="form-label">Mode de paiement</label>
          <select id="dep-f-mode" class="form-control">
            ${DEP_MODES_PAIEMENT.map(m =>
              `<option ${dep?.modePaiement===m?'selected':''}>${m}</option>`
            ).join('')}
          </select>
        </div>

        <!-- Description -->
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Description <span style="color:var(--accent-red);">*</span></label>
          <input type="text" id="dep-f-desc" class="form-control"
            value="${_escA(dep?.description||'')}"
            placeholder="Ex: Encres DTF CMYK — DTF Supplies USA" required />
        </div>

        <!-- Catégorie -->
        <div class="form-group">
          <label class="form-label">Catégorie <span style="color:var(--accent-red);">*</span></label>
          <select id="dep-f-cat" class="form-control">
            ${DEP_CATEGORIES.map(c =>
              `<option value="${c.id}" ${dep?.categorie===c.id?'selected':''}>
                ${c.icon} ${c.id}
              </option>`
            ).join('')}
          </select>
        </div>

        <!-- Référence -->
        <div class="form-group">
          <label class="form-label">Référence</label>
          <input type="text" id="dep-f-ref" class="form-control"
            value="${_escA(dep?.reference||'')}" placeholder="N° facture fournisseur…" />
        </div>

        <!-- Saisie montant -->
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label" style="margin-bottom:8px;">Saisir le montant</label>
          <div style="display:flex;border:1px solid var(--border);border-radius:var(--radius-md);
            overflow:hidden;">
            <button id="dep-f-mode-ht" onclick="Accounting._depToggleSaisie('HT')"
              style="flex:1;padding:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;
              background:var(--accent-blue);color:#fff;transition:all .15s;">
              Saisir HT
            </button>
            <button id="dep-f-mode-ttc" onclick="Accounting._depToggleSaisie('TTC')"
              style="flex:1;padding:8px;border:none;cursor:pointer;font-weight:600;font-size:13px;
              background:transparent;color:var(--text-secondary);transition:all .15s;">
              Saisir TTC
            </button>
          </div>
        </div>

        <!-- Taux TVA -->
        <div class="form-group">
          <label class="form-label">Taux TVA <span style="color:var(--accent-red);">*</span></label>
          <select id="dep-f-taux" class="form-control" onchange="Accounting._depRecalc()">
            ${DEP_TAUX_TVA.map(t =>
              `<option value="${t}" ${dep?.tauxTVA===t?'selected':''}>${t}%</option>`
            ).join('')}
          </select>
        </div>

        <!-- Montant saisi (HT par défaut) -->
        <div class="form-group">
          <label class="form-label" id="dep-f-label-montant">Montant HT (XPF) *</label>
          <input type="number" id="dep-f-montant" class="form-control"
            value="${dep?.montantHT||''}" min="0" step="1"
            oninput="Accounting._depRecalc()" placeholder="0" required />
        </div>

        <!-- Résultats calculés -->
        <div style="grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);
          gap:10px;padding:14px;background:var(--bg-base);border-radius:var(--radius-lg);">
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px;">MONTANT HT</div>
            <div id="dep-f-res-ht" style="font-size:18px;font-weight:700;
              font-family:var(--font-mono);">${dep ? fmt(dep.montantHT) : '—'}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;color:#0891B2;margin-bottom:4px;">MONTANT TVA</div>
            <div id="dep-f-res-tva" style="font-size:18px;font-weight:700;
              font-family:var(--font-mono);color:#0891B2;">${dep ? fmt(dep.montantTVA) : '—'}</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:11px;color:var(--accent-red);margin-bottom:4px;">TOTAL TTC</div>
            <div id="dep-f-res-ttc" style="font-size:18px;font-weight:700;
              font-family:var(--font-mono);color:var(--accent-red);">${dep ? fmt(dep.montantTTC) : '—'}</div>
          </div>
        </div>

        <!-- Notes -->
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Notes</label>
          <textarea id="dep-f-notes" class="form-control" rows="2"
            placeholder="Commentaire optionnel…">${_escA(dep?.notes||'')}</textarea>
        </div>

      </div>

      <!-- Erreur -->
      <div id="dep-f-error" style="display:none;margin-top:10px;padding:10px;
        background:#FEF2F2;border:1px solid #FECACA;border-radius:var(--radius-md);
        color:#B91C1C;font-size:13px;"></div>

      <!-- Actions -->
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;
        padding-top:14px;border-top:1px solid var(--border);">
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary btn-sm"
          onclick="Accounting._depSave('${depId||''}')">
          ${isEdit ? '💾 Mettre à jour' : '✅ Enregistrer'}
        </button>
      </div>
    `);

    /* Mode saisie par défaut : HT */
    window._depSaisieMode = 'HT';
    if (dep) _depRecalc();
  }

  /* Toggle HT / TTC */
  function _depToggleSaisie(mode) {
    window._depSaisieMode = mode;
    const btnHT  = document.getElementById('dep-f-mode-ht');
    const btnTTC = document.getElementById('dep-f-mode-ttc');
    const label  = document.getElementById('dep-f-label-montant');
    const input  = document.getElementById('dep-f-montant');

    if (btnHT)  { btnHT.style.background  = mode==='HT'  ? 'var(--accent-blue)' : 'transparent';
                  btnHT.style.color        = mode==='HT'  ? '#fff' : 'var(--text-secondary)'; }
    if (btnTTC) { btnTTC.style.background = mode==='TTC' ? 'var(--accent-blue)' : 'transparent';
                  btnTTC.style.color       = mode==='TTC' ? '#fff' : 'var(--text-secondary)'; }
    if (label)  label.textContent = `Montant ${mode} (XPF) *`;
    if (input)  { input.value = ''; input.focus(); }
    _depRecalc();
  }

  /* Recalcul en temps réel */
  function _depRecalc() {
    const taux  = Number(document.getElementById('dep-f-taux')?.value || 0);
    const val   = Number(document.getElementById('dep-f-montant')?.value || 0);
    const mode  = window._depSaisieMode || 'HT';

    const res = mode === 'HT' ? _calcFromHT(val, taux) : _calcFromTTC(val, taux);

    const rHT  = document.getElementById('dep-f-res-ht');
    const rTVA = document.getElementById('dep-f-res-tva');
    const rTTC = document.getElementById('dep-f-res-ttc');
    if (rHT)  rHT.textContent  = val > 0 ? fmt(res.montantHT)  : '—';
    if (rTVA) rTVA.textContent = val > 0 ? fmt(res.montantTVA) : '—';
    if (rTTC) rTTC.textContent = val > 0 ? fmt(res.montantTTC) : '—';
  }

  /* Sauvegarde */
  function _depSave(depId) {
    const errEl = document.getElementById('dep-f-error');
    const show  = (m) => { if (errEl) { errEl.textContent=m; errEl.style.display='block'; } };

    const date  = document.getElementById('dep-f-date')?.value;
    const desc  = document.getElementById('dep-f-desc')?.value.trim();
    const cat   = document.getElementById('dep-f-cat')?.value;
    const taux  = Number(document.getElementById('dep-f-taux')?.value || 0);
    const val   = Number(document.getElementById('dep-f-montant')?.value || 0);
    const mode  = window._depSaisieMode || 'HT';
    const modPmt= document.getElementById('dep-f-mode')?.value;
    const ref   = document.getElementById('dep-f-ref')?.value.trim();
    const notes = document.getElementById('dep-f-notes')?.value.trim();

    if (!date) return show('La date est obligatoire.');
    if (!desc) return show('La description est obligatoire.');
    if (!val || val <= 0) return show('Le montant doit être supérieur à 0.');

    const calc = mode === 'HT' ? _calcFromHT(val, taux) : _calcFromTTC(val, taux);
    const record = { date, description: desc, categorie: cat, ...calc,
                     modePaiement: modPmt, reference: ref, notes };

    if (depId) {
      Store.update('depenses', depId, record);
      Store.addAuditLog(`Modifié dépense : ${desc}`, 'comptabilite', { depId });
      if (typeof toast === 'function') toast('Dépense mise à jour.', 'success');
    } else {
      Store.create('depenses', record);
      Store.addAuditLog(`Créé dépense : ${desc}`, 'comptabilite');
      if (typeof toast === 'function') toast('Dépense enregistrée.', 'success');
    }

    closeModal();
    _depRefresh();
  }

  /* Suppression */
  function _depDelete(depId) {
    const dep = Store.getById('depenses', depId);
    if (!dep) return;
    if (!confirm(`Supprimer "${dep.description}" ?\nCette action est irréversible.`)) return;
    Store.remove('depenses', depId);
    Store.addAuditLog(`Supprimé dépense : ${dep.description}`, 'comptabilite');
    if (typeof toast === 'function') toast('Dépense supprimée.', 'warning');
    _depRefresh();
  }

  /* Navigation période */
  function _depSetPeriode(p) {
    _depState.periode = p;
    /* Reset les onglets visuellement */
    ['semaine','mois','annee'].forEach(t => {
      const btn = document.getElementById('dep-tab-' + t);
      if (btn) {
        btn.style.background = t===p ? 'var(--accent-blue)' : 'transparent';
        btn.style.color      = t===p ? '#fff' : 'var(--text-secondary)';
      }
    });
    _depRefresh();
  }

  function _depNavPeriode(dir) {
    if (_depState.periode === 'annee') {
      _depState.annee += dir;
    } else if (_depState.periode === 'mois') {
      _depState.mois += dir;
      if (_depState.mois < 0)  { _depState.mois = 11; _depState.annee--; }
      if (_depState.mois > 11) { _depState.mois = 0;  _depState.annee++; }
    } else if (_depState.periode === 'semaine') {
      _depState.semaine += dir;
      if (_depState.semaine < 1)  { _depState.annee--; _depState.semaine = 52; }
      if (_depState.semaine > 52) { _depState.annee++; _depState.semaine = 1;  }
    }
    _depRefresh();
  }

  function _depSetFilter(type, val) {
    if (type === 'categorie') _depState.filtreCategorie = val;
    if (type === 'tvA')       _depState.filtreTVA       = val;
    _depRefresh();
  }

  function _depSort(col) {
    if (_depState.sortCol === col) _depState.sortAsc = !_depState.sortAsc;
    else { _depState.sortCol = col; _depState.sortAsc = true; }
    _depRefresh();
  }

  /* Export CSV */
  function _depExportCSV() {
    const deps = _filtrerDepenses(Store.getAll('depenses') || []);
    const headers = ['Date','Description','Catégorie','Mode paiement','Référence',
                     'HT (XPF)','Taux TVA (%)','TVA (XPF)','TTC (XPF)','Notes'];
    const rows = deps.map(d => [
      d.date, `"${(d.description||'').replace(/"/g,'""')}"`,
      d.categorie, d.modePaiement, d.reference,
      d.montantHT, d.tauxTVA, d.montantTVA, d.montantTTC,
      `"${(d.notes||'').replace(/"/g,'""')}"`
    ].join(';'));

    const csv  = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `hcs-depenses-${_labelPeriode().replace(/ /g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    if (typeof toast === 'function') toast('Export CSV téléchargé.', 'success');
  }

  /* Export XLS (Excel / Google Sheets) */
  function _depExportXLS() {
    const deps = _filtrerDepenses(Store.getAll('depenses') || []);
    const headers = ['Date','Description','Catégorie','Mode paiement','Référence',
                     'HT (XPF)','Taux TVA (%)','TVA (XPF)','TTC (XPF)','Notes'];
    const rows = deps.map(d => [
      d.date, d.description || '', d.categorie || '', d.modePaiement || '',
      d.reference || '',
      d.montantHT  || 0, d.tauxTVA  || 0,
      d.montantTVA || 0, d.montantTTC || 0,
      d.notes || ''
    ]);
    exportXLS(
      `hcs-depenses-${_labelPeriode().replace(/ /g,'-')}`,
      headers, rows, 'Dépenses'
    );
    if (typeof toast === 'function') toast('Export XLS téléchargé.', 'success');
  }

  /* ================================================================
     API PUBLIQUE
     ================================================================ */
  /* ================================================================
     VUE : TABLEAU DE BORD COMPTABILITÉ
     Vue principale — KPIs + dépenses + analyse + assistant coach
     ================================================================ */

  /* État période du tableau de bord */
  const _tbState = {
    periode: 'mois',
    annee:   new Date().getFullYear(),
    mois:    new Date().getMonth()
  };

  const _MOIS_LONG = ['Janvier','Février','Mars','Avril','Mai','Juin',
                      'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  const _MOIS_C    = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  /* Filtre les factures selon la période courante du tableau de bord */
  function _tbFiltreVentes(toutes) {
    return (toutes || Store.getAll('factures')).filter(f => {
      const dt = new Date(f.date || f._createdAt || '');
      if (isNaN(dt)) return false;
      if (_tbState.periode === 'annee') return dt.getFullYear() === _tbState.annee;
      return dt.getFullYear() === _tbState.annee && dt.getMonth() === _tbState.mois;
    });
  }

  /* Filtre les dépenses selon la période courante du tableau de bord */
  function _tbFiltreDepenses(toutes) {
    return (toutes || Store.getAll('depenses')).filter(d => {
      const dt = new Date(d.date || '');
      if (isNaN(dt)) return false;
      if (_tbState.periode === 'annee') return dt.getFullYear() === _tbState.annee;
      return dt.getFullYear() === _tbState.annee && dt.getMonth() === _tbState.mois;
    });
  }

  /* Filtre mois précédent (pour comparaison) */
  function _tbFiltrePrecedent(toutes, type) {
    let an = _tbState.annee, mo = _tbState.mois - 1;
    if (mo < 0) { mo = 11; an--; }
    const getter = type === 'ventes'
      ? (toutes || Store.getAll('factures'))
      : (toutes || Store.getAll('depenses'));
    return getter.filter(x => {
      const dt = new Date(x.date || x._createdAt || '');
      if (isNaN(dt)) return false;
      if (_tbState.periode === 'annee') return dt.getFullYear() === an - 1;
      return dt.getFullYear() === an && dt.getMonth() === mo;
    });
  }

  function _tbLabelPeriode() {
    if (_tbState.periode === 'annee') return 'Année ' + _tbState.annee;
    return _MOIS_LONG[_tbState.mois] + ' ' + _tbState.annee;
  }

  /* Render principal du tableau de bord */
  function _renderTableauBord(toolbar, area) {
    /* — Toolbar — */
    toolbar.innerHTML = `
      <div style="display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden;">
        ${['mois','annee'].map(p => `
          <button onclick="Accounting._tbSetPeriode('${p}')"
            style="padding:5px 14px;font-size:13px;font-weight:600;border:none;cursor:pointer;transition:all .15s;
              background:${_tbState.periode===p?'var(--accent-blue)':'transparent'};
              color:${_tbState.periode===p?'#fff':'var(--text-secondary)'};">
            ${{mois:'Ce mois',annee:'Cette année'}[p]}
          </button>`).join('')}
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button class="btn btn-ghost btn-sm" onclick="Accounting._tbNavPeriode(-1)">◀</button>
        <span style="font-size:13px;font-weight:600;min-width:130px;text-align:center;">
          ${_tbLabelPeriode()}
        </span>
        <button class="btn btn-ghost btn-sm" onclick="Accounting._tbNavPeriode(1)">▶</button>
      </div>`;

    /* — Données — */
    const allFacs  = Store.getAll('factures');
    const allDeps  = Store.getAll('depenses');
    const facs     = _tbFiltreVentes(allFacs);
    const deps     = _tbFiltreDepenses(allDeps);
    const facsPrev = _tbFiltrePrecedent(allFacs, 'ventes');
    const depsPrev = _tbFiltrePrecedent(allDeps, 'depenses');

    const ca       = facs.reduce((s, f) => s + (f.totalTTC || 0), 0);
    const caHT     = facs.reduce((s, f) => s + (f.totalHT  || 0), 0);
    const caPrev   = facsPrev.reduce((s, f) => s + (f.totalTTC || 0), 0);
    const depTTC   = deps.reduce((s, d) => s + (d.montantTTC || d.montantHT || 0), 0);
    const depPrev  = depsPrev.reduce((s, d) => s + (d.montantTTC || d.montantHT || 0), 0);
    const marge    = ca - depTTC;
    const tauxMarge= ca > 0 ? Math.round((marge / ca) * 100) : 0;
    const tvaColl  = facs.reduce((s, f)  => s + Math.max(0, (f.totalTTC||0)-(f.totalHT||0)), 0);
    const tvaDedu  = deps.reduce((s, d)  => s + (d.montantTVA || 0), 0);
    const tvaNette = tvaColl - tvaDedu;

    const impayees = allFacs.filter(f => f.statut && f.statut !== 'Payé' && f.statut !== 'Annulé');
    const totalImpaye = impayees.reduce((s, f) =>
      s + Math.max(0, (f.totalTTC||0) - (f.totalRegle||0)), 0);

    /* Tendances (%) */
    const _trend = (cur, prev) => {
      if (!prev) return null;
      const pct = Math.round(((cur - prev) / prev) * 100);
      return pct;
    };
    const trendCA  = _trend(ca, caPrev);
    const trendDep = _trend(depTTC, depPrev);

    /* — Graphique mensuel mini — */
    const moisCA  = new Array(12).fill(0);
    const moisDep = new Array(12).fill(0);
    if (_tbState.periode === 'annee') {
      allFacs.filter(f => new Date(f.date||'').getFullYear() === _tbState.annee)
        .forEach(f => { const m = new Date(f.date).getMonth(); moisCA[m] += f.totalTTC||0; });
      allDeps.filter(d => new Date(d.date||'').getFullYear() === _tbState.annee)
        .forEach(d => { const m = new Date(d.date).getMonth(); moisDep[m] += d.montantTTC||d.montantHT||0; });
    }

    /* — KPI card helper — */
    const _kpi = (icon, label, val, sub, subColor) => `
      <div class="dash-card" style="min-width:140px;">
        <div class="card-label">${label}</div>
        <div class="card-value" style="font-size:1.35rem;">${val}</div>
        ${sub ? `<div class="card-sub" style="color:${subColor||'var(--text-muted)'};">${sub}</div>` : ''}
        <div style="font-size:1.4rem;margin-top:4px;">${icon}</div>
      </div>`;

    const _fmtTrend = (pct, inv) => {
      if (pct === null) return '';
      const good = inv ? pct < 0 : pct > 0;
      const arrow = pct > 0 ? '▲' : '▼';
      const color = good ? 'var(--accent-green)' : pct === 0 ? 'var(--text-muted)' : 'var(--accent-orange)';
      return `<span style="color:${color};font-size:12px;">${arrow} ${Math.abs(pct)}%</span> vs période préc.`;
    };

    area.innerHTML = `
      <div style="padding:0 0 32px;">

        <!-- KPI Cards -->
        <div class="dash-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin-bottom:24px;">
          ${_kpi('💰','Chiffre d\'affaires', fmt(Math.round(ca)),
            _fmtTrend(trendCA, false), trendCA > 0 ? 'var(--accent-green)' : 'var(--accent-orange)')}
          ${_kpi('🛒','Dépenses', fmt(Math.round(depTTC)),
            _fmtTrend(trendDep, true), trendDep < 0 ? 'var(--accent-green)' : 'var(--accent-orange)')}
          ${_kpi(marge >= 0 ? '📈' : '📉','Marge estimée', fmt(Math.round(marge)),
            `${tauxMarge}% du CA`,
            tauxMarge >= 30 ? 'var(--accent-green)' : tauxMarge >= 10 ? 'var(--accent-orange)' : 'var(--accent-red)')}
          ${_kpi('📊','TVA collectée', fmt(Math.round(tvaColl)), 'Sur les ventes', 'var(--text-muted)')}
          ${_kpi('🔄','TVA déductible', fmt(Math.round(tvaDedu)), 'Sur les achats', 'var(--text-muted)')}
          ${_kpi(tvaNette >= 0 ? '⬆' : '⬇','TVA à reverser', fmt(Math.round(Math.abs(tvaNette))),
            tvaNette >= 0 ? 'Vous devez reverser' : 'Crédit de TVA',
            tvaNette >= 0 ? 'var(--accent-orange)' : 'var(--accent-green)')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">

          <!-- Bloc Dépenses récentes -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Dépenses récentes</div>
              <button class="btn btn-ghost btn-sm" onclick="openView('depenses')"
                style="font-size:11px;">Tout voir →</button>
            </div>
            ${deps.length === 0
              ? `<p style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px 0;">
                  Aucune dépense sur cette période.</p>`
              : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
                  <thead>
                    <tr>
                      <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border);">Catégorie</th>
                      <th style="text-align:left;padding:6px 8px;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border);">Date</th>
                      <th style="text-align:right;padding:6px 8px;color:var(--text-muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid var(--border);">Montant TTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${[...deps].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,8).map(d => `
                      <tr style="border-bottom:1px solid var(--border-light);">
                        <td style="padding:7px 8px;">${_escA(d.categorie || d.description || '—')}</td>
                        <td style="padding:7px 8px;color:var(--text-muted);font-size:12px;">${d.date ? d.date.slice(0,10) : '—'}</td>
                        <td style="padding:7px 8px;text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--accent-orange);">${fmt(Math.round(d.montantTTC||d.montantHT||0))}</td>
                      </tr>`).join('')}
                  </tbody>
                </table>`}
            ${impayees.length > 0 ? `
              <div style="margin-top:12px;padding:10px 12px;background:rgba(220,38,38,0.06);
                border-radius:8px;border-left:3px solid var(--accent-red);">
                <span style="font-size:13px;color:var(--accent-red);font-weight:600;">
                  ⚠ ${impayees.length} facture${impayees.length>1?'s':''} impayée${impayees.length>1?'s':''} —
                  ${fmt(Math.round(totalImpaye))} à encaisser
                </span>
              </div>` : ''}
          </div>

          <!-- Bloc Ventes vs Dépenses -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Ventes vs Dépenses</div>
            </div>
            ${_tbState.periode === 'annee'
              ? `<div id="tb-chart-annuel"></div>`
              : (() => {
                  const maxV = Math.max(ca, depTTC, 1);
                  const pctCA  = Math.round((ca / maxV) * 100);
                  const pctDep = Math.round((depTTC / maxV) * 100);
                  return `
                    <div style="display:flex;flex-direction:column;gap:14px;margin-top:8px;">
                      <div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                          <span style="font-size:13px;font-weight:600;color:var(--accent-green);">💰 Ventes</span>
                          <span style="font-family:var(--font-mono);font-size:13px;font-weight:700;">${fmt(Math.round(ca))}</span>
                        </div>
                        <div style="height:18px;background:var(--bg-base);border-radius:9px;overflow:hidden;">
                          <div style="width:${pctCA}%;height:100%;background:var(--accent-green);border-radius:9px;transition:width .4s ease;"></div>
                        </div>
                      </div>
                      <div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                          <span style="font-size:13px;font-weight:600;color:var(--accent-orange);">🛒 Dépenses</span>
                          <span style="font-family:var(--font-mono);font-size:13px;font-weight:700;">${fmt(Math.round(depTTC))}</span>
                        </div>
                        <div style="height:18px;background:var(--bg-base);border-radius:9px;overflow:hidden;">
                          <div style="width:${pctDep}%;height:100%;background:var(--accent-orange);border-radius:9px;transition:width .4s ease;"></div>
                        </div>
                      </div>
                      <div style="border-top:1px solid var(--border);padding-top:14px;">
                        <div style="display:flex;justify-content:space-between;align-items:center;">
                          <span style="font-size:13px;color:var(--text-secondary);">Marge estimée</span>
                          <span style="font-family:var(--font-mono);font-size:16px;font-weight:700;
                            color:${marge>=0?'var(--accent-green)':'var(--accent-red)'};">
                            ${marge >= 0 ? '+' : ''}${fmt(Math.round(marge))}
                          </span>
                        </div>
                        <div style="font-size:12px;color:var(--text-muted);margin-top:2px;text-align:right;">
                          ${tauxMarge}% du CA encaissé
                        </div>
                      </div>
                    </div>`;
                })()}
          </div>

        </div>

        <!-- Assistant Coach Comptable -->
        <div id="tb-assistant-block"></div>

      </div>`;

    /* Graphique annuel si mode année */
    if (_tbState.periode === 'annee') {
      _renderGroupedBars('tb-chart-annuel', _MOIS_C, moisCA, moisDep,
        'Ventes', 'Dépenses', '#00d4aa', '#ffa944');
    }

    /* Rendre l'assistant coach */
    _renderAssistantCoach('tb-assistant-block', {
      ca, caHT, depTTC, marge, tauxMarge,
      tvaColl, tvaDedu, tvaNette,
      impayees, totalImpaye,
      trendCA, trendDep,
      periode: _tbLabelPeriode()
    });
  }

  /* Navigation période tableau de bord */
  function _tbSetPeriode(p) {
    _tbState.periode = p;
    const tb = document.getElementById('toolbar-actions');
    const vc = document.getElementById('view-content');
    if (tb && vc) _renderTableauBord(tb, vc);
  }
  function _tbNavPeriode(dir) {
    if (_tbState.periode === 'mois') {
      _tbState.mois += dir;
      if (_tbState.mois < 0)  { _tbState.mois = 11; _tbState.annee--; }
      if (_tbState.mois > 11) { _tbState.mois = 0;  _tbState.annee++; }
    } else {
      _tbState.annee += dir;
    }
    const tb = document.getElementById('toolbar-actions');
    const vc = document.getElementById('view-content');
    if (tb && vc) _renderTableauBord(tb, vc);
  }

  /* ================================================================
     ASSISTANT COACH COMPTABLE — simple, clair, pédagogique
     ================================================================ */
  function _renderAssistantCoach(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const { ca, depTTC, marge, tauxMarge, tvaNette,
            impayees, totalImpaye, trendCA, trendDep, periode } = data;

    /* — Score de santé financière — */
    let score = 50;
    if (tauxMarge >= 40)       score += 20;
    else if (tauxMarge >= 20)  score += 10;
    else if (tauxMarge < 0)    score -= 20;

    if (impayees.length === 0)             score += 10;
    else if (impayees.length >= 5)         score -= 15;
    else if (impayees.length >= 2)         score -= 8;

    if (trendCA !== null && trendCA > 0)   score += 10;
    if (trendCA !== null && trendCA < -20) score -= 10;
    if (trendDep !== null && trendDep > 30) score -= 10;

    if (ca === 0)                          score = Math.min(score, 30);

    score = Math.max(0, Math.min(100, score));

    const scoreColor = score >= 70 ? '#16A34A' : score >= 45 ? '#D97706' : '#DC2626';
    const scoreLbl   = score >= 70 ? 'Situation saine' : score >= 45 ? 'À surveiller' : 'Attention requise';
    const scoreEmoji = score >= 70 ? '✅' : score >= 45 ? '⚠️' : '🚨';

    /* — Alertes — */
    const alertes = [];
    if (ca === 0)
      alertes.push({ type: 'warn', msg: 'Aucune vente enregistrée sur cette période.' });
    if (impayees.length >= 3)
      alertes.push({ type: 'warn', msg: `Tu as ${impayees.length} factures non payées — ${fmt(Math.round(totalImpaye))} à encaisser.` });
    else if (impayees.length > 0)
      alertes.push({ type: 'info', msg: `${impayees.length} facture${impayees.length>1?'s':''} en attente de paiement.` });
    if (trendCA !== null && trendCA > 15)
      alertes.push({ type: 'good', msg: `Tes ventes ont augmenté de ${trendCA}% par rapport à la période précédente.` });
    if (trendCA !== null && trendCA < -15)
      alertes.push({ type: 'warn', msg: `Tes ventes ont baissé de ${Math.abs(trendCA)}% — surveille la tendance.` });
    if (trendDep !== null && trendDep > 25)
      alertes.push({ type: 'warn', msg: `Tes dépenses ont augmenté de ${trendDep}% — vérifie les postes de charge.` });
    if (tauxMarge >= 30)
      alertes.push({ type: 'good', msg: `Ta marge est bonne : ${tauxMarge}% du chiffre d'affaires.` });
    else if (tauxMarge < 10 && ca > 0)
      alertes.push({ type: 'warn', msg: `Ta marge est faible (${tauxMarge}%). Revois tes prix ou tes coûts.` });
    if (tvaNette > 20000)
      alertes.push({ type: 'info', msg: `TVA à reverser : ${fmt(Math.round(tvaNette))} — pense à prévoir le montant.` });

    /* — Conseils — */
    const conseils = [];
    if (impayees.length > 0)
      conseils.push('Relance les clients qui ont des factures impayées. Un simple message suffit souvent.');
    if (tauxMarge < 20 && ca > 0)
      conseils.push('Ta marge est un peu serrée. Vérifie si tes prix de vente couvrent bien tes coûts de production.');
    if (trendDep !== null && trendDep > 20)
      conseils.push('Tes dépenses augmentent. Compare tes fournisseurs et identifie les postes qui ont grimpé.');
    if (ca > 0 && trendCA !== null && trendCA > 0)
      conseils.push('Tes ventes progressent bien. Continue de suivre les produits qui marchent le mieux.');
    if (conseils.length === 0 && ca > 0)
      conseils.push('Continue à enregistrer tes dépenses régulièrement pour avoir une image fidèle de ta situation.');
    if (ca === 0)
      conseils.push('Commence par enregistrer tes premières ventes pour que l\'assistant puisse analyser ta situation.');

    /* — HTML — */
    const alertHtml = alertes.map(a => {
      const bg    = a.type === 'good' ? 'rgba(22,163,74,0.08)'  : a.type === 'warn' ? 'rgba(220,38,38,0.08)'   : 'rgba(99,102,241,0.07)';
      const border= a.type === 'good' ? 'var(--accent-green)'   : a.type === 'warn' ? 'var(--accent-red)'      : 'var(--accent-blue)';
      const icon  = a.type === 'good' ? '✔'                     : a.type === 'warn' ? '⚠'                      : 'ℹ';
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;
          background:${bg};border-radius:8px;border-left:3px solid ${border};">
          <span style="font-size:1rem;margin-top:1px;">${icon}</span>
          <span style="font-size:13px;color:var(--text-primary);line-height:1.5;">${_escA(a.msg)}</span>
        </div>`;
    }).join('');

    const conseilHtml = conseils.map(c => `
      <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 14px;
        background:rgba(99,102,241,0.05);border-radius:8px;border-left:3px solid var(--accent-blue);">
        <span style="font-size:1rem;">💡</span>
        <span style="font-size:13px;color:var(--text-primary);line-height:1.5;">${_escA(c)}</span>
      </div>`).join('');

    el.innerHTML = `
      <div class="card">
        <!-- En-tête assistant -->
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
          <div style="width:48px;height:48px;border-radius:12px;
            background:linear-gradient(135deg,#6366F1,#8B5CF6);
            display:flex;align-items:center;justify-content:center;
            font-size:1.5rem;flex-shrink:0;">🧠</div>
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--text-primary);">
              Assistant financier HCS
            </div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">
              Analyse automatique · ${_escA(periode)}
            </div>
          </div>

          <!-- Score de santé -->
          <div style="margin-left:auto;text-align:right;">
            <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
              color:var(--text-muted);margin-bottom:4px;">Score financier</div>
            <div style="display:flex;align-items:center;gap:8px;justify-content:flex-end;">
              <div style="font-family:var(--font-mono);font-size:26px;font-weight:700;color:${scoreColor};">
                ${score}<span style="font-size:14px;color:var(--text-muted);">/100</span>
              </div>
              <div>
                <div style="font-size:15px;">${scoreEmoji}</div>
                <div style="font-size:11px;font-weight:600;color:${scoreColor};">${_escA(scoreLbl)}</div>
              </div>
            </div>
            <!-- Barre de score -->
            <div style="margin-top:6px;height:6px;width:140px;background:var(--bg-base);
              border-radius:3px;overflow:hidden;margin-left:auto;">
              <div style="height:100%;width:${score}%;background:${scoreColor};border-radius:3px;
                transition:width .6s ease;"></div>
            </div>
          </div>
        </div>

        <!-- Résumé simple -->
        <div style="background:var(--bg-base);border-radius:10px;padding:14px 18px;margin-bottom:18px;">
          <div style="font-size:13px;font-weight:600;color:var(--text-secondary);margin-bottom:10px;
            text-transform:uppercase;letter-spacing:.05em;">Résumé · ${_escA(periode)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div>
              <div style="font-size:11px;color:var(--text-muted);">Tu as encaissé</div>
              <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--accent-green);">
                ${fmt(Math.round(ca))}
              </div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);">Tes dépenses</div>
              <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;color:var(--accent-orange);">
                ${fmt(Math.round(depTTC))}
              </div>
            </div>
            <div>
              <div style="font-size:11px;color:var(--text-muted);">Ta marge estimée</div>
              <div style="font-family:var(--font-mono);font-size:16px;font-weight:700;
                color:${marge>=0?'var(--accent-blue)':'var(--accent-red)'};">
                ${marge>=0?'+':''}${fmt(Math.round(marge))}
              </div>
            </div>
          </div>
        </div>

        <!-- Alertes -->
        ${alertes.length > 0 ? `
          <div style="margin-bottom:16px;">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
              color:var(--text-muted);margin-bottom:8px;">Points importants</div>
            <div style="display:flex;flex-direction:column;gap:6px;">${alertHtml}</div>
          </div>` : ''}

        <!-- Conseils -->
        ${conseils.length > 0 ? `
          <div>
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
              color:var(--text-muted);margin-bottom:8px;">Conseils</div>
            <div style="display:flex;flex-direction:column;gap:6px;">${conseilHtml}</div>
          </div>` : ''}
      </div>`;
  }

  /* ================================================================
     ANALYSE PRODUITS — lit les lignes de factures + catalogue
     ================================================================ */

  /* Top produits par CA depuis les lignes de factures */
  function _topProduits(facs) {
    const map = {};
    facs.forEach(f => {
      (f.lignes || []).forEach(l => {
        const nom = (l.description || '').trim() || 'Article sans nom';
        const key = nom.toLowerCase();
        if (!map[key]) map[key] = { nom, ca: 0, qte: 0, lignes: 0 };
        const ht = l.totalHT || ((l.qte || 1) * (l.puHT || 0));
        map[key].ca  += ht;
        map[key].qte += (l.qte || 1);
        map[key].lignes++;
      });
    });
    return Object.values(map).sort((a, b) => b.ca - a.ca);
  }

  /* Rentabilité catalogue produits (prixVente vs prixAchat) */
  function _rentabiliteCatalogue() {
    const produits = Store.getAll('produits');
    return produits
      .filter(p => p.prixVente > 0)
      .map(p => {
        const cout   = p.prixAchat || 0;
        const vente  = p.prixVente || 0;
        const margeXPF  = vente - cout;
        const tauxMarge = cout > 0 ? Math.round((margeXPF / vente) * 100) : null;
        /* Prix conseillé pour atteindre 40% de marge */
        const prixConseille = cout > 0 ? Math.ceil(cout / 0.60 / 10) * 10 : null;
        return { ...p, margeXPF, tauxMarge, prixConseille };
      })
      .sort((a, b) => (b.tauxMarge ?? -1) - (a.tauxMarge ?? -1));
  }

  /* Analyse des dépenses par catégorie */
  function _analyseDepCat(deps) {
    const map = {};
    deps.forEach(d => {
      const cat = d.categorie || 'Divers';
      if (!map[cat]) map[cat] = 0;
      map[cat] += (d.montantTTC || d.montantHT || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  /* ================================================================
     VUE : COPILOTE FINANCIER (vue dédiée — sidebar)
     ================================================================ */
  function _renderConseiller(toolbar, area) {
    toolbar.innerHTML = `
      <span style="font-size:13px;font-weight:600;color:var(--text-primary);align-self:center;">
        🧠 Copilote financier HCS
      </span>
      <span style="font-size:12px;color:var(--text-muted);align-self:center;margin-left:8px;">
        · Analyse automatique
      </span>`;

    /* — Données — */
    const allFacs = Store.getAll('factures');
    const allDeps = Store.getAll('depenses');
    const now     = new Date();
    const moisCur = now.getMonth();
    const anCur   = now.getFullYear();
    let prevM = moisCur - 1, prevA = anCur;
    if (prevM < 0) { prevM = 11; prevA--; }

    const facsMois = allFacs.filter(f => { const d = new Date(f.date||''); return d.getFullYear()===anCur && d.getMonth()===moisCur; });
    const depsMois = allDeps.filter(f => { const d = new Date(f.date||''); return d.getFullYear()===anCur && d.getMonth()===moisCur; });
    const facsPrev = allFacs.filter(f => { const d = new Date(f.date||''); return d.getFullYear()===prevA && d.getMonth()===prevM; });
    const depsPrev = allDeps.filter(d => { const dt= new Date(d.date||''); return dt.getFullYear()===prevA && dt.getMonth()===prevM; });

    const ca       = facsMois.reduce((s,f)=>s+(f.totalTTC||0),0);
    const depTTC   = depsMois.reduce((s,d)=>s+(d.montantTTC||d.montantHT||0),0);
    const marge    = ca - depTTC;
    const tauxMarge= ca > 0 ? Math.round((marge/ca)*100) : 0;
    const tvaColl  = facsMois.reduce((s,f)=>s+Math.max(0,(f.totalTTC||0)-(f.totalHT||0)),0);
    const tvaDedu  = depsMois.reduce((s,d)=>s+(d.montantTVA||0),0);
    const tvaNette = tvaColl - tvaDedu;
    const impayees = allFacs.filter(f => f.statut && f.statut !== 'Payé' && f.statut !== 'Annulé');
    const totalImpaye = impayees.reduce((s,f)=>s+Math.max(0,(f.totalTTC||0)-(f.totalRegle||0)),0);
    const caPrev   = facsPrev.reduce((s,f)=>s+(f.totalTTC||0),0);
    const depPrev  = depsPrev.reduce((s,d)=>s+(d.montantTTC||d.montantHT||0),0);
    const _trend   = (cur,prev) => (!prev ? null : Math.round(((cur-prev)/prev)*100));
    const trendCA  = _trend(ca, caPrev);
    const trendDep = _trend(depTTC, depPrev);

    /* — Analyse produits — */
    const topProd   = _topProduits([...facsMois, ...facsPrev]);
    const top5      = topProd.slice(0, 5);
    const catalogue = _rentabiliteCatalogue();
    const depCats   = _analyseDepCat(depsMois);

    /* — Prévision CA fin de mois — */
    const jourCur     = now.getDate();
    const joursMois   = new Date(anCur, moisCur + 1, 0).getDate();
    const caProjecte  = jourCur > 0 ? Math.round((ca / jourCur) * joursMois) : ca;
    const projMeilleur= caPrev > 0 && caProjecte > caPrev;

    /* — Score santé — */
    let score = 50;
    if (tauxMarge >= 40)       score += 20; else if (tauxMarge >= 20) score += 10; else if (tauxMarge < 0) score -= 20;
    if (impayees.length === 0) score += 10; else if (impayees.length >= 5) score -= 15; else if (impayees.length >= 2) score -= 8;
    if (trendCA !== null && trendCA > 0)    score += 10;
    if (trendCA !== null && trendCA < -20)  score -= 10;
    if (trendDep !== null && trendDep > 30) score -= 10;
    if (ca === 0) score = Math.min(score, 30);
    score = Math.max(0, Math.min(100, score));
    const scoreColor = score >= 70 ? '#16A34A' : score >= 45 ? '#D97706' : '#DC2626';
    const scoreLbl   = score >= 70 ? 'Situation saine' : score >= 45 ? 'À surveiller' : 'Attention requise';

    /* — Helpers HTML — */
    const _section = (title, icon, content) => `
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
          <span style="font-size:1.2rem;">${icon}</span>
          <div class="card-title">${_escA(title)}</div>
        </div>
        ${content}
      </div>`;

    const _alert = (type, msg) => {
      const cfg = {
        good: { bg:'rgba(22,163,74,.08)',   border:'#16A34A', icon:'✔' },
        warn: { bg:'rgba(220,38,38,.08)',    border:'#DC2626', icon:'⚠' },
        info: { bg:'rgba(99,102,241,.07)',   border:'#6366F1', icon:'ℹ' },
        tip:  { bg:'rgba(217,119,6,.07)',    border:'#D97706', icon:'💡' }
      }[type] || { bg:'var(--bg-base)', border:'var(--border)', icon:'·' };
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:9px 14px;
          background:${cfg.bg};border-radius:8px;border-left:3px solid ${cfg.border};margin-bottom:6px;">
          <span style="flex-shrink:0;font-size:.95rem;">${cfg.icon}</span>
          <span style="font-size:13px;color:var(--text-primary);line-height:1.5;">${_escA(msg)}</span>
        </div>`;
    };

    /* — Page — */
    area.innerHTML = `
      <div style="padding:4px 0 32px;max-width:900px;">

        <!-- En-tête score + résumé -->
        <div class="card" style="margin-bottom:16px;">
          <div style="display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;">
            <!-- Bloc score -->
            <div style="text-align:center;min-width:100px;">
              <div style="font-size:38px;font-weight:700;font-family:var(--font-mono);color:${scoreColor};">${score}</div>
              <div style="font-size:11px;color:var(--text-muted);">/100</div>
              <div style="height:6px;background:var(--bg-base);border-radius:3px;margin:6px 0;overflow:hidden;">
                <div style="height:100%;width:${score}%;background:${scoreColor};border-radius:3px;"></div>
              </div>
              <div style="font-size:12px;font-weight:700;color:${scoreColor};">${_escA(scoreLbl)}</div>
            </div>

            <!-- Résumé mois -->
            <div style="flex:1;min-width:220px;">
              <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:12px;">
                ${_escA(_MOIS_LONG[moisCur])} ${anCur}
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                ${[
                  ['Tu as encaissé','💰',fmt(Math.round(ca)),'var(--accent-green)'],
                  ['Tes dépenses','🛒',fmt(Math.round(depTTC)),'var(--accent-orange)'],
                  ['Ta marge','📈',fmt(Math.round(marge)),marge>=0?'var(--accent-blue)':'var(--accent-red)'],
                  ['TVA à reverser','📊',fmt(Math.round(Math.abs(tvaNette))),tvaNette>0?'var(--accent-orange)':'var(--accent-green)']
                ].map(([lbl,ico,val,color])=>`
                  <div style="background:var(--bg-base);border-radius:8px;padding:10px 12px;">
                    <div style="font-size:11px;color:var(--text-muted);">${ico} ${_escA(lbl)}</div>
                    <div style="font-family:var(--font-mono);font-size:15px;font-weight:700;color:${color};margin-top:3px;">${val}</div>
                  </div>`).join('')}
              </div>
            </div>

            <!-- Prévision CA -->
            ${ca > 0 ? `
              <div style="min-width:160px;background:var(--bg-base);border-radius:10px;padding:14px;text-align:center;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
                  color:var(--text-muted);margin-bottom:8px;">Prévision fin de mois</div>
                <div style="font-family:var(--font-mono);font-size:18px;font-weight:700;
                  color:${projMeilleur?'var(--accent-green)':'var(--accent-orange)'};">
                  ~${fmt(Math.round(caProjecte))}
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">
                  Basé sur ${jourCur} jour${jourCur>1?'s':''}
                </div>
                <div style="font-size:12px;font-weight:600;margin-top:6px;
                  color:${projMeilleur?'var(--accent-green)':'var(--text-muted)'};">
                  ${projMeilleur?'▲ Mieux que le mois dernier':'≈ Comparable au mois dernier'}
                </div>
              </div>` : ''}
          </div>
        </div>

        <!-- Alertes & tendances -->
        ${_section('Points importants', '🔔', (() => {
          const items = [];
          if (ca === 0) items.push(_alert('warn','Aucune vente enregistrée ce mois-ci.'));
          if (impayees.length >= 3) items.push(_alert('warn',`${impayees.length} factures non payées — ${fmt(Math.round(totalImpaye))} à encaisser. Pense à relancer tes clients.`));
          else if (impayees.length > 0) items.push(_alert('info',`${impayees.length} facture${impayees.length>1?'s':''} en attente de règlement (${fmt(Math.round(totalImpaye))}).`));
          if (trendCA !== null && trendCA > 15) items.push(_alert('good',`Tes ventes ont progressé de ${trendCA}% par rapport au mois dernier — continue comme ça !`));
          if (trendCA !== null && trendCA < -15) items.push(_alert('warn',`Tes ventes ont baissé de ${Math.abs(trendCA)}% ce mois-ci. Surveille la tendance.`));
          if (trendDep !== null && trendDep > 25) items.push(_alert('warn',`Tes dépenses ont augmenté de ${trendDep}% — vérifie les postes qui ont grimpé.`));
          if (tauxMarge >= 35) items.push(_alert('good',`Ta marge est bonne (${tauxMarge}% du CA). Continue à surveiller tes coûts.`));
          else if (tauxMarge < 15 && ca > 0) items.push(_alert('warn',`Ta marge est faible (${tauxMarge}%). Certains produits pourraient être mieux tarifés.`));
          if (tvaNette > 15000) items.push(_alert('info',`TVA à reverser : ${fmt(Math.round(tvaNette))}. Pense à prévoir cette somme.`));
          if (items.length === 0) items.push(_alert('good','Aucune alerte particulière. Ta situation semble stable.'));
          return items.join('');
        })())}

        <!-- Top produits vendus -->
        ${top5.length > 0 ? _section('Top produits vendus', '🏆', `
          <div style="display:flex;flex-direction:column;gap:0;">
            ${top5.map((p, i) => {
              const pct = Math.round((p.ca / (topProd[0].ca || 1)) * 100);
              const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
              return `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;
                  border-bottom:${i<top5.length-1?'1px solid var(--border-light)':'none'};">
                  <span style="font-size:1.1rem;width:24px;text-align:center;">${medals[i]}</span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;color:var(--text-primary);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                      ${_escA(p.nom)}
                    </div>
                    <div style="height:5px;background:var(--bg-base);border-radius:3px;margin-top:5px;overflow:hidden;">
                      <div style="width:${pct}%;height:100%;background:var(--accent-blue);border-radius:3px;"></div>
                    </div>
                  </div>
                  <div style="text-align:right;flex-shrink:0;">
                    <div style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--accent-green);">
                      ${fmt(Math.round(p.ca))}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);">${p.qte} vendu${p.qte>1?'s':''}</div>
                  </div>
                </div>`;
            }).join('')}
          </div>`) : ''}

        <!-- Rentabilité catalogue -->
        ${catalogue.length > 0 ? _section('Analyse rentabilité produits', '💡', `
          <div style="margin-bottom:10px;font-size:13px;color:var(--text-secondary);">
            Comparaison prix de vente vs prix d'achat pour chaque article de ton catalogue.
          </div>
          <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:var(--bg-base);">
                  <th style="text-align:left;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);border-bottom:1px solid var(--border);">Produit</th>
                  <th style="text-align:right;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);border-bottom:1px solid var(--border);">Prix vente</th>
                  <th style="text-align:right;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);border-bottom:1px solid var(--border);">Coût achat</th>
                  <th style="text-align:right;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);border-bottom:1px solid var(--border);">Marge</th>
                  <th style="text-align:center;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);border-bottom:1px solid var(--border);">Statut</th>
                  <th style="text-align:right;padding:8px 12px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted);border-bottom:1px solid var(--border);">Prix conseillé</th>
                </tr>
              </thead>
              <tbody>
                ${catalogue.slice(0,10).map(p => {
                  const tm   = p.tauxMarge;
                  const icon = tm === null ? '—' : tm >= 40 ? '✅ Très bon' : tm >= 25 ? '✔ Correct' : tm >= 10 ? '⚠ Faible' : '🚨 Bas';
                  const col  = tm === null ? 'var(--text-muted)' : tm >= 40 ? 'var(--accent-green)' : tm >= 25 ? 'var(--accent-blue)' : tm >= 10 ? 'var(--accent-orange)' : 'var(--accent-red)';
                  return `
                    <tr style="border-bottom:1px solid var(--border-light);">
                      <td style="padding:8px 12px;font-weight:600;color:var(--text-primary);">${_escA(p.nom||p.reference||'—')}</td>
                      <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);">${fmt(Math.round(p.prixVente||0))}</td>
                      <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);color:var(--text-muted);">${p.prixAchat ? fmt(Math.round(p.prixAchat)) : '—'}</td>
                      <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:${col};">
                        ${tm !== null ? tm+'%' : '—'}
                      </td>
                      <td style="padding:8px 12px;text-align:center;font-size:12px;font-weight:600;color:${col};">${icon}</td>
                      <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);">
                        ${p.prixConseille && p.prixConseille > (p.prixVente||0)
                          ? `<span style="color:var(--accent-orange);">~${fmt(p.prixConseille)}</span>`
                          : '<span style="color:var(--accent-green);">OK</span>'}
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:10px;font-size:12px;color:var(--text-muted);">
            💡 Le prix conseillé est calculé pour atteindre une marge de 40%.
          </div>`) : ''}

        <!-- Dépenses par catégorie -->
        ${depCats.length > 0 ? _section('Dépenses par catégorie', '🛒', `
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${depCats.map(([cat, montant]) => {
              const pct = Math.round((montant / (depCats[0][1]||1)) * 100);
              return `
                <div style="display:flex;align-items:center;gap:10px;">
                  <div style="font-size:13px;color:var(--text-primary);min-width:180px;font-weight:500;">
                    ${_escA(cat)}
                  </div>
                  <div style="flex:1;height:8px;background:var(--bg-base);border-radius:4px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:var(--accent-orange);border-radius:4px;"></div>
                  </div>
                  <div style="font-family:var(--font-mono);font-size:13px;font-weight:700;
                    color:var(--accent-orange);min-width:90px;text-align:right;">
                    ${fmt(Math.round(montant))}
                  </div>
                </div>`;
            }).join('')}
          </div>`) : `
          <div style="color:var(--text-muted);font-size:13px;text-align:center;padding:16px;">
            Aucune dépense ce mois-ci.
          </div>`}

        <!-- Conseils -->
        ${_section('Conseils concrets', '🎯', (() => {
          const tips = [];
          if (impayees.length > 0)
            tips.push(_alert('tip',`Relance tes clients avec des factures impayées. Un message suffit souvent à déclencher le paiement.`));
          if (catalogue.some(p => p.tauxMarge !== null && p.tauxMarge < 20))
            tips.push(_alert('tip','Certains produits ont une marge faible. Envisage de revoir leurs prix de vente ou de réduire leur coût d\'achat.'));
          if (trendDep !== null && trendDep > 15)
            tips.push(_alert('tip','Tes dépenses augmentent. Compare tes fournisseurs et identifie ce qui a grimpé.'));
          if (top5.length > 0)
            tips.push(_alert('tip',`Ton produit le plus vendu est "${top5[0].nom}". Assure-toi d'avoir du stock et une bonne marge dessus.`));
          if (ca > 0 && tauxMarge < 30)
            tips.push(_alert('tip','Pour améliorer ta marge, tu peux soit augmenter légèrement tes prix de vente, soit négocier tes achats.'));
          if (tips.length === 0)
            tips.push(_alert('good','Ta gestion est saine. Continue à enregistrer régulièrement tes ventes et dépenses.'));
          return tips.join('');
        })())}

      </div>`;
  }

  /* ================================================================
     VUE : GRAND LIVRE
     ================================================================ */
  function _renderGrandLivre(toolbar, area) {
    toolbar.innerHTML = `
      <input type="search" class="form-input" id="gl-search" placeholder="Rechercher un compte…"
        style="width:260px;font-size:13px;padding:6px 10px;">
      <div style="display:flex;gap:6px;margin-left:auto;">
        <button class="btn btn-ghost btn-sm" id="gl-csv" title="Exporter CSV">📥 CSV</button>
        <button class="btn btn-ghost btn-sm" id="gl-xls" title="Exporter Excel">📊 XLS</button>
        <button class="btn btn-ghost btn-sm" id="gl-pdf" title="Exporter PDF">🖨️ PDF</button>
      </div>`;

    const ecritures = Store.getAll('ecritures');

    /* Calcul du solde de chaque compte depuis les écritures réelles */
    const comptes = PLAN_COMPTABLE.map(c => {
      const entries = ecritures.filter(e => e.compte && e.compte.startsWith(c.numero.slice(0,3)));
      const debit   = entries.reduce((s, e) => s + (e.debit  || 0), 0);
      const credit  = entries.reduce((s, e) => s + (e.credit || 0), 0);
      const solde   = (c.type === 'Actif' || c.type === 'Charge') ? debit - credit : credit - debit;
      return { ...c, solde };
    });

    const classeLabels = {
      '4': 'Comptes de tiers',
      '5': 'Comptes financiers',
      '6': 'Comptes de charges',
      '7': 'Comptes de produits'
    };
    const classeColors = { '4':'#7C3AED', '5':'#0891B2', '6':'#DC2626', '7':'#D97706' };

    const renderGrid = (filter = '') => {
      const filtered = comptes.filter(c =>
        !filter || c.numero.includes(filter) || c.libelle.toLowerCase().includes(filter.toLowerCase())
      );
      const byClasse = {};
      filtered.forEach(c => {
        if (!byClasse[c.classe]) byClasse[c.classe] = [];
        byClasse[c.classe].push(c);
      });
      return Object.entries(byClasse).map(([classe, list]) => `
        <div class="acc-gl-classe">
          <div class="acc-gl-classe-header" style="background:${classeColors[classe] || '#6B7280'}">
            Classe ${classe} — ${classeLabels[classe] || ''}
          </div>
          ${list.map(c => `
            <div class="acc-gl-compte">
              <span class="acc-compte-num">${c.numero}</span>
              <span class="acc-compte-lib">${c.libelle}</span>
              <span class="acc-compte-solde ${c.solde >= 0 ? 'solde-pos' : 'solde-neg'}">
                ${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'XPF',maximumFractionDigits:0}).format(Math.abs(c.solde))}
              </span>
            </div>`).join('')}
        </div>`).join('');
    };

    area.innerHTML = `
      <div style="padding:16px 0;">
        <div class="acc-gl-grid" id="gl-grid">${renderGrid()}</div>
      </div>`;

    document.getElementById('gl-search').addEventListener('input', e => {
      document.getElementById('gl-grid').innerHTML = renderGrid(e.target.value);
    });

    /* Export grand livre */
    const _glHdrs = ['N° Compte', 'Libellé', 'Type', 'Classe', 'Solde (XPF)'];
    const _glRows = () => comptes.map(c => [c.numero, c.libelle, c.type, c.classe, c.solde]);
    toolbar.querySelector('#gl-csv').addEventListener('click', () => _dlCSV('hcs-grand-livre', _glHdrs, _glRows()));
    toolbar.querySelector('#gl-xls').addEventListener('click', () => _dlXLS('hcs-grand-livre', _glHdrs, _glRows(), 'Grand Livre'));
    toolbar.querySelector('#gl-pdf').addEventListener('click', () => _dlPDF('Grand Livre', 'Soldes par compte', _glHdrs, _glRows()));
  }

  /* ================================================================
     VUE : PAIEMENTS
     ================================================================ */
  function _renderPaiements(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-primary" id="btn-new-paiement">+ Enregistrer un paiement</button>
      <div style="display:flex;gap:6px;margin-left:auto;">
        <button class="btn btn-ghost btn-sm" id="pay-imp" title="Importer CSV / JSON">⬆️ Importer</button>
        <button class="btn btn-ghost btn-sm" id="pay-csv" title="Exporter CSV">📥 CSV</button>
        <button class="btn btn-ghost btn-sm" id="pay-xls" title="Exporter Excel">📊 XLS</button>
        <button class="btn btn-ghost btn-sm" id="pay-pdf" title="Exporter PDF">🖨️ PDF</button>
      </div>`;

    const paiements = Store.getAll('paiements') || [];
    const modes = {
      virement:     { label:'Virement bancaire', icon:'🏦', color:'#1F7A63' },
      cheque:       { label:'Chèque',            icon:'📝', color:'#2563EB' },
      carte:        { label:'Carte bancaire',     icon:'💳', color:'#7C3AED' },
      especes:      { label:'Espèces',            icon:'💵', color:'#D97706' },
      prelevement:  { label:'Prélèvement auto.',  icon:'🔄', color:'#0891B2' },
      lettre_change:{ label:'Lettre de change',   icon:'📜', color:'#DC2626' },
    };

    const statsBadge = { encaissé:'payé', en_attente:'envoyé', rejeté:'annulé' };

    const renderRows = (list) => list.length === 0
      ? `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">Aucun paiement enregistré.</td></tr>`
      : list.map(p => {
          const m = modes[p.mode] || { label:p.mode, icon:'💰', color:'#666' };
          return `
            <tr>
              <td>${p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}</td>
              <td><strong>${p.client || '—'}</strong></td>
              <td><code style="font-size:11px;background:var(--bg-elevated);padding:2px 6px;border-radius:4px;">${p.facture || '—'}</code></td>
              <td><span style="color:${m.color};font-weight:600;">${m.icon} ${m.label}</span></td>
              <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">${p.reference || '—'}</td>
              <td style="text-align:right;font-family:var(--font-mono);font-weight:700;color:var(--accent-green);">
                ${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'XPF',maximumFractionDigits:0}).format(p.montant||0)}
              </td>
              <td><span class="badge badge-${statsBadge[p.statut]||'brouillon'}">${p.statut||'—'}</span></td>
              <td>
                ${p.statut !== 'encaissé' ? `<button class="btn-ghost btn-sm btn-encaisser-p" data-id="${p.id}" title="Encaisser">✅</button>` : ''}
                <button class="btn-ghost btn-sm danger btn-del-p" data-id="${p.id}" title="Supprimer">🗑</button>
              </td>
            </tr>`;
        }).join('');

    area.innerHTML = `
      <div style="padding:16px 0;display:flex;flex-direction:column;gap:20px;">

        <!-- Résumé par mode -->
        <div class="acc-modes-grid">
          ${Object.entries(modes).map(([key, m]) => {
            const list = paiements.filter(p => p.mode === key);
            const total = list.reduce((s,p) => s+(p.montant||0), 0);
            return `
              <div class="acc-mode-card">
                <div class="acc-mode-card-header" style="background:${m.color}18;border-color:${m.color}30">
                  <span class="acc-mode-emoji">${m.icon}</span>
                  <span class="acc-mode-label" style="color:${m.color}">${m.label}</span>
                </div>
                <div class="acc-mode-card-body">
                  <div class="acc-mode-stat">
                    <span class="acc-mode-count">${list.length}</span>
                    <span class="acc-mode-count-label">paiements</span>
                  </div>
                  <div class="acc-mode-amount">
                    ${new Intl.NumberFormat('fr-FR',{style:'currency',currency:'XPF',maximumFractionDigits:0}).format(total)}
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>

        <!-- Table paiements -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;">
          <div style="padding:16px 20px;font-size:14px;font-weight:700;border-bottom:1px solid var(--border);">
            Historique des paiements (${paiements.length})
          </div>
          <table class="acc-table" id="paiements-table" style="margin:0;">
            <thead>
              <tr>
                <th>Date</th><th>Client</th><th>Facture</th><th>Mode</th>
                <th>Référence</th><th class="td-right">Montant</th><th>Statut</th><th></th>
              </tr>
            </thead>
            <tbody id="paiements-tbody">${renderRows(paiements)}</tbody>
          </table>
        </div>
      </div>`;

    /* Bouton nouveau paiement */
    document.getElementById('btn-new-paiement').addEventListener('click', () => {
      showFormModal('Enregistrer un paiement', [
        { name:'client',    label:'Client *',        type:'text',   required:true, cols:2 },
        { name:'facture',   label:'N° Facture',       type:'text',   cols:2 },
        { name:'montant',   label:'Montant (XPF) *',  type:'number', required:true, cols:1 },
        { name:'date',      label:'Date *',           type:'date',   required:true, cols:1 },
        { name:'mode',      label:'Mode de paiement', type:'select', cols:2,
          options: Object.entries(modes).map(([k,m]) => ({ value:k, label:`${m.icon} ${m.label}` })) },
        { name:'reference', label:'Référence',        type:'text',   cols:2 },
        { name:'statut',    label:'Statut',           type:'select', cols:2,
          options: [{value:'en_attente',label:'En attente'},{value:'encaissé',label:'Encaissé'},{value:'rejeté',label:'Rejeté'}] }
      ], { date: new Date().toISOString().slice(0,10), mode:'virement', statut:'en_attente' }, (d) => {
        if (!d.montant) { toastError('Montant obligatoire.'); return; }
        Store.create('paiements', {
          client: d.client, facture: d.facture||'—', montant: parseFloat(d.montant)||0,
          date: d.date, mode: d.mode||'virement',
          reference: d.reference||`REF-${Date.now()}`, statut: d.statut||'en_attente',
          createdAt: new Date().toISOString()
        });
        toastSuccess('Paiement enregistré ✓');
        _renderPaiements(document.getElementById('toolbar-actions'), document.getElementById('view-content'));
      }, 'lg');
    });

    /* Encaisser / Supprimer */
    area.querySelectorAll('.btn-encaisser-p').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = Store.getAll('paiements').find(x => x.id === btn.dataset.id);
        if (p) { Store.update('paiements', btn.dataset.id, { statut:'encaissé' }); toastSuccess('Paiement encaissé ✓'); }
        _renderPaiements(document.getElementById('toolbar-actions'), document.getElementById('view-content'));
      });
    });
    area.querySelectorAll('.btn-del-p').forEach(btn => {
      btn.addEventListener('click', () => {
        showDeleteConfirm('ce paiement', () => {
          Store.remove('paiements', btn.dataset.id);
          _renderPaiements(document.getElementById('toolbar-actions'), document.getElementById('view-content'));
        });
      });
    });

    /* Export / Import paiements */
    const paiHdrs = ['Date','Client','Facture','Mode','Référence','Montant (XPF)','Statut','Type','Notes'];
    const paiRows = () => (Store.getAll('paiements') || []).map(p => [
      p.date, p.client || '', p.facture || '', p.mode || '', p.reference || '',
      p.montant || 0, p.statut || '', p.type || '', p.notes || ''
    ]);
    toolbar.querySelector('#pay-csv').addEventListener('click', () => _dlCSV('hcs-paiements', paiHdrs, paiRows()));
    toolbar.querySelector('#pay-xls').addEventListener('click', () => _dlXLS('hcs-paiements', paiHdrs, paiRows(), 'Paiements'));
    toolbar.querySelector('#pay-pdf').addEventListener('click', () => _dlPDF('Paiements', null, paiHdrs, paiRows()));
    toolbar.querySelector('#pay-imp').addEventListener('click', () =>
      _openImportModal(
        'paiements',
        ['Date','Client','Facture','Mode','Référence','Montant','Statut','Type','Notes'],
        cells => {
          if (!cells[0] || !cells[5]) return null;
          return { date: cells[0], client: cells[1] || '', facture: cells[2] || '', mode: cells[3] || 'virement', reference: cells[4] || '', montant: parseFloat(cells[5]) || 0, statut: cells[6] || 'en_attente', type: cells[7] || 'encaissement', notes: cells[8] || '' };
        },
        () => _renderPaiements(toolbar, area)
      )
    );
  }

  /* ================================================================
     UTILITAIRES EXPORT / IMPORT
     ================================================================ */

  /**
   * Télécharge des données en CSV (séparateur ';', encodage UTF-8 BOM).
   */
  function _dlCSV(filename, headers, rows) {
    const esc  = v => { const s = String(v ?? ''); return s.includes(';') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s; };
    const csv  = [headers.map(esc).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename + '.csv' });
    a.click();
    URL.revokeObjectURL(url);
    if (typeof toast === 'function') toast('Export CSV téléchargé ✓', 'success');
  }

  /**
   * Télécharge des données en XLS (SpreadsheetML).
   */
  function _dlXLS(filename, headers, rows, sheet) {
    if (typeof exportXLS === 'function') {
      exportXLS(filename, headers, rows, sheet || 'Export');
      if (typeof toast === 'function') toast('Export XLS téléchargé ✓', 'success');
    }
  }

  /**
   * Ouvre une fenêtre PDF imprimable.
   */
  function _dlPDF(title, subtitle, headers, rows) {
    if (typeof exportPDF === 'function') {
      exportPDF(title, subtitle, headers, rows);
    }
  }

  /**
   * Ouvre un modal d'import CSV/JSON pour une collection du Store.
   *
   * @param {string}   collectionName - Nom de la collection Store (ex: 'ecritures')
   * @param {string[]} templateHeaders - En-têtes du modèle CSV à télécharger
   * @param {Function} mapRow         - (cells: string[]) => object | null  — mappe une ligne CSV vers un objet Store
   * @param {Function} onDone         - Callback appelé après l'import (pour rafraîchir la vue)
   */
  function _openImportModal(collectionName, templateHeaders, mapRow, onDone) {
    /* Supprimer un ancien modal si présent */
    document.getElementById('hcs-import-overlay')?.remove();

    const labels = {
      ecritures:          'Journal des écritures',
      paiements:          'Paiements',
      factures:           'Factures',
      facturesPartielles: 'Factures partielles / Acomptes',
      depenses:           'Dépenses',
      contacts:           'Clients / Contacts',
      produits:           'Articles / Produits',
    };
    const label = labels[collectionName] || collectionName;

    const overlay = document.createElement('div');
    overlay.id    = 'hcs-import-overlay';
    overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9999;
      display:flex;align-items:center;justify-content:center;`;

    overlay.innerHTML = `
      <div style="background:var(--bg-surface,#fff);border-radius:16px;padding:28px;
        width:560px;max-width:95vw;box-shadow:0 20px 60px rgba(0,0,0,.25);
        display:flex;flex-direction:column;gap:20px;">

        <div style="display:flex;align-items:center;justify-content:space-between;">
          <h3 style="font-size:16px;font-weight:700;">⬆️ Importer — ${label}</h3>
          <button id="imp-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-muted,#6B7280);">✕</button>
        </div>

        <!-- Zone glisser-déposer -->
        <div id="imp-dropzone" style="border:2px dashed var(--border,#E5E9F0);border-radius:12px;
          padding:32px;text-align:center;cursor:pointer;transition:.2s;background:var(--bg-page,#F5F7F9);">
          <div style="font-size:32px;margin-bottom:8px;">📂</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:4px;">Glissez un fichier ici</div>
          <div style="font-size:12px;color:var(--text-muted,#6B7280);">ou cliquez pour choisir — .csv ou .json</div>
          <input id="imp-file" type="file" accept=".csv,.json" style="display:none;">
        </div>

        <!-- Télécharger le modèle CSV -->
        <div style="display:flex;align-items:center;gap:10px;font-size:13px;">
          <button id="imp-tpl" class="btn btn-ghost btn-sm">📥 Télécharger le modèle CSV</button>
          <span style="color:var(--text-muted,#6B7280);font-size:12px;">
            Colonnes : ${templateHeaders.join(' ; ')}
          </span>
        </div>

        <!-- Zone de statut / prévisualisation -->
        <div id="imp-status" style="font-size:13px;min-height:40px;display:none;"></div>

        <!-- Boutons action -->
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button id="imp-cancel" class="btn btn-ghost">Annuler</button>
          <button id="imp-confirm" class="btn btn-primary" disabled>Importer les données</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    let _pendingRecords = [];

    const statusEl  = overlay.querySelector('#imp-status');
    const confirmEl = overlay.querySelector('#imp-confirm');
    const fileInput = overlay.querySelector('#imp-file');
    const dropzone  = overlay.querySelector('#imp-dropzone');

    /* Fermeture */
    const close = () => overlay.remove();
    overlay.querySelector('#imp-close').addEventListener('click',  close);
    overlay.querySelector('#imp-cancel').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    /* Modèle CSV */
    overlay.querySelector('#imp-tpl').addEventListener('click', () => {
      _dlCSV(`modele-${collectionName}`, templateHeaders, [templateHeaders.map(() => '')]);
    });

    /* Drag & drop */
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor='var(--accent-green,#1F7A63)'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor=''; });
    dropzone.addEventListener('drop', e => {
      e.preventDefault(); dropzone.style.borderColor='';
      if (e.dataTransfer.files[0]) _processFile(e.dataTransfer.files[0]);
    });
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => { if (fileInput.files[0]) _processFile(fileInput.files[0]); });

    function _processFile(file) {
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        try {
          if (file.name.endsWith('.json')) {
            /* Import JSON complet de la collection */
            const parsed = JSON.parse(text);
            const arr = Array.isArray(parsed) ? parsed : (parsed[collectionName] || []);
            if (!arr.length) throw new Error('Aucune donnée trouvée dans le JSON.');
            _pendingRecords = arr;
            _showPreview(_pendingRecords);
          } else {
            /* Import CSV */
            if (typeof parseCSV !== 'function') throw new Error('parseCSV non disponible.');
            const lines = parseCSV(text, ';');
            if (lines.length < 2) throw new Error('Le fichier CSV doit contenir au moins une ligne d\'en-tête et une ligne de données.');
            /* Ignorer la première ligne (en-têtes) */
            _pendingRecords = lines.slice(1)
              .map(cells => mapRow(cells))
              .filter(r => r !== null && r !== undefined);
            if (!_pendingRecords.length) throw new Error('Aucune ligne valide trouvée dans le CSV.');
            _showPreview(_pendingRecords);
          }
        } catch (err) {
          statusEl.style.display = 'block';
          statusEl.innerHTML = `<div style="color:#DC2626;background:#FEF2F2;border:1px solid #FCA5A5;
            padding:10px;border-radius:8px;">⚠ ${err.message}</div>`;
          confirmEl.disabled = true;
        }
      };
      reader.readAsText(file, 'UTF-8');
    }

    function _showPreview(records) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = `
        <div style="background:#F0FDF4;border:1px solid #86EFAC;padding:10px 14px;border-radius:8px;color:#166534;">
          ✅ <strong>${records.length} enregistrement(s)</strong> prêts à importer dans « ${label} ».
          <br><span style="font-size:11px;color:#6B7280;">Les doublons (même id) seront ignorés.</span>
        </div>`;
      confirmEl.disabled = false;
    }

    /* Confirmation */
    confirmEl.addEventListener('click', () => {
      if (!_pendingRecords.length) return;
      const existing = Store.getAll(collectionName).map(r => r.id);
      let inserted = 0;
      _pendingRecords.forEach(r => {
        if (r.id && existing.includes(r.id)) return; /* Ignorer doublons */
        Store.create(collectionName, r);
        inserted++;
      });
      if (typeof toast === 'function') toast(`${inserted} enregistrement(s) importé(s) ✓`, 'success');
      close();
      if (typeof onDone === 'function') onDone();
    });
  }

  /* ================================================================
     VUE : BILAN ACTIF / PASSIF
     ================================================================ */
  function _renderBilan(toolbar, area) {
    const now   = new Date().getFullYear();
    const years = [now, now-1, now-2];
    toolbar.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        <label style="font-size:13px;color:var(--text-secondary);">Exercice :</label>
        <select id="bilan-year" class="form-input" style="width:100px;font-size:13px;padding:6px 8px;">
          ${years.map(y=>`<option value="${y}" ${_state.year===y?'selected':''}>${y}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:6px;margin-left:auto;">
        <button class="btn btn-ghost btn-sm" id="bil-csv" title="Exporter CSV">📥 CSV</button>
        <button class="btn btn-ghost btn-sm" id="bil-xls" title="Exporter Excel">📊 XLS</button>
        <button class="btn btn-ghost btn-sm" id="bil-pdf" title="Exporter PDF">🖨️ PDF</button>
      </div>`;

    toolbar.querySelector('#bilan-year').addEventListener('change', e => {
      _state.year = parseInt(e.target.value);
      _renderBilan(toolbar, area);
    });

    const year      = _state.year;
    const ecritures = Store.getAll('ecritures').filter(e => e.date && new Date(e.date).getFullYear() === year);
    const factures  = Store.getAll('factures').filter(f => f.date && new Date(f.date).getFullYear() === year);
    const bonsAchat = Store.getAll('bonsAchat').filter(b => b.statut==='Reçu' && b.date && new Date(b.date).getFullYear() === year);

    const ca      = factures.reduce((s,f)  => s+(f.totalHT||0), 0);
    const charges = bonsAchat.reduce((s,b) => s+(b.totalHT||0), 0);
    const resultat = ca - charges;

    /* Calcul soldes par compte */
    const solde = (num) => {
      const comp = PLAN_COMPTABLE.find(c => c.numero === num);
      const ents = ecritures.filter(e => e.compte && e.compte.startsWith(num.slice(0,3)));
      const d = ents.reduce((s,e)=>s+(e.debit||0),0);
      const cr= ents.reduce((s,e)=>s+(e.credit||0),0);
      if (!comp) return d - cr;
      return (comp.type==='Actif'||comp.type==='Charge') ? d-cr : cr-d;
    };

    const tresorerie = (['512000','530000']).reduce((s,n)=>s+Math.max(0,solde(n)),0);
    const clients    = Math.max(0, solde('411000'));
    const tvaDeduc  = Math.max(0, solde('445660'));
    const totalActif = tresorerie + clients + tvaDeduc;

    const fournisseurs = Math.max(0, solde('401000'));
    const tvaCollect  = Math.max(0, solde('445810'));
    const totalPassif  = fournisseurs + tvaCollect + (resultat>0?resultat:0);

    const fmtXPF = n => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'XPF',maximumFractionDigits:0}).format(n||0);

    area.innerHTML = `
      <div class="acc-bilan-wrapper" style="padding:16px 0;">
        <div class="acc-bilan-header">
          <div class="acc-bilan-title-area">
            <h2>Bilan au 31/12/${year}</h2>
            <span class="acc-bilan-status ${Math.abs(totalActif-totalPassif)<1?'equil':'deseq'}">
              ${Math.abs(totalActif-totalPassif)<1?'⚖ Équilibré':'⚠ Déséquilibre'}
            </span>
          </div>
        </div>

        <div class="acc-bilan-grid">
          <!-- ACTIF -->
          <div class="acc-bilan-side acc-actif">
            <div class="acc-bilan-side-header">ACTIF</div>
            <div class="acc-bilan-group">
              <div class="acc-bilan-group-title">Trésorerie</div>
              <div class="acc-bilan-line"><span>Banque (512000)</span><span>${fmtXPF(Math.max(0,solde('512000')))}</span></div>
              <div class="acc-bilan-line"><span>Caisse (530000)</span><span>${fmtXPF(Math.max(0,solde('530000')))}</span></div>
              <div class="acc-bilan-subtotal"><span>Sous-total trésorerie</span><span>${fmtXPF(tresorerie)}</span></div>
            </div>
            <div class="acc-bilan-group">
              <div class="acc-bilan-group-title">Actif circulant</div>
              <div class="acc-bilan-line"><span>Clients (411000)</span><span>${fmtXPF(clients)}</span></div>
              <div class="acc-bilan-line"><span>TVA déductible (445660)</span><span>${fmtXPF(tvaDeduc)}</span></div>
              <div class="acc-bilan-subtotal"><span>Sous-total circulant</span><span>${fmtXPF(clients+tvaDeduc)}</span></div>
            </div>
            <div class="acc-bilan-total"><span>TOTAL ACTIF</span><span>${fmtXPF(totalActif)}</span></div>
          </div>

          <!-- PASSIF -->
          <div class="acc-bilan-side acc-passif">
            <div class="acc-bilan-side-header">PASSIF</div>
            <div class="acc-bilan-group">
              <div class="acc-bilan-group-title">Résultat</div>
              <div class="acc-bilan-line">
                <span>Résultat net ${year}</span>
                <span class="${resultat>=0?'text-success':'text-danger'}">${fmtXPF(Math.abs(resultat))} ${resultat>=0?'(bén.)':'(perte)'}</span>
              </div>
            </div>
            <div class="acc-bilan-group">
              <div class="acc-bilan-group-title">Dettes</div>
              <div class="acc-bilan-line"><span>Fournisseurs (401000)</span><span>${fmtXPF(fournisseurs)}</span></div>
              <div class="acc-bilan-line"><span>TVA collectée (445810)</span><span>${fmtXPF(tvaCollect)}</span></div>
              <div class="acc-bilan-subtotal"><span>Sous-total dettes</span><span>${fmtXPF(fournisseurs+tvaCollect)}</span></div>
            </div>
            <div class="acc-bilan-total"><span>TOTAL PASSIF</span><span>${fmtXPF(totalPassif)}</span></div>
          </div>
        </div>

        <!-- Compte de Résultat résumé -->
        <div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-top:20px;">
          <h3 class="acc-cr-title">Compte de Résultat — Exercice ${year}</h3>
          <div class="acc-cr-grid" style="margin-top:16px;">
            <div class="acc-cr-side">
              <div class="acc-cr-header">CHARGES</div>
              <div class="acc-bilan-line" style="padding:12px 20px;">
                <span>Achats (607000 + 601000)</span>
                <span style="font-weight:700;">${fmtXPF(charges)}</span>
              </div>
              <div class="acc-bilan-line acc-resultat-line" style="padding:12px 20px;margin:8px;">
                <span><strong>Résultat net</strong></span>
                <span class="${resultat>=0?'text-success':'text-danger'}"><strong>${fmtXPF(Math.max(0,resultat))}</strong></span>
              </div>
              <div class="acc-bilan-total"><span>TOTAL</span><span>${fmtXPF(ca)}</span></div>
            </div>
            <div class="acc-cr-side">
              <div class="acc-cr-header">PRODUITS</div>
              <div class="acc-bilan-line" style="padding:12px 20px;">
                <span>Ventes (701000 + 706000)</span>
                <span style="font-weight:700;">${fmtXPF(ca)}</span>
              </div>
              <div class="acc-bilan-total"><span>TOTAL</span><span>${fmtXPF(ca)}</span></div>
            </div>
          </div>
        </div>
      </div>`;

    /* Export bilan */
    const bilHdrs = ['Poste', 'Côté', 'Montant (XPF)'];
    const bilRows = [
      ['Trésorerie (512+530)',    'Actif',  tresorerie],
      ['Clients (411)',           'Actif',  clients],
      ['TVA déductible (445)',    'Actif',  tvaDeduc],
      ['TOTAL ACTIF',             'Actif',  totalActif],
      ['Fournisseurs (401)',       'Passif', fournisseurs],
      ['TVA collectée (445)',      'Passif', tvaCollect],
      ['Résultat net',            'Passif', Math.max(0, resultat)],
      ['TOTAL PASSIF',            'Passif', totalPassif],
      ['Chiffre d\'affaires HT',  'CR',     ca],
      ['Charges HT',              'CR',     charges],
      ['Résultat net',            'CR',     resultat],
    ];
    toolbar.querySelector('#bil-csv').addEventListener('click', () => _dlCSV(`hcs-bilan-${year}`, bilHdrs, bilRows));
    toolbar.querySelector('#bil-xls').addEventListener('click', () => _dlXLS(`hcs-bilan-${year}`, bilHdrs, bilRows, `Bilan ${year}`));
    toolbar.querySelector('#bil-pdf').addEventListener('click', () => _dlPDF(`Bilan au 31/12/${year}`, `Compte de résultat ${year}`, bilHdrs, bilRows));
  }

  /* ================================================================
     VUE : ASSISTANT COMPTABLE IA
     ================================================================ */
  let _chatHistory = [];
  let _chatTyping  = false;

  function _renderAssistant(toolbar, area) {
    toolbar.innerHTML = `
      <button class="btn btn-outline btn-sm" id="clear-chat-btn-erp">🗑 Effacer la conversation</button>`;

    area.innerHTML = `
      <div class="acc-assistant-wrapper" style="padding:16px 0;height:calc(100vh - 160px);">
        <!-- Sidebar suggestions -->
        <div class="acc-assistant-sidebar">
          <div class="acc-asst-profile">
            <div class="acc-asst-avatar">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5">
                <circle cx="12" cy="8" r="4"/><path d="M6 20v-2a6 6 0 0 1 12 0v2"/>
              </svg>
            </div>
            <div>
              <div class="acc-asst-name">Expert Comptable IA</div>
              <div class="acc-asst-status">● En ligne</div>
            </div>
          </div>
          <div class="acc-asst-desc">
            Assistant spécialisé en comptabilité (TGC Polynésie, PCG, bilans, écritures, modes de paiement).
          </div>
          <div class="acc-asst-suggestions">
            <div class="acc-asst-sugg-title">Questions fréquentes</div>
            ${[
              'Comment passer une écriture de vente ?',
              'Qu\'est-ce que la TGC en Polynésie ?',
              'Comment calculer l\'amortissement ?',
              'Différence débit / crédit ?',
              'Comment équilibrer un journal ?',
              'Comment déclarer la TGC ?',
              'C\'est quoi une lettre de change ?',
              'Principe de prudence en comptabilité ?',
            ].map(q=>`<button class="acc-asst-pill" data-question="${q}">${q}</button>`).join('')}
          </div>
        </div>

        <!-- Chat -->
        <div class="acc-assistant-chat">
          <div class="acc-chat-header">
            <span>💬 Assistant Expert Comptable — HCS ERP</span>
          </div>
          <div class="acc-chat-messages" id="erp-chat-messages">
            <div class="acc-chat-msg acc-chat-ai">
              <div class="acc-chat-bubble">
                <strong>Bonjour ! 👋</strong> Je suis votre assistant comptable expert. Je peux vous aider avec :<br><br>
                • <strong>Écritures comptables</strong> (journal, lettrage, plan comptable HCS)<br>
                • <strong>TGC Polynésie</strong> (calcul, déclaration, taux applicables)<br>
                • <strong>Bilan & Compte de résultat</strong> (interprétation, ratios)<br>
                • <strong>Paiements</strong> (virement, LCR, prélèvement, chèque)<br><br>
                Comment puis-je vous aider ?
              </div>
              <div class="acc-chat-time">${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
          <div class="acc-chat-input-area">
            <textarea class="acc-chat-input" id="erp-chat-input" placeholder="Posez votre question comptable…" rows="2"></textarea>
            <button class="acc-chat-send" id="erp-chat-send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div class="acc-chat-typing" id="erp-chat-typing" style="display:none">
            <span class="acc-typing-dot"></span>
            <span class="acc-typing-dot"></span>
            <span class="acc-typing-dot"></span>
            <span style="margin-left:6px;font-size:12px;color:var(--text-muted)">L'expert comptable rédige…</span>
          </div>
        </div>
      </div>`;

    /* Effacer */
    document.getElementById('clear-chat-btn-erp').addEventListener('click', () => {
      _chatHistory = [];
      const msgs = document.getElementById('erp-chat-messages');
      if (msgs) msgs.innerHTML = '';
    });

    /* Suggestions rapides */
    area.querySelectorAll('.acc-asst-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const input = document.getElementById('erp-chat-input');
        if (input) { input.value = pill.dataset.question; input.focus(); }
      });
    });

    /* Envoi message */
    const sendBtn = document.getElementById('erp-chat-send');
    const input   = document.getElementById('erp-chat-input');

    const sendMsg = () => {
      const msg = input.value.trim();
      if (!msg || _chatTyping) return;
      _addChatMsg('user', msg);
      input.value = '';
      _askAI(msg);
    };

    sendBtn.addEventListener('click', sendMsg);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
  }

  function _addChatMsg(role, content) {
    const msgs = document.getElementById('erp-chat-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = `acc-chat-msg acc-chat-${role === 'user' ? 'user' : 'ai'}`;
    div.innerHTML = `
      <div class="acc-chat-bubble">
        ${content.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}
      </div>
      <div class="acc-chat-time">${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>`;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    _chatHistory.push({ role, content });
  }

  async function _askAI(message) {
    _chatTyping = true;
    const typing = document.getElementById('erp-chat-typing');
    if (typing) typing.style.display = 'flex';

    const systemPrompt = `Tu es un expert-comptable spécialisé dans les PME de Polynésie française.
Tu maîtrises : le Plan Comptable Général (PCG), la TGC (Taxe Générale à la Consommation) de Polynésie,
les journaux comptables (ventes, achats, banque, caisse, OD), les bilans et comptes de résultat,
les modes de paiement (virement SEPA, chèque, carte, espèces, prélèvement, lettre de change LCR),
les liasses fiscales et la paie.
Tu réponds toujours en français, de manière claire et professionnelle.
Pour les écritures, tu donnes toujours les numéros de compte PCG exacts.
Sois direct et utile, avec des exemples concrets.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ..._chatHistory.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
            { role: 'user', content: message }
          ]
        })
      });
      const data = await response.json();
      if (typing) typing.style.display = 'none';
      _chatTyping = false;
      const reply = data.content?.[0]?.text || 'Désolé, une erreur s\'est produite.';
      _addChatMsg('ai', reply);
    } catch {
      if (typing) typing.style.display = 'none';
      _chatTyping = false;
      _addChatMsg('ai', 'Erreur de connexion. Vérifiez votre réseau.');
    }
  }

  return {
    init,
    /* Tableau de bord — exposé pour les onclick inline */
    _tbSetPeriode,
    _tbNavPeriode,
    /* Dépenses & TVA — exposé pour les onclick inline */
    _depOpenForm,
    _depToggleSaisie,
    _depRecalc,
    _depSave,
    _depDelete,
    _depSetPeriode,
    _depNavPeriode,
    _depSetFilter,
    _depSort,
    _depExportCSV,
    _depExportXLS,
    /* Export / Import — exposé pour usage externe éventuel */
    _dlCSV,
    _dlXLS,
    _dlPDF,
    _openImportModal
  };

})();

window.Accounting = Accounting;
