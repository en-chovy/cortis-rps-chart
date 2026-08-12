import { hexToRgb, rgbToHsv, toColorValues } from './src/color.js?v=20260812-1';
import { createColorPicker } from './src/color-picker.js?v=20260812-1';
import { initExportControls } from './src/export.js?v=20260812-1';
import {
  captureEditableState,
  clearHistory,
  commitMutation,
  configureHistory,
  initHistoryControls,
  redoEdit,
  undoEdit
} from './src/history.js?v=20260812-1';
import {
  applyDocumentTranslations,
  getLanguage,
  getLocalizedLegendName,
  initializeLanguage,
  setLanguage,
  t
} from './src/i18n.js?v=20260812-1';
import {
  addLegend,
  createInitialEditableState,
  deleteNameGroup,
  deleteLegend,
  getEditableState,
  getLegend,
  getLegendColor,
  paintCell,
  paintNameGroup,
  renameLegend,
  replaceEditableState,
  restoreAllNameGroups,
  restoreNameGroup,
  setLegendColor,
  toggleGhostCell
} from './src/model.js?v=20260812-1';
import {
  LEGEND_NAME_MAX_LENGTH,
  limitLegendName
} from './src/legend-name.js?v=20260812-1';
import {
  clearEditableState,
  loadEditableSession,
  saveEditableSession
} from './src/persistence.js?v=20260812-1';
import {
  getNameGroupName,
  initializeCells,
  renderApp,
  renderColors
} from './src/render.js?v=20260812-1';
import { state } from './src/state.js?v=20260812-1';
import {
  closeAllPopups,
  closeModal,
  closeVisualPicker,
  handleViewportResize,
  positionPopup,
  showModal
} from './src/ui.js?v=20260812-1';

let desktopPicker = null;
let unifiedPicker = null;
const NAME_LIMIT_FEEDBACK_DURATION = 1500;
const nameLimitFeedbackTimers = new WeakMap();
let restoreDeletedTrigger = null;

function getRestoreGroupName(axis, index) {
  const localizedName = t(`restore.group.${axis}.${index}`);
  return localizedName.startsWith('restore.group.')
    ? getNameGroupName(index)
    : localizedName;
}

function getDeletedGroupCount() {
  const { deletedRows, deletedColumns } = getEditableState();
  return deletedRows.length + deletedColumns.length;
}

function createRestoreGroupSection(title, axis, indexes) {
  const section = document.createElement('section');
  section.className = 'restore-group-section';
  const heading = document.createElement('h4');
  heading.textContent = title;
  section.appendChild(heading);

  const items = document.createElement('div');
  items.className = 'restore-group-items';
  indexes.forEach(index => {
    const name = getRestoreGroupName(axis, index);
    const item = document.createElement('div');
    item.className = 'restore-group-item';

    const label = document.createElement('span');
    label.className = 'restore-group-name';
    label.textContent = name;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'restore-group-item-button';
    button.dataset.axis = axis;
    button.dataset.groupIndex = String(index);
    button.textContent = t('common.restore');
    button.setAttribute('aria-label', `${name} 복구`);
    item.append(label, button);
    items.appendChild(item);
  });
  section.appendChild(items);
  return section;
}

function renderRestoreDeletedModal() {
  const list = document.getElementById('restoreDeletedList');
  if (!list) return;
  const { deletedRows, deletedColumns } = getEditableState();
  const sections = [];
  if (deletedColumns.length > 0) {
    sections.push(createRestoreGroupSection(t('restore.deletedTop'), 'column', deletedColumns));
  }
  if (deletedRows.length > 0) {
    sections.push(createRestoreGroupSection(t('restore.deletedBottom'), 'row', deletedRows));
  }

  if (sections.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'restore-groups-empty';
    empty.textContent = t('restore.empty');
    list.replaceChildren(empty);
  } else {
    list.replaceChildren(...sections);
  }
  const restoreAllButton = document.getElementById('restoreAllDeletedBtn');
  if (restoreAllButton) restoreAllButton.disabled = sections.length === 0;
}

function updateRestoreDeletedControl() {
  const button = document.getElementById('restoreDeletedButton');
  const badge = document.getElementById('restoreDeletedCount');
  if (!button || !badge) return;
  const deletedCount = getDeletedGroupCount();
  button.disabled = deletedCount === 0;
  button.setAttribute(
    'aria-label',
    deletedCount === 0
      ? '복구할 삭제한 왼이나 른 없음'
      : `삭제한 왼과 른 ${deletedCount}개 복구`
  );
  badge.textContent = String(deletedCount);
  badge.hidden = deletedCount === 0;

  const overlay = document.getElementById('restoreDeletedModalOverlay');
  if (overlay && isVisible(overlay)) renderRestoreDeletedModal();
}

function renderApplication() {
  renderApp();
  updateRestoreDeletedControl();
}

function updateLanguageSelection() {
  const activeLanguage = getLanguage();
  document.querySelectorAll('#languageMenu .language-option').forEach(option => {
    option.setAttribute('aria-checked', String(option.dataset.language === activeLanguage));
  });
}

function setLanguageMenuOpen(isOpen, { focusCurrent = false } = {}) {
  const button = document.getElementById('languageButton');
  const menu = document.getElementById('languageMenu');
  if (!button || !menu) return;
  menu.hidden = !isOpen;
  button.setAttribute('aria-expanded', String(isOpen));
  if (isOpen && focusCurrent) {
    menu.querySelector(`[data-language="${getLanguage()}"]`)?.focus();
  }
}

function applySelectedLanguage() {
  applyDocumentTranslations();
  renderApplication();
  updateLanguageSelection();
  const restoreOverlay = document.getElementById('restoreDeletedModalOverlay');
  if (restoreOverlay && isVisible(restoreOverlay)) renderRestoreDeletedModal();
}

function initLanguageControls() {
  const control = document.querySelector('.language-control');
  const button = document.getElementById('languageButton');
  const menu = document.getElementById('languageMenu');
  if (!control || !button || !menu) return;

  updateLanguageSelection();
  button.addEventListener('click', () => {
    setLanguageMenuOpen(menu.hidden, { focusCurrent: menu.hidden });
  });
  menu.addEventListener('click', event => {
    if (event.target.closest('.language-request')) {
      setLanguageMenuOpen(false);
      openContact({ localizationEntry: true });
      return;
    }
    const option = event.target.closest('.language-option');
    if (!option || !setLanguage(option.dataset.language)) return;
    applySelectedLanguage();
    setLanguageMenuOpen(false);
    button.focus({ preventScroll: true });
  });
  control.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || menu.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    setLanguageMenuOpen(false);
    button.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', event => {
    if (!control.contains(event.target)) setLanguageMenuOpen(false);
  });
}

function getNameError(input) {
  const errorId = input?.getAttribute('aria-describedby');
  return errorId ? document.getElementById(errorId) : null;
}

function clearNameLimitError(input, { cancelTimer = true } = {}) {
  if (!input) return;
  if (cancelTimer) {
    const timer = nameLimitFeedbackTimers.get(input);
    if (timer) clearTimeout(timer);
    nameLimitFeedbackTimers.delete(input);
  }

  input.removeAttribute('aria-invalid');
  input.classList.remove('has-error', 'is-limit-hit');
  const error = getNameError(input);
  if (error) {
    error.classList.remove('is-visible');
    error.setAttribute('aria-hidden', 'true');
  }
}

function showNameLimitError(input) {
  if (!input) return;
  const currentTimer = nameLimitFeedbackTimers.get(input);
  if (currentTimer) clearTimeout(currentTimer);

  input.setAttribute('aria-invalid', 'true');
  input.classList.add('has-error');
  input.classList.remove('is-limit-hit');
  void input.offsetWidth;
  input.classList.add('is-limit-hit');
  const error = getNameError(input);
  if (error) {
    error.classList.add('is-visible');
    error.setAttribute('aria-hidden', 'false');
  }

  const timer = setTimeout(() => {
    clearNameLimitError(input, { cancelTimer: false });
    nameLimitFeedbackTimers.delete(input);
  }, NAME_LIMIT_FEEDBACK_DURATION);
  nameLimitFeedbackTimers.set(input, timer);
}

function enforceNameLimit(input) {
  if (!input) return false;
  const limited = limitLegendName(input.value);
  if (limited.wasTruncated) {
    input.value = limited.value;
    showNameLimitError(input);
    return true;
  }

  if (limited.length < LEGEND_NAME_MAX_LENGTH) clearNameLimitError(input);
  return false;
}

function prepareNameInput(input, value) {
  if (!input) return;
  input.value = value;
  clearNameLimitError(input);
}

function usesUnifiedLegendEditor() {
  return window.innerWidth <= 480
    || window.matchMedia('(hover: none), (pointer: coarse)').matches;
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
    preview: document.getElementById('colorPreview'),
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
    cursor: document.getElementById('unifiedPickerCursor'),
    preview: document.getElementById('unifiedColorPreview')
  });
}

function openVisualPicker(target, id) {
  const color = getLegendColor(id);
  if (!color || !desktopPicker) return;

  closeAllPopups({ commit: true });
  state.editingId = Number(id);
  state.visualPickerSession = {
    before: captureEditableState()
  };
  document.documentElement.classList.add('is-adjusting-color');

  const popup = document.getElementById('visualPickerPopup');
  positionPopup(popup, target, true);
  desktopPicker.setValue(toPickerColor(color));
}

function openUnifiedModal(id) {
  const legend = getLegend(id);
  const color = getLegendColor(id);
  if (!legend || !color || !unifiedPicker) return;

  closeAllPopups({ commit: true });
  state.unifiedEditingId = Number(id);
  prepareNameInput(
    document.getElementById('unifiedNameInput'),
    getLocalizedLegendName(legend)
  );
  showModal('unifiedModalOverlay');
  unifiedPicker.setValue(toPickerColor(color));
}

function saveUnified() {
  const input = document.getElementById('unifiedNameInput');
  enforceNameLimit(input);
  const name = input.value.trim();
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

function openNameModal(id) {
  const legend = getLegend(id);
  if (!legend) return;

  state.isAdding = false;
  state.nameEditingId = Number(id);
  const modalTitle = document.getElementById('modalTitle');
  modalTitle.dataset.i18n = 'category.renameTitle';
  modalTitle.textContent = t('category.renameTitle');
  const input = document.getElementById('nameInput');
  prepareNameInput(input, getLocalizedLegendName(legend));
  showModal('nameModalOverlay');
  requestAnimationFrame(() => input.focus());
}

function openAddModal() {
  state.isAdding = true;
  state.nameEditingId = null;
  const modalTitle = document.getElementById('modalTitle');
  modalTitle.dataset.i18n = 'category.addTitle';
  modalTitle.textContent = t('category.addTitle');
  const input = document.getElementById('nameInput');
  prepareNameInput(input, '');
  showModal('nameModalOverlay');
  requestAnimationFrame(() => input.focus());
}

function saveName() {
  const input = document.getElementById('nameInput');
  enforceNameLimit(input);
  const name = input.value.trim();
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

function openDeleteConfirm(id) {
  state.pendingDeleteItemId = Number(id);
  showModal('deleteModalOverlay');
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

function openResetConfirm() {
  showModal('resetModalOverlay');
}

function cancelReset() {
  closeModal('resetModalOverlay');
}

function openContact({ localizationEntry = false } = {}) {
  const overlay = document.getElementById('contactModalOverlay');
  overlay?.classList.toggle('is-localization-entry', localizationEntry);
  showModal('contactModalOverlay');
  if (localizationEntry) {
    requestAnimationFrame(() => {
      document.getElementById('contactXLink')?.focus({ preventScroll: true });
    });
  }
}

function closeContact() {
  closeModal('contactModalOverlay');
}

function confirmReset() {
  replaceEditableState(createInitialEditableState());
  renderApplication();
  clearHistory();
  clearEditableState();
  closeModal('resetModalOverlay');
}

function openRestoreDeleted() {
  if (getDeletedGroupCount() === 0) return;
  restoreDeletedTrigger = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : document.getElementById('restoreDeletedButton');
  renderRestoreDeletedModal();
  showModal('restoreDeletedModalOverlay');
  requestAnimationFrame(() => {
    document.querySelector('#restoreDeletedModalOverlay .restore-group-item-button')?.focus();
  });
}

function closeRestoreDeleted() {
  closeModal('restoreDeletedModalOverlay');
  const fallback = document.getElementById('undoButton');
  const focusTarget = restoreDeletedTrigger && !restoreDeletedTrigger.disabled
    ? restoreDeletedTrigger
    : fallback;
  restoreDeletedTrigger = null;
  focusTarget?.focus({ preventScroll: true });
}

function announceRestoredGroup(message) {
  const status = document.getElementById('restoreDeletedStatus');
  if (!status) return;
  status.textContent = '';
  requestAnimationFrame(() => { status.textContent = message; });
}

function restoreDeletedGroup(axis, index) {
  const name = getRestoreGroupName(axis, index);
  const didRestore = commitMutation(`${axis}-restore`, () => restoreNameGroup(axis, index));
  if (!didRestore) return;
  announceRestoredGroup(`${name}을 복구했습니다.`);
  requestAnimationFrame(() => {
    const nextButton = document.querySelector(
      '#restoreDeletedModalOverlay .restore-group-item-button'
    );
    (nextButton ?? document.getElementById('closeRestoreDeletedBtn'))?.focus();
  });
}

function restoreEveryDeletedGroup() {
  const deletedCount = getDeletedGroupCount();
  if (deletedCount === 0) return;
  commitMutation('groups-restore-all', restoreAllNameGroups);
  announceRestoredGroup(`삭제한 왼과 른 ${deletedCount}개를 모두 복구했습니다.`);
  closeRestoreDeleted();
}

function closeCellMenu() {
  closeAllPopups({ commit: true });
  state.activeCell = null;
  state.activeCellIndex = null;
  state.activeNameGroup = null;
}

function appendMenuDivider(menu) {
  const divider = document.createElement('span');
  divider.className = 'menu-divider';
  divider.setAttribute('aria-hidden', 'true');
  menu.appendChild(divider);
}

function appendVisibilityIcon(button, isGhost) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const eye = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  eye.setAttribute('d', 'M2.75 12s3.35-5.75 9.25-5.75S21.25 12 21.25 12 17.9 17.75 12 17.75 2.75 12 2.75 12Z');
  const pupil = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  pupil.setAttribute('cx', '12');
  pupil.setAttribute('cy', '12');
  pupil.setAttribute('r', '2.5');
  svg.append(eye, pupil);

  if (isGhost) {
    const slashBackdrop = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    slashBackdrop.setAttribute('d', 'M4 4l16 16');
    slashBackdrop.classList.add('visibility-slash-backdrop');
    const slash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    slash.setAttribute('d', 'M4 4l16 16');
    slash.classList.add('visibility-slash');
    svg.append(slashBackdrop, slash);
  }
  button.appendChild(svg);
}

function openCellMenu(target) {
  closeAllPopups({ commit: true });
  const menu = document.getElementById('cellMenu');
  if (!menu || (state.activeCellIndex == null && state.activeNameGroup == null)) return;
  menu.replaceChildren();
  const isNameGroup = state.activeNameGroup !== null;
  const targetName = target.textContent.trim();
  const targetType = isNameGroup
    ? (state.activeNameGroup.axis === 'row' ? '행' : '열')
    : '셀';
  menu.setAttribute('role', 'group');
  menu.setAttribute('aria-label', `${targetName} ${targetType} 설정`);

  getEditableState().legends.forEach(legend => {
    const option = document.createElement('div');
    option.className = 'menu-option';
    option.style.backgroundColor = `var(--color-${legend.id}-a)`;
    option.addEventListener('click', () => {
      commitMutation('cell-paint', () => paintActiveTarget(legend.id));
      closeCellMenu();
    });
    menu.appendChild(option);
  });

  const reset = document.createElement('div');
  reset.className = 'menu-reset';
  reset.textContent = '✕';
  reset.addEventListener('click', () => {
    commitMutation('cell-clear', () => paintActiveTarget(null));
    closeCellMenu();
  });
  menu.appendChild(reset);

  appendMenuDivider(menu);

  if (state.activeCellIndex != null) {
    const cellIndex = state.activeCellIndex;
    const isGhost = getEditableState().ghostCells[cellIndex] === true;
    const ghostToggle = document.createElement('button');
    const ghostAction = isGhost ? t('cell.showLabel') : t('cell.hideLabel');
    ghostToggle.type = 'button';
    ghostToggle.className = 'menu-icon-action menu-ghost-toggle';
    ghostToggle.classList.toggle('is-active', isGhost);
    ghostToggle.setAttribute('aria-label', `${targetName} 고스트 셀`);
    ghostToggle.setAttribute('aria-pressed', String(isGhost));
    ghostToggle.title = ghostAction;
    appendVisibilityIcon(ghostToggle, isGhost);
    ghostToggle.addEventListener('click', () => {
      commitMutation('cell-ghost', () => toggleGhostCell(cellIndex));
      closeCellMenu();
    });
    menu.appendChild(ghostToggle);
  } else {
    const { axis, index } = state.activeNameGroup;
    const axisLabel = axis === 'row' ? '행' : '열';
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'menu-delete-group';
    deleteButton.textContent = t('common.delete');
    deleteButton.setAttribute('aria-label', `${targetName} ${axisLabel} 삭제`);
    deleteButton.addEventListener('click', () => {
      commitMutation(`${axis}-delete`, () => deleteNameGroup(axis, index));
      closeCellMenu();
    });
    menu.appendChild(deleteButton);
  }

  positionPopup(menu, target, false);
}

function paintActiveTarget(legendId) {
  if (state.activeNameGroup) {
    paintNameGroup(state.activeNameGroup.axis, state.activeNameGroup.index, legendId);
  } else if (state.activeCellIndex != null) {
    paintCell(state.activeCellIndex, legendId);
  }
}

function initLegendDelegation() {
  const container = document.getElementById('legendContainer');
  if (!container) return;

  container.addEventListener('click', event => {
    const addButton = event.target.closest('.btn-add-legend');
    if (addButton && container.contains(addButton)) {
      openAddModal();
      return;
    }

    const item = event.target.closest('.legend-item');
    if (!item || !container.contains(item)) return;
    const id = Number(item.id.split('-')[1]);

    if (event.target.closest('.btn-delete-item')) {
      openDeleteConfirm(id);
    } else if (usesUnifiedLegendEditor()) {
      openUnifiedModal(id);
    } else if (event.target.closest('.circle-display')) {
      openVisualPicker(event.target, id);
    } else if (event.target.closest('.editable-label')) {
      openNameModal(id);
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
  document.getElementById('resetButton')?.addEventListener('click', openResetConfirm);
  document.getElementById('cancelResetBtn')?.addEventListener('click', cancelReset);
  document.getElementById('confirmResetBtn')?.addEventListener('click', confirmReset);
  document.getElementById('restoreDeletedButton')?.addEventListener('click', openRestoreDeleted);
  document.getElementById('closeRestoreDeletedBtn')?.addEventListener('click', closeRestoreDeleted);
  document.getElementById('restoreAllDeletedBtn')?.addEventListener('click', restoreEveryDeletedGroup);
  document.getElementById('contactButton')?.addEventListener('click', () => openContact());
  document.getElementById('closeContactBtn')?.addEventListener('click', closeContact);
  document.getElementById('restoreDeletedList')?.addEventListener('click', event => {
    const button = event.target.closest('.restore-group-item-button');
    if (!button) return;
    restoreDeletedGroup(button.dataset.axis, Number(button.dataset.groupIndex));
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('pointerdown', event => {
      if (event.target !== overlay) return;
      if (overlay.id === 'nameModalOverlay') cancelNameModal();
      else if (overlay.id === 'deleteModalOverlay') cancelDelete();
      else if (overlay.id === 'unifiedModalOverlay') cancelUnified();
      else if (overlay.id === 'resetModalOverlay') cancelReset();
      else if (overlay.id === 'restoreDeletedModalOverlay') closeRestoreDeleted();
      else if (overlay.id === 'contactModalOverlay') closeContact();
    });
  });
}

function isVisible(element) {
  return Boolean(
    element
    && !element.classList.contains('is-closing')
    && getComputedStyle(element).display !== 'none'
  );
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

function isPlainKey(event, key) {
  return event.key === key
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.shiftKey;
}

function handleModalKeyboard(event, overlay, { cancel, save }) {
  if (!isVisible(overlay)) return false;
  if (isPlainKey(event, 'Escape')) {
    event.preventDefault();
    cancel();
  } else if (
    save
    && isPlainKey(event, 'Enter')
    && !isImeEnter(event)
    && !(event.target instanceof Element && event.target.closest('button'))
  ) {
    event.preventDefault();
    save();
  }
  return true;
}

function handleRestoreDeletedKeyboard(event) {
  const overlay = document.getElementById('restoreDeletedModalOverlay');
  if (!isVisible(overlay)) return false;
  if (isPlainKey(event, 'Escape')) {
    event.preventDefault();
    closeRestoreDeleted();
    return true;
  }

  if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey && !event.altKey) {
    const focusable = Array.from(overlay.querySelectorAll('button:not(:disabled)'))
      .filter(button => button.getClientRects().length > 0);
    if (focusable.length > 0) {
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  return true;
}

function initKeyboardInteraction() {
  [document.getElementById('nameInput'), document.getElementById('unifiedNameInput')].forEach(input => {
    input?.addEventListener('compositionstart', () => { state.isImeComposing = true; });
    input?.addEventListener('compositionend', () => {
      state.isImeComposing = false;
      enforceNameLimit(input);
    });
    input?.addEventListener('input', event => {
      if (!event.isComposing && !state.isImeComposing) enforceNameLimit(input);
    });
    input?.addEventListener('animationend', () => input.classList.remove('is-limit-hit'));
  });

  document.addEventListener('keydown', event => {
    if (handleRestoreDeletedKeyboard(event)) return;
    if (handleModalKeyboard(event, document.getElementById('nameModalOverlay'), {
      cancel: cancelNameModal,
      save: saveName
    })) return;
    if (handleModalKeyboard(event, document.getElementById('deleteModalOverlay'), {
      cancel: cancelDelete
    })) return;
    if (handleModalKeyboard(event, document.getElementById('unifiedModalOverlay'), {
      cancel: cancelUnified,
      save: saveUnified
    })) return;
    if (handleModalKeyboard(event, document.getElementById('resetModalOverlay'), {
      cancel: cancelReset
    })) return;
    if (handleModalKeyboard(event, document.getElementById('contactModalOverlay'), {
      cancel: closeContact
    })) return;
    const visualPicker = document.getElementById('visualPickerPopup');
    if (isVisible(visualPicker)) {
      if (isPlainKey(event, 'Escape')) {
        event.preventDefault();
        closeVisualPicker({ commit: false });
      } else if (isPlainKey(event, 'Enter')) {
        event.preventDefault();
        closeVisualPicker({ commit: true });
      }
      return;
    }

    const cellMenu = document.getElementById('cellMenu');
    if (isVisible(cellMenu)) {
      if (isPlainKey(event, 'Escape')) {
        event.preventDefault();
        closeAllPopups({ commit: true });
      }
      return;
    }

    if (isTextEditingTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const commandKey = event.metaKey !== event.ctrlKey;
    if (commandKey && !event.altKey && key === 'z' && !event.shiftKey) {
      event.preventDefault();
      undoEdit();
    } else if (commandKey && !event.altKey && key === 'z' && event.shiftKey) {
      event.preventDefault();
      redoEdit();
    }
  });
}

function initGlobalInteraction() {
  document.addEventListener('pointerdown', event => {
    const nameCell = event.target.closest('.paintable-name');
    if (nameCell) {
      state.activeCell = nameCell;
      state.activeCellIndex = null;
      state.activeNameGroup = {
        axis: nameCell.dataset.axis,
        index: Number(nameCell.dataset.groupIndex)
      };
      openCellMenu(nameCell);
      return;
    }

    const cell = event.target.closest('.paintable');
    if (cell) {
      state.activeCell = cell;
      state.activeCellIndex = Number(cell.dataset.cellIndex);
      state.activeNameGroup = null;
      openCellMenu(cell);
      return;
    }

    if (!event.target.closest('.ios-popup, .modal')) {
      closeAllPopups({ commit: true });
    }
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
  initializeLanguage();
  applyDocumentTranslations();
  try {
    const persistedSession = loadEditableSession();
    if (persistedSession) replaceEditableState(persistedSession.editableState);

    initializeCells();
    configureHistory({
      renderApp: renderApplication,
      persistEditableSession: saveEditableSession,
      initialHistory: persistedSession?.history
    });
    renderApplication();
  } finally {
    document.documentElement.classList.remove('is-restoring-chart-state');
  }

  initColorPickers();
  initLanguageControls();
  initLegendDelegation();
  initModalButtons();
  initGlobalInteraction();
  initKeyboardInteraction();
  initHistoryControls();
  initExportControls();
})();
