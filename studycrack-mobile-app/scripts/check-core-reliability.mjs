import assert from 'node:assert/strict';
import { saveNotificationPreferences } from '../src/features/account/api.js';
import { fetchMobileBacktrace } from '../src/features/analysis/api.js';
import { fetchStudyRanking, saveStudySession } from '../src/features/planner/api.js';
import { createPlannerHandlers } from '../src/handlers/planner-handlers.js';

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

const study = await saveStudySession({ apiFetch, userApiUrl: '/user', session: { sessionId: 'session-1234', subject: '수학', durationSeconds: 60 } });
assert.equal(study.ok, true);
assert.equal(requests.at(-1).type, 'record_study_session');

const prefs = await saveNotificationPreferences({ apiFetch, userApiUrl: '/user', preferences: { planner: false, weekly: true } });
assert.equal(prefs.ok, true);
assert.deepEqual(requests.at(-1).data.notificationPreferences, { planner: false, weekly: true, report: true, billing: true });

const ranking = await fetchStudyRanking({ apiFetch, userApiUrl: '/user', period: 'weekly' });
assert.equal(ranking.data.rows[0].seconds, 3600);
assert.equal(requests.at(-1).data.period, 'weekly');

let rankingRefreshCount = 0;
const timerHandlers = createPlannerHandlers({
  activeStudySession: { sessionId: 'session-5678', subject: '국어', startedAt: new Date(Date.now() - 60000).toISOString(), status: 'running' },
  activeStudySubject: '국어',
  studyTimerRunning: true,
  studyTimerSecondsRef: { current: 60 },
  persistStudySession: async () => ({ ok: true }),
  refreshStudyRanking: () => { rankingRefreshCount += 1; }
});
await timerHandlers.stopStudyTimer();
assert.equal(rankingRefreshCount, 1);

const duplicateTimerHandlers = createPlannerHandlers({
  activeStudySession: { sessionId: 'session-duplicate', subject: '영어', startedAt: new Date(Date.now() - 30000).toISOString(), status: 'running' },
  activeStudySubject: '영어',
  studyTimerRunning: true,
  studyTimerSecondsRef: { current: 30 },
  persistStudySession: async () => ({ ok: false, code: 'STUDY_SESSION_DUPLICATE' }),
  refreshStudyRanking: () => { rankingRefreshCount += 1; }
});
await duplicateTimerHandlers.stopStudyTimer();
assert.equal(rankingRefreshCount, 2);

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
