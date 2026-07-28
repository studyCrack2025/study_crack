export const TAB_ITEMS = [
  { key: 'home', label: '홈', icon: 'home' },
  { key: 'analysis', label: '분석', icon: 'chart' },
  { key: 'strategy', label: '학습 코칭', icon: 'target' },
  { key: 'planner', label: '플래너', icon: 'calendar' },
  { key: 'my', label: '마이', icon: 'user' }
];

function defaultIcon() {
  return '';
}

export function renderTabButton({ key, label, icon }, { tab = 'home', icon: iconFn = defaultIcon } = {}) {
  const active = tab === key;
  const current = active ? ' aria-current="page"' : '';
  return `<button type="button" class="${active ? 'active' : ''}" data-action="tab" data-tab="${key}" aria-label="${label}"${current}>${iconFn(icon, active)}<span>${label}</span></button>`;
}

export function renderTabBar({ tab = 'home', dimmed = false, icon = defaultIcon, items = TAB_ITEMS } = {}) {
  const buttons = items.map((item) => renderTabButton(item, { tab, icon })).join('');
  return `<nav class="tabbar bottom-tab ${dimmed ? 'is-muted' : ''}" aria-label="주요 메뉴">${buttons}</nav>`;
}
