import { expect } from '@playwright/test';

const TARGETS = [
  '연세대학교 정치외교학과',
  '고려대학교 경영학과'
];

const SCORE_BY_EXAM = {
  mar: [126, 118],
  jun: [142, 131]
};

export const mockUser = {
  role: 'student',
  name: '테스트학생',
  email: 'student@example.com',
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
      return { ...mockUser, computedTier: state.userTier };
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
      return (payload.targetUnivs || []).map((target) => ({
        univ: target.univ,
        major: target.major,
        subjects: [
          { subject: '국어', converted_score: 3 },
          { subject: '수학', converted_score: 2 }
        ]
      }));
    case 'backtrace_required_raw':
      return { result: { reachable: true, minTotalRaw: 6, items: [{ subject: '국어', rawIncrease: 3 }] } };
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
      state.studySeconds = 2;
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
        catalog: [
          { speciesId: 'clownfish', displayName: '흰동가리', defaultName: '코랄', rarity: 'common', starter: true, colors: ['#FF7A5C', '#FFF4D8'], owned: false },
          { speciesId: 'blue_damsel', displayName: '파랑돔', defaultName: '마루', rarity: 'common', starter: true, colors: ['#3F6FD9', '#9DD9F2'], owned: false },
          { speciesId: 'yellowtail_damsel', displayName: '노랑꼬리돔', defaultName: '리프', rarity: 'common', starter: true, colors: ['#274B87', '#F5C84C'], owned: false }
        ],
        inventory: state.fishInventory
      };
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
    case 'get_study_habitat':
      return { days: [], streakDays: 0 };
    case 'claim_study_reward':
      return {
        sessionId: payload.data?.sessionId,
        durationSeconds: state.studySeconds,
        reward: { shells: 0, food: 0 },
        profile: state.gameProfile
      };
    case 'get_pro_reports':
      return { reports: [] };
    case 'get_weekly_reports':
      return { weeklyReports: [] };
    case 'get_qna_list':
      return { qnaHistory: [{ qnaId: 'qna-e2e', title: '분석 결과 문의', content: '환산점수 기준이 궁금합니다.', status: 'done', answer: '선택한 시험 기준으로 계산됩니다.', createdAt: '2026-08-07T09:00:00.000Z' }] };
    case 'student_get_notifications':
      return { notifications: [{ notiId: 'noti-e2e', title: '학습 알림', body: '오늘 계획한 국어 학습을 확인해주세요.', isRead: false, createdAt: '2026-08-07T08:00:00.000Z' }] };
    default:
      return { success: true };
  }
}

export async function installApiMock(page, { tier = mockUser.computedTier } = {}) {
  const requests = [];
  const state = {
    activeStudySession: null,
    activeFish: [],
    fishInventory: [],
    gameProfile: { shellBalance: 2, foodBalance: 3, waterQuality: 82, starterFishUnlocked: true, starterState: 'selectable', selectedFishId: null, activeFishIds: [null, null, null], dailyReward: {} },
    studySeconds: 0,
    userTier: tier
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
