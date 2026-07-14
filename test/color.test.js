import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAlphaFromRgba,
  hexToRgb,
  hsvToRgb,
  rgbToHex,
  rgbToHsv,
  toColorValues
} from '../src/color.js';

test('converts primary colors between HSV, RGB, and hex', () => {
  assert.deepEqual(hsvToRgb(0, 100, 100), [255, 0, 0]);
  assert.equal(rgbToHex(255, 0, 0), '#ff0000');
  assert.deepEqual(hexToRgb('#0f0'), [0, 255, 0]);
  assert.deepEqual(rgbToHsv(0, 0, 255), [240, 100, 100]);
});

test('reads alpha values and builds CSS color values', () => {
  assert.equal(getAlphaFromRgba('rgba(1, 2, 3, 0.25)'), 0.25);
  assert.equal(getAlphaFromRgba(''), 0.5);
  assert.deepEqual(toColorValues({ h: 0, s: 100, v: 100, a: 0.5 }), {
    r: 255,
    g: 0,
    b: 0,
    hex: '#ff0000',
    rgba: 'rgba(255, 0, 0, 0.5)'
  });
});
