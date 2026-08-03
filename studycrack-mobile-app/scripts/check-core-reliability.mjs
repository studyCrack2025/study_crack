import assert from 'node:assert/strict';
import {
  fetchMobileBacktrace,
  fetchStudyRanking,
  saveNotificationPreferences,
  saveStudySession
} from '../src/runtime/persistence.js';

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
assert.equal(ranking.rows[0].seconds, 3600);
assert.equal(requests.at(-1).data.period, 'weekly');

const backtrace = await fetchMobileBacktrace({
  apiFetch,
  analysisApiUrl: '/analysis',
  targetMajor: '연세대학교 정치외교학과',
  userScores: { kor: { raw: 80 } },
  examMode: 'jun'
});
assert.equal(backtrace.plan.reachable, true);
assert.deepEqual(requests.at(-1).targetUniv, { univ: '연세대학교', major: '정치외교학과', date: null });
assert.equal(requests.at(-1).targetUiMin, 100);
assert.equal(requests.at(-1).maxTotalRaw, 20);

console.log('core-reliability contracts passed');
