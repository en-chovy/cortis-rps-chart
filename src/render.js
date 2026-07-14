import { hexToRgb } from './color.js';
import { createLegendElement } from './legend-dom.js';
import { getEditableState } from './model.js';

function colorToRgba({ hex, alpha }) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function renderColors() {
  const { colors, nameCells, cells } = getEditableState();
  const root = document.documentElement;

  Object.entries(colors).forEach(([id, color]) => {
    root.style.setProperty(`--color-${id}`, color.hex);
    root.style.setProperty(`--color-${id}-a`, colorToRgba(color));
  });

  document.querySelectorAll('.paintable').forEach((cell, index) => {
    const legendId = cells[index];
    cell.style.backgroundColor = legendId == null ? '' : `var(--color-${legendId}-a)`;
  });

  document.querySelectorAll('.paintable-name').forEach(cell => {
    const offset = cell.dataset.axis === 'column' ? 0 : 5;
    const legendId = nameCells[offset + Number(cell.dataset.groupIndex)];
    cell.style.backgroundColor = legendId == null ? '' : `var(--color-${legendId}-a)`;
  });
}

export function renderLegends() {
  const { legends } = getEditableState();
  const container = document.getElementById('legendContainer');
  if (!container) return;

  const addButton = container.querySelector('.btn-add-legend');
  container.querySelectorAll('.legend-item').forEach(item => item.remove());
  legends.forEach(legend => {
    const item = createLegendElement(legend);
    if (addButton) container.insertBefore(item, addButton);
    else container.appendChild(item);
  });
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
