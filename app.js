import { hexToRgb, rgbToHsv, toColorValues } from './src/color.js';
import { createColorPicker } from './src/color-picker.js';
import { initExportControls } from './src/export.js';
import {
  captureEditableState,
  commitMutation,
  configureHistory,
  initHistoryControls,
  redoEdit,
  undoEdit
} from './src/history.js';
import {
  addLegend,
  deleteLegend,
  getEditableState,
  getLegend,
  getLegendColor,
  paintCell,
  renameLegend,
  setLegendColor
} from './src/model.js';
import { initializeCells, renderApp, renderColors } from './src/render.js';
import { state } from './src/state.js';
import {
  closeAllPopups,
  closeModal,
  closeVisualPicker,
  handleViewportResize,
  positionPopup,
  showModal
} from './src/ui.js';

let desktopPicker = null;
let unifiedPicker = null;

function isMobile() {
  return window.innerWidth <= 480;
}

function toPickerColor({ hex, alpha }) {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, v] = rgbToHsv(r, g, b);
  return { h, s, v, a: alpha };
}

function updateLegendFromPicker(id, pickerColor) {
  const { hex } = toColorValues(pickerColor);
  setLegendColor(id, { hex, alpha: pickerColor.a });
}

function initColorPickers() {
  desktopPicker = createColorPicker({
    area: document.getElementById('sbArea'),
    hueSlider: document.getElementById('hueSlider'),
    alphaSlider: document.getElementById('alphaSlider'),
    cursor: document.getElementById('pickerCursor'),
    onChange: color => {
      if (state.editingId == null) return;
      updateLegendFromPicker(state.editingId, color);
      renderColors();
    }
  });

  unifiedPicker = createColorPicker({
    area: document.getElementById('unifiedSbArea'),
    hueSlider: document.getElementById('unifiedHueSlider'),
    alphaSlider: document.getElementById('unifiedAlphaSlider'),
    cursor: document.getElementById('unifiedPickerCursor')
  });
}

function openVisualPicker(target, id) {
  const color = getLegendColor(id);
  if (!color || !desktopPicker) return;

  closeAllPopups({ commit: true, restoreFocus: false });
  state.editingId = Number(id);
  state.visualPickerSession = {
    before: captureEditableState(),
    trigger: target
  };

  const popup = document.getElementById('visualPickerPopup');
  positionPopup(popup, target, true);
  desktopPicker.setValue(toPickerColor(color));
}

function openUnifiedModal(id, trigger) {
  const legend = getLegend(id);
  const color = getLegendColor(id);
  if (!legend || !color || !unifiedPicker) return;

  closeAllPopups({ commit: true, restoreFocus: false });
  state.unifiedEditingId = Number(id);
  document.getElementById('unifiedNameInput').value = legend.name;
  showModal('unifiedModalOverlay', trigger);
  unifiedPicker.setValue(toPickerColor(color));
}

function saveUnified() {
  const name = document.getElementById('unifiedNameInput').value.trim();
  const id = state.unifiedEditingId;
  if (!name || id == null || !unifiedPicker) return;

  const pickerColor = unifiedPicker.getValue();
  commitMutation('legend-edit', () => {
    renameLegend(id, name);
    updateLegendFromPicker(id, pickerColor);
  });

  state.unifiedEditingId = null;
  state.isImeComposing = false;
  closeModal('unifiedModalOverlay');
}

function openNameModal(id, trigger) {
  const legend = getLegend(id);
  if (!legend) return;

  state.isAdding = false;
  state.nameEditingId = Number(id);
  document.getElementById('modalTitle').textContent = '이름 변경';
  const input = document.getElementById('nameInput');
  input.value = legend.name;
  showModal('nameModalOverlay', trigger);
  requestAnimationFrame(() => input.focus());
}

function openAddModal(trigger) {
  state.isAdding = true;
  state.nameEditingId = null;
  document.getElementById('modalTitle').textContent = '새 범례 추가';
  const input = document.getElementById('nameInput');
  input.value = '';
  showModal('nameModalOverlay', trigger);
  requestAnimationFrame(() => input.focus());
}

function saveName() {
  const name = document.getElementById('nameInput').value.trim();
  if (!name) return;

  if (state.isAdding) {
    commitMutation('legend-add', () => addLegend(name));
  } else if (state.nameEditingId != null) {
    commitMutation('legend-name', () => renameLegend(state.nameEditingId, name));
  }

  state.isAdding = false;
  state.nameEditingId = null;
  state.isImeComposing = false;
  closeModal('nameModalOverlay');
}

function cancelNameModal() {
  state.isImeComposing = false;
  state.isAdding = false;
  state.nameEditingId = null;
  closeModal('nameModalOverlay');
}

function openDeleteConfirm(id, trigger) {
  state.pendingDeleteItemId = Number(id);
  showModal('deleteModalOverlay', trigger);
}

function cancelDelete() {
  state.pendingDeleteItemId = null;
  closeModal('deleteModalOverlay');
}

function confirmDelete() {
  const id = state.pendingDeleteItemId;
  if (id == null) return;
  commitMutation('legend-delete', () => deleteLegend(id));
  state.pendingDeleteItemId = null;
  closeModal('deleteModalOverlay');
}

function cancelUnified() {
  state.isImeComposing = false;
  state.unifiedEditingId = null;
  closeModal('unifiedModalOverlay');
}

function deleteUnifiedLegend() {
  const id = state.unifiedEditingId;
  if (id == null) return;
  commitMutation('legend-delete', () => deleteLegend(id));
  state.unifiedEditingId = null;
  closeModal('unifiedModalOverlay');
}

function openCellMenu(target) {
  closeAllPopups();
  const menu = document.getElementById('cellMenu');
  if (!menu || state.activeCellIndex == null) return;
  menu.replaceChildren();

  getEditableState().legends.forEach(legend => {
    const option = document.createElement('div');
    option.className = 'menu-option';
    option.style.backgroundColor = `var(--color-${legend.id}-a)`;
    option.addEventListener('click', () => {
      commitMutation('cell-paint', () => paintCell(state.activeCellIndex, legend.id));
      closeAllPopups();
    });
    menu.appendChild(option);
  });

  const reset = document.createElement('div');
  reset.className = 'menu-reset';
  reset.textContent = '✕';
  reset.addEventListener('click', () => {
    commitMutation('cell-clear', () => paintCell(state.activeCellIndex, null));
    closeAllPopups();
  });
  menu.appendChild(reset);

  positionPopup(menu, target, false);
}

function initLegendDelegation() {
  const container = document.getElementById('legendContainer');
  if (!container) return;

  container.addEventListener('click', event => {
    const addButton = event.target.closest('.btn-add-legend');
    if (addButton && container.contains(addButton)) {
      openAddModal(addButton);
      return;
    }

    const item = event.target.closest('.legend-item');
    if (!item || !container.contains(item)) return;
    const id = Number(item.id.split('-')[1]);

    if (isMobile()) {
      openUnifiedModal(id, event.target);
    } else if (event.target.closest('.circle-display')) {
      openVisualPicker(event.target, id);
    } else if (event.target.closest('.editable-label')) {
      openNameModal(id, event.target);
    } else if (event.target.closest('.btn-delete-item')) {
      openDeleteConfirm(id, event.target);
    }
  });
}

function initModalButtons() {
  const nameOverlay = document.getElementById('nameModalOverlay');
  nameOverlay?.querySelector('.btn-cancel')?.addEventListener('click', cancelNameModal);
  nameOverlay?.querySelector('.btn-save')?.addEventListener('click', saveName);

  const deleteOverlay = document.getElementById('deleteModalOverlay');
  deleteOverlay?.querySelector('.btn-cancel')?.addEventListener('click', cancelDelete);
  document.getElementById('confirmDelBtn')?.addEventListener('click', confirmDelete);

  document.querySelector('#visualPickerPopup .btn-done')?.addEventListener('click', () => (
    closeAllPopups({ commit: true })
  ));
  document.getElementById('unifiedSaveBtn')?.addEventListener('click', saveUnified);
  document.getElementById('unifiedCancelBtn')?.addEventListener('click', cancelUnified);
  document.getElementById('unifiedDeleteBtn')?.addEventListener('click', deleteUnifiedLegend);

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('pointerdown', event => {
      if (event.target !== overlay) return;
      if (overlay.id === 'nameModalOverlay') cancelNameModal();
      else if (overlay.id === 'deleteModalOverlay') cancelDelete();
      else if (overlay.id === 'unifiedModalOverlay') cancelUnified();
    });
  });
}

function isVisible(element) {
  return Boolean(element && getComputedStyle(element).display !== 'none');
}

function isTextEditingTarget(target) {
  if (!(target instanceof Element)) return false;
  if (target.closest('textarea, [contenteditable="true"]')) return true;
  const input = target.closest('input');
  return Boolean(input && ['text', 'search', 'email', 'url', 'tel', 'password'].includes(input.type));
}

function isImeEnter(event) {
  return event.key === 'Enter' && (event.isComposing || state.isImeComposing || event.keyCode === 229);
}

function handleModalKeyboard(event, overlay, { cancel, save, allowIme = true }) {
  if (!isVisible(overlay)) return false;
  if (event.key === 'Escape') {
    event.preventDefault();
    cancel();
  } else if (event.key === 'Enter' && (!allowIme || !isImeEnter(event))) {
    event.preventDefault();
    save();
  }
  return true;
}

function initKeyboardInteraction() {
  [document.getElementById('nameInput'), document.getElementById('unifiedNameInput')].forEach(input => {
    input?.addEventListener('compositionstart', () => { state.isImeComposing = true; });
    input?.addEventListener('compositionend', () => { state.isImeComposing = false; });
  });

  document.addEventListener('keydown', event => {
    if (handleModalKeyboard(event, document.getElementById('nameModalOverlay'), {
      cancel: cancelNameModal,
      save: saveName
    })) return;
    if (handleModalKeyboard(event, document.getElementById('deleteModalOverlay'), {
      cancel: cancelDelete,
      save: confirmDelete,
      allowIme: false
    })) return;
    if (handleModalKeyboard(event, document.getElementById('unifiedModalOverlay'), {
      cancel: cancelUnified,
      save: saveUnified
    })) return;

    const visualPicker = document.getElementById('visualPickerPopup');
    if (isVisible(visualPicker)) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeVisualPicker({ commit: false });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        closeVisualPicker({ commit: true });
      }
      return;
    }

    if (isTextEditingTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const commandKey = event.metaKey || event.ctrlKey;
    if (commandKey && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undoEdit();
    } else if (commandKey && ((key === 'z' && event.shiftKey) || (event.ctrlKey && key === 'y'))) {
      event.preventDefault();
      redoEdit();
    }
  });
}

function initGlobalInteraction() {
  document.addEventListener('pointerdown', event => {
    const cell = event.target.closest('.paintable');
    if (cell) {
      state.activeCell = cell;
      state.activeCellIndex = Number(cell.dataset.cellIndex);
      openCellMenu(cell);
      return;
    }

    if (!event.target.closest('.ios-popup, .modal')) closeAllPopups();
  });

  document.addEventListener('selectstart', event => {
    if (!event.target.closest('input, textarea')) event.preventDefault();
  });
  document.addEventListener('dragstart', event => {
    if (!event.target.closest('input, textarea')) event.preventDefault();
  });
  window.addEventListener('resize', handleViewportResize);
  window.visualViewport?.addEventListener('resize', handleViewportResize);
}

(function boot() {
  initializeCells();
  configureHistory({ renderApp });
  renderApp();
  initColorPickers();
  initLegendDelegation();
  initModalButtons();
  initGlobalInteraction();
  initKeyboardInteraction();
  initHistoryControls();
  initExportControls();
})();
