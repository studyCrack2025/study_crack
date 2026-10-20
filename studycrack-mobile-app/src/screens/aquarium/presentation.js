export function buildAquariumWalletPresentation(profile = null) {
  const plan = profile?.ticketPolicyVersion === 'planner-ticket-v1';
  const study = profile?.ticketPolicyVersion === 'study-ticket-v1';
  const known = plan || study;
  const validBalance = known && Number.isSafeInteger(profile.ticketBalance) && profile.ticketBalance >= 0;
  const validProgress = study && Number.isSafeInteger(profile.ticketIntervalSeconds) && profile.ticketIntervalSeconds > 0 && Number.isSafeInteger(profile.ticketProgressSeconds) && profile.ticketProgressSeconds >= 0 && profile.ticketProgressSeconds < profile.ticketIntervalSeconds;
  return {
    balance: validBalance ? `${profile.ticketBalance}장` : '확인 필요',
    label: plan ? '계획 완료 보상' : study ? '다음 뽑기권까지' : '뽑기권 정보',
    value: plan ? '30분 이상' : validProgress ? `${Math.ceil((profile.ticketIntervalSeconds - profile.ticketProgressSeconds) / 60)}분` : '확인 필요',
    note: plan ? '계정 계획 · 첫 완료마다 1장' : !known || !validBalance || !validProgress ? '뽑기권 정보를 다시 확인해 주세요.' : '',
    progress: validProgress ? { max: profile.ticketIntervalSeconds, value: profile.ticketProgressSeconds } : null
  };
}

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
