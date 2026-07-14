import { getAlphaFromRgba, hexToRgb, rgbToHsv, toColorValues } from './src/color.js';
import { initExportControls } from './src/export.js';
import {
  captureEditableState,
  commitMutation,
  initHistoryControls,
  recordHistory,
  redoEdit,
  restoreEditableState,
  undoEdit
} from './src/history.js';
import { createLegendElement } from './src/legend-dom.js';
import { state } from './src/state.js';
import {
  closeAllPopups,
  closeModal,
  closeVisualPicker,
  handleViewportResize,
  positionPopup,
  showModal
} from './src/ui.js';

function isMobile() {
  return window.innerWidth <= 480;
}

function updateColors() {
  if (state.editingId == null) return;

  const { r, g, b, hex, rgba } = toColorValues(state.currentColor);

  document.documentElement.style.setProperty(`--color-${state.editingId}`, hex);
  document.documentElement.style.setProperty(`--color-${state.editingId}-a`, rgba);

  const sbArea = document.getElementById('sbArea');
  if (sbArea) sbArea.style.backgroundColor = `hsl(${state.currentColor.h}, 100%, 50%)`;
  
  const alphaSlider = document.getElementById('alphaSlider');
  if (alphaSlider) {
      alphaSlider.style.background = `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1)), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 14px 14px`;
  }
}

/* --- LEGEND EDITING --- */
function openVisualPicker(target, id) {
  closeAllPopups({ commit: true, restoreFocus: false });
  state.editingId = Number(id);
  state.visualPickerSession = {
    before: captureEditableState(),
    trigger: target
  };

  const rootStyle = getComputedStyle(document.documentElement);
  const hexColor = rootStyle.getPropertyValue(`--color-${id}`).trim();
  const rgbaColor = rootStyle.getPropertyValue(`--color-${id}-a`).trim();

  if (hexColor) {
      const [r, g, b] = hexToRgb(hexColor);
      const [h, s, v] = rgbToHsv(r, g, b);
      state.currentColor.h = h;
      state.currentColor.s = s;
      state.currentColor.v = v;

      state.currentColor.a = getAlphaFromRgba(rgbaColor);

      const hueSlider = document.getElementById('hueSlider');
      if (hueSlider) hueSlider.value = state.currentColor.h;
      const alphaSlider = document.getElementById('alphaSlider');
      if (alphaSlider) alphaSlider.value = state.currentColor.a;
  }
  
  const popup = document.getElementById('visualPickerPopup');
  positionPopup(popup, target, true);

  const sbArea = document.getElementById('sbArea');
  const cursor = document.getElementById('pickerCursor');
  if (sbArea && cursor) {
      const rect = sbArea.getBoundingClientRect();
      const x = (state.currentColor.s / 100) * rect.width;
      const y = ((100 - state.currentColor.v) / 100) * rect.height;
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
  }

  updateColors();
}

function updateUnifiedColorsPreview() {
    const { r, g, b } = toColorValues(state.unifiedColor);
    const sbArea = document.getElementById('unifiedSbArea');
    if (sbArea) sbArea.style.backgroundColor = `hsl(${state.unifiedColor.h}, 100%, 50%)`;
    
    const alphaSlider = document.getElementById('unifiedAlphaSlider');
    if (alphaSlider) {
        alphaSlider.style.background = `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1)), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 14px 14px`;
    }
}

function openUnifiedModal(id, trigger) {
    closeAllPopups({ commit: true, restoreFocus: false });
    state.unifiedEditingId = id;
    state.unifiedEditBefore = captureEditableState();
    const rootStyle = getComputedStyle(document.documentElement);
    
    const labelEl = document.getElementById(`label-${id}`);
    document.getElementById('unifiedNameInput').value = labelEl ? labelEl.innerText : '';

    const hexColor = rootStyle.getPropertyValue(`--color-${id}`).trim();
    const rgbaColor = rootStyle.getPropertyValue(`--color-${id}-a`).trim();

    if (hexColor) {
        const [r, g, b] = hexToRgb(hexColor);
        const [h, s, v] = rgbToHsv(r, g, b);
        state.unifiedColor.h = h; state.unifiedColor.s = s; state.unifiedColor.v = v;
        state.unifiedColor.a = getAlphaFromRgba(rgbaColor);

        document.getElementById('unifiedHueSlider').value = state.unifiedColor.h;
        document.getElementById('unifiedAlphaSlider').value = state.unifiedColor.a;
    }

    showModal('unifiedModalOverlay', trigger);
    
    requestAnimationFrame(() => {
        const cursor = document.getElementById('unifiedPickerCursor');
        const rect = document.getElementById('unifiedSbArea').getBoundingClientRect();
        const x = (state.unifiedColor.s / 100) * rect.width;
        const y = ((100 - state.unifiedColor.v) / 100) * rect.height;
        if (cursor) {
            cursor.style.left = x + 'px';
            cursor.style.top = y + 'px';
        }
        updateUnifiedColorsPreview();
    });
}

function saveUnified() {
    const val = document.getElementById('unifiedNameInput').value.trim();
    if (!val) return;

    const before = state.unifiedEditBefore ?? captureEditableState();
    const label = document.getElementById(`label-${state.unifiedEditingId}`);
    if (label) {
      label.innerText = val;
      label.closest('.legend-item')?.querySelector('.btn-delete-item')?.setAttribute('aria-label', `${val} 범례 삭제`);
    }

    const { hex, rgba } = toColorValues(state.unifiedColor);
    document.documentElement.style.setProperty(`--color-${state.unifiedEditingId}`, hex);
    document.documentElement.style.setProperty(`--color-${state.unifiedEditingId}-a`, rgba);
    recordHistory('legend-edit', before);

    state.unifiedEditBefore = null;
    state.unifiedEditingId = null;
    state.isImeComposing = false;
    closeModal('unifiedModalOverlay');
}

function initUnifiedColorPicker() {
    const sbArea = document.getElementById('unifiedSbArea');
    const hueSlider = document.getElementById('unifiedHueSlider');
    const alphaSlider = document.getElementById('unifiedAlphaSlider');

    if (!sbArea || !hueSlider) return;

    function handleSB(e) {
        const rect = sbArea.getBoundingClientRect();
        const cx = e.touches?.length ? e.touches[0].clientX : e.clientX;
        const cy = e.touches?.length ? e.touches[0].clientY : e.clientY;

        let x = Math.max(0, Math.min(rect.width, cx - rect.left));
        let y = Math.max(0, Math.min(rect.height, cy - rect.top));

        state.unifiedColor.s = (x / rect.width) * 100;
        state.unifiedColor.v = 100 - (y / rect.height) * 100;

        const cursor = document.getElementById('unifiedPickerCursor');
        if (cursor) { cursor.style.left = x + 'px'; cursor.style.top = y + 'px'; }
        updateUnifiedColorsPreview();
    }

    const attachDrag = (startEvent, moveEvent, endEvent) => {
        sbArea.addEventListener(startEvent, (e) => {
            if(startEvent === 'touchstart') e.preventDefault(); // 스크롤 방지
            handleSB(e);
            const move = (me) => handleSB(me);
            const up = () => {
                document.removeEventListener(moveEvent, move);
                document.removeEventListener(endEvent, up);
                if(startEvent === 'touchstart') document.removeEventListener('touchcancel', up);
            };
            document.addEventListener(moveEvent, move, { passive: false });
            document.addEventListener(endEvent, up);
            if(startEvent === 'touchstart') document.addEventListener('touchcancel', up);
        }, { passive: false });
    };

    attachDrag('mousedown', 'mousemove', 'mouseup');
    attachDrag('touchstart', 'touchmove', 'touchend');

    hueSlider.addEventListener('input', (e) => { state.unifiedColor.h = e.target.value; updateUnifiedColorsPreview(); });
    if (alphaSlider) alphaSlider.addEventListener('input', (e) => { state.unifiedColor.a = e.target.value; updateUnifiedColorsPreview(); });
}

/* --- LEGEND MODAL LOGIC --- */
function openNameModal(labelDomId, trigger) {
  state.isAdding = false;
  state.currentLabelId = labelDomId;

  document.getElementById('modalTitle').innerText = "이름 변경";
  const input = document.getElementById('nameInput');
  input.value = document.getElementById(labelDomId).innerText;
  showModal('nameModalOverlay', trigger);
  requestAnimationFrame(() => input.focus());
}

function openAddModal(trigger) {
  state.isAdding = true;

  document.getElementById('modalTitle').innerText = "새 범례 추가";
  const input = document.getElementById('nameInput');
  input.value = "";
  showModal('nameModalOverlay', trigger);
  requestAnimationFrame(() => input.focus());
}

function saveName() {
  const val = document.getElementById('nameInput').value.trim();
  if (!val) return;

  commitMutation(state.isAdding ? 'legend-add' : 'legend-name', () => {
    if (state.isAdding) {
      state.itemCount += 1;

      document.documentElement.style.setProperty(`--color-${state.itemCount}`, '#cccccc');
      document.documentElement.style.setProperty(`--color-${state.itemCount}-a`, 'rgba(204,204,204,0.5)');

      const item = createLegendElement({ id: state.itemCount, name: val });
      const legendContainer = document.getElementById('legendContainer');
      const addButton = legendContainer?.querySelector('.btn-add-legend');
      if (addButton) legendContainer.insertBefore(item, addButton);
      else legendContainer?.appendChild(item);
    } else {
      const label = document.getElementById(state.currentLabelId);
      if (label) {
        label.innerText = val;
        label.closest('.legend-item')?.querySelector('.btn-delete-item')?.setAttribute('aria-label', `${val} 범례 삭제`);
      }
    }
  });

  state.isAdding = false;
  state.currentLabelId = '';
  state.isImeComposing = false;
  closeModal('nameModalOverlay');
}

function cancelNameModal() {
  state.isImeComposing = false;
  state.isAdding = false;
  state.currentLabelId = '';
  closeModal('nameModalOverlay');
}

function openDeleteConfirm(itemId, trigger) {
  state.pendingDeleteItemId = itemId;
  showModal('deleteModalOverlay', trigger);
}

function cancelDelete() {
  state.pendingDeleteItemId = null;
  closeModal('deleteModalOverlay');
}

function confirmDelete() {
  if (!state.pendingDeleteItemId) return;
  const itemId = state.pendingDeleteItemId;
  commitMutation('legend-delete', () => document.getElementById(itemId)?.remove());
  state.pendingDeleteItemId = null;
  closeModal('deleteModalOverlay');
}

function cancelUnified() {
  state.isImeComposing = false;
  state.unifiedEditingId = null;
  state.unifiedEditBefore = null;
  closeModal('unifiedModalOverlay');
}

function deleteUnifiedLegend() {
  if (!state.unifiedEditingId) return;
  const itemId = `item-${state.unifiedEditingId}`;
  commitMutation('legend-delete', () => document.getElementById(itemId)?.remove());
  state.unifiedEditingId = null;
  state.unifiedEditBefore = null;
  closeModal('unifiedModalOverlay');
}

/* --- INTERACTION HANDLERS --- */
function openCellMenu(target) {
  closeAllPopups();

  const menu = document.getElementById('cellMenu');
  if (!menu) return;

  menu.innerHTML = '';

  document.querySelectorAll('.legend-item').forEach(item => {
    const id = Number(item.id.split('-')[1]);
    const opt = document.createElement('div');
    opt.className = 'menu-option';
    opt.style.backgroundColor = `var(--color-${id}-a)`;
    opt.addEventListener('click', () => {
      if (state.activeCell) {
        commitMutation('cell-paint', () => {
          state.activeCell.style.backgroundColor = `var(--color-${id}-a)`;
        });
      }
      closeAllPopups();
    });
    menu.appendChild(opt);
  });

  const reset = document.createElement('div');
  reset.className = 'menu-reset';
  reset.innerText = '✕';
  reset.addEventListener('click', () => {
    if (state.activeCell) {
      commitMutation('cell-clear', () => {
        state.activeCell.style.backgroundColor = '';
      });
    }
    closeAllPopups();
  });
  menu.appendChild(reset);

  positionPopup(menu, target, false);
}

/* --- INIT / EVENT BINDINGS --- */
function initColorPicker() {
  const sbArea = document.getElementById('sbArea');
  const hueSlider = document.getElementById('hueSlider');
  const alphaSlider = document.getElementById('alphaSlider');

  if (!sbArea || !hueSlider) return;

  function getClientXY(e) {
    if (e.touches?.length) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function handleSB(e) {
    const rect = sbArea.getBoundingClientRect();
    const { x: cx, y: cy } = getClientXY(e);

    let x = Math.max(0, Math.min(rect.width, cx - rect.left));
    let y = Math.max(0, Math.min(rect.height, cy - rect.top));

    state.currentColor.s = (x / rect.width) * 100;
    state.currentColor.v = 100 - (y / rect.height) * 100;

    const cursor = document.getElementById('pickerCursor');
    if (cursor) {
      cursor.style.left = x + 'px';
      cursor.style.top = y + 'px';
    }

    updateColors();
  }

  // Mouse
  sbArea.addEventListener('mousedown', (e) => {
    handleSB(e);
    const move = (me) => handleSB(me);
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });

  // Touch
  sbArea.addEventListener('touchstart', (e) => {
    handleSB(e);
    const move = (me) => handleSB(me);
    const up = () => {
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', up);
      document.removeEventListener('touchcancel', up);
    };
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', up);
    document.addEventListener('touchcancel', up);
  }, { passive: false });

  hueSlider.addEventListener('input', (e) => {
    state.currentColor.h = e.target.value;
    updateColors();
  });

  if (alphaSlider) {
    alphaSlider.addEventListener('input', (e) => {
      state.currentColor.a = e.target.value;
      updateColors();
    });
  }
}

function initLegendDelegation() {
  const legendContainer = document.getElementById('legendContainer');
  if (!legendContainer) return;

  legendContainer.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.btn-add-legend');
    if (addBtn && legendContainer.contains(addBtn)) {
      openAddModal(addBtn);
      return;
    }

    const item = e.target.closest('.legend-item');
    if (item && legendContainer.contains(item)) {
        const id = Number(item.id.split('-')[1]);
        
        if (isMobile()) {
            openUnifiedModal(id, e.target);
        } else {
            if (e.target.closest('.circle-display')) openVisualPicker(e.target, id);
            else if (e.target.closest('.editable-label')) openNameModal(`label-${id}`, e.target);
            else if (e.target.closest('.btn-delete-item')) openDeleteConfirm(item.id, e.target);
        }
    }
  });
}

function initModalButtons() {
  const nameOverlay = document.getElementById('nameModalOverlay');
  if (nameOverlay) {
    nameOverlay.querySelector('.btn-cancel')?.addEventListener('click', cancelNameModal);
    nameOverlay.querySelector('.btn-save')?.addEventListener('click', saveName);
  }

  const delOverlay = document.getElementById('deleteModalOverlay');
  if (delOverlay) {
    delOverlay.querySelector('.btn-cancel')?.addEventListener('click', cancelDelete);
    document.getElementById('confirmDelBtn')?.addEventListener('click', confirmDelete);
  }

  const picker = document.getElementById('visualPickerPopup');
  picker?.querySelector('.btn-done')?.addEventListener('click', () => closeAllPopups({ commit: true }));
  document.getElementById('unifiedSaveBtn')?.addEventListener('click', saveUnified);
  document.getElementById('unifiedCancelBtn')?.addEventListener('click', cancelUnified);
  document.getElementById('unifiedDeleteBtn')?.addEventListener('click', deleteUnifiedLegend);

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('mousedown', (e) => {
          if (e.target === overlay) {
              if (overlay.id === 'nameModalOverlay') cancelNameModal();
              else if (overlay.id === 'deleteModalOverlay') cancelDelete();
              else if (overlay.id === 'unifiedModalOverlay') cancelUnified();
          }
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

function initKeyboardInteraction() {
  const nameInput = document.getElementById('nameInput');
  const unifiedNameInput = document.getElementById('unifiedNameInput');
  [nameInput, unifiedNameInput].forEach(input => {
    input?.addEventListener('compositionstart', () => { state.isImeComposing = true; });
    input?.addEventListener('compositionend', () => { state.isImeComposing = false; });
  });

  document.addEventListener('keydown', event => {
    const nameOverlay = document.getElementById('nameModalOverlay');
    const deleteOverlay = document.getElementById('deleteModalOverlay');
    const unifiedOverlay = document.getElementById('unifiedModalOverlay');
    const visualPicker = document.getElementById('visualPickerPopup');

    if (isVisible(nameOverlay)) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelNameModal();
      } else if (event.key === 'Enter' && !isImeEnter(event)) {
        event.preventDefault();
        saveName();
      }
      return;
    }

    if (isVisible(deleteOverlay)) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelDelete();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        confirmDelete();
      }
      return;
    }

    if (isVisible(unifiedOverlay)) {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelUnified();
      } else if (event.key === 'Enter' && !isImeEnter(event)) {
        event.preventDefault();
        saveUnified();
      }
      return;
    }

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
    const undoShortcut = commandKey && key === 'z' && !event.shiftKey;
    const redoShortcut = commandKey && ((key === 'z' && event.shiftKey) || (event.ctrlKey && key === 'y'));

    if (undoShortcut) {
      event.preventDefault();
      undoEdit();
    } else if (redoShortcut) {
      event.preventDefault();
      redoEdit();
    }
  });
}

function initGlobalInteraction() {
  // Open cell menu (paintable cells) + close popups on outside click
  document.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('paintable')) {
      state.activeCell = e.target;
      openCellMenu(e.target);
      return;
    }

    // click outside: close popups (but don't interfere with modal interaction)
    if (!e.target.closest('.ios-popup') &&
        !e.target.closest('#visualPickerPopup') &&
        !e.target.closest('.modal')) {
      closeAllPopups();
    }
  });

  // Text selection prevention (kept as-is)
  document.addEventListener('selectstart', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
  });

  document.addEventListener('dragstart', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault();
  });

  window.addEventListener('resize', handleViewportResize);
  window.visualViewport?.addEventListener('resize', handleViewportResize);
}


// Boot (script is loaded at end of body, but keep safe)
(function boot() {
  initColorPicker();
  initUnifiedColorPicker();
  initLegendDelegation();
  initModalButtons();
  initGlobalInteraction();
  initKeyboardInteraction();
  initHistoryControls();
  initExportControls();
})();
