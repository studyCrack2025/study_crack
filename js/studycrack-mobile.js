const tabTemplate = (active) => (
  <div className="tabbar">
    <div className={active === '홈' ? 'active' : ''}><span>🏠</span>홈</div>
    <div className={active === '분석' ? 'active' : ''}><span>📊</span>분석</div>
    <div className={active === '전략' ? 'active' : ''}><span>🎯</span>전략</div>
    <div className={active === '플래너' ? 'active' : ''}><span>🗓️</span>플래너</div>
    <div className={active === '마이' ? 'active' : ''}><span>👤</span>마이</div>
  </div>
);

const screens = [
  {
    title: '1. 스플래시',
    render: () => (
      <div className="hero-blue">
        <div className="logo">⚡</div>
        <h2 style={{ margin: 0, fontSize: 34 }}>스터디크랙</h2>
        <p style={{ marginTop: 6, opacity: 0.9 }}>STUDY CRACK</p>
        <p style={{ marginTop: 18, fontWeight: 700 }}>합격까지 가장 빠른 전략</p>
      </div>
    )
  },
  {
    title: '2. 온보딩 1',
    render: () => (
      <div className="screen">
        <div className="card center"><h3 className="h3">데이터 기반으로<br/>합격 가능성 분석</h3><p className="muted">흔들리지 않는 방향을 제시합니다.</p></div>
        <div className="card"><p className="sub">합격 가능성</p><p className="metric">72%</p><div className="progress"><span style={{ width: '72%' }}/></div></div>
        <button className="btn">다음</button>
      </div>
    )
  },
  {
    title: '3. 온보딩 2',
    render: () => (
      <div className="screen">
        <div className="card center"><h3 className="h3">점수 상승 전략을<br/>역산으로 제공합니다</h3><p className="muted">과목별 효과와 목표 도달 시간을 계산합니다.</p></div>
        <div className="card"><ul className="clean"><li>수학 +12점 → 합격 가능성 +18%</li><li>탐구 +1등급 → 합격 가능성 +9%</li></ul></div>
        <button className="btn">다음</button>
      </div>
    )
  },
  {
    title: '4. 온보딩 3',
    render: () => (
      <div className="screen">
        <div className="card center"><h3 className="h3">실행부터 관리까지<br/>끝까지 함께해요</h3></div>
        <div className="icon-menu">
          <div className="icon-item">🗓️<br/>플래너</div>
          <div className="icon-item">✅<br/>주간 점검</div>
          <div className="icon-item">🧑‍🏫<br/>SKY 튜터</div>
          <div className="icon-item">📄<br/>프로 보고서</div>
          <div className="icon-item">📈<br/>전략 리포트</div>
          <div className="icon-item">🎯<br/>합격 분석</div>
        </div>
        <div style={{ marginTop: 12 }}><button className="btn">시작하기</button></div>
      </div>
    )
  },
  {
    title: '5. 홈 대시보드',
    render: () => (
      <div className="screen">
        <div className="card"><p className="sub">내 합격 가능성</p><div className="row"><div><p className="metric">68%</p><p className="muted">상위 32%</p></div><div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><div className="ring"/></div></div><div className="row"><div className="kpi">현재<br/><b>323</b></div><div className="kpi">컷<br/><b>335</b></div><div className="kpi" style={{ color: 'var(--danger)' }}>격차<br/><b>-12</b></div></div></div></div>
        <div className="notice">수학이 합격 가능성을 제한하고 있습니다. 전략 탭에서 우선 과목을 확인하세요.</div>
        <div className="card"><div className="row"><button className="btn secondary">분석</button><button className="btn secondary">전략</button><button className="btn secondary">플래너</button></div></div>
        <div className="card"><h3 className="h3">학습 트래킹</h3><ul className="clean"><li>주간 공부 시간 36시간 30분</li><li>평균 대비 위치 상위 32%</li><li>선택 랭킹 128 / 1,530</li></ul></div>
        {tabTemplate('홈')}
      </div>
    )
  },
  {
    title: '6. 플래너',
    render: () => (
      <div className="screen">
        <div className="card"><h3 className="h3">2024년 5월 14일 (화)</h3><p className="muted">오늘 공부 시간 6시간 30분</p><ul className="clean"><li>수학 개념 학습 10:00-12:00</li><li>영어 독해 문제 풀이 13:00-14:30</li><li>탐구 실전문제 15:00-17:00</li><li>수학 오답 정리 19:00-22:00</li></ul></div>
        <div className="card center"><p className="sub">공부 타이머 시작</p><p className="metric" style={{ fontSize: 36 }}>01:25:30</p></div>
        {tabTemplate('플래너')}
      </div>
    )
  },
  {
    title: '7. 주간 점검',
    render: () => (
      <div className="screen">
        <div className="card center"><h3 className="h3">주간 점검</h3><p className="muted">이번 주 점검 (5.6 ~ 5.12)</p><p className="metric" style={{ fontSize: 42 }}>82%</p><p className="chip">목표 90%</p></div>
        <div className="card"><h3 className="h3">주간 요약 피드백</h3><ul className="clean"><li>수학 절대 시간이 부족해요. 개념 비중을 늘려보세요.</li><li>탐구는 문제 풀이 시간이 좋아요! 유지하면 좋아요.</li><li>영어는 꾸준히 잘하고 있어요. 계속 유지하세요.</li></ul></div>
        <button className="btn">다음 주 계획 세우기</button>
      </div>
    )
  },
  {
    title: '8. 프로 보고서',
    render: () => (
      <div className="screen">
        <div className="card"><span className="chip">프로 플랜 전용</span><p className="muted">2주에 한 번, 내 맞춤 분석 리포트 제공</p><div className="card" style={{ marginBottom: 0 }}><p className="sub">다음 보고서 이용 가능일</p><p className="metric" style={{ fontSize: 40 }}>D-11</p><p className="muted">5월 25일 (토)</p></div></div>
        <div className="card"><h3 className="h3">이전 보고서</h3><ul className="clean"><li>5월 11일 · 종합 분석 리포트</li><li>4월 27일 · 중간 분석 리포트</li></ul></div>
        <button className="btn">프로 보고서 샘플 보기</button>
        {tabTemplate('마이')}
      </div>
    )
  },
  {
    title: '9. 프로 보고서 상세',
    render: () => (
      <div className="screen">
        <div className="card"><h3 className="h3">종합 분석 리포트</h3><p className="muted">2024.05.11 생성</p><ul className="clean"><li>학습 평가: 수학에서 점수 상승 여지가 큽니다.</li><li>목표 대학 거리: 연세대학교 경영학과 -12점</li><li>중기 전략: 탐구 1개 과목 집중 강화</li><li>장기 전략: 6월 모평 전 수학 개념 완성</li></ul></div>
        <div className="card"><h3 className="h3">과목별 성과</h3><div className="bars"><div className="bar">수학<div className="bar-track"><i style={{ width: '68%' }}/></div></div><div className="bar">국어<div className="bar-track"><i style={{ width: '82%' }}/></div></div><div className="bar">영어<div className="bar-track"><i style={{ width: '77%' }}/></div></div><div className="bar">탐구1<div className="bar-track"><i style={{ width: '70%' }}/></div></div><div className="bar">탐구2<div className="bar-track"><i style={{ width: '66%' }}/></div></div></div></div>
        <button className="btn">PDF 다운로드</button>
      </div>
    )
  },
  {
    title: '10. 분석',
    render: () => (
      <div className="screen">
        <div className="card"><span className="chip">연세대학교 경영학과</span><p className="metric" style={{ marginTop: 8 }}>68%</p><div className="row"><div className="kpi">현재 점수<br/><b>323점</b></div><div className="kpi">합격 컷<br/><b>335점</b></div><div className="kpi" style={{ color: 'var(--danger)' }}>부족<br/><b>-12점</b></div></div></div>
        <div className="card"><h3 className="h3">과목별 영향도</h3><ul className="clean"><li>수학 +10점 → +15%</li><li>탐구 +6점 → +9%</li><li>국어 +4점 → +6%</li><li>영어 +1등급 → +5%</li></ul></div>
        {tabTemplate('분석')}
      </div>
    )
  },
  {
    title: '11. 전략',
    render: () => (
      <div className="screen">
        <div className="card"><h3 className="h3">합격을 위한 최적 전략</h3><ul className="clean"><li>수학 2등급 → 1등급</li><li>탐구 1과목 집중</li><li>영어 유지</li></ul></div>
        <div className="card"><h3 className="h3">과목별 효율 (ROI)</h3><div className="bars"><div className="bar">수학<div className="bar-track"><i style={{ width: '90%' }}/></div></div><div className="bar">탐구<div className="bar-track"><i style={{ width: '72%', background: '#0ea5a2' }}/></div></div><div className="bar">국어<div className="bar-track"><i style={{ width: '55%', background: '#f59e0b' }}/></div></div><div className="bar">영어<div className="bar-track"><i style={{ width: '32%', background: '#ef4444' }}/></div></div></div><p className="muted">목표 도달 예상 시점: 6월 18일</p></div>
        <button className="btn">플래너로 실행하기</button>
        {tabTemplate('전략')}
      </div>
    )
  },
  {
    title: '12. SKY튜터 1:1 피드백',
    render: () => (
      <div className="screen">
        <div className="card center"><h3 className="h3">Sky튜터 1:1 피드백</h3><p className="muted">텍스트 기반 질의응답</p></div>
        <div className="card" style={{ background: 'linear-gradient(145deg,#3f7fff,#2a64d9)', color: '#fff' }}><p style={{ margin: 0, fontWeight: 600 }}>내 질문 리스트</p><p style={{ marginBottom: 0, fontSize: 12 }}>궁금한 내용을 등록하면 Sky튜터가 24시간 내 답변!</p></div>
        <div className="card"><h3 className="h3">질문 예시</h3><ul className="clean"><li>수학 개념 이해가 잘 안 돼요</li><li>탐구 문제 풀이 방법이 궁금해요</li><li>시간 관리 방법이 궁금해요</li></ul><button className="btn">새 질문 작성</button></div>
        <div className="card"><h3 className="h3">내 질문 내역</h3><ul className="clean"><li>수학 함수 문제 질문 · 답변 완료 05.12</li><li>탐구 개념 질문 · 답변 완료 05.10</li></ul></div>
      </div>
    )
  },
  {
    title: '13. 프로 플랜 안내',
    render: () => (
      <div className="screen">
        <div className="card center"><h3 className="h3" style={{ color: 'var(--blue)' }}>PRO PLAN</h3><p style={{ marginTop: 0, fontWeight: 700 }}>모든 기능을 무제한으로!</p></div>
        <div className="card"><ul className="clean"><li>합격 가능성 & 전략 무제한 이용</li><li>플래너 & 주간 점검 무제한</li><li>Sky튜터 1:1 피드백 무제한</li><li>프로 보고서 2주에 1번 제공</li><li>리포트 PDF 다운로드</li></ul></div>
        <div className="card center"><p className="muted">광고 없이 쾌적하게 이용</p></div>
        <button className="btn">프로 플랜 시작하기</button>
      </div>
    )
  },
  {
    title: '14. 결제 선택',
    render: () => (
      <div className="screen">
        <div className="card"><h3 className="h3">플랜 선택</h3><div className="row"><button className="btn secondary">Standard</button><button className="btn">Pro</button></div></div>
        <div className="card" style={{ border: '1px solid #bcd2ff' }}><h3 className="h3">Standard</h3><p style={{ fontWeight: 700, margin: 0 }}>월 149,000원</p><p className="muted">전략 + 플래너 + 주간 점검</p></div>
        <div className="card" style={{ border: '2px solid var(--blue)' }}><h3 className="h3">Pro</h3><p style={{ fontWeight: 700, margin: 0 }}>월 299,000원</p><p className="muted">모든 기능 + 프로 보고서(2주 1회 포함)</p><ul className="clean"><li>전 과목 전략 무제한</li><li>Sky튜터 1:1 피드백</li><li>프로 보고서 2주 1회</li></ul></div>
        <button className="btn">결제하기</button>
      </div>
    )
  },
  {
    title: '15. 결제 완료',
    render: () => (
      <div className="screen" style={{ display: 'grid', alignContent: 'center', minHeight: 680 }}>
        <div className="card center"><div style={{ width: 92, height: 92, borderRadius: '50%', background: 'var(--blue)', color: '#fff', margin: '0 auto 12px', display: 'grid', placeItems: 'center', fontSize: 50 }}>✓</div><h3 className="h3">결제가 완료되었습니다!</h3><p className="muted">PRO 플랜이 활성화되었습니다.</p></div>
        <div className="card"><p className="sub">프로 보고서 이용 안내</p><p className="muted">2주에 한 번 새로운 리포트를 제공합니다. 다음 리포트는 5월 25일 이용 가능합니다.</p></div>
        <button className="btn">홈으로 이동</button>
      </div>
    )
  },
  {
    title: '16. 마이페이지',
    render: () => (
      <div className="screen">
        <div className="card"><h3 className="h3">김지민</h3><p className="muted">수험번호 2025-123456</p><p className="chip">Pro 플랜 이용 중 · 다음 리포트 2024.06.14</p></div>
        <div className="card"><h3 className="h3">내 정보</h3><ul className="clean"><li>성적 정보</li><li>목표 대학: 연세대학교 경영학과</li><li>학습 리포트</li><li>구독 관리</li></ul></div>
        <div className="card"><h3 className="h3">서비스</h3><ul className="clean"><li>알림 설정</li><li>고객센터</li><li>설정</li></ul></div>
        {tabTemplate('마이')}
      </div>
    )
  }
];

function App() {
  return (
    <main className="app">
      <div className="grid">
        {screens.map((screen) => (
          <section className="frame-wrap" key={screen.title}>
            <div className="frame-title">{screen.title}</div>
            <article className="phone">{screen.render()}</article>
          </section>
        ))}
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
