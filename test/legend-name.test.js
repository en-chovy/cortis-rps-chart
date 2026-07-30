import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LEGEND_NAME_MAX_LENGTH,
  getLegendNameLength,
  limitLegendName,
  normalizeLegendName
} from '../src/legend-name.js';

test('limits legend names to 15 user-perceived characters', () => {
  const allowed = '가'.repeat(LEGEND_NAME_MAX_LENGTH);
  const limited = limitLegendName(`${allowed}나`);

  assert.equal(limited.value, allowed);
  assert.equal(limited.length, LEGEND_NAME_MAX_LENGTH + 1);
  assert.equal(limited.wasTruncated, true);
  assert.equal(limitLegendName(allowed).wasTruncated, false);
});

test('counts emoji as user-perceived characters and trims saved names', () => {
  assert.equal(getLegendNameLength('💙'.repeat(LEGEND_NAME_MAX_LENGTH)), LEGEND_NAME_MAX_LENGTH);
  assert.equal(normalizeLegendName(`  ${'💙'.repeat(LEGEND_NAME_MAX_LENGTH + 1)}  `), '💙'.repeat(LEGEND_NAME_MAX_LENGTH));

  if (typeof Intl.Segmenter === 'function') {
    assert.equal(getLegendNameLength('👨‍👩‍👧‍👦'), 1);
  }
});
