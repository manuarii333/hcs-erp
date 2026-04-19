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
  clients:           [],   // Fiches clients entreprises / organisations
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

    /* Sync MySQL asynchrone (fire-and-forget) */
    _syncMySQLCreate(collection, record);

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

    /* Sync MySQL asynchrone (fire-and-forget) */
    _syncMySQLUpdate(collection, id, updates);

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

    /* Sync MySQL avant la suppression (on a encore le record) */
    _syncMySQLDelete(collection, id);

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

  /* ================================================================
     SYNC MYSQL — miroir asynchrone vers l'API PHP
     Fire-and-forget : ne bloque jamais les opérations locales.
     ================================================================ */

  /* Tables du Store qui ont une contrepartie MySQL */
  const MYSQL_TABLES = new Set([
    'contacts', 'produits', 'fournisseurs', 'devis', 'commandes',
    'factures', 'employes', 'conges', 'commandes_atelier', 'planning_atelier',
    'taches_agents'
  ]);

  /**
   * Envoie une création vers MySQL.
   * Stocke l'ID MySQL retourné dans le record Store (_mysql_id).
   */
  async function _syncMySQLCreate(collection, record) {
    if (!window.MYSQL || !MYSQL_TABLES.has(collection)) return;
    try {
      const payload = _buildMySQLPayload(record);
      const created = await window.MYSQL.create(collection, payload);
      if (created && created.id) {
        /* Stocker l'ID MySQL sans déclencher une nouvelle sync */
        const idx = (db[collection] || []).findIndex(r => r.id === record.id);
        if (idx !== -1) {
          db[collection][idx]._mysql_id = created.id;
          try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (_) {}
        }
      }
    } catch (e) {
      console.warn(`[Store] MySQL create ${collection} échoué:`, e.message);
    }
  }

  /**
   * Envoie une mise à jour vers MySQL.
   * Utilise _mysql_id si disponible, sinon ignore.
   */
  async function _syncMySQLUpdate(collection, storeId, updates) {
    if (!window.MYSQL || !MYSQL_TABLES.has(collection)) return;
    try {
      const record = (db[collection] || []).find(r => r.id === storeId);
      if (!record || !record._mysql_id) return;
      const payload = _buildMySQLPayload(updates);
      await window.MYSQL.update(collection, record._mysql_id, payload);
    } catch (e) {
      console.warn(`[Store] MySQL update ${collection} échoué:`, e.message);
    }
  }

  /**
   * Envoie une suppression vers MySQL.
   */
  async function _syncMySQLDelete(collection, storeId) {
    if (!window.MYSQL || !MYSQL_TABLES.has(collection)) return;
    try {
      const record = (db[collection] || []).find(r => r.id === storeId);
      if (!record || !record._mysql_id) return;
      await window.MYSQL.delete(collection, record._mysql_id);
    } catch (e) {
      console.warn(`[Store] MySQL delete ${collection} échoué:`, e.message);
    }
  }

  /**
   * Prépare les données pour MySQL.
   * - Exclut les champs internes (_createdAt, _updatedAt, _mysql_id)
   * - Mappe 'id' → 'store_id' (colonne de liaison dans MySQL)
   * - Arrays/objects laissés tels quels (base.php les JSON-encode)
   */
  function _buildMySQLPayload(record) {
    const exclude = new Set(['_createdAt', '_updatedAt', '_mysql_id']);
    const payload = {};
    for (const [k, v] of Object.entries(record || {})) {
      if (exclude.has(k)) continue;
      payload[k === 'id' ? 'store_id' : k] = v;
    }
    return payload;
  }

  /**
   * Convertit une ligne MySQL en record Store local.
   * Utilise store_id comme id local si disponible.
   * Parse automatiquement les champs JSON (lignes, paiements, variantes…).
   * @private
   */
  /* snake_case → camelCase (client_nom → clientNom, total_ht → totalHT) */
  function _snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
              .replace(/_([A-Z]+)/g, (_, g) => g);
  }

  function _mysqlRowToLocal(collection, row) {
    const record = {
      id:         row.store_id || (collection + '-mysql-' + row.id + '-' + Math.random().toString(36).substr(2, 5)),
      _mysql_id:  row.id,
      _createdAt: row.created_at || new Date().toISOString(),
      _updatedAt: row.updated_at || new Date().toISOString()
    };
    for (const [k, v] of Object.entries(row)) {
      if (['id', 'store_id', 'created_at', 'updated_at'].includes(k)) continue;
      const camelKey = _snakeToCamel(k);
      if (typeof v === 'string' && v.length > 1 && (v[0] === '[' || v[0] === '{')) {
        try { record[camelKey] = JSON.parse(v); } catch { record[camelKey] = v; }
      } else {
        record[camelKey] = v;
      }
    }
    return record;
  }

  /**
   * MySQL → localStorage : importe les records MySQL absents en local.
   * Identifie les doublons via store_id (fiable) OU _mysql_id (fallback).
   * Recale les compteurs de numérotation.
   *
   * @param {string[]} [collections]
   * @returns {Promise<{synced: number, errors: string[]}>}
   */
  async function syncFromMySQL(collections) {
    if (!window.MYSQL) return { synced: 0, errors: ['MySQL non disponible'] };
    if (!db) load();

    const SYNC_COLS = collections || ['devis', 'factures', 'commandes', 'contacts', 'produits', 'fournisseurs'];
    const COUNTER_MAP = { devis: 'devis', factures: 'factures', commandes: 'commandes' };
    let synced = 0;
    const errors = [];

    for (const col of SYNC_COLS) {
      try {
        const rows = await window.MYSQL.getAll(col, { limit: 2000 });
        if (!Array.isArray(rows) || !rows.length) continue;

        /* Double index : par _mysql_id et par store_id (= id local) */
        const byMysqlId = new Map();
        const byStoreId = new Map();
        (db[col] || []).forEach(r => {
          if (r._mysql_id) byMysqlId.set(String(r._mysql_id), r);
          if (r.id)        byStoreId.set(r.id, r);
        });

        for (const row of rows) {
          const alreadyLinked  = byMysqlId.has(String(row.id));
          const alreadyByStore = row.store_id && byStoreId.has(row.store_id);
          if (alreadyLinked || alreadyByStore) {
            /* Mettre à jour _mysql_id si le record local l'avait perdu */
            if (alreadyByStore && !alreadyLinked) {
              const local = byStoreId.get(row.store_id);
              local._mysql_id = row.id;
            }
            continue;
          }

          const record = _mysqlRowToLocal(col, row);
          if (!db[col]) db[col] = [];
          db[col].push(record);
          synced++;

          /* Recaler le compteur si on détecte un numéro de référence plus élevé */
          const cKey = COUNTER_MAP[col];
          if (cKey && record.ref) {
            const m = String(record.ref).match(/(\d+)$/);
            if (m) {
              const n = parseInt(m[1], 10);
              if (!db._meta.counters) db._meta.counters = {};
              if (n > (db._meta.counters[cKey] || 0)) db._meta.counters[cKey] = n;
            }
          }
        }
      } catch (e) {
        errors.push(`${col}: ${e.message}`);
        console.warn(`[Store] syncFromMySQL ${col} échoué:`, e.message);
      }
    }

    if (synced > 0) {
      save();
      console.info(`[Store] syncFromMySQL: ${synced} enregistrement(s) restauré(s) depuis MySQL`);
    }
    return { synced, errors };
  }

  /**
   * localStorage → MySQL : envoie les records locaux sans _mysql_id.
   * Corrige les records créés quand MySQL était hors-ligne.
   *
   * @param {string[]} [collections]
   * @returns {Promise<{pushed: number, errors: string[]}>}
   */
  async function pushMissingToMySQL(collections) {
    if (!window.MYSQL) return { pushed: 0, errors: ['MySQL non disponible'] };
    if (!db) load();

    const PUSH_COLS = collections || ['devis', 'factures', 'commandes', 'contacts', 'produits', 'fournisseurs'];
    let pushed = 0;
    const errors = [];

    for (const col of PUSH_COLS) {
      /* Ignorer les records du seed (IDs statiques type prod-001, cont-001) */
      const isSeedId = r => /^[a-z]+-\d{3,4}$/.test(r.id);
      const orphans = (db[col] || []).filter(r => !r._mysql_id && !isSeedId(r));
      for (const record of orphans) {
        try {
          const payload = _buildMySQLPayload(record);
          const created = await window.MYSQL.create(col, payload);
          if (created && created.id) {
            const idx = db[col].findIndex(r => r.id === record.id);
            if (idx !== -1) db[col][idx]._mysql_id = created.id;
            pushed++;
          }
        } catch (e) {
          errors.push(`${col}/${record.id}: ${e.message}`);
          console.warn(`[Store] pushMissingToMySQL ${col} échoué:`, e.message);
        }
      }
    }

    if (pushed > 0) {
      save();
      console.info(`[Store] pushMissingToMySQL: ${pushed} enregistrement(s) envoyé(s) vers MySQL`);
    }
    return { pushed, errors };
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
    reset,
    syncFromMySQL,
    pushMissingToMySQL
  };
})();

/* Initialiser la base au chargement du script */
Store.load();

/* Sync bidirectionnelle au démarrage :
   1. MySQL → local : récupère les records absents (restauration après perte localStorage)
   2. Local → MySQL : pousse les records sans _mysql_id (créés hors-ligne)
*/
(async () => {
  /* Attendre que mysql-api.js soit chargé (window.MYSQL dispo) */
  await new Promise(r => setTimeout(r, 300));

  const [fromMySQL, toMySQL] = await Promise.all([
    Store.syncFromMySQL(),
    Store.pushMissingToMySQL()
  ]);

  const total = fromMySQL.synced + toMySQL.pushed;
  if (total > 0) {
    console.info(`[Store] Sync démarrage : ↓${fromMySQL.synced} restauré(s), ↑${toMySQL.pushed} envoyé(s)`);
    /* Rafraîchir l'affichage si l'app est montée */
    if (typeof App !== 'undefined' && typeof App.refresh === 'function') App.refresh();
  }
})();
