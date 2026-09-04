import { expect } from '@playwright/test';

const TARGETS = [
  '연세대학교 정치외교학과',
  '고려대학교 경영학과'
];

const SCORE_BY_EXAM = {
  mar: [126, 118],
  jun: [142, 131]
};

const FISH_CATALOG = [
  ['clownfish', '흰동가리', '코랄', 'common', true, ['#FF7A5C', '#FFF4D8']],
  ['blue_damsel', '파랑돔', '마루', 'common', true, ['#3F6FD9', '#9DD9F2']],
  ['yellowtail_damsel', '노랑꼬리돔', '리프', 'common', true, ['#274B87', '#F5C84C']],
  ['striped_sardine', '줄무늬정어리', '모아', 'common', false, ['#B9C7D8', '#1B3A6B']],
  ['butterflyfish', '나비고기', '나비', 'rare', false, ['#FFF4DC', '#F3CF55']],
  ['mandarinfish', '만다린피시', '루나', 'rare', false, ['#2EAE9B', '#FF7A5C']],
  ['seahorse', '해마', '해온', 'rare', false, ['#E8B94F', '#74C9B8']],
  ['pufferfish', '복어', '몽실', 'rare', false, ['#F8E7BE', '#2EAE9B']],
  ['emperor_angelfish', '황제엔젤피시', '솔라', 'epic', false, ['#1B3A6B', '#E8B94F']],
  ['lionfish', '라이언피시', '레오', 'epic', false, ['#8E4250', '#FFF4D8']],
  ['blue_tang', '블루탱', '웨이브', 'epic', false, ['#3275D8', '#F5C84C']],
  ['manta_ray', '만타가오리', '오로라', 'epic', false, ['#24364F', '#7FC7D1']]
].map(([speciesId, displayName, defaultName, rarity, starter, colors]) => ({ speciesId, displayName, defaultName, rarity, starter, colors }));

export const mockUser = {
  role: 'student',
  name: '테스트학생',
  email: 'student@example.com',
  profileImage: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" fill="%23dfe9ff"/%3E%3Ccircle cx="32" cy="24" r="12" fill="%233f63b8"/%3E%3Cpath d="M12 62c2-15 10-22 20-22s18 7 20 22" fill="%233f63b8"/%3E%3C/svg%3E',
  computedTier: 'basic',
  targetUnivs: TARGETS,
  quantitative: {
    mar: {
      kor: { raw: 86, std: 132, pct: 94, opt: '언어와매체' },
      math: { raw: 82, std: 128, pct: 91, opt: '미적분' },
      eng: { grade: 2 },
      hist: { grade: 1 },
      inq1: { raw: 45, std: 66, pct: 92, name: '생명과학I' },
      inq2: { raw: 44, std: 65, pct: 90, name: '지구과학I' }
    },
    jun: {
      kor: { raw: 91, std: 138, pct: 97, opt: '언어와매체' },
      math: { raw: 87, std: 134, pct: 95, opt: '미적분' },
      eng: { grade: 1 },
      hist: { grade: 1 },
      inq1: { raw: 47, std: 68, pct: 95, name: '생명과학I' },
      inq2: { raw: 46, std: 67, pct: 94, name: '지구과학I' }
    }
  },
  qualitative: { stream: 'natural' }
};

function encodeToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `e2e.${encoded}.signature`;
}

export async function installAuthenticatedSession(page) {
  const token = encodeToken({ sub: 'e2e-student', exp: Math.floor(Date.now() / 1000) + 3600 });
  await page.addInitScript(({ accessToken }) => {
    const storageInitializedKey = '__studycrackE2eSessionInitialized';
    if (localStorage.getItem(storageInitializedKey) !== 'true') {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('userId', 'e2e-student');
      localStorage.setItem('userRole', 'student');
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      localStorage.setItem('plannerItems', JSON.stringify([{
        id: 'e2e-plan-korean',
        date: `${now.getFullYear()}-${month}-${day}`,
        subject: '국어',
        category: '국어',
        content: '독서',
        minutes: 30,
        doneMinutes: 0,
        start: '09:00',
        end: '09:30'
      }]));
      localStorage.setItem(storageInitializedKey, 'true');
    }
    sessionStorage.setItem('accessToken', accessToken);
  }, { accessToken: token });
}

function targetResult(target, index, examMode) {
  const scores = SCORE_BY_EXAM[examMode] || SCORE_BY_EXAM.mar;
  const targetIndex = String(target.univ || '').includes('고려') ? 1 : 0;
  return {
    univ: target.univ,
    major: target.major,
    converted_score: scores[targetIndex] ?? scores[index] ?? scores[0],
    score_available: true,
    status: (scores[targetIndex] ?? scores[index] ?? scores[0]) >= 100 ? '합격권' : '도전'
  };
}

function studySummary(state) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() + (now.getDay() === 0 ? -6 : 1 - now.getDay()));
  const dateKey = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  const todayDate = dateKey(now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const isToday = dateKey(date) === todayDate;
    return {
      date: dateKey(date),
      totalSeconds: isToday ? state.studySeconds : 0,
      sessionCount: isToday && state.studySeconds ? 1 : 0,
      subjects: isToday && state.studySeconds ? [{ subject: '국어', seconds: state.studySeconds }] : []
    };
  });
  return {
    today: days.find((day) => day.date === todayDate),
    week: {
      startDate: days[0].date,
      endDate: days[6].date,
      totalSeconds: state.studySeconds,
      sessionCount: state.studySeconds ? 1 : 0,
      subjects: state.studySeconds ? [{ subject: '국어', seconds: state.studySeconds }] : [],
      days
    },
    available: true
  };
}

function responseFor(payload, state) {
  switch (payload.type) {
    case 'get_user_analysis':
      return {
        ...mockUser,
        ...state.userOverrides,
        computedTier: state.userTier,
        currentSubscription: state.userTier === 'free' ? null : {
          status: 'active',
          tier: state.userTier,
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString()
        }
      };
    case 'get_admission_calendar':
      return { events: [] };
    case 'get_study_ranking':
      return {
        rows: [{ rank: 1, name: '테*트', seconds: state.studySeconds }],
        me: { rank: 1, seconds: state.studySeconds }
      };
    case 'get_study_summary':
      return studySummary(state);
    case 'get_univ_list_only':
      return [
        { univName: '고려대학교', majors: ['경영학과', '정치외교학과'] },
        { univName: '연세대학교', majors: ['경제학과', '정치외교학과'] }
      ];
    case 'get_tutorial_recommendations':
      return { selected: [{ school: '성균관대학교', major: '글로벌경영학과' }] };
    case 'analyze_my_targets':
      return (payload.targetUnivs || []).map((target, index) => targetResult(target, index, payload.examMode));
    case 'simulate_score_rise':
      return (payload.targetUnivs || []).map((target, index) => {
        const baseUiScore = targetResult(target, index, payload.examMode).converted_score;
        return {
          univ: target.univ,
          major: target.major,
          base_ui_score: baseUiScore,
          sim_data: {
            kor: { name: '국어', uiDiff: 3.2, afterUiScore: baseUiScore + 3.2, rawNeeded: 1 },
            math: { name: '수학', uiDiff: 2.4, afterUiScore: baseUiScore + 2.4, rawNeeded: 1 },
            inq1: { name: '탐구1', uiDiff: 1.1, afterUiScore: baseUiScore + 1.1, rawNeeded: 1 },
            inq2: { name: '탐구2', uiDiff: 0.8, afterUiScore: baseUiScore + 0.8, rawNeeded: 1 }
          }
        };
      });
    case 'backtrace_required_raw':
      return { result: { reachable: true, minTotalRaw: 6, bySubject: { kor: 3, math: 2, inq1: 1, inq2: 0 }, expected: { uiScore: 151.2 } } };
    case 'find_email':
      return { success: true, email: 's***@example.com' };
    case 'send_pw_reset_code':
      return { success: true };
    case 'reset_password':
      return { success: true };
    case 'get_user_payment':
      return {
        name: mockUser.name,
        email: mockUser.email,
        phone: '010-1234-5678',
        currentSubscription: null,
        pendingSubscription: null
      };
    case 'create_payment_intent': {
      const tier = String(payload.data?.tier || 'standard').toUpperCase();
      const prices = { BASIC: 25000, STARTER: 39000, STANDARD: 49000, PRO: 149000, TEST: 100 };
      const paymentIntentId = 'PI_123e4567e89b12d3a456426614174000';
      return {
        success: true,
        data: {
          paymentIntentId,
          orderId: paymentIntentId,
          purchaseKind: 'subscription',
          tier,
          productName: `스터디크랙 ${tier} 멤버십`,
          amount: prices[tier],
          status: 'intent_created',
          fulfillmentStatus: 'pending',
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
        }
      };
    }
    case 'convert_score': {
      const raw = Number(payload.score || 0);
      return { std: Math.max(1, raw + 50), pct: Math.max(1, Math.min(100, raw + 35)), grd: Math.max(1, Math.min(9, Math.ceil((100 - raw) / 10))) };
    }
    case 'start_study_session':
      state.activeStudySession = {
        sessionId: payload.data?.sessionId,
        subject: payload.data?.subject,
        plannerItemId: payload.data?.plannerItemId || '',
        status: 'running',
        startedAt: new Date(Date.now() - 2000).toISOString()
      };
      return state.activeStudySession;
    case 'complete_study_session':
      state.studySeconds = state.studyDurationSeconds;
      return { ...state.activeStudySession, status: 'completed', endedAt: new Date().toISOString(), durationSeconds: state.studySeconds };
    case 'get_game_profile':
      return {
        profile: state.gameProfile,
        activeFish: state.activeFish,
        fishCount: state.fishInventory.length
      };
    case 'get_fish_catalog':
      return {
        catalogVersion: 'fish-v1',
        catalog: state.fishCatalog.map((fish) => ({ ...fish, owned: state.fishInventory.some((item) => item.speciesId === fish.speciesId) })),
        inventory: state.fishInventory
      };
    case 'get_pending_draw':
      return state.pendingDraw
        ? { ...state.pendingDraw, profile: state.gameProfile, fish: state.pendingDraw.fish }
        : { pending: null, profile: state.gameProfile };
    case 'claim_starter_fish': {
      const speciesId = payload.data?.speciesId || 'clownfish';
      const names = { clownfish: ['흰동가리', '코랄'], blue_damsel: ['파랑돔', '마루'], yellowtail_damsel: ['노랑꼬리돔', '리프'] };
      const fish = { fishId: 'fish_starter_e2e', speciesId, speciesName: names[speciesId][0], rarity: 'common', name: names[speciesId][1], customName: '', level: 1, exp: 0, currentLevelExp: 0, nextLevelExp: 30, progressPct: 0, growthStage: 'young', source: 'starter' };
      state.fishInventory = [fish];
      state.activeFish = [null, fish, null];
      state.gameProfile = { ...state.gameProfile, starterState: 'claimed', selectedFishId: fish.fishId, activeFishIds: [null, fish.fishId, null] };
      return { profile: state.gameProfile, fish, alreadyClaimed: false };
    }
    case 'feed_fish': {
      const fish = state.fishInventory.find((item) => item?.fishId === payload.data?.fishId);
      const updated = { ...fish, exp: fish.exp + 10, currentLevelExp: fish.currentLevelExp + 10, progressPct: 33 };
      state.fishInventory = state.fishInventory.map((item) => item?.fishId === updated.fishId ? updated : item);
      state.activeFish = state.activeFish.map((item) => item?.fishId === updated.fishId ? updated : item);
      state.gameProfile = { ...state.gameProfile, foodBalance: state.gameProfile.foodBalance - 1 };
      return { requestId: payload.data?.requestId, profile: state.gameProfile, fish: updated, expGranted: 10, waterGain: 0, levelUp: false };
    }
    case 'set_active_fish': {
      const slots = ['left', 'center', 'right'];
      const slotIndex = slots.indexOf(payload.data?.slot);
      const fishId = payload.data?.fishId || null;
      const activeFishIds = state.gameProfile.activeFishIds.map((id) => id === fishId ? null : id);
      activeFishIds[slotIndex] = fishId;
      state.gameProfile = { ...state.gameProfile, activeFishIds };
      state.activeFish = activeFishIds.map((id) => state.fishInventory.find((fish) => fish.fishId === id) || null);
      return { profile: state.gameProfile };
    }
    case 'rename_fish': {
      const name = String(payload.data?.name || '').trim() || '마루';
      const current = state.fishInventory.find((fish) => fish.fishId === payload.data?.fishId);
      const updated = { ...current, customName: name, name };
      state.fishInventory = state.fishInventory.map((fish) => fish.fishId === updated.fishId ? updated : fish);
      state.activeFish = state.activeFish.map((fish) => fish?.fishId === updated.fishId ? updated : fish);
      return { fish: updated };
    }
    case 'draw_fish': {
      if (state.pendingDraw) return { ...state.pendingDraw, alreadyDrawn: true, profile: state.gameProfile, fish: state.pendingDraw.fish };
      const requestId = payload.data?.requestId || 'draw-e2e';
      const fish = { fishId: 'fish_draw_e2e', speciesId: 'butterflyfish', speciesName: '나비고기', rarity: 'rare', name: '나비', customName: '', level: 1, exp: 0, currentLevelExp: 0, nextLevelExp: 30, progressPct: 0, growthStage: 'young', source: 'draw' };
      const result = { requestId, speciesId: fish.speciesId, rarity: fish.rarity, duplicate: false, protectedDraw: true, expGranted: 0, shellsRefunded: 0, cost: 30, levelBefore: 0, levelAfter: 1, createdAt: new Date().toISOString() };
      state.fishInventory = [...state.fishInventory, fish];
      state.gameProfile = { ...state.gameProfile, shellBalance: state.gameProfile.shellBalance - 30, activeDrawRequestId: requestId, drawPity: { rareIn: 9, epicIn: 29 } };
      state.pendingDraw = { result, fish };
      return { result, profile: state.gameProfile, fish, alreadyDrawn: false };
    }
    case 'acknowledge_fish_draw':
      state.pendingDraw = null;
      state.gameProfile = { ...state.gameProfile, activeDrawRequestId: null };
      return { profile: state.gameProfile, alreadyAcknowledged: false };
    case 'get_study_habitat':
      return { days: [], streakDays: 0 };
    case 'claim_study_reward': {
      const shells = Number(state.studyReward.shells) || 0;
      const food = Number(state.studyReward.food) || 0;
      if (!state.studyRewardClaimed) {
        state.gameProfile = {
          ...state.gameProfile,
          shellBalance: state.gameProfile.shellBalance + shells,
          foodBalance: state.gameProfile.foodBalance + food,
          starterFishUnlocked: state.gameProfile.starterFishUnlocked || shells > 0,
          starterState: state.gameProfile.starterState === 'locked' && shells > 0 ? 'selectable' : state.gameProfile.starterState
        };
      }
      const alreadyClaimed = state.studyRewardClaimed;
      state.studyRewardClaimed = true;
      return {
        alreadyClaimed,
        sessionId: payload.data?.sessionId,
        durationSeconds: state.studySeconds,
        reward: { shells, food },
        profile: state.gameProfile
      };
    }
    case 'get_pro_reports':
      return { reports: [] };
    case 'get_weekly_reports':
      return { weeklyReports: [] };
    case 'get_qna_list':
      return { qnaHistory: [{ qnaId: 'qna-e2e', title: '분석 결과 문의', content: '환산점수 기준이 궁금합니다.', status: 'done', answer: '선택한 시험 기준으로 계산됩니다.', createdAt: '2026-08-07T09:00:00.000Z' }] };
    case 'student_get_notifications':
      return { notifications: [{ id: 'noti-e2e', title: '학습 알림', message: '학습 알림', detail: '오늘 계획한 국어 학습을 확인해주세요.', actionType: 'planner', isRead: false, createdAt: '2026-08-07T08:00:00.000Z' }] };
    default:
      return { success: true };
  }
}

export async function installApiMock(page, {
  analysisDelayByExam = {},
  failGameTypes = [],
  failOnceTypes = [],
  fishCatalog = FISH_CATALOG,
  initialGameProfile = {},
  studyDurationSeconds = 2,
  studyReward = { shells: 0, food: 0 },
  tier = mockUser.computedTier,
  userOverrides = {}
} = {}) {
  const requests = [];
  const failedOnce = new Set();
  const state = {
    activeStudySession: null,
    activeFish: [],
    fishCatalog,
    fishInventory: [],
    gameProfile: { shellBalance: 62, foodBalance: 3, starterFishUnlocked: true, starterState: 'selectable', selectedFishId: null, activeFishIds: [null, null, null], activeDrawRequestId: null, drawPity: { rareIn: 10, epicIn: 30 }, dailyReward: {}, ...initialGameProfile },
    pendingDraw: null,
    studyDurationSeconds,
    studyReward,
    studyRewardClaimed: false,
    studySeconds: 0,
    userTier: tier,
    userOverrides
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    let payload = {};
    try {
      payload = request.postDataJSON() || {};
    } catch (_error) {
      payload = {};
    }
    requests.push({ path: new URL(request.url()).pathname, payload });
    if (failGameTypes.includes(payload.type) || (failOnceTypes.includes(payload.type) && !failedOnce.has(payload.type))) {
      failedOnce.add(payload.type);
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Internal Server Error' }) });
      return;
    }
    const analysisDelay = ['analyze_my_targets', 'simulate_score_rise', 'backtrace_required_raw'].includes(payload.type)
      ? Math.max(0, Number(analysisDelayByExam[payload.examMode] || 0))
      : 0;
    if (analysisDelay) await new Promise((resolve) => setTimeout(resolve, analysisDelay));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(responseFor(payload, state))
    });
  });
  return { requests, state };
}

export async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
