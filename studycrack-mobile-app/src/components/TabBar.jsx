import { filterTabItemsForTier } from '../app/access-policy.js';
import { Icon } from './Icon.jsx';

export const TAB_ITEMS = [
  { key: 'timer', label: '홈', icon: 'home' },
  { key: 'planner', label: '플래너', icon: 'calendar' },
  { key: 'aquarium', label: '수조', icon: 'fish' },
  { key: 'analysis', label: '분석', icon: 'chart' },
  { key: 'strategy', label: '학습 코칭', icon: 'target' }
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
            className={`${active ? 'active ' : ''}${item.key === 'aquarium' ? 'is-aquarium' : ''}`.trim()}
            data-action="tab"
            data-tab={item.key}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            key={item.key}
          >
            <span className="tabbar-icon"><Icon name={item.icon} primary={active} /></span>
            <span className="tabbar-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
