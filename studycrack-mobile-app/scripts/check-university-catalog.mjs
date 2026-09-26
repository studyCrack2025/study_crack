import assert from 'node:assert/strict';
import { fetchUniversityCatalog, fetchUniversityRecommendations, normalizeUniversityCatalog } from '../src/features/analysis/api.js';
import { buildAnalysisDerived } from '../src/runtime/derived.js';
import { buildTargetPolicy } from '../src/features/analysis/target-policy.js';
import { saveTargetUnivs } from '../src/features/account/api.js';

const basic = { userTier: 'basic', user: { univChangeRemaining: 0 } };
assert.equal(buildTargetPolicy(basic).canAdd, false);
assert.equal(buildTargetPolicy({ ...basic, user: { univChangeRemaining: 1 } }).canAdd, true);
assert.equal(buildTargetPolicy({ user: {} }).remaining, null);
const thrownLimit = await saveTargetUnivs({ userApiUrl: '/user', targetList: [], apiFetch: async () => { throw Object.assign(new Error('남은 변경 횟수(0회)가 부족합니다.'), { status: 400 }); } });
assert.equal(thrownLimit.code, 'TARGET_CHANGE_LIMIT');
assert.equal(thrownLimit.data.remainCount, 0);
assert.equal(buildTargetPolicy({ ...basic, user: { univChangeRemaining: 0, currentSubscription: { tier: 'standard', status: 'active', startDate: new Date(Date.now() - 1000).toISOString(), endDate: new Date(Date.now() + 86400000).toISOString() } } }).unlimited, true);
assert.equal(buildTargetPolicy({ ...basic, user: { univChangeRemaining: 10 }, targetUnivSlots: Array.from({ length: 6 }, (_, i) => ({ univ: '대학', major: String(i) })) }).canAdd, false);
for (const [message, code] of [['남은 변경 횟수(0회)가 부족합니다.', 'TARGET_CHANGE_LIMIT'], ['internal details should not leak', '']]) {
  const result = await saveTargetUnivs({ userApiUrl: '/user', targetList: [], apiFetch: async () => ({ ok: false, status: 400, json: async () => ({ error: message }) }) });
  assert.equal(result.ok, false);
  assert.equal(result.code, code);
  assert.notEqual(result.error, message, 'only allowlisted validation failures receive a local explanation');
  if (code) assert.equal(result.data.remainCount, 0);
}

const catalog = normalizeUniversityCatalog([
  { univName: '연세대학교', majors: ['경영학과', '정치외교학과', '경영학과'] },
  { univName: '고려대학교', majors: [{ name: '경영학과' }, { name: '컴퓨터학과' }] }
]);
assert.deepEqual(catalog, [
  { univName: '고려대학교', majors: ['경영학과', '컴퓨터학과'] },
  { univName: '연세대학교', majors: ['경영학과', '정치외교학과'] }
]);

const selectedWithSpacing = buildAnalysisDerived({
  universityCatalog: catalog,
  universitySelectedName: '연세 대학교',
  analysisSearchTerm: '정치'
});
assert.deepEqual(selectedWithSpacing.analysisSearchList, ['연세 대학교 정치외교학과']);

const fetchedCatalog = await fetchUniversityCatalog({
  apiFetch: async () => ({ ok: true, json: async () => [{ univName: '연세대학교', majors: ['경영학과', '정치외교학과'] }] }),
  analysisApiUrl: '/analysis'
});
assert.equal(fetchedCatalog.ok, true);
assert.deepEqual(fetchedCatalog.data[0].majors, ['경영학과', '정치외교학과']);

const failedCatalog = await fetchUniversityCatalog({
  apiFetch: async () => ({ ok: false, status: 503, json: async () => ({ error: '카탈로그 준비 중' }) }),
  analysisApiUrl: '/analysis'
});
assert.equal(failedCatalog.ok, false);
assert.equal(failedCatalog.code, 'SERVER_ERROR');
assert.match(failedCatalog.error, /서버 응답을 확인하지 못했어요/);

let request = null;
const recommendation = await fetchUniversityRecommendations({
  apiFetch: async (_url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ selected: [{ school: '연세대학교', major: '정치외교학과' }] }) };
  },
  analysisApiUrl: '/analysis',
  examMode: 'jun',
  examData: {
    kor: { std: 125 },
    math: { std: 128, opt: '미적분' },
    inq1: { std: 62, name: '생명과학1' },
    inq2: { std: 60, name: '지구과학1' }
  },
  excludeTargets: ['고려대학교 경영학과']
});
assert.equal(recommendation.ok, true);
assert.deepEqual(recommendation.data, ['연세대학교 정치외교학과']);
assert.equal(request.type, 'get_tutorial_recommendations');
assert.equal(request.stream, 'natural');
assert.equal(request.totalStdScore, 375);
assert.deepEqual(request.excludeUnivs, [{ univ: '고려대학교', major: '경영학과', date: null }]);

console.log('university-catalog contracts passed');
