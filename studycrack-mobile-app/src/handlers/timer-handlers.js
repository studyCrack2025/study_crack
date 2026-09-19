import { getTodayDateKey } from '../constants/runtime-defaults.js';
import { createStudySessionCandidate } from '../features/study/session-model.js';
import { withOperationLock } from '../shared/async/operation-lock.js';
import { getData } from './action-utils.js';

const RECOVERABLE_ERROR = 'recoverable-error';
const TERMINAL_REWARD_ERROR = 'terminal-reward-error';
const numeric = (value) => Number(value) || 0;

function setRefValue(ref, value) {
  if (ref && typeof ref === 'object') ref.current = value;
}

function inputValue(ctx, selector) {
  return String((ctx.document || globalThis.document)?.querySelector?.(selector)?.value || '');
}

function mutateStudyRecord(records, date, elapsed) {
  const list = Array.isArray(records) ? records : [];
  const index = list.findIndex((row) => row.date === date);
  if (index < 0) return [...list, { date, studyTime: elapsed }];
  const next = [...list];
  next[index] = { ...next[index], studyTime: numeric(next[index].studyTime) + elapsed };
  return next;
}

function mutateSubjectRecord(records, date, subject, elapsed) {
  const list = Array.isArray(records) ? records : [];
  const index = list.findIndex((row) => row.date === date);
  if (index < 0) return [...list, { date, subjects: { [subject]: elapsed } }];
  const next = [...list];
  const subjects = next[index].subjects || {};
  next[index] = { ...next[index], subjects: { ...subjects, [subject]: numeric(subjects[subject]) + elapsed } };
  return next;
}

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() || `study-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function applyRewardFailure(ctx, result) {
  const terminal = /^STUDY_SESSION_NOT_(FOUND|REWARDABLE)$/.test(result?.code);
  ctx.setTimerPhase(terminal ? TERMINAL_REWARD_ERROR : RECOVERABLE_ERROR);
  ctx.setCompletionError(result?.error || '보상을 확인하지 못했습니다.');
}

function applyRewardState(ctx, rewardData) {
  if (!rewardData?.profile) return;
  ctx.setGameProfile(rewardData.profile);
  ctx.setGameProfileStatus('ready');
  ctx.setGameProfileError('');
  ctx.setRewardResult({
    sessionId: rewardData.sessionId,
    durationSeconds: numeric(rewardData.durationSeconds),
    shells: numeric(rewardData.reward?.shells),
    food: numeric(rewardData.reward?.food),
    alreadyClaimed: rewardData.alreadyClaimed === true
  });
  ctx.setGameRefreshTick((value) => numeric(value) + 1);
}

function applyCompletedSession(ctx, completion) {
  const duration = Math.max(1, numeric(completion.durationSeconds) || 1);
  const subject = ctx.activeStudySubject || ctx.activeStudySession?.subject || '기타';
  const plannerItemId = ctx.activePlannerItemId || ctx.activeStudySession?.plannerItemId || '';
  const activity = completion.activity || ctx.activeStudySession?.activity || `${subject} 학습`;
  const date = getTodayDateKey(new Date(completion.endedAt || Date.now()));
  ctx.setStudyRecords((records) => mutateStudyRecord(records, date, duration));
  ctx.setStudySubjectRecords((records) => mutateSubjectRecord(records, date, subject, duration));
  if (plannerItemId) {
    ctx.setPlannerItems((items) => items.map((item) => (
      item.id === plannerItemId ? { ...item, doneMinutes: numeric(item.doneMinutes) + Math.round(duration / 60) } : item
    )));
  }
  ctx.setLastCompletedSession({ ...completion, subject, activity, plannerItemId });
  ctx.setActiveStudySession(null);
  ctx.setActiveStudySubject('');
  ctx.setActivePlannerItemId('');
  setRefValue(ctx.studyTimerSecondsRef, 0);
  ctx.setStudyTimerTick(0);
  ctx.syncLiveStudyTimerUi?.(0);
  ctx.refreshStudyRanking?.();
  ctx.setStudySummaryRefreshTick((value) => numeric(value) + 1);
}

async function beginStudy(ctx, subject, activity, plannerItemId = '', storedCandidate = null) {
  if (!subject || ctx.rewardPendingSessionId || (!storedCandidate && ctx.activeStudySession) || /(-session|claiming-reward)$/.test(ctx.timerPhase)) return false;
  return withOperationLock(ctx.operationLocksRef, 'study-start', async () => {
    const candidate = storedCandidate || createStudySessionCandidate({ sessionId: createSessionId(), subject, activity, plannerItemId });
    ctx.setTimerPhase('starting-session');
    ctx.setCompletionError('');
    ctx.setRewardResult(null);
    ctx.setLastCompletedSession(null);
    ctx.setActiveStudySession(candidate);
    const response = await ctx.startStudySession(candidate);
    if (!response?.ok) {
      ctx.setTimerPhase(RECOVERABLE_ERROR);
      ctx.setCompletionError(response?.error || '공부 시작을 기록하지 못했습니다. 다시 시도해주세요.');
      return true;
    }
    const session = { ...candidate, ...response.data, subject, activity, plannerItemId, status: 'running' };
    ctx.setActiveStudySession(session);
    ctx.setActiveStudySubject(subject);
    ctx.setActivePlannerItemId(plannerItemId);
    ctx.setStudySubjectSheetOpen(false);
    ctx.setStudySubjectSheetOnlyPlanned(false);
    ctx.setStudyStartDraft({ subject: '', activity: '', plannerItemId: '' });
    ctx.setStudyTimerRunning(true);
    ctx.setTimerPhase('running');
    setRefValue(ctx.studyTimerSecondsRef, 0);
    ctx.startLiveStudyTimer?.(session.startedAt, (seconds) => ctx.setStudyTimerTick(seconds));
    ctx.syncLiveStudyTimerUi?.(0);
    return true;
  });
}

export function createTimerHandlers(ctx) {
  const { preserveScrollAfterStateChange = (fn) => fn?.() } = ctx;
  return {
    openStudySubjectSheet() {
      preserveScrollAfterStateChange(() => {
        ctx.setNotifModalOpen(false);
        ctx.setCompletionError('');
        ctx.setStudySubjectSheetOnlyPlanned(false);
        ctx.setStudyStartDraft({ subject: '', activity: '', plannerItemId: '' });
        ctx.setStudySubjectSheetOpen(true);
      });
      return true;
    },
    closeStudySubjectSheet({ actionEl, isOverlaySelfClick }) {
      if (!isOverlaySelfClick && actionEl?.classList?.contains?.('planner-sheet-overlay')) return false;
      preserveScrollAfterStateChange(() => {
        ctx.setStudySubjectSheetOnlyPlanned(false);
        ctx.setStudySubjectSheetOpen(false);
        ctx.setStudyStartDraft({ subject: '', activity: '', plannerItemId: '' });
      });
      return true;
    },
    selectStudySubject({ actionEl }) {
      const subject = getData(actionEl, 'study-subject');
      if (!subject) return false;
      ctx.setStudyStartDraft({ subject, activity: getData(actionEl, 'study-activity'), plannerItemId: getData(actionEl, 'study-item-id') });
      ctx.setStudySubjectSheetOpen(true);
      return true;
    },
    confirmStudyStart() {
      const draft = ctx.studyStartDraft || {};
      const subject = String(draft.subject === '기타' ? inputValue(ctx, '[data-field="studyStartCustomSubject"]') : draft.subject || '').trim().slice(0, 30);
      const activity = inputValue(ctx, '[data-field="studyStartActivity"]').trim().slice(0, 80);
      if (!subject || !activity) return false;
      return beginStudy(ctx, subject, activity, String(draft.plannerItemId || ''));
    },
    retryStudyStart() {
      const session = ctx.activeStudySession;
      if (!session || session.status !== 'starting') return false;
      return beginStudy(ctx, session.subject, session.activity || '학습 기록', session.plannerItemId || '', session);
    },
    async stopStudyTimer() {
      const session = ctx.activeStudySession;
      if (!session || !['running', RECOVERABLE_ERROR].includes(ctx.timerPhase)) return false;
      return withOperationLock(ctx.operationLocksRef, `study-complete:${session.sessionId}`, async () => {
        ctx.setStudyTimerRunning(false);
        ctx.stopLiveStudyTimer?.();
        ctx.setCompletionError('');
        const result = await ctx.completeStudySession(session.sessionId, (phase) => ctx.setTimerPhase(phase));
        if (!result.completion?.ok) {
          ctx.setStudyTimerRunning(true);
          ctx.startLiveStudyTimer?.(session.startedAt, (seconds) => ctx.setStudyTimerTick(seconds));
          ctx.setTimerPhase(RECOVERABLE_ERROR);
          ctx.setCompletionError(result.completion?.error || '공부 완료를 확인하지 못했습니다. 기록은 유지됩니다.');
          return true;
        }
        applyCompletedSession(ctx, result.completion.data);
        if (!result.reward?.ok) {
          ctx.setRewardPendingSessionId(session.sessionId);
          applyRewardFailure(ctx, result.reward);
          return true;
        }
        ctx.setRewardPendingSessionId('');
        applyRewardState(ctx, result.reward.data);
        ctx.setTimerPhase('rewarded');
        return true;
      });
    },
    async retryStudyReward() {
      const sessionId = ctx.rewardPendingSessionId;
      if (!sessionId || ctx.timerPhase === 'claiming-reward') return false;
      return withOperationLock(ctx.operationLocksRef, `study-reward:${sessionId}`, async () => {
        ctx.setTimerPhase('claiming-reward');
        ctx.setCompletionError('');
        const result = await ctx.claimCompletedStudyReward(sessionId);
        if (!result?.ok) {
          applyRewardFailure(ctx, result);
          return true;
        }
        ctx.setRewardPendingSessionId('');
        applyRewardState(ctx, result.data);
        ctx.setTimerPhase('rewarded');
        return true;
      });
    },
    dismissRewardResult() {
      if (!(ctx.rewardResult || (ctx.timerPhase === TERMINAL_REWARD_ERROR && ctx.rewardPendingSessionId))) return false;
      ctx.setRewardResult(null);
      ctx.setRewardPendingSessionId('');
      ctx.setLastCompletedSession(null);
      ctx.setCompletionError('');
      ctx.setTimerPhase('idle');
      return true;
    },
    toggleStudySessionDetails() {
      ctx.setStudySessionDetailsOpen((open) => !open);
      return true;
    },
    openGameRules() {
      ctx.setGameRulesOpen(true);
      return true;
    },
    closeGameRules() {
      ctx.setGameRulesOpen(false);
      return true;
    },
    retryStudySummary() {
      ctx.setStudySummaryRefreshTick((value) => numeric(value) + 1);
      return true;
    }
  };
}
