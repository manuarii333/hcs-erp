/* ================================================================
   HCS ERP — utils.js
   Fonctions utilitaires : formatage monétaire XPF, dates,
   calculs TGC 13%, génération de numéros de documents
   ================================================================ */

'use strict';

/* ================================================================
   FORMATAGE MONÉTAIRE XPF
   Le XPF (Franc CFP) n'a pas de décimales.
   Convention : espaces pour les milliers (ex: 125 000 XPF)
   ================================================================ */

/**
 * Formate un montant en XPF avec des espaces comme séparateurs de milliers.
 * @param {number} amount - Montant en XPF
 * @returns {string} ex: "125 000 XPF"
 */
function fmt(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '— XPF';
  const n = Math.round(Number(amount));
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) + ' XPF';
}

/**
 * Formate un montant sans le suffixe XPF (pour les calculs intermédiaires).
 * @param {number} amount
 * @returns {string} ex: "125 000"
 */
function fmtNum(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  const n = Math.round(Number(amount));
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/* ================================================================
   FORMATAGE DES DATES
   ================================================================ */

/**
 * Formate une date en format court français (jj/mm/aaaa).
 * Accepte : string ISO, objet Date, ou timestamp.
 * @param {string|Date|number} d
 * @returns {string} ex: "05/03/2026"
 */
function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric'
  });
}

/**
 * Formate une date + heure (jj/mm/aaaa hh:mm).
 * @param {string|Date|number} d
 * @returns {string} ex: "05/03/2026 14:30"
 */
function fmtDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric'
  }) + ' ' + date.toLocaleTimeString('fr-FR', {
    hour:   '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formate une date en format relatif court ("Aujourd'hui", "Hier", "Il y a 3j").
 * @param {string|Date} d
 * @returns {string}
 */
function fmtDateRelative(d) {
  if (!d) return '—';
  const date = new Date(d);
  const now   = new Date();
  const diffMs = now - date;
  const diffJ  = Math.floor(diffMs / 86400000);

  if (diffJ === 0) return 'Aujourd\'hui';
  if (diffJ === 1) return 'Hier';
  if (diffJ < 7)   return `Il y a ${diffJ}j`;
  if (diffJ < 30)  return `Il y a ${Math.floor(diffJ / 7)} sem.`;
  return fmtDate(d);
}

/* ================================================================
   CALCULS TVA (Taxe sur la Valeur Ajoutée — Polynésie fr.)
   Taux produits : 16% | Taux services : 13%
   ================================================================ */

const TVA_RATE_PRODUITS  = 0.16; // 16% — biens, marchandises
const TVA_RATE_SERVICES  = 0.13; // 13% — prestations de service
const TVA_RATE           = TVA_RATE_PRODUITS; // taux par défaut
/* Alias rétrocompatibilité */
const TGC_RATE           = TVA_RATE;

/**
 * Calcule le montant TTC à partir d'un HT.
 * @param {number} ht - Montant Hors Taxe
 * @param {number} [taux=0.16] - Taux TVA
 * @returns {number} Montant TTC arrondi
 */
function calcTTC(ht, taux = TVA_RATE) {
  return Math.round(ht * (1 + taux));
}

/**
 * Calcule le montant HT à partir d'un TTC.
 * @param {number} ttc - Montant TTC
 * @param {number} [taux=0.16]
 * @returns {number} Montant HT arrondi
 */
function calcHT(ttc, taux = TVA_RATE) {
  return Math.round(ttc / (1 + taux));
}

/**
 * Calcule le montant de TVA à partir du HT.
 * @param {number} ht
 * @param {number} [taux=0.16]
 * @returns {number} Montant TVA arrondi
 */
function calcTVA(ht, taux = TVA_RATE) {
  return Math.round(ht * taux);
}
/* Alias rétrocompatibilité */
const calcTGC = calcTVA;

/**
 * Calcule les totaux d'un document à partir de ses lignes.
 * Chaque ligne peut avoir un champ tauxTVA (16 ou 13).
 * @param {Array} lignes - Lignes du document
 * @param {number} [tauxDefaut=0.16]
 * @returns {{ totalHT, totalTVA, totalTTC }}
 */
function calcTotaux(lignes = [], tauxDefaut = TVA_RATE) {
  let totalHT  = 0;
  let totalTVA = 0;
  lignes.forEach(ligne => {
    const brut  = (ligne.qte || 0) * (ligne.prixUnitaire || 0);
    const remise = brut * ((ligne.remise || 0) / 100);
    const ht    = brut - remise;
    const taux  = (ligne.tauxTVA !== undefined ? ligne.tauxTVA : tauxDefaut * 100) / 100;
    totalHT  += ht;
    totalTVA += ht * taux;
  });
  return {
    totalHT:  Math.round(totalHT),
    totalTVA: Math.round(totalTVA),
    totalTTC: Math.round(totalHT + totalTVA)
  };
}

/* ================================================================
   GÉNÉRATION DE NUMÉROS DE DOCUMENTS
   Format : PRÉFIXE-AAAA-XXXXX (ex: DEV-2026-00001)
   ================================================================ */

/**
 * Génère un numéro de document formaté.
 * @param {string} prefix  - Préfixe du document (ex: 'DEV', 'FAC', 'CMD')
 * @param {number} counter - Compteur courant (incrémenté avant appel)
 * @param {number} [year]  - Année (par défaut année courante)
 * @returns {string} ex: "DEV-2026-00001"
 */
function generateNum(prefix, counter, year) {
  const y = year || new Date().getFullYear();
  const n = String(counter).padStart(5, '0');
  return `${prefix}-${y}-${n}`;
}

/**
 * Génère le prochain numéro de document via le Store.
 * @param {string} prefix - Préfixe (ex: 'DEV')
 * @param {string} serie  - Clé du compteur dans Store (ex: 'devis')
 * @returns {string}
 */
function nextDocNum(prefix, serie) {
  const counter = Store.nextCounter(serie);
  return generateNum(prefix, counter);
}

/* ================================================================
   UTILITAIRES DIVERS
   ================================================================ */

/**
 * Génère un identifiant unique simple (non UUID).
 * @param {string} [prefix='id']
 * @returns {string}
 */
function genId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * Clone profond d'un objet (via JSON pour simplicité).
 * @param {object} obj
 * @returns {object}
 */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Tronque un texte à une longueur maximale.
 * @param {string} str
 * @param {number} [max=50]
 * @returns {string}
 */
function truncate(str, max = 50) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/**
 * Debounce : limite la fréquence d'appel d'une fonction.
 * @param {Function} fn
 * @param {number} delay - Délai en ms
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Formate un pourcentage (ex: 13.5 → "13,5 %")
 * @param {number} val
 * @returns {string}
 */
function fmtPct(val) {
  if (val === null || val === undefined) return '—';
  return Number(val).toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1
  }) + ' %';
}

/**
 * Affiche une notification toast à l'écran.
 * @param {string} message
 * @param {'info'|'success'|'error'} [type='info']
 * @param {number} [duration=3000] - Durée en ms
 */
function toast(message, type = 'info', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { info: 'ℹ️', success: '✅', error: '❌' };
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type]||'ℹ️'}</span> ${message}`;
  container.appendChild(t);

  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

/* ================================================================
   EXPORT XLS — Format SpreadsheetML (lisible par Excel + Google Sheets)
   ================================================================ */

/**
 * Génère et télécharge un fichier .xls (SpreadsheetML XML)
 * compatible Excel et Google Sheets.
 *
 * @param {string}   filename  - Nom du fichier sans extension (ex: 'export-factures')
 * @param {string[]} headers   - Intitulés des colonnes
 * @param {Array[]}  rows      - Tableau de tableaux de valeurs
 * @param {string}   sheetName - Nom de l'onglet (défaut: 'Export')
 */
function exportXLS(filename, headers, rows, sheetName = 'Export') {
  /* Échapper les caractères XML */
  function escXml(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Cellule XML selon le type de valeur */
  function cell(val) {
    const v = val === null || val === undefined ? '' : val;
    const isNum = typeof v === 'number' && !isNaN(v);
    if (isNum) {
      return `<Cell><Data ss:Type="Number">${v}</Data></Cell>`;
    }
    return `<Cell><Data ss:Type="String">${escXml(v)}</Data></Cell>`;
  }

  /* En-têtes en gras */
  const headerRow = `<Row>` + headers.map(h =>
    `<Cell ss:StyleID="header"><Data ss:Type="String">${escXml(h)}</Data></Cell>`
  ).join('') + `</Row>`;

  /* Lignes de données */
  const dataRows = rows.map(r =>
    `<Row>${r.map(cell).join('')}</Row>`
  ).join('\n');

  /* Document SpreadsheetML complet */
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#2D3748" ss:Pattern="Solid"/>
      <Font ss:Color="#FFFFFF" ss:Bold="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${escXml(sheetName)}">
    <Table>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename + '.xls';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Ouvre une fenêtre imprimable avec un tableau HTML stylisé HCS.
 * L'utilisateur peut imprimer ou "Enregistrer en PDF" via le navigateur.
 *
 * @param {string}   title     - Titre du document
 * @param {string}   subtitle  - Sous-titre (période, filtre, etc.)
 * @param {string[]} headers   - Intitulés des colonnes
 * @param {Array[]}  rows      - Tableau de tableaux de valeurs
 */
function exportPDF(title, subtitle, headers, rows) {
  const now  = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const esc  = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const thead = `<tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>`;
  const tbody = rows.map(r =>
    `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:24px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;
       border-bottom:2px solid #1F7A63;padding-bottom:12px}
  .logo{font-size:22px;font-weight:800;color:#1F7A63;letter-spacing:-.5px}
  .logo span{color:#D4AF37}
  .doc-title{font-size:16px;font-weight:700;margin:6px 0 2px}
  .doc-sub{font-size:12px;color:#6B7280}
  .meta{text-align:right;font-size:10px;color:#6B7280;line-height:1.6}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  thead tr{background:#1F7A63;color:#fff}
  th{padding:7px 8px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
  td{padding:6px 8px;border-bottom:1px solid #E5E9F0;vertical-align:top}
  tr:nth-child(even) td{background:#F5F7F9}
  .footer{margin-top:18px;text-align:center;font-size:9px;color:#9CA3AF}
  .btn-print{margin-bottom:12px;padding:8px 16px;background:#1F7A63;color:#fff;border:none;
             border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
  @media print{.btn-print{display:none}@page{margin:15mm}body{padding:0}}
</style></head>
<body>
<div class="hdr">
  <div>
    <div class="logo">H<span>C</span>S</div>
    <div class="doc-title">${esc(title)}</div>
    ${subtitle ? `<div class="doc-sub">${esc(subtitle)}</div>` : ''}
  </div>
  <div class="meta">HCS Polynésie<br>Édité le ${now}<br>${rows.length} ligne(s)</div>
</div>
<button class="btn-print" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
<table>
  <thead>${thead}</thead>
  <tbody>${tbody}</tbody>
</table>
<div class="footer">Document généré par HCS ERP — ${now}</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank', 'width=960,height=720');
  /* La révocation est différée pour laisser le temps au navigateur de charger la page */
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Analyse un texte CSV (avec ou sans guillemets) et retourne un tableau de tableaux.
 * @param {string} text - Contenu brut du fichier CSV
 * @param {string} sep  - Séparateur (défaut ';')
 * @returns {string[][]}
 */
function parseCSV(text, sep = ';') {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  return lines.map(line => {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === sep && !inQ) {
        cells.push(cur.trim()); cur = '';
      } else {
        cur += c;
      }
    }
    cells.push(cur.trim());
    return cells;
  });
}
