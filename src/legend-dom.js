export function updateLegendElement(item, { id, name, displayName = name }) {
  item.id = `item-${id}`;
  item.dataset.legendId = String(id);

  const display = item.querySelector('.circle-display');
  if (display) {
    display.id = `disp-${id}`;
    display.style.backgroundColor = `var(--color-${id}-a)`;
  }

  const label = item.querySelector('.editable-label');
  if (label) {
    label.id = `label-${id}`;
    label.textContent = displayName;
  }

  const deleteButton = item.querySelector('.btn-delete-item');
  deleteButton?.setAttribute('aria-label', `${name} 범례 삭제`);
  return item;
}

export function createLegendElement({ id, name, displayName = name }) {
  const item = document.createElement('div');
  item.className = 'legend-item';

  const display = document.createElement('div');
  display.className = 'circle-display';

  const label = document.createElement('span');
  label.className = 'editable-label';

  const deleteButton = document.createElement('button');
  deleteButton.className = 'btn-delete-item';
  deleteButton.type = 'button';
  deleteButton.textContent = '✕';

  item.append(display, label, deleteButton);
  return updateLegendElement(item, { id, name, displayName });
}
