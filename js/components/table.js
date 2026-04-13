/* ================================================================
   HCS ERP — js/components/table.js
   Composant table réutilisable : tri, recherche live, clics.
   Usage : renderTable('mon-id', { columns, data, ... })
   ================================================================ */

'use strict';

/**
 * État interne de chaque table instanciée.
 * Clé = containerId, valeur = { config, sortKey, sortDir, query }
 */
const _tableState = {};

/* ----------------------------------------------------------------
   renderTable(containerId, config)
   Point d'entrée public.

   @param {string} containerId - id du div cible
   @param {object} config
     - columns    {Array}    colonnes (voir JSDoc colonne ci-dessous)
     - data       {Array}    tableau d'objets
     - searchable {boolean}  afficher la barre de recherche
     - sortable   {boolean}  autoriser le tri par colonne
     - onRowClick {Function} callback(item) au clic sur une ligne
     - actions    {Array}    [{label, icon, onClick, className}]
     - emptyMsg   {string}   message si aucun résultat
     - title      {string}   titre optionnel au-dessus de la table

   Colonne :
     - key       {string}   clé dans l'objet data
     - label     {string}   en-tête
     - type      {string}   'text'|'money'|'date'|'badge'|'actions'
     - width     {string}   ex: '120px'
     - badgeMap  {object}   { 'Payé': 'badge-green', ... }
     - sortKey   {string}   clé de tri différente (optionnel)
     - render    {Function} renderer custom(value, item) → HTML
----------------------------------------------------------------- */
function renderTable(containerId, config) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[Table] Conteneur #${containerId} introuvable`);
    return;
  }

  // Initialiser ou mettre à jour l'état
  if (!_tableState[containerId]) {
    _tableState[containerId] = {
      sortKey: null,
      sortDir: 'asc',
      query:   ''
    };
  }

  // Fusionner la config et l'état courant
  _tableState[containerId].config = config;

  _drawTable(containerId);
}

/* ----------------------------------------------------------------
   _drawTable — rendu complet (appelé à chaque update)
   ---------------------------------------------------------------- */
function _drawTable(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state  = _tableState[containerId];
  const config = state.config;

  const {
    columns    = [],
    data       = [],
    searchable = true,
    sortable   = true,
    onRowClick = null,
    actions    = [],
    emptyMsg   = 'Aucun résultat.',
    title      = ''
  } = config;

  /* --- 1. Filtrage par recherche --- */
  let rows = _filterRows(data, state.query, columns);

  /* --- 2. Tri --- */
  if (state.sortKey) {
    rows = _sortRows(rows, state.sortKey, state.sortDir);
  }

  /* --- 3. Construction HTML --- */
  let html = '';

  // Titre optionnel + barre de recherche + export CSV
  const _exportable = config.exportable !== false; // true par défaut
  if (title || searchable || _exportable) {
    html += `<div class="table-toolbar" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;gap:12px;">`;
    if (title) {
      html += `<div class="card-title">${title}</div>`;
    }
    html += `<div style="margin-left:auto;display:flex;gap:8px;align-items:center;">`;
    // Bouton export CSV (uniquement si des données)
    if (_exportable && data.length > 0) {
      html += `<button class="btn btn-ghost btn-sm"
        data-table-export="${containerId}"
        style="font-size:12px;white-space:nowrap;"
        title="Télécharger en CSV">📥 CSV</button>`;
    }
    if (searchable) {
      html += `<input
          type="text"
          class="search-input"
          style="width:220px;"
          placeholder="Rechercher…"
          value="${_esc(state.query)}"
          data-table-search="${containerId}"
        />`;
    }
    html += `</div></div>`;
  }

  // Wrapper table
  html += `<div class="table-wrapper">`;
  html += `<table class="data-table">`;

  /* --- En-têtes --- */
  html += `<thead><tr>`;
  columns.forEach(col => {
    if (col.type === 'actions') {
      html += `<th style="width:${col.width || '80px'};text-align:right;">Actions</th>`;
      return;
    }

    const sk = col.sortKey || col.key;
    const isActive = state.sortKey === sk;
    const arrow = isActive ? (state.sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    const cursor = sortable ? 'cursor:pointer;user-select:none;' : '';
    const widthAttr = col.width ? `style="width:${col.width};${cursor}"` : `style="${cursor}"`;
    const sortAttr  = sortable ? `data-table-sort="${containerId}" data-sort-key="${sk}"` : '';

    html += `<th ${widthAttr} ${sortAttr}>${col.label}${arrow}</th>`;
  });
  html += `</tr></thead>`;

  /* --- Corps --- */
  html += `<tbody>`;

  if (rows.length === 0) {
    html += `<tr>
      <td colspan="${columns.length}" class="table-empty">
        <div class="empty-icon">🔍</div>
        <p>${emptyMsg}</p>
      </td>
    </tr>`;
  } else {
    rows.forEach((item, rowIndex) => {
      const clickable = onRowClick ? 'style="cursor:pointer;"' : '';
      const clickAttr = onRowClick ? `data-table-row="${containerId}" data-row-index="${rowIndex}"` : '';
      html += `<tr ${clickable} ${clickAttr}>`;

      columns.forEach(col => {
        if (col.type === 'actions') {
          html += `<td style="text-align:right;white-space:nowrap;">`;
          // Boutons d'action sur la ligne
          const lineActions = (col.actions || actions);
          lineActions.forEach((act, ai) => {
            const cls = act.className || 'btn btn-ghost btn-sm';
            html += `<button
              class="${cls}"
              style="margin-left:4px;"
              data-table-action="${containerId}"
              data-action-index="${ai}"
              data-row-index="${rowIndex}"
              title="${_esc(act.label)}"
            >${act.icon || act.label}</button>`;
          });
          html += `</td>`;
          return;
        }

        html += `<td${_cellStyle(col)}>`;
        html += _renderCell(item, col, rowIndex);
        html += `</td>`;
      });

      html += `</tr>`;
    });
  }

  html += `</tbody></table></div>`;

  container.innerHTML = html;

  /* --- 4. Liaison des événements --- */
  _bindTableEvents(containerId, rows, actions);
}

/* ----------------------------------------------------------------
   _renderCell — rendu d'une cellule selon son type
   ---------------------------------------------------------------- */
function _renderCell(item, col, rowIndex) {
  // Renderer custom prioritaire
  if (typeof col.render === 'function') {
    return col.render(item[col.key], item);
  }

  const val = item[col.key];

  switch (col.type) {
    case 'money':
      return `<span class="mono">${typeof fmt === 'function' ? fmt(val || 0) : (val || 0) + ' XPF'}</span>`;

    case 'date':
      return typeof fmtDate === 'function' ? fmtDate(val) : (val || '—');

    case 'badge': {
      const badgeMap  = col.badgeMap || {};
      const badgeCls  = badgeMap[val] || 'badge-gray';
      return val ? `<span class="badge ${badgeCls}">${val}</span>` : '—';
    }

    case 'actions':
      return ''; // géré dans la boucle principale

    default: // 'text'
      return val !== null && val !== undefined ? _esc(String(val)) : '—';
  }
}

/* ----------------------------------------------------------------
   _cellStyle — attribut style pour l'alignement selon le type
   ---------------------------------------------------------------- */
function _cellStyle(col) {
  if (col.type === 'money') return ' class="col-amount"';
  if (col.key === 'ref' || col.key === 'numero' || col.key === 'sku') return ' class="col-ref"';
  return '';
}

/* ----------------------------------------------------------------
   _filterRows — recherche textuelle dans toutes les colonnes text/date
   ---------------------------------------------------------------- */
function _filterRows(data, query, columns) {
  if (!query || !query.trim()) return data;
  const q = query.toLowerCase();
  const searchCols = columns.filter(c => c.type !== 'actions');

  return data.filter(item =>
    searchCols.some(col => {
      const val = item[col.key];
      return val !== null && val !== undefined &&
             String(val).toLowerCase().includes(q);
    })
  );
}

/* ----------------------------------------------------------------
   _sortRows — tri par colonne
   ---------------------------------------------------------------- */
function _sortRows(data, key, dir) {
  return [...data].sort((a, b) => {
    let va = a[key];
    let vb = b[key];

    // Comparaison numérique si les deux sont des nombres
    if (typeof va === 'number' && typeof vb === 'number') {
      return dir === 'asc' ? va - vb : vb - va;
    }

    // Comparaison de dates (string ISO)
    if (va && vb && !isNaN(Date.parse(va)) && !isNaN(Date.parse(vb))) {
      return dir === 'asc'
        ? new Date(va) - new Date(vb)
        : new Date(vb) - new Date(va);
    }

    // Comparaison textuelle
    va = String(va || '').toLowerCase();
    vb = String(vb || '').toLowerCase();
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ?  1 : -1;
    return 0;
  });
}

/* ----------------------------------------------------------------
   _bindTableEvents — recherche, tri, clics sur lignes et actions
   ---------------------------------------------------------------- */
function _bindTableEvents(containerId, rows, globalActions) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state  = _tableState[containerId];
  const config = state.config;

  /* Export CSV */
  const exportBtn = container.querySelector(`[data-table-export="${containerId}"]`);
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const cols = (columns || []).filter(c => c.type !== 'actions');
      const header = cols.map(c => `"${String(c.label).replace(/"/g, '""')}"`).join(';');
      const csvRows = rows.map(item =>
        cols.map(c => {
          const v = item[c.key];
          if (v === null || v === undefined) return '""';
          return `"${String(v).replace(/"/g, '""')}"`;
        }).join(';')
      );
      const csv = '\ufeff' + [header, ...csvRows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = (config.title || 'export') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  /* Recherche live */
  const searchEl = container.querySelector(`[data-table-search="${containerId}"]`);
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      state.query = e.target.value;
      _drawTable(containerId);
    });
    // Conserver le focus après le re-rendu
    searchEl.focus();
  }

  /* Tri des colonnes */
  container.querySelectorAll(`[data-table-sort="${containerId}"]`).forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (state.sortKey === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'asc';
      }
      _drawTable(containerId);
    });
  });

  /* Clic sur une ligne */
  if (typeof config.onRowClick === 'function') {
    container.querySelectorAll(`[data-table-row="${containerId}"]`).forEach(tr => {
      tr.addEventListener('click', (e) => {
        // Ne pas déclencher si c'est un bouton d'action
        if (e.target.closest('[data-table-action]')) return;
        const idx = parseInt(tr.dataset.rowIndex, 10);
        config.onRowClick(rows[idx]);
      });
    });
  }

  /* Boutons d'action par ligne */
  container.querySelectorAll(`[data-table-action="${containerId}"]`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ai  = parseInt(btn.dataset.actionIndex, 10);
      const ri  = parseInt(btn.dataset.rowIndex, 10);
      const act = (config.actions || [])[ai];
      if (act && typeof act.onClick === 'function') {
        act.onClick(rows[ri]);
      }
    });
  });
}

/* ----------------------------------------------------------------
   Utilitaire : échapper le HTML pour éviter les XSS
   ---------------------------------------------------------------- */
function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ----------------------------------------------------------------
   API publique
   ---------------------------------------------------------------- */
// Exposé globalement pour utilisation dans app.js et les modules
window.renderTable = renderTable;
