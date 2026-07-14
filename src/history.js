import { createLegendElement } from './legend-dom.js';
import { state } from './state.js';

const HISTORY_LIMIT = 100;
const undoStack = [];
const redoStack = [];

export function captureEditableState() {
  const rootStyle = getComputedStyle(document.documentElement);
  const colors = [];

  for (let id = 1; id <= state.itemCount; id += 1) {
    colors.push({
      id,
      hex: rootStyle.getPropertyValue(`--color-${id}`).trim(),
      rgba: rootStyle.getPropertyValue(`--color-${id}-a`).trim()
    });
  }

  return {
    itemCount: state.itemCount,
    legends: [...document.querySelectorAll('.legend-item')].map(item => {
      const id = Number(item.id.split('-')[1]);
      return { id, name: document.getElementById(`label-${id}`)?.textContent ?? '' };
    }),
    colors,
    cells: [...document.querySelectorAll('.paintable')].map(cell => (
      cell.style.backgroundColor === 'transparent' ? '' : cell.style.backgroundColor
    ))
  };
}

export function restoreEditableState(snapshot) {
  const root = document.documentElement;
  const highestId = Math.max(state.itemCount, snapshot.itemCount);

  for (let id = 1; id <= highestId; id += 1) {
    root.style.removeProperty(`--color-${id}`);
    root.style.removeProperty(`--color-${id}-a`);
  }

  snapshot.colors.forEach(({ id, hex, rgba }) => {
    if (hex) root.style.setProperty(`--color-${id}`, hex);
    if (rgba) root.style.setProperty(`--color-${id}-a`, rgba);
  });

  state.itemCount = snapshot.itemCount;
  const legendContainer = document.getElementById('legendContainer');
  const addButton = legendContainer?.querySelector('.btn-add-legend');
  legendContainer?.querySelectorAll('.legend-item').forEach(item => item.remove());
  snapshot.legends.forEach(legend => {
    const item = createLegendElement(legend);
    if (addButton) legendContainer.insertBefore(item, addButton);
    else legendContainer?.appendChild(item);
  });

  document.querySelectorAll('.paintable').forEach((cell, index) => {
    cell.style.backgroundColor = snapshot.cells[index] ?? '';
  });
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
  mutate();
  recordHistory(type, before);
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
