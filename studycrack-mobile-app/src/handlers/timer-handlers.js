import { getTodayDateKey } from '../constants/runtime-defaults.js';
import { createStudySessionCandidate } from '../features/study/session-model.js';
import { getData } from './action-utils.js';

function setRefValue(ref, value) {
  if (ref && typeof ref === 'object') ref.current = value;
}

function mutateStudyRecord(records, date, elapsed) {
  const list = Array.isArray(records) ? records : [];
  const index = list.findIndex((row) => row.date === date);
  if (index < 0) return [...list, { date, studyTime: elapsed }];
  const next = [...list];
  next[index] = { ...next[index], studyTime: (Number(next[index].studyTime) || 0) + elapsed };
  return next;
}

function mutateSubjectRecord(records, date, subject, elapsed) {
  const list = Array.isArray(records) ? records : [];
  const index = list.findIndex((row) => row.date === date);
  if (index < 0) return [...list, { date, subjects: { [subject]: elapsed } }];
  const next = [...list];
  const subjects = next[index].subjects || {};
  next[index] = { ...next[index], subjects: { ...subjects, [subject]: (Number(subjects[subject]) || 0) + elapsed } };
  return next;
}

function createSessionId() {
  return globalThis.crypto?.randomUUID?.() || `study-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function applyRewardState(ctx, rewardData) {
  if (!rewardData?.profile) return;
  ctx.setGameProfile(rewardData.profile);
  ctx.setGameProfileStatus('ready');
  ctx.setGameProfileError('');
  ctx.setRewardResult({
    sessionId: rewardData.sessionId,
    durationSeconds: Number(rewardData.durationSeconds) || 0,
    shells: Number(rewardData.reward?.shells) || 0,
    food: Number(rewardData.reward?.food) || 0,
    alreadyClaimed: rewardData.alreadyClaimed === true
  });
  ctx.setGameRefreshTick((value) => Number(value || 0) + 1);
}

function applyCompletedSession(ctx, completion) {
  const duration = Math.max(1, Number(completion.durationSeconds) || 1);
  const subject = ctx.activeStudySubject || ctx.activeStudySession?.subject || '기타';
  const plannerItemId = ctx.activePlannerItemId || ctx.activeStudySession?.plannerItemId || '';
  const date = getTodayDateKey(new Date(completion.endedAt || Date.now()));
  ctx.setStudyRecords((records) => mutateStudyRecord(records, date, duration));
  ctx.setStudySubjectRecords((records) => mutateSubjectRecord(records, date, subject, duration));
  if (plannerItemId) {
    ctx.setPlannerItems((items) => items.map((item) => (
      item.id === plannerItemId ? { ...item, doneMinutes: (Number(item.doneMinutes) || 0) + Math.round(duration / 60) } : item
    )));
  }
  ctx.setLastCompletedSession({ ...completion, subject, plannerItemId });
  ctx.setActiveStudySession(null);
  ctx.setActiveStudySubject('');
  ctx.setActivePlannerItemId('');
  setRefValue(ctx.studyTimerSecondsRef, 0);
  ctx.setStudyTimerTick(0);
  ctx.syncLiveStudyTimerUi?.(0);
  ctx.refreshStudyRanking?.();
  ctx.setStudySummaryRefreshTick((value) => Number(value || 0) + 1);
}

async function beginStudy(ctx, subject, plannerItemId = '', storedCandidate = null) {
  if (!subject || ['starting-session', 'settling-session', 'claiming-reward'].includes(ctx.timerPhase)) return false;
  const candidate = storedCandidate || createStudySessionCandidate({ sessionId: createSessionId(), subject, plannerItemId });
  ctx.setTimerPhase('starting-session');
  ctx.setCompletionError('');
  ctx.setRewardResult(null);
  ctx.setActiveStudySession(candidate);
  const response = await ctx.startStudySession(candidate);
  if (!response?.ok) {
    ctx.setTimerPhase('recoverable-error');
    ctx.setCompletionError(response?.error || '공부 시작을 기록하지 못했습니다. 다시 시도해주세요.');
    return true;
  }
  const session = { ...candidate, ...response.data, subject, plannerItemId, status: 'running' };
  ctx.setActiveStudySession(session);
  ctx.setActiveStudySubject(subject);
  ctx.setActivePlannerItemId(plannerItemId);
  ctx.setStudySubjectSheetOpen(false);
  ctx.setStudySubjectSheetOnlyPlanned(false);
  ctx.setStudyTimerRunning(true);
  ctx.setTimerPhase('running');
  setRefValue(ctx.studyTimerSecondsRef, 0);
  ctx.startLiveStudyTimer?.(session.startedAt, (seconds) => ctx.setStudyTimerTick(seconds));
  ctx.syncLiveStudyTimerUi?.(0);
  return true;
}

export function createTimerHandlers(ctx) {
  const {
    preserveScrollAfterStateChange = (fn) => fn?.(),
    prompt = globalThis.prompt
  } = ctx;
  return {
    openStudySubjectSheet() {
      preserveScrollAfterStateChange(() => {
        ctx.setNotifModalOpen(false);
        ctx.setCompletionError('');
        ctx.setStudySubjectSheetOnlyPlanned(false);
        ctx.setStudySubjectSheetOpen(true);
      });
      return true;
    },
    closeStudySubjectSheet({ actionEl, isOverlaySelfClick }) {
      if (!isOverlaySelfClick && actionEl?.classList?.contains?.('planner-sheet-overlay')) return false;
      preserveScrollAfterStateChange(() => {
        ctx.setStudySubjectSheetOnlyPlanned(false);
        ctx.setStudySubjectSheetOpen(false);
      });
      return true;
    },
    selectStudySubjectCustom() {
      const custom = prompt?.('과목명을 입력하세요', '기타');
      return custom ? beginStudy(ctx, custom, '') : false;
    },
    selectSelfStudy() {
      return beginStudy(ctx, '기타', '');
    },
    selectStudySubject({ actionEl }) {
      const subject = getData(actionEl, 'study-subject');
      return subject ? beginStudy(ctx, subject, getData(actionEl, 'study-item-id')) : false;
    },
    retryStudyStart() {
      const session = ctx.activeStudySession;
      if (!session || session.status !== 'starting') return false;
      return beginStudy(ctx, session.subject, session.plannerItemId || '', session);
    },
    async stopStudyTimer() {
      const session = ctx.activeStudySession;
      if (!session || !['running', 'recoverable-error'].includes(ctx.timerPhase)) return false;
      ctx.setStudyTimerRunning(false);
      ctx.stopLiveStudyTimer?.();
      ctx.setCompletionError('');
      const result = await ctx.completeStudySession(session.sessionId, (phase) => ctx.setTimerPhase(phase));
      if (!result.completion?.ok) {
        ctx.setStudyTimerRunning(true);
        ctx.startLiveStudyTimer?.(session.startedAt, (seconds) => ctx.setStudyTimerTick(seconds));
        ctx.setTimerPhase('recoverable-error');
        ctx.setCompletionError(result.completion?.error || '공부 완료를 확인하지 못했습니다. 기록은 유지됩니다.');
        return true;
      }
      applyCompletedSession(ctx, result.completion.data);
      if (!result.reward?.ok) {
        ctx.setRewardPendingSessionId(session.sessionId);
        ctx.setTimerPhase('recoverable-error');
        ctx.setCompletionError(result.reward?.error || '공부 기록은 저장됐지만 보상을 불러오지 못했습니다.');
        return true;
      }
      ctx.setRewardPendingSessionId('');
      applyRewardState(ctx, result.reward.data);
      ctx.setTimerPhase('rewarded');
      return true;
    },
    async retryStudyReward() {
      const sessionId = ctx.rewardPendingSessionId;
      if (!sessionId || ctx.timerPhase === 'claiming-reward') return false;
      ctx.setTimerPhase('claiming-reward');
      ctx.setCompletionError('');
      const result = await ctx.claimCompletedStudyReward(sessionId);
      if (!result?.ok) {
        ctx.setTimerPhase('recoverable-error');
        ctx.setCompletionError(result?.error || '보상을 다시 확인하지 못했습니다.');
        return true;
      }
      ctx.setRewardPendingSessionId('');
      applyRewardState(ctx, result.data);
      ctx.setTimerPhase('rewarded');
      return true;
    },
    dismissRewardResult() {
      ctx.setRewardResult(null);
      ctx.setCompletionError('');
      ctx.setTimerPhase('idle');
      return true;
    },
    retryGameResources() {
      ctx.setGameRefreshTick((value) => Number(value || 0) + 1);
      return true;
    },
    retryStudySummary() {
      ctx.setStudySummaryRefreshTick((value) => Number(value || 0) + 1);
      return true;
    }
  };
}
