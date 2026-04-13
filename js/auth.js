/* ================================================================
   HCS ERP — auth.js  v2.0
   Authentification, gestion de session, rôles et permissions.
   Inspiré d'Odoo (groupes), Salesforce (profils) et QuickBooks (types d'accès).
   ================================================================ */

'use strict';

/* ================================================================
   DÉFINITION DES RÔLES
   Chaque rôle définit : label, couleur, icône, modules accessibles,
   et droits de gestion des utilisateurs.
   ================================================================ */
const ROLES = {
  super_admin: {
    label:       'Super Admin',
    description: 'Accès complet — gestion des utilisateurs et paramètres système',
    color:       '#DC2626',
    icon:        '👑',
    modules:     '*',              // '*' = tous les modules
    peutGererUtilisateurs: true,
    peutCreerSuperAdmin:   true
  },
  admin: {
    label:       'Administrateur',
    description: 'Accès à tous les modules métier de l\'ERP',
    color:       '#6366F1',
    icon:        '🛡️',
    modules:     ['dashboard','crm','ventes','achats','stock','production',
                  'comptabilite','rh','messagerie','caisse','outils','parametres'],
    peutGererUtilisateurs: true,
    peutCreerSuperAdmin:   false
  },
  comptable: {
    label:       'Comptable',
    description: 'Comptabilité, ventes en lecture et rapports financiers',
    color:       '#0891B2',
    icon:        '💼',
    modules:     ['dashboard','comptabilite','ventes','achats','messagerie'],
    peutGererUtilisateurs: false,
    peutCreerSuperAdmin:   false
  },
  commercial: {
    label:       'Commercial',
    description: 'CRM, devis, commandes, factures et caisse',
    color:       '#16A34A',
    icon:        '🤝',
    modules:     ['dashboard','crm','ventes','caisse','messagerie'],
    peutGererUtilisateurs: false,
    peutCreerSuperAdmin:   false
  },
  magasinier: {
    label:       'Magasinier',
    description: 'Stocks, achats fournisseurs et production',
    color:       '#D97706',
    icon:        '📦',
    modules:     ['dashboard','stock','achats','production','messagerie'],
    peutGererUtilisateurs: false,
    peutCreerSuperAdmin:   false
  },
  vendeur: {
    label:       'Vendeur',
    description: 'Saisie de devis, commandes et point de caisse',
    color:       '#7C3AED',
    icon:        '🛒',
    modules:     ['dashboard','crm','ventes','caisse','messagerie'],
    peutGererUtilisateurs: false,
    peutCreerSuperAdmin:   false
  },
  lecture: {
    label:       'Lecture seule',
    description: 'Consultation uniquement — aucune création ni modification',
    color:       '#8C96B0',
    icon:        '👁️',
    modules:     ['dashboard','crm','ventes','stock','messagerie'],
    peutGererUtilisateurs: false,
    peutCreerSuperAdmin:   false
  }
};

/* ================================================================
   PERMISSIONS D'ACTION PAR RÔLE
   Inspiré de la matrice ACL d'Odoo : lire / créer / modifier /
   supprimer / exporter.
   ================================================================ */
const ACTION_PERMISSIONS = {
  super_admin: { lire:true,  creer:true,  modifier:true,  supprimer:true,  exporter:true  },
  admin:       { lire:true,  creer:true,  modifier:true,  supprimer:true,  exporter:true  },
  comptable:   { lire:true,  creer:true,  modifier:true,  supprimer:false, exporter:true  },
  commercial:  { lire:true,  creer:true,  modifier:true,  supprimer:false, exporter:false },
  magasinier:  { lire:true,  creer:true,  modifier:true,  supprimer:false, exporter:false },
  vendeur:     { lire:true,  creer:true,  modifier:false, supprimer:false, exporter:false },
  lecture:     { lire:true,  creer:false, modifier:false, supprimer:false, exporter:false }
};

/* ================================================================
   COULEURS D'AVATAR (assignées aléatoirement à la création)
   ================================================================ */
const AVATAR_COLORS = [
  '#6366F1','#16A34A','#DC2626','#D97706',
  '#7C3AED','#0891B2','#EC4899','#059669'
];

/* ================================================================
   UTILITAIRES
   ================================================================ */

/**
 * Hachage simple du mot de passe (synchrone, côté client).
 * Algorithme DJB2 avec sel fixe.
 * ⚠️  Dans un vrai ERP serveur, utiliser bcrypt côté back-end.
 * @param {string} mdp - Mot de passe en clair
 * @returns {string} Hash hexadécimal 8 caractères
 */
function _hashMdp(mdp) {
  let h = 5381;
  const s = 'hcs2026:' + mdp + ':erp';
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Génère les initiales à partir d'un prénom + nom.
 * @param {string} prenom
 * @param {string} nom
 * @returns {string}
 */
function _initiales(prenom, nom) {
  const p = (prenom || '').trim();
  const n = (nom || '').trim();
  return ((p[0] || '') + (n[0] || '')).toUpperCase() || '??';
}

/**
 * Choisit une couleur d'avatar de façon déterministe selon le login.
 * @param {string} login
 * @returns {string} couleur hex
 */
function _couleurAvatar(login) {
  let h = 0;
  for (let i = 0; i < (login || '').length; i++) h += login.charCodeAt(i);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* ================================================================
   GESTION DE SESSION (localStorage)
   ================================================================ */
const SESSION_KEY = 'hcs_erp_session';

const Auth = (() => {

  /* ------ SESSION ------ */

  /** Retourne la session courante ou null */
  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /**
   * Enregistre une session complète depuis un objet utilisateur.
   * @param {object} user - Enregistrement utilisateur depuis DB.utilisateurs
   */
  function setSession(user) {
    const session = {
      id:         user.id,
      login:      user.login,
      prenom:     user.prenom,
      nom:        user.nom || '',
      role:       user.role,
      avatar:     user.avatar || _initiales(user.prenom, user.nom),
      couleur:    user.couleurAvatar || _couleurAvatar(user.login),
      loginAt:    new Date().toISOString()
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  /** Supprime la session */
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /* ------ AUTHENTIFICATION ------ */

  /**
   * Vérifie les identifiants et retourne l'utilisateur ou null.
   * Gère la migration : si `mdp` (plain) est stocké, upgrade vers `mdpHash`.
   * @param {string} login
   * @param {string} mdp
   * @returns {object|null}
   */
  function authenticate(login, mdp) {
    const db    = Store.getDB();
    const users = db.utilisateurs || [];

    /* Chercher l'utilisateur actif avec ce login */
    const user = users.find(u => u.login === login && u.actif !== false);
    if (!user) return null;

    /* Comparer le mot de passe */
    const inputHash = _hashMdp(mdp);

    if (user.mdpHash) {
      /* Comparaison hashée (mode normal) */
      if (user.mdpHash !== inputHash) return null;
    } else if (user.mdp) {
      /* Migration : mdp stocké en clair dans le seed → comparaison directe */
      if (user.mdp !== mdp) return null;
      /* Upgrade vers hash + supprimer le champ clair */
      Store.update('utilisateurs', user.id, { mdpHash: inputHash, mdp: undefined });
    } else {
      return null;
    }

    /* Mettre à jour la dernière connexion */
    Store.update('utilisateurs', user.id, {
      derniereConnexion: new Date().toISOString()
    });

    /* Journaliser la connexion */
    Store.addAuditLog('Connexion', 'auth', { login });

    return user;
  }

  /* ------ CONTRÔLE D'ACCÈS ------ */

  /**
   * Retourne true si l'utilisateur courant a accès au module donné.
   * @param {string} moduleId - ex: 'ventes', 'comptabilite', 'parametres'
   * @returns {boolean}
   */
  function canAccess(moduleId) {
    const session = getSession();
    if (!session) return false;
    const role = ROLES[session.role];
    if (!role) return false;
    if (role.modules === '*') return true;
    return role.modules.includes(moduleId);
  }

  /**
   * Retourne true si l'utilisateur courant peut effectuer l'action.
   * @param {'lire'|'creer'|'modifier'|'supprimer'|'exporter'} action
   * @returns {boolean}
   */
  function canDo(action) {
    const session = getSession();
    if (!session) return false;
    const perms = ACTION_PERMISSIONS[session.role];
    return perms ? !!perms[action] : false;
  }

  /**
   * Retourne true si l'utilisateur courant a l'un des rôles listés.
   * @param {...string} roles
   * @returns {boolean}
   */
  function hasRole(...roles) {
    const session = getSession();
    return session ? roles.includes(session.role) : false;
  }

  /**
   * Retourne true si l'utilisateur courant peut gérer les utilisateurs.
   * @returns {boolean}
   */
  function peutGererUtilisateurs() {
    const session = getSession();
    if (!session) return false;
    const role = ROLES[session.role];
    return role ? !!role.peutGererUtilisateurs : false;
  }

  /** Retourne true si rôle admin ou super_admin (compatibilité ascendante) */
  function isAdmin() {
    return hasRole('admin', 'super_admin');
  }

  /* ------ API PUBLIQUE ------ */
  return {
    getSession,
    setSession,
    clearSession,
    authenticate,
    canAccess,
    canDo,
    hasRole,
    isAdmin,
    peutGererUtilisateurs
  };
})();

/* ================================================================
   ÉCRAN DE CONNEXION
   ================================================================ */
function renderLoginScreen() {
  const screen = document.getElementById('login-screen');
  if (!screen) return;

  injectLoginCSS();

  screen.innerHTML = `
    <div class="login-card">
      <!-- Logo -->
      <div class="login-logo">
        <span class="login-logo-icon">⬡</span>
        <span class="login-logo-text">HCS ERP</span>
      </div>
      <div class="login-subtitle">Système de gestion HCS Polynésie</div>

      <!-- Formulaire -->
      <form id="login-form" onsubmit="handleLogin(event)" autocomplete="off">
        <div class="form-group" style="margin-bottom:16px;">
          <label class="form-label" for="login-input">Identifiant</label>
          <input
            type="text"
            id="login-input"
            class="form-control"
            placeholder="Votre identifiant…"
            required
            autofocus
          />
        </div>
        <div class="form-group" style="margin-bottom:8px;">
          <label class="form-label" for="mdp-input">Mot de passe</label>
          <div style="position:relative;">
            <input
              type="password"
              id="mdp-input"
              class="form-control"
              placeholder="••••••••"
              required
              style="padding-right:40px;"
            />
            <button type="button" id="toggle-mdp"
              style="position:absolute;right:10px;top:50%;transform:translateY(-50%);
                     background:none;border:none;cursor:pointer;color:#8C96B0;font-size:16px;"
              onclick="toggleMdpVisibility()"
              title="Afficher/masquer le mot de passe">👁️</button>
          </div>
        </div>

        <!-- Message d'erreur -->
        <div id="login-error"
          style="display:none;margin-bottom:12px;padding:10px 12px;
                 background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;
                 color:#B91C1C;font-size:13px;text-align:center;">
        </div>

        <!-- Bouton connexion -->
        <button type="submit" class="btn btn-primary"
          style="width:100%;justify-content:center;height:42px;margin-top:16px;font-size:15px;font-weight:600;">
          Se connecter
        </button>
      </form>

      <!-- Comptes de démo -->
      <div class="login-hint">
        <details>
          <summary>Comptes de démonstration</summary>
          <div class="login-demo-accounts">
            <div class="demo-account" onclick="fillLogin('admin','admin2026')">
              <span class="demo-role-badge" style="background:#DC2626;">👑 Super Admin</span>
              <code>admin</code> / <code>admin2026</code>
            </div>
            <div class="demo-account" onclick="fillLogin('yannick','yannick2026')">
              <span class="demo-role-badge" style="background:#6366F1;">🛡️ Admin</span>
              <code>yannick</code> / <code>yannick2026</code>
            </div>
            <div class="demo-account" onclick="fillLogin('vendeur','vente2026')">
              <span class="demo-role-badge" style="background:#7C3AED;">🛒 Vendeur</span>
              <code>vendeur</code> / <code>vente2026</code>
            </div>
            <div class="demo-account" onclick="fillLogin('comptable','compta2026')">
              <span class="demo-role-badge" style="background:#0891B2;">💼 Comptable</span>
              <code>comptable</code> / <code>compta2026</code>
            </div>
          </div>
        </details>
      </div>

      <div class="login-version">HCS ERP v2.0 · Polynésie Française · 2026</div>
    </div>
  `;
}

/* Remplir le formulaire de login au clic sur un compte de démo */
function fillLogin(login, mdp) {
  const l = document.getElementById('login-input');
  const m = document.getElementById('mdp-input');
  if (l) l.value = login;
  if (m) m.value = mdp;
  document.getElementById('login-form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
}

/* Afficher/masquer le mot de passe */
function toggleMdpVisibility() {
  const input = document.getElementById('mdp-input');
  const btn   = document.getElementById('toggle-mdp');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.textContent = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.textContent = '👁️';
  }
}

/* ================================================================
   SOUMISSION DU FORMULAIRE DE CONNEXION
   ================================================================ */
function handleLogin(event) {
  event.preventDefault();

  const loginVal = document.getElementById('login-input')?.value.trim();
  const mdpVal   = document.getElementById('mdp-input')?.value;
  const errorEl  = document.getElementById('login-error');

  if (!loginVal || !mdpVal) return;

  /* Réinitialiser l'erreur */
  if (errorEl) { errorEl.style.display = 'none'; errorEl.textContent = ''; }

  /* Vérification */
  const user = Auth.authenticate(loginVal, mdpVal);

  if (!user) {
    if (errorEl) {
      errorEl.textContent = 'Identifiant ou mot de passe incorrect.';
      errorEl.style.display = 'block';
    }
    /* Animation secouer */
    const card = document.querySelector('.login-card');
    if (card) {
      card.style.animation = 'loginShake 0.4s ease';
      setTimeout(() => { card.style.animation = ''; }, 400);
    }
    return;
  }

  /* Connexion réussie */
  Auth.setSession(user);
  showApp();
}

/* ================================================================
   AFFICHAGE DU SHELL
   ================================================================ */
function showApp() {
  const loginScreen = document.getElementById('login-screen');
  if (loginScreen) {
    loginScreen.style.opacity = '0';
    loginScreen.style.transition = 'opacity 0.3s ease';
    setTimeout(() => { loginScreen.style.display = 'none'; }, 300);
  }

  const appShell = document.getElementById('app-shell');
  if (appShell) {
    appShell.style.display = 'flex';
    appShell.style.opacity = '0';
    setTimeout(() => {
      appShell.style.opacity = '1';
      appShell.style.transition = 'opacity 0.3s ease';
    }, 50);
  }

  /* Lier le bouton de déconnexion */
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  /* Initialiser l'application */
  if (typeof initApp === 'function') initApp();
}

/* ================================================================
   DÉCONNEXION
   ================================================================ */
function handleLogout() {
  if (!confirm('Se déconnecter de HCS ERP ?')) return;

  /* Journaliser la déconnexion */
  const session = Auth.getSession();
  if (session) Store.addAuditLog('Déconnexion', 'auth', { login: session.login });

  Auth.clearSession();

  const appShell   = document.getElementById('app-shell');
  const loginScreen = document.getElementById('login-screen');

  if (appShell)    appShell.style.display = 'none';
  if (loginScreen) {
    loginScreen.style.display  = 'flex';
    loginScreen.style.opacity  = '1';
    document.getElementById('login-form')?.reset();
  }
}

/* ================================================================
   CSS DE L'ÉCRAN DE CONNEXION
   ================================================================ */
function injectLoginCSS() {
  if (document.getElementById('login-styles')) return;
  const style = document.createElement('style');
  style.id = 'login-styles';
  style.textContent = `
    #login-screen {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: var(--bg-base);
      background-image:
        radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 20%, rgba(0,212,170,0.05) 0%, transparent 50%);
    }

    .login-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: var(--shadow-lg), 0 0 40px rgba(99,102,241,0.08);
    }

    .login-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .login-logo-icon { font-size: 2rem; color: var(--accent-blue); }
    .login-logo-text {
      font-size: 1.6rem;
      font-weight: var(--font-bold);
      color: var(--text-primary);
      letter-spacing: 0.03em;
    }

    .login-subtitle {
      text-align: center;
      font-size: var(--text-sm);
      color: var(--text-muted);
      margin-bottom: 32px;
    }

    .login-hint {
      margin-top: 20px;
      font-size: var(--text-xs);
      color: var(--text-muted);
    }
    .login-hint summary {
      cursor: pointer;
      text-align: center;
      padding: 6px;
      border-radius: var(--radius-sm);
      user-select: none;
    }
    .login-hint summary:hover { color: var(--text-secondary); }

    .login-demo-accounts {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 10px;
    }

    .demo-account {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: var(--radius-md);
      cursor: pointer;
      border: 1px solid var(--border-light);
      transition: background var(--transition);
    }
    .demo-account:hover { background: var(--bg-hover); }

    .demo-role-badge {
      font-size: 10px;
      font-weight: 600;
      color: #fff;
      border-radius: 4px;
      padding: 2px 7px;
      flex-shrink: 0;
    }

    .demo-account code {
      background: var(--bg-active);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 1px 5px;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--accent-blue);
    }

    .login-version {
      margin-top: 24px;
      text-align: center;
      font-size: 10px;
      color: var(--text-muted);
    }

    @keyframes loginShake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-8px); }
      40%       { transform: translateX(8px); }
      60%       { transform: translateX(-5px); }
      80%       { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(style);
}

/* ================================================================
   EXPOSITION GLOBALE (utilisé par d'autres modules)
   ================================================================ */
window.ROLES              = ROLES;
window.ACTION_PERMISSIONS = ACTION_PERMISSIONS;
window.AVATAR_COLORS      = AVATAR_COLORS;
window._hashMdp           = _hashMdp;
window._initiales         = _initiales;
window._couleurAvatar     = _couleurAvatar;

/* ================================================================
   POINT D'ENTRÉE — exécuté au chargement de la page
   ================================================================ */
(function () {
  const session = Auth.getSession();
  if (session) {
    showApp();
  } else {
    renderLoginScreen();
  }
})();
