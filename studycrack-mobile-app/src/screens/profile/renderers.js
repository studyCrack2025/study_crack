import { renderGradeButtons } from '../../components/grade-buttons.js';
import { EXAM_OPTIONS, INQUIRY_SUBJECTS } from '../../constants/options.js';
import { RANKING_MOCK } from '../../constants/ranking.js';

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

function scoreMetric(raw) {
  const n = Math.max(0, Number(raw) || 0);
  const std = Math.min(160, Math.round(n * 0.95 + 22));
  const pct = Math.min(99, Math.max(1, Math.round(n * 0.9 + 10)));
  const grade = pct >= 96 ? 1 : pct >= 89 ? 2 : pct >= 77 ? 3 : pct >= 64 ? 4 : pct >= 52 ? 5 : pct >= 40 ? 6 : pct >= 28 ? 7 : pct >= 16 ? 8 : 9;
  return { std, pct, grade };
}

function renderInquiryOptions(selected = '') {
  return `<option value="">과목 선택</option>${INQUIRY_SUBJECTS.map((subject) => `<option value="${subject}" ${selected === subject ? 'selected' : ''}>${subject}</option>`).join('')}`;
}

function renderGradeSelect(field, selected = '') {
  return `<select class="planner-input" data-field="${field}"><option value="">등급 선택</option>${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<option value="${n}" ${String(selected) === String(n) ? 'selected' : ''}>${n}등급</option>`).join('')}</select>`;
}

function renderGradeSegment(field, selected = '') {
  const key = field === 'v2e-english' ? 'english' : 'history';
  return `<span class="score-grade-label">등급 선택 (1~9)</span><div class="score-grade-segment" role="group" aria-label="등급 선택">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="${String(selected) === String(n) ? 'active' : ''}" data-action="setScoreEditGrade" data-grade-field="${key}" data-grade-value="${n}">${n}</button>`).join('')}</div>`;
}

function renderRawMetric(raw) {
  if (!Number(raw || 0)) return '<div class="score-onepage-metric"><span>표준 -</span><span>백분위 -</span><span>등급 -</span></div>';
  const metric = scoreMetric(raw);
  return `<div class="score-onepage-metric"><span>표준 ${metric.std}</span><span>백분위 ${metric.pct}</span><span>${metric.grade}등급</span></div>`;
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
  const raw = Number(sub.common || 0) + Number(sub.elective || 0);
  return `<div class="score-step-panel">
    <div class="score-step-panel-head"><b>${title}</b><span>선택 과목 + 공통/선택 원점수</span></div>
    <label class="score-field-label">선택 과목</label>
    <select class="planner-input" data-field="${selField}">${options}</select>
    <label class="score-field-label">원점수</label>
    <div class="score-input-grid">${renderScoreNumberInput(commonField, sub.common, `공통 (0~${commonMax})`, commonMax)}${renderScoreNumberInput(electiveField, sub.elective, `선택 (0~${electiveMax})`, electiveMax)}</div>
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
    ${renderScoreNumberInput(scoreField, inq.score, '0~50', 50)}
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

  const rail = SCORE_STEPS.map((s) => {
    const on = s.step === step;
    const done = isSubjectSaved(quant, s.key);
    return `<button type="button" class="score-step-chip ${on ? 'active' : ''} ${done ? 'done' : ''}" data-action="scoreStepGoto" data-step="${s.step}">${done ? '<span class="score-step-check">✓</span>' : ''}${s.name}</button>`;
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

  return `<div class="home-modal-overlay" data-action="closeScoreEdit"><div class="home-modal score-edit-modal score-stepper-modal" data-action="noopModal">
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
    rankingMock = RANKING_MOCK,
    rankingPeriod = 'daily',
    tierClass = defaultTierClass
  } = ctx;
  const rows = rankingMock[rankingPeriod] || [];

  return layout(appbar('공부 랭킹', true) + `<section class="ranking-theme"><div class="ranking-page"><p class="ranking-subtitle">오늘의 공부 몰입도를 확인해보세요</p>
      <div class="ranking-tabs">${RANKING_PERIODS.map(([key, label]) => `<button type="button" class="${rankingPeriod === key ? 'active' : ''}" data-action="setRankingPeriod" data-ranking-period="${key}">${label}</button>`).join('')}</div>
      <div class="card ranking-podium-card"><div class="ranking-podium">${rows.slice(0, 3).map((row, idx) => `<div class="podium-item tier-card tier-${tierClass(row.tier)} ${idx === 0 ? 'first' : idx === 1 ? 'second' : 'third'}">${idx === 0 ? '<span class="podium-crown">👑</span>' : '<span class="podium-crown">✦</span>'}<span class="tier-emblem ${tierClass(row.tier)}"><strong>${row.streak}</strong><small>일</small></span><b>${row.name}</b><p>${row.time}</p><small>${row.tier}</small><i class="podium-block">${idx + 1}</i></div>`).join('')}</div></div>
      <div class="card ranking-list-card">${rows.slice(3).map((row, idx) => `<div class="ranking-row tier-card tier-${tierClass(row.tier)}"><span class="num">${idx + 4}</span><span class="tier-emblem small ${tierClass(row.tier)}"><strong>${row.streak}</strong><small>일</small></span><div class="meta"><b>${row.name}</b><p>${row.time}</p></div><em>${row.tier} · ${row.streak}일 연속</em></div>`).join('')}</div>
      <div class="card my-rank-fixed"><p class="sub">내 순위</p><b>124등</b><div class="my-rank-tier"><span class="tier-emblem small bronze"><strong>2</strong><small>일</small></span><span>BRONZE · 2일 연속</span></div><small>오늘 1시간 20분</small></div>
    </div></section>`, true);
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

  return layout(appbar('정성조사서', true) + `<section class="qual-form-page"><div class="card qual-form-head"><span class="badge">학습성향 진단</span><h3>전략 설계를 위한 기본 정보를 입력해주세요.</h3><p>* 표시는 필수 입력 항목입니다.</p></div><div class="card qual-form-card"><div class="qual-field wide"><label>현재 학년 <span>*</span></label><div class="ob1-pill-row qual-grade-row">${renderGradeButtons(obGradeStatus)}</div></div><div class="qual-field"><label>출신 학교 <span>*</span></label><input class="planner-input" data-field="obSchoolName" value="${escapeHtml(obSchoolName)}" placeholder="출신 학교 입력"/></div><div class="qual-field"><label>희망 계열 <span>*</span></label><select class="planner-input" data-field="obTrack">${renderTrackOptions(obTrack)}</select></div><div class="qual-field wide"><label>스터디크랙을 통해 얻고 싶은 점 <span>*</span></label><textarea class="planner-input qual-textarea" data-field="obGoalText" rows="4" placeholder="예: 목표 대학에 맞는 과목별 우선순위를 알고 싶어요.">${escapeHtml(obGoalText)}</textarea></div><div class="qual-field wide"><label>입시 고민 및 질문</label><textarea class="planner-input qual-textarea" data-field="obQuestionText" rows="5" placeholder="현재 가장 고민되는 부분을 자유롭게 적어주세요.">${escapeHtml(obQuestionText)}</textarea></div><button class="btn btn-primary qual-save-btn" data-action="saveQualInfo">정성조사서 저장</button></div></section>`, false);
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

  return layout(appbar('성적 정보', true) + `<section class="score-info-page"><div class="card score-info-hero"><span class="badge">분석 기준</span><h3>모의고사별 성적을 한 번에 관리해요</h3><p>선택한 시험 성적이 홈과 분석 탭의 지원학과 점수에 연결됩니다.</p><div class="score-info-picker"><label>기준 시험</label><select class="planner-input" data-field="scoreExamType">${renderExamOptions(scoreExamType)}</select><button class="btn btn-secondary" data-action="applyScoreExam">적용</button></div></div><div class="card score-info-card"><div class="score-info-card-head"><div><p class="analysis-title">내 성적</p><p class="sub">과목별 원점수와 분석용 지표를 확인합니다.</p></div><button class="btn btn-primary score-edit-btn" data-action="openScoreEdit">전체 성적 입력/수정</button></div><div class="score-info-subject-list">${scoreInfoDetailList}</div></div></section>`, false, modal);
}
