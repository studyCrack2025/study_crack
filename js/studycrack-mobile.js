(function () {
  var root = document.getElementById('root');
  if (!root) return;

  // 기본 fallback (렌더 실패 시에도 흰 화면 방지)
  root.innerHTML = '<div style="padding:20px;font-family:Pretendard,sans-serif;color:#334155;">StudyCrack 화면을 불러오는 중입니다...</div>';

  function tabTemplate(active) {
    var tabs = ['홈', '분석', '전략', '플래너', '마이'];
    var icons = ['🏠', '📊', '🎯', '🗓️', '👤'];
    var items = tabs.map(function (tab, i) {
      var cls = active === tab ? 'active' : '';
      return '<div class="' + cls + '"><span>' + icons[i] + '</span>' + tab + '</div>';
    }).join('');
    return '<div class="tabbar">' + items + '</div>';
  }

  function frame(title, bodyHtml) {
    return '<section class="frame-wrap">'
      + '<div class="frame-title">' + title + '</div>'
      + '<article class="phone">' + bodyHtml + '</article>'
      + '</section>';
  }

  var screens = [
    frame('1. 스플래시',
      '<div class="hero-blue">'
      + '<div class="logo">⚡</div>'
      + '<h2 style="margin:0;font-size:34px;">스터디크랙</h2>'
      + '<p style="margin-top:6px;opacity:.9;">STUDY CRACK</p>'
      + '<p style="margin-top:18px;font-weight:700;">합격까지 가장 빠른 전략</p>'
      + '</div>'
    ),
    frame('2. 온보딩 1',
      '<div class="screen"><div class="card center"><h3 class="h3">데이터 기반으로<br/>합격 가능성 분석</h3><p class="muted">흔들리지 않는 방향을 제시합니다.</p></div>'
      + '<div class="card"><p class="sub">합격 가능성</p><p class="metric">72%</p><div class="progress"><span style="width:72%"></span></div></div>'
      + '<button class="btn">다음</button></div>'
    ),
    frame('3. 온보딩 2',
      '<div class="screen"><div class="card center"><h3 class="h3">점수 상승 전략을<br/>역산으로 제공합니다</h3><p class="muted">과목별 효과와 목표 도달 시간을 계산합니다.</p></div>'
      + '<div class="card"><ul class="clean"><li>수학 +12점 → 합격 가능성 +18%</li><li>탐구 +1등급 → 합격 가능성 +9%</li></ul></div>'
      + '<button class="btn">다음</button></div>'
    ),
    frame('4. 온보딩 3',
      '<div class="screen"><div class="card center"><h3 class="h3">실행부터 관리까지<br/>끝까지 함께해요</h3></div>'
      + '<div class="icon-menu"><div class="icon-item">🗓️<br/>플래너</div><div class="icon-item">✅<br/>주간 점검</div><div class="icon-item">🧑‍🏫<br/>SKY 튜터</div><div class="icon-item">📄<br/>프로 보고서</div><div class="icon-item">📈<br/>전략 리포트</div><div class="icon-item">🎯<br/>합격 분석</div></div>'
      + '<div style="margin-top:12px"><button class="btn">시작하기</button></div></div>'
    ),
    frame('5. 홈 대시보드',
      '<div class="screen"><div class="card"><p class="sub">내 합격 가능성</p><div class="row"><div><p class="metric">68%</p><p class="muted">상위 32%</p></div><div style="display:flex;justify-content:center;align-items:center;"><div class="ring"></div></div><div class="row"><div class="kpi">현재<br/><b>323</b></div><div class="kpi">컷<br/><b>335</b></div><div class="kpi" style="color:var(--danger)">격차<br/><b>-12</b></div></div></div></div>'
      + '<div class="notice">수학이 합격 가능성을 제한하고 있습니다. 전략 탭에서 우선 과목을 확인하세요.</div>'
      + '<div class="card"><div class="row"><button class="btn secondary">분석</button><button class="btn secondary">전략</button><button class="btn secondary">플래너</button></div></div>'
      + '<div class="card"><h3 class="h3">학습 트래킹</h3><ul class="clean"><li>주간 공부 시간 36시간 30분</li><li>평균 대비 위치 상위 32%</li><li>선택 랭킹 128 / 1,530</li></ul></div>'
      + tabTemplate('홈') + '</div>'
    ),
    frame('6. 플래너',
      '<div class="screen"><div class="card"><h3 class="h3">2024년 5월 14일 (화)</h3><p class="muted">오늘 공부 시간 6시간 30분</p><ul class="clean"><li>수학 개념 학습 10:00-12:00</li><li>영어 독해 문제 풀이 13:00-14:30</li><li>탐구 실전문제 15:00-17:00</li><li>수학 오답 정리 19:00-22:00</li></ul></div>'
      + '<div class="card center"><p class="sub">공부 타이머 시작</p><p class="metric" style="font-size:36px;">01:25:30</p></div>'
      + tabTemplate('플래너') + '</div>'
    ),
    frame('7. 주간 점검',
      '<div class="screen"><div class="card center"><h3 class="h3">주간 점검</h3><p class="muted">이번 주 점검 (5.6 ~ 5.12)</p><p class="metric" style="font-size:42px;">82%</p><p class="chip">목표 90%</p></div>'
      + '<div class="card"><h3 class="h3">주간 요약 피드백</h3><ul class="clean"><li>수학 절대 시간이 부족해요. 개념 비중을 늘려보세요.</li><li>탐구는 문제 풀이 시간이 좋아요! 유지하면 좋아요.</li><li>영어는 꾸준히 잘하고 있어요. 계속 유지하세요.</li></ul></div>'
      + '<button class="btn">다음 주 계획 세우기</button></div>'
    ),
    frame('8. 프로 보고서',
      '<div class="screen"><div class="card"><span class="chip">프로 플랜 전용</span><p class="muted">2주에 한 번, 내 맞춤 분석 리포트 제공</p><div class="card" style="margin-bottom:0"><p class="sub">다음 보고서 이용 가능일</p><p class="metric" style="font-size:40px;">D-11</p><p class="muted">5월 25일 (토)</p></div></div>'
      + '<div class="card"><h3 class="h3">이전 보고서</h3><ul class="clean"><li>5월 11일 · 종합 분석 리포트</li><li>4월 27일 · 중간 분석 리포트</li></ul></div><button class="btn">프로 보고서 샘플 보기</button>'
      + tabTemplate('마이') + '</div>'
    ),
    frame('9. 프로 보고서 상세',
      '<div class="screen"><div class="card"><h3 class="h3">종합 분석 리포트</h3><p class="muted">2024.05.11 생성</p><ul class="clean"><li>학습 평가: 수학에서 점수 상승 여지가 큽니다.</li><li>목표 대학 거리: 연세대학교 경영학과 -12점</li><li>중기 전략: 탐구 1개 과목 집중 강화</li><li>장기 전략: 6월 모평 전 수학 개념 완성</li></ul></div>'
      + '<div class="card"><h3 class="h3">과목별 성과</h3><div class="bars"><div class="bar">수학<div class="bar-track"><i style="width:68%"></i></div></div><div class="bar">국어<div class="bar-track"><i style="width:82%"></i></div></div><div class="bar">영어<div class="bar-track"><i style="width:77%"></i></div></div><div class="bar">탐구1<div class="bar-track"><i style="width:70%"></i></div></div><div class="bar">탐구2<div class="bar-track"><i style="width:66%"></i></div></div></div></div><button class="btn">PDF 다운로드</button></div>'
    ),
    frame('10. 분석',
      '<div class="screen"><div class="card"><span class="chip">연세대학교 경영학과</span><p class="metric" style="margin-top:8px;">68%</p><div class="row"><div class="kpi">현재 점수<br/><b>323점</b></div><div class="kpi">합격 컷<br/><b>335점</b></div><div class="kpi" style="color:var(--danger)">부족<br/><b>-12점</b></div></div></div>'
      + '<div class="card"><h3 class="h3">과목별 영향도</h3><ul class="clean"><li>수학 +10점 → +15%</li><li>탐구 +6점 → +9%</li><li>국어 +4점 → +6%</li><li>영어 +1등급 → +5%</li></ul></div>'
      + tabTemplate('분석') + '</div>'
    ),
    frame('11. 전략',
      '<div class="screen"><div class="card"><h3 class="h3">합격을 위한 최적 전략</h3><ul class="clean"><li>수학 2등급 → 1등급</li><li>탐구 1과목 집중</li><li>영어 유지</li></ul></div>'
      + '<div class="card"><h3 class="h3">과목별 효율 (ROI)</h3><div class="bars"><div class="bar">수학<div class="bar-track"><i style="width:90%"></i></div></div><div class="bar">탐구<div class="bar-track"><i style="width:72%;background:#0ea5a2"></i></div></div><div class="bar">국어<div class="bar-track"><i style="width:55%;background:#f59e0b"></i></div></div><div class="bar">영어<div class="bar-track"><i style="width:32%;background:#ef4444"></i></div></div></div><p class="muted">목표 도달 예상 시점: 6월 18일</p></div><button class="btn">플래너로 실행하기</button>'
      + tabTemplate('전략') + '</div>'
    ),
    frame('12. SKY튜터 1:1 피드백',
      '<div class="screen"><div class="card center"><h3 class="h3">Sky튜터 1:1 피드백</h3><p class="muted">텍스트 기반 질의응답</p></div>'
      + '<div class="card" style="background:linear-gradient(145deg,#3f7fff,#2a64d9);color:#fff"><p style="margin:0;font-weight:600">내 질문 리스트</p><p style="margin-bottom:0;font-size:12px">궁금한 내용을 등록하면 Sky튜터가 24시간 내 답변!</p></div>'
      + '<div class="card"><h3 class="h3">질문 예시</h3><ul class="clean"><li>수학 개념 이해가 잘 안 돼요</li><li>탐구 문제 풀이 방법이 궁금해요</li><li>시간 관리 방법이 궁금해요</li></ul><button class="btn">새 질문 작성</button></div>'
      + '<div class="card"><h3 class="h3">내 질문 내역</h3><ul class="clean"><li>수학 함수 문제 질문 · 답변 완료 05.12</li><li>탐구 개념 질문 · 답변 완료 05.10</li></ul></div></div>'
    ),
    frame('13. 프로 플랜 안내',
      '<div class="screen"><div class="card center"><h3 class="h3" style="color:var(--blue)">PRO PLAN</h3><p style="margin-top:0;font-weight:700">모든 기능을 무제한으로!</p></div>'
      + '<div class="card"><ul class="clean"><li>합격 가능성 & 전략 무제한 이용</li><li>플래너 & 주간 점검 무제한</li><li>Sky튜터 1:1 피드백 무제한</li><li>프로 보고서 2주에 1번 제공</li><li>리포트 PDF 다운로드</li></ul></div>'
      + '<div class="card center"><p class="muted">광고 없이 쾌적하게 이용</p></div><button class="btn">프로 플랜 시작하기</button></div>'
    ),
    frame('14. 결제 선택',
      '<div class="screen"><div class="card"><h3 class="h3">플랜 선택</h3><div class="row"><button class="btn secondary">Standard</button><button class="btn">Pro</button></div></div>'
      + '<div class="card" style="border:1px solid #bcd2ff"><h3 class="h3">Standard</h3><p style="font-weight:700;margin:0">월 149,000원</p><p class="muted">전략 + 플래너 + 주간 점검</p></div>'
      + '<div class="card" style="border:2px solid var(--blue)"><h3 class="h3">Pro</h3><p style="font-weight:700;margin:0">월 299,000원</p><p class="muted">모든 기능 + 프로 보고서(2주 1회 포함)</p><ul class="clean"><li>전 과목 전략 무제한</li><li>Sky튜터 1:1 피드백</li><li>프로 보고서 2주 1회</li></ul></div><button class="btn">결제하기</button></div>'
    ),
    frame('15. 결제 완료',
      '<div class="screen" style="display:grid;align-content:center;min-height:680px"><div class="card center"><div style="width:92px;height:92px;border-radius:50%;background:var(--blue);color:#fff;margin:0 auto 12px;display:grid;place-items:center;font-size:50px">✓</div><h3 class="h3">결제가 완료되었습니다!</h3><p class="muted">PRO 플랜이 활성화되었습니다.</p></div>'
      + '<div class="card"><p class="sub">프로 보고서 이용 안내</p><p class="muted">2주에 한 번 새로운 리포트를 제공합니다. 다음 리포트는 5월 25일 이용 가능합니다.</p></div><button class="btn">홈으로 이동</button></div>'
    ),
    frame('16. 마이페이지',
      '<div class="screen"><div class="card"><h3 class="h3">김지민</h3><p class="muted">수험번호 2025-123456</p><p class="chip">Pro 플랜 이용 중 · 다음 리포트 2024.06.14</p></div>'
      + '<div class="card"><h3 class="h3">내 정보</h3><ul class="clean"><li>성적 정보</li><li>목표 대학: 연세대학교 경영학과</li><li>학습 리포트</li><li>구독 관리</li></ul></div>'
      + '<div class="card"><h3 class="h3">서비스</h3><ul class="clean"><li>알림 설정</li><li>고객센터</li><li>설정</li></ul></div>'
      + tabTemplate('마이') + '</div>'
    )
  ];

  var appHtml = '<main class="app"><div class="grid">' + screens.join('') + '</div></main>';

  try {
    root.innerHTML = appHtml;
  } catch (error) {
    root.innerHTML = '<div style="padding:20px;font-family:Pretendard,sans-serif;color:#b91c1c;">'
      + '<h2 style="margin:0 0 8px;">StudyCrack UI 렌더링 오류</h2>'
      + '<p style="margin:0;white-space:pre-wrap;line-height:1.5;">' + String(error) + '</p></div>';
  }
})();
