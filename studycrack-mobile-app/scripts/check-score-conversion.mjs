import assert from 'node:assert/strict';
import { convertExamScores } from '../src/runtime/persistence.js';

const requests = [];
const metrics = {
  kor: { std: 132, pct: 91, grd: 2 },
  math: { std: 128, pct: 87, grd: 3 },
  inq1: { std: 64, pct: 89, grd: 2 },
  inq2: { std: 61, pct: 82, grd: 3 }
};
const apiFetch = async (_url, options) => {
  const payload = JSON.parse(options.body);
  requests.push(payload);
  return { ok: true, json: async () => metrics[payload.subject] };
};
const examData = {
  kor: { opt: '언어와매체', common: 58, elective: 20, raw: 78 },
  math: { opt: '미적분', common: 55, elective: 21, raw: 76 },
  eng: { grd: 2 },
  hist: { grd: 1 },
  inq1: { name: '생활과 윤리', raw: 45 },
  inq2: { name: '사회·문화', raw: 43 }
};

const converted = await convertExamScores({ apiFetch, analysisApiUrl: '/analysis', examMode: 'jun', examData });
assert.equal(converted.ok, true);
assert.deepEqual(converted.examData.kor, { ...examData.kor, ...metrics.kor });
assert.deepEqual(converted.examData.inq2, { ...examData.inq2, ...metrics.inq2 });
assert.equal(requests.length, 4);
assert.deepEqual(
  requests.find((item) => item.subject === 'kor'),
  { type: 'convert_score', subject: 'kor', score: 78, opt: '언어와매체', common: 58, elective: 20, month: 'jun' }
);
assert.deepEqual(
  requests.find((item) => item.subject === 'inq1'),
  { type: 'convert_score', subject: 'inq1', score: 45, subName: '생활과 윤리', month: 'jun' }
);

const unavailable = await convertExamScores({
  apiFetch: async () => ({ ok: true, json: async () => ({ std: '-', pct: '-', grd: '-' }) }),
  analysisApiUrl: '/analysis',
  examMode: 'jun',
  examData
});
assert.equal(unavailable.ok, false);
assert.match(unavailable.error, /성적표 데이터/);

console.log('score-conversion contracts passed');
