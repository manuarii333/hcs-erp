/* ================================================================
   HCS ERP — app.js
   Router principal : définition des 9 modules, navigation,
   dispatch vers les vues des modules
   ================================================================ */

'use strict';

/* ----------------------------------------------------------------
   DÉFINITION DES 9 MODULES
   Chaque module a : id, label, icône, couleur, liste de vues
   ---------------------------------------------------------------- */
const APPS = [
  /* ====================================================
     MODULES PRINCIPAUX — visibles dans la topbar
     ==================================================== */
  {
    id: 'dashboard',
    label: 'Accueil',
    icon: '⊞',
    color: '#4a5fff',
    pinned: true,
    views: [
      { id: 'overview',  label: 'Vue d\'ensemble', icon: '📊' },
      { id: 'activity',  label: 'Activité récente', icon: '🕐' }
    ]
  },
  {
    id: 'crm',
    label: 'Clients',      /* CRM renommé "Clients" */
    icon: '👥',
    color: '#b07bff',
    pinned: false,
    views: [
      { id: 'contacts',  label: 'Contacts',  icon: '👤', section: 'Annuaire'      },
      { id: 'pipeline',  label: 'Pipeline',  icon: '⊞', section: 'Opportunités'  }
    ]
  },
  {
    id: 'ventes',
    label: 'Ventes',
    icon: '🛒',
    color: '#00d4aa',
    pinned: true,
    views: [
      { id: 'quotes',       label: 'Devis',             icon: '📄', section: 'Flux'      },
      { id: 'orders',       label: 'Commandes',         icon: '📦', section: 'Flux'      },
      { id: 'invoices',     label: 'Factures',          icon: '🧾', section: 'Flux'      },
      { id: 'clients',      label: 'Clients',           icon: '👥', section: 'Annuaire'  },
      { id: 'contacts',  label: 'Contacts',  icon: '👤', section: 'Clients' },
      { id: 'pipeline',  label: 'Pipeline',  icon: '⊞',  section: 'Clients' },
      { id: 'receipts',     label: 'Bons de livraison', icon: '📋', section: 'Réception' },
      { id: 'sales-report', label: 'Rapport',           icon: '📈', section: 'Rapports'  }
    ]
  },
  {
    id: 'production',
    label: 'Production',
    icon: '⚙️',
    color: '#ff6b6b',
    pinned: true,
    views: [
      { id: 'planning',     label: 'Planning',       icon: '📅', section: 'Atelier'    },
      { id: 'hcs-designer', label: '⬡ HCS Designer', icon: '🎨', section: 'Atelier'    },
      { id: 'mo',           label: 'Ordres de fab.', icon: '🔧', section: 'Atelier'    },
      { id: 'bom',          label: 'Nomenclatures',  icon: '📐', section: 'Paramètres' },
      { id: 'work-centers', label: 'Postes',         icon: '🏭', section: 'Paramètres' }
    ]
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: '📦',
    color: '#4a5fff',
    pinned: true,
    views: [
      { id: 'products',     label: 'Produits',   icon: '📋', section: 'Catalogue' },
      { id: 'categories',   label: 'Catégories', icon: '🏷',  section: 'Catalogue' },
      { id: 'stock-moves',  label: 'Mouvements', icon: '↕️', section: 'Stock'    },
      { id: 'suppliers',       label: 'Fournisseurs',  icon: '🏭', section: 'Approvisionnement' },
      { id: 'po',              label: 'Commandes achat',icon: '🛒', section: 'Approvisionnement' },
      { id: 'purchase-report', label: 'Rapport achats', icon: '📈', section: 'Approvisionnement' },
      { id: 'stock-report', label: 'Rapport',    icon: '📈', section: 'Rapports' }
    ]
  },
  {
    id: 'caisse',
    label: 'Caisse',
    icon: '💳',
    color: '#F59E0B',
    pinned: true,
    views: [
      { id: 'caisse-pos', label: 'Point de vente', icon: '🛒', section: 'Point de vente' }
    ]
  },
  {
    id: 'parametres',
    label: 'Paramètres',
    icon: '⚙',
    color: '#6B7280',
    pinned: true,
    views: [
      { id: 'utilisateurs', label: 'Utilisateurs',    icon: '👥', section: 'Accès'      },
      { id: 'audit-log',    label: 'Journal d\'audit', icon: '📋', section: 'Accès'      },
      { id: 'boutique', label: 'Ma boutique', icon: '🏪', section: 'Configuration' },
      { id: 'mon-profil',   label: 'Mon profil',       icon: '👤', section: 'Mon compte' }
    ]
  },

  /* ====================================================
     MODULES SECONDAIRES — accessibles via "⋯ Plus"
     ==================================================== */
  {
    id: 'comptabilite',
    label: 'Comptabilité',
    icon: '💰',
    color: '#00d4aa',
    pinned: true,
    views: [
      { id: 'tableau-de-bord', label: 'Tableau de bord',    icon: '📊', section: 'Vue globale' },
      { id: 'conseiller',      label: 'Copilote financier',  icon: '🧠', section: 'Vue globale' },
      { id: 'depenses',        label: 'Dépenses & TVA',      icon: '🧾', section: 'Saisie'      },
      { id: 'journal',         label: 'Journal',             icon: '📒', section: 'Saisie'      },
      { id: 'accounts',        label: 'Plan comptable',      icon: '📋', section: 'Saisie'      },
      { id: 'grand-livre',     label: 'Grand Livre',         icon: '📒', section: 'Saisie'      },
      { id: 'paiements',       label: 'Paiements',           icon: '💳', section: 'Saisie'      },
      { id: 'pl-report',       label: 'Compte de résultat',  icon: '📈', section: 'Rapports'    },
      { id: 'bilan',           label: 'Bilan',               icon: '⚖',  section: 'Rapports'    },
      { id: 'balance',         label: 'Balance',             icon: '📊', section: 'Rapports'    },
      { id: 'tax-report',      label: 'Rapport TVA',         icon: '📑', section: 'Rapports'    },
      { id: 'stats-ventes',   label: 'Stats ventes & TVA',  icon: '📦', section: 'Rapports'    },
      { id: 'assistant',       label: '✨ Assistant Comptable', icon: '🤖', section: 'IA'       }
    ]
  },
  {
    id: 'agents',
    label: 'Agents IA',
    icon: '🤖',
    color: '#00d4aa',
    pinned: true,
    views: [
      { id: 'dashboard', label: 'Tableau de bord', icon: '⬡',  section: 'Agents IA' },
      { id: 'chat',      label: 'Chat agents',     icon: '💬', section: 'Agents IA' },
      { id: 'sessions',  label: 'Historique',      icon: '📋', section: 'Agents IA' }
    ]
  },
  {
    id: 'rh',
    label: 'RH',
    icon: '👤',
    color: '#b07bff',
    pinned: false,
    views: [
      { id: 'employes',    label: 'Employés', icon: '👥', section: 'Équipe' },
      { id: 'conges',      label: 'Congés',   icon: '🏖️', section: 'Équipe' },
      { id: 'planning-rh', label: 'Planning', icon: '📅', section: 'Équipe' }
    ]
  },
  {
    id: 'messagerie',
    label: 'Discussion',
    icon: '💬',
    color: '#4a5fff',
    pinned: false,
    views: [
      { id: 'inbox',      label: 'Boîte de réception', icon: '📥', section: 'Canaux' },
      { id: 'general',    label: '#général',            icon: '#',  section: 'Canaux' },
      { id: 'production', label: '#production',         icon: '#',  section: 'Canaux' },
      { id: 'ventes',     label: '#ventes',             icon: '#',  section: 'Canaux' }
    ]
  },
  {
    id: 'outils',
    label: 'Outils HCS',
    icon: '🔧',
    color: '#6B7280',
    views: [
      { id: 'triage-dashboard',        label: 'Triage & Réception',    icon: '📋', section: 'Opérations'       },
      { id: 'commercial-dashboard',    label: 'Commercial & Devis',    icon: '🤝', section: 'Opérations'       },
      { id: 'boutique-assistant',      label: 'Boutique Assistant',    icon: '🏪', section: 'Opérations'       },
      { id: 'atelier-production',      label: 'Atelier Production',    icon: '⚙️', section: 'Production'       },
      { id: 'dtf-atelier-bn20-yannick',label: 'DTF Atelier BN20',     icon: '🖨',  section: 'Production'       },
      { id: 'dtf-atelier-usa',         label: 'DTF Atelier USA',      icon: '🖨',  section: 'Production'       },
      { id: 'dtf-plaques-transfert',   label: 'DTF Plaques Transfert', icon: '🖨', section: 'Production'       },
      { id: 'signmaster-guide',        label: 'SignMaster Guide',      icon: '✂️', section: 'Production'       },
      { id: 'admin-photos-produits',   label: 'Photos Produits',       icon: '📸', section: 'Visuel & Contenu' },
      { id: 'hcs-designer',            label: '⬡ HCS Designer',        icon: '🎨', section: 'Visuel & Contenu' },
      { id: 'picwish-pipeline',        label: 'PicWish Pipeline',      icon: '🖼',  section: 'Visuel & Contenu', external: true, url: 'apps/picwish-pipeline.html' },
      { id: 'content-generator',       label: 'Content Generator',     icon: '✍️', section: 'Visuel & Contenu' },
      { id: 'stock-dashboard',         label: 'Stock Dashboard',       icon: '📦', section: 'Gestion'          },
      { id: 'finance-dashboard',       label: 'Finance Dashboard',     icon: '💰', section: 'Gestion'          },
      { id: 'rapport-pl',              label: 'Rapport P&L',           icon: '📈', section: 'Gestion'          },
      { id: 'ocr-scanner',             label: 'Scanner OCR',           icon: '🔍', section: 'Gestion'          },
      { id: 'supervision-dashboard',   label: 'Supervision',           icon: '👁',  section: 'Supervision'      },
      { id: 'routine-dashboard',       label: 'Routines',              icon: '🔄', section: 'Supervision'      },
      { id: 'vocal-dashboard',         label: 'Agent Vocal',           icon: '🎙', section: 'Supervision'      },
      { id: 'advisor',                  label: '⬡ Grace — Advisor IA',  icon: '🤖', section: 'Supervision'      },
      { id: 'dev-studio',               label: 'Dev Studio',            icon: '🛠',  section: 'Développement'    },
      /* ── Applications HCS externes ── */
      { id: 'ext-andromeda',   label: 'Andromeda Builder', icon: '📡', section: 'Applications HCS', external: true, url: '../campaign/andromeda-campaign.html' },
      { id: 'mockup-forge-v12', label: 'MockupForge v12',   icon: '🖼️', section: 'Applications HCS' },
      { id: 'ext-dtf-composer',label: 'DTF Composer v4',   icon: '🎨', section: 'Applications HCS', external: true, url: '../agents/agent3_visuel/dtf-composer-v4.html' },
      { id: 'dtf-calculator-hcs-v2',               label: 'Calculateur DTF',        icon: '🧮', section: 'Applications HCS' },
      { id: 'calculateur-vinyl-hcs',               label: 'Calculateur Vinyle',      icon: '✂️', section: 'Applications HCS' },
      { id: 'calculateur-transfert-thermocollant', label: 'Calculateur Transfert',   icon: '♨️', section: 'Applications HCS' },
      { id: 'product-creator',                     label: 'Product Creator CSV',     icon: '📦', section: 'Applications HCS' },
      { id: 'ext-hcs-builder', label: 'HCS Builder v2',    icon: '🏗️', section: 'Applications HCS', external: true, url: '../hcs-builder-v2-fixed.html' },
      { id: 'ext-pass-hcs',    label: 'Pass HCS',          icon: '🎫', section: 'Applications HCS', external: true, url: '../hcs-hub-ecosystem/hcs-hub-ecosystem/hcs-pass-test.html' },
      { id: 'ext-hub',         label: 'HCS Hub',           icon: '🗄️', section: 'Applications HCS', external: true, url: '../hcs-hub.html' },
      { id: 'ext-cockpit',     label: 'HCS Cockpit',       icon: '🚀', section: 'Applications HCS', external: true, url: '../hcs-hub-ecosystem/hcs-hub-ecosystem/hcs-cockpit.html' }
    ]
  }
];

/* ----------------------------------------------------------------
   ÉTAT DE NAVIGATION
   ---------------------------------------------------------------- */
const AppState = {
  currentApp:  null,   // id du module actif
  currentView: null,   // id de la vue active
  viewMode:    'list', // 'list' | 'kanban'
  searchQuery: ''
};

/* ----------------------------------------------------------------
   INITIALISATION
   Lance l'app après le login
   ---------------------------------------------------------------- */
function initApp() {
  renderTopbar();
  openApp('dashboard');
  bindToolbar();
  bindModal();
  initGlobalSearch(); // Ctrl+K recherche globale

  /* Analyse financière automatique au démarrage */
  if (typeof Advisor !== 'undefined') {
    setTimeout(() => Advisor.runAtLogin(), 1500);
  }

  /* Listener : reçoit les produits depuis Product Creator (iframe) */
  window.addEventListener('message', async (e) => {
    if (!e.data || e.data.type !== 'HCS_SAVE_PRODUCTS') return;
    const list = e.data.products || [];
    if (list.length === 0) return;
    let ok = 0, err = 0;
    for (const p of list) {
      try {
        await Store.create('products', p);
        ok++;
      } catch (_) { err++; }
    }
    const msg = err === 0
      ? `${ok} produit(s) enregistré(s) dans l'ERP ✓`
      : `${ok} OK · ${err} erreur(s)`;
    if (typeof showToast === 'function') showToast(msg, err ? 'warning' : 'success');
    else alert(msg);
  });
}

/* ----------------------------------------------------------------
   TOPBAR : rendu des icônes d'application
   ---------------------------------------------------------------- */
function renderTopbar() {
  const menu    = document.getElementById('app-menu');
  if (!menu) return;

  const session = Auth.getSession();
  if (!session) return;

  const role    = (window.ROLES || {})[session.role] || {};
  const couleur = session.couleur || '#6366F1';

  /* Filtrer les modules accessibles selon le rôle */
  const allAccessible = APPS.filter(app => Auth.canAccess(app.id));
  const pinnedApps    = allAccessible.filter(app => app.pinned !== false);
  const moreApps      = allAccessible.filter(app => app.pinned === false);

  /* Modules principaux */
  menu.innerHTML = pinnedApps.map(app => `
    <button class="app-item" data-app="${app.id}" onclick="openApp('${app.id}')">
      <span class="app-icon">${app.icon}</span>
      <span class="app-label">${app.label}</span>
    </button>
  `).join('');

  /* Bouton "⋯ Plus" pour les modules secondaires */
  if (moreApps.length > 0) {
    const overflowEl = document.createElement('div');
    overflowEl.className = 'app-overflow';
    overflowEl.innerHTML = `
      <button class="app-item" id="btn-more-apps" title="Plus de modules">
        <span class="app-icon">⋯</span>
        <span class="app-label">Plus</span>
      </button>
      <div class="app-overflow-menu" id="app-overflow-menu">
        ${moreApps.map(app => `
          <button class="overflow-app-item" data-app="${app.id}">
            <span style="font-size:1rem;">${app.icon}</span>
            <span>${app.label}</span>
          </button>
        `).join('')}
      </div>`;
    menu.appendChild(overflowEl);

    /* Toggle du menu overflow */
    const btnMore = overflowEl.querySelector('#btn-more-apps');
    const overflowMenu = overflowEl.querySelector('#app-overflow-menu');
    btnMore.addEventListener('click', (e) => {
      e.stopPropagation();
      overflowMenu.classList.toggle('open');
    });
    overflowEl.querySelectorAll('.overflow-app-item').forEach(btn => {
      btn.addEventListener('click', () => {
        openApp(btn.dataset.app);
        overflowMenu.classList.remove('open');
      });
    });
    /* Ferme au clic extérieur */
    document.addEventListener('click', () => overflowMenu.classList.remove('open'));
  }

  /* Badge utilisateur avec avatar coloré et rôle */
  const badge = document.getElementById('user-badge');
  if (badge) {
    const initials = session.avatar || '??';
    badge.innerHTML = `
      <span style="
        display:inline-flex;align-items:center;justify-content:center;
        width:26px;height:26px;border-radius:50%;
        background:${couleur};color:#fff;
        font-size:11px;font-weight:700;margin-right:6px;flex-shrink:0;">
        ${escapeHtml(initials)}
      </span>
      <span style="font-size:13px;">
        ${escapeHtml(session.prenom)}
        <span style="font-size:10px;color:rgba(255,255,255,0.6);margin-left:4px;">
          ${escapeHtml(role.label || session.role)}
        </span>
      </span>
    `;
    badge.style.cssText = 'display:flex;align-items:center;cursor:pointer;padding:4px 8px;border-radius:6px;';
    badge.onclick = () => {
      openApp('parametres');
      setTimeout(() => openView('mon-profil'), 60);
    };
  }

  /* Bouton Admin DB (super_admin uniquement) */
  if (Auth.hasRole('super_admin','admin') && !document.getElementById('btn-admin')) {
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      const adminBtn = document.createElement('button');
      adminBtn.id        = 'btn-admin';
      adminBtn.className = 'btn-ghost btn-sm';
      adminBtn.title     = 'Administration base de données';
      adminBtn.innerHTML = '🗄️';
      adminBtn.addEventListener('click', openAdminModal);
      logoutBtn.parentNode.insertBefore(adminBtn, logoutBtn);
    }
  }
}

/* ----------------------------------------------------------------
   openApp(appId)
   Active un module : met à jour la sidebar, ouvre la 1re vue
   ---------------------------------------------------------------- */
function openApp(appId) {
  const app = APPS.find(a => a.id === appId);
  if (!app) return;

  AppState.currentApp = appId;

  // Marquer actif dans la topbar (pinned + overflow)
  document.querySelectorAll('.app-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.app === appId);
  });
  document.querySelectorAll('.overflow-app-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.app === appId);
  });

  // Rendre la sidebar
  renderSidebar(app);

  // Ouvrir la première vue du module
  if (app.views.length > 0) {
    openView(app.views[0].id);
  }
}

/* ----------------------------------------------------------------
   SIDEBAR : rendu des sous-menus du module actif
   ---------------------------------------------------------------- */
function renderSidebar(app) {
  const title = document.getElementById('sidebar-title');
  const menu  = document.getElementById('sidebar-menu');
  if (!title || !menu) return;

  title.textContent = app.label;

  // Regrouper les vues par section
  const sections = {};
  app.views.forEach(v => {
    const sec = v.section || '';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(v);
  });

  let html = '';
  Object.entries(sections).forEach(([section, views]) => {
    if (section) {
      html += `<div class="sidebar-section">
        <div class="sidebar-section-label">${section}</div>`;
    }
    views.forEach(v => {
      const extBadge = v.external
        ? `<span style="font-size:9px;opacity:.45;margin-left:auto;flex-shrink:0;">↗</span>`
        : '';
      html += `
        <button class="sidebar-item" data-view="${v.id}" onclick="openView('${v.id}')"
          title="${v.label}${v.external ? ' — ouvre dans un nouvel onglet' : ''}">
          <span class="item-icon">${v.icon}</span>
          <span class="item-label">${v.label}</span>
          ${extBadge}
        </button>`;
    });
    if (section) html += '</div>';
  });

  menu.innerHTML = html;
}

/* ----------------------------------------------------------------
   openView(viewId)
   Charge une vue dans la zone de contenu principale
   ---------------------------------------------------------------- */
function openView(viewId) {
  AppState.currentView = viewId;

  // Marquer actif dans la sidebar
  document.querySelectorAll('.sidebar-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });

  // Rendre les actions de la toolbar selon le module
  renderToolbarActions();

  // Dispatcher vers le bon renderer
  renderView();
}

/* ----------------------------------------------------------------
   renderView()
   Dispatch vers le renderer selon l'app + la vue courante
   ---------------------------------------------------------------- */
function renderView() {
  const container = document.getElementById('view-content');
  if (!container) return;

  const app  = AppState.currentApp;
  const view = AppState.currentView;

  // Chaque module a son propre renderer
  switch (app) {
    case 'dashboard':    renderDashboard(view, container);    break;
    case 'crm':
      // Déléguer au module CRM dédié (js/modules/crm.js)
      if (typeof CRM !== 'undefined') {
        CRM.init(document.getElementById('toolbar-actions'), container, view);
      }
      break;
    case 'ventes':
      /* Contacts et Pipeline délégués au module CRM */
      if ((view === 'contacts' || view === 'pipeline') && typeof CRM !== 'undefined') {
        CRM.init(document.getElementById('toolbar-actions'), container, view);
      } else if (typeof Sales !== 'undefined') {
        Sales.init(document.getElementById('toolbar-actions'), container, view);
      }
      break;
    case 'stock':
      /* Fournisseurs et achats délégués au module Purchases */
      if (['suppliers','po','purchase-report'].includes(view) && typeof Purchases !== 'undefined') {
        Purchases.init(document.getElementById('toolbar-actions'), container, view);
      } else if (typeof Inventory !== 'undefined') {
        Inventory.init(document.getElementById('toolbar-actions'), container, view);
      }
      break;
    case 'production':
      // La vue Planning charge le dashboard standalone en iframe
      if (view === 'planning') {
        renderIframe('modules/planning-dashboard.html', container);
      } else if (view === 'hcs-designer') {
        // Agent HCS Designer : DTF Studio + Lecture Devis + Envoi Atelier
        renderIframe('modules/hcs-designer.html', container);
      } else if (typeof Manufacturing !== 'undefined') {
        Manufacturing.init(document.getElementById('toolbar-actions'), container, view);
      }
      break;
    case 'comptabilite':
      /* Déléguer au module Comptabilité — 'conseiller' va vers Advisor */
      if (view === 'conseiller') {
        if (typeof Advisor !== 'undefined') {
          Advisor.init(document.getElementById('toolbar-actions'), container);
        }
      } else if (typeof Accounting !== 'undefined') {
        Accounting.init(document.getElementById('toolbar-actions'), container, view);
      }
      break;
    case 'rh':           renderRH(view, container);           break;
    case 'parametres':
      if (typeof Users !== 'undefined') {
        Users.init(document.getElementById('toolbar-actions'), container, view);
      }
      break;
    case 'messagerie':
      if (typeof Discuss !== 'undefined') {
        Discuss.init(document.getElementById('toolbar-actions'), container, view);
      }
      break;
    case 'caisse':
      renderIframe(`modules/${view}.html`, container);
      break;
    case 'agents':
      container.style.padding = '';
      container.style.overflow = '';
      if (typeof Agents !== 'undefined') {
        Agents.init(document.getElementById('toolbar-actions'), container, view);
      } else {
        container.innerHTML = `<div class="table-empty"><p>🤖 Module Agents IA non chargé — vérifiez js/modules/agents.js</p></div>`;
      }
      break;
    case 'outils': {
      /* Vue Advisor IA — rendu inline (pas d'iframe) */
      if (view === 'advisor') {
        container.style.padding = '';
        container.style.overflow = '';
        if (typeof Advisor !== 'undefined') {
          Advisor.init(document.getElementById('toolbar-actions'), container);
        } else {
          container.innerHTML = `<div class="table-empty"><p>⬡ Module Advisor non chargé — vérifiez js/modules/advisor.js</p></div>`;
        }
      } else {
        /* Vérifier si vue externe (Applications HCS) */
        const outilsApp = APPS.find(a => a.id === 'outils');
        const viewDef   = outilsApp ? outilsApp.views.find(v => v.id === view) : null;
        if (viewDef && viewDef.external && viewDef.url) {
          window.open(viewDef.url, '_blank');
          /* Laisser le contenu actuel en place — juste ouvrir le nouvel onglet */
        } else {
          renderIframe(`modules/${view}.html`, container);
        }
      }
      break;
    }
    default:             container.innerHTML = `<div class="table-empty"><p>Module "${app}" à venir.</p></div>`;
  }
}

/* ----------------------------------------------------------------
   TOOLBAR ACTIONS : boutons contextuels selon le module/vue
   ---------------------------------------------------------------- */
function renderToolbarActions() {
  const zone = document.getElementById('toolbar-actions');
  if (!zone) return;

  const app  = AppState.currentApp;
  const view = AppState.currentView;

  // Ces modules gèrent leur propre toolbar via leur init()
  if (app === 'crm' || app === 'ventes' || app === 'stock' ||
      app === 'production' || app === 'comptabilite' || app === 'messagerie' ||
      app === 'caisse' || app === 'outils' || app === 'parametres') return;

  // Mapping app+vue → boutons (modules sans fichier dédié)
  const actionMap = {
    'achats-bons-achat':[{ label: '+ Bon d\'achat', fn: 'newBonAchat()' }],
    'stock-inventaire':[{ label: '+ Ajustement',  fn: 'newAjustement()' }],
    'production-ordres':[{ label: '+ Ordre de fab.', fn: 'newOrdre()' }],
    'comptabilite-ecritures':[{ label: '+ Écriture', fn: 'newEcriture()' }],
    'messagerie-general':[{ label: '', fn: '' }] // pas de bouton pour la messagerie
  };

  const key = `${app}-${view}`;
  const actions = actionMap[key] || [];

  zone.innerHTML = actions
    .filter(a => a.label)
    .map(a => `<button class="btn btn-primary btn-sm" onclick="${a.fn}">${a.label}</button>`)
    .join('');
}

/* ----------------------------------------------------------------
   TOOLBAR : liaison des événements (recherche, switch vue)
   ---------------------------------------------------------------- */
function bindToolbar() {
  // Recherche
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchQuery = e.target.value.toLowerCase();
      renderView(); // relancer le rendu filtré
    });
  }

  // Switch vue liste / kanban
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.viewMode = btn.dataset.view;
      renderView();
    });
  });
}

/* ----------------------------------------------------------------
   MODAL : ouverture / fermeture
   ---------------------------------------------------------------- */
function bindModal() {
  const overlay  = document.getElementById('modal-container');
  const closeBtn = document.getElementById('modal-close');

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay)  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  // Fermer avec Échap
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function openModal(html, size = '') {
  const overlay = document.getElementById('modal-container');
  const box     = document.getElementById('modal-box');
  const content = document.getElementById('modal-content');
  if (!overlay || !box || !content) return;

  content.innerHTML = html;
  box.className = 'modal-box' + (size ? ` modal-${size}` : '');
  overlay.style.display = 'flex';
}

function closeModal() {
  const overlay = document.getElementById('modal-container');
  if (overlay) overlay.style.display = 'none';
}

/* ================================================================
   RENDERERS PAR MODULE
   ================================================================ */

/* ---- DASHBOARD ---- */
function renderDashboard(view, container) {
  const db   = Store.getDB();
  const now  = new Date();
  const session = Auth.getSession();
  const isAdmin = session && session.role === 'admin';

  /* ---- KPI 1 : CA du mois (factures payées) ---- */
  const moisCur = now.getMonth();
  const anCur   = now.getFullYear();
  const caMois  = (db.factures || [])
    .filter(f => {
      if (!['Payée','Payé'].includes(f.statut)) return false;
      const d = new Date(f.date || f._createdAt);
      return d.getMonth() === moisCur && d.getFullYear() === anCur;
    })
    .reduce((s, f) => s + (f.totalTTC || 0), 0);

  /* ---- KPI 2 : Commandes en cours ---- */
  const commandesEnCours = (db.commandes || [])
    .filter(c => ['Confirmé','En cours','Prêt','En production'].includes(c.statut)).length;

  /* ---- KPI 3 : Devis en attente ---- */
  const devisEnAttente = (db.devis || [])
    .filter(d => ['Brouillon','Envoyé','En attente'].includes(d.statut)).length;

  /* ---- KPI 4 : Alertes stock ---- */
  const alertesStock = (db.produits || [])
    .filter(p => (p.stock || 0) <= (p.stockMin || 5)).length;

  /* ---- KPI 5 : OF en production ---- */
  const ofEnProd = (db.ordresFab || [])
    .filter(of => ['En cours','Planifié','Prêt'].includes(of.statut)).length;

  /* ---- KPI 6 : Factures impayées ---- */
  const facturesImpayees = (db.factures || [])
    .filter(f => !['Payée','Payé','Annulée','Annulé'].includes(f.statut)).length;

  /* ---- KPI 7 : Trésorerie (512000 Banque + 530000 Caisse) ---- */
  const tresorerie = (db.ecritures || [])
    .filter(e => ['512000','530000','512','530'].includes(String(e.compte || '')))
    .reduce((s, e) => s + (Number(e.debit) || 0) - (Number(e.credit) || 0), 0);

  /* ---- KPI 8 : Pipeline CRM ---- */
  const pipeline = (db.opportunites || [])
    .filter(o => !['Gagné','Perdu'].includes(o.statut)).length;

  /* ---- CA des 30 derniers jours ---- */
  const days30 = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days30.push({
      date:  d.toISOString().slice(0, 10),
      label: d.getDate() + '/' + (d.getMonth() + 1),
      ca:    0
    });
  }
  (db.factures || []).filter(f => ['Payée','Payé'].includes(f.statut)).forEach(f => {
    const key = (f.date || f._createdAt || '').slice(0, 10);
    const slot = days30.find(x => x.date === key);
    if (slot) slot.ca += (f.totalTTC || 0);
  });

  /* ---- Dernières activités ---- */
  const allActivity = [
    ...(db.ecritures  || []).map(e => ({ ...e, _type: 'ecriture' })),
    ...(db.factures   || []).map(f => ({ ...f, _type: 'facture'  })),
    ...(db.commandes  || []).map(c => ({ ...c, _type: 'commande' }))
  ].sort((a, b) => {
    const ta = new Date(b._updatedAt || b._createdAt || b.date || 0).getTime();
    const tb = new Date(a._updatedAt || a._createdAt || a.date || 0).getTime();
    return ta - tb;
  }).slice(0, 5);

  const moisLabel = now.toLocaleDateString('fr-FR', { month: 'long' });

  container.innerHTML = `
    <div class="page-header">
      <div class="page-title">Bonjour, ${escapeHtml(session?.prenom || 'Utilisateur')} 👋</div>
      <div class="page-subtitle">Tableau de bord HCS · ${fmtDate(now)}</div>
    </div>

    <!-- Raccourcis rapides -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px;">
      <button class="btn btn-primary btn-sm" onclick="openApp('ventes')">📄 Nouveau devis</button>
      <button class="btn btn-secondary btn-sm" onclick="openApp('ventes');setTimeout(()=>openView('orders'),60)">📦 Nouvelle commande</button>
      <button class="btn btn-secondary btn-sm" onclick="openApp('ventes');setTimeout(()=>openView('contacts'),60)">👤 Nouveau contact</button>
      ${isAdmin ? `
        <button class="btn btn-secondary btn-sm" onclick="openApp('stock')">📋 Nouveau produit</button>
        <button class="btn btn-secondary btn-sm" onclick="openApp('production')">🏭 Nouvel OF</button>
        <button class="btn btn-secondary btn-sm" onclick="openApp('caisse')">🛒 Ouvrir caisse</button>
      ` : ''}
    </div>

    <!-- Alertes intelligentes -->
    <div id="dash-alerts-block" style="margin-bottom:18px;"></div>

    <!-- 8 KPI cards en grille 4×2 -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;">
      <div id="dash-k1"></div>
      <div id="dash-k2"></div>
      <div id="dash-k3"></div>
      <div id="dash-k4"></div>
      <div id="dash-k5"></div>
      <div id="dash-k6"></div>
      <div id="dash-k7"></div>
      <div id="dash-k8"></div>
    </div>

    <!-- Graphique CA + Dernières activités -->
    <div style="display:grid;grid-template-columns:3fr 2fr;gap:20px;">
      <div class="card">
        <div class="card-header">
          <div class="card-title">CA des 30 derniers jours</div>
          <div style="font-size:12px;color:#6B7280;">Factures payées · XPF</div>
        </div>
        <div style="padding:4px 16px 16px;">
          <div id="dash-sparkline" style="height:90px;"></div>
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#9CA3AF;margin-top:4px;">
            <span>${days30[0].label}</span>
            <span>${days30[14].label}</span>
            <span>${days30[29].label}</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div class="card-title">Dernières activités</div>
        </div>
        <div style="padding:0 16px 16px;" id="dash-activities"></div>
      </div>
    </div>

    <!-- Mémos rapides -->
    <div class="card" style="margin-top:20px;">
      <div class="card-header">
        <div class="card-title">📝 Mémos rapides</div>
      </div>
      <div id="dash-memos" style="padding:0 4px 4px;"></div>
    </div>
  `;

  /* Rendu des KPI cards */
  statCard('dash-k1', { icon: '💰', value: caMois,          label: 'CA du mois',          color: '#16A34A', format: true, sub: 'Factures payées · ' + moisLabel });
  statCard('dash-k2', { icon: '📋', value: commandesEnCours, label: 'Commandes en cours',  color: '#2563EB', sub: 'Confirmées / En production' });
  statCard('dash-k3', { icon: '📝', value: devisEnAttente,   label: 'Devis en attente',    color: '#D97706', sub: 'Brouillons / Envoyés' });
  statCard('dash-k4', { icon: '⚠️', value: alertesStock,    label: 'Alertes stock',       color: alertesStock > 0 ? '#DC2626' : '#6B7280', sub: 'Produits sous seuil' });
  statCard('dash-k5', { icon: '🏭', value: ofEnProd,         label: 'OF en production',    color: '#7C3AED', sub: 'En cours / Planifiés' });
  statCard('dash-k6', { icon: '🧾', value: facturesImpayees, label: 'Factures impayées',   color: facturesImpayees > 0 ? '#DC2626' : '#6B7280', sub: 'En attente de paiement' });
  statCard('dash-k7', { icon: '🏦', value: tresorerie,       label: 'Trésorerie',          color: '#0891B2', format: true, sub: 'Banque + Caisse' });
  statCard('dash-k8', { icon: '🎯', value: pipeline,         label: 'Pipeline CRM',        color: '#6D28D9', sub: 'Opportunités actives' });

  /* Sparkline CA 30 jours */
  sparkline('dash-sparkline', { values: days30.map(d => d.ca), color: '#16A34A', height: 80 });

  /* Dernières activités */
  document.getElementById('dash-activities').innerHTML = _dashActivities(allActivity);

  /* ---- Alertes intelligentes ---- */
  (function renderAlerts() {
    const block = document.getElementById('dash-alerts-block');
    if (!block) return;
    const alerts = [];

    /* Stock bas */
    const stockBas = (db.produits || []).filter(p => (p.stock || 0) <= (p.stockMin || 5) && (p.stockMin || 5) > 0);
    if (stockBas.length > 0) {
      alerts.push({ type: 'warning', icon: '📦', msg: `${stockBas.length} produit(s) sous le seuil d'alerte : ${stockBas.slice(0,2).map(p=>p.nom).join(', ')}${stockBas.length>2?'…':''}` });
    }

    /* Factures impayées */
    const impayees = (db.factures || []).filter(f => !['Payé','Payée','Annulée','Annulé'].includes(f.statut));
    if (impayees.length > 0) {
      const totalImp = impayees.reduce((s,f) => s+(f.totalTTC||0), 0);
      alerts.push({ type: 'error', icon: '🧾', msg: `${impayees.length} facture(s) en attente de paiement — ${fmt(totalImp)}` });
    }

    /* Commandes en retard (> 48h depuis date livraison) */
    const now2 = new Date();
    const retard = (db.commandes || []).filter(c => {
      if (!['Confirmé','En production'].includes(c.statut)) return false;
      if (!c.dateLivraison) return false;
      return new Date(c.dateLivraison) < now2;
    });
    if (retard.length > 0) {
      alerts.push({ type: 'error', icon: '⏰', msg: `${retard.length} commande(s) en retard de livraison.` });
    }

    if (alerts.length === 0) {
      block.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;color:#16A34A;font-size:13px;">✅ Tout est en ordre — aucune alerte.</div>`;
      return;
    }

    block.innerHTML = alerts.map(a => {
      const bg    = a.type === 'error' ? '#FEF2F2' : '#FFFBEB';
      const border= a.type === 'error' ? '#FECACA' : '#FDE68A';
      const color = a.type === 'error' ? '#DC2626' : '#D97706';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:${bg};border:1px solid ${border};border-radius:8px;color:${color};font-size:13px;margin-bottom:6px;">
        <span style="font-size:16px;">${a.icon}</span><span>${escapeHtml(a.msg)}</span>
      </div>`;
    }).join('');
  })();

  /* ---- Mémos rapides ---- */
  (function renderMemos() {
    const memosEl = document.getElementById('dash-memos');
    if (!memosEl) return;
    const memos = JSON.parse(localStorage.getItem('hcs_memos') || '[]');
    memosEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${memos.slice(0,5).map((m,i) => `
          <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:#FFFBEB;border-radius:6px;border:1px solid #FDE68A;">
            <span style="font-size:11px;flex:1;color:#92400E;line-height:1.4;">${escapeHtml(m.text)}</span>
            <button onclick="event.stopPropagation();var m=JSON.parse(localStorage.getItem('hcs_memos')||'[]');m.splice(${i},1);localStorage.setItem('hcs_memos',JSON.stringify(m));renderDashboard('overview',document.getElementById('view-content'));"
              style="background:none;border:none;cursor:pointer;color:#D97706;font-size:14px;line-height:1;padding:0;">✕</button>
          </div>`).join('')}
        <div style="display:flex;gap:6px;margin-top:4px;">
          <input id="new-memo-input" type="text" placeholder="Nouvelle note rapide…"
            style="flex:1;padding:6px 10px;border:1px solid #E2E8F0;border-radius:6px;font-size:12px;outline:none;"
            onkeydown="if(event.key==='Enter'){var v=this.value.trim();if(v){var m=JSON.parse(localStorage.getItem('hcs_memos')||'[]');m.unshift({text:v,date:new Date().toISOString()});localStorage.setItem('hcs_memos',JSON.stringify(m));renderDashboard('overview',document.getElementById('view-content'));}}" />
          <button onclick="var v=document.getElementById('new-memo-input')?.value?.trim();if(v){var m=JSON.parse(localStorage.getItem('hcs_memos')||'[]');m.unshift({text:v,date:new Date().toISOString()});localStorage.setItem('hcs_memos',JSON.stringify(m));renderDashboard('overview',document.getElementById('view-content'));}"
            style="padding:6px 12px;background:var(--accent-blue);color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer;">Ajouter</button>
        </div>
      </div>`;
  })();
}

/** Génère le HTML des dernières activités pour le dashboard */
function _dashActivities(items) {
  if (!items || items.length === 0) {
    return `<div style="padding:20px;text-align:center;color:#9CA3AF;font-size:14px;">Aucune activité récente</div>`;
  }
  const icons = { ecriture: '📒', facture: '🧾', commande: '📦' };
  return items.map(item => {
    const icon   = icons[item._type] || '📌';
    const label  = item.libelle || item.ref || item.numero || item.id || '—';
    const sub    = item.client || (item.compte ? 'Compte ' + item.compte : '');
    const amount = item._type === 'ecriture'
      ? Math.max(Number(item.debit) || 0, Number(item.credit) || 0)
      : (item.totalTTC || 0);
    const date   = item._updatedAt || item._createdAt || item.date || '';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F3F4F6;">
        <span style="font-size:18px;flex-shrink:0;">${icon}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:#111827;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(String(label))}</div>
          ${sub ? `<div style="font-size:11px;color:#6B7280;">${escapeHtml(String(sub))}</div>` : ''}
        </div>
        <div style="text-align:right;flex-shrink:0;">
          ${amount > 0 ? `<div style="font-size:12px;font-weight:700;color:#059669;">${fmt(amount)}</div>` : ''}
          <div style="font-size:11px;color:#9CA3AF;">${fmtDateRelative(date)}</div>
        </div>
      </div>`;
  }).join('');
}

/* ---- CRM — délégué à js/modules/crm.js ---- */
// Les fonctions CRM (pipeline, contacts, entreprises) sont dans CRM.init()

/* ---- VENTES — délégué à js/modules/sales.js ---- */
// Les fonctions Ventes (quotes, orders, invoices, rapport) sont dans Sales.init()

/* ---- ACHATS — délégué à js/modules/purchases.js ---- */
// Les fonctions Achats (suppliers, po, purchase-report) sont dans Purchases.init()

/* ---- STOCK — délégué à js/modules/inventory.js ---- */
// Les fonctions Stock (products, categories, stock-moves, stock-report) sont dans Inventory.init()

/* ---- PRODUCTION — délégué à js/modules/manufacturing.js ---- */
// Les fonctions Production (mo, bom, work-centers) sont dans Manufacturing.init()

/* ---- COMPTABILITÉ — délégué à js/modules/accounting.js ---- */
// Les fonctions Comptabilité (journal, accounts, pl-report, balance, tax-report)
// sont dans Accounting.init()

/* ---- IFRAME GÉNÉRIQUE — utilisé par Caisse et Outils HCS ---- */
/**
 * Charge un fichier HTML dans un iframe plein écran dans la zone de contenu.
 * @param {string} src - Chemin relatif vers le fichier HTML (ex: 'modules/caisse-pos.html')
 * @param {HTMLElement} container - Zone de rendu (#view-content)
 */
function renderIframe(src, container) {
  container.style.padding = '0';
  container.style.overflow = 'hidden';
  container.innerHTML = `
    <iframe
      src="${src}"
      style="width:100%; height:calc(100vh - 60px); border:none; display:block;"
      allow="clipboard-read; clipboard-write"
    ></iframe>
  `;
}

/* ---- RH ---- */
function renderRH(view, container) {
  container.innerHTML = `
    <div class="table-empty">
      <div class="empty-icon">👤</div>
      <p>Module RH — Vue "${view}" à venir</p>
    </div>`;
}

/* ---- MESSAGERIE — délégué à js/modules/discuss.js ---- */
// Les fonctions Discussion (inbox, general, production, ventes) sont dans Discuss.init()

/* ================================================================
   FONCTIONS UTILITAIRES DE RENDU
   ================================================================ */

/* Badge de statut selon la valeur */
function badgeStatut(statut, context) {
  const map = {
    'Brouillon':    'badge-brouillon',
    'Confirmé':     'badge-confirme',
    'En cours':     'badge-en-cours',
    'Terminé':      'badge-termine',
    'Livré':        'badge-livre',
    'Annulé':       'badge-annule',
    'Payé':         'badge-paye',
    'En attente':   'badge-en-attente',
    // CRM
    'Nouveau':      'badge-gray',
    'Qualifié':     'badge-blue',
    'Proposition':  'badge-orange',
    'Négociation':  'badge-violet',
    'Gagné':        'badge-green',
    'Perdu':        'badge-red'
  };
  const cls = map[statut] || 'badge-gray';
  return `<span class="badge ${cls}">${statut || '—'}</span>`;
}

/* Initiales pour les avatars */
function initiales(nom) {
  if (!nom) return '?';
  return nom.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

/* Échapper le HTML dans les messages */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* Stubs pour les formulaires (à enrichir) */
function newOpportunite() { openModal('<div class="modal-title">Nouvelle opportunité</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function newContact()     { openModal('<div class="modal-title">Nouveau contact</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function newDevis()       { openModal('<div class="modal-title">Nouveau devis</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function newCommande()    { openModal('<div class="modal-title">Nouvelle commande</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function newFacture()     { openModal('<div class="modal-title">Nouvelle facture</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function newProduit()     { openModal('<div class="modal-title">Nouveau produit</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function newBonAchat()    { openModal('<div class="modal-title">Nouveau bon d\'achat</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function newAjustement()  { openModal('<div class="modal-title">Ajustement de stock</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function newOrdre()       { openModal('<div class="modal-title">Nouvel ordre de fabrication</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function newEcriture()    { openModal('<div class="modal-title">Nouvelle écriture</div><p style="color:var(--text-secondary)">Formulaire à venir.</p>'); }
function openOpp(id)      { openModal(`<div class="modal-title">Opportunité #${id}</div><p style="color:var(--text-secondary)">Fiche détail à venir.</p>`); }

/* ================================================================
   MENU ADMIN (⚙️) — accessible uniquement aux admins depuis la topbar
   ================================================================ */

/**
 * Ouvre la modale d'administration (export / import / reset).
 */
function openAdminModal() {
  openModal(`
    <div class="modal-title">⚙️ Administration HCS ERP</div>
    <div style="display:flex;flex-direction:column;gap:20px;margin-top:20px;">

      <div>
        <div style="font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;
                    letter-spacing:.08em;margin-bottom:10px;">Base de données</div>
        <div style="display:flex;flex-direction:column;gap:8px;">

          <button class="btn btn-secondary" style="justify-content:flex-start;gap:10px;"
            onclick="Store.exportJSON();closeModal();">
            📥 <span>Exporter toute la base (JSON)</span>
          </button>

          <label class="btn btn-secondary"
            style="justify-content:flex-start;gap:10px;cursor:pointer;">
            📤 <span>Importer une base (JSON)</span>
            <input type="file" accept=".json" id="admin-import-file"
              style="display:none;" />
          </label>

          <button class="btn btn-secondary"
            style="justify-content:flex-start;gap:10px;color:#DC2626;border-color:#FCA5A5;"
            onclick="confirmResetDB()">
            🗑️ <span>Réinitialiser les données (seed)</span>
          </button>
        </div>
      </div>

      <div style="font-size:12px;color:#6B7280;background:#F9FAFB;
                  border-radius:8px;padding:12px;line-height:1.8;">
        <strong>Version :</strong> HCS ERP v1.0.0<br>
        <strong>Comptes :</strong> admin / yannick (admin) · vendeur (vendeur)<br>
        <strong>Stockage :</strong> localStorage du navigateur
      </div>
    </div>
  `);

  /* Liaison du champ file après l'injection dans le DOM */
  setTimeout(() => {
    const fileInput = document.getElementById('admin-import-file');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        Store.importJSON(file)
          .then(() => {
            toast('Base importée avec succès. Rechargement en cours…', 'success');
            closeModal();
            setTimeout(() => location.reload(), 1500);
          })
          .catch(err => toast('Erreur import : ' + err.message, 'error'));
      });
    }
  }, 100);
}

/** Confirmation avant réinitialisation des données. */
function confirmResetDB() {
  if (confirm('⚠️ ATTENTION\n\nRéinitialiser toutes les données avec le seed initial ?\nCette action est irréversible.')) {
    Store.reset();
    closeModal();
    toast('Données réinitialisées. Rechargement…', 'success');
    setTimeout(() => location.reload(), 1500);
  }
}

/* ================================================================
   RECHERCHE GLOBALE (Ctrl+K)
   Cherche dans : contacts, produits, devis, commandes, factures
   ================================================================ */

/** Active le raccourci Ctrl+K pour ouvrir la recherche globale. */
function initGlobalSearch() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      /* Déléguer à la Command Palette si disponible */
      if (typeof CommandPalette !== 'undefined') {
        CommandPalette.open();
      } else {
        openSearchModal();
      }
    }
    /* Ctrl+N = nouveau devis */
    if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        openApp('ventes');
        setTimeout(() => openView('quotes'), 60);
      }
    }
  });
}

/** Ouvre (ou réaffiche) la modale de recherche globale. */
function openSearchModal() {
  let overlay = document.getElementById('global-search-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'global-search-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; z-index:9000;
      background:rgba(0,0,0,0.5);
      display:flex; align-items:flex-start; justify-content:center;
      padding-top:10vh;
    `;
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeSearchModal();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div style="
      background:#fff; border-radius:14px; width:640px; max-height:72vh;
      display:flex; flex-direction:column; overflow:hidden;
      box-shadow:0 24px 80px rgba(0,0,0,0.35);
    ">
      <div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid #E5E7EB;">
        <span style="font-size:20px;color:#6B7280;">🔍</span>
        <input type="text" id="global-search-input"
          placeholder="Rechercher contacts, produits, devis, commandes, factures…"
          style="flex:1;border:none;outline:none;font-size:16px;background:transparent;color:#111827;"
          autofocus />
        <kbd style="font-size:11px;color:#9CA3AF;background:#F3F4F6;padding:3px 8px;
                    border-radius:4px;white-space:nowrap;">Échap</kbd>
      </div>
      <div id="global-search-results" style="overflow-y:auto;flex:1;min-height:80px;"></div>
    </div>
  `;
  overlay.style.display = 'flex';

  const input = document.getElementById('global-search-input');
  if (input) {
    input.addEventListener('input', debounce(e => _performGlobalSearch(e.target.value), 180));
    input.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearchModal(); });
    _performGlobalSearch(''); // état initial
  }
}

/** Ferme la modale de recherche globale. */
function closeSearchModal() {
  const overlay = document.getElementById('global-search-overlay');
  if (overlay) overlay.style.display = 'none';
}

/**
 * Effectue la recherche et affiche les résultats groupés par type.
 * @param {string} query
 */
function _performGlobalSearch(query) {
  const resultsEl = document.getElementById('global-search-results');
  if (!resultsEl) return;

  const q = (query || '').toLowerCase().trim();
  if (!q) {
    resultsEl.innerHTML = `
      <div style="padding:28px;text-align:center;color:#9CA3AF;font-size:14px;">
        Commencez à taper pour chercher dans toute la base…
      </div>`;
    return;
  }

  const db = Store.getDB();

  /* Collections à fouiller */
  const COLS = [
    { key: 'contacts',  label: 'Contacts',  icon: '👤', fields: ['nom','email','telephone'], app: 'ventes', view: 'contacts' },
    { key: 'produits',  label: 'Produits',  icon: '📦', fields: ['nom','sku','categorie'],   app: 'stock', view: 'products' },
    { key: 'devis',     label: 'Devis',     icon: '📄', fields: ['ref','client','numero'],   app: 'ventes',view: 'quotes'   },
    { key: 'commandes', label: 'Commandes', icon: '📋', fields: ['ref','client','numero'],   app: 'ventes',view: 'orders'   },
    { key: 'factures',  label: 'Factures',  icon: '🧾', fields: ['ref','client','numero'],   app: 'ventes',view: 'invoices' },
  ];

  let html  = '';
  let found = 0;

  COLS.forEach(col => {
    const matches = (db[col.key] || [])
      .filter(item => col.fields.some(f => String(item[f] || '').toLowerCase().includes(q)))
      .slice(0, 4);

    if (!matches.length) return;
    found += matches.length;

    html += `
      <div style="padding:8px 20px 4px;font-size:11px;font-weight:700;color:#6B7280;
                  text-transform:uppercase;letter-spacing:.08em;">
        ${col.icon} ${col.label}
      </div>`;

    matches.forEach(item => {
      const primary   = item[col.fields[0]] || item.id || '—';
      const secondary = item[col.fields[1]] || item[col.fields[2]] || '';
      html += `
        <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;
                    cursor:pointer;transition:background .1s;"
          onmouseenter="this.style.background='#F3F4F6'"
          onmouseleave="this.style.background=''"
          onclick="closeSearchModal();openApp('${col.app}');setTimeout(()=>openView('${col.view}'),60);">
          <span style="font-size:22px;">${col.icon}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:#111827;
                        overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${escapeHtml(String(primary))}
            </div>
            ${secondary
              ? `<div style="font-size:12px;color:#6B7280;">${escapeHtml(String(secondary))}</div>`
              : ''}
          </div>
          <span style="font-size:14px;color:#D1D5DB;">→</span>
        </div>`;
    });
  });

  if (!found) {
    html = `
      <div style="padding:28px;text-align:center;color:#9CA3AF;font-size:14px;">
        Aucun résultat pour
        <strong style="color:#6B7280;">"${escapeHtml(query)}"</strong>
      </div>`;
  }
  resultsEl.innerHTML = html;
}

/* ================================================================
   POINT D'ENTRÉE — appelé par auth.js après connexion
   ================================================================ */
// Exposé globalement pour être appelé depuis auth.js
window.initApp = initApp;
