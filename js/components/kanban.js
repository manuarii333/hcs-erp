/* ================================================================
   HCS ERP — js/components/kanban.js
   Composant kanban réutilisable : colonnes, cartes, changement de stade.
   Usage : renderKanban('mon-id', { stages, cards, cardTemplate, ... })
   ================================================================ */

'use strict';

/**
 * État interne de chaque kanban instancié.
 * Clé = containerId, valeur = { config }
 */
const _kanbanState = {};

/* ----------------------------------------------------------------
   renderKanban(containerId, config)
   Point d'entrée public.

   @param {string} containerId - id du div cible
   @param {object} config
     - stages         {Array}    [{id, label, color}]
                        color : 'blue'|'green'|'orange'|'red'|'violet'|'gray'
     - cards          {Array}    objets avec au minimum { id, stage, montant? }
     - cardTemplate   {Function} (item) → HTML intérieur de la carte
     - onCardClick    {Function} callback(item) au clic sur une carte
     - onStageChange  {Function} callback(itemId, newStage)
     - groupBy        {string}   clé du champ "stade" dans les objets (défaut: 'stade')
     - amountKey      {string}   clé du montant pour le total colonne (défaut: 'montant')
     - addLabel       {string}   label bouton ajout (défaut: '+ Ajouter')
     - onAdd          {Function} callback(stageId) bouton ajout colonne
----------------------------------------------------------------- */
function renderKanban(containerId, config) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[Kanban] Conteneur #${containerId} introuvable`);
    return;
  }

  _kanbanState[containerId] = { config };
  _drawKanban(containerId);
}

/* ----------------------------------------------------------------
   _drawKanban — rendu complet du board
   ---------------------------------------------------------------- */
function _drawKanban(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { config } = _kanbanState[containerId];

  const {
    stages        = [],
    cards         = [],
    cardTemplate  = _defaultCardTemplate,
    onCardClick   = null,
    onStageChange = null,
    groupBy       = 'stade',
    amountKey     = 'montant',
    addLabel      = '+ Ajouter',
    onAdd         = null
  } = config;

  /* --- Grouper les cartes par stade --- */
  const byStage = {};
  stages.forEach(s => { byStage[s.id] = []; });
  cards.forEach(card => {
    const stageId = card[groupBy];
    if (byStage[stageId]) {
      byStage[stageId].push(card);
    } else {
      // Stade inconnu → colonne de fallback si elle existe
      const first = stages[0];
      if (first) byStage[first.id].push(card);
    }
  });

  /* --- Rendu HTML --- */
  let html = `<div class="kanban-board" id="kb-board-${containerId}">`;

  stages.forEach(stage => {
    const stageCards = byStage[stage.id] || [];
    const total = stageCards.reduce((s, c) => s + (Number(c[amountKey]) || 0), 0);
    const color = stage.color || 'gray';

    html += `
      <div class="kanban-column" data-stage="${stage.id}" id="kb-col-${containerId}-${stage.id}">

        <!-- En-tête colonne -->
        <div class="kanban-col-header">
          <div class="kanban-col-title">
            <span class="kanban-col-dot col-dot-${color}"></span>
            ${_esc(stage.label)}
          </div>
          <span class="kanban-col-count">${stageCards.length}</span>
        </div>

        <!-- Total montant -->
        <div class="kanban-col-total">${typeof fmt === 'function' ? fmt(total) : total + ' XPF'}</div>

        <!-- Corps scrollable -->
        <div class="kanban-col-body" id="kb-body-${containerId}-${stage.id}">
          ${stageCards.length === 0
            ? `<div class="kanban-empty"><div class="empty-icon">📭</div><p>Aucune carte</p></div>`
            : stageCards.map(card => _renderCard(card, stages, containerId, cardTemplate, onStageChange)).join('')
          }
        </div>

        <!-- Bouton ajout -->
        ${onAdd ? `
          <button class="kanban-add-btn"
            data-kb-add="${containerId}"
            data-stage="${stage.id}">
            ${addLabel}
          </button>` : ''}

      </div>`;
  });

  html += `</div>`;
  container.innerHTML = html;

  /* --- Liaison des événements --- */
  _bindKanbanEvents(containerId, cards);
}

/* ----------------------------------------------------------------
   _renderCard — HTML d'une carte (wrapper + template)
   ---------------------------------------------------------------- */
function _renderCard(card, stages, containerId, cardTemplate, onStageChange) {
  /* Boutons de déplacement vers les stades adjacents */
  const currentIdx = stages.findIndex(s => s.id === card.stage || s.id === card.stade);

  let moveButtons = '';
  if (onStageChange) {
    // Stade précédent
    if (currentIdx > 0) {
      const prev = stages[currentIdx - 1];
      moveButtons += `<button
        class="btn btn-ghost btn-sm"
        title="← ${_esc(prev.label)}"
        data-kb-move="${containerId}"
        data-card-id="${card.id}"
        data-target-stage="${prev.id}"
        style="padding:2px 6px;font-size:11px;"
      >←</button>`;
    }
    // Stade suivant
    if (currentIdx < stages.length - 1) {
      const next = stages[currentIdx + 1];
      moveButtons += `<button
        class="btn btn-primary btn-sm"
        title="${_esc(next.label)} →"
        data-kb-move="${containerId}"
        data-card-id="${card.id}"
        data-target-stage="${next.id}"
        style="padding:2px 6px;font-size:11px;"
      >→</button>`;
    }
  }

  return `
    <div class="kanban-card"
      data-kb-card="${containerId}"
      data-card-id="${card.id}">
      ${cardTemplate(card)}
      ${moveButtons ? `
        <div class="kanban-card-footer" style="justify-content:flex-end;gap:4px;">
          ${moveButtons}
        </div>` : ''}
    </div>`;
}

/* ----------------------------------------------------------------
   _defaultCardTemplate — template par défaut si non fourni
   ---------------------------------------------------------------- */
function _defaultCardTemplate(item) {
  const amountKey = 'montant';
  return `
    <div class="kanban-card-title">${_esc(item.nom || item.titre || item.id)}</div>
    ${item.client ? `<div class="kanban-card-sub">${_esc(item.client)}</div>` : ''}
    ${item[amountKey] !== undefined
      ? `<div class="kanban-card-amount">${typeof fmt === 'function' ? fmt(item[amountKey]) : item[amountKey]}</div>`
      : ''}
  `;
}

/* ----------------------------------------------------------------
   _bindKanbanEvents — clics sur cartes, boutons de déplacement, ajout
   ---------------------------------------------------------------- */
function _bindKanbanEvents(containerId, cards) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const { config } = _kanbanState[containerId];
  const { onCardClick, onStageChange, onAdd, groupBy = 'stade' } = config;

  /* Clic sur une carte */
  if (typeof onCardClick === 'function') {
    container.querySelectorAll(`[data-kb-card="${containerId}"]`).forEach(el => {
      el.addEventListener('click', (e) => {
        // Ne pas déclencher si c'est un bouton de déplacement
        if (e.target.closest('[data-kb-move]')) return;
        const id   = el.dataset.cardId;
        const item = cards.find(c => String(c.id) === String(id));
        if (item) onCardClick(item);
      });
    });
  }

  /* Boutons de déplacement de stade */
  if (typeof onStageChange === 'function') {
    container.querySelectorAll(`[data-kb-move="${containerId}"]`).forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardId     = btn.dataset.cardId;
        const targetStage = btn.dataset.targetStage;

        // Mettre à jour la carte dans la config
        const card = config.cards.find(c => String(c.id) === String(cardId));
        if (card) {
          card[groupBy] = targetStage;
        }

        // Callback utilisateur
        onStageChange(cardId, targetStage);

        // Redessiner
        _drawKanban(containerId);
      });
    });
  }

  /* Boutons d'ajout par colonne */
  if (typeof onAdd === 'function') {
    container.querySelectorAll(`[data-kb-add="${containerId}"]`).forEach(btn => {
      btn.addEventListener('click', () => {
        onAdd(btn.dataset.stage);
      });
    });
  }
}

/* ----------------------------------------------------------------
   updateKanban — mise à jour des données sans recréer la config
   @param {string} containerId
   @param {Array}  newCards   — nouveau tableau de cartes
   ---------------------------------------------------------------- */
function updateKanban(containerId, newCards) {
  if (!_kanbanState[containerId]) return;
  _kanbanState[containerId].config.cards = newCards;
  _drawKanban(containerId);
}

/* ----------------------------------------------------------------
   Utilitaire
   ---------------------------------------------------------------- */
function _esc(str) {
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
window.renderKanban  = renderKanban;
window.updateKanban  = updateKanban;
