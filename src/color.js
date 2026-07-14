export function hsvToRgb(h, s, v) {
  const saturation = s / 100;
  const value = v / 100;
  const channel = (n, k = (n + h / 60) % 6) => (
    value - value * saturation * Math.max(Math.min(k, 4 - k, 1), 0)
  );

  return [
    Math.round(channel(5) * 255),
    Math.round(channel(3) * 255),
    Math.round(channel(1) * 255)
  ];
}

export function rgbToHex(r, g, b) {
  return `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export function hexToRgb(hex) {
  let normalized = hex.trim().replace(/^#/, '');
  if (normalized.length === 3) {
    normalized = normalized.split('').map(character => character + character).join('');
  }

  const value = Number.parseInt(normalized, 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
}

export function rgbToHsv(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (max !== min) {
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
  }

  const saturation = max === 0 ? 0 : delta / max;
  return [
    Math.round(hue * 360),
    Math.round(saturation * 100),
    Math.round(max * 100)
  ];
}

export function getAlphaFromRgba(rgba, fallback = 0.5) {
  const match = rgba.match(/([0-9.]+)\s*\)$/);
  return match ? Number.parseFloat(match[1]) : fallback;
}

export function toColorValues({ h, s, v, a }) {
  const [r, g, b] = hsvToRgb(Number(h), Number(s), Number(v));
  return {
    r,
    g,
    b,
    hex: rgbToHex(r, g, b),
    rgba: `rgba(${r}, ${g}, ${b}, ${a})`
  };
}

