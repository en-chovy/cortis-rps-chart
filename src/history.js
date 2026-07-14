import { cloneEditableState, getEditableState, replaceEditableState } from './model.js';

const HISTORY_LIMIT = 100;
const undoStack = [];
const redoStack = [];
let render = () => {};

export function configureHistory({ renderApp }) {
  render = renderApp;
}

export function captureEditableState() {
  return cloneEditableState();
}

export function restoreEditableState(snapshot) {
  replaceEditableState(snapshot);
  render();
}

function updateControls() {
  const undoButton = document.getElementById('undoButton');
  const redoButton = document.getElementById('redoButton');
  if (undoButton) undoButton.disabled = undoStack.length === 0;
  if (redoButton) redoButton.disabled = redoStack.length === 0;
}

export function recordHistory(type, before, after = captureEditableState()) {
  if (JSON.stringify(before) === JSON.stringify(after)) return false;

  undoStack.push({ type, before, after });
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack.length = 0;
  updateControls();
  return true;
}

export function commitMutation(type, mutate) {
  const before = captureEditableState();
  mutate(getEditableState());
  const after = captureEditableState();
  if (JSON.stringify(before) === JSON.stringify(after)) return false;
  render();
  return recordHistory(type, before, after);
}

export function undoEdit() {
  const entry = undoStack.pop();
  if (!entry) return;
  restoreEditableState(entry.before);
  redoStack.push(entry);
  updateControls();
}

export function redoEdit() {
  const entry = redoStack.pop();
  if (!entry) return;
  restoreEditableState(entry.after);
  undoStack.push(entry);
  updateControls();
}

export function initHistoryControls() {
  document.getElementById('undoButton')?.addEventListener('click', undoEdit);
  document.getElementById('redoButton')?.addEventListener('click', redoEdit);
  updateControls();
}
