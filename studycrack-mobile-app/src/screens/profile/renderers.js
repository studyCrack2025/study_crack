import { EXAM_OPTIONS } from '../../constants/options.js';
import { RANKING_MOCK } from '../../constants/ranking.js';

const GRADE_STATUS_OPTIONS = ['고1/2 재학', '고3 재학', 'N수생', '검정고시', '기타'];
const TRACK_OPTIONS = ['예체능', '인문사회', '상경계열', '자연/공학', '의치한약수', '간호', '사범/교대', '기타'];
const RANKING_PERIODS = [
  ['daily', '일간'],
  ['weekly', '주간'],
  ['monthly', '월간']
];

function defaultTierClass(tier = '') {
  return tier.toLowerCase();
}

function renderGradeButtons(obGradeStatus = '') {
  return GRADE_STATUS_OPTIONS.map((grade) => `<button class="ob1-pill ${obGradeStatus === grade ? 'active' : ''}" data-action="setObGradeStatus" data-ob-grade="${grade}">${grade}</button>`).join('');
}

function renderTrackOptions(obTrack = '') {
  return TRACK_OPTIONS.map((track) => `<option value="${track}" ${obTrack === track ? 'selected' : ''}>${track}</option>`).join('');
}

function renderExamOptions(scoreExamType = '') {
  return EXAM_OPTIONS.map((label) => `<option value="${label}" ${scoreExamType === label ? 'selected' : ''}>${label}</option>`).join('');
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
