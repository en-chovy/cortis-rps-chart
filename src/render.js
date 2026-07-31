import { hexToRgb } from './color.js?v=20260731-4';
import { createLegendElement, updateLegendElement } from './legend-dom.js?v=20260731-4';
import { getEditableState } from './model.js?v=20260731-4';

const LEGEND_EXIT_FALLBACK_MS = 150;
const legendEntryFrames = new WeakMap();
const legendRemovalTimers = new WeakMap();
let hasRenderedLegends = false;

function colorToRgba({ hex, alpha }) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function renderColors() {
  const { colors, cells } = getEditableState();
  const root = document.documentElement;

  Object.entries(colors).forEach(([id, color]) => {
    root.style.setProperty(`--color-${id}`, color.hex);
    root.style.setProperty(`--color-${id}-a`, colorToRgba(color));
  });

  document.querySelectorAll('.paintable').forEach((cell, index) => {
    const legendId = cells[index];
    cell.style.backgroundColor = legendId == null ? '' : `var(--color-${legendId}-a)`;
  });
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

  existingItems.forEach(removeLegendItem);
  hasRenderedLegends = true;
}

export function initializeCells() {
  document.querySelectorAll('.paintable').forEach((cell, index) => {
    cell.dataset.cellIndex = String(index);
  });
}

export function renderApp() {
  renderLegends();
  renderColors();
}
