import { renderGradeButtons } from '../../components/grade-buttons.js';
import { renderSecondaryIntro, renderSecondaryState } from '../../components/secondary-page.js';
import { EXAM_OPTIONS, INQUIRY_SUBJECTS } from '../../constants/options.js';

const TRACK_OPTIONS = ['예체능', '인문사회', '상경계열', '자연/공학', '의치한약수', '간호', '사범/교대', '기타'];
const RANKING_PERIODS = [
  ['daily', '일간'],
  ['weekly', '주간'],
  ['monthly', '월간']
];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function defaultTierClass(tier = '') {
  return tier.toLowerCase();
}

function renderTrackOptions(obTrack = '') {
  return TRACK_OPTIONS.map((track) => `<option value="${track}" ${obTrack === track ? 'selected' : ''}>${track}</option>`).join('');
}

function renderExamOptions(scoreExamType = '') {
  return EXAM_OPTIONS.map((label) => `<option value="${label}" ${scoreExamType === label ? 'selected' : ''}>${label}</option>`).join('');
}

function renderInquiryOptions(selected = '') {
  // DB에 저장된 과목명이 표준 목록과 미세하게 달라도(예: '물리Ⅰ' vs '물리학Ⅰ') 드롭다운에 표시되도록
  // 목록에 없는 저장값은 별도 옵션으로 선두에 추가한다.
  const saved = String(selected || '').trim();
  const inList = INQUIRY_SUBJECTS.includes(saved);
  const extra = saved && !inList ? `<option value="${escapeHtml(saved)}" selected>${escapeHtml(saved)}</option>` : '';
  return `<option value="" ${saved ? '' : 'selected'}>과목 선택</option>${extra}${INQUIRY_SUBJECTS.map((subject) => `<option value="${escapeHtml(subject)}" ${saved === subject ? 'selected' : ''}>${escapeHtml(subject)}</option>`).join('')}`;
}

function renderGradeSelect(field, selected = '') {
  return `<select class="planner-input" data-field="${field}"><option value="">등급 선택</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<option value="${n}" ${String(selected) === String(n) ? 'selected' : ''}>${n}등급</option>`).join('')}</select>`;
}

function renderGradeSegment(field, selected = '') {
  const key = field === 'v2e-english' ? 'english' : 'history';
  const cards = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .map((n) => `<button type="button" class="score-grade-card ${String(selected) === String(n) ? 'active' : ''}" data-action="setScoreEditGrade" data-grade-field="${key}" data-grade-value="${n}"><b>${n}</b><span>등급</span></button>`)
    .join('');
  return `<span class="score-grade-label">해당 등급을 선택하세요</span><div class="score-grade-grid" role="group" aria-label="등급 선택">${cards}</div>`;
}

function renderRawMetric(raw) {
  const entered = String(raw ?? '').trim() !== '';
  return `<div class="score-onepage-metric"><span>원점수 ${entered ? Number(raw) : '-'}</span><span>표준점수 저장 후 계산</span><span>백분위 저장 후 계산</span></div>`;
}

function renderScoreNumberInput(field, value, placeholder, max = 100) {
  return `<input class="planner-input" data-field="${field}" value="${escapeHtml(value || '')}" type="number" min="0" max="${max}" inputmode="numeric" placeholder="${placeholder}"/>`;
}

function rawScoreLabel(value) {
  return Number(value || 0) ? `${Number(value)}점` : '미입력';
}

function isMissingValue(value) {
  return !String(value ?? '').trim();
}

function subjectHint(missing, text) {
  return missing ? `<p class="score-field-hint">${text}</p>` : '';
}

function renderDirectScoreInput({ field, value, max, label }) {
  const shownValue = value === 0 || value === '0' ? '0' : String(value || '');
  return `<label class="score-direct-field"><span>${label}</span><div class="score-direct-control"><input class="planner-input score-direct-input" data-field="${field}" data-score-max="${max}" value="${escapeHtml(shownValue)}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" placeholder="0" aria-label="${label} 원점수"/><em>점</em></div><small>0점 또는 2~${max - 2}점, ${max}점</small></label>`;
}

const SCORE_STEPS = [
  { step: 1, key: 'korean', name: '국어' },
  { step: 2, key: 'math', name: '수학' },
  { step: 3, key: 'english', name: '영어' },
  { step: 4, key: 'history', name: '한국사' },
  { step: 5, key: 'inquiry1', name: '탐구 1' },
  { step: 6, key: 'inquiry2', name: '탐구 2' }
];

function isSubjectSaved(q, key) {
  if (!q) return false;
  if (key === 'korean') return Number(q.kor?.common || 0) + Number(q.kor?.elective || 0) > 0;
  if (key === 'math') return Number(q.math?.common || 0) + Number(q.math?.elective || 0) > 0;
  if (key === 'english') return Number(q.eng?.grd || 0) > 0;
  if (key === 'history') return Number(q.hist?.grd || 0) > 0;
  if (key === 'inquiry1') return Boolean(q.inq1?.name) && Number(q.inq1?.raw || 0) > 0;
  if (key === 'inquiry2') return Boolean(q.inq2?.name) && Number(q.inq2?.raw || 0) > 0;
  return false;
}

function renderRawSubjectPanel({ title, selField, options, commonField, electiveField, commonMax, electiveMax, sub }) {
  const hasCommon = String(sub.common ?? '').trim() !== '';
  const hasElective = String(sub.elective ?? '').trim() !== '';
  const raw = hasCommon && hasElective ? Number(sub.common) + Number(sub.elective) : '';
  return `<div class="score-step-panel">
    <div class="score-step-panel-head"><b>${title}</b><span>선택 과목 + 공통/선택 원점수</span></div>
    <label class="score-field-label">선택 과목</label>
    <select class="planner-input" data-field="${selField}">${options}</select>
    <label class="score-field-label">원점수</label>
    <div class="score-direct-grid">${renderDirectScoreInput({ field: commonField, value: sub.common, max: commonMax, label: '공통' })}${renderDirectScoreInput({ field: electiveField, value: sub.elective, max: electiveMax, label: '선택' })}</div>
    <p class="score-direct-help">숫자로 직접 입력해 주세요. 문항 배점상 불가능한 1점과 만점보다 1점 낮은 점수는 저장할 수 없어요.</p>
    ${renderRawMetric(raw)}
  </div>`;
}

function renderGradeSubjectPanel({ title, field, value }) {
  return `<div class="score-step-panel">
    <div class="score-step-panel-head"><b>${title}</b><span>절대평가 · 등급만 선택</span></div>
    ${renderGradeSegment(field, value)}
    ${value
      ? `<div class="score-step-confirm"><span class="score-step-check">✓</span>${title} ${escapeHtml(String(value))}등급으로 입력됐어요</div>`
      : '<div class="score-step-warn">아래에서 등급을 선택해 주세요</div>'}
  </div>`;
}

function renderInquirySubjectPanel({ title, subjField, scoreField, inq }) {
  return `<div class="score-step-panel">
    <div class="score-step-panel-head"><b>${title}</b><span>탐구 과목 + 원점수</span></div>
    <label class="score-field-label">탐구 과목</label>
    <select class="planner-input" data-field="${subjField}">${renderInquiryOptions(inq.subject)}</select>
    <label class="score-field-label">원점수</label>
    <div class="score-direct-single">${renderDirectScoreInput({ field: scoreField, value: inq.score, max: 50, label: '탐구 원점수' })}</div>
    <p class="score-direct-help">탐구도 1점과 49점처럼 문항 배점상 불가능한 점수는 저장할 수 없어요.</p>
    ${renderRawMetric(inq.score)}
  </div>`;
}

export function renderScoreEditModal(ctx = {}) {
  const state = ctx.scoreEditState || {};
  const korean = state.korean || {};
  const math = state.math || {};
  const inquiry1 = state.inquiry1 || {};
  const inquiry2 = state.inquiry2 || {};
  const step = Math.min(6, Math.max(1, Number(ctx.scoreEditStep || 1)));
  const saving = Boolean(ctx.scoreSubjectSaving);
  const examKey = ctx.scoreExamKey || '';
  const quant = (ctx.user && ctx.user.quantitative && ctx.user.quantitative[examKey]) || {};
  const doneCount = SCORE_STEPS.filter((s) => isSubjectSaved(quant, s.key)).length;
  const progressPct = Math.round((doneCount / SCORE_STEPS.length) * 100);

  // 비클릭 진행 표시(과목 칩 버튼 제거 — '저장하고 다음'으로만 이동). 현재 단계 강조 + 저장 완료 체크.
  const rail = SCORE_STEPS.map((s) => {
    const on = s.step === step;
    const done = isSubjectSaved(quant, s.key);
    return `<span class="score-step-dot ${on ? 'active' : ''} ${done ? 'done' : ''}" aria-current="${on ? 'step' : 'false'}">${done && !on ? '✓' : s.name}</span>`;
  }).join('');

  let panel = '';
  if (step === 1) {
    panel = renderRawSubjectPanel({ title: '국어', selField: 'v2e-korean-type', options: `<option value="화법과작문" ${korean.type === '화법과작문' ? 'selected' : ''}>화법과작문</option><option value="언어와매체" ${korean.type === '언어와매체' ? 'selected' : ''}>언어와매체</option>`, commonField: 'v2e-korean-common', electiveField: 'v2e-korean-elective', commonMax: 76, electiveMax: 24, sub: korean });
  } else if (step === 2) {
    panel = renderRawSubjectPanel({ title: '수학', selField: 'v2e-math-type', options: `<option value="확률과통계" ${math.type === '확률과통계' ? 'selected' : ''}>확률과통계</option><option value="미적분" ${math.type === '미적분' ? 'selected' : ''}>미적분</option><option value="기하" ${math.type === '기하' ? 'selected' : ''}>기하</option>`, commonField: 'v2e-math-common', electiveField: 'v2e-math-elective', commonMax: 74, electiveMax: 26, sub: math });
  } else if (step === 3) {
    panel = renderGradeSubjectPanel({ title: '영어', field: 'v2e-english', value: state.english });
  } else if (step === 4) {
    panel = renderGradeSubjectPanel({ title: '한국사', field: 'v2e-history', value: state.history });
  } else if (step === 5) {
    panel = renderInquirySubjectPanel({ title: '탐구 1', subjField: 'v2e-inq1-subject', scoreField: 'v2e-inq1-score', inq: inquiry1 });
  } else {
    panel = renderInquirySubjectPanel({ title: '탐구 2', subjField: 'v2e-inq2-subject', scoreField: 'v2e-inq2-score', inq: inquiry2 });
  }

  const isLast = step === 6;
  const primaryLabel = saving ? '저장 중…' : isLast ? '저장하고 완료' : '저장하고 다음';

  return `<div class="sc-overlay sc-overlay--modal home-modal-overlay" data-action="closeScoreEdit"><div class="sc-modal home-modal score-edit-modal score-stepper-modal" data-action="noopModal" role="dialog" aria-modal="true">
    <div class="score-onepage-head"><div><p class="home-modal-title">성적 입력</p><p class="sub">과목을 선택해 하나씩 입력하고 저장해요.</p></div><button class="score-onepage-close" data-action="closeScoreEdit">닫기</button></div>
    <div class="score-stepper-progress"><div class="score-stepper-bar"><i style="width:${progressPct}%"></i></div><span>${doneCount} / ${SCORE_STEPS.length} 저장됨</span></div>
    <div class="score-step-rail">${rail}</div>
    <div class="score-stepper-body">${panel}</div>
    <div class="score-stepper-actions">
      <button type="button" class="btn btn-secondary score-step-nav" data-action="scoreStepPrev" ${step === 1 ? 'disabled' : ''}>이전</button>
      <button type="button" class="btn btn-primary score-step-save" data-action="saveScoreSubject" ${saving ? 'disabled' : ''}>${primaryLabel}</button>
    </div>
  </div></div>`;
}

export function renderRankingScreen(ctx) {
  const {
    appbar,
    layout,
    rankingPeriod = 'daily',
    rankingRows = [],
    rankingStatus = 'idle',
    rankingError = '',
    rankingMe = null,
    tierClass = defaultTierClass,
    formatHms = (seconds) => {
      const total = Math.max(0, Number(seconds) || 0);
      return `${String(Math.floor(total / 3600)).padStart(2, '0')}:${String(Math.floor((total % 3600) / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    }
  } = ctx;
  const rows = rankingRows || [];
  const myRank = rankingMe?.rank ? `${rankingMe.rank}등` : '집계 전';
  const myTier = rankingMe?.tier || 'BRONZE';
  const rankingTotal = Number(rankingMe?.total) || rows.length;
  const percentile = rankingMe?.rank && rankingTotal ? Math.max(1, Math.ceil((Number(rankingMe.rank) / rankingTotal) * 100)) : 0;
  const statusPanel = rankingStatus === 'loading'
    ? renderSecondaryState({ kind: 'loading', title: '랭킹을 집계하고 있어요', description: '학습 기록을 반영하는 중입니다.' })
    : rankingStatus === 'error'
      ? renderSecondaryState({ kind: 'error', title: '랭킹을 불러오지 못했어요', description: escapeHtml(rankingError || '잠시 후 다시 확인해주세요.') })
      : rankingStatus === 'empty' || !rows.length
        ? renderSecondaryState({ title: '아직 이 기간의 공부 기록이 없어요', description: '공부 타이머를 시작하면 자동으로 집계됩니다.' })
        : '';

  const rankingRowsHtml = rows.map((row, idx) => {
    const rank = Number(row.rank) || idx + 1;
    const isMe = row.isMe === true || (rankingMe && rank === Number(rankingMe.rank) && String(row.name || '') === String(rankingMe.name || row.name || ''));
    return `<div class="sc-secondary-row ranking-row ${isMe ? 'is-me' : ''}"><span class="ranking-position ${rank <= 3 ? 'is-top' : ''}">${rank}</span><span class="sc-secondary-row-main"><b>${escapeHtml(row.name || '회원')}</b><p>${formatHms(row.seconds)} 공부</p></span><span class="sc-secondary-row-meta"><b>${escapeHtml(row.tier || 'BRONZE')}</b>${isMe ? '<em>내 순위</em>' : ''}</span></div>`;
  }).join('');

  return layout(appbar('공부 랭킹', true) + `<section class="sc-secondary-page ranking-page">
      ${renderSecondaryIntro({ eyebrow: 'STUDY RANKING', title: '공부 기록 순위', description: '실제 누적 공부 시간을 기준으로 같은 기간의 순위를 확인해요.', aside: `<span class="sc-chip">${RANKING_PERIODS.find(([key]) => key === rankingPeriod)?.[1] || '일간'}</span>` })}
      <section class="sc-secondary-section ranking-summary"><div class="ranking-summary-main"><span>내 순위</span><b>${myRank}</b><p>${rankingMe ? `${formatHms(rankingMe.seconds)} 공부` : '공부를 시작하면 집계됩니다.'}</p></div><div class="ranking-summary-stats"><div><span>티어</span><b class="${tierClass(myTier)}">${escapeHtml(myTier)}</b></div><div><span>전체</span><b>${rankingTotal ? `${rankingTotal}명` : '—'}</b></div><div><span>상위</span><b>${percentile ? `${percentile}%` : '—'}</b></div></div></section>
      <div class="sc-secondary-segmented ranking-tabs">${RANKING_PERIODS.map(([key, label]) => `<button type="button" class="${rankingPeriod === key ? 'active' : ''}" data-action="setRankingPeriod" data-ranking-period="${key}">${label}</button>`).join('')}</div>
      ${statusPanel || `<section class="sc-secondary-section ranking-board"><div class="sc-secondary-section-head"><div><h3>전체 순위</h3><p>상위 기록부터 차례로 표시합니다.</p></div><span class="sc-badge">${rows.length}명</span></div><div class="sc-secondary-list ranking-list-card">${rankingRowsHtml}</div></section>`}
    </section>`, true);
}

export function renderQualInfoScreen(ctx) {
  const {
    appbar,
    layout,
    obGoalText = '',
    obGradeStatus = '',
    obQuestionText = '',
    obSchoolName = '',
    obTrack = ''
  } = ctx;

  return layout(appbar('정성조사서', true) + `<section class="sc-secondary-page qual-form-page">${renderSecondaryIntro({ eyebrow: 'STUDENT PROFILE', title: '전략 설계 정보', description: '현재 상황과 목표를 입력하면 분석과 튜터 피드백에 함께 반영됩니다.', aside: '<span class="sc-badge">* 필수</span>' })}<section class="sc-secondary-section"><div class="sc-secondary-section-head"><div><h3>기본 정보</h3><p>학년과 학교, 희망 계열을 알려주세요.</p></div></div><div class="sc-secondary-form qual-form-card"><div class="sc-secondary-field qual-field wide"><label>현재 학년 <span>*</span></label><div class="ob1-pill-row qual-grade-row">${renderGradeButtons(obGradeStatus)}</div></div><div class="sc-secondary-field qual-field"><label>출신 학교 <span>*</span></label><input class="planner-input" data-field="obSchoolName" value="${escapeHtml(obSchoolName)}" placeholder="출신 학교 입력"/></div><div class="sc-secondary-field qual-field"><label>희망 계열 <span>*</span></label><select class="planner-input" data-field="obTrack">${renderTrackOptions(obTrack)}</select></div></div></section><section class="sc-secondary-section"><div class="sc-secondary-section-head"><div><h3>목표와 고민</h3><p>전략에 반영할 내용을 구체적으로 적어주세요.</p></div></div><div class="sc-secondary-form qual-form-card"><div class="sc-secondary-field qual-field wide"><label>스터디크랙을 통해 얻고 싶은 점 <span>*</span></label><textarea class="planner-input qual-textarea" data-field="obGoalText" rows="4" placeholder="예: 목표 대학에 맞는 과목별 우선순위를 알고 싶어요.">${escapeHtml(obGoalText)}</textarea></div><div class="sc-secondary-field qual-field wide"><label>입시 고민 및 질문</label><textarea class="planner-input qual-textarea" data-field="obQuestionText" rows="5" placeholder="현재 가장 고민되는 부분을 자유롭게 적어주세요.">${escapeHtml(obQuestionText)}</textarea></div><button class="btn btn-primary qual-save-btn" data-action="saveQualInfo">정성조사서 저장</button></div></section></section>`, false);
}

export function renderScoreInfoScreen(ctx) {
  const {
    appbar,
    layout,
    scoreEditModalHtml = '',
    scoreEditOpen = false,
    scoreExamType = '',
    scoreInfoDetailList = '',
    ScoreEditModal
  } = ctx;
  const modal = scoreEditOpen ? (scoreEditModalHtml || (typeof ScoreEditModal === 'function' ? ScoreEditModal() : '')) : '';

  return layout(appbar('성적 정보', true) + `<section class="sc-secondary-page score-info-page">${renderSecondaryIntro({ eyebrow: 'SCORE DATA', title: '모의고사 성적', description: '선택한 시험 성적이 홈과 분석의 대학별 환산점수 기준이 됩니다.' })}<section class="sc-secondary-section"><div class="sc-secondary-section-head"><div><h3>분석 기준 시험</h3><p>확인할 모의고사를 선택해주세요.</p></div></div><div class="score-info-picker"><label>기준 시험</label><select class="planner-input" data-field="scoreExamType">${renderExamOptions(scoreExamType)}</select><button class="btn btn-secondary" data-action="applyScoreExam">적용</button></div></section><section class="sc-secondary-section score-info-card"><div class="sc-secondary-section-head score-info-card-head"><div><h3>내 성적</h3><p>원점수와 표준점수·백분위·등급을 함께 확인합니다.</p></div><button class="btn btn-primary score-edit-btn" data-action="openScoreEdit">입력·수정</button></div><div class="score-info-subject-list">${scoreInfoDetailList}</div></section></section>`, false, modal);
}
