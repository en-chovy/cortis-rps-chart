import { recordHistory, restoreEditableState } from './history.js?v=20260810-1';
import { state } from './state.js?v=20260810-1';

const LAYER_HIDE_FALLBACK_MS = 150;
const layerHideTimers = new WeakMap();
const layerOpenFrames = new WeakMap();

function needsConstrainedPopup() {
  return window.innerWidth <= 1024;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cancelLayerTransition(layer) {
  const hideTimer = layerHideTimers.get(layer);
  if (hideTimer) clearTimeout(hideTimer);
  layerHideTimers.delete(layer);

  const openFrame = layerOpenFrames.get(layer);
  if (openFrame) cancelAnimationFrame(openFrame);
  layerOpenFrames.delete(layer);
}

function showLayer(layer, display = 'flex') {
  if (!layer) return;
  const isAlreadyOpen = layer.classList.contains('is-open')
    && !layer.classList.contains('is-closing')
    && getComputedStyle(layer).display !== 'none';
  if (isAlreadyOpen) return;

  cancelLayerTransition(layer);
  layer.classList.remove('is-open', 'is-closing');
  layer.style.display = display;
  layer.removeAttribute('aria-hidden');

  if (prefersReducedMotion()) {
    layer.classList.add('is-open');
    return;
  }

  const frame = requestAnimationFrame(() => {
    layerOpenFrames.delete(layer);
    if (layer.style.display === 'none') return;
    layer.classList.add('is-open');
  });
  layerOpenFrames.set(layer, frame);
}

function hideLayer(layer) {
  if (!layer || getComputedStyle(layer).display === 'none') {
    return;
  }
  if (layer.classList.contains('is-closing')) return;

  cancelLayerTransition(layer);
  const finish = () => {
    layerHideTimers.delete(layer);
    layer.style.display = 'none';
    layer.classList.remove('is-open', 'is-closing');
    layer.setAttribute('aria-hidden', 'true');
  };

  if (prefersReducedMotion()) {
    finish();
    return;
  }

  layer.classList.remove('is-open');
  layer.classList.add('is-closing');
  layerHideTimers.set(layer, setTimeout(finish, LAYER_HIDE_FALLBACK_MS));
}

export function showModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  showLayer(modal);
}

export function closeVisualPicker({ commit = true } = {}) {
  const visual = document.getElementById('visualPickerPopup');
  const session = state.visualPickerSession;

  if (session) {
    if (commit) recordHistory('legend-color', session.before);
    else restoreEditableState(session.before);
  }

  document.documentElement.classList.remove('is-adjusting-color');
  state.visualPickerSession = null;
  state.editingId = null;
  hideLayer(visual);
}

export function closeAllPopups(options = {}) {
  const menu = document.getElementById('cellMenu');
  closeVisualPicker(options);
  hideLayer(menu);
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal || modal.classList.contains('is-closing')) return;
  hideLayer(modal);
}

function closeAllEditingUI() {
  closeAllPopups({ commit: true });
  document.querySelectorAll('.modal-overlay').forEach(overlay => closeModal(overlay.id));

  if (state.popupRepositionFrame !== null) {
    cancelAnimationFrame(state.popupRepositionFrame);
    state.popupRepositionFrame = null;
  }

  state.activeCell = null;
  state.activeCellIndex = null;
  state.activeNameGroup = null;
  state.editingId = null;
  state.unifiedEditingId = null;
  state.isImeComposing = false;
  state.nameEditingId = null;
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

  showLayer(popup);
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
