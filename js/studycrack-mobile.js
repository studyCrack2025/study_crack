(function () {
  var root = document.getElementById('root');
  if (!root) return;
  root.textContent = 'StudyCrack 앱을 준비 중입니다...';

  var state = { screen: 'splash', tab: 'home', history: [] };
  var tabIcons = { home: '🏠', analysis: '📊', strategy: '🎯', planner: '🗓️', my: '👤' };

  var tabScreens = { home: 'home', analysis: 'analysis', strategy: 'strategy', planner: 'planner', my: 'my' };

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
      + (showBack ? '<button class="back-btn" data-action="back">←</button>' : '<div style="width:32px"></div>')
      + '<div class="title">' + title + '</div>'
      + '</div>';
  }

  function tabbar() {
    var keys = ['home', 'analysis', 'strategy', 'planner', 'my'];
    return '<div class="tabbar">' + keys.map(function (k) {
      var active = state.tab === k ? 'active' : '';
      var label = k === 'home' ? '홈' : k === 'analysis' ? '분석' : k === 'strategy' ? '전략' : k === 'planner' ? '플래너' : '마이';
      return '<button class="' + active + '" data-action="tab" data-tab="' + k + '"><span>' + tabIcons[k] + '</span><span>' + label + '</span></button>';
    }).join('') + '</div>';
  }

  function layout(inner, withTab) {
    return '<div class="phone"><div class="screen">' + inner + '</div>' + (withTab ? tabbar() : '') + '</div>';
  }

  function homeView() {
    return appbar('홈 대시보드', false)
      + '<div class="card"><p class="small">내 합격 가능성</p><div class="row"><div><p class="metric">68%</p><p class="small">상위 32%</p></div><div><div class="ring"></div></div></div>'
      + '<div class="row"><div class="small">현재 323점</div><div class="small">컷 335점</div><div class="small" style="color:var(--danger)">-12점</div></div></div>'
      + '<div class="notice">수학이 합격 가능성을 제한하고 있습니다.</div>'
      + '<div class="card"><div class="row"><button class="btn ghost" data-action="goto" data-target="analysis">분석</button><button class="btn ghost" data-action="goto" data-target="strategy">전략</button><button class="btn ghost" data-action="goto" data-target="planner">플래너</button></div></div>'
      + '<div class="card clickable" data-action="goto" data-target="weekly"><b>주간 점검</b><p class="small">플래너 수행률 82% 확인</p></div>'
      + '<div class="card clickable" data-action="goto" data-target="tutor"><b>SKY튜터 1:1 피드백</b><p class="small">텍스트 기반 질의응답</p></div>'
      + '<div class="card clickable" data-action="goto" data-target="report"><b>프로 보고서</b><p class="small">2주에 1회 제공 · 다음 이용 D-11</p></div>'
      + '<button class="btn" data-action="goto" data-target="proPlan">Pro 업그레이드</button>';
  }

  function screenHtml(name) {
    if (name === 'splash') {
      return '<div class="phone"><div class="splash"><div class="logo">⚡</div><h1 style="margin:0">스터디크랙</h1><p>합격까지 가장 빠른 전략</p><button class="btn" data-action="goto" data-target="on1">시작하기</button></div></div>';
    }
    if (name === 'on1') return layout(appbar('온보딩 1', true) + '<div class="card"><h3>데이터 기반 합격 가능성 분석</h3><p class="metric">72%</p><div class="progress"><span style="width:72%"></span></div></div><button class="btn" data-action="goto" data-target="on2">다음</button>', false);
    if (name === 'on2') return layout(appbar('온보딩 2', true) + '<div class="card"><h3>점수 상승 전략 역산</h3><ul class="list"><li>수학 +12점 → +18%</li><li>탐구 +1등급 → +9%</li></ul></div><button class="btn" data-action="goto" data-target="on3">다음</button>', false);
    if (name === 'on3') return layout(appbar('온보딩 3', true) + '<div class="card"><h3>실행부터 관리까지 함께</h3><ul class="list"><li>플래너</li><li>주간 점검</li><li>SKY튜터 피드백</li><li>프로 보고서</li></ul></div><button class="btn" data-action="goto" data-target="home">홈으로</button>', false);
    if (name === 'home') return layout(homeView(), true);
    if (name === 'analysis') return layout(appbar('분석', false) + '<div class="card"><span class="badge">연세대학교 경영학과</span><p class="metric">68%</p><p class="small">현재 323점 / 합격 컷 335점 / -12점</p></div><div class="card"><h3>과목별 영향도</h3><ul class="list"><li>수학 +10점 → +15%</li><li>영어 +1등급 → +5%</li><li>탐구 +6점 → +9%</li></ul></div>', true);
    if (name === 'strategy') return layout(appbar('전략', false) + '<div class="card"><h3>핵심 전략</h3><ul class="list"><li>수학 2등급 → 1등급</li><li>탐구 1과목 집중</li><li>영어 유지</li></ul></div><div class="card"><h3>과목별 ROI</h3><div class="bar">수학<div class="track"><i style="width:90%"></i></div></div><div class="bar">탐구<div class="track"><i style="width:72%;background:#0ea5a2"></i></div></div><div class="bar">국어<div class="track"><i style="width:55%;background:#f59e0b"></i></div></div><p class="small">도달 예상: 6월 18일</p></div>', true);
    if (name === 'planner') return layout(appbar('플래너', false) + '<div class="card"><h3>오늘 공부 시간 6시간 30분</h3><ul class="list"><li>수학 10:00-12:00</li><li>영어 13:00-14:30</li><li>탐구 15:00-17:00</li><li>수학 오답 19:00-22:00</li></ul></div><div class="card center"><p class="small">공부 타이머</p><p class="metric" style="font-size:36px">01:25:30</p></div>', true);
    if (name === 'my') return layout(appbar('마이페이지', false) + '<div class="card"><h3>김지민</h3><p class="small">목표 대학: 연세대학교 경영학과</p><p class="badge">Pro 플랜 이용 중</p></div><div class="card"><ul class="list"><li>성적 정보</li><li>학습 리포트</li><li>구독 관리</li><li>설정</li></ul></div>', true);
    if (name === 'weekly') return layout(appbar('주간 점검', true) + '<div class="card"><p class="small">플래너 수행률</p><p class="metric" style="font-size:42px">82%</p></div><div class="card"><h3>튜터 피드백</h3><ul class="list"><li>수학 시간이 부족해요</li><li>개념 비중을 늘려보세요</li></ul></div><button class="btn" data-action="back">다음 주 계획 세우기</button>', false);
    if (name === 'report') return layout(appbar('프로 보고서', true) + '<div class="card"><span class="badge">Pro 플랜 포함</span><p class="small">2주에 1회 제공</p><p class="metric" style="font-size:40px">D-11</p><p class="small">다음 이용 가능일: 5월 25일</p></div><div class="card clickable" data-action="goto" data-target="reportDetail"><b>종합 분석 리포트</b><p class="small">2024.05.11</p></div>', false);
    if (name === 'reportDetail') return layout(appbar('프로 보고서 상세', true) + '<div class="card"><h3>학습 평가</h3><ul class="list"><li>수학 점수 상승 여지 큼</li><li>목표 대학 거리 -12점</li><li>중기: 탐구 집중</li><li>장기: 6월 전 수학 완성</li></ul></div><button class="btn ghost">PDF 다운로드</button>', false);
    if (name === 'tutor') return layout(appbar('SKY튜터 1:1 피드백', true) + '<div class="card"><h3>텍스트 기반 질의응답</h3><ul class="list"><li>Q. 수학 개념 이해가 잘 안돼요</li><li>A. 유형별 복습 루틴을 추가하세요</li></ul></div><button class="btn">새 질문 작성</button>', false);
    if (name === 'proPlan') return layout(appbar('프로 플랜 안내', true) + '<div class="card"><h3 style="color:var(--blue)">PRO PLAN</h3><ul class="list"><li>합격 가능성/전략 무제한</li><li>플래너/주간 점검 무제한</li><li>SKY튜터 1:1 무제한</li><li>프로 보고서 2주 1회 포함</li></ul></div><button class="btn" data-action="goto" data-target="paymentSelect">결제 선택으로</button>', false);
    if (name === 'paymentSelect') return layout(appbar('결제 선택', true) + '<div class="card"><h3>Standard</h3><p>월 149,000원</p></div><div class="card" style="border:2px solid var(--blue)"><h3>Pro</h3><p>월 299,000원</p><p class="small">프로 보고서 2주 1회 포함</p></div><button class="btn" data-action="goto" data-target="paymentDone">결제하기</button>', false);
    if (name === 'paymentDone') return layout(appbar('결제 완료', true) + '<div class="card" style="text-align:center"><div style="width:88px;height:88px;border-radius:50%;background:var(--blue);color:#fff;display:grid;place-items:center;margin:8px auto;font-size:44px">✓</div><h3>결제가 완료되었습니다</h3><p class="small">Pro 플랜이 활성화되었습니다.</p></div><button class="btn" data-action="goto" data-target="home">홈으로 이동</button>', false);
    return layout(appbar('오류', true) + '<div class="card">화면을 찾을 수 없습니다.</div>', false);
  }

  function render() {
    try {
      root.innerHTML = screenHtml(state.screen);
    } catch (e) {
      root.innerHTML = '<div style="padding:20px;color:#b91c1c;font-family:Pretendard,sans-serif;">렌더링 오류: ' + String(e) + '</div>';
    }
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
