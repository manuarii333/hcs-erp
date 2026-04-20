/* ================================================================
   HCS ERP — js/components/toast.js
   Notifications toast : slide-in depuis la droite, auto-disparition.
   Usage : toast('Message', 'success'|'error'|'warning'|'info')
   ================================================================ */

function _escT(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

'use strict';

/* ----------------------------------------------------------------
   Configuration globale
   ---------------------------------------------------------------- */
const TOAST_CONFIG = {
  duration:  3000,    // ms avant disparition
  maxToasts: 5,       // nombre max simultané
  containerId: 'toastContainer'
};

/* ----------------------------------------------------------------
   Icônes et couleurs par type
   ---------------------------------------------------------------- */
const TOAST_TYPES = {
  success: { icon: '✓', color: 'var(--accent-green)',  border: '#00d4aa' },
  error:   { icon: '✕', color: 'var(--accent-red)',    border: '#ff6b6b' },
  warning: { icon: '⚠', color: 'var(--accent-orange)', border: '#ffc857' },
  info:    { icon: 'ℹ', color: 'var(--accent-blue)',   border: '#4a5fff' }
};

/* ----------------------------------------------------------------
   _getContainer()
   Retourne (ou crée) le conteneur #toastContainer.
   ---------------------------------------------------------------- */
function _getContainer() {
  let container = document.getElementById(TOAST_CONFIG.containerId);

  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONFIG.containerId;
    container.className = 'toast-container';

    // Styles positionnels (haut droite, par-dessus tout)
    Object.assign(container.style, {
      position:  'fixed',
      top:       '16px',
      right:     '16px',
      display:   'flex',
      flexDirection: 'column',
      gap:       '8px',
      zIndex:    '9999',
      pointerEvents: 'none'  // ne bloque pas les clics en-dessous
    });

    document.body.appendChild(container);
  }

  return container;
}

/* ----------------------------------------------------------------
   _injectToastStyles()
   Injecte une fois le CSS d'animation dans le <head>.
   ---------------------------------------------------------------- */
function _injectToastStyles() {
  if (document.getElementById('toast-styles')) return;

  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    /* Conteneur */
    #toastContainer {
      position: fixed;
      top: 16px;
      right: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 9999;
      pointer-events: none;
    }

    /* Toast individuel */
    .hcs-toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 16px;
      min-width: 280px;
      max-width: 420px;
      background: var(--bg-elevated, #0f1120);
      border: 1px solid var(--border, #1e2240);
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      pointer-events: auto;
      cursor: pointer;
      font-family: var(--font-sans, 'DM Sans', sans-serif);
      font-size: 14px;
      color: var(--text-primary, #e8eaf6);
      line-height: 1.4;
      position: relative;
      overflow: hidden;

      /* État initial (hors écran à droite) */
      transform: translateX(calc(100% + 24px));
      opacity: 0;
      transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
                  opacity 0.25s ease;
    }

    /* État visible */
    .hcs-toast.visible {
      transform: translateX(0);
      opacity: 1;
    }

    /* État de sortie */
    .hcs-toast.leaving {
      transform: translateX(calc(100% + 24px));
      opacity: 0;
      transition: transform 0.22s ease-in, opacity 0.2s ease-in;
    }

    /* Icône */
    .hcs-toast-icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* Corps texte */
    .hcs-toast-body {
      flex: 1;
      min-width: 0;
    }

    .hcs-toast-message {
      color: var(--text-primary, #e8eaf6);
    }

    .hcs-toast-title {
      font-weight: 600;
      margin-bottom: 2px;
    }

    /* Bouton fermer */
    .hcs-toast-close {
      background: transparent;
      border: none;
      color: var(--text-muted, #4a5270);
      font-size: 14px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
      flex-shrink: 0;
      transition: color 0.15s;
      margin-top: 1px;
    }
    .hcs-toast-close:hover { color: var(--text-primary, #e8eaf6); }

    /* Barre de progression (timer) */
    .hcs-toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      border-radius: 0 0 10px 10px;
      width: 100%;
      transform-origin: left;
      animation: toastProgress linear forwards;
    }
    @keyframes toastProgress {
      from { transform: scaleX(1); }
      to   { transform: scaleX(0); }
    }

    /* Barre de gauche (accent coloré) */
    .hcs-toast::before {
      content: '';
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 3px;
      border-radius: 10px 0 0 10px;
    }
  `;
  document.head.appendChild(style);
}

/* ----------------------------------------------------------------
   toast(message, type, options)
   Fonction principale — crée et affiche un toast.

   @param {string}        message   Texte du toast
   @param {string}        type      'success'|'error'|'warning'|'info'
   @param {object|number} options   Durée en ms, ou objet { duration, title }
   ---------------------------------------------------------------- */
function toast(message, type = 'info', options = {}) {
  _injectToastStyles();

  const container = _getContainer();
  const cfg       = TOAST_TYPES[type] || TOAST_TYPES.info;

  // Accepte un nombre (durée) ou un objet options
  let duration = TOAST_CONFIG.duration;
  let title    = '';
  if (typeof options === 'number') {
    duration = options;
  } else if (typeof options === 'object') {
    duration = options.duration || TOAST_CONFIG.duration;
    title    = options.title || '';
  }

  /* Limiter le nombre de toasts simultanés */
  const existing = container.querySelectorAll('.hcs-toast');
  if (existing.length >= TOAST_CONFIG.maxToasts) {
    _dismissToast(existing[0]);
  }

  /* Créer l'élément toast */
  const el = document.createElement('div');
  el.className = 'hcs-toast';
  el.setAttribute('role', 'alert');
  el.setAttribute('aria-live', 'polite');

  el.innerHTML = `
    <!-- Accent coloré gauche (via ::before géré en JS ci-dessous) -->
    <!-- Icône -->
    <div class="hcs-toast-icon" style="background:${cfg.color}20;color:${cfg.color};">
      ${cfg.icon}
    </div>
    <!-- Corps -->
    <div class="hcs-toast-body">
      ${title ? `<div class="hcs-toast-title">${_escT(title)}</div>` : ''}
      <div class="hcs-toast-message">${_escT(message)}</div>
    </div>
    <!-- Fermer -->
    <button class="hcs-toast-close" aria-label="Fermer">✕</button>
    <!-- Barre progression -->
    <div class="hcs-toast-progress"
      style="background:${cfg.color};animation-duration:${duration}ms;">
    </div>
  `;

  /* Couleur de la barre latérale (::before via style direct) */
  el.style.borderLeftColor = cfg.border;
  el.style.setProperty('--toast-accent', cfg.border);

  // Pseudo-element border via boxShadow inset
  el.style.boxShadow = `inset 3px 0 0 ${cfg.border}, 0 8px 24px rgba(0,0,0,0.6)`;
  el.style.borderLeft = 'none';

  container.appendChild(el);

  /* Clic sur fermer */
  el.querySelector('.hcs-toast-close').addEventListener('click', (e) => {
    e.stopPropagation();
    _dismissToast(el);
  });

  /* Clic sur le toast entier → fermer */
  el.addEventListener('click', () => _dismissToast(el));

  /* Animation entrée */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('visible');
    });
  });

  /* Auto-disparition */
  const timer = setTimeout(() => _dismissToast(el), duration);

  // Stocker le timer sur l'élément pour pouvoir l'annuler
  el._toastTimer = timer;

  return el; // retourner l'élément pour usage avancé
}

/* ----------------------------------------------------------------
   _dismissToast(el) — animation de sortie puis suppression
   ---------------------------------------------------------------- */
function _dismissToast(el) {
  if (!el || !el.parentNode) return;
  clearTimeout(el._toastTimer);
  el.classList.remove('visible');
  el.classList.add('leaving');
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 250);
}

/* ----------------------------------------------------------------
   Raccourcis sémantiques
   ---------------------------------------------------------------- */
const toastSuccess = (msg, opts) => toast(msg, 'success', opts);
const toastError   = (msg, opts) => toast(msg, 'error',   opts);
const toastWarning = (msg, opts) => toast(msg, 'warning', opts);
const toastInfo    = (msg, opts) => toast(msg, 'info',    opts);

/**
 * Vide tous les toasts visibles.
 */
function clearToasts() {
  const container = document.getElementById(TOAST_CONFIG.containerId);
  if (!container) return;
  container.querySelectorAll('.hcs-toast').forEach(_dismissToast);
}

/* ----------------------------------------------------------------
   API publique
   ---------------------------------------------------------------- */
window.toast        = toast;
window.toastSuccess = toastSuccess;
window.toastError   = toastError;
window.toastWarning = toastWarning;
window.toastInfo    = toastInfo;
window.clearToasts  = clearToasts;
