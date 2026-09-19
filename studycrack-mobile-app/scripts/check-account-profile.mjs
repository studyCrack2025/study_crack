import assert from 'node:assert/strict';
import { buildAccountProfile } from '../src/features/account/profile-presentation.js';
import { createProfileHandlers } from '../src/handlers/profile-handlers.js';
import { createAnalysisHandlers } from '../src/handlers/analysis-handlers.js';
import { MBTI_QUESTIONS } from '../src/constants/mbti.js';
import { createMobileViewContext } from '../src/app/mobile-view-context.js';
import { createInitialAppState, selectFlatAppState } from '../src/state/app-state-schema.js';

const user = { name: '검수 학생', targetUniversity: '연세대학교 정치외교학과', qualitative: { status: '고3', stream: 'natural', mbti: 'CSDR' }, quantitative: { mar: { kor: { std: 120 }, math: { std: 120 }, eng: { grade: 2 }, hist: { grade: 1 }, inq1: { std: 60 }, inq2: { std: 60 } } } };
const saved = buildAccountProfile({ user, userLoadStatus: 'ready' });
assert.equal(saved.meta, '고3 · 자연계');
assert.equal(saved.checklist.filter(row => row.complete).length, 4);
assert.equal(saved.mbtiCode, 'CSDR');
const serverGrades = { ...user, quantitative: { mar: { ...user.quantitative.mar, eng: { grd: '2' }, hist: { grd: 1 } } } };
assert.equal(buildAccountProfile({ user: serverGrades, userLoadStatus: 'ready' }).checklist.find(row => row.id === 'scores').complete, true);
assert.ok(Object.isFrozen(saved) && Object.isFrozen(saved.checklist) && Object.isFrozen(saved.checklist[0]));
const empty = buildAccountProfile({ user: {}, userLoadStatus: 'ready', mbtiResult: 'CSDR', targetMajor: '임시 목표' });
assert.equal(empty.checklist.filter(row => row.complete).length, 0);
assert.equal(empty.mbtiCode, '');
assert.equal(empty.target, '');
assert.equal(empty.checklist[0].target, 'ob1');
assert.equal(empty.checklist.find(row => row.id === 'target').target, 'addUniversity');
for (const status of ['idle', 'loading', 'error']) {
  const pending = buildAccountProfile({ user, userLoadStatus: status });
  assert.ok(pending.checklist.every(row => row.complete === null));
  assert.equal(pending.mbtiCode, '');
}
for (const quantitative of [{}, { mar: {} }, { mar: { kor: { raw: 0 } } }]) {
  assert.equal(buildAccountProfile({ user: { ...user, quantitative }, userLoadStatus: 'ready' }).checklist.find(row => row.id === 'scores').complete, false);
}
const previousAlert = globalThis.alert;
globalThis.alert = () => {};
try {
  for (const action of ['saveQualInfo', 'mbtiNext']) {
    for (const outcome of ['failure', 'missing', 'throw', 'success', 'stale']) {
      let applied = 0;
      let resultShown = 0;
      let resolve;
      let calls = 0;
      const ctx = {
        user, screen: 'my', document: { querySelector: () => null }, localStorage: { getItem: () => null, setItem: () => {} },
        obGradeStatus: '고3', obSchoolName: '학교', obTrack: 'natural', obGoalText: '꾸준한 공부',
        mbtiStep: MBTI_QUESTIONS.length - 1, mbtiAnswers: Array(MBTI_QUESTIONS.length).fill(1),
        setUser: callback => { const next = callback(user); assert.equal(next.qualitative.mbti.length, 4); applied++; },
        setMbtiResult: () => resultShown++, setMbtiStep: () => {},
        isCurrentProfile: () => outcome !== 'stale', operationLocksRef: { current: new Set() },
        persistQualitative: () => { calls++; return new Promise((yes, no) => { resolve = () => outcome === 'throw' ? no(new Error('offline')) : yes(outcome === 'missing' ? undefined : { ok: outcome === 'success' || outcome === 'stale' }); }); }
      };
      const handler = createProfileHandlers(ctx)[action];
      const pending = handler();
      assert.equal(applied, 0, 'pending writes cannot update saved profile');
      assert.equal(await handler(), false, 'duplicate submissions share one lock');
      assert.equal(calls, 1);
      resolve();
      assert.equal(await pending, outcome === 'success');
      assert.equal(applied, outcome === 'success' ? 1 : 0);
      assert.equal(resultShown, outcome === 'success' && action === 'mbtiNext' ? 1 : 0);
    }
  }
  for (const action of ['saveScoreEdit', 'saveScoreSubject']) {
    for (const outcome of ['failure', 'missing', 'success', 'stale']) {
      let applied = 0;
      let calls = 0;
      const ctx = {
        user, screen: 'my', document: { querySelector: () => null }, localStorage: { setItem: () => {} },
        scoreExamType: '3월 모의고사', scoreEditStep: 6,
        scoreEditState: { korean: { type: '언어와매체', common: '58', elective: '20' }, math: { type: '미적분', common: '55', elective: '21' }, english: '2', history: '1', inquiry1: { subject: '생활과 윤리', score: '45' }, inquiry2: { subject: '사회·문화', score: '43' } },
        analysisApiUrl: '/analysis', apiFetch: async () => ({ ok: true, json: async () => ({ std: 120, pct: 90, grd: 2 }) }),
        persistQuantitative: async () => { calls++; return outcome === 'missing' ? undefined : { ok: outcome !== 'failure' }; },
        isCurrentProfile: () => outcome !== 'stale',
        setUser: callback => {
          assert.equal(buildAccountProfile({ user: callback(user), userLoadStatus: 'ready' }).checklist.find(row => row.id === 'scores').complete, true);
          applied++;
        },
        setScoreSubjectSaving: () => {}, setScoreEditState: () => {}, setScores: () => {},
        getExamScoresMap: () => ({}), saveExamScoresMap: () => {}, setScoreExamKey: () => {}, setScoreEditOpen: () => {}, setScoreEditStep: () => {}
      };
      assert.equal(await createProfileHandlers(ctx)[action](), outcome === 'success');
      assert.equal(applied, outcome === 'success' ? 1 : 0);
      assert.equal(calls, outcome === 'stale' ? 0 : 1, 'account changes during conversion cannot start a write');
    }
  }
  for (const outcome of ['failure', 'missing', 'throw', 'success', 'stale-before', 'stale-after']) {
    const state = { ...selectFlatAppState(createInitialAppState()), user, userLoadStatus: 'ready' };
    const stateRef = { current: state };
    let calls = 0;
    let applied = 0;
    let finish;
    const ctx = createMobileViewContext({
      state, stateRef, nav: {}, refs: { qnaDraftRef: { current: {} }, operationLocksRef: { current: new Set() } },
      setState: patch => { assert.equal(patch.user.targetUniversity, '연세대학교 경제학과'); applied++; },
      api: { hasClientSession: () => true, persistTargetUnivs: () => { calls++; return new Promise((yes, no) => { finish = () => outcome === 'throw' ? no(new Error('offline')) : yes(outcome === 'missing' ? undefined : { ok: outcome !== 'failure' }); }); } }
    });
    if (outcome === 'stale-before') stateRef.current = { ...state, user: {} };
    const pending = ctx.addMajorToTargets('연세대학교 경제학과');
    if (outcome === 'stale-before') {
      assert.equal(await pending, false);
      assert.equal(calls, 0, 'stale delayed actions cannot write to the next account');
      continue;
    }
    assert.equal(applied, 0);
    assert.equal(await ctx.addMajorToTargets('다른대학교 학과'), false);
    assert.equal(calls, 1);
    if (outcome === 'stale-after') stateRef.current = { ...state, user: {} };
    finish();
    assert.equal(await pending, outcome === 'success');
    assert.equal(applied, outcome === 'success' ? 1 : 0);
  }
  for (const outcome of ['failure', 'missing', 'success', 'stale-before', 'stale-after']) {
    let current = outcome !== 'stale-before';
    let applied = 0;
    let calls = 0;
    const ctx = {
      targetDeleteCandidate: '연세대학교 경제학과', analysisTargetList: ['연세대학교 경제학과', '고려대학교 경영학과'],
      targetUnivSlots: [{ univ: '연세대학교', major: '경제학과' }, { univ: '고려대학교', major: '경영학과' }],
      isCurrentProfile: () => current,
      persistTargetUnivs: async () => { calls++; if (outcome === 'stale-after') current = false; return outcome === 'missing' ? undefined : { ok: outcome !== 'failure' }; },
      applySavedProfileTarget: target => { assert.equal(target, '고려대학교 경영학과'); applied++; },
      setTargetDeleteSaving: () => {}, setTargetDeleteError: () => {}, setTargetUnivSlots: () => {}, setAnalysisTargetList: () => {}, setTargetDeleteModalOpen: () => {}, setTargetDeleteCandidate: () => {}
    };
    assert.equal(await createAnalysisHandlers(ctx).confirmTargetDelete(), outcome === 'success');
    assert.equal(calls, outcome === 'stale-before' ? 0 : 1);
    assert.equal(applied, outcome === 'success' ? 1 : 0);
  }
} finally { globalThis.alert = previousAlert; }
console.log('Account profile contracts passed: saved-only model, server/legacy grades, checklist, qualitative/MBTI/score/target saves, failure, duplicate and stale guards.');
