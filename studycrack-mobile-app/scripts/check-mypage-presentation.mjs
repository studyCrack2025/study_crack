import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
const insight = await readFile(new URL('../src/screens/mypage/MbtiInsightCard.jsx', import.meta.url), 'utf8');
assert.match(insight, /<AnimatedDetails className="my-insight-details">\s*<summary>학습 성향 자세히 보기<\/summary>/, '학습 성향 세부 설명은 양방향 모션으로 펼쳐 봅니다.');
const myPage = await readFile(new URL('../src/screens/mypage/MyPageScreen.jsx', import.meta.url), 'utf8');
assert.ok(myPage.indexOf('<MyMenuList') < myPage.indexOf('<MbtiInsightCard'), '주요 메뉴를 성향 세부보다 먼저 보여야 합니다.');
const css = await readFile(new URL('../src/styles/screens/mypage.css', import.meta.url), 'utf8');
assert.match(css, /\.my-menu-copy b\{font-size:var\(--sc-type-body\)/);
assert.match(css, /\.my-profile-copy strong\{[^}]*white-space:normal;overflow-wrap:anywhere;/, '긴 이름은 읽을 수 있도록 줄바꿈합니다.');

console.log('mypage-presentation contracts passed');
