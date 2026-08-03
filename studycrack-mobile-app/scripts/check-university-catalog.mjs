import assert from 'node:assert/strict';
import { fetchUniversityRecommendations, normalizeUniversityCatalog } from '../src/runtime/persistence.js';

const catalog = normalizeUniversityCatalog([
  { univName: '연세대학교', majors: ['경영학과', '정치외교학과', '경영학과'] },
  { univName: '고려대학교', majors: [{ name: '경영학과' }, { name: '컴퓨터학과' }] }
]);
assert.deepEqual(catalog, [
  { univName: '고려대학교', majors: ['경영학과', '컴퓨터학과'] },
  { univName: '연세대학교', majors: ['경영학과', '정치외교학과'] }
]);

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
assert.deepEqual(recommendation.recommendations, ['연세대학교 정치외교학과']);
assert.equal(request.type, 'get_tutorial_recommendations');
assert.equal(request.stream, 'natural');
assert.equal(request.totalStdScore, 375);
assert.deepEqual(request.excludeUnivs, [{ univ: '고려대학교', major: '경영학과', date: null }]);

console.log('university-catalog contracts passed');
