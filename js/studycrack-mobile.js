const { useMemo, useState } = React;

const screenOptions = [
  '1. 스플래시', '2. 온보딩 1', '3. 온보딩 2', '4. 온보딩 3', '5. 성적 입력',
  '6. 목표 대학 설정', '7. 홈', '8. 분석', '9. 전략', '10. 플래너', '11. 주간 점검',
  '12. SKY 튜터 피드백', '13. 프로 보고서', '14. 프로 보고서 상세', '15. 요금제/결제',
  '16. 결제 완료', '17. 마이페이지'
];

function Card({ children }) { return <div className="card">{children}</div>; }

function BottomTab({ active }) {
  const tabs = ['홈', '분석', '전략', '플래너', '마이'];
  return <nav className="bottom-tab">{tabs.map(tab => <button key={tab} className={active === tab ? 'active' : ''}>{tab}</button>)}</nav>;
}

function ScreenRenderer({ idx }) {
  switch (idx) {
    case 0: return <div className="center-screen screen"><div className="logo-box">⚡</div><h1 className="title">스터디크랙</h1><p className="subtitle">합격까지 가장 빠른 전략</p></div>;
    case 1: return <div className="screen"><Card><h3 className="section-title">데이터 기반으로 합격 가능성 분석</h3><p className="small">현재 성적과 입결 데이터를 비교해 내 위치를 즉시 확인합니다.</p><p className="metric">72%</p></Card><div className="cta-box"><button className="btn">다음</button></div></div>;
    case 2: return <div className="screen"><Card><h3 className="section-title">점수 상승 전략을 역산으로 제공합니다</h3><ul className="list"><li><b>수학 +12점</b> → 합격 가능성 <b>+18%</b></li><li><b>탐구 +1등급</b> → 합격 가능성 <b>+9%</b></li></ul></Card><div className="cta-box"><button className="btn">다음</button></div></div>;
    case 3: return <div className="screen"><Card><h3 className="section-title">실행부터 관리까지 함께합니다</h3><ul className="list"><li>플래너</li><li>주간 점검</li><li>SKY 튜터 피드백</li><li>프로 보고서 (2주 1회)</li></ul></Card><div className="cta-box"><button className="btn">시작하기</button></div></div>;
    case 4: return <div className="screen"><h3 className="section-title">성적 입력</h3><div className="inputs"><input placeholder="국어 점수"/><input placeholder="수학 점수"/><input placeholder="영어 등급"/><input placeholder="탐구 평균"/></div><div className="cta-box"><button className="btn">저장하고 분석하기</button></div></div>;
    case 5: return <div className="screen"><h3 className="section-title">목표 대학 설정</h3><Card><input style={{width:'100%',padding:'11px',borderRadius:'12px',border:'1px solid #dbe4ff'}} placeholder="대학 검색" /><div style={{marginTop:10,display:'flex',gap:8,flexWrap:'wrap'}}><span className="badge">연세대</span><span className="badge">성균관대</span><span className="badge">한양대</span></div><p className="small" style={{marginTop:10}}>무료 플랜은 최대 2개 선택 가능합니다.</p></Card><div className="cta-box"><button className="btn">완료</button></div></div>;
    case 6: return <div className="screen"><p className="small">내 합격 가능성</p><p className="metric">68%</p><Card><div className="row"><div><p className="small">현재 점수</p><b>323점</b></div><div><p className="small">합격 컷</p><b>335점</b></div><div><p className="small">부족</p><b className="highlight">-12점</b></div></div></Card><div className="notice">수학이 합격 가능성을 제한하고 있습니다. 우선 개선이 필요합니다.</div><Card><div className="row"><button className="btn ghost">분석</button><button className="btn ghost">전략</button><button className="btn ghost">플래너</button></div></Card><Card><h4 style={{margin:'0 0 8px'}}>학습 트래킹</h4><ul className="list"><li>주간 공부 시간: 36시간 30분</li><li>평균 대비 위치: 상위 32%</li><li>랭킹: 128 / 1,530 (선택)</li></ul></Card><BottomTab active="홈"/></div>;
    case 7: return <div className="screen"><h3 className="section-title">합격 가능성 분석</h3><Card><p className="metric" style={{fontSize:42}}>68%</p><p className="small">현재 점수 323점 vs 컷 335점 · <span className="highlight">-12점</span></p></Card><Card><h4 style={{margin:'0 0 8px'}}>과목별 영향도</h4><ul className="list"><li>수학 +10점 → <span className="ok">+15%</span></li><li>탐구 +1등급 → <span className="ok">+9%</span></li><li>영어 +1등급 → <span className="ok">+6%</span></li></ul></Card><BottomTab active="분석"/></div>;
    case 8: return <div className="screen"><h3 className="section-title">합격을 위한 최적 전략</h3><Card><ol style={{paddingLeft:18,margin:'0',display:'grid',gap:8}}><li>수학 2등급 → 1등급</li><li>탐구 과목 집중 투자</li><li>영어 유지 전략</li></ol></Card><Card><h4 style={{margin:'0 0 8px'}}>과목별 ROI</h4><ul className="list"><li>수학<div className="bar"><i style={{width:'88%'}}/></div></li><li>탐구<div className="bar"><i style={{width:'76%', background:'#15b8b3'}}/></div></li><li>국어<div className="bar"><i style={{width:'52%', background:'#f59e0b'}}/></div></li></ul><p className="small">목표 도달 예상: <b>6월 18일</b></p></Card><div className="cta-box"><button className="btn">이 전략으로 공부 시작하기</button></div><BottomTab active="전략"/></div>;
    case 9: return <div className="screen"><h3 className="section-title">플래너</h3><Card><h4 style={{margin:'0 0 8px'}}>오늘 할 일</h4><ul className="list"><li>수학 개념 복습 (120분)</li><li>영어 EBS 지문 분석 (90분)</li><li>탐구 기출 2세트 (120분)</li></ul></Card><Card><h4 style={{margin:'0 0 8px'}}>공부 타이머</h4><p className="metric" style={{fontSize:36}}>01:25:30</p><button className="btn ghost">타이머 시작</button></Card><Card><h4 style={{margin:'0 0 8px'}}>주간 요약</h4><div className="progress"><span style={{width:'82%'}}/></div><p className="small">목표 대비 수행률 82%</p></Card><BottomTab active="플래너"/></div>;
    case 10: return <div className="screen"><h3 className="section-title">주간 점검</h3><Card><p className="small">이번 주 수행률</p><p className="metric" style={{fontSize:42}}>82%</p></Card><Card><h4 style={{margin:'0 0 8px'}}>튜터 피드백</h4><p className="small">수학 시간 부족 → 개념 비중을 늘려야 함. 탐구는 유지하되 주말 복습을 추가하세요.</p></Card><div className="cta-box"><button className="btn">다음 주 계획 세우기</button></div></div>;
    case 11: return <div className="screen"><h3 className="section-title">SKY 튜터 1:1 피드백</h3><Card><p><b>Q.</b> 수학 개념을 해도 점수가 정체돼요.</p><p className="small"><b>A.</b> 오답 유형별로 개념-문제 비율을 6:4로 조정하고, 주 2회 누적복습을 넣어보세요.</p></Card><Card><h4 style={{margin:'0 0 8px'}}>질문 작성</h4><input style={{width:'100%',padding:'11px',borderRadius:'12px',border:'1px solid #dbe4ff'}} placeholder="궁금한 점을 입력하세요"/><div style={{marginTop:8}}><button className="btn">질문 보내기</button></div></Card><BottomTab active="플래너"/></div>;
    case 12: return <div className="screen"><h3 className="section-title">프로 보고서</h3><Card><span className="badge">Pro 플랜 포함</span><p style={{marginBottom:4}}><b>다음 보고서 가능일</b></p><p className="metric" style={{fontSize:40}}>D-11</p><p className="small">2주에 1회 제공 (별도 상품 아님)</p></Card><Card><h4 style={{margin:'0 0 8px'}}>이전 보고서</h4><ul className="list"><li>5월 11일 · 종합 분석 리포트</li><li>4월 27일 · 중간 분석 리포트</li></ul></Card></div>;
    case 13: return <div className="screen"><h3 className="section-title">프로 보고서 상세</h3><Card><ul className="list"><li>학습 평가: 수학·탐구 상승세, 국어 정체</li><li>목표 대학과의 거리: 12점</li><li>중기 전략: 수학 실전 2회/주</li><li>장기 전략: 6월 모평 전 과탐 완성</li></ul></Card><div className="cta-box"><button className="btn ghost">PDF 다운로드</button></div></div>;
    case 14: return <div className="screen"><h3 className="section-title">요금제 / 결제</h3><Card><p><b>Basic</b> · 25,000원 / 4주</p><p><b>Standard</b> · 149,000원 / 4주</p><p style={{padding:10,border:'1px solid #c8d8ff',borderRadius:12, background:'#f4f8ff'}}><b>Pro</b> · 299,000원 / 4주<br/><span className="small">모든 기능 + 프로 보고서(2주 1회) 포함</span></p></Card><div className="cta-box"><button className="btn">결제하기</button></div></div>;
    case 15: return <div className="center-screen screen"><div className="logo-box" style={{fontSize:42}}>✓</div><h2 className="title" style={{fontSize:28}}>결제가 완료되었습니다</h2><p className="subtitle">프로 플랜이 활성화되었습니다.</p><div style={{width:'100%',maxWidth:260,marginTop:18}}><button className="btn">홈으로 이동</button></div></div>;
    default: return <div className="screen"><h3 className="section-title">마이페이지</h3><Card><ul className="list"><li>성적 정보: 국88 / 수84 / 영2 / 탐78</li><li>목표 대학: 연세대, 성균관대</li><li>이용 플랜: Standard</li><li>리포트 내역: 2건</li></ul></Card><BottomTab active="마이"/></div>;
  }
}

function App() {
  const [idx, setIdx] = useState(6);
  const selected = useMemo(() => screenOptions[idx], [idx]);

  return (
    <div className="app-shell">
      <div className="top-controls">
        <label>화면 선택 (결과 → 전략 → 실행 → 관리 흐름 포함)</label>
        <select value={idx} onChange={(e) => setIdx(Number(e.target.value))}>
          {screenOptions.map((name, i) => <option key={name} value={i}>{name}</option>)}
        </select>
        <p className="small" style={{margin:'8px 2px 0'}}>현재 화면: <b>{selected}</b></p>
      </div>
      <main className="phone">
        <ScreenRenderer idx={idx} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
