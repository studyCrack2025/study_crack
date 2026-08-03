import assert from 'node:assert/strict';
import { buildMyPagePresentation, getLongestStudyStreak } from '../src/screens/mypage/presentation.js';
import { buildSocialProviders, buildSubscriptionSummary, displayAccountEmail, displayAccountName } from '../src/screens/mypage/account-presentation.js';

const records = [
  { date: '2026-07-01', studyTime: 3600 },
  { date: '2026-07-02', studyTime: 1200 },
  { date: '2026-07-03', studyTime: 600 },
  { date: '2026-07-08', studyTime: 0 }
];

const presentation = buildMyPagePresentation({
  liveStudySeconds: 600,
  mbtiResult: 'CSDR',
  plannerItems: [{ done: true }, { done: false }, { done: true }],
  selectedPlan: 'Standard',
  studyRecords: records,
  user: {
    name: '긴 이름 테스트 학생',
    qualitative: { status: '고3 재학', stream: '자연' },
    currentSubscription: { tier: 'standard', endDate: '2026-08-31T00:00:00.000Z' }
  }
});

assert.equal(presentation.profile.name, '긴 이름 테스트 학생');
assert.equal(presentation.profile.meta, '고3 재학 · 자연');
assert.equal(presentation.plan.label, 'Standard');
assert.equal(presentation.mbti.code, 'CSDR');
assert.equal(presentation.mbti.rows.length, 4);
assert.deepEqual(presentation.stats.map((stat) => stat.value), ['1시간 40분', '2개', '3일']);
assert.equal(getLongestStudyStreak(records), 3);
assert.equal(buildMyPagePresentation({ user: {} }).profile.name, '회원');
assert.equal(buildMyPagePresentation({ user: {} }).profile.meta, '학년·계열 정보를 등록해주세요');
assert.equal(buildMyPagePresentation({ user: {} }).mbti.empty, true);
assert.equal(displayAccountName({}), '회원');
assert.equal(displayAccountEmail({ email: 'hidden@social.studycrack.co.kr' }), '소셜 계정 이메일 미제공');
assert.equal(buildSubscriptionSummary({ currentSubscription: { tier: 'starter' } }, 'Starter').lifetime, true);
assert.deepEqual(buildSocialProviders({ authProvider: 'google' }).map(({ isLinked, isPrimary }) => [isLinked, isPrimary]), [[true, true], [false, false]]);

console.log('mypage-presentation contracts passed');
