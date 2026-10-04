import { getTodayDateKey } from '../constants/runtime-defaults.js';
import { currentRecovery, currentStudy, MAX_PENDING_REWARDS, saveStudyRecovery } from '../features/study/recovery.js';
import { withOperationLock } from '../shared/async/operation-lock.js';
import { getData } from './action-utils.js';
import { loadMobileModule } from '../shared/browser/mobile-runtime.js';

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
  if (!currentStudy(ctx).activeStudySession) ctx.setTimerPhase(terminal ? TERMINAL_REWARD_ERROR : RECOVERABLE_ERROR);
  ctx.setRewardRecoveryError(result?.error || '보상을 확인하지 못했습니다. 새 공부는 시작할 수 있어요.');
}

function scoped(ctx) { return !ctx.isCurrentProfile || ctx.isCurrentProfile(); }

function settleReward(ctx, sessionId, result) {
  if (!scoped(ctx)) return;
  if (result?.code === 'REWARD_BUSY') return;
  if (result?.ok && result.data?.sessionId !== sessionId) result = { ok: false };
  ctx.setRewardClaimingSessionId('');
  const recovery = currentRecovery(ctx);
  const pending = result?.ok ? recovery.pending.filter(row => row.sessionId !== sessionId)
    : recovery.pending.map(row => row.sessionId === sessionId ? { ...row, status: /^STUDY_SESSION_NOT_(FOUND|REWARDABLE)$/.test(result?.code) ? 'terminal' : 'pending' } : row);
  if (!saveStudyRecovery(ctx, { ...recovery, pending })) return;
  if (!result?.ok) { applyRewardFailure(ctx, result); return; }
  applyRewardState(ctx, result.data);
  if (!currentStudy(ctx).activeStudySession) ctx.setTimerPhase('rewarded');
}

function applyRewardState(ctx, rewardData) {
  if (!rewardData?.profile) return;
  ctx.setGameProfile(rewardData.profile);
  ctx.setGameProfileStatus('ready');
  ctx.setGameProfileError('');
  const study = currentStudy(ctx);
  const shownSession = study.activeStudySession || study.lastCompletedSession;
  if (!shownSession || shownSession.sessionId === rewardData.sessionId) ctx.setRewardResult({
    sessionId: rewardData.sessionId,
    durationSeconds: numeric(rewardData.durationSeconds),
    shells: numeric(rewardData.reward?.shells),
    food: numeric(rewardData.reward?.food),
    ...(rewardData.reward?.ticketPolicyVersion ? { tickets: numeric(rewardData.reward.tickets), creditedSeconds: numeric(rewardData.reward.creditedSeconds), ticketPolicyVersion: rewardData.reward.ticketPolicyVersion } : {}),
    alreadyClaimed: rewardData.alreadyClaimed === true
  });
  ctx.setGameRefreshTick((value) => numeric(value) + 1);
}

function applyCompletedSession(ctx, completion, sourceSession = ctx.activeStudySession) {
  if (!scoped(ctx)) return false;
  ctx.setStudySummaryRefreshTick((value) => numeric(value) + 1);
  ctx.refreshStudyRanking?.();
  const state = currentStudy(ctx);
  const recovery = currentRecovery(ctx);
  const applied = recovery.applied.includes(completion.sessionId);
  const pending = recovery.pending.some(row => row.sessionId === completion.sessionId) || applied
    ? recovery.pending : [...recovery.pending, { sessionId: completion.sessionId, status: 'pending' }];
  if (pending.length > MAX_PENDING_REWARDS || state.rewardRecoveryError?.startsWith('복구 기록을 읽지')) {
    ctx.setRewardRecoveryError('보상 복구 목록을 먼저 확인해주세요. 완료 기록은 서버에 저장되어 있어요.');
    return false;
  }
  const duration = Math.max(1, numeric(completion.durationSeconds) || 1);
  const subject = completion.subject || sourceSession?.subject || '기타';
  const plannerItemId = completion.plannerItemId || sourceSession?.plannerItemId || '';
  const activity = completion.activity || sourceSession?.activity || `${subject} 학습`;
  const date = getTodayDateKey(new Date(completion.endedAt || Date.now()));
  const records = applied ? recovery.records || state.studyRecords || [] : mutateStudyRecord(recovery.records || state.studyRecords, date, duration);
  const subjects = applied ? recovery.subjects || state.studySubjectRecords || [] : mutateSubjectRecord(recovery.subjects || state.studySubjectRecords, date, subject, duration);
  if (!saveStudyRecovery(ctx, { pending, applied: applied ? recovery.applied : [...recovery.applied, completion.sessionId].slice(-128), records, subjects })) return false;
  ctx.setStudyRecords(records);
  ctx.setStudySubjectRecords(subjects);
  if (plannerItemId && !applied) {
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
  ctx.setTimerPhase('idle');
  return true;
}

async function beginStudy(ctx, subject, activity, plannerItemId = '', storedCandidate = null) {
  const recovery = currentRecovery(ctx);
  if (!subject || (!storedCandidate && ctx.activeStudySession) || /-session$/.test(ctx.timerPhase)) return false;
  if (recovery.pending.length >= MAX_PENDING_REWARDS || ctx.rewardRecoveryError?.startsWith('복구 기록')) {
    ctx.setRewardRecoveryError('복구 기록을 먼저 확인해주세요. 저장 공간 또는 보상 복구 목록이 가득 찼어요.');
    return false;
  }
  return withOperationLock(ctx.operationLocksRef, 'study-start', async () => {
    const candidate = storedCandidate || { sessionId: createSessionId(), subject, activity, plannerItemId, status: 'starting' };
    ctx.setTimerPhase('starting-session');
    ctx.setStudyPanelMode('timer');
    ctx.setStudySubjectSheetOpen(false);
    ctx.setCompletionError('');
    ctx.setRewardResult(null);
    ctx.setLastCompletedSession(null);
    ctx.setActiveStudySession(candidate);
    const response = await ctx.startStudySession(candidate);
    if (!scoped(ctx)) return true;
    if (!response?.ok) {
      ctx.setTimerPhase(RECOVERABLE_ERROR);
      ctx.setCompletionError(response?.error || '공부 시작을 기록하지 못했습니다. 다시 시도해주세요.');
      return true;
    }
    if (response.data?.status === 'completed') {
      if (!applyCompletedSession(ctx, response.data, candidate)) ctx.setTimerPhase(RECOVERABLE_ERROR);
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
    openStudyPanel() {
      ctx.setStudyPanelMode('timer');
      return true;
    },
    openStudyRecords() {
      ctx.closeDrawer?.();
      ctx.goto?.('timer');
      ctx.setStudyPanelMode('records');
      return true;
    },
    closeStudyPanel({ actionEl, isOverlaySelfClick }) {
      if (!isOverlaySelfClick && actionEl?.classList?.contains?.('sc-overlay')) return false;
      ctx.setStudyPanelMode('');
      return true;
    },
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
    startPlannedStudy({ actionEl }) {
      const id = getData(actionEl, 'study-item-id');
      const item = (ctx.todayPlannerItems || []).find((row) => row.id === id && !row.done);
      if (!ctx.canUsePersonalPlanner || !item || ctx.activeStudySession || /-session$/.test(ctx.timerPhase)) return false;
      const subject = String(item.subject || '기타').trim().slice(0, 30);
      const activity = String(item.content || '').trim().slice(0, 80);
      if (!activity) {
        ctx.setStudyStartDraft({ subject, activity: '', plannerItemId: item.id });
        ctx.setStudySubjectSheetOpen(true);
        return true;
      }
      return beginStudy(ctx, subject, activity, item.id);
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
        ctx.setTimerPhase('settling-session');
        const pipeline = await loadMobileModule(() => import('../features/study/reward-pipeline.js')).catch(() => null);
        if (!scoped(ctx)) return false;
        const result = pipeline ? await pipeline.completeStudyRewardPipeline({
          sessionId: session.sessionId,
          completeSession: id => ctx.completeStudySession(id),
          onCompleted: completion => {
            if (!applyCompletedSession(ctx, completion, session)) return false;
            return true;
          },
          claimReward: async id => {
            if (!scoped(ctx) || currentStudy(ctx).rewardClaimingSessionId || ctx.operationLocksRef?.current?.has('study-reward')) return { ok: false, code: 'REWARD_BUSY' };
            ctx.setRewardClaimingSessionId(id);
            return withOperationLock(ctx.operationLocksRef, 'study-reward', () => ctx.claimCompletedStudyReward(id));
          }
        }) : { completion: { ok: false } };
        if (!scoped(ctx)) return true;
        if (!result.completion?.ok) {
          ctx.setStudyTimerRunning(true);
          ctx.startLiveStudyTimer?.(session.startedAt, (seconds) => ctx.setStudyTimerTick(seconds));
          ctx.setTimerPhase(RECOVERABLE_ERROR);
          ctx.setCompletionError(result.completion?.error || '공부 완료를 확인하지 못했습니다. 기록은 유지됩니다.');
          return true;
        }
        if (result.stage === 'recovery-storage') {
          ctx.setTimerPhase(RECOVERABLE_ERROR);
          ctx.setCompletionError('완료는 저장됐지만 기기 복구 기록을 저장하지 못했어요. 같은 기록으로 다시 확인해주세요.');
          return true;
        }
        settleReward(ctx, session.sessionId, result.reward);
        return true;
      });
    },
    async retryStudyReward() {
      const sessionId = currentRecovery(ctx).pending.find(row => row.status !== 'terminal')?.sessionId;
      if (!sessionId || currentStudy(ctx).rewardClaimingSessionId) return false;
      return withOperationLock(ctx.operationLocksRef, 'study-reward', async () => {
        ctx.setRewardClaimingSessionId(sessionId);
        let result;
        try { result = await ctx.claimCompletedStudyReward(sessionId); }
        catch { result = { ok: false, error: '보상 연결을 다시 확인해주세요.' }; }
        settleReward(ctx, sessionId, result);
        return true;
      });
    },
    dismissRewardResult({ actionEl } = {}) {
      if (getData(actionEl, 'dismiss-terminal') === 'true') {
        const recovery = currentRecovery(ctx);
        const terminal = recovery.pending.find(row => row.status === 'terminal');
        if (!terminal) return false;
        saveStudyRecovery(ctx, { ...recovery, pending: recovery.pending.filter(row => row.sessionId !== terminal.sessionId) });
        return true;
      }
      if (!(ctx.rewardResult || (ctx.timerPhase === TERMINAL_REWARD_ERROR && ctx.rewardPendingSessionId))) return false;
      ctx.setRewardResult(null);
      const recovery = currentRecovery(ctx);
      if (ctx.timerPhase === TERMINAL_REWARD_ERROR) {
        if (!saveStudyRecovery(ctx, { ...recovery, pending: recovery.pending.filter(row => row.sessionId !== ctx.rewardPendingSessionId) })) return true;
      }
      ctx.setLastCompletedSession(null);
      ctx.setCompletionError('');
      if (!currentStudy(ctx).activeStudySession) ctx.setTimerPhase('idle');
      ctx.setStudyPanelMode('');
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
