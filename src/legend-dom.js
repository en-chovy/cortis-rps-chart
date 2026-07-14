export function createLegendElement({ id, name }) {
  const item = document.createElement('div');
  item.className = 'legend-item';
  item.id = `item-${id}`;

  const display = document.createElement('div');
  display.className = 'circle-display';
  display.id = `disp-${id}`;
  display.style.backgroundColor = `var(--color-${id}-a)`;

  const label = document.createElement('span');
  label.className = 'editable-label';
  label.id = `label-${id}`;
  label.textContent = name;

  const deleteButton = document.createElement('button');
  deleteButton.className = 'btn-delete-item';
  deleteButton.type = 'button';
  deleteButton.setAttribute('aria-label', `${name} 범례 삭제`);
  deleteButton.textContent = '✕';

  item.append(display, label, deleteButton);
  return item;
}
