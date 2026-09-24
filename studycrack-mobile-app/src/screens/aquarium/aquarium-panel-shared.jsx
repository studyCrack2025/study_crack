export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'special'];
export const RARITY_LABELS = { common: '일반', rare: '희귀', epic: '영웅', legendary: '전설', special: '스페셜' };
export const RARITY_CLASSES = { common: 'rarity-common', rare: 'rarity-rare', epic: 'rarity-epic', legendary: 'rarity-legendary', special: 'rarity-special' };
export const CATALOG_FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'owned', label: '획득' },
  { id: 'locked', label: '미획득' }
];
export const CATEGORY_ORDER = ['all', 'freshwater', 'marine_fish', 'marine_invertebrate', 'marine_wildlife', 'mascot'];
export const CATEGORY_LABELS = { all: '모든 생태', freshwater: '민물', marine_fish: '바닷물고기', marine_invertebrate: '무척추', marine_wildlife: '해양생물', mascot: '크랙이' };

export function catalogMeta(catalog, speciesId) {
  return catalog.find((item) => item.speciesId === speciesId) || { colors: ['#3F6FD9', '#9DD9F2'], displayName: '물고기', rarity: 'common' };
}

export function AquariumModeHeader({ eyebrow, title, description }) {
  return <header className="aquarium-mode-header"><button type="button" data-action="closeAquariumMode" aria-label="수조로 돌아가기">‹</button><div><span>{eyebrow}</span><h1 tabIndex={-1}>{title}</h1><p>{description}</p></div></header>;
}
