/* ================================================================
   HCS ERP — js/components/modal.js
   Système de modales réutilisables.
   Utilise #modal-container, #modal-box, #modal-content de index.html.
   ================================================================ */

'use strict';

/* ----------------------------------------------------------------
   Références aux éléments DOM du modal shell (index.html)
   ---------------------------------------------------------------- */
function _getModalEls() {
  return {
    overlay: document.getElementById('modal-container'),
    box:     document.getElementById('modal-box'),
    content: document.getElementById('modal-content'),
    close:   document.getElementById('modal-close')
  };
}

/* ----------------------------------------------------------------
   showModal(title, bodyHtml, onConfirm, confirmLabel)
   Affiche une modale générique.

   @param {string}   title         Titre de la modale
   @param {string}   bodyHtml      Contenu HTML du corps
   @param {Function} onConfirm     Callback au clic sur le bouton de confirmation
   @param {string}   confirmLabel  Libellé du bouton (défaut: 'Confirmer')
   @param {string}   size          '' | 'sm' | 'lg'
   ---------------------------------------------------------------- */
function showModal(title, bodyHtml, onConfirm = null, confirmLabel = 'Confirmer', size = '') {
  const { overlay, box, content } = _getModalEls();
  if (!overlay || !box || !content) {
    console.warn('[Modal] Éléments #modal-container/#modal-box/#modal-content introuvables');
    return;
  }

  /* Corps de la modale */
  let footerHtml = '';
  if (onConfirm) {
    footerHtml = `
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-btn-cancel">Annuler</button>
        <button class="btn btn-primary" id="modal-btn-confirm">${_escM(confirmLabel)}</button>
      </div>`;
  }

  content.innerHTML = `
    <div class="modal-title">${_escM(title)}</div>
    <div class="modal-body-content">${bodyHtml}</div>
    ${footerHtml}
  `;

  /* Taille */
  box.className = 'modal-box' + (size ? ` modal-${size}` : '');

  /* Affichage */
  overlay.style.display = 'flex';

  /* Événements internes */
  const btnConfirm = document.getElementById('modal-btn-confirm');
  const btnCancel  = document.getElementById('modal-btn-cancel');

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      if (typeof onConfirm === 'function') onConfirm();
      closeModal();
    });
  }
  if (btnCancel) {
    btnCancel.addEventListener('click', closeModal);
  }
}

/* ----------------------------------------------------------------
   showFormModal(title, fields, data, onSave, size)
   Modale avec un formulaire intégré (utilise form.js).

   @param {string}   title
   @param {Array}    fields   Descripteurs de champs (voir form.js)
   @param {object}   data     Valeurs initiales
   @param {Function} onSave   Callback(formData) à la soumission
   @param {string}   size     '' | 'sm' | 'lg'
   ---------------------------------------------------------------- */
function showFormModal(title, fields, data = {}, onSave, size = '') {
  const { overlay, box, content } = _getModalEls();
  if (!overlay || !box || !content) return;

  /* Injecter un div cible pour le formulaire */
  content.innerHTML = `<div id="modal-form-host"></div>`;
  box.className = 'modal-box' + (size ? ` modal-${size}` : '');
  overlay.style.display = 'flex';

  /* Rendre le formulaire dans la modale */
  if (typeof renderForm === 'function') {
    renderForm('modal-form-host', {
      title,
      fields,
      data,
      cols: size === 'lg' ? 3 : 2,
      onSave: (formData) => {
        if (typeof onSave === 'function') onSave(formData);
        closeModal();
      },
      onCancel: closeModal
    });
  } else {
    console.error('[Modal] form.js non chargé — renderForm() introuvable');
    content.innerHTML = `<div class="modal-title">${_escM(title)}</div>
      <p style="color:var(--text-muted)">Erreur : form.js non chargé.</p>`;
  }
}

/* ----------------------------------------------------------------
   showConfirm(message, onYes, onNo)
   Modale de confirmation simple.

   @param {string}   message  Message affiché
   @param {Function} onYes    Callback si l'utilisateur confirme
   @param {Function} onNo     Callback si l'utilisateur annule (optionnel)
   @param {string}   yesLabel Libellé du bouton Oui (défaut: 'Confirmer')
   @param {boolean}  danger   Si true, le bouton de confirmation est rouge
   ---------------------------------------------------------------- */
function showConfirm(message, onYes, onNo = null, yesLabel = 'Confirmer', danger = false) {
  const bodyHtml = `
    <p style="color:var(--text-secondary);line-height:1.6;margin-bottom:8px;">
      ${_escM(message)}
    </p>`;

  const btnClass = danger ? 'btn btn-danger' : 'btn btn-primary';

  const { overlay, box, content } = _getModalEls();
  if (!overlay || !box || !content) return;

  content.innerHTML = `
    <div class="modal-title">${danger ? '⚠️ ' : ''}Confirmation</div>
    <div class="modal-body-content">${bodyHtml}</div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="modal-btn-no">Annuler</button>
      <button class="${btnClass}" id="modal-btn-yes">${_escM(yesLabel)}</button>
    </div>
  `;

  box.className = 'modal-box modal-sm';
  overlay.style.display = 'flex';

  document.getElementById('modal-btn-yes')?.addEventListener('click', () => {
    if (typeof onYes === 'function') onYes();
    closeModal();
  });

  document.getElementById('modal-btn-no')?.addEventListener('click', () => {
    if (typeof onNo === 'function') onNo();
    closeModal();
  });
}

/* ----------------------------------------------------------------
   showDeleteConfirm(label, onConfirm)
   Raccourci pour confirmer une suppression.
   ---------------------------------------------------------------- */
function showDeleteConfirm(label, onConfirm) {
  showConfirm(
    `Voulez-vous vraiment supprimer "${label}" ? Cette action est irréversible.`,
    onConfirm,
    null,
    'Supprimer',
    true // bouton rouge
  );
}

/* ----------------------------------------------------------------
   closeModal()
   Ferme la modale active.
   ---------------------------------------------------------------- */
function closeModal() {
  const { overlay } = _getModalEls();
  if (overlay) {
    overlay.style.display = 'none';
    // Vider le contenu pour éviter les fuites d'événements
    const content = document.getElementById('modal-content');
    if (content) content.innerHTML = '';
  }
}

/* ----------------------------------------------------------------
   showAlert(message, type)
   Modale d'information simple (pas de bouton Annuler).

   @param {string} message
   @param {'info'|'success'|'error'|'warning'} type
   ---------------------------------------------------------------- */
function showAlert(message, type = 'info') {
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const colors = {
    info:    'var(--accent-blue)',
    success: 'var(--accent-green)',
    error:   'var(--accent-red)',
    warning: 'var(--accent-orange)'
  };

  const bodyHtml = `
    <div style="display:flex;align-items:flex-start;gap:16px;">
      <span style="font-size:2rem;line-height:1;">${icons[type]}</span>
      <p style="color:var(--text-secondary);line-height:1.6;">${_escM(message)}</p>
    </div>`;

  showModal('', bodyHtml, () => {}, 'OK', 'sm');

  // Colorier le bouton de confirmation selon le type
  setTimeout(() => {
    const btn = document.getElementById('modal-btn-confirm');
    if (btn) btn.style.background = colors[type] || colors.info;
  }, 0);
}

/* ----------------------------------------------------------------
   Initialisation : fermeture par overlay + Échap
   Appelé une seule fois au chargement de la page.
   ---------------------------------------------------------------- */
(function _initModalListeners() {
  // Attendre que le DOM soit prêt
  document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('modal-container');
    const closeBtn = document.getElementById('modal-close');

    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    if (closeBtn) {
      // Supprimer l'ancien listener mis par app.js pour éviter le double bind
      const newBtn = closeBtn.cloneNode(true);
      closeBtn.parentNode.replaceChild(newBtn, closeBtn);
      newBtn.addEventListener('click', closeModal);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  });
})();

/* ----------------------------------------------------------------
   Utilitaire
   ---------------------------------------------------------------- */
function _escM(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ----------------------------------------------------------------
   API publique
   ---------------------------------------------------------------- */
window.showModal        = showModal;
window.showFormModal    = showFormModal;
window.showConfirm      = showConfirm;
window.showDeleteConfirm= showDeleteConfirm;
window.showAlert        = showAlert;
window.closeModal       = closeModal;
