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

export function renderScoreEditModal(ctx = {}) {
  const state = ctx.scoreEditState || {};
  const korean = state.korean || {};
  const math = state.math || {};
  const inquiry1 = state.inquiry1 || {};
  const inquiry2 = state.inquiry2 || {};
  const koreanRaw = Number(korean.common || 0) + Number(korean.elective || 0);
  const mathRaw = Number(math.common || 0) + Number(math.elective || 0);
  return `<div class="home-modal-overlay" data-action="closeScoreEdit"><div class="home-modal score-edit-modal score-onepage-modal" data-action="noopModal"><div class="score-onepage-head"><div><p class="home-modal-title">성적 전체 입력</p><p class="sub">모든 과목을 한 화면에서 입력하고 저장합니다.</p></div><button class="score-onepage-close" data-action="closeScoreEdit">닫기</button></div><div class="score-onepage-body"><section class="score-subject-card major"><div class="score-subject-head"><div><span>국어</span><b>${rawScoreLabel(koreanRaw)}</b></div>${renderRawMetric(koreanRaw)}</div><select class="planner-input" data-field="v2e-korean-type"><option value="화법과작문" ${korean.type === '화법과작문' ? 'selected' : ''}>화법과작문</option><option value="언어와매체" ${korean.type === '언어와매체' ? 'selected' : ''}>언어와매체</option></select><div class="score-input-grid">${renderScoreNumberInput('v2e-korean-common', korean.common, '공통 원점수', 76)}${renderScoreNumberInput('v2e-korean-elective', korean.elective, '선택 원점수', 24)}</div></section><section class="score-subject-card major"><div class="score-subject-head"><div><span>수학</span><b>${rawScoreLabel(mathRaw)}</b></div>${renderRawMetric(mathRaw)}</div><select class="planner-input" data-field="v2e-math-type"><option value="확률과통계" ${math.type === '확률과통계' ? 'selected' : ''}>확률과통계</option><option value="미적분" ${math.type === '미적분' ? 'selected' : ''}>미적분</option><option value="기하" ${math.type === '기하' ? 'selected' : ''}>기하</option></select><div class="score-input-grid">${renderScoreNumberInput('v2e-math-common', math.common, '공통 원점수', 74)}${renderScoreNumberInput('v2e-math-elective', math.elective, '선택 원점수', 26)}</div></section><section class="score-subject-card compact"><div class="score-subject-head"><div><span>영어</span><b>${state.english ? `${escapeHtml(state.english)}등급` : '미입력'}</b></div></div>${renderGradeSelect('v2e-english', state.english)}</section><section class="score-subject-card compact"><div class="score-subject-head"><div><span>한국사</span><b>${state.history ? `${escapeHtml(state.history)}등급` : '미입력'}</b></div></div>${renderGradeSelect('v2e-history', state.history)}</section><section class="score-subject-card"><div class="score-subject-head"><div><span>탐구 1</span><b>${rawScoreLabel(inquiry1.score)}</b></div>${renderRawMetric(inquiry1.score)}</div><select class="planner-input" data-field="v2e-inq1-subject">${renderInquiryOptions(inquiry1.subject)}</select>${renderScoreNumberInput('v2e-inq1-score', inquiry1.score, '원점수', 50)}</section><section class="score-subject-card"><div class="score-subject-head"><div><span>탐구 2</span><b>${rawScoreLabel(inquiry2.score)}</b></div>${renderRawMetric(inquiry2.score)}</div><select class="planner-input" data-field="v2e-inq2-subject">${renderInquiryOptions(inquiry2.subject)}</select>${renderScoreNumberInput('v2e-inq2-score', inquiry2.score, '원점수', 50)}</section></div><div class="score-onepage-actions"><button class="btn btn-secondary" data-action="closeScoreEdit">취소</button><button class="btn btn-primary" data-action="saveScoreEdit">성적 저장</button></div></div></div>`;
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

  return layout(appbar('성적 정보', true) + `<section class="score-info-page"><div class="card score-info-hero"><span class="badge">분석 기준</span><h3>모의고사별 성적을 한 번에 관리해요</h3><p>선택한 시험 성적이 홈과 분석 탭의 지원학과 점수에 연결됩니다.</p><div class="score-info-picker"><label>기준 시험</label><select class="planner-input" data-field="scoreExamType">${renderExamOptions(scoreExamType)}</select><button class="btn btn-secondary" data-action="applyScoreExam">적용</button></div></div><div class="card score-info-card"><div class="score-info-card-head"><div><p class="analysis-title">입력된 성적</p><p class="sub">원점수, 표준점수, 백분위, 등급을 함께 확인합니다.</p></div><button class="btn btn-primary score-edit-btn" data-action="openScoreEdit">전체 성적 입력/수정</button></div><div class="score-info-detail-table"><div class="score-info-detail-row"><b>과목</b><b>원점수</b><b>표준점수</b><b>백분위</b><b>등급</b></div>${scoreInfoDetailList}</div></div></section>${modal}`, false);
}
