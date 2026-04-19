/* ================================================================
   HCS ERP — js/components/form.js
   Composant formulaire réutilisable : grille, validation, callbacks.
   Usage : renderForm('mon-id', { fields, data, onSave, title, ... })
   ================================================================ */

'use strict';

/**
 * État interne de chaque formulaire.
 * Clé = containerId, valeur = { config, formData }
 */
const _formState = {};

/* ----------------------------------------------------------------
   renderForm(containerId, config)
   Point d'entrée public.

   @param {string} containerId - id du div cible
   @param {object} config
     - fields   {Array}    descripteurs de champs (voir ci-dessous)
     - data     {object}   valeurs initiales (ou {} pour création)
     - onSave   {Function} callback(formData) à la soumission
     - onCancel {Function} callback() à l'annulation (optionnel)
     - title    {string}   titre du formulaire (optionnel)
     - actions  {Array}    boutons additionnels [{label, className, onClick}]
     - cols     {number}   nombre de colonnes de la grille (défaut: 2)

   Champ (fields[]) :
     - key       {string}   clé dans formData
     - label     {string}   libellé affiché
     - type      {string}   'text'|'number'|'money'|'select'|'date'|'textarea'|'static'|'email'|'tel'
     - options   {Array}    [{value, label}] pour type 'select'
     - required  {boolean}  validation requise
     - colSpan   {number}   colonnes occupées (1 ou 2)
     - placeholder {string}
     - min, max  {number}   pour type 'number'/'money'
     - hint      {string}   texte d'aide sous le champ
     - disabled  {boolean}
----------------------------------------------------------------- */
function renderForm(containerId, config) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[Form] Conteneur #${containerId} introuvable`);
    return;
  }

  const formData = Object.assign({}, config.data || {});
  _formState[containerId] = { config, formData };

  _drawForm(containerId);
}

/* ----------------------------------------------------------------
   _drawForm — rendu du formulaire
   ---------------------------------------------------------------- */
function _drawForm(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { config, formData } = _formState[containerId];

  const {
    fields   = [],
    title    = '',
    actions  = [],
    cols     = 2,
    onCancel = null
  } = config;

  let html = `<form class="form-view" id="form-${containerId}" novalidate>`;

  /* --- Titre --- */
  if (title) {
    html += `<div class="modal-title">${_escF(title)}</div>`;
  }

  /* --- Grille de champs --- */
  html += `<div class="form-grid cols-${cols}" style="grid-template-columns:repeat(${cols},1fr);">`;

  fields.forEach(field => {
    const spanVal = field.colSpan || field.cols || 1;
    const span = spanVal > 1 ? `grid-column:span ${spanVal};` : '';
    html += `<div class="form-group" style="${span}">`;
    html += _renderLabel(field);
    html += _renderField(field, formData, containerId);
    if (field.hint) {
      html += `<div class="form-hint">${_escF(field.hint)}</div>`;
    }
    // Zone d'erreur par champ
    html += `<div class="form-error" id="err-${containerId}-${field.key || field.name || ''}" style="display:none;"></div>`;
    html += `</div>`;
  });

  html += `</div>`; // fin form-grid

  /* --- Pied de formulaire : boutons --- */
  html += `<div class="modal-footer">`;

  // Boutons additionnels (gauche)
  if (actions.length > 0) {
    html += `<div style="margin-right:auto;display:flex;gap:8px;">`;
    actions.forEach((act, i) => {
      html += `<button type="button" class="${act.className || 'btn btn-ghost'}"
        data-form-action="${containerId}" data-action-index="${i}">${_escF(act.label)}</button>`;
    });
    html += `</div>`;
  }

  // Annuler
  if (onCancel) {
    html += `<button type="button" class="btn btn-ghost" data-form-cancel="${containerId}">Annuler</button>`;
  }

  // Sauvegarder
  html += `<button type="submit" class="btn btn-primary" form="form-${containerId}">
    ✔ Sauvegarder
  </button>`;

  html += `</div>`; // fin modal-footer
  html += `</form>`;

  container.innerHTML = html;

  /* --- Événements --- */
  _bindFormEvents(containerId);
}

/* ----------------------------------------------------------------
   _renderLabel — génère le label HTML
   ---------------------------------------------------------------- */
function _renderLabel(field) {
  if (field.type === 'static') return '';
  const key = field.key || field.name || '';
  const req = field.required ? ' required' : '';
  return `<label class="form-label${req}" for="field-${key}">${_escF(field.label)}</label>`;
}

/* ----------------------------------------------------------------
   _renderField — génère l'input selon le type
   Supporte field.key (API officielle) ET field.name (alias legacy)
   ---------------------------------------------------------------- */
function _renderField(field, formData, containerId) {
  const key      = field.key || field.name || '';
  const id       = `field-${key}`;
  const val      = formData[key] !== undefined ? formData[key] : '';
  const disabled = field.disabled ? 'disabled' : '';
  const required = field.required ? 'required' : '';
  const ph       = field.placeholder ? `placeholder="${_escF(field.placeholder)}"` : '';
  const dataAttr = `data-form-field="${containerId}" data-field-key="${key}" name="${key}"`;

  switch (field.type) {

    case 'static':
      // Valeur non éditable, affichée en lecture seule
      return `<div class="form-control" style="background:var(--bg-base);cursor:default;line-height:34px;">
        ${_escF(String(val || '—'))}
      </div>`;

    case 'textarea':
      return `<textarea
        id="${id}" class="form-control" rows="3"
        ${ph} ${disabled} ${required} ${dataAttr}
      >${_escF(String(val))}</textarea>`;

    case 'select': {
      const options = (field.options || []).map(opt => {
        const o = typeof opt === 'string' ? { value: opt, label: opt } : opt;
        const selected = String(val) === String(o.value) ? 'selected' : '';
        return `<option value="${_escF(String(o.value))}" ${selected}>${_escF(o.label)}</option>`;
      }).join('');
      return `<select id="${id}" class="form-control"
        ${disabled} ${required} ${dataAttr}>
        <option value="">— Choisir —</option>
        ${options}
      </select>`;
    }

    case 'number':
      return `<input type="number" id="${id}" class="form-control"
        value="${_escF(String(val))}"
        ${field.min !== undefined ? `min="${field.min}"` : ''}
        ${field.max !== undefined ? `max="${field.max}"` : ''}
        step="${field.step || 1}"
        ${ph} ${disabled} ${required} ${dataAttr} />`;

    case 'money':
      // Champ numérique avec suffixe XPF
      return `<div class="input-suffix">
        <input type="number" id="${id}" class="form-control"
          value="${_escF(String(val))}"
          min="${field.min !== undefined ? field.min : 0}"
          step="1"
          ${ph || 'placeholder="0"'} ${disabled} ${required} ${dataAttr} />
        <span class="suffix-label">XPF</span>
      </div>`;

    case 'date':
      return `<input type="date" id="${id}" class="form-control"
        value="${_escF(String(val))}"
        ${disabled} ${required} ${dataAttr} />`;

    case 'email':
      return `<input type="email" id="${id}" class="form-control"
        value="${_escF(String(val))}"
        ${ph} ${disabled} ${required} ${dataAttr} />`;

    case 'tel':
      return `<input type="tel" id="${id}" class="form-control"
        value="${_escF(String(val))}"
        ${ph} ${disabled} ${required} ${dataAttr} />`;

    default: // 'text'
      return `<input type="text" id="${id}" class="form-control"
        value="${_escF(String(val))}"
        ${ph} ${disabled} ${required} ${dataAttr} />`;
  }
}

/* ----------------------------------------------------------------
   _bindFormEvents — change, submit, cancel, boutons additionnels
   ---------------------------------------------------------------- */
function _bindFormEvents(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = _formState[containerId];

  /* Synchronisation en temps réel des champs → formData */
  container.querySelectorAll(`[data-form-field="${containerId}"]`).forEach(el => {
    const key = el.dataset.fieldKey || el.getAttribute('name') || '';
    if (!key) return;
    el.addEventListener('input', () => {
      state.formData[key] = el.type === 'number' ? Number(el.value) : el.value;
      _clearFieldError(containerId, key);
    });
    el.addEventListener('change', () => {
      state.formData[key] = el.type === 'number' ? Number(el.value) : el.value;
    });
  });

  /* Soumission du formulaire */
  const form = document.getElementById(`form-${containerId}`);
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      _handleSubmit(containerId);
    });
  }

  /* Annulation */
  const cancelBtn = container.querySelector(`[data-form-cancel="${containerId}"]`);
  if (cancelBtn && typeof state.config.onCancel === 'function') {
    cancelBtn.addEventListener('click', state.config.onCancel);
  }

  /* Boutons additionnels */
  container.querySelectorAll(`[data-form-action="${containerId}"]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.actionIndex, 10);
      const act = (state.config.actions || [])[idx];
      if (act && typeof act.onClick === 'function') {
        act.onClick(Object.assign({}, state.formData));
      }
    });
  });
}

/* ----------------------------------------------------------------
   _handleSubmit — validation et appel du callback onSave
   ---------------------------------------------------------------- */
function _handleSubmit(containerId) {
  const state  = _formState[containerId];
  const config = state.config;

  /* Validation des champs requis */
  let valid = true;

  (config.fields || []).forEach(field => {
    if (!field.required) return;
    const k   = field.key || field.name || '';
    const val = state.formData[k];
    const isEmpty = val === null || val === undefined || String(val).trim() === '';
    if (isEmpty) {
      _showFieldError(containerId, k, `Le champ "${field.label}" est obligatoire.`);
      valid = false;
    }
  });

  if (!valid) {
    if (typeof toast === 'function') {
      toast('Veuillez remplir tous les champs obligatoires.', 'error');
    }
    return;
  }

  /* Callback onSave avec une copie des données */
  if (typeof config.onSave === 'function') {
    config.onSave(Object.assign({}, state.formData));
  }
}

/* ----------------------------------------------------------------
   Gestion des messages d'erreur par champ
   ---------------------------------------------------------------- */
function _showFieldError(containerId, key, message) {
  const errEl = document.getElementById(`err-${containerId}-${key}`);
  if (!errEl) return;
  errEl.textContent = message;
  errEl.style.display = 'block';

  // Marquer l'input en erreur
  const input = document.getElementById(`field-${key}`);
  if (input) input.style.borderColor = 'var(--accent-red)';
}

function _clearFieldError(containerId, key) {
  const errEl = document.getElementById(`err-${containerId}-${key}`);
  if (errEl) {
    errEl.textContent = '';
    errEl.style.display = 'none';
  }
  const input = document.getElementById(`field-${key}`);
  if (input) input.style.borderColor = '';
}

/* ----------------------------------------------------------------
   getFormData — retourne les données actuelles du formulaire
   @param {string} containerId
   @returns {object|null}
   ---------------------------------------------------------------- */
function getFormData(containerId) {
  return _formState[containerId]
    ? Object.assign({}, _formState[containerId].formData)
    : null;
}

/* ----------------------------------------------------------------
   setFormData — met à jour les données et réaffiche le formulaire
   @param {string} containerId
   @param {object} data
   ---------------------------------------------------------------- */
function setFormData(containerId, data) {
  if (!_formState[containerId]) return;
  _formState[containerId].formData = Object.assign({}, data);
  _drawForm(containerId);
}

/* ----------------------------------------------------------------
   Utilitaire
   ---------------------------------------------------------------- */
function _escF(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ----------------------------------------------------------------
   API publique
   ---------------------------------------------------------------- */
window.renderForm   = renderForm;
window.getFormData  = getFormData;
window.setFormData  = setFormData;
