function toEnglishGrade(value) {
  return Math.min(9, Math.max(1, Math.round((100 - Number(value || 0)) / 12.5) + 1));
}

function formatScoreValue(label, value) {
  const score = Number(value || 0);
  if (!score) return '-';
  return label === '영어' ? `${toEnglishGrade(score)}등급` : `${score}`;
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function createSubjectResolver(scoreState = {}) {
  const inquiryAssignments = new Set();
  return (subject = '') => {
    const normalized = normalizeText(subject);
    const inquiry1 = normalizeText(scoreState.inquiry1?.subject);
    const inquiry2 = normalizeText(scoreState.inquiry2?.subject);
    if (normalized.includes('국어') || normalized === 'kor') return 'korean';
    if (normalized.includes('수학') || normalized === 'math') return 'math';
    if (normalized.includes('영어') || normalized === 'eng') return 'english';
    if (normalized.includes('탐구1') || (inquiry1 && normalized.includes(inquiry1))) return 'inquiry1';
    if (normalized.includes('탐구2') || (inquiry2 && normalized.includes(inquiry2))) return 'inquiry2';
    if (!inquiryAssignments.has('inquiry1')) {
      inquiryAssignments.add('inquiry1');
      return 'inquiry1';
    }
    if (!inquiryAssignments.has('inquiry2')) {
      inquiryAssignments.add('inquiry2');
      return 'inquiry2';
    }
    return '';
  };
}

function buildSimulationTarget({ analysisSelected, analysisSimRows, analysisTargetScore, current, scoreState }) {
  const target = { ...current };
  const currentConvertedScore = Math.round(Number(analysisSelected?.score) || 0);
  const targetConvertedScore = Math.max(currentConvertedScore, Math.round(Number(analysisTargetScore) || currentConvertedScore));
  let remainingGain = Math.max(0, targetConvertedScore - currentConvertedScore);
  const resolveSubject = createSubjectResolver(scoreState);
  const rows = [...analysisSimRows]
    .map((row) => ({ ...row, key: resolveSubject(row.subject), gainNum: Number(row.gainNum || 0) }))
    .filter((row) => row.key && row.gainNum > 0 && Number(current[row.key] || 0) > 0)
    .sort((a, b) => b.gainNum - a.gainNum)
    .slice(0, 2);

  rows.forEach((row) => {
    if (remainingGain <= 0) return;
    const minimumRawGain = row.key === 'english' ? 1 : 2;
    const maximumRawGain = Math.max(0, 100 - Number(target[row.key] || 0));
    const neededRawGain = Math.max(minimumRawGain, Math.ceil(remainingGain / Math.max(row.gainNum, 1)));
    const rawGain = Math.min(maximumRawGain, neededRawGain);
    target[row.key] = Math.min(100, Number(target[row.key] || 0) + rawGain);
    remainingGain = Math.max(0, remainingGain - rawGain * row.gainNum);
  });
  return target;
}

function EmptyCard({ children, title }) {
  return <div className="score-journey-card score-journey-card-empty"><p className="analysis-title">{title}</p><div className="score-journey-empty-panel"><b>{children}</b></div></div>;
}

function CurrentRow({ current, label }) {
  return <div className="score-row"><span>{label}</span><b>{formatScoreValue(label, current)}</b></div>;
}

function TargetRow({ current, label, target }) {
  const diff = target - current;
  return <div className="score-row"><span>{label}</span><b><span className={`pill ${diff > 0 ? 'up' : 'keep'}`}>{diff > 0 ? `+${diff}` : '유지'}</span></b><em>{diff > 0 ? <><span className="old">{formatScoreValue(label, current)}</span><span className="arrow">→</span><span className="new">{formatScoreValue(label, target)}</span></> : formatScoreValue(label, current)}</em></div>;
}

export function ScoreJourneyCard(ctx) {
  const {
    activeScoreView = 'target',
    analysisApiStatus = 'idle',
    analysisSelected = {},
    analysisSimRows = [],
    analysisTargetScore = 0,
    canUseReverseProjection = false,
    scoreDragOffset = 0,
    scoreSlideMotion = '',
    scoreState = {},
    scores = {},
    title = '최소 노력 대비 합격 도달 성적'
  } = ctx;
  if (!canUseReverseProjection) {
    return <div className="score-journey-card score-journey-card-empty"><p className="analysis-title">{title}</p><div className="score-journey-empty-panel"><b>최소 노력 대비 도달 성적과 역산 전략은 Standard 이상 플랜에서 확인할 수 있어요.</b><button type="button" className="btn btn-primary mini" data-action="goto" data-target="proIntro">플랜 보기</button></div></div>;
  }

  const current = {
    korean: Number(scores.korean || 0),
    math: Number(scores.math || 0),
    english: Number(scores.english || 0),
    inquiry1: Number(scores.inquiry1 || 0),
    inquiry2: Number(scores.inquiry2 || 0)
  };
  if (!Object.values(current).some((value) => value > 0)) return <EmptyCard title={title}>선택한 시험의 저장된 성적이 없어 도달 성적을 계산할 수 없어요.</EmptyCard>;
  if (!analysisSimRows.length) return <EmptyCard title={title}>{analysisApiStatus === 'loading' ? '도달 성적을 계산하는 중입니다.' : '시뮬레이션 결과를 불러오면 도달 성적이 표시돼요.'}</EmptyCard>;

  const target = buildSimulationTarget({ current, analysisSelected, analysisTargetScore, analysisSimRows, scoreState });
  const currentAverage = Math.round(Number(analysisSelected?.score) || Object.values(current).reduce((sum, value) => sum + value, 0) / 5);
  const targetAverage = Math.round(Number(analysisTargetScore) || Object.values(target).reduce((sum, value) => sum + value, 0) / 5);
  const rows = [['국어', 'korean'], ['수학', 'math'], ['영어', 'english'], [scoreState.inquiry1?.subject || '탐구1', 'inquiry1'], [scoreState.inquiry2?.subject || '탐구2', 'inquiry2']];
  const slideX = activeScoreView === 'target' ? '-50%' : '0%';
  const transition = Number(scoreDragOffset) !== 0 ? '0s' : 'transform .56s cubic-bezier(.22,.61,.36,1)';

  return <div className="score-journey-card"><p className="analysis-title">{title}</p><div className="score-journey-segment"><button type="button" className={activeScoreView === 'current' ? 'active' : ''} data-action="setScoreView" data-score-view="current">현재 성적</button><button type="button" className={activeScoreView === 'target' ? 'active' : ''} data-action="setScoreView" data-score-view="target">도달 성적</button></div><div className="score-journey-scroll"><div className={`score-journey-track anchor-volatile ${scoreSlideMotion}`} style={{ '--score-slide-x': `calc(${slideX} + ${Number(scoreDragOffset) || 0}px)`, '--score-slide-transition': transition }}>
    <div className="score-journey-col current" data-score-view="current"><h4>현재 성적</h4>{rows.map(([label, key]) => <CurrentRow label={label} current={current[key]} key={key} />)}<div className="score-journey-total"><span>환산 점수</span><b>{currentAverage}점</b></div></div>
    <div className="score-journey-col target" data-score-view="target"><div className="score-target-panel"><h4>도달 성적</h4>{rows.map(([label, key]) => <TargetRow label={label} current={current[key]} target={target[key]} key={key} />)}<div className="score-journey-total"><span>예상 환산 점수</span><b>{targetAverage}점</b></div></div></div>
  </div></div></div>;
}
