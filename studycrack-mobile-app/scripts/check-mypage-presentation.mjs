import assert from 'node:assert/strict';
import { buildMyPagePresentation, buildPlanPresentation } from '../src/screens/mypage/presentation.js';
import { buildSocialProviders, buildSubscriptionSummary, displayAccountEmail, displayAccountName } from '../src/screens/mypage/account-presentation.js';

const records = [
  { date: '2026-07-01', studyTime: 3600 },
  { date: '2026-07-02', studyTime: 1200 },
  { date: '2026-07-03', studyTime: 600 },
  { date: '2026-07-08', studyTime: 0 }
];

const presentation = buildMyPagePresentation({
  userLoadStatus: 'ready',
  studyOverview: { week: { seconds: 5400, fresh: true, status: 'ready' } },
  aquariumPresentation: { ownedCount: 2, streakDays: 3, status: 'ready' },
  liveStudySeconds: 600,
  mbtiResult: 'CSDR',
  plannerItems: [{ done: true }, { done: false }, { done: true }],
  selectedPlan: 'Standard',
  studyRecords: records,
  user: {
    name: '긴 이름 테스트 학생',
    qualitative: { status: '고3 재학', stream: '자연', mbti: 'CSDR' },
    currentSubscription: { tier: 'standard', endDate: '2026-08-31T00:00:00.000Z' }
  }
});

assert.equal(presentation.profile.name, '긴 이름 테스트 학생');
assert.equal(presentation.profile.meta, '고3 재학 · 자연');
assert.equal(presentation.plan.label, 'Standard');
assert.equal(presentation.mbti.code, 'CSDR');
assert.equal(presentation.mbti.rows.length, 4);
assert.deepEqual(presentation.stats.map((stat) => stat.value), ['1시간 30분', '2마리', '3일']);
assert.equal(buildMyPagePresentation({ user: {}, userLoadStatus: 'ready' }).profile.name, '회원');
assert.ok(buildMyPagePresentation({ user: {} }).stats.every(stat => stat.value === '확인 필요'));
assert.equal(buildMyPagePresentation({ user: {} }).profile.meta, '학년·계열 정보를 등록해주세요');
assert.equal(buildMyPagePresentation({ user: {} }).mbti.empty, true);
assert.equal(displayAccountName({}), '회원');
assert.equal(displayAccountEmail({ email: 'hidden@social.studycrack.co.kr' }), '소셜 계정 이메일 미제공');
assert.equal(buildSubscriptionSummary({ currentSubscription: { tier: 'starter' } }, 'Starter').lifetime, true);
assert.equal(buildSubscriptionSummary({ currentSubscription: { tier: 'pro', endDate: '2026-08-31T00:00:00.000Z' } }, 'Basic').planLabel, 'Pro');
assert.equal(buildSubscriptionSummary({ currentSubscription: { tier: 'pro', endDate: '2026-08-31T00:00:00.000Z' } }, 'Basic').renewalLine, '2026.08.31 전 연장 필요');
assert.deepEqual(buildSocialProviders({ authProvider: 'google' }).map(({ isLinked, isPrimary }) => [isLinked, isPrimary]), [[true, true], [false, false]]);
assert.deepEqual(buildPlanPresentation({ computedTier: 'basic' }), { key: 'basic', label: 'Basic', periodLabel: '평생 이용' });
assert.deepEqual(buildPlanPresentation({ currentSubscription: { tier: 'standard', endDate: '2026-08-31T00:00:00.000Z' } }), { key: 'standard', label: 'Standard', periodLabel: '2026.08.31까지 이용' });

console.log('mypage-presentation contracts passed');
