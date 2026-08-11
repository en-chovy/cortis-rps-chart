import { hexToRgb } from './color.js?v=20260811-1';
import { createLegendElement, updateLegendElement } from './legend-dom.js?v=20260811-1';
import { NAME_GROUP_COUNT, getEditableState } from './model.js?v=20260811-1';

const LEGEND_EXIT_FALLBACK_MS = 150;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const TABLE_GRID_COLOR = '#333';
const TABLE_GRID_STROKE_WIDTH = 2 / 3;
const legendEntryFrames = new WeakMap();
const legendRemovalTimers = new WeakMap();
let hasRenderedLegends = false;
let tableStructure = null;
let tableGridResizeObserver = null;
let observedTableGridFrame = null;
let tableGridAnimationFrame = 0;
let hasTableGridViewportListeners = false;

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
    groupNames: headerCells.slice(1).map(cell => cell.textContent.trim()),
    renderedColumnKey: null
  };
}

function colorToRgba({ hex, alpha }) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function createSvgElement(name) {
  return document.createElementNS(SVG_NAMESPACE, name);
}

function formatGridCoordinate(value) {
  return String(Number(value.toFixed(6)));
}

function getTableGridOverlay(chartFrame) {
  let overlay = Array.from(chartFrame.children).find(child => (
    child.classList.contains('table-grid-overlay')
  ));
  if (overlay) return overlay;

  overlay = createSvgElement('svg');
  overlay.classList.add('table-grid-overlay');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('focusable', 'false');
  overlay.setAttribute('preserveAspectRatio', 'none');
  overlay.style.pointerEvents = 'none';
  chartFrame.appendChild(overlay);
  return overlay;
}

function renderTableGridOverlay() {
  const table = document.getElementById('rpsTable');
  const tableShell = document.querySelector('.table-shell');
  const chartFrame = document.querySelector('.chart-frame');
  if (!table || !tableShell || !chartFrame) return;

  const frameRect = chartFrame.getBoundingClientRect();
  const shellRect = tableShell.getBoundingClientRect();
  if (frameRect.width <= 0 || frameRect.height <= 0) return;

  const overlay = getTableGridOverlay(chartFrame);
  overlay.setAttribute(
    'viewBox',
    `0 0 ${formatGridCoordinate(frameRect.width)} ${formatGridCoordinate(frameRect.height)}`
  );
  const devicePixelRatio = window.devicePixelRatio || 1;
  const halfStroke = TABLE_GRID_STROKE_WIDTH / 2;
  const screenMatrix = overlay.getScreenCTM();
  const toLocalX = absoluteX => screenMatrix
    ? (absoluteX - screenMatrix.e) / screenMatrix.a
    : absoluteX - frameRect.left;
  const toLocalY = absoluteY => screenMatrix
    ? (absoluteY - screenMatrix.f) / screenMatrix.d
    : absoluteY - frameRect.top;
  const snapNearest = value => (
    Math.round(value * devicePixelRatio) / devicePixelRatio
  );
  const snapOuterStart = value => (
    Math.floor(value * devicePixelRatio) / devicePixelRatio
  );
  const snapOuterEnd = value => (
    Math.ceil(value * devicePixelRatio) / devicePixelRatio
  );

  const left = toLocalX(snapOuterStart(shellRect.left)) + halfStroke;
  const top = toLocalY(snapOuterStart(shellRect.top)) + halfStroke;
  const right = toLocalX(snapOuterEnd(shellRect.right)) - halfStroke;
  const bottom = toLocalY(snapOuterEnd(shellRect.bottom)) - halfStroke;
  const shellRadius = Number.parseFloat(
    getComputedStyle(tableShell).borderTopLeftRadius
  ) || 0;

  overlay.dataset.devicePixelRatio = String(devicePixelRatio);
  overlay.dataset.strokeWidth = String(TABLE_GRID_STROKE_WIDTH);

  const outerBorder = createSvgElement('rect');
  outerBorder.classList.add('table-grid-outer');
  outerBorder.setAttribute('x', formatGridCoordinate(left));
  outerBorder.setAttribute('y', formatGridCoordinate(top));
  outerBorder.setAttribute('width', formatGridCoordinate(Math.max(0, right - left)));
  outerBorder.setAttribute('height', formatGridCoordinate(Math.max(0, bottom - top)));
  outerBorder.setAttribute('rx', formatGridCoordinate(Math.max(0, shellRadius - halfStroke)));
  outerBorder.setAttribute('fill', 'none');
  outerBorder.setAttribute('stroke', TABLE_GRID_COLOR);
  outerBorder.setAttribute('stroke-width', String(TABLE_GRID_STROKE_WIDTH));
  outerBorder.setAttribute('vector-effect', 'non-scaling-stroke');

  const headerCells = Array.from(table.tHead?.rows[0]?.cells ?? []);
  const visibleRows = Array.from(table.rows).filter(row => !row.hidden);
  const commands = [];
  headerCells.slice(1).forEach(cell => {
    const edge = toLocalX(snapNearest(cell.getBoundingClientRect().left));
    const x = edge;
    commands.push(
      `M ${formatGridCoordinate(x)} ${formatGridCoordinate(top)}`,
      `L ${formatGridCoordinate(x)} ${formatGridCoordinate(bottom)}`
    );
  });
  visibleRows.slice(1).forEach(row => {
    const edge = toLocalY(snapNearest(row.getBoundingClientRect().top));
    const y = edge;
    commands.push(
      `M ${formatGridCoordinate(left)} ${formatGridCoordinate(y)}`,
      `L ${formatGridCoordinate(right)} ${formatGridCoordinate(y)}`
    );
  });

  const gridLines = createSvgElement('path');
  gridLines.classList.add('table-grid-lines');
  gridLines.setAttribute('d', commands.join(' '));
  gridLines.setAttribute('fill', 'none');
  gridLines.setAttribute('stroke', TABLE_GRID_COLOR);
  gridLines.setAttribute('stroke-width', String(TABLE_GRID_STROKE_WIDTH));
  gridLines.setAttribute('stroke-linecap', 'butt');
  gridLines.setAttribute('stroke-linejoin', 'miter');
  gridLines.setAttribute('vector-effect', 'non-scaling-stroke');
  overlay.replaceChildren(outerBorder, gridLines);
}

function scheduleTableGridOverlayRender() {
  if (tableGridAnimationFrame) return;
  tableGridAnimationFrame = requestAnimationFrame(() => {
    tableGridAnimationFrame = 0;
    renderTableGridOverlay();
  });
}

function initializeTableGridOverlay() {
  const chartFrame = document.querySelector('.chart-frame');
  if (!chartFrame) return;

  if (observedTableGridFrame !== chartFrame) {
    tableGridResizeObserver?.disconnect();
    tableGridResizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleTableGridOverlayRender);
    tableGridResizeObserver?.observe(chartFrame);
    observedTableGridFrame = chartFrame;
  }

  if (!hasTableGridViewportListeners) {
    window.addEventListener('resize', scheduleTableGridOverlayRender, { passive: true });
    window.visualViewport?.addEventListener(
      'resize',
      scheduleTableGridOverlayRender,
      { passive: true }
    );
    hasTableGridViewportListeners = true;
  }
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

export function getNameGroupName(index) {
  return tableStructure?.groupNames[index] ?? '';
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
  initializeTableGridOverlay();
}

export function renderApp() {
  renderLegends();
  renderTableStructure();
  renderColors();
  renderTableGridOverlay();
}
