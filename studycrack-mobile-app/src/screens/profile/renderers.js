import { renderGradeButtons } from '../../components/grade-buttons.js';
import { EXAM_OPTIONS, INQUIRY_SUBJECTS } from '../../constants/options.js';
import { RANKING_MOCK } from '../../constants/ranking.js';

const TRACK_OPTIONS = ['예체능', '인문사회', '상경계열', '자연/공학', '의치한약수', '간호', '사범/교대', '기타'];
const RANKING_PERIODS = [
  ['daily', '일간'],
  ['weekly', '주간'],
  ['monthly', '월간']
];

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

export function renderScoreEditModal(ctx = {}) {
  const step = Number(ctx.scoreEditStep || 1);
  const state = ctx.scoreEditState || {};
  const korean = state.korean || {};
  const math = state.math || {};
  const inquiry1 = state.inquiry1 || {};
  const inquiry2 = state.inquiry2 || {};
  const previewRaw = step === 1
    ? Number(korean.common || 0) + Number(korean.elective || 0)
    : step === 2
      ? Number(math.common || 0) + Number(math.elective || 0)
      : step === 5
        ? Number(inquiry1.score || 0)
        : step === 6
          ? Number(inquiry2.score || 0)
          : 0;
  const previewMetric = scoreMetric(previewRaw);
  const previewGrade = step === 3 ? (Number(state.english || 0) || '-') : step === 4 ? (Number(state.history || 0) || '-') : previewMetric.grade;
  const preview = `<div class="on-dummy-result"><b>표준점수 ${previewMetric.std}</b><b>백분위 ${previewMetric.pct}</b><b>등급 ${previewGrade}</b></div>`;
  const body = step === 1
    ? `<h4>국어</h4><select class="planner-input" data-field="v2e-korean-type"><option value="화법과작문" ${korean.type === '화법과작문' ? 'selected' : ''}>화법과작문</option><option value="언어와매체" ${korean.type === '언어와매체' ? 'selected' : ''}>언어와매체</option></select><input class="planner-input" data-field="v2e-korean-common" value="${korean.common || ''}" type="number" placeholder="공통 원점수"/><input class="planner-input" data-field="v2e-korean-elective" value="${korean.elective || ''}" type="number" placeholder="선택 원점수"/>${preview}`
    : step === 2
      ? `<h4>수학</h4><select class="planner-input" data-field="v2e-math-type"><option value="확률과통계" ${math.type === '확률과통계' ? 'selected' : ''}>확률과통계</option><option value="미적분" ${math.type === '미적분' ? 'selected' : ''}>미적분</option><option value="기하" ${math.type === '기하' ? 'selected' : ''}>기하</option></select><input class="planner-input" data-field="v2e-math-common" value="${math.common || ''}" type="number" placeholder="공통 원점수"/><input class="planner-input" data-field="v2e-math-elective" value="${math.elective || ''}" type="number" placeholder="선택 원점수"/>${preview}`
      : step === 3
        ? `<h4>영어</h4>${renderGradeSelect('v2e-english', state.english)}`
        : step === 4
          ? `<h4>한국사</h4>${renderGradeSelect('v2e-history', state.history)}`
          : step === 5
            ? `<h4>탐구1</h4><select class="planner-input" data-field="v2e-inq1-subject">${renderInquiryOptions(inquiry1.subject)}</select><input class="planner-input" data-field="v2e-inq1-score" value="${inquiry1.score || ''}" type="number" placeholder="원점수"/>${preview}`
            : `<h4>탐구2</h4><select class="planner-input" data-field="v2e-inq2-subject">${renderInquiryOptions(inquiry2.subject)}</select><input class="planner-input" data-field="v2e-inq2-score" value="${inquiry2.score || ''}" type="number" placeholder="원점수"/>${preview}`;
  return `<div class="home-modal-overlay" data-action="closeScoreEdit"><div class="home-modal score-edit-modal v2-step-modal" data-action="noopModal"><p class="home-modal-title">성적 수정</p><p class="sub">${step}/6</p>${body}<div class="v2-step-actions"><button class="btn btn-secondary" data-action="scoreStepPrev" ${step === 1 ? 'disabled' : ''}>이전</button>${step === 6 ? '<button class="btn btn-primary" data-action="saveScoreEdit">저장</button>' : '<button class="btn btn-primary" data-action="scoreStepNext">다음</button>'}</div></div></div>`;
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

  return layout(appbar('정성조사서', true) + `<div class="card"><p class="sub" style="color:#ef4444;font-weight:700;margin:0 0 10px;">* 표시는 필수 입력 항목입니다.</p><p class="analysis-title">현재 학년 <span style="color:#ef4444">*</span></p><div class="ob1-pill-row">${renderGradeButtons(obGradeStatus)}</div></div><div class="card"><p class="analysis-title">출신 학교 <span style="color:#ef4444">*</span></p><input class="planner-input" data-field="obSchoolName" value="${obSchoolName}" placeholder="출신 학교 입력"/></div><div class="card"><p class="analysis-title">희망 계열 <span style="color:#ef4444">*</span></p><select class="planner-input" data-field="obTrack">${renderTrackOptions(obTrack)}</select></div><div class="card"><p class="analysis-title">스터디크랙을 통해서 얻고 싶은 점 <span style="color:#ef4444">*</span></p><textarea class="planner-input" data-field="obGoalText" rows="3">${obGoalText}</textarea></div><div class="card"><p class="analysis-title">입시 고민 및 질문 (있으면 작성해주세요.)</p><textarea class="planner-input" data-field="obQuestionText" rows="4">${obQuestionText}</textarea><button class="btn btn-primary" data-action="saveQualInfo">정성조사서 저장</button></div>`, false);
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

  return layout(appbar('성적 정보', true) + `<div class="card score-info-card"><label style="font-weight:700;">시험 선택</label><select class="planner-input" data-field="scoreExamType" style="margin-top:8px;">${renderExamOptions(scoreExamType)}</select><div class="score-info-detail-table"><div class="score-info-detail-row"><b>과목</b><b>원점수</b><b>표준점수</b><b>백분위</b><b>등급</b></div>${scoreInfoDetailList}</div><button class="btn btn-primary score-edit-btn" data-action="openScoreEdit">성적 수정하기</button><button class="btn btn-secondary score-edit-btn" data-action="applyScoreExam" style="margin-top:10px;">적용</button></div><div class="card"><p class="analysis-title">최근 성적 업데이트</p><p class="sub" style="margin:0">선택한 시험 기준으로 결과가 연동됩니다.</p></div>${modal}`, false);
}
