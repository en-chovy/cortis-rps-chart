const INITIAL_LEGENDS = [
  { id: 1, name: 'OTP', color: { hex: '#ffadad', alpha: 0.5 } },
  { id: 2, name: '좋음', color: { hex: '#ffd6a5', alpha: 0.5 } },
  { id: 3, name: '보통', color: { hex: '#fdffb6', alpha: 0.5 } },
  { id: 4, name: '스루', color: { hex: '#caffbf', alpha: 0.5 } },
  { id: 5, name: '지뢰', color: { hex: '#9bf6ff', alpha: 0.5 } }
];

export function createInitialEditableState() {
  const nextLegendId = Math.max(...INITIAL_LEGENDS.map(legend => legend.id)) + 1;
  return {
    nextLegendId,
    legends: INITIAL_LEGENDS.map(({ id, name }) => ({ id, name })),
    colors: Object.fromEntries(INITIAL_LEGENDS.map(({ id, color }) => [id, { ...color }])),
    cells: Array(20).fill(null)
  };
}

let editableState = createInitialEditableState();

export function getEditableState() {
  return editableState;
}

export function cloneEditableState() {
  return JSON.parse(JSON.stringify(editableState));
}

export function replaceEditableState(snapshot) {
  editableState = JSON.parse(JSON.stringify(snapshot));
  return editableState;
}

export function getLegend(id) {
  return editableState.legends.find(legend => legend.id === Number(id)) ?? null;
}

export function getLegendColor(id) {
  return editableState.colors[Number(id)] ?? null;
}

export function addLegend(name) {
  const id = editableState.nextLegendId;
  editableState.nextLegendId += 1;
  editableState.legends.push({ id, name });
  editableState.colors[id] = { hex: '#cccccc', alpha: 0.5 };
  return id;
}

export function renameLegend(id, name) {
  const legend = getLegend(id);
  if (legend) legend.name = name;
}

export function setLegendColor(id, color) {
  if (!editableState.colors[Number(id)]) return;
  editableState.colors[Number(id)] = {
    hex: color.hex,
    alpha: Number(color.alpha)
  };
}

export function deleteLegend(id) {
  const numericId = Number(id);
  editableState.legends = editableState.legends.filter(legend => legend.id !== numericId);
}

export function paintCell(index, legendId) {
  if (index < 0 || index >= editableState.cells.length) return;
  editableState.cells[index] = legendId == null ? null : Number(legendId);
}
