const LANGUAGE_STORAGE_KEY = 'cortis-rps-chart:language';
const SUPPORTED_LANGUAGES = new Set(['ko', 'en']);

const COPY = {
  ko: {
    'page.title': 'CORTIS RPS 취향표',
    'language.add': '언어 추가',
    'legend.1': 'OTP',
    'legend.2': '좋음',
    'legend.3': '보통',
    'legend.4': '스루',
    'legend.5': '지뢰',
    'export.includeDate': '이미지에 날짜 표시',
    'export.save': '이미지 저장',
    'export.creating': '이미지 만드는 중…',
    'export.saved': '저장 완료',
    'export.errorAlert': '이미지를 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
    'restore.trigger': '왼·른 복구',
    'restore.title': '삭제한 왼른 복구',
    'restore.description': '삭제한 왼이나 른을 선택해 복구하세요. 왼은 표 위쪽, 른은 표 왼쪽에 다시 나타나며 기존에 칠한 색과 고스트 셀도 함께 돌아옵니다.',
    'restore.deletedTop': '삭제한 왼',
    'restore.deletedBottom': '삭제한 른',
    'restore.empty': '삭제한 왼이나 른이 없습니다.',
    'restore.group.row.0': '틴른',
    'restore.group.row.1': '젯른',
    'restore.group.row.2': '쮼른',
    'restore.group.row.3': '셩른',
    'restore.group.row.4': '튀른',
    'restore.group.column.0': '틴왼',
    'restore.group.column.1': '젯왼',
    'restore.group.column.2': '듀왼',
    'restore.group.column.3': '엄왼',
    'restore.group.column.4': '낭왼',
    'chart.reset': '초기화',
    'footer.contact': '문의 및 버그 제보',
    'contact.title': '문의 및 기여',
    'contact.releaseTitle': '릴리즈 노트·문의·버그 제보',
    'contact.releaseDescription': '업데이트 내역은 포스타입의 릴리즈 노트에서 확인할 수 있습니다. 문의와 버그 제보는 해당 게시글의 댓글로 남겨 주세요.',
    'contact.openPostype': '포스타입에서 확인하기',
    'contact.contributeTitle': '다국어 지원에 기여하기',
    'contact.contributeDescription': '새 언어 지원을 제안하거나, 현지 팬덤에서 사용하는 멤버명·씨피명 표기를 제보하거나, 번역 및 다국어 지원 개발에 기여하고 싶다면 X의 @setmefuri로 연락해 주세요.',
    'contact.openX': 'X에서 연락하기',
    'common.cancel': '취소',
    'common.save': '저장',
    'common.confirm': '확인',
    'common.delete': '삭제',
    'common.done': '완료',
    'common.close': '닫기',
    'common.restore': '복구',
    'common.restoreAll': '모두 복구',
    'category.renameTitle': '이름 변경',
    'category.addTitle': '새 범례 추가',
    'category.namePlaceholder': '이름을 입력하세요',
    'category.nameLimit': '범례 이름은 15자까지 입력할 수 있어요.',
    'category.deleteTitle': '범례 삭제',
    'category.deleteConfirm': '이 범례를 정말 삭제할까요?',
    'category.settingsTitle': '범례 설정',
    'category.nameLabel': '이름',
    'category.colorLabel': '색상',
    'color.selected': '선택 색상',
    'cell.showLabel': '글자 보이기',
    'cell.hideLabel': '글자 숨기기',
    'history.undoTooltip': '실행 취소 (⌘/Ctrl+Z)',
    'history.redoTooltip': '다시 실행 (⌘/Ctrl+Shift+Z)',
    'reset.title': '취향표 초기화',
    'reset.description': '범례, 색상, 칠한 셀을 모두 기본 상태로 되돌립니다. 이 작업은 실행 취소할 수 없습니다.'
  },
  en: {
    'page.title': 'CORTIS RPS Chart',
    'language.add': 'Add language',
    'legend.1': 'OTP',
    'legend.2': 'Like',
    'legend.3': 'Neutral',
    'legend.4': 'Pass',
    'legend.5': 'NOTP',
    'export.includeDate': 'Include date in image',
    'export.save': 'Save image',
    'export.creating': 'Creating image…',
    'export.saved': 'Image saved',
    'export.errorAlert': 'Something went wrong while creating the image. Please try again.',
    'restore.trigger': 'Restore top/bottom',
    'restore.title': 'Restore deleted top/bottom entries',
    'restore.description': 'Select a deleted top or bottom entry to restore. Tops return to the chart header and bottoms to the left side, along with their previous colors and hidden labels.',
    'restore.deletedTop': 'Deleted tops',
    'restore.deletedBottom': 'Deleted bottoms',
    'restore.empty': 'There are no deleted tops or bottoms.',
    'restore.group.row.0': 'Martin Bottom',
    'restore.group.row.1': 'James Bottom',
    'restore.group.row.2': 'Juhoon Bottom',
    'restore.group.row.3': 'Seonghyeon Bottom',
    'restore.group.row.4': 'Keonho Bottom',
    'restore.group.column.0': 'Martin Top',
    'restore.group.column.1': 'James Top',
    'restore.group.column.2': 'Juhoon Top',
    'restore.group.column.3': 'Seonghyeon Top',
    'restore.group.column.4': 'Keonho Top',
    'chart.reset': 'Reset',
    'footer.contact': 'Contact & bug reports',
    'contact.title': 'Contact & contribute',
    'contact.releaseTitle': 'Release notes, questions & bug reports',
    'contact.releaseDescription': 'View update details in the release notes on Postype. Please leave questions and bug reports in the comments on that post.',
    'contact.openPostype': 'Open Postype',
    'contact.contributeTitle': 'Contribute to localization',
    'contact.contributeDescription': 'To suggest another language, share the member or ship names used by fans in your region, or contribute to translation or localization development, contact @setmefuri on X.',
    'contact.openX': 'Contact on X',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.confirm': 'Save',
    'common.delete': 'Delete',
    'common.done': 'Done',
    'common.close': 'Close',
    'common.restore': 'Restore',
    'common.restoreAll': 'Restore all',
    'category.renameTitle': 'Rename category',
    'category.addTitle': 'Add category',
    'category.namePlaceholder': 'Enter a name',
    'category.nameLimit': 'Category names can be up to 15 characters.',
    'category.deleteTitle': 'Delete category',
    'category.deleteConfirm': 'Are you sure you want to delete this category?',
    'category.settingsTitle': 'Category settings',
    'category.nameLabel': 'Name',
    'category.colorLabel': 'Color',
    'color.selected': 'Selected color',
    'cell.showLabel': 'Show label',
    'cell.hideLabel': 'Hide label',
    'history.undoTooltip': 'Undo (⌘/Ctrl+Z)',
    'history.redoTooltip': 'Redo (⌘/Ctrl+Shift+Z)',
    'reset.title': 'Reset chart',
    'reset.description': 'This will reset all categories, colors, and filled cells to their defaults. This action can’t be undone.'
  }
};

const KOREAN_DEFAULT_LEGEND_NAMES = Object.freeze({
  1: COPY.ko['legend.1'],
  2: COPY.ko['legend.2'],
  3: COPY.ko['legend.3'],
  4: COPY.ko['legend.4'],
  5: COPY.ko['legend.5']
});

let currentLanguage = 'ko';

function getLocalStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function getBrowserLanguages(languages) {
  if (languages !== undefined) return languages;
  const browser = globalThis.navigator;
  if (!browser) return [];
  return Array.isArray(browser.languages) && browser.languages.length > 0
    ? browser.languages
    : [browser.language];
}

function normalizeLanguage(language) {
  if (typeof language !== 'string') return null;
  const baseLanguage = language.trim().toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.has(baseLanguage) ? baseLanguage : null;
}

export function resolveInitialLanguage({ storage, languages } = {}) {
  const target = getLocalStorage(storage);
  try {
    const storedLanguage = normalizeLanguage(target?.getItem(LANGUAGE_STORAGE_KEY));
    if (storedLanguage) return storedLanguage;
  } catch {
    // Language detection can continue when storage is unavailable.
  }

  for (const language of getBrowserLanguages(languages)) {
    const normalized = normalizeLanguage(language);
    if (normalized) return normalized;
  }
  return 'ko';
}

export function initializeLanguage(options = {}) {
  currentLanguage = resolveInitialLanguage(options);
  return currentLanguage;
}

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(language, { storage } = {}) {
  const normalized = normalizeLanguage(language);
  if (!normalized) return false;
  currentLanguage = normalized;

  const target = getLocalStorage(storage);
  try {
    target?.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch {
    // The in-memory choice still applies when storage is unavailable.
  }
  return true;
}

export function t(key) {
  return COPY[currentLanguage]?.[key] ?? COPY.ko[key] ?? key;
}

export function getLocalizedLegendName({ id, name }) {
  const numericId = Number(id);
  const isUntouchedDefault = KOREAN_DEFAULT_LEGEND_NAMES[numericId] === name;
  return isUntouchedDefault ? t(`legend.${numericId}`) : name;
}

export function applyDocumentTranslations(documentRoot = globalThis.document) {
  if (!documentRoot) return;
  documentRoot.documentElement.lang = currentLanguage;
  documentRoot.title = t('page.title');

  documentRoot.querySelectorAll('[data-i18n]').forEach(element => {
    element.textContent = t(element.dataset.i18n);
  });
  documentRoot.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  });
  documentRoot.querySelectorAll('[data-i18n-title]').forEach(element => {
    element.title = t(element.dataset.i18nTitle);
  });
}

export const languageStorageKey = LANGUAGE_STORAGE_KEY;
