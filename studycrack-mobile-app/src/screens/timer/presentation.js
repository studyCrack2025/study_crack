export function defaultFormatHms(total) {
  const safe = Math.max(0, Math.floor(Number(total) || 0));
  const hour = Math.floor(safe / 3600);
  const minute = Math.floor((safe % 3600) / 60);
  const second = safe % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

export function buildTimerJourneyPresentation({
  activeStudySession = null,
  completionError = '',
  lastCompletedSession = null,
  rewardPendingSessionId = '',
  rewardResult = null,
  timerPhase = 'idle'
} = {}) {
  const completionConfirmed = timerPhase === 'claiming-reward' || timerPhase === 'rewarded'
    || Boolean(lastCompletedSession) || Boolean(rewardPendingSessionId) || Boolean(rewardResult);
  const session = lastCompletedSession || activeStudySession || null;
  const startingFailed = timerPhase === 'recoverable-error' && activeStudySession?.status === 'starting';
  const completionFailed = timerPhase === 'recoverable-error' && activeStudySession?.status === 'running';
  const terminalRewardFailure = timerPhase === 'terminal-reward-error' && Boolean(rewardPendingSessionId);
  const rewardFailed = (timerPhase === 'recoverable-error' || terminalRewardFailure) && Boolean(rewardPendingSessionId);
  const sessionState = completionConfirmed
    ? 'complete'
    : activeStudySession?.status === 'running'
      ? 'running'
      : activeStudySession?.status === 'starting'
        ? (startingFailed ? 'error' : 'starting')
        : 'idle';
  const completionState = completionConfirmed
    ? 'complete'
    : timerPhase === 'settling-session'
      ? 'active'
      : completionFailed
        ? 'error'
        : 'pending';
  const rewardState = rewardResult
    ? 'complete'
    : timerPhase === 'claiming-reward'
      ? 'active'
      : rewardFailed
        ? 'error'
        : 'pending';
  const subject = String(session?.subject || '').trim();
  const studyLabel = subject ? `${subject} 공부` : '공부';
  const activity = String(session?.activity || '').trim();
  const hasReward = Boolean(rewardResult) && (Number(rewardResult.shells) > 0 || Number(rewardResult.food) > 0);

  let title = '';
  let detail = activity;
  let retryAction = '';
  let retryLabel = '';
  if (startingFailed) {
    title = '공부 시작을 다시 연결해주세요';
    detail = completionError;
    retryAction = 'retryStudyStart';
    retryLabel = '공부 시작 다시 연결';
  } else if (completionFailed) {
    title = '공부 완료를 다시 확인해주세요';
    detail = completionError;
    retryAction = 'stopStudyTimer';
    retryLabel = '완료 다시 확인';
  } else if (rewardFailed) {
    title = lastCompletedSession ? `${studyLabel}를 완료했어요` : '공부 기록은 안전하게 저장됐어요';
    detail = completionError || activity;
    if (!terminalRewardFailure) {
      retryAction = 'retryStudyReward';
      retryLabel = '보상 다시 확인';
    }
  } else if (completionConfirmed) {
    title = `${studyLabel}를 완료했어요`;
  } else if (timerPhase === 'settling-session') {
    title = '공부 기록을 저장하고 있어요';
  } else if (sessionState === 'running') {
    title = `${studyLabel}를 이어서 기록 중이에요`;
  } else if (sessionState === 'starting') {
    title = `${studyLabel}를 시작하고 있어요`;
  }

  return {
    completionState,
    detail,
    durationLabel: lastCompletedSession ? defaultFormatHms(lastCompletedSession.durationSeconds) : '',
    hasCompletedSummary: Boolean(lastCompletedSession),
    hasReward,
    recoveryDismissible: terminalRewardFailure,
    retryAction,
    retryLabel,
    rewardState,
    rewardTitle: rewardResult
      ? (hasReward ? '수조가 한 걸음 성장했어요' : '공부 기록이 차곡차곡 쌓였어요')
      : '',
    session,
    sessionState,
    title,
    visible: timerPhase !== 'idle' || Boolean(activeStudySession) || completionConfirmed
  };
}

export function defaultFormatMinutesLabel(minutes) {
  const safeMinutes = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safeMinutes / 60);
  const minute = safeMinutes % 60;
  if (hour && minute) return `${hour}시간 ${minute}분`;
  if (hour) return `${hour}시간`;
  return `${minute}분`;
}
