import { hexToRgb } from './color.js?v=20260810-4';
import { createLegendElement, updateLegendElement } from './legend-dom.js?v=20260810-4';
import { NAME_GROUP_COUNT, getEditableState } from './model.js?v=20260810-4';

const LEGEND_EXIT_FALLBACK_MS = 150;
const legendEntryFrames = new WeakMap();
const legendRemovalTimers = new WeakMap();
let hasRenderedLegends = false;
let tableStructure = null;

function captureTableStructure(table) {
  const headerRow = table.tHead?.rows[0];
  const bodyRows = Array.from(table.tBodies[0]?.rows ?? []);
  if (!headerRow || bodyRows.length !== NAME_GROUP_COUNT) return null;

  const headerCells = Array.from(headerRow.cells);
  if (headerCells.length !== NAME_GROUP_COUNT + 1) return null;

  const rows = bodyRows.map((row, rowIndex) => {
    const cells = Array.from(row.cells);
    if (cells.length !== NAME_GROUP_COUNT + 1) return null;

    row.dataset.rowIndex = String(rowIndex);
    cells.slice(1).forEach((cell, columnIndex) => {
      cell.dataset.columnIndex = String(columnIndex);
    });
    return {
      row,
      nameCell: cells[0],
      cells: cells.slice(1)
    };
  });
  if (rows.some(row => row == null)) return null;

  return {
    table,
    headerRow,
    cornerCell: headerCells[0],
    columnHeaders: headerCells.slice(1),
    rows,
    renderedColumnKey: null
  };
}

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

  if (!tableStructure || tableStructure.table !== table) {
    tableStructure = captureTableStructure(table);
  }
  if (!tableStructure) return;

  const deletedRowIndexes = new Set(deletedRows);
  const deletedColumnIndexes = new Set(deletedColumns);
  const visibleColumnIndexes = Array.from(
    { length: NAME_GROUP_COUNT },
    (_, index) => index
  ).filter(index => !deletedColumnIndexes.has(index));

  const columnKey = visibleColumnIndexes.join(',');
  if (tableStructure.renderedColumnKey !== columnKey) {
    tableStructure.headerRow.replaceChildren(
      tableStructure.cornerCell,
      ...visibleColumnIndexes.map(index => tableStructure.columnHeaders[index])
    );
    tableStructure.rows.forEach(({ row, nameCell, cells }) => {
      row.replaceChildren(
        nameCell,
        ...visibleColumnIndexes.map(index => cells[index])
      );
    });
    tableStructure.renderedColumnKey = columnKey;
  }
  tableStructure.rows.forEach(({ row }, rowIndex) => {
    row.hidden = deletedRowIndexes.has(rowIndex);
  });

  const visibleColumnCount = visibleColumnIndexes.length;
  const visibleRowCount = NAME_GROUP_COUNT - deletedRowIndexes.size;
  chartFrame.style.setProperty(
    '--visible-table-column-count',
    String(visibleColumnCount + 1)
  );
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
  const table = document.getElementById('rpsTable');
  tableStructure = table ? captureTableStructure(table) : null;
}

export function renderApp() {
  renderLegends();
  renderTableStructure();
  renderColors();
}
