import { filterTabItemsForTier } from '../app/access-policy.js';

const NAV_ICON_PATHS = {
  home: <path d="M3 11.5 12 4l9 7.5v8.5a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" />,
  calendar: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 2v4M16 2v4M8 11h8M8 15h5" /></>,
  fish: <><path d="M3 20h18M5 20V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12" /><path d="M8 13c1.7-2.3 4.3-2.3 6 0-1.7 2.3-4.3 2.3-6 0Zm6 0 2-1.7v3.4L14 13Z" /></>,
  chart: <path d="M4 19V11M10 19V5M16 19v-7M22 19H2" />,
  target: <><path d="M21 14.8a4 4 0 0 1-4 4H8l-5 3v-14a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7Z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></>
};

export const TAB_ITEMS = [
  { key: 'timer', label: '홈', icon: 'home' },
  { key: 'planner', label: '플래너', icon: 'calendar' },
  { key: 'aquarium', label: '수조', icon: 'fish' },
  { key: 'analysis', label: '분석', icon: 'chart' },
  { key: 'strategy', label: '코칭', accessibleLabel: '학습 코칭', icon: 'target' }
];

export function TabBar({ activeTab = 'timer', dimmed = false, inactive = false }) {
  const items = filterTabItemsForTier(TAB_ITEMS);
  return (
    <nav
      className={`tabbar bottom-tab ${dimmed ? 'is-muted' : ''}`}
      aria-label="주요 메뉴"
      inert={inactive ? '' : undefined}
      aria-hidden={inactive ? 'true' : undefined}
    >
      {items.map((item) => {
        const active = activeTab === item.key;
        return (
          <button
            type="button"
            className={`${active ? 'active ' : ''}${item.key === 'aquarium' ? 'is-aquarium' : ''}`.trim()}
            data-action="tab"
            data-tab={item.key}
            aria-label={item.accessibleLabel || item.label}
            aria-current={active ? 'page' : undefined}
            key={item.key}
          >
            <span className="tabbar-icon"><svg className="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">{NAV_ICON_PATHS[item.icon]}</svg></span>
            <span className="tabbar-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
