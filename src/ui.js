import { recordHistory, restoreEditableState } from './history.js';
import { modalReturnFocus, state } from './state.js';

function needsConstrainedPopup() {
  return window.innerWidth <= 1024;
}

export function focusTrigger(trigger) {
  let focusTarget = trigger?.isConnected ? trigger : null;

  if (!focusTarget && trigger instanceof Element) {
    if (trigger.id) focusTarget = document.getElementById(trigger.id);

    if (!focusTarget) {
      const itemId = trigger.closest('.legend-item')?.id;
      if (itemId && trigger.matches('.circle-display, .editable-label, .btn-delete-item')) {
        const selector = trigger.matches('.circle-display')
          ? '.circle-display'
          : trigger.matches('.editable-label')
            ? '.editable-label'
            : '.btn-delete-item';
        focusTarget = document.querySelector(`#${itemId} ${selector}`);
      }
    }
  }

  if (!focusTarget) focusTarget = document.querySelector('.btn-add-legend');
  if (!focusTarget) return;

  if (!focusTarget.matches('button, input, select, textarea, a[href], [tabindex]')) {
    focusTarget.tabIndex = -1;
  }

  requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
}

export function showModal(id, trigger) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modalReturnFocus.set(id, trigger);
  modal.style.display = 'flex';
}

export function closeVisualPicker({ commit = true, restoreFocus = true } = {}) {
  const visual = document.getElementById('visualPickerPopup');
  const session = state.visualPickerSession;

  if (visual) visual.style.display = 'none';

  if (session) {
    if (commit) recordHistory('legend-color', session.before);
    else restoreEditableState(session.before);
    if (restoreFocus) focusTrigger(session.trigger);
  }

  state.visualPickerSession = null;
  state.editingId = null;
}

export function closeAllPopups(options = {}) {
  const menu = document.getElementById('cellMenu');
  closeVisualPicker(options);
  if (menu) menu.style.display = 'none';
}

export function closeModal(id, { restoreFocus = true } = {}) {
  const modal = document.getElementById(id);
  if (modal) modal.style.display = 'none';
  const trigger = modalReturnFocus.get(id);
  modalReturnFocus.delete(id);
  if (restoreFocus) focusTrigger(trigger);
}

function closeAllEditingUI() {
  closeAllPopups({ commit: true, restoreFocus: false });
  document.querySelectorAll('.modal-overlay').forEach(overlay => (
    closeModal(overlay.id, { restoreFocus: false })
  ));

  if (state.popupRepositionFrame !== null) {
    cancelAnimationFrame(state.popupRepositionFrame);
    state.popupRepositionFrame = null;
  }

  state.activeCell = null;
  state.editingId = null;
  state.unifiedEditingId = null;
  state.unifiedEditBefore = null;
  state.isImeComposing = false;
  state.currentLabelId = '';
  state.pendingDeleteItemId = null;
  state.isAdding = false;
}

export function handleViewportResize() {
  const nextViewportWidth = window.innerWidth;

  if (Math.abs(nextViewportWidth - state.lastViewportWidth) >= 1) {
    state.lastViewportWidth = nextViewportWidth;
    closeAllEditingUI();
    return;
  }

  scheduleOpenCellMenuPosition();
}

export function positionPopup(popup, target, isBelow) {
  if (!popup || !target) return;

  popup.style.display = 'flex';
  const rect = target.getBoundingClientRect();
  const container = document.querySelector('.container');
  if (!container) return;

  const containerRect = container.getBoundingClientRect();
  const targetCenterX = rect.left + rect.width / 2;
  let popupLeft = targetCenterX - containerRect.left - popup.offsetWidth / 2;

  if (popup.id === 'cellMenu' && needsConstrainedPopup()) {
    const viewportPadding = 8;
    const idealViewportLeft = targetCenterX - popup.offsetWidth / 2;
    const maxViewportLeft = Math.max(viewportPadding, window.innerWidth - popup.offsetWidth - viewportPadding);
    const popupViewportLeft = Math.min(Math.max(idealViewportLeft, viewportPadding), maxViewportLeft);
    const arrowInset = 14;
    const arrowLeft = Math.min(
      Math.max(targetCenterX - popupViewportLeft, arrowInset),
      popup.offsetWidth - arrowInset
    );

    popupLeft = popupViewportLeft - containerRect.left;
    popup.style.setProperty('--arrow-left', `${arrowLeft}px`);
  } else {
    popup.style.removeProperty('--arrow-left');
  }

  popup.style.left = `${popupLeft}px`;
  popup.style.top = isBelow
    ? `${rect.bottom - containerRect.top + 10}px`
    : `${rect.top - containerRect.top - popup.offsetHeight - 10}px`;
}

function scheduleOpenCellMenuPosition() {
  if (state.popupRepositionFrame !== null) cancelAnimationFrame(state.popupRepositionFrame);

  state.popupRepositionFrame = requestAnimationFrame(() => {
    state.popupRepositionFrame = null;
    const menu = document.getElementById('cellMenu');
    if (!state.activeCell?.isConnected || !menu || menu.style.display === 'none') return;
    positionPopup(menu, state.activeCell, false);
  });
}
