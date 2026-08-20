import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
  getLanguage,
  getLocalizedLegendName,
  initializeLanguage,
  languageStorageKey,
  resolveInitialLanguage,
  setLanguage,
  t
} from '../src/i18n.js';

function createMemoryStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

beforeEach(() => initializeLanguage({ storage: createMemoryStorage(), languages: ['ko-KR'] }));

test('prefers a stored language over browser language detection', () => {
  const storage = createMemoryStorage({ [languageStorageKey]: 'en' });
  assert.equal(resolveInitialLanguage({ storage, languages: ['ko-KR'] }), 'en');
});

test('uses the first supported browser language and falls back to English', () => {
  const storage = createMemoryStorage();
  assert.equal(resolveInitialLanguage({ storage, languages: ['fr-FR', 'en-US'] }), 'en');
  assert.equal(resolveInitialLanguage({ storage, languages: ['fr-FR', 'de-DE'] }), 'en');
});

test('detects Simplified Chinese without assigning Traditional Chinese locales to it', () => {
  const storage = createMemoryStorage();
  assert.equal(resolveInitialLanguage({ storage, languages: ['zh-CN'] }), 'zh-CN');
  assert.equal(resolveInitialLanguage({ storage, languages: ['zh-Hans-SG'] }), 'zh-CN');
  assert.equal(resolveInitialLanguage({ storage, languages: ['zh'] }), 'zh-CN');
  assert.equal(resolveInitialLanguage({ storage, languages: ['zh-TW', 'ko-KR'] }), 'ko');
  assert.equal(resolveInitialLanguage({ storage, languages: ['zh-Hant-HK'] }), 'en');
});

test('stores an explicit language choice and translates confirmed copy', () => {
  const storage = createMemoryStorage();
  assert.equal(setLanguage('en-US', { storage }), true);
  assert.equal(getLanguage(), 'en');
  assert.equal(storage.getItem(languageStorageKey), 'en');
  assert.equal(t('category.settingsTitle'), 'Category settings');
  assert.equal(t('restore.trigger'), 'Restore top/bottom');
  assert.equal(t('restore.group.row.2'), 'Juhoon Bottom');
  assert.equal(t('restore.group.column.4'), 'Keonho Top');
  assert.equal(t('language.add'), 'Add language');
  assert.equal(t('contact.contributeTitle'), 'Help with translations');
  assert.match(t('contact.contributeDescription'), /add a new language.*@setmefuri/);
});

test('localizes untouched default legends without translating custom names', () => {
  setLanguage('en', { storage: createMemoryStorage() });
  assert.equal(getLocalizedLegendName({ id: 2, name: '좋음' }), 'Like');
  assert.equal(getLocalizedLegendName({ id: 2, name: '최애' }), '최애');
  assert.equal(getLocalizedLegendName({ id: 6, name: '좋음' }), '좋음');
});

test('stores Simplified Chinese and translates UI, member, and directional ship names', () => {
  const storage = createMemoryStorage();
  assert.equal(setLanguage('zh-SG', { storage }), true);
  assert.equal(getLanguage(), 'zh-CN');
  assert.equal(storage.getItem(languageStorageKey), 'zh-CN');
  assert.equal(t('page.title'), 'CORTIS RPS 口味表');
  assert.equal(t('legend.2'), '好嗑');
  assert.equal(t('restore.group.column.2'), '金主训攻');
  assert.equal(t('restore.group.row.4'), '安乾镐受');
  assert.equal(t('member.3'), '严成玹');
  assert.equal(t('ship.0.1'), '酱麻面');
  assert.equal(t('ship.1.0'), '麻酱面');
  assert.equal(t('ship.4.3'), '溜酒');
});
