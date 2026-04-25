const { useState, useEffect } = React;

const CRACKY_SRC = 'assets/images/3A1D897F-252E-4096-AEF2-C4FA7CA6689D.png';
const ONBOARDING_LOGO_SRC = './assets/images/og-image.jpg';

function i(name, primary) {
  const c = primary ? 'icon primary' : 'icon';
  const map = {
    home: `<svg viewBox="0 0 24 24" class="${c}"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
    menu: `<svg viewBox="0 0 24 24" class="${c}"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    bell: `<svg viewBox="0 0 24 24" class="${c}"><path d="M15 17H5l2-2v-4a5 5 0 1 1 10 0v4l2 2z"/><path d="M9 17a3 3 0 0 0 6 0"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" class="${c}"><path d="M12 3l10 18H2L12 3z"/><path d="M12 9v5M12 18h.01"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" class="${c}"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 4-6"/></svg>`,
    target: `<svg viewBox="0 0 24 24" class="${c}"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" class="${c}"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg>`,
    user: `<svg viewBox="0 0 24 24" class="${c}"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>`,
    report: `<svg viewBox="0 0 24 24" class="${c}"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>`,
    chevron: `<svg viewBox="0 0 24 24" class="${c}"><path d="M9 6l6 6-6 6"/></svg>`,
    chat: `<svg viewBox="0 0 24 24" class="${c}"><path d="M4 5h16v11H8l-4 4z"/></svg>`,
    check: `<svg viewBox="0 0 24 24" class="${c}"><path d="M20 6L9 17l-5-5"/></svg>`,
    bolt: `<svg viewBox="0 0 24 24" class="${c}"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`
  };
  return map[name] || map.chart;
}

function mascotBubble(text, size = 'sm') {
  const sizeClass = size === 'lg' ? 'cracky-lg' : size === 'md' ? 'cracky-md' : 'cracky-sm';
  return `<div class="mascot"><div class="mascot-badge"><img src="${CRACKY_SRC}" class="cracky-img ${sizeClass}" alt="크랙이"/></div><div class="bubble">${text}</div></div>`;
}

function App() {
  const [screen, setScreen] = useState('splash');
  const [tab, setTab] = useState('home');
  const [history, setHistory] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState('Pro');
  const [duration, setDuration] = useState('4주');
  const [targetMajor, setTargetMajor] = useState('연세대학교 경영학과');
  const [targetOpen, setTargetOpen] = useState(false);
  const [universityModalOpen, setUniversityModalOpen] = useState(false);

  const goto = (next, addHistory = true) => {
    if (addHistory && screen !== next) setHistory((h) => [...h, screen]);
    setScreen(next);
    if (['home', 'analysis', 'strategy', 'planner', 'my'].includes(next)) setTab(next);
  };

  const back = () => {
    if (!history.length) return goto('home', false);
    const clone = [...history];
    const prev = clone.pop();
    setHistory(clone);
    setScreen(prev);
  };

  useEffect(() => {
    if (screen === 'splash') {
      const t = setTimeout(() => goto('on1'), 900);
      return () => clearTimeout(t);
    }
  }, [screen]);

  useEffect(() => {
    const t = setTimeout(() => {
      const el = document.querySelector('.app-shell .app-content');
      if (el) el.scrollTop = 0;
    }, 0);
    return () => clearTimeout(t);
  }, [screen]);

  const appbar = (title, showBack) => `<div class="appbar">${showBack ? '<button class="back-btn" data-action="back">←</button>' : '<div style="width:36px"></div>'}<div class="title">${title}</div></div>`;
  const tabBtn = (k, label, iconName) => `<button class="${tab === k ? 'active' : ''}" data-action="tab" data-tab="${k}">${i(iconName, tab===k)}<span>${label}</span></button>`;
  const tabbar = () => `<div class="tabbar">${tabBtn('home','홈','home')}${tabBtn('analysis','분석','chart')}${tabBtn('strategy','전략','target')}${tabBtn('planner','플래너','calendar')}${tabBtn('my','마이','user')}</div>`;
  const layout = (inner, withTab) => `<div class="app-shell"><div class="screen app-screen app-content">${inner}</div>${withTab ? tabbar() : ''}</div>`;
  const quickMini = (action, iconName, label) => `<button class="quick-mini-item" data-action="goto" data-target="${action}"><span class="quick-mini-icon">${i(iconName,false)}</span><span class="quick-mini-label">${label}</span></button>`;
  const targetOptions = [
    '연세대학교 경영학과',
    '고려대학교 경영학과',
    '성균관대학교 글로벌경영학과',
    '한양대학교 경영학부'
  ];
  const onboarding = (step, title, subtitle, cardContent, bubbleText, target, cta = '다음') => `
    <div class="app-shell">
      <div class="screen app-screen app-content">
        <div class="onboarding-screen">
          <img src="${ONBOARDING_LOGO_SRC}" class="onboarding-logo logo" alt="StudyCrack 로고"/>
          <div class="onboarding-copy"><h2>${title}</h2><p>${subtitle}</p></div>
          ${cardContent}
          <div class="onboarding-speech">
            <img src="${CRACKY_SRC}" class="onboarding-speech-char crackie" alt="크랙이"/>
            <p class="onboarding-speech-text">${bubbleText}</p>
          </div>
          <div class="onboarding-footer">
            <div class="page-indicator"><i class="${step===1?'active':''}"></i><i class="${step===2?'active':''}"></i><i class="${step===3?'active':''}"></i></div>
            <button class="onboarding-next" data-action="goto" data-target="${target}">${cta}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const homeTargets = [
    { major: '연세대학교 경영학과', rate: 68, rank: '상위 32%', score: 323, cut: 335, gap: -12 },
    { major: '고려대학교 경영학과', rate: 61, rank: '상위 39%', score: 319, cut: 334, gap: -15 },
    { major: '성균관대학교 글로벌경영학과', rate: 73, rank: '상위 27%', score: 328, cut: 336, gap: -8 }
  ];

  const homeView = () => `<div class="home-dashboard">
    <div class="home-header">
      <div class="home-top-icons">
        <button class="top-icon-btn">${i('menu', false)}</button>
        <button class="top-icon-btn">${i('bell', false)}</button>
      </div>
      <p class="home-greeting">안녕하세요, 지민님 👋</p>
      <p class="home-sub">오늘도 크랙한 하루 되세요!</p>
    </div>
    <div class="section home-section">
      <div class="home-kpi-slider">
        ${homeTargets.map((item) => `<div class="card home-kpi-card slider-card">
          <span class="home-major-pill">${item.major}</span>
          <p class="sub">내 합격 가능성</p>
          <div class="home-kpi-head"><div><p class="metric">${item.rate}%</p><p class="sub">${item.rank}</p></div><div class="ring" style="background:conic-gradient(var(--primary) 0 ${item.rate}%, #dfe8f8 ${item.rate}% 100%)"></div></div>
          <div class="kpi-row"><div class="kpi-item"><b>${item.score}점</b>현재 점수</div><div class="kpi-item"><b>${item.cut}점</b>합격 컷</div><div class="kpi-item danger"><b>${item.gap}점</b>부족 점수</div></div>
        </div>`).join('')}
        <button class="card home-kpi-add-card slider-card" data-action="openUniversityModal"><span class="plus">+</span><p>목표 대학 추가하기</p></button>
      </div>
      <div class="home-kpi-indicator">${homeTargets.map((_, idx) => `<i class="${idx===0?'active':''}"></i>`).join('')}<b>+</b></div>
      ${universityModalOpen ? `<div class="home-modal-overlay" data-action="closeUniversityModal"><div class="home-modal" data-action="noopModal"><p class="home-modal-title">목표 대학 추가</p><p class="sub" style="margin-top:8px">대학 선택 모달은 다음 단계에서 연결됩니다.</p><button class="btn btn-primary" data-action="closeUniversityModal">닫기</button></div></div>` : ''}
    </div>
    <div class="section home-section home-section-tight">
      <div class="notice home-risk-card">
        <div class="home-risk-copy">
          <div class="home-risk-title">${i('alert', false)}<b>수학이 합격 가능성을 제한하고 있어요</b></div>
          <p>전략을 확인해보세요!</p>
        </div>
        <img src="${CRACKY_SRC}" class="home-risk-char crackie" alt="크랙이" />
      </div>
    </div>
    <div class="section home-section home-section-last">
      <p class="home-quick-title">빠른 메뉴</p>
      <div class="quick-mini-grid">
        ${quickMini('analysis','chart','분석')}
        ${quickMini('strategy','target','전략')}
        ${quickMini('planner','calendar','플래너')}
        ${quickMini('weekly','check','주간 점검')}
        ${quickMini('report','report','프로 보고서')}
      </div>
    </div>
  </div>`;

  const planMeta = {
    Basic: {
      introPrice: '25,000원 / 4주',
      payPrice: '25,000원 / 4주',
      desc: '합격 가능성 분석 + 대학별 전략 확인',
      features: ['합격 가능성 분석', '대학별 전략 확인'],
      complete: '합격 가능성 분석과 대학별 전략을 확인할 수 있어요.'
    },
    Standard: {
      introPrice: '149,000원 / 4주',
      payPrice: '149,000원 / 4주',
      desc: '전략 + 플래너 + 주간 점검',
      features: ['전략 기능 이용', '플래너 피드백', '학습 방향 코칭', '주간 점검 제공'],
      complete: '플래너 피드백과 학습 방향 코칭을 받을 수 있어요.'
    },
    Pro: {
      introPrice: '299,000원 / 4주',
      payPrice: '299,000원 / 4주',
      desc: '모든 기능 무제한 + 프로 보고서 제공',
      features: ['모든 기능 무제한 이용', '프로 보고서 2주에 1번 제공', 'Sky튜터 1:1 피드백 무제한', '광고 제거'],
      complete: '프로 보고서는 2주 단위로 제공됩니다.'
    }
  };
  const currentPlan = planMeta[selectedPlan] || planMeta.Pro;

  const screens = {
    splash: `<div class="app-shell"><div class="splash"><div class="logo-bolt">${i('bolt',true)}</div><img class="brand-logo" src="./assets/images/studycrack_logo_wo_bg.png" alt="logo"/><h1 style="margin:0;font-size:30px">스터디크랙</h1><p>합격까지 가장 빠른 전략</p></div></div>`,
    on1: onboarding(
      1,
      '데이터 기반으로\n내 합격 가능성을 분석해요',
      '흔들리지 않는 방향을\n제시해드립니다.',
      `<div class="onboarding-card"><p class="onboarding-sub">합격 가능성</p><p class="onboarding-metric">72%</p><div class="on-graph-line"><svg viewBox="0 0 300 90" fill="none"><path d="M0 82H300" stroke="#E7EEF9" stroke-width="2"/><path d="M10 74C34 72 46 62 66 62C90 62 96 70 116 66C136 62 146 48 164 46C182 44 192 56 212 48C230 41 240 30 260 24C274 20 286 14 294 10" stroke="#2F6BFF" stroke-width="4" stroke-linecap="round"/><circle cx="294" cy="10" r="4.5" fill="#2F6BFF"/></svg></div></div>`,
      '데이터로 흔들리지 않는 방향을 잡아드릴게요.',
      'on2'
    ),
    on2: onboarding(
      2,
      '나에게 최적화된\n점수 상승 전략을 제공해요',
      '과목별 효율과 목표 도달 시간을\n정확하게 예측해 드려요.',
      `<div class="onboarding-card"><p class="onboarding-sub" style="margin-top:0">수학 +12점</p><p class="onboarding-sub" style="margin-top:4px">합격 가능성 +18%</p><div class="on-graph-bars"><i></i><i></i><i></i><i></i></div><div class="on-chart-line"><svg viewBox="0 0 300 90" fill="none"><path d="M18 72C54 70 88 66 122 60C156 54 190 45 222 34C246 26 266 20 286 14" stroke="#2F6BFF" stroke-width="4" stroke-linecap="round"/></svg></div></div>`,
      '가장 효율적인 점수 상승 루트를 찾아드릴게요.',
      'on3'
    ),
    on3: onboarding(
      3,
      '실행부터 관리까지\n끝까지 함께해요',
      '플래너, 주간 점검, Sky튜터 피드백,\n프로 보고서로 관리합니다.',
      `<div class="on-feature-list"><div class="on-feature-item"><div class="on-feature-icon">${i('calendar', true)}</div><span>플래너 & 주간 점검</span></div><div class="on-feature-item"><div class="on-feature-icon">${i('chat', true)}</div><span>Sky튜터 1:1 피드백</span></div><div class="on-feature-item"><div class="on-feature-icon">${i('report', true)}</div><span>프로 보고서 (2주에 1번)</span></div></div>`,
      '계획부터 점검까지 끝까지 같이 갈게요.',
      'home',
      '시작하기'
    ),
    home: layout(homeView(), true),
    analysis: layout(
      `<div class="card target-select-card">
        <p class="target-label">목표 대학</p>
        <button class="target-select-btn" data-action="toggleTarget">
          <span>${targetMajor}</span>
          <em>▼</em>
        </button>
        ${targetOpen ? `<div class="target-dropdown">${targetOptions.map((option) => `<button class="target-option ${targetMajor===option?'active':''}" data-action="selectTarget" data-target-major="${option}">${option}</button>`).join('')}</div>` : ''}
      </div>
      <div class="analysis-top card">
        <span class="badge analysis-badge">${targetMajor}</span>
        <div class="analysis-kpi-row"><div><p class="metric-sm">68%</p><p class="analysis-sub">상위 32%</p></div><div class="ring"></div></div>
        <div class="analysis-score-row"><div><b>323점</b><span>현재 점수</span></div><div><b>335점</b><span>합격 컷</span></div><div><b class="danger">-12점</b><span>부족 점수</span></div></div>
      </div>
      <div class="card analysis-impact">
        <p class="analysis-title">과목 영향도</p>
        <div class="analysis-impact-item">수학<div class="track"><i style="width:90%"></i></div><span>+12점 → +18%</span></div>
        <div class="analysis-impact-item">탐구<div class="track"><i style="width:66%;background:#14b8a6"></i></div><span>+6점 → +9%</span></div>
        <div class="analysis-impact-item">국어<div class="track"><i style="width:52%;background:#f59e0b"></i></div><span>+4점 → +6%</span></div>
        <div class="analysis-impact-item">영어<div class="track"><i style="width:46%;background:#ef4444"></i></div><span>+3점 → +5%</span></div>
      </div>
      <div class="card analysis-strategy">
        <p class="analysis-title">합격을 위한 최적 전략</p>
        <ol>
          <li><b>1</b><div><strong>수학 2등급 → 1등급</strong><p>합격 가능성 +18%</p></div></li>
          <li><b>2</b><div><strong>탐구 1과목 집중</strong><p>합격 가능성 +9%</p></div></li>
          <li><b>3</b><div><strong>영어 유지</strong><p>합격 가능성 +5%</p></div></li>
        </ol>
      </div>
      <div class="card analysis-roi">
        <p class="analysis-title">과목별 효율 (ROI)</p>
        <div class="roi-item"><span>수학</span><div class="track"><i style="width:92%"></i></div><em>매우 높음</em></div>
        <div class="roi-item"><span>탐구</span><div class="track"><i style="width:72%;background:#14b8a6"></i></div><em>높음</em></div>
        <div class="roi-item"><span>국어</span><div class="track"><i style="width:58%;background:#f59e0b"></i></div><em>보통</em></div>
        <div class="roi-item"><span>영어</span><div class="track"><i style="width:44%;background:#ef4444"></i></div><em>낮음</em></div>
      </div>
      <div class="analysis-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="planner">플래너로 실행하기</button></div>`,
      true
    ),
    strategy: layout(
      `<div class="feedback-head"><h3>Sky튜터 1:1 피드백</h3></div>
       <div class="feedback-blue card">
         <h4>내 질문 리스트</h4>
         <p>궁금한 내용을 등록하면<br/>Sky튜터가 24시간 내 답변</p>
       </div>
       <div class="card feedback-sample">
         <p class="analysis-title">질문 예시</p>
         <div class="feedback-pills"><span>수학 개념 이해가 안돼요</span><span>탐구 공부법이 궁금해요</span><span>시간 관리 방법이 궁금해요</span></div>
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary cta-btn">새 질문 작성</button></div>
       <div class="card feedback-history">
         <p class="analysis-title">내 질문 내역</p>
         <button class="report-row feedback-row"><div><b>수학 함수 문제 질문</b><p>답변 완료 05.12</p></div><span>${i('chevron', false)}</span></button>
         <button class="report-row feedback-row"><div><b>탐구 개념 질문</b><p>답변 완료 05.10</p></div><span>${i('chevron', false)}</span></button>
       </div>`,
      true
    ),
    planner: layout(
      `<div class="planner-head"><h3>2024년 5월 14일 (화)</h3><button class="planner-cal-btn">${i('calendar', false)}</button></div>
       <div class="planner-weekday"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
       <div class="planner-days"><span>12</span><span>13</span><span class="active">14</span><span>15</span><span>16</span><span>17</span><span>18</span></div>
       <div class="planner-section-title"><div><h4>오늘의 계획</h4><p>총 6시간 30분</p></div></div>
       <div class="planner-plan-list">
         <div class="planner-item"><i class="dot math"></i><div><b>수학</b><p>개념 학습</p><small>10:00 - 12:00</small></div><strong>120분</strong></div>
         <div class="planner-item"><i class="dot eng"></i><div><b>영어</b><p>독해 문제 풀이</p><small>13:00 - 14:30</small></div><strong>90분</strong></div>
         <div class="planner-item"><i class="dot sci"></i><div><b>탐구</b><p>실전문제</p><small>15:00 - 17:00</small></div><strong>120분</strong></div>
         <div class="planner-item"><i class="dot math"></i><div><b>수학</b><p>오답 풀이</p><small>19:00 - 22:00</small></div><strong>180분</strong></div>
       </div>
       <div class="planner-timer"><p>공부 타이머 시작</p><h2>01:25:30</h2></div>`,
      true
    ),
    my: layout(appbar('마이페이지', false) + `<div class="my-stack">
      <div class="card my-profile-card"><div class="my-profile-left"><div class="my-avatar">${i('user', false)}</div><div><p class="my-name">김지민</p><p class="sub">목표 대학: 연세대학교 경영학과</p></div></div><span class="badge">Pro 이용 중</span></div>
      <div class="card my-subscription-card"><div class="my-sub-icon">${i('report', false)}</div><div><p class="my-sub-title">Pro 플랜 이용 중</p><p class="my-sub-date">다음 결제일 2024.06.14</p></div></div>
      <div class="card my-menu-card">
        <button class="my-row">성적 정보 <span>${i('chevron', false)}</span></button>
        <button class="my-row">학습 리포트 <span>${i('chevron', false)}</span></button>
        <button class="my-row" data-action="goto" data-target="proIntro">구독 관리 <span>${i('chevron', false)}</span></button>
      </div>
      <div class="card my-menu-card my-service-card">
        <p class="my-section-title">서비스</p>
        <button class="my-row">알림 설정 <span>${i('chevron', false)}</span></button>
        <button class="my-row">고객센터 <span>${i('chevron', false)}</span></button>
        <button class="my-row">설정 <span>${i('chevron', false)}</span></button>
      </div>
      <div class="card my-empty-card">
        <p class="my-empty-text">아직 데이터가 없어요. 먼저 분석해볼까요?</p>
        <img src="${CRACKY_SRC}" class="my-char crackie" alt="크랙이"/>
      </div>
    </div>`, true),
    weekly: layout(
      `<div class="weekly-head"><button class="weekly-back" data-action="back">←</button><h3>주간 점검</h3><span></span></div>
       <p class="weekly-range">이번 주 점검 (5.6 ~ 5.12)</p>
       <div class="card weekly-rate"><div><p class="sub">플래너 수행률</p><h2>82%</h2></div><span class="badge">목표 90%</span></div>
       <div class="card weekly-feedback">
         <p class="sub" style="margin:0 0 10px;">주간 요약 피드백</p>
         <div class="feedback-item">${i('check', true)}수학 공부 시간이 부족해요. 개념 학습 시간을 늘려보세요.</div>
         <div class="feedback-item">${i('check', true)}탐구 문제 풀이 시간이 좋아요! 유지하면 더 좋은 결과가 기대돼요.</div>
         <div class="feedback-item">${i('check', true)}영어는 꾸준히 잘하고 있어요. 계속 유지해요!</div>
         <img src="${CRACKY_SRC}" class="weekly-char crackie" alt="크랙이"/>
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary weekly-next cta-btn" data-action="goto" data-target="planner">다음 주 계획 세우기</button></div>`,
      true
    ),
    report: layout(
      `<span class="badge">프로 플랜 전용</span>
       <p class="report-desc">2주에 한 번, 내 맞춤 분석 리포트 제공</p>
       <div class="card report-main"><p class="sub">다음 보고서 이용 가능일</p><p class="report-date">5월 25일 (토)</p><h2>D-11</h2></div>
       <div class="card report-list"><p class="sub">이전 보고서</p>
         <button class="report-row" data-action="goto" data-target="reportDetail"><div><b>5월 11일 (토)</b><p>종합 분석 리포트</p></div><span>${i('chevron', false)}</span></button>
         <button class="report-row"><div><b>4월 27일 (토)</b><p>중간 분석 리포트</p></div><span>${i('chevron', false)}</span></button>
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary report-sample cta-btn">프로 보고서 샘플 보기</button></div>`,
      true
    ),
    reportDetail: layout(appbar('종합 분석 리포트', true) + `<div class="report-tabs"><span class="active">종합 분석</span><span>과목 분석</span><span>학습 전략</span><span>현재 위치</span></div><div class="report-detail-stack"><div class="card report-detail-card"><p class="sub">핵심 요약</p><p class="report-detail-text">수학에서 점수 상승 여지가 가장 큽니다. 개념 학습 시간을 늘리고, 문제 풀이 비중을 높이면 단기간 점수 개선이 가능합니다.</p></div><div class="card report-detail-card"><p class="sub">과목별 성과</p><div class="subject-result"><span>수학</span><div class="track"><i style="width:82%"></i></div><em><span class="score">68점</span><span class="delta">▲12</span></em></div><div class="subject-result"><span>국어</span><div class="track"><i style="width:74%"></i></div><em><span class="score">82점</span><span class="delta">▲3</span></em></div><div class="subject-result"><span>영어</span><div class="track"><i style="width:70%"></i></div><em><span class="score">77점</span><span class="delta">-</span></em></div><div class="subject-result"><span>탐구</span><div class="track"><i style="width:62%"></i></div><em><span class="score">66점</span><span class="delta">▲5</span></em></div></div></div><div class="cta-wrapper report-detail-cta"><button class="btn btn-primary cta-btn">PDF 다운로드</button></div>`, false),
    tutor: layout(appbar('SKY튜터 1:1 피드백', true) + `<div class="card"><p class="sub">텍스트 기반 질의응답</p><ul class="list"><li>Q. 수학 개념 이해가 잘 안돼요</li><li>A. 유형별 복습 루틴을 추가하세요</li></ul></div><button class="btn btn-primary">새 질문 작성</button>`, false),
    proIntro: layout(appbar('StudyCrack 요금제', true) + `<p class="sub pricing-sub">합격 전략, 단계별로 선택하세요</p>
      <div class="plan-stack">
        <button class="plan-card basic ${selectedPlan==='Basic'?'active':''}" data-action="selectPlan" data-plan="Basic"><div class="plan-head"><h4>Basic</h4></div><p class="plan-price">${planMeta.Basic.introPrice}</p><ul><li>합격 가능성 분석</li><li>대학별 전략 확인</li></ul></button>
        <button class="plan-card standard ${selectedPlan==='Standard'?'active':''}" data-action="selectPlan" data-plan="Standard"><div class="plan-head"><h4>Standard</h4><span class="badge">추천</span></div><p class="plan-price">${planMeta.Standard.introPrice}</p><ul><li>플래너 피드백</li><li>학습 방향 코칭</li></ul></button>
        <button class="plan-card pro ${selectedPlan==='Pro'?'active':''}" data-action="selectPlan" data-plan="Pro"><div class="plan-head"><h4>Pro</h4><span class="badge">최고 효율</span></div><p class="plan-price">${planMeta.Pro.introPrice}</p><ul><li>모든 기능 무제한 이용</li><li>프로 보고서 2주 1회</li><li>Sky튜터 1:1 피드백</li></ul></button>
      </div>
      <div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="payment">결제하기</button></div>`, false),
    payment: layout(appbar('플랜 선택', true) + `<div class="payment-tabs full">
      <button class="${selectedPlan==='Basic'?'active':''}" data-action="selectPlan" data-plan="Basic">Basic</button>
      <button class="${selectedPlan==='Standard'?'active':''}" data-action="selectPlan" data-plan="Standard">Standard</button>
      <button class="${selectedPlan==='Pro'?'active':''}" data-action="selectPlan" data-plan="Pro">Pro</button>
    </div>
      <div class="card payment-focus-card"><div class="payment-focus-head"><div><h3>${selectedPlan}</h3><p>${currentPlan.payPrice}</p></div></div><p class="payment-desc">${currentPlan.desc}</p><ul class="payment-check-list">${currentPlan.features.map((item) => `<li>${item}</li>`).join('')}</ul></div>
      <div class="duration-row payment-duration-row">
        <button class="${duration==='4주'?'active':''}" data-action="selectDuration" data-duration="4주">4주</button>
        <button class="${duration==='8주'?'active':''}" data-action="selectDuration" data-duration="8주">8주</button>
        <button class="${duration==='12주'?'active':''}" data-action="selectDuration" data-duration="12주">12주</button>
      </div>
      <div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="paymentComplete">결제하기</button></div>`, false),
    paymentComplete: layout(`<div class="payment-done-screen"><div class="payment-complete-wrap"><div class="payment-check">${i('check', true)}</div><p class="title payment-complete-title">결제가 완료되었습니다!</p><p class="sub payment-complete-sub">${selectedPlan.toUpperCase()} 플랜이 활성화되었습니다.</p><div class="card payment-complete-note"><b>프로 보고서 이용 안내</b><p>2주에 한 번 새로운 리포트를 제공해 드려요.<br/>다음 리포트는 5월 25일에 이용 가능해요.</p></div></div><div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="home">홈으로 이동</button></div></div>`, false)
  };

  const current = screens[screen] || screens.home;

  const onClick = (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    if (action === 'goto') goto(actionEl.getAttribute('data-target'));
    if (action === 'back') back();
    if (action === 'tab') goto(actionEl.getAttribute('data-tab'));
    if (action === 'selectPlan') setSelectedPlan(actionEl.getAttribute('data-plan'));
    if (action === 'selectDuration') setDuration(actionEl.getAttribute('data-duration'));
    if (action === 'toggleTarget') setTargetOpen((v) => !v);
    if (action === 'selectTarget') {
      setTargetMajor(actionEl.getAttribute('data-target-major'));
      setTargetOpen(false);
    }
    if (action === 'openUniversityModal') setUniversityModalOpen(true);
    if (action === 'closeUniversityModal') setUniversityModalOpen(false);
    if (action === 'noopModal') return;
  };

  return <div onClick={onClick} dangerouslySetInnerHTML={{ __html: current }} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
