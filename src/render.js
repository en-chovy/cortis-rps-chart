import { hexToRgb } from './color.js?v=20260810-1';
import { createLegendElement, updateLegendElement } from './legend-dom.js?v=20260810-1';
import { NAME_GROUP_COUNT, getEditableState } from './model.js?v=20260810-1';

const LEGEND_EXIT_FALLBACK_MS = 150;
const legendEntryFrames = new WeakMap();
const legendRemovalTimers = new WeakMap();
let hasRenderedLegends = false;

function colorToRgba({ hex, alpha }) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function renderColors() {
  const { colors, cells, ghostCells } = getEditableState();
  const root = document.documentElement;

  Object.entries(colors).forEach(([id, color]) => {
    root.style.setProperty(`--color-${id}`, color.hex);
    root.style.setProperty(`--color-${id}-a`, colorToRgba(color));
  });

  document.querySelectorAll('.paintable').forEach(cell => {
    const cellIndex = Number(cell.dataset.cellIndex);
    const legendId = cells[cellIndex];
    cell.style.backgroundColor = legendId == null ? '' : `var(--color-${legendId}-a)`;
    cell.classList.toggle('is-ghost', ghostCells[cellIndex] === true);
  });
}

export function renderTableStructure() {
  const { deletedRows, deletedColumns } = getEditableState();
  const table = document.getElementById('rpsTable');
  const chartFrame = document.querySelector('.chart-frame');
  if (!table || !chartFrame) return;

  const deletedRowIndexes = new Set(deletedRows);
  const deletedColumnIndexes = new Set(deletedColumns);
  const columnHeaders = table.querySelectorAll(
    '.paintable-name[data-axis="column"][data-group-index]'
  );
  columnHeaders.forEach(header => {
    header.hidden = deletedColumnIndexes.has(Number(header.dataset.groupIndex));
  });

  Array.from(table.tBodies[0]?.rows ?? []).forEach((row, rowIndex) => {
    row.hidden = deletedRowIndexes.has(rowIndex);
    Array.from(row.cells).slice(1).forEach((cell, columnIndex) => {
      cell.hidden = deletedColumnIndexes.has(columnIndex);
    });
  });

  const visibleColumnCount = NAME_GROUP_COUNT - deletedColumnIndexes.size;
  const visibleRowCount = NAME_GROUP_COUNT - deletedRowIndexes.size;
  chartFrame.style.width = `calc(var(--cell-width) * ${visibleColumnCount + 1})`;
  table.setAttribute('aria-colcount', String(visibleColumnCount + 1));
  table.setAttribute('aria-rowcount', String(visibleRowCount + 1));
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function cancelLegendEntry(item) {
  const frame = legendEntryFrames.get(item);
  if (frame) cancelAnimationFrame(frame);
  legendEntryFrames.delete(item);
  item.classList.remove('is-entering');
}

function cancelLegendRemoval(item) {
  const timer = legendRemovalTimers.get(item);
  if (timer) clearTimeout(timer);
  legendRemovalTimers.delete(item);
  item.classList.remove('is-leaving');
  item.removeAttribute('aria-hidden');
}

function animateLegendEntry(item) {
  if (prefersReducedMotion()) return;
  item.classList.add('is-entering');
  const frame = requestAnimationFrame(() => {
    legendEntryFrames.delete(item);
    if (item.isConnected) item.classList.remove('is-entering');
  });
  legendEntryFrames.set(item, frame);
}

function removeLegendItem(item) {
  cancelLegendEntry(item);
  if (prefersReducedMotion()) {
    item.remove();
    return;
  }
  if (legendRemovalTimers.has(item)) return;

  item.classList.add('is-leaving');
  item.setAttribute('aria-hidden', 'true');
  const timer = setTimeout(() => {
    legendRemovalTimers.delete(item);
    item.remove();
  }, LEGEND_EXIT_FALLBACK_MS);
  legendRemovalTimers.set(item, timer);
}

export function renderLegends() {
  const { legends } = getEditableState();
  const container = document.getElementById('legendContainer');
  if (!container) return;

  const addButton = container.querySelector('.btn-add-legend');
  const existingItems = new Map(
    Array.from(container.querySelectorAll('.legend-item')).map(item => (
      [Number(item.dataset.legendId), item]
    ))
  );

  legends.forEach((legend, index) => {
    let item = existingItems.get(legend.id);
    const isNew = !item;

    if (item) {
      existingItems.delete(legend.id);
      cancelLegendRemoval(item);
      updateLegendElement(item, legend);
    } else {
      item = createLegendElement(legend);
      const nextItem = legends.slice(index + 1)
        .map(nextLegend => existingItems.get(nextLegend.id))
        .find(candidate => candidate?.isConnected);
      container.insertBefore(item, nextItem ?? addButton);
    }

    if (isNew && hasRenderedLegends) animateLegendEntry(item);
  });

  existingItems.forEach(item => {
    if (hasRenderedLegends) removeLegendItem(item);
    else item.remove();
  });
  hasRenderedLegends = true;
}

export function initializeCells() {
  document.querySelectorAll('.paintable').forEach((cell, index) => {
    cell.dataset.cellIndex = String(index);
  });
}

export function renderApp() {
  renderLegends();
  renderTableStructure();
  renderColors();
}
