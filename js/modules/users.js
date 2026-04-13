/* ================================================================
   HCS ERP — modules/users.js  v2.0
   Module "Paramètres > Utilisateurs & Accès"
   Interface inspirée d'Odoo (Settings > Users), QuickBooks (Users),
   et Salesforce (User Management).

   Vues :
     • utilisateurs  — liste + création / édition
     • audit-log     — journal d'audit complet
     • mon-profil    — profil de l'utilisateur connecté
   ================================================================ */

'use strict';

const Users = (() => {

  /* ----------------------------------------------------------------
     POINT D'ENTRÉE appelé par app.js
     ---------------------------------------------------------------- */
  function init(toolbar, area, viewId) {
    injectUsersCSS();
    switch (viewId) {
      case 'utilisateurs': renderListeUtilisateurs(toolbar, area); break;
      case 'audit-log':    renderAuditLog(toolbar, area);          break;
      case 'mon-profil':   renderMonProfil(toolbar, area);         break;
      case 'boutique':     renderBoutiqueConfig(toolbar, area);    break;
      default: renderListeUtilisateurs(toolbar, area);
    }
  }

  /* ================================================================
     VUE 1 — LISTE DES UTILISATEURS
     ================================================================ */
  function renderListeUtilisateurs(toolbar, area) {
    const session  = Auth.getSession();
    const canCreate = Auth.peutGererUtilisateurs();

    /* --- Toolbar --- */
    toolbar.innerHTML = `
      ${canCreate ? `<button class="btn btn-primary btn-sm" onclick="Users._openCreateModal()">
        + Nouvel utilisateur
      </button>` : ''}
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
        <select id="users-filter-role" class="form-control" style="width:160px;height:32px;font-size:13px;"
          onchange="Users._refreshTable()">
          <option value="">Tous les rôles</option>
          ${Object.entries(ROLES).map(([k,v]) =>
            `<option value="${k}">${v.icon} ${v.label}</option>`
          ).join('')}
        </select>
        <input type="text" id="users-search" class="form-control"
          placeholder="🔍 Rechercher…" style="width:200px;height:32px;font-size:13px;"
          oninput="Users._refreshTable()" />
      </div>
    `;

    /* --- Layout principal --- */
    area.innerHTML = `
      <div style="padding:24px;">
        <!-- Stats -->
        <div id="users-stats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;"></div>

        <!-- Table -->
        <div class="card" style="overflow:hidden;">
          <div class="card-header" style="border-bottom:1px solid var(--border);padding:14px 20px;">
            <div class="card-title">Comptes utilisateurs</div>
            <div id="users-count" style="font-size:12px;color:var(--text-muted);"></div>
          </div>
          <div id="users-table-wrap" style="overflow-x:auto;"></div>
        </div>
      </div>
    `;

    _refreshStats();
    _refreshTable();
  }

  /* --- Stats cards --- */
  function _refreshStats() {
    const users = Store.getAll('utilisateurs');
    const el = document.getElementById('users-stats');
    if (!el) return;

    const total     = users.length;
    const actifs    = users.filter(u => u.actif !== false).length;
    const admins    = users.filter(u => ['super_admin','admin'].includes(u.role)).length;
    const inactifs  = users.filter(u => u.actif === false).length;

    el.innerHTML = [
      { icon:'👥', val: total,   label:'Utilisateurs',   color:'#6366F1' },
      { icon:'✅', val: actifs,  label:'Actifs',          color:'#16A34A' },
      { icon:'🛡️', val: admins,  label:'Administrateurs', color:'#DC2626' },
      { icon:'⛔', val: inactifs,label:'Inactifs',        color:'#8C96B0' }
    ].map(s => `
      <div class="card" style="padding:16px 20px;display:flex;align-items:center;gap:14px;">
        <div style="font-size:28px;line-height:1;">${s.icon}</div>
        <div>
          <div style="font-size:24px;font-weight:700;color:${s.color};font-family:var(--font-mono);">${s.val}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${s.label}</div>
        </div>
      </div>
    `).join('');
  }

  /* --- Table des utilisateurs --- */
  function _refreshTable() {
    const wrap     = document.getElementById('users-table-wrap');
    const countEl  = document.getElementById('users-count');
    if (!wrap) return;

    const query   = (document.getElementById('users-search')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('users-filter-role')?.value || '';
    const session = Auth.getSession();

    let users = Store.getAll('utilisateurs');

    /* Filtres */
    if (roleFilter) users = users.filter(u => u.role === roleFilter);
    if (query) {
      users = users.filter(u =>
        (u.prenom + ' ' + u.nom + ' ' + u.login + ' ' + u.email)
          .toLowerCase().includes(query)
      );
    }

    if (countEl) countEl.textContent = users.length + ' utilisateur' + (users.length > 1 ? 's' : '');

    if (!users.length) {
      wrap.innerHTML = `
        <div class="table-empty" style="padding:48px;">
          <div style="font-size:40px;margin-bottom:12px;">👥</div>
          <p>Aucun utilisateur trouvé</p>
        </div>`;
      return;
    }

    const canManage = Auth.peutGererUtilisateurs();

    wrap.innerHTML = `
      <table class="data-table" style="width:100%;">
        <thead>
          <tr>
            <th style="width:52px;"></th>
            <th>Utilisateur</th>
            <th>Login</th>
            <th>Rôle</th>
            <th>Modules accessibles</th>
            <th>Statut</th>
            <th>Dernière connexion</th>
            ${canManage ? '<th style="width:120px;">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody>
          ${users.map(u => _renderUserRow(u, session, canManage)).join('')}
        </tbody>
      </table>
    `;
  }

  /* --- Ligne de la table --- */
  function _renderUserRow(u, session, canManage) {
    const role       = ROLES[u.role] || { label: u.role, color: '#8C96B0', icon: '?' };
    const isMe       = session && session.id === u.id;
    const actif      = u.actif !== false;
    const modules    = role.modules === '*' ? 'Tous' : (role.modules || []).length + ' modules';
    const lastLogin  = u.derniereConnexion
      ? _fmtDateRelative(u.derniereConnexion) : 'Jamais';
    const avatar     = u.avatar || _initiales(u.prenom, u.nom);
    const couleur    = u.couleurAvatar || _couleurAvatar(u.login);

    return `
      <tr style="opacity:${actif ? '1' : '0.55'};"
          onclick="Users._openEditModal('${u.id}')"
          style="cursor:pointer;opacity:${actif ? '1' : '0.55'};">
        <td onclick="event.stopPropagation();">
          <div class="user-avatar-sm" style="background:${couleur};">${escapeHtml(avatar)}</div>
        </td>
        <td>
          <div style="font-weight:600;color:var(--text-primary);">
            ${escapeHtml(u.prenom)} ${escapeHtml(u.nom || '')}
            ${isMe ? '<span class="badge" style="background:#EEF2FF;color:#6366F1;margin-left:6px;font-size:10px;">Moi</span>' : ''}
          </div>
          <div style="font-size:11px;color:var(--text-muted);">${escapeHtml(u.email || '')}</div>
        </td>
        <td>
          <code style="font-size:12px;color:var(--text-secondary);">${escapeHtml(u.login)}</code>
        </td>
        <td>
          <span class="badge" style="background:${role.color}20;color:${role.color};border:1px solid ${role.color}40;">
            ${role.icon} ${role.label}
          </span>
        </td>
        <td>
          <span style="font-size:12px;color:var(--text-secondary);">
            ${modules}
          </span>
        </td>
        <td>
          <span class="badge ${actif ? 'badge-confirme' : 'badge-annule'}">
            ${actif ? '● Actif' : '○ Inactif'}
          </span>
        </td>
        <td style="font-size:12px;color:var(--text-muted);">${lastLogin}</td>
        ${canManage ? `
          <td onclick="event.stopPropagation();" style="white-space:nowrap;">
            <button class="btn btn-ghost btn-sm" title="Modifier"
              onclick="Users._openEditModal('${u.id}')">✏️</button>
            ${!isMe ? `
              <button class="btn btn-ghost btn-sm" title="${actif ? 'Désactiver' : 'Activer'}"
                onclick="Users._toggleActif('${u.id}', ${actif})">
                ${actif ? '⛔' : '✅'}
              </button>
            ` : ''}
          </td>
        ` : ''}
      </tr>
    `;
  }

  /* ================================================================
     MODAL — CRÉER UN UTILISATEUR
     ================================================================ */
  function _openCreateModal() {
    _openUserModal(null);
  }

  /* ================================================================
     MODAL — MODIFIER UN UTILISATEUR
     ================================================================ */
  function _openEditModal(userId) {
    if (!Auth.peutGererUtilisateurs()) return;
    const user = Store.getById('utilisateurs', userId);
    if (!user) return;
    _openUserModal(user);
  }

  /* ================================================================
     MODAL COMMUNE — CRÉER / MODIFIER
     ================================================================ */
  function _openUserModal(user) {
    const isEdit    = !!user;
    const session   = Auth.getSession();
    const isSuperAdmin = Auth.hasRole('super_admin');

    /* Rôles disponibles selon le rôle de l'admin courant */
    const rolesDisponibles = Object.entries(ROLES).filter(([k]) =>
      k !== 'super_admin' || isSuperAdmin
    );

    const roleSelectionne = user?.role || 'vendeur';

    openModal(`
      <div class="modal-header" style="margin-bottom:0;">
        <div class="modal-title">${isEdit ? '✏️ Modifier l\'utilisateur' : '➕ Nouvel utilisateur'}</div>
        ${isEdit ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">ID : ${user.id}</div>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px;">

        <!-- Colonne gauche : informations personnelles -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
                      letter-spacing:.08em;margin-bottom:12px;">Informations personnelles</div>

          <!-- Avatar preview -->
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;
                      padding:14px;background:var(--bg-base);border-radius:var(--radius-lg);">
            <div id="modal-avatar-preview" class="user-avatar-lg"
              style="background:${user?.couleurAvatar || '#6366F1'};">
              ${escapeHtml(user?.avatar || '??')}
            </div>
            <div>
              <div id="modal-avatar-name" style="font-weight:600;font-size:15px;">
                ${user ? escapeHtml(user.prenom + ' ' + (user.nom||'')) : 'Nouvel utilisateur'}
              </div>
              <div id="modal-avatar-role" style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                ${ROLES[roleSelectionne]?.label || ''}
              </div>
            </div>
          </div>

          <div class="form-grid" style="gap:12px;">
            <div class="form-group">
              <label class="form-label">Prénom <span style="color:var(--accent-red);">*</span></label>
              <input type="text" id="usr-prenom" class="form-control"
                value="${escapeHtml(user?.prenom || '')}"
                oninput="Users._updateAvatarPreview()"
                placeholder="Prénom" required />
            </div>
            <div class="form-group">
              <label class="form-label">Nom</label>
              <input type="text" id="usr-nom" class="form-control"
                value="${escapeHtml(user?.nom || '')}"
                oninput="Users._updateAvatarPreview()"
                placeholder="Nom de famille" />
            </div>
            <div class="form-group">
              <label class="form-label">Login <span style="color:var(--accent-red);">*</span></label>
              <input type="text" id="usr-login" class="form-control"
                value="${escapeHtml(user?.login || '')}"
                placeholder="identifiant de connexion"
                ${isEdit ? 'readonly style="background:var(--bg-base);cursor:not-allowed;"' : ''}
                required />
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="usr-email" class="form-control"
                value="${escapeHtml(user?.email || '')}"
                placeholder="prenom@hcs.pf" />
            </div>
            <div class="form-group" style="grid-column:1/-1;">
              <label class="form-label">Téléphone</label>
              <input type="text" id="usr-tel" class="form-control"
                value="${escapeHtml(user?.telephone || '')}"
                placeholder="+689 87 XX XX XX" />
            </div>
          </div>

          <!-- Mot de passe -->
          <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
            ${isEdit ? `
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:10px;">
                <input type="checkbox" id="chg-mdp-toggle" onchange="Users._toggleMdpSection()"
                  style="width:16px;height:16px;accent-color:var(--accent-blue);" />
                <span style="font-size:13px;font-weight:500;">Changer le mot de passe</span>
              </label>
              <div id="mdp-section" style="display:none;">
            ` : `
              <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
                          letter-spacing:.08em;margin-bottom:10px;">Mot de passe</div>
              <div id="mdp-section">
            `}
              <div class="form-group" style="margin-bottom:10px;">
                <label class="form-label">${isEdit ? 'Nouveau mot de passe' : 'Mot de passe'} <span style="color:var(--accent-red);">${isEdit ? '' : '*'}</span></label>
                <input type="password" id="usr-mdp" class="form-control"
                  placeholder="••••••••" ${!isEdit ? 'required' : ''} />
              </div>
              <div class="form-group">
                <label class="form-label">Confirmer le mot de passe</label>
                <input type="password" id="usr-mdp2" class="form-control"
                  placeholder="••••••••" />
              </div>
            </div>
          </div>
        </div>

        <!-- Colonne droite : rôle + accès + statut -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
                      letter-spacing:.08em;margin-bottom:12px;">Rôle & Accès</div>

          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Rôle <span style="color:var(--accent-red);">*</span></label>
            <select id="usr-role" class="form-control" onchange="Users._updateRolePreview()">
              ${rolesDisponibles.map(([k, v]) => `
                <option value="${k}" ${roleSelectionne === k ? 'selected' : ''}>
                  ${v.icon} ${v.label}
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Description du rôle -->
          <div id="role-description" style="padding:10px 14px;background:var(--bg-base);
               border-radius:var(--radius-md);font-size:12px;color:var(--text-secondary);
               margin-bottom:16px;line-height:1.5;">
            ${ROLES[roleSelectionne]?.description || ''}
          </div>

          <!-- Preview modules accessibles -->
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
                      letter-spacing:.08em;margin-bottom:8px;">Modules accessibles</div>
          <div id="role-modules-preview" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
            ${_renderModuleBadges(roleSelectionne)}
          </div>

          <!-- Preview permissions -->
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
                      letter-spacing:.08em;margin-bottom:8px;">Permissions d'action</div>
          <div id="role-perms-preview">
            ${_renderPermsBadges(roleSelectionne)}
          </div>

          <!-- Statut actif/inactif -->
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
            <label style="display:flex;align-items:center;justify-content:space-between;
                          cursor:pointer;padding:10px 14px;background:var(--bg-base);
                          border-radius:var(--radius-md);">
              <div>
                <div style="font-weight:600;font-size:13px;">Compte actif</div>
                <div style="font-size:11px;color:var(--text-muted);">
                  Un compte inactif ne peut pas se connecter
                </div>
              </div>
              <input type="checkbox" id="usr-actif" role="switch"
                ${(user?.actif !== false) ? 'checked' : ''}
                style="width:20px;height:20px;accent-color:var(--accent-blue);cursor:pointer;" />
            </label>
          </div>
        </div>
      </div>

      <!-- Erreur -->
      <div id="usr-error" style="display:none;margin-top:12px;padding:10px 14px;
           background:#FEF2F2;border:1px solid #FECACA;border-radius:var(--radius-md);
           color:#B91C1C;font-size:13px;"></div>

      <!-- Actions -->
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;
                  padding-top:16px;border-top:1px solid var(--border);">
        ${isEdit && !['usr-001'].includes(user?.id) ? `
          <button class="btn btn-ghost btn-sm" style="color:var(--accent-red);margin-right:auto;"
            onclick="Users._confirmDelete('${user.id}')">
            🗑️ Supprimer
          </button>
        ` : ''}
        <button class="btn btn-ghost btn-sm" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary btn-sm"
          onclick="Users._saveUser(${isEdit ? `'${user.id}'` : 'null'})">
          ${isEdit ? '💾 Sauvegarder' : '✅ Créer l\'utilisateur'}
        </button>
      </div>
    `, 'lg');
  }

  /* --- Preview en temps réel de l'avatar --- */
  function _updateAvatarPreview() {
    const prenom = document.getElementById('usr-prenom')?.value || '';
    const nom    = document.getElementById('usr-nom')?.value || '';
    const avEl   = document.getElementById('modal-avatar-preview');
    const nmEl   = document.getElementById('modal-avatar-name');
    if (avEl) avEl.textContent = _initiales(prenom, nom) || '??';
    if (nmEl) nmEl.textContent = (prenom + ' ' + nom).trim() || 'Nouvel utilisateur';
  }

  /* --- Preview du rôle sélectionné --- */
  function _updateRolePreview() {
    const sel  = document.getElementById('usr-role')?.value || 'vendeur';
    const desc = document.getElementById('role-description');
    const mods = document.getElementById('role-modules-preview');
    const perm = document.getElementById('role-perms-preview');
    const roleEl = document.getElementById('modal-avatar-role');
    if (desc)   desc.textContent  = ROLES[sel]?.description || '';
    if (mods)   mods.innerHTML    = _renderModuleBadges(sel);
    if (perm)   perm.innerHTML    = _renderPermsBadges(sel);
    if (roleEl) roleEl.textContent = ROLES[sel]?.label || '';
  }

  /* --- Afficher/masquer le champ mot de passe (édition) --- */
  function _toggleMdpSection() {
    const chk  = document.getElementById('chg-mdp-toggle');
    const sec  = document.getElementById('mdp-section');
    if (sec) sec.style.display = chk?.checked ? 'block' : 'none';
  }

  /* --- HTML des badges de modules pour un rôle --- */
  function _renderModuleBadges(roleKey) {
    const role = ROLES[roleKey];
    if (!role) return '';

    /* Labels lisibles des modules */
    const MODULE_LABELS = {
      dashboard: '📊 Accueil', crm: '🎯 CRM', ventes: '🛒 Ventes',
      achats: '🏪 Achats', stock: '📦 Stock', production: '⚙️ Production',
      comptabilite: '💰 Comptabilité', rh: '👤 RH', messagerie: '💬 Discussion',
      caisse: '🛒 Caisse', outils: '🔧 Outils', parametres: '⚙️ Paramètres'
    };

    if (role.modules === '*') {
      return `<span class="badge" style="background:#DC262620;color:#DC2626;border:1px solid #DC262640;">
        ★ Tous les modules
      </span>`;
    }
    return (role.modules || []).map(m =>
      `<span class="badge badge-gray" style="font-size:11px;">
        ${MODULE_LABELS[m] || m}
      </span>`
    ).join('');
  }

  /* --- HTML des badges de permissions --- */
  function _renderPermsBadges(roleKey) {
    const perms = ACTION_PERMISSIONS[roleKey];
    if (!perms) return '';
    const items = [
      { key:'lire',      icon:'👁️', label:'Lire'      },
      { key:'creer',     icon:'➕', label:'Créer'     },
      { key:'modifier',  icon:'✏️', label:'Modifier'  },
      { key:'supprimer', icon:'🗑️', label:'Supprimer' },
      { key:'exporter',  icon:'📥', label:'Exporter'  }
    ];
    return `<div style="display:flex;flex-wrap:wrap;gap:6px;">` +
      items.map(i => `
        <span class="badge" style="
          background:${perms[i.key] ? '#D1FAE520' : '#FEF2F220'};
          color:${perms[i.key] ? '#065F46' : '#9CA3AF'};
          border:1px solid ${perms[i.key] ? '#A7F3D040' : '#E5E7EB'};
          font-size:11px;">
          ${i.icon} ${i.label}${perms[i.key] ? '' : ' ✕'}
        </span>
      `).join('') + `</div>`;
  }

  /* ================================================================
     SAUVEGARDE (création + édition)
     ================================================================ */
  function _saveUser(userId) {
    const isEdit = !!userId;
    const errEl  = document.getElementById('usr-error');

    /* Collecte des champs */
    const prenom  = document.getElementById('usr-prenom')?.value.trim() || '';
    const nom     = document.getElementById('usr-nom')?.value.trim() || '';
    const login   = document.getElementById('usr-login')?.value.trim() || '';
    const email   = document.getElementById('usr-email')?.value.trim() || '';
    const tel     = document.getElementById('usr-tel')?.value.trim() || '';
    const role    = document.getElementById('usr-role')?.value || 'vendeur';
    const actif   = document.getElementById('usr-actif')?.checked ?? true;
    const chgMdp  = !isEdit || document.getElementById('chg-mdp-toggle')?.checked;
    const mdp     = document.getElementById('usr-mdp')?.value || '';
    const mdp2    = document.getElementById('usr-mdp2')?.value || '';

    const showError = (msg) => {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    };

    /* Validations */
    if (!prenom) return showError('Le prénom est obligatoire.');
    if (!login)  return showError('L\'identifiant est obligatoire.');
    if (!isEdit && !mdp) return showError('Le mot de passe est obligatoire pour un nouveau compte.');
    if (chgMdp && mdp && mdp !== mdp2) return showError('Les mots de passe ne correspondent pas.');
    if (chgMdp && mdp && mdp.length < 6) return showError('Le mot de passe doit faire au moins 6 caractères.');

    /* Unicité du login */
    const existing = Store.getAll('utilisateurs').find(u => u.login === login && u.id !== userId);
    if (existing) return showError(`L'identifiant "${login}" est déjà utilisé.`);

    /* Construction de l'objet */
    const avatar  = _initiales(prenom, nom);
    const couleur = _couleurAvatar(login);

    if (isEdit) {
      /* Mise à jour */
      const updates = { prenom, nom, email, telephone: tel, role, actif, avatar };
      if (chgMdp && mdp) {
        updates.mdpHash = _hashMdp(mdp);
      }
      Store.update('utilisateurs', userId, updates);
      Store.addAuditLog(`Modifié utilisateur ${login}`, 'utilisateurs', { userId, role });
      if (typeof toast === 'function') toast('Utilisateur mis à jour.', 'success');
    } else {
      /* Création */
      Store.create('utilisateurs', {
        login, prenom, nom, email, telephone: tel,
        role, actif,
        avatar, couleurAvatar: couleur,
        mdpHash: _hashMdp(mdp),
        dateCreation: new Date().toISOString(),
        derniereConnexion: null,
        creePar: Auth.getSession()?.id || 'system'
      });
      Store.addAuditLog(`Créé utilisateur ${login}`, 'utilisateurs', { login, role });
      if (typeof toast === 'function') toast('Utilisateur créé avec succès.', 'success');
    }

    closeModal();
    _refreshStats();
    _refreshTable();
  }

  /* ================================================================
     ACTIVER / DÉSACTIVER
     ================================================================ */
  function _toggleActif(userId, estActif) {
    const user = Store.getById('utilisateurs', userId);
    if (!user) return;

    const nouvelEtat = !estActif;
    Store.update('utilisateurs', userId, { actif: nouvelEtat });
    Store.addAuditLog(
      `${nouvelEtat ? 'Activé' : 'Désactivé'} utilisateur ${user.login}`,
      'utilisateurs', { userId }
    );

    if (typeof toast === 'function') {
      toast(`Utilisateur ${nouvelEtat ? 'activé' : 'désactivé'}.`,
            nouvelEtat ? 'success' : 'warning');
    }
    _refreshStats();
    _refreshTable();
  }

  /* ================================================================
     SUPPRIMER
     ================================================================ */
  function _confirmDelete(userId) {
    const user = Store.getById('utilisateurs', userId);
    if (!user) return;

    /* Empêcher la suppression du compte courant */
    const session = Auth.getSession();
    if (session && session.id === userId) {
      if (typeof toast === 'function') toast('Impossible de supprimer votre propre compte.', 'error');
      return;
    }

    if (!confirm(`Supprimer définitivement le compte "${user.login}" ?\nCette action est irréversible.`))
      return;

    Store.remove('utilisateurs', userId);
    Store.addAuditLog(`Supprimé utilisateur ${user.login}`, 'utilisateurs', { userId });
    if (typeof toast === 'function') toast('Utilisateur supprimé.', 'warning');

    closeModal();
    _refreshStats();
    _refreshTable();
  }

  /* ================================================================
     VUE 2 — JOURNAL D'AUDIT
     ================================================================ */
  function renderAuditLog(toolbar, area) {
    toolbar.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
        <select id="audit-user-filter" class="form-control" style="width:160px;height:32px;font-size:13px;"
          onchange="Users._refreshAudit()">
          <option value="">Tous les utilisateurs</option>
          ${Store.getAll('utilisateurs').map(u =>
            `<option value="${escapeHtml(u.prenom + ' ' + (u.nom||''))}">
              ${escapeHtml(u.prenom)} ${escapeHtml(u.nom||'')}
            </option>`
          ).join('')}
        </select>
        <select id="audit-module-filter" class="form-control" style="width:140px;height:32px;font-size:13px;"
          onchange="Users._refreshAudit()">
          <option value="">Tous les modules</option>
          <option value="auth">Authentification</option>
          <option value="ventes">Ventes</option>
          <option value="achats">Achats</option>
          <option value="stock">Stock</option>
          <option value="comptabilite">Comptabilité</option>
          <option value="utilisateurs">Utilisateurs</option>
        </select>
        <input type="text" id="audit-search" class="form-control"
          placeholder="🔍 Rechercher…" style="width:180px;height:32px;font-size:13px;"
          oninput="Users._refreshAudit()" />
      </div>
    `;

    area.innerHTML = `
      <div style="padding:24px;">
        <div class="card" style="overflow:hidden;">
          <div class="card-header" style="border-bottom:1px solid var(--border);padding:14px 20px;">
            <div class="card-title">Journal d'audit</div>
            <div style="font-size:12px;color:var(--text-muted);">
              Toutes les actions effectuées par les utilisateurs
            </div>
          </div>
          <div id="audit-table-wrap" style="overflow-x:auto;"></div>
        </div>
      </div>
    `;

    _refreshAudit();
  }

  function _refreshAudit() {
    const wrap   = document.getElementById('audit-table-wrap');
    if (!wrap) return;

    const userF  = document.getElementById('audit-user-filter')?.value || '';
    const modF   = document.getElementById('audit-module-filter')?.value || '';
    const query  = (document.getElementById('audit-search')?.value || '').toLowerCase();

    let logs = Store.getAll('auditLog');

    if (userF) logs = logs.filter(l => l.utilisateur === userF);
    if (modF)  logs = logs.filter(l => l.module === modF);
    if (query) logs = logs.filter(l =>
      (l.action + l.utilisateur + l.module).toLowerCase().includes(query)
    );

    if (!logs.length) {
      wrap.innerHTML = `
        <div class="table-empty" style="padding:48px;">
          <div style="font-size:40px;margin-bottom:12px;">📋</div>
          <p>Aucune entrée dans le journal d'audit</p>
        </div>`;
      return;
    }

    const MODULE_ICONS = {
      auth: '🔐', ventes: '🛒', achats: '🏪', stock: '📦',
      production: '⚙️', comptabilite: '💰', utilisateurs: '👥',
      système: '🔧'
    };

    wrap.innerHTML = `
      <table class="data-table" style="width:100%;">
        <thead>
          <tr>
            <th style="width:160px;">Date / Heure</th>
            <th style="width:140px;">Utilisateur</th>
            <th style="width:120px;">Module</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${logs.slice(0, 200).map(l => `
            <tr>
              <td style="font-family:var(--font-mono);font-size:12px;color:var(--text-muted);">
                ${_fmtDateTime(l.date)}
              </td>
              <td>
                <span style="font-weight:500;color:var(--text-primary);">
                  ${escapeHtml(l.utilisateur || 'system')}
                </span>
              </td>
              <td>
                <span class="badge badge-gray" style="font-size:11px;">
                  ${MODULE_ICONS[l.module] || '📌'} ${escapeHtml(l.module)}
                </span>
              </td>
              <td style="color:var(--text-secondary);">${escapeHtml(l.action)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${logs.length > 200 ? `
        <div style="padding:12px 20px;font-size:12px;color:var(--text-muted);text-align:center;
                    border-top:1px solid var(--border);">
          Affichage des 200 dernières entrées sur ${logs.length} au total.
        </div>
      ` : ''}
    `;
  }

  /* ================================================================
     VUE 3 — MON PROFIL
     ================================================================ */
  function renderMonProfil(toolbar, area) {
    const session = Auth.getSession();
    if (!session) return;
    const user = Store.getById('utilisateurs', session.id);
    if (!user) return;

    toolbar.innerHTML = '';

    const role    = ROLES[user.role] || { label: user.role, color:'#8C96B0', icon:'?' };
    const couleur = user.couleurAvatar || _couleurAvatar(user.login);

    area.innerHTML = `
      <div style="padding:24px;max-width:860px;margin:0 auto;">
        <div style="display:grid;grid-template-columns:300px 1fr;gap:20px;align-items:start;">

          <!-- Carte profil gauche -->
          <div class="card" style="padding:28px;text-align:center;">
            <div class="user-avatar-xl" style="background:${couleur};margin:0 auto 16px;">
              ${escapeHtml(user.avatar || _initiales(user.prenom, user.nom))}
            </div>
            <div style="font-size:20px;font-weight:700;margin-bottom:4px;">
              ${escapeHtml(user.prenom)} ${escapeHtml(user.nom || '')}
            </div>
            <div style="margin-bottom:16px;">
              <span class="badge" style="background:${role.color}20;color:${role.color};
                border:1px solid ${role.color}40;font-size:13px;padding:4px 12px;">
                ${role.icon} ${role.label}
              </span>
            </div>
            <div style="font-size:12px;color:var(--text-muted);line-height:1.8;text-align:left;
                        background:var(--bg-base);border-radius:var(--radius-md);padding:12px 14px;">
              <div>🔑 <code style="font-size:11px;">${escapeHtml(user.login)}</code></div>
              ${user.email ? `<div>✉️ ${escapeHtml(user.email)}</div>` : ''}
              ${user.telephone ? `<div>📱 ${escapeHtml(user.telephone)}</div>` : ''}
              <div>📅 Créé le ${_fmtDate(user.dateCreation)}</div>
              <div>🕐 Connexion : ${user.derniereConnexion ? _fmtDateRelative(user.derniereConnexion) : 'Jamais'}</div>
            </div>

            <!-- Modules accessibles -->
            <div style="margin-top:16px;text-align:left;">
              <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;
                          letter-spacing:.08em;margin-bottom:8px;">Modules accessibles</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px;">
                ${_renderModuleBadges(user.role)}
              </div>
            </div>
          </div>

          <!-- Formulaire édition droite -->
          <div style="display:flex;flex-direction:column;gap:16px;">

            <!-- Informations personnelles -->
            <div class="card" style="padding:22px;">
              <div style="font-size:14px;font-weight:700;margin-bottom:16px;
                          color:var(--text-primary);">✏️ Informations personnelles</div>
              <div class="form-grid" style="gap:12px;">
                <div class="form-group">
                  <label class="form-label">Prénom</label>
                  <input type="text" id="profil-prenom" class="form-control"
                    value="${escapeHtml(user.prenom)}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Nom</label>
                  <input type="text" id="profil-nom" class="form-control"
                    value="${escapeHtml(user.nom || '')}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Email</label>
                  <input type="email" id="profil-email" class="form-control"
                    value="${escapeHtml(user.email || '')}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Téléphone</label>
                  <input type="text" id="profil-tel" class="form-control"
                    value="${escapeHtml(user.telephone || '')}" />
                </div>
              </div>
              <div style="margin-top:14px;display:flex;justify-content:flex-end;">
                <button class="btn btn-primary btn-sm"
                  onclick="Users._saveMonProfil('${user.id}')">
                  💾 Sauvegarder
                </button>
              </div>
            </div>

            <!-- Changer le mot de passe -->
            <div class="card" style="padding:22px;">
              <div style="font-size:14px;font-weight:700;margin-bottom:16px;
                          color:var(--text-primary);">🔒 Changer le mot de passe</div>
              <div class="form-grid" style="gap:12px;">
                <div class="form-group" style="grid-column:1/-1;">
                  <label class="form-label">Mot de passe actuel</label>
                  <input type="password" id="profil-mdp-actuel" class="form-control"
                    placeholder="••••••••" />
                </div>
                <div class="form-group">
                  <label class="form-label">Nouveau mot de passe</label>
                  <input type="password" id="profil-mdp-new" class="form-control"
                    placeholder="Min. 6 caractères" />
                </div>
                <div class="form-group">
                  <label class="form-label">Confirmer</label>
                  <input type="password" id="profil-mdp-new2" class="form-control"
                    placeholder="••••••••" />
                </div>
              </div>
              <div id="profil-mdp-error" style="display:none;margin-top:8px;padding:8px 12px;
                background:#FEF2F2;border:1px solid #FECACA;border-radius:var(--radius-md);
                color:#B91C1C;font-size:13px;"></div>
              <div style="margin-top:14px;display:flex;justify-content:flex-end;">
                <button class="btn btn-secondary btn-sm"
                  onclick="Users._saveMonMdp('${user.id}')">
                  🔑 Changer le mot de passe
                </button>
              </div>
            </div>

            <!-- Permissions -->
            <div class="card" style="padding:22px;">
              <div style="font-size:14px;font-weight:700;margin-bottom:12px;
                          color:var(--text-primary);">🛡️ Mes permissions</div>
              ${_renderPermsBadges(user.role)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* --- Sauvegarder les infos personnelles du profil --- */
  function _saveMonProfil(userId) {
    const prenom = document.getElementById('profil-prenom')?.value.trim();
    const nom    = document.getElementById('profil-nom')?.value.trim();
    const email  = document.getElementById('profil-email')?.value.trim();
    const tel    = document.getElementById('profil-tel')?.value.trim();

    if (!prenom) {
      if (typeof toast === 'function') toast('Le prénom est obligatoire.', 'error');
      return;
    }

    Store.update('utilisateurs', userId, {
      prenom, nom, email, telephone: tel,
      avatar: _initiales(prenom, nom)
    });
    Store.addAuditLog('Mis à jour son profil', 'utilisateurs', { userId });

    /* Mettre à jour la session en cours */
    const session = Auth.getSession();
    if (session && session.id === userId) {
      const updated = Store.getById('utilisateurs', userId);
      if (updated) Auth.setSession(updated);
    }

    if (typeof toast === 'function') toast('Profil mis à jour.', 'success');
    /* Rafraîchir la vue profil */
    const area    = document.getElementById('view-content');
    const toolbar = document.getElementById('toolbar-actions');
    if (area && toolbar) renderMonProfil(toolbar, area);
  }

  /* --- Changer le mot de passe depuis le profil --- */
  function _saveMonMdp(userId) {
    const actuel = document.getElementById('profil-mdp-actuel')?.value || '';
    const newMdp = document.getElementById('profil-mdp-new')?.value || '';
    const conf   = document.getElementById('profil-mdp-new2')?.value || '';
    const errEl  = document.getElementById('profil-mdp-error');

    const showErr = (msg) => {
      if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; }
    };
    const hideErr = () => { if (errEl) errEl.style.display = 'none'; };

    hideErr();

    /* Vérification de l'ancien mot de passe */
    const user = Store.getById('utilisateurs', userId);
    if (!user) return;

    if (user.mdpHash && user.mdpHash !== _hashMdp(actuel)) {
      return showErr('Le mot de passe actuel est incorrect.');
    }
    if (!newMdp) return showErr('Le nouveau mot de passe est obligatoire.');
    if (newMdp.length < 6) return showErr('Le mot de passe doit faire au moins 6 caractères.');
    if (newMdp !== conf) return showErr('Les mots de passe ne correspondent pas.');

    Store.update('utilisateurs', userId, { mdpHash: _hashMdp(newMdp) });
    Store.addAuditLog('Changé son mot de passe', 'utilisateurs', { userId });

    /* Vider les champs */
    ['profil-mdp-actuel','profil-mdp-new','profil-mdp-new2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    if (typeof toast === 'function') toast('Mot de passe modifié.', 'success');
  }

  /* ================================================================
     UTILITAIRES INTERNES
     ================================================================ */
  function _fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('fr-FR'); }
    catch { return iso; }
  }

  function _fmtDateTime(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR') + ' ' +
        d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    } catch { return iso; }
  }

  function _fmtDateRelative(iso) {
    if (!iso) return 'Jamais';
    const diff = Date.now() - new Date(iso).getTime();
    const min  = Math.floor(diff / 60000);
    const h    = Math.floor(min / 60);
    const d    = Math.floor(h / 24);
    if (min < 1)  return 'À l\'instant';
    if (min < 60) return `Il y a ${min} min`;
    if (h < 24)   return `Il y a ${h}h`;
    if (d < 7)    return `Il y a ${d}j`;
    return _fmtDate(iso);
  }

  /* ================================================================
     INJECTION CSS SPÉCIFIQUE AU MODULE
     ================================================================ */
  function injectUsersCSS() {
    if (document.getElementById('users-module-css')) return;
    const style = document.createElement('style');
    style.id = 'users-module-css';
    style.textContent = `
      /* Avatars */
      .user-avatar-sm {
        width: 36px; height: 36px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; font-weight: 700; color: #fff;
        flex-shrink: 0;
      }
      .user-avatar-lg {
        width: 56px; height: 56px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; font-weight: 700; color: #fff;
        flex-shrink: 0;
      }
      .user-avatar-xl {
        width: 80px; height: 80px;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 28px; font-weight: 700; color: #fff;
      }

      /* Table cliquable */
      .data-table tbody tr { cursor: pointer; }
      .data-table tbody tr:hover { background: var(--bg-hover); }

      /* Modal large */
      .modal-lg { max-width: 820px !important; width: 820px !important; }
    `;
    document.head.appendChild(style);
  }

  /* ================================================================
     VUE BOUTIQUE — Configuration de la boutique
     ================================================================ */
  function renderBoutiqueConfig(toolbar, area) {
    const BOUTIQUE_KEY = 'hcs_boutique_config';
    const config = JSON.parse(localStorage.getItem(BOUTIQUE_KEY) || '{}');

    toolbar.innerHTML = `
      <button class="btn btn-primary btn-sm" id="btn-save-boutique">💾 Enregistrer</button>`;

    area.innerHTML = `
      <div style="max-width:680px;margin:0 auto;padding:24px 0;">
        <div class="page-header">
          <div class="page-title">🏪 Configuration de la boutique</div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Identité</div>
          <div class="form-grid">
            <div class="form-group span-full">
              <label class="form-label">Nom de la boutique</label>
              <input type="text" class="form-control" id="b-nom"
                value="${escHtml(config.nom || 'HCS ERP')}" placeholder="Ex: HCS — Personnalisation textile">
            </div>
            <div class="form-group span-full">
              <label class="form-label">Slogan / sous-titre</label>
              <input type="text" class="form-control" id="b-slogan"
                value="${escHtml(config.slogan || '')}" placeholder="Ex: Broderie & impression Polynésie">
            </div>
            <div class="form-group span-full">
              <label class="form-label">URL du logo (image)</label>
              <input type="text" class="form-control" id="b-logo"
                value="${escHtml(config.logo || '')}" placeholder="https://… ou laisser vide">
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Fiscalité & devise</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Devise</label>
              <select class="form-control" id="b-devise">
                <option value="XPF" ${(config.devise||'XPF')==='XPF'?'selected':''}>XPF — Franc pacifique</option>
                <option value="EUR" ${config.devise==='EUR'?'selected':''}>EUR — Euro</option>
                <option value="USD" ${config.devise==='USD'?'selected':''}>USD — Dollar</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Taux TVA par défaut</label>
              <select class="form-control" id="b-tva">
                <option value="0"  ${(config.tva||'0')==='0' ?'selected':''}>0 % — Exonéré</option>
                <option value="13" ${config.tva==='13'?'selected':''}>13 % — TVA réduite</option>
                <option value="16" ${config.tva==='16'?'selected':''}>16 % — TVA normale</option>
              </select>
            </div>
            <div class="form-group span-full">
              <label class="form-label">SIRET / N° entreprise</label>
              <input type="text" class="form-control" id="b-siret"
                value="${escHtml(config.siret || '')}" placeholder="123 456 789 B 00010">
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title">Contact & localisation</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Adresse</label>
              <input type="text" class="form-control" id="b-adresse"
                value="${escHtml(config.adresse || '')}" placeholder="Ex: BP 123, Papeete">
            </div>
            <div class="form-group">
              <label class="form-label">Téléphone</label>
              <input type="text" class="form-control" id="b-tel"
                value="${escHtml(config.tel || '')}" placeholder="Ex: 40 12 34 56">
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" id="b-email"
                value="${escHtml(config.email || '')}" placeholder="contact@hcs.pf">
            </div>
            <div class="form-group">
              <label class="form-label">Site web</label>
              <input type="text" class="form-control" id="b-web"
                value="${escHtml(config.web || '')}" placeholder="https://hcs.pf">
            </div>
          </div>
        </div>

        <div id="boutique-saved-ok" style="display:none;padding:12px 16px;background:#F0FDF4;
          border:1px solid #BBF7D0;border-radius:8px;color:#16A34A;font-size:13px;margin-top:8px;">
          ✅ Configuration enregistrée avec succès.
        </div>
      </div>`;

    function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    toolbar.querySelector('#btn-save-boutique').addEventListener('click', () => {
      const newCfg = {
        nom:    document.getElementById('b-nom')?.value?.trim()    || '',
        slogan: document.getElementById('b-slogan')?.value?.trim() || '',
        logo:   document.getElementById('b-logo')?.value?.trim()   || '',
        devise: document.getElementById('b-devise')?.value         || 'XPF',
        tva:    document.getElementById('b-tva')?.value            || '0',
        siret:  document.getElementById('b-siret')?.value?.trim()  || '',
        adresse:document.getElementById('b-adresse')?.value?.trim()|| '',
        tel:    document.getElementById('b-tel')?.value?.trim()    || '',
        email:  document.getElementById('b-email')?.value?.trim()  || '',
        web:    document.getElementById('b-web')?.value?.trim()    || ''
      };
      localStorage.setItem(BOUTIQUE_KEY, JSON.stringify(newCfg));
      const ok = document.getElementById('boutique-saved-ok');
      if (ok) { ok.style.display = 'block'; setTimeout(() => ok.style.display = 'none', 2500); }
    });
  }

  /* ================================================================
     API PUBLIQUE DU MODULE
     ================================================================ */
  return {
    init,
    /* Exposé pour les onclick inline */
    _openCreateModal,
    _openEditModal,
    _saveUser,
    _updateAvatarPreview,
    _updateRolePreview,
    _toggleMdpSection,
    _toggleActif,
    _confirmDelete,
    _saveMonProfil,
    _saveMonMdp,
    _refreshTable,
    _refreshAudit
  };

})();

/* Exposition globale */
window.Users = Users;
