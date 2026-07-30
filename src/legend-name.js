export const LEGEND_NAME_MAX_LENGTH = 15;

const graphemeSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('ko', { granularity: 'grapheme' })
  : null;

export function splitGraphemes(value) {
  const text = String(value ?? '');
  if (graphemeSegmenter) {
    return [...graphemeSegmenter.segment(text)].map(segment => segment.segment);
  }
  return Array.from(text);
}

export function getLegendNameLength(value) {
  return splitGraphemes(value).length;
}

export function limitLegendName(value) {
  const graphemes = splitGraphemes(value);
  return {
    value: graphemes.slice(0, LEGEND_NAME_MAX_LENGTH).join(''),
    length: graphemes.length,
    wasTruncated: graphemes.length > LEGEND_NAME_MAX_LENGTH
  };
}

export function normalizeLegendName(value) {
  return limitLegendName(String(value ?? '').trim()).value;
}
