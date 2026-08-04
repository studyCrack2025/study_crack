import assert from 'node:assert/strict';
import { createInitialAppState, hydrateAppState } from '../src/runtime/app-state.js';
import { buildAnalysisDerived } from '../src/runtime/derived.js';
import { buildAnalysisScoreView, buildUniversityCard } from '../src/features/analysis/score-store.js';
import { createUserDataResetPatch, mapUserToStatePatch } from '../src/runtime/session.js';

function createStorage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key)
  };
}

const initial = createInitialAppState();
assert.deepEqual(initial.user, { name: '', targetUniversity: '', plan: '' });
assert.equal(initial.targetMajor, '');
assert.deepEqual(initial.homeTargetList, []);
assert.deepEqual(initial.analysisTargetList, []);
assert.deepEqual(initial.scores, {});
assert.deepEqual(initial.plannerItems, []);

const legacyHydrated = hydrateAppState(initial, createStorage({
  scores: JSON.stringify({ korean: 82, math: 68, english: 77, inquiry1: 70, inquiry2: 66 }),
  plannerItems: JSON.stringify([
    { id: 'pl-default-1', date: '15', subject: '수학', content: '개념 학습' },
    { id: 'pl-user-1', date: '2026-07-15', subject: '영어', content: '직접 등록한 계획' }
  ]),
  selectedPlan: 'Pro',
  selectedUniversity: '연세대학교 경영학과'
}));
assert.deepEqual(legacyHydrated.scores, {});
assert.deepEqual(legacyHydrated.plannerItems.map((item) => item.id), ['pl-user-1']);
assert.equal(legacyHydrated.selectedPlan, '');
assert.equal(legacyHydrated.targetMajor, '');

const userHydrated = hydrateAppState(initial, createStorage({
  scores: JSON.stringify({ korean: 91, math: 88 }),
  plannerItems: JSON.stringify([{ id: 'pl-user-2', date: '2026-08-01', subject: '국어' }])
}));
assert.deepEqual(userHydrated.scores, { korean: 91, math: 88 });
assert.deepEqual(userHydrated.plannerItems.map((item) => item.id), ['pl-user-2']);

const reset = createUserDataResetPatch();
assert.deepEqual(reset.homeTargetList, []);
assert.deepEqual(reset.scores, {});
assert.deepEqual(reset.scoreCache, {});

const emptyPatch = mapUserToStatePatch({ role: 'student', quantitative: {}, targetUnivs: [] }, {
  user: { name: '이전 사용자' },
  selectedPlan: 'Pro',
  scores: { korean: 99 },
  homeTargetList: ['연세대학교 경영학과']
});
assert.equal(emptyPatch.user.name, '');
assert.equal(emptyPatch.selectedPlan, '');
assert.equal(emptyPatch.targetMajor, '');
assert.deepEqual(emptyPatch.homeTargetList, []);
assert.deepEqual(emptyPatch.analysisTargetList, []);
assert.deepEqual(emptyPatch.scores, {});

const populatedPatch = mapUserToStatePatch({
  role: 'student',
  name: '테스트 학생',
  computedTier: 'basic',
  targetUnivs: [{ univ: '연세대학교', major: '정치외교학과', date: '2026-07-30T00:00:00.000Z' }],
  quantitative: {
    jun: {
      kor: { raw: 88, opt: '언어와매체' },
      math: { raw: 84, opt: '미적분' },
      eng: { grd: 2 },
      inq1: { raw: 45, name: '생명과학I' },
      inq2: { raw: 44, name: '지구과학I' }
    }
  }
});
assert.equal(populatedPatch.selectedPlan, 'Basic');
assert.equal(populatedPatch.targetMajor, '연세대학교 정치외교학과');
assert.equal(populatedPatch.scores.korean, 88);
assert.equal(populatedPatch.analysisApiStatus, 'idle');
assert.equal(populatedPatch.scoreFetchStatus, 'idle');
assert.equal(populatedPatch.scoreFetchSignature, '');

const noServerAnalysis = buildAnalysisDerived({
  scores: { korean: 100, math: 100, english: 100, inquiry1: 50, inquiry2: 50 },
  targetMajor: '연세대학교 경영학과',
  analysisTargetList: ['연세대학교 경영학과'],
  homeTargetList: ['연세대학교 경영학과'],
  universityCatalog: [],
  analysisResults: [],
  analysisSimulations: []
});
assert.equal(noServerAnalysis.analysisSelected.score, 0);
assert.equal(noServerAnalysis.analysisSelected.comment, '');
assert.deepEqual(noServerAnalysis.analysisSelected.sim, []);
assert.deepEqual(noServerAnalysis.analysisSearchList, []);
assert.deepEqual(noServerAnalysis.analysisSimulationTargets, []);

const emptyCard = buildUniversityCard('연세대학교 경영학과', {}, 'jun', 'empty');
assert.equal(emptyCard.scoreStatus, 'empty');
assert.equal(emptyCard.rank, '분석 대기');
const emptyView = buildAnalysisScoreView('연세대학교 경영학과', {}, 'jun', 'empty');
assert.equal(emptyView.hasScore, false);
assert.equal(emptyView.status, '분석 대기');

console.log('production-state contracts passed');
