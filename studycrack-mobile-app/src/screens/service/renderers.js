import { renderModal } from '../../components/modal.js';
import { CRACKY_SRC } from '../../constants/assets.js';
import { PLAN_META } from '../../constants/plans.js';

function defaultIcon() {
  return '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeExternalUrl(value) {
  const text = String(value || '').trim();
  return /^https?:\/\//i.test(text) ? text : '';
}

function renderCoachingSheet(ctx) {
  const {
    coachingSheetOpen = false,
    coachingSubmitting = false,
    coachingStep = 1,
  } = ctx;

  if (!coachingSheetOpen) return '';

  const submitLabel = coachingSubmitting ? '제출 중' : '작성 완료 및 제출';
  return `<div class="coach-sheet-overlay" data-action="closeCoachingSheet">
          <section class="coach-sheet" data-action="noopModal">
            <div class="coach-sheet-head"><div><h3>이번 주 학습점검</h3><p>${coachingStep} / 8 단계</p></div><button class="coach-close" data-action="closeCoachingSheet">✕</button></div>
            <div class="coach-sheet-body">${renderCoachingStepBody(ctx)}</div>
            <div class="coach-sheet-footer"><button class="btn btn-secondary" data-action="coachingPrev" ${coachingStep === 1 || coachingSubmitting ? 'disabled' : ''}>이전</button><button class="btn btn-primary" data-action="coachingNext" ${coachingSubmitting ? 'disabled' : ''}>${coachingStep === 8 ? submitLabel : '다음 단계'}</button></div>
          </section>
        </div>`;
}

function renderCoachingStepBody(ctx) {
  const {
    coachingAnswers = {},
    coachingDropReasons = [],
    coachingExamFiles = [],
    coachingExamScores = {},
    coachingExamType = '',
    coachingPlannerFiles = [],
    coachingStep = 1,
    coachingSubjectRows = [],
    coachingTrend = ''
  } = ctx;

  if (coachingStep === 1) {
    return `<div class="coach-step-body"><h4>1. 과목별 학습 달성률 <span style="color:#ef4444">*</span></h4><p class="sub">과목별 구체적인 과목명과 시간을 입력하세요.</p>
        <div class="coach-subject-list">
          ${coachingSubjectRows.map((row) => {
            const planned = Number(row.planned) || 0;
            const actual = Number(row.actual) || 0;
            const rate = planned > 0 ? Math.min(999, Math.round((actual / planned) * 100)) : 0;
            return `<div class="coach-subject-card">
              <div class="coach-subject-head"><b>${escapeHtml(row.subject || '기타')}</b>${row.removable ? `<button class="coach-delete-btn" data-action="removeCoachingSubject" data-coach-row="${escapeHtml(row.id)}">삭제</button>` : ''}</div>
              <input class="planner-input" data-coach-detail="${escapeHtml(row.id)}" value="${escapeHtml(row.detail || '')}" placeholder="${escapeHtml(row.placeholder || '세부과목 입력')}" />
              <div class="coach-hours-row">
                <input class="planner-input" data-coach-plan="${escapeHtml(row.id)}" value="${escapeHtml(row.planned || '')}" type="number" placeholder="계획(H)" />
                <input class="planner-input" data-coach-actual="${escapeHtml(row.id)}" value="${escapeHtml(row.actual || '')}" type="number" placeholder="실제(H)" />
                <div class="coach-rate-box" data-coach-rate="${escapeHtml(row.id)}">달성률 ${rate}%</div>
              </div>
            </div>`;
          }).join('')}
        </div>
        <button class="btn btn-secondary" data-action="addCoachingSubject">+ 새로운 과목 추가</button>
      </div>`;
  }

  if (coachingStep === 2) {
    return `<div class="coach-step-body"><h4>2. 플래너 인증</h4><p class="sub">사진 첨부는 선택 사항입니다. 첨부 파일 저장은 추후 웹 업로드 플로우와 연결됩니다.</p>
        <div class="coach-upload-box"><p>파일/사진 첨부 박스</p><input type="file" class="coach-hidden-file" data-field="coachPlannerFiles" accept="image/*" multiple /><button class="btn btn-secondary" data-action="openPlannerFilePicker">사진 추가하기</button></div>
        <div class="coach-thumb-list">${coachingPlannerFiles.length ? `<p class="sub">사진 ${coachingPlannerFiles.length}장 선택됨</p>${coachingPlannerFiles.map((file, idx) => `<div class="coach-thumb"><span>${escapeHtml(file.name || `사진 ${idx + 1}`)}</span><button data-action="removePlannerPhoto" data-photo-index="${idx}">삭제</button></div>`).join('')}` : '<p class="sub">선택된 사진이 없습니다.</p>'}</div>
      </div>`;
  }

  if (coachingStep === 3) {
    const examTypes = ['미응시', '교내', '평가원/교육청', '사설'];
    return `<div class="coach-step-body"><h4>3. 모의고사 응시 여부 <span style="color:#ef4444">*</span></h4><p class="sub">이번 주 사설 모의고사 또는 학력평가를 응시했나요?</p>
        <div class="coach-choice-row">${examTypes.map((type) => `<button class="planner-pill ${coachingExamType === type ? 'active' : ''}" data-action="setCoachingExamType" data-coach-exam="${type}">${type}</button>`).join('')}</div>
        ${coachingExamType && coachingExamType !== '미응시' ? `<div class="coach-exam-form">
          <input type="file" class="coach-hidden-file" data-field="coachExamFiles" accept="image/*" multiple /><button class="btn btn-secondary" data-action="openExamFilePicker">성적 인증 사진 첨부</button>
          <div class="coach-thumb-list">${coachingExamFiles.length ? `<p class="sub">사진 ${coachingExamFiles.length}장 선택됨</p>${coachingExamFiles.map((file, idx) => `<div class="coach-thumb"><span>${escapeHtml(file.name || `사진 ${idx + 1}`)}</span><button data-action="removeExamPhoto" data-photo-index="${idx}">삭제</button></div>`).join('')}` : '<p class="sub">선택된 사진이 없습니다.</p>'}</div>
          <div class="coach-exam-subject-list">
            <section class="coach-exam-subject-card"><h5>국어</h5><input class="planner-input" data-coach-field="koreanType" value="${escapeHtml(coachingExamScores.koreanType || '')}" placeholder="선택과목" /><input class="planner-input" data-coach-field="koreanRaw" value="${escapeHtml(coachingExamScores.koreanRaw || '')}" placeholder="원점수" /></section>
            <section class="coach-exam-subject-card"><h5>수학</h5><input class="planner-input" data-coach-field="mathType" value="${escapeHtml(coachingExamScores.mathType || '')}" placeholder="선택과목" /><input class="planner-input" data-coach-field="mathRaw" value="${escapeHtml(coachingExamScores.mathRaw || '')}" placeholder="원점수" /></section>
            <section class="coach-exam-subject-card"><h5>영어</h5><input class="planner-input" data-coach-field="englishGrade" value="${escapeHtml(coachingExamScores.englishGrade || '')}" placeholder="등급" /></section>
            <section class="coach-exam-subject-card"><h5>탐구1</h5><input class="planner-input" data-coach-field="inq1Name" value="${escapeHtml(coachingExamScores.inq1Name || '')}" placeholder="과목명" /><input class="planner-input" data-coach-field="inq1Raw" value="${escapeHtml(coachingExamScores.inq1Raw || '')}" placeholder="원점수" /></section>
            <section class="coach-exam-subject-card"><h5>탐구2</h5><input class="planner-input" data-coach-field="inq2Name" value="${escapeHtml(coachingExamScores.inq2Name || '')}" placeholder="과목명" /><input class="planner-input" data-coach-field="inq2Raw" value="${escapeHtml(coachingExamScores.inq2Raw || '')}" placeholder="원점수" /></section>
          </div>
        </div>` : ''}
      </div>`;
  }

  if (coachingStep === 4) {
    const reasons = ['계획 과다', '실전 감각 저하', '컨디션/건강', '기타'];
    return `<div class="coach-step-body"><h4>4. 최근 2주 학업 추이 <span style="color:#ef4444">*</span></h4><p class="sub">최근 2주간 학습 흐름이 어땠나요?</p>
        <div class="coach-choice-row">${['상승', '유지', '하락'].map((v) => `<button class="planner-pill ${coachingTrend === v ? 'active' : ''}" data-action="setCoachingTrend" data-coach-trend="${v}">${v}</button>`).join('')}</div>
        ${coachingTrend === '하락' ? `<div class="coach-drop-box"><p class="sub">하락 원인 (중복 선택 가능)</p><div class="coach-choice-row">${reasons.map((reason) => `<button class="planner-pill ${coachingDropReasons.includes(reason) ? 'active' : ''}" data-action="toggleDropReason" data-drop-reason="${reason}">${reason}</button>`).join('')}</div><textarea class="planner-input coach-textarea" data-coach-answer="step4Reason" maxlength="200" placeholder="구체적인 이유를 간단히 적어주세요.">${escapeHtml(coachingAnswers.step4Reason || '')}</textarea><p class="coach-count" data-coach-count="step4Reason">${(coachingAnswers.step4Reason || '').length}/200</p></div>` : ''}
      </div>`;
  }

  const stepMap = {
    5: ['5. 학습 계획 점검', '현재 세우고 있는 계획의 문제점이나 확신이 없는 부분을 적어주세요.', 'step5', '예: 하루 14시간 계획을 세우는데 자꾸 밀립니다. 현실적인 수정이 필요합니다.'],
    6: ['6. 학습 방향성 설정', '현재 공부하고 있는 방향이 맞는지, 입시 전략과 일치하는지 고민을 적어주세요.', 'step6', '예: 정시 파이터인데 내신 기간에 수능 공부 밸런스를 어떻게 잡아야 할까요?'],
    7: ['7. 튜터에게 묻고 싶은 질문', '이번 주 피드백에서 꼭 답변받고 싶은 질문을 적어주세요.', 'step7', '예: 수학은 기출을 반복하는 게 나을까요, N제를 늘리는 게 나을까요?'],
    8: ['8. 기타 멘탈 관리', '슬럼프, 불안감 등 학습 외적인 고민이 있다면 자유롭게 적어주세요.', 'step8', '자유롭게 작성해주세요.']
  };
  const [title, desc, key, placeholder] = stepMap[coachingStep] || stepMap[8];
  const value = coachingAnswers[key] || '';
  return `<div class="coach-step-body"><h4>${title}</h4><p class="sub">${desc}</p><textarea class="planner-input coach-textarea" data-coach-answer="${key}" maxlength="200" placeholder="${placeholder}">${escapeHtml(value)}</textarea><p class="coach-count" data-coach-count="${key}">${value.length}/200</p></div>`;
}

function formatReportKeyLabel(key = '') {
  const value = String(key || '').trim();
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return value || 'PRO 리포트';
  return `20${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}주차`;
}

function reportStatusLabel(report = {}) {
  const status = String(report.status || '').toLowerCase();
  if ((status === 'published' || status === 'sent') && report.reportLink) return '다운로드 가능';
  if (status === 'tutor_review') return '튜터 검수 중';
  if (status === 'drafting') return '작성 중';
  return '준비 중';
}

function formatWeekIdLabel(weekId = '') {
  const value = String(weekId || '').trim();
  const match = value.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return value || '주간 점검';
  return `20${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}주차`;
}

function hasSubmittedFeedback(report = {}) {
  return report?.tutorFeedback?.submitted === true;
}

function renderWeeklyRows({ reports = [] }) {
  if (!reports.length) return '<div class="coach-empty">아직 제출된 주간 점검이 없습니다.</div>';
  return reports.map((report) => {
    const done = hasSubmittedFeedback(report);
    return `<button class="coach-report-card" data-action="goto" data-target="weekly"><div><b>${escapeHtml(formatWeekIdLabel(report.weekId))}</b><p>${done ? '튜터 피드백 도착' : '피드백 대기 중'}</p></div><div class="coach-report-side"><span class="badge coach-pdf-badge">${done ? '완료' : '대기'}</span><span class="coach-report-arrow">›</span></div></button>`;
  }).join('');
}

function renderReportRows({ icon = defaultIcon, reports = [] }) {
  if (!reports.length) return '<div class="coach-empty">아직 발행된 PRO 리포트가 없습니다.</div>';
  return reports.map((report) => {
    const reportLink = safeExternalUrl(report.reportLink);
    const ready = !!reportLink && ['published', 'sent'].includes(String(report.status || '').toLowerCase());
    return `<button class="report-row" data-action="downloadProReport" data-pdf-path="${ready ? escapeHtml(reportLink) : ''}" data-pdf-name="studycrack-pro-report-${escapeHtml(report.key || 'latest')}.pdf"><div><b>${escapeHtml(formatReportKeyLabel(report.key))}</b><p>${reportStatusLabel(report)}</p></div><span>${ready ? 'PDF' : icon('chevron', false)}</span></button>`;
  }).join('');
}

function renderProRequestModal(ctx) {
  const {
    proRequestModalOpen = false,
    proRequestSubmitting = false,
    proRequestText = ''
  } = ctx;

  if (!proRequestModalOpen) return '';

  const body = `<div class="pro-request-head"><h4>✈ 전략 보고서 요청</h4><button class="pro-request-close" data-action="closeProRequestModal">✕</button></div><div class="pro-request-body"><p>현재 학습 상황이나 고민, 특별히 분석받고 싶은 내용을 적어주세요.</p><p>담당 컨설턴트가 이를 반영하여 <b>최적의 전략</b>을 수립합니다.</p><label>요청 사항 (500자 이내)</label><textarea data-field="proRequestText" maxlength="500" placeholder="예: 6월 모평 대비 수학 기하 과목 집중 전략이 필요합니다. 최근 실전 문제 풀이에서 시간이 부족해 고민입니다.">${escapeHtml(proRequestText)}</textarea><div class="pro-request-count">${proRequestText.length}/500</div><div class="pro-request-actions"><button class="cancel" data-action="closeProRequestModal">취소</button><button class="submit" data-action="submitProRequest" ${proRequestSubmitting ? 'disabled' : ''}>${proRequestSubmitting ? '제출 중' : '요청서 제출하기'}</button></div>`;
  return renderModal({ panelClass: 'pro-request-modal', dismissAction: 'closeProRequestModal', body });
}

function formatQnaDate(value = '') {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function qnaStatusLabel(status = '') {
  if (String(status).toLowerCase() === 'done') return '답변 완료';
  if (String(status).toLowerCase() === 'read') return '확인 중';
  return '답변 대기';
}

function renderQnaComposerModal(ctx) {
  const {
    qnaComposerOpen = false,
    qnaDraftContent = '',
    qnaDraftTitle = '',
    qnaSubmitting = false
  } = ctx;

  if (!qnaComposerOpen) return '';

  const body = `<div class="qna-modal-head"><h4>새 질문 작성</h4><button class="qna-modal-close" data-action="closeQnaComposer">✕</button></div><div class="qna-modal-body"><label>질문 제목</label><input class="planner-input" data-field="qnaDraftTitle" value="${escapeHtml(qnaDraftTitle)}" maxlength="80" placeholder="예: 수학 기출 복습 순서가 고민이에요"/><label>질문 내용</label><textarea class="planner-input qna-textarea" data-field="qnaDraftContent" maxlength="1000" placeholder="현재 상황과 궁금한 점을 구체적으로 적어주세요.">${escapeHtml(qnaDraftContent)}</textarea><div class="qna-modal-actions"><button class="btn btn-secondary" data-action="closeQnaComposer">취소</button><button class="btn btn-primary" data-action="submitMobileQna" ${qnaSubmitting ? 'disabled' : ''}>${qnaSubmitting ? '등록 중' : '질문 등록'}</button></div></div>`;
  return renderModal({ panelClass: 'qna-modal', dismissAction: 'closeQnaComposer', body });
}

function renderPlanCard({ meta, plan, selectedPlan, variant }) {
  const active = selectedPlan === plan;
  const badge = plan === 'Standard' ? '<span class="badge">추천</span>' : plan === 'Pro' ? '<span class="badge">최고 효율</span>' : '';
  const features = variant === 'intro'
    ? plan === 'Basic'
      ? ['합격 가능성 분석', '대학별 전략 확인']
      : plan === 'Standard'
        ? ['플래너 피드백', '학습 방향 코칭']
        : ['모든 기능 무제한 이용', '프로 보고서 2주 1회', 'Sky튜터 1:1 피드백']
    : meta.features;

  return `<button class="plan-card ${plan.toLowerCase()} ${active ? 'active' : ''}" data-action="selectPlan" data-plan="${plan}"><div class="plan-head"><h4>${plan}</h4>${badge}</div><p class="plan-price">${meta.introPrice}</p><ul>${features.map((item) => `<li>${item}</li>`).join('')}</ul></button>`;
}

export function renderStrategyScreen(ctx) {
  const {
    coachingSubmitted = false,
    layout,
    weeklyReports = [],
    weeklyReportsStatus = 'idle'
  } = ctx;
  const latest = weeklyReports[0] || null;
  const submitted = coachingSubmitted || !!latest;
  const feedbackReady = weeklyReports.some(hasSubmittedFeedback);
  const weeklyList = weeklyReportsStatus === 'loading'
    ? '<div class="coach-empty">주간 점검을 불러오는 중입니다.</div>'
    : renderWeeklyRows({ reports: weeklyReports });

  return layout(
    `<div class="coach-page">
        <div class="card coach-title-card"><div class="top-card-head"><div><h3>학습 코칭</h3><p>주간 학습 계획을 점검하고, 튜터의 피드백을 받아보세요.</p></div><span class="top-infographic top-infographic-coach" aria-hidden="true"><i></i><i></i><i></i></span></div></div>
        <div class="card coach-status-card">
          <div class="coach-row"><h4>이번 주 학습 점검 & 코칭 요청</h4><span class="badge ${submitted ? 'coach-submitted' : ''}">${submitted ? '제출 이력 있음' : '미제출'}</span></div>
          <p>이번 주 학습 달성률과 고민을 작성하면 튜터가 피드백을 제공해요.</p>
          <small>매주 일요일 20:00 마감</small>
          <button class="btn btn-primary" data-action="openCoachingSheet">${submitted ? '이번 주 점검 작성/수정' : '코칭 요청하기'}</button>
        </div>
        <div class="card coach-feedback-card">
          <div class="coach-row"><h4>주간학습 피드백</h4><span class="badge ${feedbackReady ? 'coach-submitted' : ''}">${feedbackReady ? '도착' : '대기'}</span></div>
          <p>제출한 주간 점검과 튜터가 최종 제출한 피드백만 표시됩니다.</p>
          <div class="coach-report-list">${weeklyList}</div>
        </div>
        ${renderCoachingSheet(ctx)}
      </div>`,
    true
  );
}

export function renderWeeklyScreen(ctx) {
  const {
    crackySrc = CRACKY_SRC,
    icon = defaultIcon,
    layout,
    weeklyReports = []
  } = ctx;
  const latest = weeklyReports[0] || null;
  const fb = latest?.tutorFeedback || {};
  if (!latest) {
    return layout(
      `<div class="weekly-head"><button class="weekly-back" data-action="back">←</button><h3>주간 점검</h3><span></span></div>
       <div class="card weekly-feedback"><p class="sub" style="margin:0 0 10px;">주간 점검 기록이 없습니다.</p><div class="feedback-item">${icon('check', true)}학습 코칭 화면에서 이번 주 점검을 제출하면 이곳에 피드백이 표시됩니다.</div><img loading="lazy" decoding="async" src="${escapeHtml(crackySrc)}" class="weekly-char crackie" alt="크랙이"/></div>
       <div class="cta-wrapper"><button class="btn btn-primary weekly-next cta-btn" data-action="goto" data-target="strategy">학습 코칭으로 이동</button></div>`,
      true
    );
  }

  const done = hasSubmittedFeedback(latest);
  const feedbackItems = done
    ? [
      fb.weeklyPlanner ? `이번 주 플래너: ${fb.weeklyPlanner}` : '',
      fb.planReason ? `계획 이유: ${fb.planReason}` : '',
      fb.questionAnswer ? `질문 답변: ${fb.questionAnswer}` : '',
      fb.tutorComment ? `튜터 총평: ${fb.tutorComment}` : '',
      fb.nextWeekTop3 ? `다음 주 TOP3: ${fb.nextWeekTop3}` : '',
      fb.planEvaluation ? `플랜 평가: ${fb.planEvaluation}` : ''
    ].filter(Boolean)
    : ['튜터가 피드백을 최종 제출하면 이곳에 표시됩니다.'];

  return layout(
    `<div class="weekly-head"><button class="weekly-back" data-action="back">←</button><h3>주간 점검</h3><span></span></div>
       <p class="weekly-range">${escapeHtml(formatWeekIdLabel(latest.weekId))}</p>
       <div class="card weekly-rate"><div><p class="sub">피드백 상태</p><h2>${done ? '도착' : '대기'}</h2></div><span class="badge">${escapeHtml(latest.tutorName || '튜터 확인 중')}</span></div>
       <div class="card weekly-feedback">
         <p class="sub" style="margin:0 0 10px;">주간 요약 피드백</p>
         ${feedbackItems.map((item) => `<div class="feedback-item">${icon('check', true)}${escapeHtml(item)}</div>`).join('')}
         <img loading="lazy" decoding="async" src="${escapeHtml(crackySrc)}" class="weekly-char crackie" alt="크랙이"/>
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary weekly-next cta-btn" data-action="goto" data-target="planner">다음 주 계획 세우기</button></div>`,
    true
  );
}

export function renderReportScreen(ctx) {
  const {
    icon = defaultIcon,
    layout,
    proReports = [],
    proReportsStatus = 'idle'
  } = ctx;
  const statusText = proReportsStatus === 'loading'
    ? '<div class="coach-empty">PRO 리포트를 불러오는 중입니다.</div>'
    : renderReportRows({ icon, reports: proReports });

  return layout(
    `<span class="badge">프로 플랜 전용</span>
       <p class="report-desc">2주에 한 번, 내 맞춤 분석 리포트 제공</p>
       <div class="card report-main"><p class="sub">리포트 상태</p><p class="report-date">${proReports.length ? '발행 이력 있음' : '발행 대기 중'}</p><h2>${proReports.length}</h2></div>
       <div class="card report-list"><p class="sub">이전 보고서</p>
         ${statusText}
       </div>
       <div class="cta-wrapper"><button class="btn btn-primary report-sample cta-btn" data-action="openProRequestModal">전략 리포트 요청하기</button></div>${renderProRequestModal(ctx)}`,
    true
  );
}

export function renderReportDetailScreen({ appbar, layout }) {
  return layout(appbar('종합 분석 리포트', true) + '<div class="card report-detail-card"><p class="sub">모바일 앱에서는 실제 발행된 PDF 리포트만 확인할 수 있습니다.</p><p class="report-detail-text">PRO 리포트 목록에서 다운로드 가능한 항목을 선택해주세요.</p></div>', false);
}

export function renderProEliteScreen(ctx) {
  const {
    appbar,
    layout,
    proReports = [],
    proReportsStatus = 'idle'
  } = ctx;
  const reportList = proReportsStatus === 'loading'
    ? '<div class="coach-empty">PRO 리포트를 불러오는 중입니다.</div>'
    : (proReports.length
      ? proReports.map((report) => {
        const reportLink = safeExternalUrl(report.reportLink);
        const ready = !!reportLink && ['published', 'sent'].includes(String(report.status || '').toLowerCase());
        return `<button class="pro-elite-item" data-action="downloadProReport" data-pdf-path="${ready ? escapeHtml(reportLink) : ''}" data-pdf-name="studycrack-pro-report-${escapeHtml(report.key || 'latest')}.pdf"><div><b>${escapeHtml(formatReportKeyLabel(report.key))} PRO 리포트</b><p>${reportStatusLabel(report)}</p></div><span class="pro-elite-download">${ready ? 'PDF 다운로드' : '준비 중'}</span></button>`;
      }).join('')
      : '<div class="coach-empty">아직 발행된 PRO 리포트가 없습니다.</div>');

  return layout(appbar('PRO EXCLUSIVE', true) + `<div class="pro-elite-page"><div class="pro-elite-hero"><span class="pro-elite-badge">TOP 1%</span><h3>상위 1%를 위한<br/>중장기 집중 맞춤 솔루션</h3><p>발행된 프리미엄 전략 리포트를 확인하세요.</p></div><div class="pro-elite-list">${reportList}</div><div class="pro-elite-request-bottom"><button class="pro-request-btn" data-action="openProRequestModal"><i class="spark">✦</i><span>전략 리포트 요청하기</span></button></div>${renderProRequestModal(ctx)}</div>`, false);
}

export function renderTutorScreen(ctx) {
  const {
    appbar,
    layout,
    qnaHistory = [],
    qnaStatus = 'idle'
  } = ctx;
  const statusNode = qnaStatus === 'loading'
    ? '<div class="coach-empty">질문 내역을 불러오는 중입니다.</div>'
    : qnaStatus === 'error'
      ? '<div class="coach-empty">질문 내역을 불러오지 못했습니다.</div>'
      : qnaHistory.length
        ? qnaHistory.map((item) => {
          const done = String(item.status || '').toLowerCase() === 'done';
          const created = formatQnaDate(item.createdAt);
          return `<article class="qna-card"><div class="qna-card-head"><div><b>${escapeHtml(item.title)}</b>${created ? `<span>${escapeHtml(created)}</span>` : ''}</div><em class="${done ? 'done' : ''}">${qnaStatusLabel(item.status)}</em></div><p class="qna-question">${escapeHtml(item.content)}</p>${done && item.answer ? `<div class="qna-answer"><strong>튜터 답변</strong><p>${escapeHtml(item.answer)}</p>${item.answeredAt ? `<span>${escapeHtml(formatQnaDate(item.answeredAt))}</span>` : ''}</div>` : ''}</article>`;
        }).join('')
        : '<div class="coach-empty">아직 남긴 질문이 없습니다.</div>';

  return layout(appbar('SKY튜터 1:1 피드백', true) + `<div class="tutor-qna-page"><div class="card qna-intro-card"><p class="sub">텍스트 기반 질의응답</p><h3>학습 고민을 남기면 튜터가 답변해요</h3><button class="btn btn-primary" data-action="openQnaComposer">새 질문 작성</button></div><div class="qna-list">${statusNode}</div>${renderQnaComposerModal(ctx)}</div>`, false);
}

export function renderProIntroScreen(ctx) {
  const {
    appbar,
    checkoutPlan = 'Standard',
    layout,
    planMeta = PLAN_META
  } = ctx;

  return layout(appbar('StudyCrack 요금제', true) + `<p class="sub pricing-sub">합격 전략, 단계별로 선택하세요</p>
      <div class="plan-stack">
        ${renderPlanCard({ meta: planMeta.Basic, plan: 'Basic', selectedPlan: checkoutPlan, variant: 'intro' })}
        ${renderPlanCard({ meta: planMeta.Standard, plan: 'Standard', selectedPlan: checkoutPlan, variant: 'intro' })}
        ${renderPlanCard({ meta: planMeta.Pro, plan: 'Pro', selectedPlan: checkoutPlan, variant: 'intro' })}
      </div>
      <div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="goto" data-target="payment">결제하기</button></div>`, false);
}

export function renderPaymentScreen(ctx) {
  const {
    appbar,
    checkoutPlan = 'Standard',
    currentPlan,
    duration = '4주',
    layout,
    planMeta = PLAN_META
  } = ctx;
  const activePlan = currentPlan || planMeta[checkoutPlan] || planMeta.Standard;

  return layout(appbar('플랜 선택', true) + `<div class="payment-tabs full">
      <button class="${checkoutPlan === 'Basic' ? 'active' : ''}" data-action="selectPlan" data-plan="Basic">Basic</button>
      <button class="${checkoutPlan === 'Standard' ? 'active' : ''}" data-action="selectPlan" data-plan="Standard">Standard</button>
      <button class="${checkoutPlan === 'Pro' ? 'active' : ''}" data-action="selectPlan" data-plan="Pro">Pro</button>
    </div>
      <div class="card payment-focus-card"><div class="payment-focus-head"><div><h3>${checkoutPlan}</h3><p>${activePlan.payPrice}</p></div></div><p class="payment-desc">${activePlan.desc}</p><ul class="payment-check-list">${activePlan.features.map((item) => `<li>${item}</li>`).join('')}</ul></div>
      <div class="duration-row payment-duration-row">
        <button class="${duration === '4주' ? 'active' : ''}" data-action="selectDuration" data-duration="4주">4주</button>
        <button class="${duration === '8주' ? 'active' : ''}" data-action="selectDuration" data-duration="8주">8주</button>
        <button class="${duration === '12주' ? 'active' : ''}" data-action="selectDuration" data-duration="12주">12주</button>
      </div>
      <div class="card payment-focus-card"><p class="sub" style="margin:0">결제는 기존 웹 결제 페이지에서 전화번호 확인, 할인/결제 정보 입력, NICEPAY 인증을 거쳐 진행됩니다.</p></div>
      <div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="openWebPayment">웹 결제 페이지로 이동</button></div>`, false);
}

export function renderPaymentCompleteScreen(ctx) {
  const {
    icon = defaultIcon,
    layout
  } = ctx;

  return layout(`<div class="payment-done-screen"><div class="payment-complete-wrap"><div class="payment-check">${icon('check', true)}</div><p class="title payment-complete-title">결제 확인은 웹 결제 페이지에서 진행됩니다</p><p class="sub payment-complete-sub">모바일 앱 내부에서는 결제 완료를 임의로 처리하지 않습니다.</p><div class="card payment-complete-note"><b>안전한 결제 안내</b><p>전화번호 확인과 NICEPAY 인증을 위해 기존 웹 결제 페이지로 이동해주세요.</p></div></div><div class="cta-wrapper payment-cta"><button class="btn btn-primary cta-btn" data-action="openWebPayment">웹 결제 페이지로 이동</button></div></div>`, false);
}
