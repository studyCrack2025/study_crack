export const PRODUCT_GUIDE_VERSION = 'ob_2026_09';

export function parseProductGuide(value) {
  if (value?.supported !== true || value.version !== PRODUCT_GUIDE_VERSION) return null;
  if (!['unseen', 'in_progress', 'skipped', 'completed'].includes(value.status)) return null;
  if (!Number.isSafeInteger(value.revision) || value.revision < 0 || !Number.isInteger(value.lastStep) || value.lastStep < 0 || value.lastStep > 5) return null;
  if (value.status === 'unseen' && value.lastStep !== 0 || value.status === 'in_progress' && value.lastStep < 1 || value.status === 'completed' && value.lastStep !== 5) return null;
  return { supported: true, version: PRODUCT_GUIDE_VERSION, status: value.status, lastStep: value.lastStep, revision: value.revision, updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null };
}

export function guideAccountKey(state, hasSession) {
  return state.userLoadStatus === 'ready' && hasSession ? String(state.user?.email || state.user?.socialEmail || '') : '';
}

export function guideCanOpen(state) {
  return ['timer', 'my'].includes(state.screen) && !state.streakSummary?.open && !state.activeStudySession && !state.rewardPendingSessionId && !state.studyTimerRunning
    && ['idle', 'rewarded'].includes(state.timerPhase) && !state.notifModalOpen && !state.studySubjectSheetOpen && !state.gameRulesOpen
    && !state.profileDetailModalOpen && !state.mbtiModalOpen && !state.myProfileEditOpen;
}

export function guideMutation(record, status, step) {
  if (!record || record.status === 'completed' || status === 'in_progress' && record.status === 'skipped') return null;
  const lastStep = status === 'completed' ? 5 : Math.max(1, step, record.lastStep);
  if (status === record.status && (status === 'skipped' || lastStep === record.lastStep)) return null;
  return { version: PRODUCT_GUIDE_VERSION, status, lastStep, revision: record.revision };
}
