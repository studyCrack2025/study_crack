function formatCurrent([label, value, unit]) {
  const max = unit === '등급' ? 9 : ['국어', '수학'].includes(label) ? 100 : 50;
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return '미확인';
  const number = Number(value);
  return Number.isFinite(number) && number >= (unit === '등급' ? 1 : 0) && number <= max
    ? `${number}${unit}` : '미확인';
}

export function ScoreJourneyCard({
  activeScoreView = 'target', analysisPresentation = {}, canUseReverseProjection = false,
  scoreDragOffset = 0, scoreSlideMotion = '', title = '최소 노력 대비 합격 도달 성적'
}) {
  if (!canUseReverseProjection) {
    return <div className="score-journey-card score-journey-card-empty"><p className="analysis-title">{title}</p><div className="score-journey-empty-panel"><b>최소 노력 대비 도달 성적과 역산 전략은 Standard 이상 플랜에서 확인할 수 있어요.</b><button type="button" className="btn btn-primary mini" data-action="goto" data-target="proIntro">플랜 보기</button></div></div>;
  }
  const { ready = false, score = null, currentScores = [] } = analysisPresentation;
  const confirmed = ready && typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 250;
  const slideX = activeScoreView === 'target' ? '-50%' : '0%';
  const transition = Number(scoreDragOffset) !== 0 ? '0s' : 'transform .56s cubic-bezier(.22,.61,.36,1)';
  return <div className="score-journey-card"><p className="analysis-title">{title}</p><div className="score-journey-segment"><button type="button" className={activeScoreView === 'current' ? 'active' : ''} data-action="setScoreView" data-score-view="current">현재 성적</button><button type="button" className={activeScoreView === 'target' ? 'active' : ''} data-action="setScoreView" data-score-view="target">도달 성적</button></div><div className="score-journey-scroll"><div className={`score-journey-track anchor-volatile ${scoreSlideMotion}`} style={{ '--score-slide-x': `calc(${slideX} + ${Number(scoreDragOffset) || 0}px)`, '--score-slide-transition': transition }}>
    <div className="score-journey-col current" data-score-view="current"><h4>현재 성적</h4>{currentScores.length ? currentScores.map((row, index) => <div className="score-row" key={index}><span>{row[0]}</span><b>{formatCurrent(row)}</b></div>) : <p>선택한 시험의 성적 미확인</p>}<div className="score-journey-total"><span>환산 점수</span><b>{confirmed ? `${score}점` : '미확인'}</b></div></div>
    <div className="score-journey-col target" data-score-view="target"><div className="score-target-panel"><h4>도달 성적</h4><div className="score-journey-empty-panel"><b>목표 성적 미확인</b><p>이 시험과 목표 대학의 역산 결과는 분석 화면에서 확인해주세요.</p><button type="button" className="btn btn-secondary mini" data-action="goto" data-target="analysis">역산 결과 확인하기</button></div></div></div>
  </div></div></div>;
}
