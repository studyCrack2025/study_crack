(function () {
  var root = document.getElementById('root');
  if (!root) return;
  root.textContent = 'StudyCrack 앱을 준비 중입니다...';

  var state = { screen: 'splash', tab: 'home', history: [] };
  var tabScreens = { home: 'home', analysis: 'analysis', strategy: 'strategy', planner: 'planner', my: 'my' };

  function i(name, primary) {
    var c = primary ? 'icon primary' : 'icon';
    var map = {
      home: '<svg viewBox="0 0 24 24" class="' + c + '"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
      chart: '<svg viewBox="0 0 24 24" class="' + c + '"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 4-6"/></svg>',
      target: '<svg viewBox="0 0 24 24" class="' + c + '"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>',
      calendar: '<svg viewBox="0 0 24 24" class="' + c + '"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 9h18"/></svg>',
      user: '<svg viewBox="0 0 24 24" class="' + c + '"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
      report: '<svg viewBox="0 0 24 24" class="' + c + '"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/></svg>',
      chat: '<svg viewBox="0 0 24 24" class="' + c + '"><path d="M4 5h16v11H8l-4 4z"/></svg>',
      check: '<svg viewBox="0 0 24 24" class="' + c + '"><path d="M20 6L9 17l-5-5"/></svg>',
      bolt: '<svg viewBox="0 0 24 24" class="' + c + '"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>'
    };
    return map[name] || map.chart;
  }

  function goto(screen, addHistory) {
    if (addHistory !== false && state.screen !== screen) state.history.push(state.screen);
    state.screen = screen;
    if (tabScreens[screen]) state.tab = screen;
    render();
  }

  function back() {
    if (state.history.length) {
      state.screen = state.history.pop();
      render();
      return;
    }
    goto('home', false);
  }

  function appbar(title, showBack) {
    return '<div class="appbar">'
      + (showBack ? '<button class="back-btn" data-action="back">←</button>' : '<div style="width:36px"></div>')
      + '<div class="title">' + title + '</div>'
      + '</div>';
  }

  function tabBtn(k, label, iconName) {
    var active = state.tab === k;
    return '<button class="' + (active ? 'active' : '') + '" data-action="tab" data-tab="' + k + '">' + i(iconName, active) + '<span>' + label + '</span></button>';
  }

  function tabbar() {
    return '<div class="tabbar">'
      + tabBtn('home', '홈', 'home')
      + tabBtn('analysis', '분석', 'chart')
      + tabBtn('strategy', '전략', 'target')
      + tabBtn('planner', '플래너', 'calendar')
      + tabBtn('my', '마이', 'user')
      + '</div>';
  }

  function layout(inner, withTab) {
    return '<div class="phone"><div class="screen">' + inner + '</div>' + (withTab ? tabbar() : '') + '</div>';
  }

  function quick(action, iconName, label) {
    return '<div class="quick-item" data-action="goto" data-target="' + action + '">' + i(iconName, false) + '<div class="q-label">' + label + '</div></div>';
  }

  function mascotBubble(text) {
    return '<div class="mascot"><div class="mascot-face">크</div><div class="bubble">' + text + '</div></div>';
  }

  function homeView() {
    return '<div class="brand-row"><p class="greeting">안녕하세요, 지민님</p><img class="brand-logo-sm" src="./assets/images/studycrack_logo_wo_bg.png" alt="logo"/></div>'
      + '<div class="section">'
      + '<div class="card"><p class="sub">내 합격 가능성</p><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><div><p class="metric">68%</p><p class="sub">상위 32%</p></div><div class="ring"></div></div>'
      + '<div class="kpi-row"><div class="kpi-item"><b>323점</b>현재점수</div><div class="kpi-item"><b>335점</b>합격컷</div><div class="kpi-item danger"><b>-12점</b>부족점수</div></div>'
      + mascotBubble('이 방향이면 합격 확률 올라가요!') + '</div></div>'
      + '<div class="section"><div class="notice">수학이 합격 가능성을 제한하고 있어요</div></div>'
      + '<div class="section"><div class="quick-grid">'
      + quick('analysis', 'chart', '분석') + quick('strategy', 'target', '전략') + quick('planner', 'calendar', '플래너')
      + quick('weekly', 'check', '주간점검') + quick('report', 'report', '프로보고서') + quick('tutor', 'chat', 'SKY튜터')
      + '</div></div>'
      + '<div class="section"><button class="btn btn-primary" data-action="goto" data-target="proPlan">Pro 업그레이드</button></div>';
  }

  function screenHtml(name) {
    if (name === 'splash') {
      return '<div class="phone"><div class="splash"><div class="logo-bolt">' + i('bolt', true) + '</div><img class="brand-logo" src="./assets/images/studycrack_logo_wo_bg.png" alt="logo"/><h1 style="margin:0;font-size:30px">스터디크랙</h1><p style="opacity:.95">합격까지 가장 빠른 전략</p><button class="btn btn-primary" data-action="goto" data-target="on1">시작하기</button></div></div>';
    }
    if (name === 'on1') return layout(appbar('온보딩 1', true) + '<div class="card"><p class="sub">데이터 기반 합격 가능성 분석</p><p class="metric-sm">72%</p><div class="progress"><span style="width:72%"></span></div>' + mascotBubble('흔들리지 않는 방향을 찾았어요!') + '</div><button class="btn btn-primary" data-action="goto" data-target="on2">다음</button>', false);
    if (name === 'on2') return layout(appbar('온보딩 2', true) + '<div class="card"><p class="sub">점수 상승 전략 역산</p><ul class="list"><li>수학 +12점 → 합격 가능성 +18%</li><li>탐구 +1등급 → 합격 가능성 +9%</li></ul>' + mascotBubble('과목 ROI부터 공략하면 빨라요!') + '</div><button class="btn btn-primary" data-action="goto" data-target="on3">다음</button>', false);
    if (name === 'on3') return layout(appbar('온보딩 3', true) + '<div class="card"><p class="sub">실행부터 관리까지 함께</p><ul class="list"><li>플래너</li><li>주간 점검</li><li>SKY튜터 피드백</li><li>프로 보고서</li></ul></div><button class="btn btn-primary" data-action="goto" data-target="home">홈으로</button>', false);
    if (name === 'home') return layout(homeView(), true);
    if (name === 'analysis') return layout(appbar('분석', false) + '<div class="card"><span class="badge">연세대학교 경영학과</span><p class="metric-sm">68%</p><p class="sub">현재 323점 / 합격 컷 335점 / 부족 -12점</p></div><div class="card"><div class="bar">수학<div class="track"><i style="width:88%"></i></div><span>+15%</span></div><div class="bar">탐구<div class="track"><i style="width:72%;background:#0ea5a2"></i></div><span>+9%</span></div><div class="bar">국어<div class="track"><i style="width:54%;background:#f59e0b"></i></div><span>+6%</span></div><div class="bar">영어<div class="track"><i style="width:42%;background:#ef4444"></i></div><span>+5%</span></div></div>', true);
    if (name === 'strategy') return layout(appbar('전략', false) + '<div class="card"><ul class="list"><li><b>1</b> 수학 2등급 → 1등급</li><li><b>2</b> 탐구 1과목 집중</li><li><b>3</b> 영어 유지 전략</li></ul></div><div class="card"><p class="sub">ROI 카드</p><div class="bar">수학<div class="track"><i style="width:90%"></i></div></div><div class="bar">탐구<div class="track"><i style="width:72%;background:#0ea5a2"></i></div></div><div class="bar">국어<div class="track"><i style="width:55%;background:#f59e0b"></i></div></div><p class="sub">목표 도달 예상: 6월 18일</p></div><button class="btn btn-primary" data-action="goto" data-target="planner">플래너로 실행하기</button>', true);
    if (name === 'planner') return layout(appbar('플래너', false) + '<div class="card"><p class="sub">2024년 5월 14일 (화)</p><div class="calendar"><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div>토</div><div>일</div><div>12</div><div>13</div><div class="active">14</div><div>15</div><div>16</div><div>17</div><div>18</div></div></div><div class="card"><ul class="list"><li><span class="tag math">수학</span>개념 학습 10:00-12:00</li><li><span class="tag eng">영어</span>독해 문제 풀이 13:00-14:30</li><li><span class="tag sci">탐구</span>실전문제 15:00-17:00</li><li><span class="tag math">수학</span>오답 정리 19:00-22:00</li></ul></div><div class="card center"><p class="sub">공부 타이머</p><p class="metric-sm">01:25:30</p></div>', true);
    if (name === 'my') return layout(appbar('마이페이지', false) + '<div class="card"><p class="title" style="margin:0">김지민</p><p class="sub">목표 대학: 연세대학교 경영학과</p><span class="badge">Pro 플랜 이용 중</span></div><div class="card"><ul class="list"><li>성적 정보</li><li>학습 리포트</li><li>구독 관리</li><li>설정</li></ul>' + mascotBubble('아직 데이터가 없어요. 먼저 분석해볼까요?') + '</div>', true);
    if (name === 'weekly') return layout(appbar('주간 점검', true) + '<div class="card"><p class="sub">플래너 수행률</p><p class="metric-sm">82%</p><div class="progress"><span style="width:82%"></span></div></div><div class="card"><ul class="list"><li>수학 절대 시간이 부족해요</li><li>개념 비중을 늘려보세요</li></ul></div><button class="btn btn-primary" data-action="back">다음 주 계획 세우기</button>', false);
    if (name === 'report') return layout(appbar('프로 보고서', true) + '<div class="card"><span class="badge">Pro 플랜 전용</span><p class="sub">2주에 1회 제공</p><div class="card" style="padding:14px"><p class="sub">다음 이용 가능일</p><div style="display:flex;justify-content:space-between;align-items:center"><div><p class="metric-sm">D-11</p><p class="sub">5월 25일 (토)</p></div><div class="mascot-face">크</div></div></div></div><div class="card"><ul class="list"><li class="clickable" data-action="goto" data-target="reportDetail">5월 11일 · 종합 분석 리포트</li><li>4월 27일 · 중간 분석 리포트</li></ul></div>', false);
    if (name === 'reportDetail') return layout(appbar('프로 보고서 상세', true) + '<div class="card"><ul class="list"><li>수학 점수 상승 여지 큼</li><li>목표 대학 거리 -12점</li><li>중기: 탐구 집중 강화</li><li>장기: 6월 전 수학 완성</li></ul></div><button class="btn btn-ghost">PDF 다운로드</button>', false);
    if (name === 'tutor') return layout(appbar('SKY튜터 1:1 피드백', true) + '<div class="card"><p class="sub">텍스트 기반 질의응답</p><ul class="list"><li>Q. 수학 개념 이해가 잘 안돼요</li><li>A. 유형별 복습 루틴을 추가하세요</li></ul></div><button class="btn btn-primary">새 질문 작성</button>', false);
    if (name === 'proPlan') return layout(appbar('프로 플랜 안내', true) + '<div class="card"><p class="title" style="margin:0;color:#0b63e5">PRO PLAN</p><ul class="list"><li>합격 가능성/전략 무제한</li><li>플래너/주간 점검 무제한</li><li>SKY튜터 1:1 무제한</li><li>프로 보고서 2주 1회 포함</li></ul></div><button class="btn btn-primary" data-action="goto" data-target="paymentSelect">결제 선택으로</button>', false);
    if (name === 'paymentSelect') return layout(appbar('결제 선택', true) + '<div class="card"><p class="title" style="margin:0">Standard</p><p class="sub">월 149,000원</p></div><div class="card" style="border:2px solid #0b63e5"><p class="title" style="margin:0">Pro</p><p class="sub">월 299,000원 · 프로 보고서 2주 1회 포함</p></div><button class="btn btn-primary" data-action="goto" data-target="paymentDone">결제하기</button>', false);
    if (name === 'paymentDone') return layout(appbar('결제 완료', true) + '<div class="card center"><div style="width:96px;height:96px;border-radius:50%;background:#0b63e5;display:grid;place-items:center;margin:0 auto 14px">' + i('check', true) + '</div><p class="title" style="margin:0">결제가 완료되었습니다</p><p class="sub">Pro 플랜이 활성화되었습니다.</p></div><button class="btn btn-primary" data-action="goto" data-target="home">홈으로 이동</button>', false);
    return layout(appbar('오류', true) + '<div class="card">화면을 찾을 수 없습니다.</div>', false);
  }

  function render() {
    try { root.innerHTML = screenHtml(state.screen); }
    catch (e) { root.innerHTML = '<div style="padding:20px;color:#b91c1c">렌더링 오류: ' + String(e) + '</div>'; }
  }

  root.addEventListener('click', function (e) {
    var actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    var action = actionEl.getAttribute('data-action');
    if (action === 'goto') goto(actionEl.getAttribute('data-target'));
    if (action === 'back') back();
    if (action === 'tab') goto(actionEl.getAttribute('data-tab'));
  });

  setTimeout(function () { goto('on1'); }, 900);
  render();
})();
