import { toColorValues } from './color.js';

export function createColorPicker({ area, hueSlider, alphaSlider, cursor, onChange }) {
  if (!area || !hueSlider || !alphaSlider || !cursor) return null;

  let value = { h: 0, s: 100, v: 100, a: 0.5 };

  function render() {
    const { r, g, b } = toColorValues(value);
    area.style.backgroundColor = `hsl(${value.h}, 100%, 50%)`;
    alphaSlider.style.background = `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1)), repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 14px 14px`;
    hueSlider.value = String(value.h);
    alphaSlider.value = String(value.a);

    const rect = area.getBoundingClientRect();
    cursor.style.left = `${(value.s / 100) * rect.width}px`;
    cursor.style.top = `${((100 - value.v) / 100) * rect.height}px`;
  }

  function update(next) {
    value = { ...value, ...next };
    render();
    onChange?.({ ...value });
  }

  function updateFromPointer(event) {
    const rect = area.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    update({
      s: (x / rect.width) * 100,
      v: 100 - (y / rect.height) * 100
    });
  }

  area.addEventListener('pointerdown', event => {
    event.preventDefault();
    area.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  });
  area.addEventListener('pointermove', event => {
    if (area.hasPointerCapture(event.pointerId)) updateFromPointer(event);
  });
  area.addEventListener('pointerup', event => {
    if (area.hasPointerCapture(event.pointerId)) area.releasePointerCapture(event.pointerId);
  });
  area.addEventListener('pointercancel', event => {
    if (area.hasPointerCapture(event.pointerId)) area.releasePointerCapture(event.pointerId);
  });
  hueSlider.addEventListener('input', event => update({ h: Number(event.target.value) }));
  alphaSlider.addEventListener('input', event => update({ a: Number(event.target.value) }));

  return {
    getValue: () => ({ ...value }),
    setValue(next) {
      value = {
        h: Number(next.h),
        s: Number(next.s),
        v: Number(next.v),
        a: Number(next.a)
      };
      render();
    },
    refreshLayout: render
  };
}
