export function scoreTierClass(score) {
  const n = Number(score) || 0;
  if (n <= 100) return 'score-tier-low';
  if (n <= 150) return 'score-tier-mid';
  return 'score-tier-high';
}

function toEnglishGrade(value) {
  return Math.min(9, Math.max(1, Math.round((100 - Number(value || 0)) / 12.5) + 1));
}

function formatScoreValue(label, value) {
  const n = Number(value || 0);
  if (!n) return '-';
  return label === '영어' ? `${toEnglishGrade(n)}등급` : `${n}`;
}

function renderCurrentRow(label, current) {
  return `<div class="score-row"><span>${label}</span><b>${formatScoreValue(label, current)}</b></div>`;
}

function renderTargetRow(label, current, target) {
  const diff = target - current;
  const badge = diff > 0 ? `<span class="pill up">+${diff}</span>` : '<span class="pill keep">유지</span>';
  const fromValue = formatScoreValue(label, current);
  const toValue = formatScoreValue(label, target);
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

function buildSimulationTarget({ current, analysisSelected, analysisTargetScore, analysisSimRows, scoreState }) {
  const target = { ...current };
  const currentAiScore = Math.round(Number(analysisSelected?.score) || 0);
  const targetAiScore = Math.max(currentAiScore, Math.round(Number(analysisTargetScore) || currentAiScore));
  let remainingAiGain = Math.max(0, targetAiScore - currentAiScore);
  const resolveSubject = createSubjectResolver(scoreState);
  const rows = [...analysisSimRows]
    .map((row) => ({ ...row, key: resolveSubject(row.subject), gainNum: Number(row.gainNum || 0) }))
    .filter((row) => row.key && row.gainNum > 0 && Number(current[row.key] || 0) > 0)
    .sort((a, b) => b.gainNum - a.gainNum)
    .slice(0, 2);

  rows.forEach((row) => {
    if (remainingAiGain <= 0) return;
    const minRawGain = row.key === 'english' ? 1 : 2;
    const maxRawGain = Math.max(0, 100 - Number(target[row.key] || 0));
    const neededRawGain = Math.max(minRawGain, Math.ceil(remainingAiGain / Math.max(row.gainNum, 1)));
    const rawGain = Math.min(maxRawGain, neededRawGain);
    target[row.key] = Math.min(100, Number(target[row.key] || 0) + rawGain);
    remainingAiGain = Math.max(0, remainingAiGain - rawGain * row.gainNum);
  });

  return target;
}

export function renderScoreJourneyCard(ctx = {}, title = '최소 노력 대비 합격 도달 성적') {
  const {
    activeScoreView = 'target',
    analysisApiStatus = 'idle',
    analysisSelected = {},
    analysisSimRows = [],
    analysisTargetScore,
    canAccessStandard = false,
    canUseReverseProjection = canAccessStandard,
    scoreDragOffset = 0,
    scoreSlideMotion = '',
    scoreState = {},
    scores = {}
  } = ctx;
  if (!canUseReverseProjection) {
    return renderUnavailableCard(
      title,
      '최소 노력 대비 도달 성적과 역산 전략은 Standard 이상 플랜에서 확인할 수 있어요.',
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
  const target = buildSimulationTarget({ current, analysisSelected, analysisTargetScore, analysisSimRows, scoreState });
  const targetAverage = Math.round(
    Number(analysisTargetScore) ||
      ((target.korean + target.math + target.english + target.inquiry1 + target.inquiry2) / 5)
  );
  const inquiry1Label = scoreState.inquiry1?.subject || '탐구1';
  const inquiry2Label = scoreState.inquiry2?.subject || '탐구2';
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
            ${renderCurrentRow('국어', current.korean)}
            ${renderCurrentRow('수학', current.math)}
            ${renderCurrentRow('영어', current.english)}
            ${renderCurrentRow(inquiry1Label, current.inquiry1)}
            ${renderCurrentRow(inquiry2Label, current.inquiry2)}
            <div class="score-journey-total"><span>AI 점수</span><b>${currentAverage}점</b></div>
          </div>
          <div class="score-journey-col target" data-score-view="target">
            <div class="score-target-panel">
              <h4>도달 성적</h4>
              ${renderTargetRow('국어', current.korean, target.korean)}
              ${renderTargetRow('수학', current.math, target.math)}
              ${renderTargetRow('영어', current.english, target.english)}
              ${renderTargetRow(inquiry1Label, current.inquiry1, target.inquiry1)}
              ${renderTargetRow(inquiry2Label, current.inquiry2, target.inquiry2)}
              <div class="score-journey-total"><span>예상 AI 점수</span><b>${targetAverage}점</b></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
