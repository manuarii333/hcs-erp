/* ================================================================
   HCS ERP — discuss.js
   Messagerie interne : canaux, messages directs, boîte de réception
   Layout type Odoo Discuss
   ================================================================ */

'use strict';

const Discuss = (() => {

  /* ----------------------------------------------------------------
     CONSTANTES
     ---------------------------------------------------------------- */
  const CHANNELS = [
    { id: 'inbox',      label: 'Boîte de réception', icon: '📥', type: 'system' },
    { id: 'general',    label: 'Général',             icon: '#',  type: 'channel' },
    { id: 'production', label: 'Production',          icon: '#',  type: 'channel' },
    { id: 'ventes',     label: 'Ventes',              icon: '#',  type: 'channel' },
  ];

  const DMS = [
    { id: 'dm-yannick', label: 'Yannick', color: '#7C3AED' },
    { id: 'dm-vendeur', label: 'Vendeur', color: '#0891B2' },
  ];

  /* Utilisateur courant */
  const ME = { id: 'me', label: 'Moi', color: '#16A34A' };

  let _currentChannel = 'inbox';
  let _area = null;

  /* ----------------------------------------------------------------
     UTILITAIRES
     ---------------------------------------------------------------- */

  /** Génère une couleur déterministe à partir d'une chaîne */
  function _strColor(str) {
    const COLORS = ['#7C3AED','#0891B2','#16A34A','#DC2626','#D97706','#DB2777','#059669','#2563EB'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return COLORS[Math.abs(hash) % COLORS.length];
  }

  /** Initiales depuis un label */
  function _initials(label) {
    return label.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  /** Formate un timestamp en heure ou date relative */
  function _formatTime(iso) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  /** Formate une date pour le séparateur de jour */
  function _formatDateSep(iso) {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (isToday) return "Aujourd'hui";
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  /* ----------------------------------------------------------------
     ALERTES SYSTÈME AUTO (pour la boîte de réception)
     ---------------------------------------------------------------- */

  function _generateSystemAlerts() {
    const db = Store.getDB();
    const now = Date.now();

    /* Stock bas / ruptures */
    (db.produits || []).forEach(p => {
      const stock = p.stock || 0;
      const seuil = p.stockMin || 5;
      if (stock === 0) {
        Store.addNotification(`Rupture de stock : ${p.nom} (stock = 0)`, 'stock');
      } else if (stock <= seuil) {
        Store.addNotification(`Stock bas : ${p.nom} (${stock} restants, seuil ${seuil})`, 'stock');
      }
    });

    /* Factures en retard (> 30 jours non payées) */
    (db.factures || []).forEach(f => {
      if (f.statut === 'Payée') return;
      const echeance = f.dateEcheance || f.date;
      if (!echeance) return;
      const jours = Math.floor((now - new Date(echeance).getTime()) / 86400000);
      if (jours > 30) {
        Store.addNotification(
          `Facture en retard : ${f.reference || f.id} — ${jours} jours de retard`, 'facture'
        );
      }
    });

    /* Ordres de fabrication terminés récemment (< 7 jours) */
    (db.ordresFab || []).forEach(of => {
      if (of.statut !== 'Terminé') return;
      const fin = of._updatedAt || of._createdAt;
      if (!fin) return;
      const jours = Math.floor((now - new Date(fin).getTime()) / 86400000);
      if (jours < 7) {
        Store.addNotification(
          `OF terminé : ${of.reference || of.id} — ${of.produit || 'produit'} (il y a ${jours}j)`, 'of'
        );
      }
    });
  }

  /* ----------------------------------------------------------------
     BADGE TOPBAR
     ---------------------------------------------------------------- */

  function _updateTopbarBadge() {
    const count = Store.getUnreadNotifCount();
    const btn = document.querySelector('[data-app="messagerie"]');
    if (!btn) return;

    /* Supprimer l'ancien badge */
    const old = btn.querySelector('.discuss-badge');
    if (old) old.remove();

    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'discuss-badge';
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.cssText = `
        position:absolute; top:4px; right:4px;
        background:#EF4444; color:#fff;
        font-size:10px; font-weight:700;
        min-width:16px; height:16px;
        border-radius:8px; padding:0 3px;
        display:flex; align-items:center; justify-content:center;
        pointer-events:none;
      `;
      /* Le bouton topbar doit être position:relative */
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }

  /* ----------------------------------------------------------------
     RENDU LAYOUT PRINCIPAL
     ---------------------------------------------------------------- */

  function _render() {
    if (!_area) return;

    /* Pas de padding sur la zone discuss */
    _area.style.padding = '0';
    _area.style.overflow = 'hidden';

    _area.innerHTML = `
      <div id="discuss-root" style="
        display:flex; height:calc(100vh - 60px);
        background:#fff; border-top:1px solid #E5E7EB;
        font-family:inherit;
      ">
        <!-- SIDEBAR -->
        <aside id="discuss-sidebar" style="
          width:240px; min-width:240px;
          background:#F9FAFB; border-right:1px solid #E5E7EB;
          display:flex; flex-direction:column;
          overflow-y:auto;
        ">
          <div style="padding:16px 12px 8px; font-size:11px; font-weight:700;
                      color:#6B7280; text-transform:uppercase; letter-spacing:.08em;">
            Canaux
          </div>
          ${CHANNELS.map(ch => _renderSidebarItem(ch.id, ch.icon, ch.label, ch.type)).join('')}

          <div style="padding:16px 12px 8px; font-size:11px; font-weight:700;
                      color:#6B7280; text-transform:uppercase; letter-spacing:.08em; margin-top:8px;">
            Messages directs
          </div>
          ${DMS.map(dm => _renderDmItem(dm)).join('')}
        </aside>

        <!-- ZONE PRINCIPALE -->
        <main id="discuss-main" style="
          flex:1; display:flex; flex-direction:column; overflow:hidden;
        ">
          <div id="discuss-header" style="
            padding:12px 20px; border-bottom:1px solid #E5E7EB;
            display:flex; align-items:center; gap:10px;
            background:#fff; min-height:52px;
          "></div>

          <div id="discuss-messages" style="
            flex:1; overflow-y:auto; padding:16px 20px;
            display:flex; flex-direction:column; gap:2px;
          "></div>

          <div id="discuss-composer" style="
            padding:12px 20px; border-top:1px solid #E5E7EB; background:#fff;
          "></div>
        </main>
      </div>
    `;

    _bindSidebar();
    _openChannel(_currentChannel);
  }

  function _renderSidebarItem(id, icon, label, type) {
    const active = _currentChannel === id;
    return `
      <div class="discuss-ch" data-ch="${id}" style="
        display:flex; align-items:center; gap:8px;
        padding:7px 16px; cursor:pointer; border-radius:6px; margin:1px 6px;
        background:${active ? '#EDE9FE' : 'transparent'};
        color:${active ? '#6D28D9' : '#374151'};
        font-weight:${active ? '600' : '400'};
        font-size:14px; transition:background .15s;
      ">
        <span style="font-size:14px; opacity:.7;">${icon}</span>
        <span style="flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${label}</span>
        ${type === 'system' ? `<span id="discuss-inbox-badge" style="
          background:#EF4444; color:#fff; font-size:10px; font-weight:700;
          border-radius:10px; padding:1px 5px; display:none;
        ">0</span>` : ''}
      </div>`;
  }

  function _renderDmItem(dm) {
    const active = _currentChannel === dm.id;
    return `
      <div class="discuss-ch" data-ch="${dm.id}" style="
        display:flex; align-items:center; gap:8px;
        padding:7px 16px; cursor:pointer; border-radius:6px; margin:1px 6px;
        background:${active ? '#EDE9FE' : 'transparent'};
        color:${active ? '#6D28D9' : '#374151'};
        font-weight:${active ? '600' : '400'};
        font-size:14px; transition:background .15s;
      ">
        <span style="
          width:26px; height:26px; border-radius:50%;
          background:${dm.color}; color:#fff;
          font-size:11px; font-weight:700;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0;
        ">${_initials(dm.label)}</span>
        <span>${dm.label}</span>
      </div>`;
  }

  function _bindSidebar() {
    document.querySelectorAll('.discuss-ch').forEach(el => {
      el.addEventListener('click', () => {
        _currentChannel = el.dataset.ch;
        _render(); /* Re-render complet pour highlight sidebar */
      });
    });
  }

  /* ----------------------------------------------------------------
     OUVERTURE D'UN CANAL
     ---------------------------------------------------------------- */

  function _openChannel(chId) {
    if (chId === 'inbox') {
      _renderInbox();
    } else {
      _renderChat(chId);
    }
    _refreshInboxBadge();
  }

  /* ----------------------------------------------------------------
     VUE INBOX
     ---------------------------------------------------------------- */

  function _renderInbox() {
    _generateSystemAlerts();

    const header = document.getElementById('discuss-header');
    const msgs   = document.getElementById('discuss-messages');
    const comp   = document.getElementById('discuss-composer');
    if (!header || !msgs || !comp) return;

    header.innerHTML = `
      <span style="font-size:20px;">📥</span>
      <span style="font-size:16px; font-weight:700; color:#111827;">Boîte de réception</span>
      <button id="discuss-mark-read" style="
        margin-left:auto; padding:6px 14px; border-radius:6px;
        border:1px solid #D1D5DB; background:#fff; color:#374151;
        font-size:13px; cursor:pointer;
      ">Tout marquer comme lu</button>
    `;

    comp.innerHTML = ''; /* Pas de composer dans l'inbox */

    const notifications = (Store.getDB().notifications || []);

    if (notifications.length === 0) {
      msgs.innerHTML = `
        <div style="
          flex:1; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          color:#9CA3AF; gap:12px; padding:60px 20px;
        ">
          <span style="font-size:48px;">📭</span>
          <span style="font-size:15px;">Aucune notification pour l'instant</span>
        </div>`;
      return;
    }

    const SOURCE_ICON = { stock: '📦', facture: '💰', of: '🏭', achat: '🛒', autre: '🔔' };

    msgs.innerHTML = notifications.map(n => `
      <div style="
        display:flex; gap:12px; padding:10px 12px; border-radius:8px;
        background:${n.read ? 'transparent' : '#EFF6FF'};
        border-left:3px solid ${n.read ? 'transparent' : '#3B82F6'};
        margin-bottom:2px;
      ">
        <span style="font-size:22px; flex-shrink:0; margin-top:2px;">
          ${SOURCE_ICON[n.source] || '🔔'}
        </span>
        <div style="flex:1;">
          <div style="font-size:14px; color:#111827; ${n.read ? '' : 'font-weight:600;'}">${_esc(n.text)}</div>
          <div style="font-size:12px; color:#6B7280; margin-top:3px;">${_formatTime(n.date)}</div>
        </div>
        ${!n.read ? `<span style="
          width:8px; height:8px; border-radius:50%; background:#3B82F6;
          flex-shrink:0; margin-top:6px;
        "></span>` : ''}
      </div>
    `).join('');

    /* Bouton "tout marquer comme lu" */
    document.getElementById('discuss-mark-read').addEventListener('click', () => {
      Store.markNotificationsRead();
      _updateTopbarBadge();
      _renderInbox();
      _refreshInboxBadge();
    });
  }

  /* ----------------------------------------------------------------
     VUE CHAT (canaux + DMs)
     ---------------------------------------------------------------- */

  function _renderChat(chId) {
    const header = document.getElementById('discuss-header');
    const comp   = document.getElementById('discuss-composer');
    if (!header || !comp) return;

    /* Trouver le label du canal */
    const ch = CHANNELS.find(c => c.id === chId) || DMS.find(d => d.id === chId);
    const label = ch ? ch.label : chId;
    const icon  = ch ? (ch.icon || '') : '';
    const isDm  = DMS.some(d => d.id === chId);
    const dmColor = isDm ? (DMS.find(d => d.id === chId) || {}).color || '#6B7280' : null;

    header.innerHTML = `
      ${isDm
        ? `<span style="width:32px;height:32px;border-radius:50%;background:${dmColor};color:#fff;
              font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;">
              ${_initials(label)}</span>`
        : `<span style="font-size:18px; color:#6B7280;">${icon}</span>`
      }
      <span style="font-size:16px; font-weight:700; color:#111827;">${_esc(label)}</span>
    `;

    comp.innerHTML = `
      <div style="display:flex; gap:10px; align-items:flex-end;">
        <div style="
          width:32px; height:32px; border-radius:50%; background:${ME.color};
          color:#fff; font-size:12px; font-weight:700;
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        ">${_initials(ME.label)}</div>
        <div style="flex:1; position:relative;">
          <textarea id="discuss-input" rows="1" placeholder="Écrire un message…" style="
            width:100%; padding:10px 14px; border:1px solid #D1D5DB; border-radius:8px;
            font-size:14px; font-family:inherit; resize:none; outline:none;
            line-height:1.5; max-height:120px; overflow-y:auto; box-sizing:border-box;
          "></textarea>
        </div>
        <button id="discuss-send" style="
          padding:9px 18px; background:#6D28D9; color:#fff; border:none;
          border-radius:8px; font-size:14px; font-weight:600; cursor:pointer;
        ">Envoyer</button>
      </div>
    `;

    _renderMessages(chId);
    _bindComposer(chId);
  }

  /* ----------------------------------------------------------------
     RENDU DES MESSAGES
     ---------------------------------------------------------------- */

  function _renderMessages(chId) {
    const container = document.getElementById('discuss-messages');
    if (!container) return;

    const allMsgs = Store.getAll('messages').filter(m => m.channel === chId);
    allMsgs.sort((a, b) => new Date(a._createdAt) - new Date(b._createdAt));

    if (allMsgs.length === 0) {
      container.innerHTML = `
        <div style="
          flex:1; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          color:#9CA3AF; gap:12px; padding:60px 20px;
        ">
          <span style="font-size:48px;">💬</span>
          <span style="font-size:15px;">Aucun message — commencez la conversation !</span>
        </div>`;
      return;
    }

    let lastDate = '';
    let html = '';

    allMsgs.forEach(msg => {
      const dateKey = new Date(msg._createdAt).toDateString();
      if (dateKey !== lastDate) {
        lastDate = dateKey;
        html += `
          <div style="
            display:flex; align-items:center; gap:12px;
            margin:12px 0; color:#6B7280; font-size:12px;
          ">
            <div style="flex:1; height:1px; background:#E5E7EB;"></div>
            <span>${_formatDateSep(msg._createdAt)}</span>
            <div style="flex:1; height:1px; background:#E5E7EB;"></div>
          </div>`;
      }

      const isMe = msg.authorId === ME.id;
      const authorColor = isMe ? ME.color : _strColor(msg.author || 'user');
      const authorLabel = msg.author || 'Utilisateur';

      html += `
        <div style="
          display:flex; gap:10px; padding:4px 0;
          ${isMe ? 'flex-direction:row-reverse;' : ''}
        ">
          <div style="
            width:34px; height:34px; border-radius:50%;
            background:${authorColor}; color:#fff;
            font-size:12px; font-weight:700;
            display:flex; align-items:center; justify-content:center;
            flex-shrink:0; margin-top:2px;
          ">${_initials(authorLabel)}</div>
          <div style="max-width:70%; ${isMe ? 'align-items:flex-end;' : ''} display:flex; flex-direction:column; gap:3px;">
            <div style="display:flex; align-items:baseline; gap:8px; ${isMe ? 'flex-direction:row-reverse;' : ''}">
              <span style="font-size:13px; font-weight:700; color:#111827;">${_esc(authorLabel)}</span>
              <span style="font-size:11px; color:#9CA3AF;">${_formatTime(msg._createdAt)}</span>
            </div>
            <div style="
              padding:8px 12px; border-radius:10px; font-size:14px; line-height:1.5;
              background:${isMe ? '#6D28D9' : '#F3F4F6'};
              color:${isMe ? '#fff' : '#111827'};
              ${isMe ? 'border-bottom-right-radius:2px;' : 'border-bottom-left-radius:2px;'}
            ">${_esc(msg.texte || msg.text || '')}</div>
          </div>
        </div>`;
    });

    container.innerHTML = html;
    /* Auto-scroll vers le bas */
    container.scrollTop = container.scrollHeight;
  }

  /* ----------------------------------------------------------------
     COMPOSER — ENVOI DE MESSAGE
     ---------------------------------------------------------------- */

  function _bindComposer(chId) {
    const input = document.getElementById('discuss-input');
    const btn   = document.getElementById('discuss-send');
    if (!input || !btn) return;

    /* Ajustement hauteur automatique */
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    function sendMsg() {
      const text = input.value.trim();
      if (!text) return;

      Store.create('messages', {
        channel:  chId,
        authorId: ME.id,
        author:   ME.label,
        texte:    text
      });

      input.value = '';
      input.style.height = 'auto';
      _renderMessages(chId);
    }

    btn.addEventListener('click', sendMsg);

    input.addEventListener('keydown', e => {
      /* Enter sans Shift envoie le message */
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });
  }

  /* ----------------------------------------------------------------
     BADGE INBOX (sidebar)
     ---------------------------------------------------------------- */

  function _refreshInboxBadge() {
    const count = Store.getUnreadNotifCount();
    const badge = document.getElementById('discuss-inbox-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /* ----------------------------------------------------------------
     ÉCHAPPEMENT HTML
     ---------------------------------------------------------------- */

  function _esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ----------------------------------------------------------------
     INIT (appelé par app.js)
     ---------------------------------------------------------------- */

  function init(toolbar, area, viewId) {
    _area = area;

    /* Pas de toolbar custom — Discuss gère son propre layout */
    if (toolbar) toolbar.innerHTML = '';

    /* Générer les alertes système au chargement */
    _generateSystemAlerts();

    /* Canal par défaut selon viewId */
    const VALID = [...CHANNELS.map(c => c.id), ...DMS.map(d => d.id)];
    if (viewId && VALID.includes(viewId)) {
      _currentChannel = viewId;
    } else {
      _currentChannel = 'inbox';
    }

    _render();
    _updateTopbarBadge();
  }

  /* ----------------------------------------------------------------
     API PUBLIQUE
     ---------------------------------------------------------------- */
  return {
    init,
    updateBadge: _updateTopbarBadge
  };

})();

window.Discuss = Discuss;
