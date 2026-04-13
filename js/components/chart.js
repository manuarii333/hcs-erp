/* ================================================================
   HCS ERP — js/components/chart.js
   Graphiques CSS purs : barres, camembert, carte KPI.
   Aucune dépendance externe — rendu entièrement via HTML/CSS.
   ================================================================ */

'use strict';

/* ----------------------------------------------------------------
   Injection des styles une seule fois
   ---------------------------------------------------------------- */
function _injectChartStyles() {
  if (document.getElementById('chart-styles')) return;

  const style = document.createElement('style');
  style.id = 'chart-styles';
  style.textContent = `
    /* ---- COMMUN ---- */
    .hcs-chart { font-family: var(--font-sans, 'DM Sans', sans-serif); }

    /* ---- BAR CHART ---- */
    .bar-chart {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 100%;
    }

    .bar-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .bar-label {
      flex-shrink: 0;
      width: 130px;
      font-size: 13px;
      color: var(--text-secondary, #8892b0);
      text-align: right;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .bar-track {
      flex: 1;
      height: 100%;
      background: var(--bg-elevated, #0f1120);
      border-radius: 4px;
      overflow: hidden;
      position: relative;
    }

    .bar-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      min-width: 2px;
      position: relative;
    }

    .bar-value {
      flex-shrink: 0;
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 12px;
      color: var(--text-secondary, #8892b0);
      min-width: 90px;
      text-align: left;
    }

    /* Tooltip valeur sur survol */
    .bar-fill::after {
      content: attr(data-value);
      position: absolute;
      right: 6px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 11px;
      font-family: var(--font-mono, monospace);
      color: rgba(255,255,255,0.8);
      white-space: nowrap;
      pointer-events: none;
    }

    /* ---- PIE CHART ---- */
    .pie-chart-wrapper {
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    .pie-chart-canvas {
      border-radius: 50%;
      flex-shrink: 0;
      transition: transform 0.3s ease;
    }
    .pie-chart-canvas:hover { transform: scale(1.03); }

    .pie-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 140px;
    }

    .pie-legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--text-secondary, #8892b0);
    }

    .pie-legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .pie-legend-label { flex: 1; }
    .pie-legend-pct {
      font-family: var(--font-mono, monospace);
      font-size: 12px;
      color: var(--text-muted, #4a5270);
    }

    /* ---- STAT CARD ---- */
    .stat-card {
      background: var(--bg-surface, #0a0c16);
      border: 1px solid var(--border, #1e2240);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      transition: box-shadow 0.2s ease;
    }
    .stat-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.4); }

    .stat-card-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .stat-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
    }

    .stat-card-trend {
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 3px;
    }

    .stat-card-value {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--text-primary, #e8eaf6);
      line-height: 1.1;
    }

    .stat-card-label {
      font-size: 12px;
      color: var(--text-muted, #4a5270);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      font-weight: 600;
    }

    .stat-card-sub {
      font-size: 12px;
      color: var(--text-secondary, #8892b0);
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);
}

/* ================================================================
   barChart(containerId, config)
   Barres horizontales en CSS pur.

   @param {string} containerId
   @param {object} config
     - labels   {string[]}  étiquettes des barres
     - values   {number[]}  valeurs
     - colors   {string[]}  couleurs CSS (optionnel, défaut: accent bleu)
     - height   {number}    hauteur de chaque barre en px (défaut: 28)
     - showValues {boolean} afficher les valeurs à droite (défaut: true)
     - formatter {Function} (value) → string pour l'affichage
     - title    {string}    titre optionnel
   ================================================================ */
function barChart(containerId, config = {}) {
  _injectChartStyles();

  const container = document.getElementById(containerId);
  if (!container) return;

  const {
    labels     = [],
    values     = [],
    colors     = [],
    height     = 28,
    showValues = true,
    formatter  = null,
    title      = ''
  } = config;

  /* Valeur max pour calculer les proportions */
  const maxVal = Math.max(...values, 1);

  /* Palette de couleurs par défaut */
  const palette = [
    '#4a5fff', '#00d4aa', '#ffc857', '#ff6b6b', '#b07bff',
    '#00b4d8', '#f77f00', '#9b5de5', '#2ec4b6', '#e63946'
  ];

  let html = `<div class="hcs-chart bar-chart">`;

  if (title) {
    html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);
      margin-bottom:4px;">${_escC(title)}</div>`;
  }

  labels.forEach((label, i) => {
    const val     = values[i] || 0;
    const pct     = maxVal > 0 ? (val / maxVal) * 100 : 0;
    const color   = colors[i] || palette[i % palette.length];
    const display = typeof formatter === 'function'
      ? formatter(val)
      : (typeof fmt === 'function' ? fmt(val) : val.toLocaleString('fr-FR'));

    html += `
      <div class="bar-row" style="height:${height}px;">
        <div class="bar-label" title="${_escC(label)}">${_escC(label)}</div>
        <div class="bar-track" style="height:${height}px;">
          <div class="bar-fill"
            style="width:${pct.toFixed(2)}%;background:${color};height:${height}px;"
            data-value="${_escC(display)}">
          </div>
        </div>
        ${showValues
          ? `<div class="bar-value">${_escC(display)}</div>`
          : ''}
      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;

  /* Animer depuis 0 après le rendu */
  requestAnimationFrame(() => {
    container.querySelectorAll('.bar-fill').forEach((bar, i) => {
      const pct = values[i] ? ((values[i] / maxVal) * 100).toFixed(2) : 0;
      bar.style.width = '0%';
      requestAnimationFrame(() => {
        bar.style.width = pct + '%';
      });
    });
  });
}

/* ================================================================
   pieChart(containerId, config)
   Camembert via CSS conic-gradient.

   @param {string} containerId
   @param {object} config
     - segments [{label, value, color}]
     - size     {number}  diamètre en px (défaut: 160)
     - donut    {boolean} trou central (défaut: false)
     - title    {string}  titre optionnel
   ================================================================ */
function pieChart(containerId, config = {}) {
  _injectChartStyles();

  const container = document.getElementById(containerId);
  if (!container) return;

  const {
    segments = [],
    size     = 160,
    donut    = false,
    title    = ''
  } = config;

  /* Calcul des angles pour conic-gradient */
  const total = segments.reduce((s, seg) => s + (seg.value || 0), 0);
  if (total === 0) {
    container.innerHTML = `<div class="table-empty"><p>Pas de données</p></div>`;
    return;
  }

  /* Construction du gradient */
  let cumPct = 0;
  const gradientParts = segments.map(seg => {
    const pct  = (seg.value / total) * 100;
    const from = cumPct;
    const to   = cumPct + pct;
    cumPct = to;
    return `${seg.color || '#4a5fff'} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
  });

  const gradient = `conic-gradient(${gradientParts.join(', ')})`;

  /* Trou donut */
  const donutMask = donut
    ? `background: var(--bg-surface, #0a0c16); position:absolute; width:55%; height:55%;
       border-radius:50%; top:50%; left:50%; transform:translate(-50%,-50%);`
    : '';

  /* Légende */
  const legendHtml = segments.map(seg => {
    const pct = ((seg.value / total) * 100).toFixed(1);
    return `
      <div class="pie-legend-item">
        <div class="pie-legend-dot" style="background:${seg.color || '#4a5fff'};"></div>
        <span class="pie-legend-label">${_escC(seg.label)}</span>
        <span class="pie-legend-pct">${pct}%</span>
      </div>`;
  }).join('');

  let html = `<div class="hcs-chart">`;
  if (title) {
    html += `<div style="font-size:13px;font-weight:600;color:var(--text-secondary);
      margin-bottom:12px;">${_escC(title)}</div>`;
  }

  html += `
    <div class="pie-chart-wrapper">
      <div style="position:relative;width:${size}px;height:${size}px;flex-shrink:0;">
        <div class="pie-chart-canvas"
          style="width:${size}px;height:${size}px;background:${gradient};">
        </div>
        ${donut ? `<div style="${donutMask}"></div>` : ''}
      </div>
      <div class="pie-legend">${legendHtml}</div>
    </div>
  </div>`;

  container.innerHTML = html;
}

/* ================================================================
   statCard(containerId, config)
   Carte KPI avec icône, valeur principale, libellé, tendance.

   @param {string} containerId
   @param {object} config
     - icon    {string}  emoji ou caractère
     - value   {string|number}  valeur principale
     - label   {string}  libellé sous la valeur
     - color   {string}  couleur accent CSS
     - trend   {object}  { value: '+12%', up: true } (optionnel)
     - sub     {string}  texte secondaire sous le label (optionnel)
     - format  {boolean} si true et value est un number, utilise fmt() (défaut: false)
   ================================================================ */
function statCard(containerId, config = {}) {
  _injectChartStyles();

  const container = document.getElementById(containerId);
  if (!container) return;

  const {
    icon   = '📊',
    value  = 0,
    label  = '',
    color  = 'var(--accent-blue)',
    trend  = null,
    sub    = '',
    format = false
  } = config;

  /* Formater la valeur si demandé */
  const displayValue = format && typeof value === 'number' && typeof fmt === 'function'
    ? fmt(value)
    : String(value);

  /* Tendance */
  let trendHtml = '';
  if (trend) {
    const trendColor = trend.up ? 'var(--accent-green)' : 'var(--accent-red)';
    const trendArrow = trend.up ? '↑' : '↓';
    trendHtml = `
      <div class="stat-card-trend" style="color:${trendColor};">
        ${trendArrow} ${_escC(String(trend.value))}
      </div>`;
  }

  container.innerHTML = `
    <div class="hcs-chart stat-card" style="border-left:3px solid ${color};">
      <div class="stat-card-top">
        <div class="stat-card-icon" style="background:${color}20;">
          ${icon}
        </div>
        ${trendHtml}
      </div>
      <div class="stat-card-value">${_escC(displayValue)}</div>
      <div class="stat-card-label">${_escC(label)}</div>
      ${sub ? `<div class="stat-card-sub">${_escC(sub)}</div>` : ''}
    </div>
  `;
}

/* ================================================================
   lineChart (sparkline CSS) — bonus
   Mini graphique linéaire représenté par des barres de hauteur variable.

   @param {string} containerId
   @param {object} config
     - values  {number[]}
     - color   {string}
     - height  {number}  px (défaut: 48)
     - label   {string}
   ================================================================ */
function sparkline(containerId, config = {}) {
  _injectChartStyles();

  const container = document.getElementById(containerId);
  if (!container) return;

  const {
    values = [],
    color  = 'var(--accent-blue)',
    height = 48,
    label  = ''
  } = config;

  if (values.length === 0) {
    container.innerHTML = '';
    return;
  }

  const maxVal = Math.max(...values, 1);
  const barW   = Math.max(4, Math.floor(container.offsetWidth / values.length) - 2);

  const barsHtml = values.map(v => {
    const h   = Math.max(2, Math.round((v / maxVal) * height));
    const pct = ((v / maxVal) * 100).toFixed(1);
    return `<div title="${v}" style="
      width:${barW}px;
      height:${h}px;
      background:${color};
      border-radius:2px 2px 0 0;
      opacity:0.75;
      transition:opacity 0.2s;
      flex-shrink:0;
      align-self:flex-end;
    " onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.75"></div>`;
  }).join('');

  container.innerHTML = `
    <div style="display:flex;align-items:flex-end;gap:2px;height:${height}px;overflow:hidden;">
      ${barsHtml}
    </div>
    ${label ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${_escC(label)}</div>` : ''}
  `;
}

/* ----------------------------------------------------------------
   Utilitaire
   ---------------------------------------------------------------- */
function _escC(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ----------------------------------------------------------------
   API publique
   ---------------------------------------------------------------- */
window.barChart  = barChart;
window.pieChart  = pieChart;
window.statCard  = statCard;
window.sparkline = sparkline;
