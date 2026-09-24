import assert from 'node:assert/strict';
import { saveNotificationPreferences } from '../src/features/account/api.js';
import { fetchMobileBacktrace } from '../src/features/analysis/api.js';
import { fetchStudyRanking } from '../src/features/planner/api.js';
import { createTimerHandlers } from '../src/handlers/timer-handlers.js';
import { HANDLER_STATE_FIELDS } from '../src/state/handler-state-actions.js';

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

const requests = [];
const apiFetch = async (_url, options) => {
  const payload = JSON.parse(options.body);
  requests.push(payload);
  if (payload.type === 'backtrace_required_raw') return response({ result: { reachable: true, minTotalRaw: 8 } });
  if (payload.type === 'get_study_ranking') return response({ rows: [{ rank: 1, name: '김*민', seconds: 3600 }], me: { rank: 1 } });
  return response({ success: true });
};

const prefs = await saveNotificationPreferences({ apiFetch, userApiUrl: '/user', preferences: { planner: false, weekly: true } });
assert.equal(prefs.ok, true);
assert.deepEqual(requests.at(-1).data.notificationPreferences, { planner: false, weekly: true, report: true, billing: true });

const ranking = await fetchStudyRanking({ apiFetch, userApiUrl: '/user', period: 'weekly' });
assert.equal(ranking.data.rows[0].seconds, 3600);
assert.equal(requests.at(-1).data.period, 'weekly');

let rankingRefreshCount = 0;
const timerStateActions = Object.fromEntries(HANDLER_STATE_FIELDS.timer.map((field) => [
  `set${field.charAt(0).toUpperCase()}${field.slice(1)}`,
  () => {}
]));
const timerPhases = [];
const timerHandlers = createTimerHandlers({
  ...timerStateActions,
  activeStudySession: { sessionId: 'session-5678', subject: '국어', startedAt: new Date(Date.now() - 60000).toISOString(), status: 'running' },
  activeStudySubject: '국어',
  activePlannerItemId: '',
  plannerItems: [],
  rewardPendingSessionId: '',
  studyRecords: [],
  studySubjectRecords: [],
  timerPhase: 'running',
  studyTimerRunning: true,
  studyTimerSecondsRef: { current: 60 },
  completeStudySession: async (_sessionId, onPhase) => {
    onPhase('settling-session');
    onPhase('claiming-reward');
    return {
      completion: { ok: true, data: { sessionId: 'session-5678', durationSeconds: 60, endedAt: new Date().toISOString() } },
      reward: {
        ok: true,
        data: {
          sessionId: 'session-5678', durationSeconds: 60, reward: { shells: 1, food: 1 },
          profile: { shellBalance: 1, foodBalance: 1, activeFishIds: [], dailyReward: {} }
        }
      }
    };
  },
  setTimerPhase: (phase) => timerPhases.push(phase),
  refreshStudyRanking: () => { rankingRefreshCount += 1; }
});
await timerHandlers.stopStudyTimer();
assert.equal(rankingRefreshCount, 1);
assert.deepEqual(timerPhases, ['settling-session', 'claiming-reward', 'rewarded']);

const backtrace = await fetchMobileBacktrace({
  apiFetch,
  analysisApiUrl: '/analysis',
  targetMajor: '연세대학교 정치외교학과',
  userScores: { kor: { raw: 80 } },
  examMode: 'jun'
});
assert.equal(backtrace.data.reachable, true);
assert.deepEqual(requests.at(-1).targetUniv, { univ: '연세대학교', major: '정치외교학과', date: null });
assert.equal(requests.at(-1).targetUiMin, 100);
assert.equal(requests.at(-1).maxTotalRaw, 20);

console.log('core-reliability contracts passed');
