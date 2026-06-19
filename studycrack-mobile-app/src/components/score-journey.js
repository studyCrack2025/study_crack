export function scoreTierClass(score) {
  const n = Number(score) || 0;
  if (n <= 100) return 'score-tier-low';
  if (n <= 150) return 'score-tier-mid';
  return 'score-tier-high';
}

function toEnglishGrade(value) {
  return Math.min(9, Math.max(1, Math.round((100 - Number(value || 0)) / 12.5) + 1));
}

function renderTargetRow(label, current, target) {
  const diff = target - current;
  const badge = diff > 0 ? `<span class="pill up">+${diff}</span>` : '<span class="pill keep">유지</span>';
  const fromValue = label === '영어' ? `${toEnglishGrade(current)}등급` : `${current}`;
  const toValue = label === '영어' ? `${toEnglishGrade(target)}등급` : `${target}`;
  const detail = diff > 0
    ? `<span class="old">${fromValue}</span><span class="arrow">→</span><span class="new">${toValue}</span>`
    : fromValue;
  return `<div class="score-row"><span>${label}</span><b>${badge}</b><em>${detail}</em></div>`;
}

function renderUnavailableCard(title, body, cta = '') {
  return `
    <div class="score-journey-card score-journey-card-empty">
      <p class="analysis-title">${title}</p>
      <div class="score-journey-empty-panel">
        <b>${body}</b>
        ${cta}
      </div>
    </div>
  `;
}

export function renderScoreJourneyCard(ctx = {}, title = '최소 노력 대비 합격 도달 성적') {
  const {
    activeScoreView = 'target',
    analysisApiStatus = 'idle',
    analysisSelected = {},
    analysisSimRows = [],
    analysisTargetScore,
    canAccessStandard = false,
    scoreDragOffset = 0,
    scoreSlideMotion = '',
    scores = {}
  } = ctx;
  if (!canAccessStandard) {
    return renderUnavailableCard(
      title,
      '점수 상승 시뮬레이션은 Standard 이상 플랜에서 확인할 수 있어요.',
      '<button type="button" class="btn btn-primary mini" data-action="goto" data-target="proIntro">플랜 보기</button>'
    );
  }

  const current = {
    korean: Number(scores.korean || 0),
    math: Number(scores.math || 0),
    english: Number(scores.english || 0),
    inquiry1: Number(scores.inquiry1 || 0),
    inquiry2: Number(scores.inquiry2 || 0)
  };
  const hasCurrentScores = Object.values(current).some((value) => Number(value) > 0);
  if (!hasCurrentScores) {
    return renderUnavailableCard(title, '선택한 시험의 저장된 성적이 없어 도달 성적을 계산할 수 없어요.');
  }
  if (!analysisSimRows.length) {
    const message = analysisApiStatus === 'loading'
      ? '도달 성적을 계산하는 중입니다.'
      : '시뮬레이션 결과를 불러오면 도달 성적이 표시돼요.';
    return renderUnavailableCard(title, message);
  }

  const currentAverage = Math.round(
    Number(analysisSelected?.score) ||
      ((current.korean + current.math + current.english + current.inquiry1 + current.inquiry2) / 5)
  );
  const target = {
    korean: Math.min(100, current.korean + Math.max(1, Math.round((100 - current.korean) * 0.12))),
    math: Math.min(100, current.math + Math.max(2, Math.round((100 - current.math) * 0.22))),
    english: Math.min(100, current.english + Math.max(1, Math.round((100 - current.english) * 0.08))),
    inquiry1: Math.min(100, current.inquiry1 + Math.max(1, Math.round((100 - current.inquiry1) * 0.14))),
    inquiry2: Math.min(100, current.inquiry2 + Math.max(1, Math.round((100 - current.inquiry2) * 0.1)))
  };
  const targetAverage = Math.round(
    Number(analysisTargetScore) ||
      ((target.korean + target.math + target.english + target.inquiry1 + target.inquiry2) / 5)
  );
  const slideX = activeScoreView === 'target' ? '-50%' : '0%';
  const transition = Number(scoreDragOffset) !== 0 ? '0s' : 'transform .56s cubic-bezier(.22,.61,.36,1)';

  return `
    <div class="score-journey-card">
      <p class="analysis-title">${title}</p>
      <div class="score-journey-segment">
        <button type="button" class="${activeScoreView === 'current' ? 'active' : ''}" data-action="setScoreView" data-score-view="current">현재 성적</button>
        <button type="button" class="${activeScoreView === 'target' ? 'active' : ''}" data-action="setScoreView" data-score-view="target">도달 성적</button>
      </div>
      <div class="score-journey-scroll">
        <div class="score-journey-track anchor-volatile ${scoreSlideMotion}" style="--score-slide-x:calc(${slideX} + ${Number(scoreDragOffset) || 0}px);--score-slide-transition:${transition};">
          <div class="score-journey-col current" data-score-view="current">
            <h4>현재 성적</h4>
            <div class="score-row"><span>국어</span><b>${current.korean}</b></div>
            <div class="score-row"><span>수학</span><b>${current.math}</b></div>
            <div class="score-row"><span>영어</span><b>${toEnglishGrade(current.english)}등급</b></div>
            <div class="score-row"><span>탐구1</span><b>${current.inquiry1}</b></div>
            <div class="score-row"><span>탐구2</span><b>${current.inquiry2}</b></div>
            <div class="score-journey-total"><span>총점</span><b>${currentAverage}점</b></div>
          </div>
          <div class="score-journey-col target" data-score-view="target">
            <div class="score-target-panel">
              <h4>도달 성적</h4>
              ${renderTargetRow('국어', current.korean, target.korean)}
              ${renderTargetRow('수학', current.math, target.math)}
              ${renderTargetRow('영어', current.english, target.english)}
              ${renderTargetRow('탐구1', current.inquiry1, target.inquiry1)}
              ${renderTargetRow('탐구2', current.inquiry2, target.inquiry2)}
              <div class="score-journey-total"><span>예상 총점</span><b>${targetAverage}점</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
