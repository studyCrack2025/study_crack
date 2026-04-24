const { useState, useEffect } = React;

const CRACKY_SRC = 'assets/images/3A1D897F-252E-4096-AEF2-C4FA7CA6689D.png';
const ONBOARDING_LOGO_SRC = './assets/images/og-image.jpg';

function i(name, primary) {
  const c = primary ? 'icon primary' : 'icon';
  const map = {
    home: `<svg viewBox="0 0 24 24" class="${c}"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>`,
    chart: `<svg viewBox="0 0 24 24" class="${c}"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 4-6"/></svg>`,
    target: `<svg viewBox="0 0 24 24" class="${c}"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" class="${c}"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg>`,
    user: `<svg viewBox="0 0 24 24" class="${c}"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>`,
    report: `<svg viewBox="0 0 24 24" class="${c}"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>`,
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

  const appbar = (title, showBack) => `<div class="appbar">${showBack ? '<button class="back-btn" data-action="back">←</button>' : '<div style="width:36px"></div>'}<div class="title">${title}</div></div>`;
  const tabBtn = (k, label, iconName) => `<button class="${tab === k ? 'active' : ''}" data-action="tab" data-tab="${k}">${i(iconName, tab===k)}<span>${label}</span></button>`;
  const tabbar = () => `<div class="tabbar">${tabBtn('home','홈','home')}${tabBtn('analysis','분석','chart')}${tabBtn('strategy','전략','target')}${tabBtn('planner','플래너','calendar')}${tabBtn('my','마이','user')}</div>`;
  const layout = (inner, withTab) => `<div class="app-shell"><div class="screen app-screen app-content">${inner}</div>${withTab ? tabbar() : ''}</div>`;
  const quick = (action, iconName, label) => `<div class="quick-item" data-action="goto" data-target="${action}">${i(iconName,false)}<div class="q-label">${label}</div></div>`;
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

  const homeView = () => `<div class="brand-row"><p class="greeting">안녕하세요, 지민님</p><img class="brand-logo-sm" src="./assets/images/studycrack_logo_wo_bg.png" alt="logo"/></div>
    <div class="section"><div class="card kpi-card"><p class="sub">내 합격 가능성</p><div style="display:flex;justify-content:space-between;align-items:center"><div><p class="metric">68%</p><p class="sub">상위 32%</p></div><div class="ring"></div></div>
    <div class="kpi-row"><div class="kpi-item"><b>323점</b>현재점수</div><div class="kpi-item"><b>335점</b>합격컷</div><div class="kpi-item danger"><b>-12점</b>부족점수</div></div>${mascotBubble('수학 +12점에 집중하면 가능성이 빠르게 올라가요.','sm')}</div></div>
    <div class="section"><div class="notice"><b>문제 인식</b><br/>수학이 현재 합격 가능성을 제한하고 있어요</div></div>
    <div class="section"><div class="quick-grid">${quick('analysis','chart','분석')}${quick('strategy','target','전략')}${quick('planner','calendar','플래너')}</div></div>
    <div class="section"><div class="card compact"><p class="sub">학습 트래킹</p><div class="bar">주간 공부시간<div class="track"><i style="width:78%"></i></div><span>36h</span></div><div class="bar">평균 대비<div class="track"><i style="width:68%"></i></div><span>상위32%</span></div></div></div>
    <div class="section"><div class="card compact"><p class="sub">최근 리포트</p><ul class="list"><li>5월 11일 종합 분석 리포트</li></ul></div></div>
    <div class="section"><div class="card compact"><p class="sub">오늘 할 일</p><ul class="list"><li>수학 개념 120분</li><li>영어 독해 90분</li></ul></div></div>
    <div class="section"><button class="btn btn-primary" data-action="goto" data-target="proPlan">Pro 업그레이드</button></div>`;

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
    analysis: layout(appbar('분석', false) + `<div class="card"><span class="badge">연세대학교 경영학과</span><p class="metric-sm">68%</p><p class="sub">현재 323점 / 합격 컷 335점 / 부족 -12점</p></div><div class="card"><div class="bar">수학<div class="track"><i style="width:88%"></i></div><span>+15%</span></div><div class="bar">탐구<div class="track"><i style="width:72%;background:#0ea5a2"></i></div><span>+9%</span></div></div><div class="card compact"><p class="sub">현재 병목</p><p style="margin:0;font-weight:600">수학이 합격 가능성을 제한하고 있어요</p></div>`, true),
    strategy: layout(appbar('전략', false) + `<div class="card"><ul class="list"><li><b>1</b> 수학 2등급 → 1등급</li><li><b>2</b> 탐구 1과목 집중</li><li><b>3</b> 영어 유지 전략</li></ul></div><button class="btn btn-primary" data-action="goto" data-target="planner">플래너로 실행하기</button>`, true),
    planner: layout(appbar('플래너', false) + `<div class="card"><p class="sub">2024년 5월 14일 (화)</p><div class="calendar"><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div><div>일</div><div>12</div><div>13</div><div class="active">14</div><div>15</div><div>16</div><div>17</div><div>18</div></div></div><div class="card"><ul class="list"><li><span class="tag math">수학</span>개념 학습 10:00-12:00</li><li><span class="tag eng">영어</span>독해 문제 풀이 13:00-14:30</li></ul></div><div class="card center"><p class="sub">공부 타이머</p><p class="metric-sm">01:25:30</p></div><div class="card compact"><p class="sub">오늘 요약</p><p style="margin:0;font-size:14px">총 6시간 30분 / 목표 달성률 82%</p></div>`, true),
    my: layout(appbar('마이페이지', false) + `<div class="card"><p class="title" style="margin:0">김지민</p><p class="sub">목표 대학: 연세대학교 경영학과</p><span class="badge">Pro 이용 중</span></div><div class="card"><ul class="list"><li>성적 정보</li><li>학습 리포트</li><li>구독 관리</li></ul><div class="center"><img src="${CRACKY_SRC}" class="cracky-img cracky-lg" alt="크랙이"/><p class="sub">아직 데이터가 없어요. 먼저 분석해볼까요?</p></div></div>`, true),
    weekly: layout(appbar('주간 점검', true) + `<div class="card"><p class="sub">플래너 수행률</p><p class="metric-sm">82%</p><div class="progress"><span style="width:82%"></span></div></div><button class="btn btn-primary" data-action="back">다음 주 계획 세우기</button>`, false),
    report: layout(appbar('프로 보고서', true) + `<div class="card"><span class="badge">Pro 플랜 전용</span><p class="sub">2주에 1회 제공</p><div class="card" style="padding:14px"><div style="display:flex;justify-content:space-between;align-items:center"><div><p class="metric-sm">D-11</p><p class="sub">5월 25일 (토)</p></div></div></div></div><div class="card"><ul class="list"><li data-action="goto" data-target="reportDetail">5월 11일 · 종합 분석 리포트</li><li>4월 27일 · 중간 분석 리포트</li></ul></div><div class="card compact"><p class="sub">이전 보고서</p><ul class="list"><li>5월 11일 · 종합 분석 리포트</li><li>4월 27일 · 중간 분석 리포트</li></ul></div><button class="btn btn-primary">PDF 다운로드</button>`, false),
    reportDetail: layout(appbar('프로 보고서 상세', true) + `<div class="card"><ul class="list"><li>수학 점수 상승 여지 큼</li><li>목표 대학 거리 -12점</li><li>중기: 탐구 집중 강화</li></ul></div><div class="card compact"><p class="sub">장기 전략</p><p style="margin:0;font-size:14px">6월 모평 전 수학 전범위 1회독 완료</p></div>`, false),
    tutor: layout(appbar('SKY튜터 1:1 피드백', true) + `<div class="card"><p class="sub">텍스트 기반 질의응답</p><ul class="list"><li>Q. 수학 개념 이해가 잘 안돼요</li><li>A. 유형별 복습 루틴을 추가하세요</li></ul></div><button class="btn btn-primary">새 질문 작성</button>`, false),
    proPlan: layout(appbar('프로 플랜 안내', true) + `<div class="card"><p class="title" style="margin:0;color:#0b63e5">PRO PLAN</p><ul class="list"><li>합격 가능성/전략 무제한</li><li>플래너/주간 점검 무제한</li><li>프로 보고서 2주 1회 포함</li></ul></div><button class="btn btn-primary" data-action="goto" data-target="paymentSelect">결제 선택으로</button>`, false),
    paymentSelect: layout(appbar('결제 선택', true) + `<div class="card"><p class="title" style="margin:0">Standard</p><p class="sub">월 149,000원</p></div><div class="card" style="border:2px solid #0b63e5"><p class="title" style="margin:0">Pro</p><p class="sub">월 299,000원</p></div><button class="btn btn-primary" data-action="goto" data-target="paymentDone">결제하기</button>`, false),
    paymentDone: layout(appbar('결제 완료', true) + `<div class="card center"><div style="width:96px;height:96px;border-radius:50%;background:#0b63e5;display:grid;place-items:center;margin:0 auto 14px">${i('check', true)}</div><p class="title" style="margin:0">결제가 완료되었습니다</p><p class="sub">Pro 플랜이 활성화되었습니다.</p></div><button class="btn btn-primary" data-action="goto" data-target="home">홈으로 이동</button>`, false)
  };

  const current = screens[screen] || screens.home;

  const onClick = (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.getAttribute('data-action');
    if (action === 'goto') goto(actionEl.getAttribute('data-target'));
    if (action === 'back') back();
    if (action === 'tab') goto(actionEl.getAttribute('data-tab'));
  };

  return <div onClick={onClick} dangerouslySetInnerHTML={{ __html: current }} />;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
