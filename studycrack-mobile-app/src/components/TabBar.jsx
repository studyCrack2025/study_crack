import { filterTabItemsForTier } from '../app/access-policy.js';
import { Icon } from './Icon.jsx';

export const TAB_ITEMS = [
  { key: 'timer', label: '타이머', icon: 'timer' },
  { key: 'planner', label: '플래너', icon: 'calendar' },
  { key: 'analysis', label: '분석', icon: 'chart' },
  { key: 'strategy', label: '학습 코칭', icon: 'target' },
  { key: 'my', label: '마이', icon: 'user' }
];

export function TabBar({ activeTab = 'timer', dimmed = false }) {
  const items = filterTabItemsForTier(TAB_ITEMS);
  return (
    <nav className={`tabbar bottom-tab ${dimmed ? 'is-muted' : ''}`} aria-label="주요 메뉴">
      {items.map((item) => {
        const active = activeTab === item.key;
        return (
          <button
            type="button"
            className={active ? 'active' : ''}
            data-action="tab"
            data-tab={item.key}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            key={item.key}
          >
            <Icon name={item.icon} primary={active} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
