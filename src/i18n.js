const LANGUAGE_STORAGE_KEY = 'cortis-rps-chart:language';
const SIMPLIFIED_CHINESE_LANGUAGE = 'zh-CN';

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
    'contact.releaseTitle': '문의 및 버그 제보',
    'contact.releaseDescription': '릴리즈 노트에서 업데이트 소식을 확인하고, 댓글로 문의나 오류를 남겨주세요.',
    'contact.openPostype': '릴리즈 노트 확인하기',
    'contact.contributeTitle': '외국어 지원 기여하기',
    'contact.contributeDescription': '새 언어 추가, 번역 오류 수정 등 외국어 지원에 기여하고 싶다면 X에서 @setmefuri에게 DM이나 멘션으로 연락해주세요.',
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
    'reset.description': '범례, 색상, 칠한 셀을 모두 기본 상태로 되돌립니다. 이 작업은 실행 취소할 수 없습니다.',
    'member.0': '마틴',
    'member.1': '제임스',
    'member.2': '주훈',
    'member.3': '성현',
    'member.4': '건호',
    'ship.0.1': '젯틴',
    'ship.0.2': '훈틴',
    'ship.0.3': '셩띤',
    'ship.0.4': '껀틴',
    'ship.1.0': '틴젯',
    'ship.1.2': '눟젯',
    'ship.1.3': '셩젯',
    'ship.1.4': '낭젯',
    'ship.2.0': '틴훈',
    'ship.2.1': '젯쮸',
    'ship.2.3': '셩쮼',
    'ship.2.4': '낭쮼',
    'ship.3.0': '틴셩',
    'ship.3.1': '젯셩',
    'ship.3.2': '쮸엄',
    'ship.3.4': '낭셩',
    'ship.4.0': '틴껀',
    'ship.4.1': '젬껀',
    'ship.4.2': '쮸건',
    'ship.4.3': '엄껀'
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
    'contact.releaseTitle': 'Questions & bug reports',
    'contact.releaseDescription': 'Check the release notes for updates, then leave questions or bug reports in the comments.',
    'contact.openPostype': 'View release notes',
    'contact.contributeTitle': 'Help with translations',
    'contact.contributeDescription': 'If you’d like to help add a new language or fix translation errors, contact @setmefuri on X via DM or a mention.',
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
  },
  [SIMPLIFIED_CHINESE_LANGUAGE]: {
    'page.title': 'CORTIS RPS 口味表',
    'language.add': '添加语言',
    'legend.1': '本命',
    'legend.2': '好嗑',
    'legend.3': '一般',
    'legend.4': '不嗑',
    'legend.5': '雷',
    'export.includeDate': '图片中显示日期',
    'export.save': '保存图片',
    'export.creating': '正在生成…',
    'export.saved': '已保存',
    'export.errorAlert': '生成图片时出现问题，请稍后重试。',
    'restore.trigger': '恢复攻/受',
    'restore.title': '恢复已删除的攻/受',
    'restore.description': '选择要恢复的攻或受。攻会回到表格顶部，受会回到左侧，并保留原有颜色和隐藏文字。',
    'restore.deletedTop': '已删除的攻',
    'restore.deletedBottom': '已删除的受',
    'restore.empty': '没有已删除的攻或受。',
    'restore.group.row.0': '马丁受',
    'restore.group.row.1': '赵雨凡受',
    'restore.group.row.2': '金主训受',
    'restore.group.row.3': '严成玹受',
    'restore.group.row.4': '安乾镐受',
    'restore.group.column.0': '马丁攻',
    'restore.group.column.1': '赵雨凡攻',
    'restore.group.column.2': '金主训攻',
    'restore.group.column.3': '严成玹攻',
    'restore.group.column.4': '安乾镐攻',
    'chart.reset': '重置',
    'footer.contact': '问题反馈',
    'contact.title': '反馈与贡献',
    'contact.releaseTitle': '问题与错误反馈',
    'contact.releaseDescription': '请在 Postype 查看更新内容，并在评论区留下问题或错误反馈。',
    'contact.openPostype': '查看更新日志',
    'contact.contributeTitle': '为多语言支持贡献力量',
    'contact.contributeDescription': '如果你想添加新语言、修正翻译错误，或以其他方式为多语言支持做出贡献，请通过 X 私信或提及 @setmefuri 联系。',
    'contact.openX': '通过 X 联系',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.confirm': '保存',
    'common.delete': '删除',
    'common.done': '完成',
    'common.close': '关闭',
    'common.restore': '恢复',
    'common.restoreAll': '全部恢复',
    'category.renameTitle': '重命名分类',
    'category.addTitle': '添加分类',
    'category.namePlaceholder': '输入名称',
    'category.nameLimit': '分类名称最多15个字符。',
    'category.deleteTitle': '删除分类',
    'category.deleteConfirm': '确定删除这个分类吗？',
    'category.settingsTitle': '分类设置',
    'category.nameLabel': '名称',
    'category.colorLabel': '颜色',
    'color.selected': '当前颜色',
    'cell.showLabel': '显示文字',
    'cell.hideLabel': '隐藏文字',
    'history.undoTooltip': '撤销 (⌘/Ctrl+Z)',
    'history.redoTooltip': '重做 (⌘/Ctrl+Shift+Z)',
    'reset.title': '重置口味表',
    'reset.description': '将所有分类、颜色和已填色单元格恢复为默认状态。此操作无法撤销。',
    'member.0': '马丁',
    'member.1': '赵雨凡',
    'member.2': '金主训',
    'member.3': '严成玹',
    'member.4': '安乾镐',
    'ship.0.1': '酱麻面',
    'ship.0.2': '猪马',
    'ship.0.3': '溜马',
    'ship.0.4': '乾马',
    'ship.1.0': '麻酱面',
    'ship.1.2': '猪排饭',
    'ship.1.3': '盐焗饭',
    'ship.1.4': '玉米饭',
    'ship.2.0': '马猪',
    'ship.2.1': '饭排猪',
    'ship.2.3': '溜猪',
    'ship.2.4': '酒猪',
    'ship.3.0': '马严',
    'ship.3.1': '饭焗盐',
    'ship.3.2': '猪溜',
    'ship.3.4': '酒溜',
    'ship.4.0': '马乾',
    'ship.4.1': '饭米玉',
    'ship.4.2': '猪酒',
    'ship.4.3': '溜酒'
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
  const normalized = language.trim().replaceAll('_', '-').toLowerCase();
  if (normalized === 'ko' || normalized.startsWith('ko-')) return 'ko';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (normalized !== 'zh' && !normalized.startsWith('zh-')) return null;

  const subtags = normalized.split('-').slice(1);
  const usesTraditionalChinese = subtags.includes('hant')
    || subtags.some(subtag => ['tw', 'hk', 'mo'].includes(subtag));
  if (usesTraditionalChinese) return null;
  return SIMPLIFIED_CHINESE_LANGUAGE;
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
  return 'en';
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
