export function buildAquariumJourneyPresentation({ fishCount = 0, profile = null } = {}) {
  const starterState = String(profile?.starterState || 'locked');
  const rewardComplete = profile?.starterFishUnlocked === true || starterState !== 'locked';
  return {
    rewardState: rewardComplete ? 'complete' : 'active',
    aquariumState: starterState === 'claimed' ? 'complete' : rewardComplete ? 'active' : 'pending',
    fishDexState: Number(fishCount) > 0 ? 'complete' : 'pending'
  };
}

const FISHDEX_FILTERS = ['all', 'owned', 'locked'];

export function nextFishDexFilter(current = 'all', key = '') {
  const index = Math.max(0, FISHDEX_FILTERS.indexOf(current));
  if (key === 'Home') return FISHDEX_FILTERS[0];
  if (key === 'End') return FISHDEX_FILTERS.at(-1);
  if (!['ArrowLeft', 'ArrowRight'].includes(key)) return FISHDEX_FILTERS[index];
  const offset = key === 'ArrowRight' ? 1 : -1;
  return FISHDEX_FILTERS[(index + offset + FISHDEX_FILTERS.length) % FISHDEX_FILTERS.length];
}
