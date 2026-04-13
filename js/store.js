/* ================================================================
   HCS ERP — store.js
   Objet DB global, fonctions CRUD génériques,
   sauvegarde / chargement localStorage, import / export JSON
   ================================================================ */

'use strict';

/* ----------------------------------------------------------------
   CLÉ DE STOCKAGE DANS LE LOCALSTORAGE
   ---------------------------------------------------------------- */
const LS_KEY = 'hcs_erp_db';

/* ----------------------------------------------------------------
   SCHÉMA PAR DÉFAUT DE LA BASE
   Rempli par data/seed.js au premier démarrage
   ---------------------------------------------------------------- */
const DB_DEFAULT = {
  produits:          [],
  contacts:          [],
  fournisseurs:      [],
  opportunites:      [],
  devis:             [],
  commandes:         [],
  factures:          [],
  facturesPartielles:[],  // Acomptes et situations de travaux
  paiements:         [],  // Encaissements et décaissements
  bonsAchat:         [],
  ordresFab:         [],
  ecritures:         [],
  messages:          [],
  utilisateurs:      [],   // Comptes utilisateurs ERP
  auditLog:          [],   // Journal d'audit (actions utilisateurs)
  depenses:          [],   // Dépenses du magasin (avec TVA 13% / 16%)
  _meta: {
    version: '1.2.0',
    createdAt: new Date().toISOString(),
    counters: {
      devis:              0,
      commandes:          0,
      factures:           0,
      facturesPartielles: 0,
      paiements:          0,
      bonsAchat:          0,
      ordresFab:          0,
      ecritures:          0,
      utilisateurs:       0
    }
  }
};

/* ----------------------------------------------------------------
   STORE : API publique
   ---------------------------------------------------------------- */
const Store = (() => {

  // Base en mémoire (chargée depuis localStorage ou seed)
  let db = null;

  /* ---------- CHARGEMENT ---------- */

  /**
   * Charge la base depuis localStorage.
   * Si aucune donnée n'existe, initialise avec les données du seed.
   */
  function load() {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      try {
        db = JSON.parse(raw);
        /* Migration non-destructive : préserver les données utilisateur */
        const seedVersion = (typeof SEED !== 'undefined' && SEED._meta) ? SEED._meta.seedVersion : null;
        const dbVersion   = db._meta ? db._meta.seedVersion : null;
        let patched = false;

        /* 1. Ajouter les collections manquantes (sans écraser les existantes) */
        Object.keys(DB_DEFAULT).forEach(col => {
          if (col !== '_meta' && !db[col]) {
            /* Si la collection est nouvelle et que le seed en a, on l'injecte */
            db[col] = (typeof SEED !== 'undefined' && SEED[col]) ? SEED[col] : [];
            patched = true;
          }
        });

        /* 2. Ajouter les compteurs manquants */
        if (!db._meta) db._meta = { counters: {} };
        if (!db._meta.counters) db._meta.counters = {};
        Object.keys(DB_DEFAULT._meta.counters).forEach(k => {
          if (db._meta.counters[k] === undefined) { db._meta.counters[k] = 0; patched = true; }
        });

        /* 3. Ajouter les écritures du seed qui n'existent pas encore (par id) */
        if (seedVersion && seedVersion !== dbVersion && typeof SEED !== 'undefined') {
          const existingIds = new Set((db.ecritures || []).map(e => e.id));
          (SEED.ecritures || []).forEach(e => {
            if (!existingIds.has(e.id)) { db.ecritures.push(e); patched = true; }
          });
          console.info(`[Store] Migration seed ${dbVersion || 'null'} → ${seedVersion} (données préservées)`);
        }

        /* 4. Mettre à jour la version */
        if (seedVersion && db._meta.seedVersion !== seedVersion) {
          db._meta.seedVersion = seedVersion;
          db._meta.version     = DB_DEFAULT._meta.version;
          patched = true;
        }

        if (patched) save();
        console.info('[Store] Base chargée depuis localStorage');
      } catch (e) {
        console.warn('[Store] Données corrompues, réinitialisation');
        db = null;
      }
    }

    // Aucune donnée → on charge le seed
    if (!db) {
      if (typeof SEED !== 'undefined') {
        db = Object.assign({}, DB_DEFAULT, SEED);
        save(); // Persister immédiatement
        console.info('[Store] Base initialisée depuis le seed');
      } else {
        db = Object.assign({}, DB_DEFAULT);
        console.warn('[Store] Seed non trouvé, base vide');
      }
    }
  }

  /* ---------- SAUVEGARDE ---------- */

  /**
   * Persiste la base dans localStorage.
   * Appelé automatiquement après chaque mutation CRUD.
   */
  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(db));
    } catch (e) {
      console.error('[Store] Erreur de sauvegarde :', e);
    }
  }

  /* ---------- ACCESSEURS ---------- */

  /** Retourne la base complète (lecture seule conseillée) */
  function getDB() {
    if (!db) load();
    return db;
  }

  /**
   * Retourne tous les enregistrements d'une collection.
   * @param {string} collection  - ex: 'produits', 'contacts'
   */
  function getAll(collection) {
    if (!db) load();
    return db[collection] || [];
  }

  /**
   * Retourne un enregistrement par son id.
   * @param {string} collection
   * @param {string} id
   */
  function getById(collection, id) {
    return getAll(collection).find(item => item.id === id) || null;
  }

  /* ---------- MUTATIONS ---------- */

  /**
   * Ajoute un enregistrement dans une collection.
   * Génère un id si absent.
   * @param {string} collection
   * @param {object} record
   * @returns {object} L'enregistrement créé
   */
  function create(collection, record) {
    if (!db) load();
    if (!db[collection]) db[collection] = [];

    // Génération d'id si absent
    if (!record.id) {
      record.id = collection + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    }

    record._createdAt = new Date().toISOString();
    record._updatedAt = new Date().toISOString();

    db[collection].push(record);
    save();
    return record;
  }

  /**
   * Met à jour un enregistrement existant (fusion partielle).
   * @param {string} collection
   * @param {string} id
   * @param {object} updates - Champs à modifier
   * @returns {object|null} L'enregistrement mis à jour, ou null
   */
  function update(collection, id, updates) {
    if (!db) load();
    const idx = (db[collection] || []).findIndex(item => item.id === id);
    if (idx === -1) return null;

    db[collection][idx] = Object.assign({}, db[collection][idx], updates, {
      _updatedAt: new Date().toISOString()
    });
    save();
    return db[collection][idx];
  }

  /**
   * Supprime un enregistrement.
   * @param {string} collection
   * @param {string} id
   * @returns {boolean} true si supprimé
   */
  function remove(collection, id) {
    if (!db) load();
    if (!db[collection]) return false;
    const len = db[collection].length;
    db[collection] = db[collection].filter(item => item.id !== id);
    save();
    return db[collection].length < len;
  }

  /**
   * Recherche dans une collection (recherche textuelle naïve).
   * @param {string} collection
   * @param {string} query
   * @param {string[]} fields - Champs à chercher (ex: ['nom','email'])
   */
  function search(collection, query, fields = []) {
    const items = getAll(collection);
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(item =>
      fields.some(f => String(item[f] || '').toLowerCase().includes(q))
    );
  }

  /* ---------- COMPTEURS & NUMÉROTATION ---------- */

  /**
   * Incrémente et retourne le prochain numéro pour une série.
   * @param {string} serie - ex: 'devis', 'factures'
   * @returns {number}
   */
  function nextCounter(serie) {
    if (!db) load();
    if (!db._meta) db._meta = { counters: {} };
    if (!db._meta.counters) db._meta.counters = {};
    db._meta.counters[serie] = (db._meta.counters[serie] || 0) + 1;
    save();
    return db._meta.counters[serie];
  }

  /* ---------- MESSAGES (CHAT) ---------- */

  /**
   * Ajoute un message dans la collection messages.
   * @param {object} msg
   */
  function addMessage(msg) {
    return create('messages', msg);
  }

  /* ---------- NOTIFICATIONS SYSTÈME ---------- */

  /**
   * Crée une notification système dans db.notifications.
   * Appelé par les autres modules pour signaler un événement.
   * @param {string} text   - Texte de la notification
   * @param {string} source - Source : 'stock'|'facture'|'of'|'achat'|'autre'
   */
  function addNotification(text, source) {
    if (!db) load();
    if (!db.notifications) db.notifications = [];

    /* Éviter les doublons récents (même texte dans les 5 min) */
    const fiveMin = Date.now() - 5 * 60 * 1000;
    const exists  = db.notifications.some(n =>
      n.text === text && new Date(n.date).getTime() > fiveMin
    );
    if (exists) return null;

    const notif = {
      id:     'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      text,
      source: source || 'autre',
      date:   new Date().toISOString(),
      read:   false
    };
    db.notifications.unshift(notif);

    /* Garder au maximum 50 notifications */
    if (db.notifications.length > 50) db.notifications = db.notifications.slice(0, 50);
    save();

    /* Mettre à jour le badge de la topbar si Discuss est chargé */
    if (typeof Discuss !== 'undefined' && typeof Discuss.updateBadge === 'function') {
      Discuss.updateBadge();
    }
    return notif;
  }

  /* ---------- JOURNAL D'AUDIT ---------- */

  /**
   * Enregistre une action dans le journal d'audit.
   * Appelé par auth.js et les modules métier.
   * @param {string} action   - Description courte de l'action (ex: 'Connexion', 'Créé facture FAC-0042')
   * @param {string} module   - Module concerné (ex: 'ventes', 'auth', 'utilisateurs')
   * @param {object} details  - Données additionnelles (optionnel)
   */
  function addAuditLog(action, module, details) {
    if (!db) load();
    if (!db.auditLog) db.auditLog = [];

    /* Récupérer l'utilisateur courant depuis la session */
    let utilisateur = 'system';
    try {
      const raw = localStorage.getItem('hcs_erp_session');
      if (raw) {
        const s = JSON.parse(raw);
        utilisateur = s.prenom && s.nom ? s.prenom + ' ' + s.nom : s.prenom || s.login || 'Inconnu';
      }
    } catch {}

    const entry = {
      id:          'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      date:        new Date().toISOString(),
      utilisateur,
      action:      action || '',
      module:      module || 'système',
      details:     details || null
    };

    db.auditLog.unshift(entry);

    /* Limiter à 500 entrées */
    if (db.auditLog.length > 500) db.auditLog = db.auditLog.slice(0, 500);
    save();
    return entry;
  }

  /**
   * Marque toutes les notifications comme lues.
   */
  function markNotificationsRead() {
    if (!db) load();
    if (!db.notifications) return;
    db.notifications.forEach(n => { n.read = true; });
    save();
  }

  /**
   * Retourne le nombre de notifications non lues.
   * @returns {number}
   */
  function getUnreadNotifCount() {
    if (!db) load();
    return (db.notifications || []).filter(n => !n.read).length;
  }

  /* ---------- IMPORT / EXPORT ---------- */

  /**
   * Exporte la base complète en JSON téléchargeable.
   */
  function exportJSON() {
    if (!db) load();
    const json = JSON.stringify(db, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `hcs-erp-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.info('[Store] Export JSON effectué');
  }

  /**
   * Importe une base depuis un fichier JSON.
   * @param {File} file
   */
  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          // Validation minimale
          if (!imported.produits || !imported.contacts) {
            throw new Error('Fichier invalide : collections requises manquantes');
          }
          db = imported;
          save();
          resolve(db);
          console.info('[Store] Import JSON réussi');
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /**
   * Réinitialise la base (supprime le localStorage et recharge le seed).
   */
  function reset() {
    localStorage.removeItem(LS_KEY);
    db = null;
    load();
    console.info('[Store] Base réinitialisée');
  }

  /* ---------- API PUBLIQUE ---------- */
  return {
    load,
    save,
    getDB,
    getAll,
    getById,
    create,
    update,
    remove,
    search,
    nextCounter,
    addMessage,
    addNotification,
    markNotificationsRead,
    getUnreadNotifCount,
    addAuditLog,
    exportJSON,
    importJSON,
    reset
  };
})();

/* Initialiser la base au chargement du script */
Store.load();
