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

function responseFor(payload, state) {
  switch (payload.type) {
    case 'get_user_analysis':
      return mockUser;
    case 'get_admission_calendar':
      return { events: [] };
    case 'get_study_ranking':
      return {
        rows: [{ rank: 1, name: '테*트', seconds: state.studySeconds }],
        me: { rank: 1, seconds: state.studySeconds }
      };
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
    case 'record_study_session':
      state.studySeconds = Math.max(1, Number(payload.data?.durationSeconds) || 1);
      return { success: true };
    case 'get_pro_reports':
      return { reports: [] };
    case 'get_weekly_reports':
      return { weeklyReports: [] };
    case 'get_qna_list':
      return { qnaHistory: [] };
    case 'student_get_notifications':
      return { notifications: [] };
    default:
      return { success: true };
  }
}

export async function installApiMock(page) {
  const requests = [];
  const state = { studySeconds: 0 };
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
