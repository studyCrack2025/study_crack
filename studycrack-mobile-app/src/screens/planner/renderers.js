import { renderSheet } from '../../components/sheet.js';
import { buildPlannerPresentation } from './presentation.js';

const PLANNER_SUBJECTS = ['수학', '국어', '영어', '탐구', '기타'];
const PLANNER_DURATIONS = [
  ['30', '30분'],
  ['60', '60분'],
  ['90', '90분'],
  ['120', '120분'],
  ['custom', '직접 입력']
];

function activeClass(value) {
  return value ? 'active' : '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderDateStrip({ plannerWeekDates = [], selectedPlannerDateKey = '' }) {
  return `<div class="planner-days planner-days-carousel planner-date-strip">${plannerWeekDates.map(({ date, day, weekday, empty }) => `<button class="planner-date-item ${empty ? 'is-empty' : ''} ${activeClass(selectedPlannerDateKey === date)}" ${empty ? 'disabled' : 'data-action="selectPlannerDate"'} data-planner-date="${date || ''}"><small>${weekday}</small><strong>${day}</strong></button>`).join('')}</div>`;
}

function renderPlannerItemCard(item) {
  const timeLabel = item.start && item.end && item.start !== '--:--' && item.end !== '--:--'
    ? `${item.start} - ${item.end}`
    : `${item.minutes}분`;
  const detailLabel = [item.subject, item.detailSubject, item.activityType].filter(Boolean).join(' · ') || '학습 계획';
  const plannerId = escapeHtml(item.id);
  return `<article class="planner-item planner-item-v2 ${item.done ? 'done' : ''}" data-action="openPlannerEdit" data-planner-id="${plannerId}"><span class="planner-item-subject ${escapeHtml(item.dot || 'etc')}" aria-hidden="true"><i></i></span><div class="planner-item-main"><small class="planner-item-time">${escapeHtml(timeLabel)}</small><b>${escapeHtml(item.content)}</b><p>${escapeHtml(detailLabel)}</p></div><div class="planner-item-actions"><span>${escapeHtml(item.minutes)}분</span><div><button type="button" class="planner-item-done" data-action="togglePlannerDone" data-planner-id="${plannerId}" aria-label="${item.done ? '완료 취소' : '계획 완료'}"><i aria-hidden="true">✓</i></button><button type="button" class="planner-item-remove" data-action="removePlannerItem" data-planner-id="${plannerId}" aria-label="계획 삭제">×</button></div></div></article>`;
}

function renderPlannerItems({ plannerViewItems = [], selectedPlannerDate = '' }) {
  const items = plannerViewItems.map(renderPlannerItemCard).join('');
  return `<section class="planner-tasks-section"><div class="planner-section-head"><div><span>${escapeHtml(selectedPlannerDate)}일</span><h4>학습 계획</h4></div><button type="button" data-action="openPlannerAddPage" aria-label="계획 추가">+</button></div><div class="planner-plan-list">${items || '<div class="planner-empty-day"><b>아직 등록한 계획이 없어요</b><p>실행할 과목과 시간을 추가해 하루 목표를 만들어 보세요.</p></div>'}<button type="button" class="planner-add-cta" data-action="openPlannerAddPage">${escapeHtml(selectedPlannerDate)}일 계획 추가</button></div></section>`;
}

function renderPlannerProgress(plannerViewItems = []) {
  const presentation = buildPlannerPresentation(plannerViewItems);
  const status = presentation.remainingCount ? `${presentation.remainingCount}개 남음` : presentation.totalCount ? '모두 완료' : '계획 대기';
  return `<section class="card planner-progress-card"><div class="planner-progress-head"><div><span>오늘 진도</span><h4>${presentation.progress}% 완료</h4></div><b>${status}</b></div><div class="planner-progress-track" aria-label="플래너 완료율 ${presentation.progress}%"><i style="width:${presentation.progress}%"></i></div><div class="planner-progress-stats"><div><span>완료 계획</span><b>${presentation.completedCount}/${presentation.totalCount}</b></div><div><span>완료 시간</span><b>${presentation.completedDurationLabel}</b></div><div><span>총 계획</span><b>${presentation.totalDurationLabel}</b></div></div></section>`;
}

function renderPlannerFeedback({ plannerFeedback = {}, hasItems = false }) {
  const warning = plannerFeedback.tone === 'warn';
  const title = warning ? '과목 균형을 한 번 점검해 보세요' : hasItems ? '이번 주 계획을 함께 점검해요' : '계획을 만들면 피드백을 받을 수 있어요';
  const description = plannerFeedback.message || (warning ? '특정 과목에 시간이 몰려 있어 우선순위 조정이 필요해요.' : '주간 계획과 실행 기록을 바탕으로 다음 학습 방향을 정리합니다.');
  return `<section class="card planner-feedback-card"><div class="planner-feedback-copy"><span>SKY MENTOR</span><h4>${escapeHtml(title)}</h4><p>${escapeHtml(description)}</p></div><button type="button" data-action="goto" data-target="weekly">주간 피드백 보기 <b aria-hidden="true">›</b></button></section>`;
}

function renderPlannerCalendarModeButton(mode, label, activeMode) {
  return `<button type="button" class="${activeClass(activeMode === mode)}" data-action="setPlannerCalendarMode" data-planner-calendar-mode="${mode}">${label}</button>`;
}

function renderInlinePlannerCalendar({
  plannerCalendarMode = 'week',
  plannerCalendarMonthCells = [],
  plannerWeekDates = [],
  selectedPlannerDateKey = ''
}) {
  const mode = ['week', 'month'].includes(plannerCalendarMode) ? plannerCalendarMode : 'week';
  const body = mode === 'month'
    ? renderPlannerCalendarMonth({ plannerCalendarMonthCells })
    : renderDateStrip({ plannerWeekDates, selectedPlannerDateKey });
  return `<section class="card planner-calendar-card"><div class="planner-inline-calendar-toolbar"><div class="planner-calendar-segment planner-inline-segment">${renderPlannerCalendarModeButton('week', '주', mode)}${renderPlannerCalendarModeButton('month', '월', mode)}</div><div class="planner-inline-calendar-nav"><button type="button" data-action="plannerCalendarPrevWeek" aria-label="${mode === 'month' ? '이전 달' : '이전 주'}">‹</button><button type="button" data-action="plannerCalendarToday">오늘</button><button type="button" data-action="plannerCalendarNextWeek" aria-label="${mode === 'month' ? '다음 달' : '다음 주'}">›</button></div></div>${body}</section>`;
}

function renderPlannerCalendarDay({ plannerViewHour = 0, plannerViewItems = [], plannerViewMinute = 0, selectedPlannerDate = '' }) {
  const totalLabel = `${plannerViewHour ? `${plannerViewHour}시간 ` : ''}${plannerViewMinute}분`;
  const items = plannerViewItems.length
    ? plannerViewItems.map((item) => `<div class="planner-calendar-agenda-item"><span class="dot ${item.dot || 'etc'}"></span><div><b>${item.subject || '기타'}</b><p>${item.content || ''}</p></div><strong>${item.minutes || 0}분</strong></div>`).join('')
    : '<div class="planner-calendar-empty">이 날 등록된 계획이 없어요.</div>';
  return `<div class="planner-calendar-day-panel"><div class="planner-calendar-day-score"><span>${selectedPlannerDate}일</span><b>${plannerViewItems.length}개 계획</b><p>총 ${totalLabel}</p></div><div class="planner-calendar-agenda">${items}</div></div>`;
}

function renderPlannerCalendarWeek({ plannerCalendarWeekDates = [], selectedPlannerDateKey = '' }) {
  const hours = ['9 AM', '10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM'];
  const header = `<div class="planner-calendar-week-days">${plannerCalendarWeekDates.map((item) => {
    if (item.empty) return `<span class="planner-calendar-week-card is-empty"><small>${item.weekday}</small></span>`;
    return `<button type="button" class="planner-calendar-week-card ${activeClass(selectedPlannerDateKey === item.date)}" data-action="selectPlannerDate" data-planner-date="${item.date}"><small>${item.weekday}</small><b>${item.day}</b></button>`;
  }).join('')}</div>`;
  const rows = hours.map((hour, rowIdx) => `<div class="planner-calendar-time-row"><span>${hour}</span>${plannerCalendarWeekDates.map((item) => {
    const active = !item.empty && selectedPlannerDateKey === item.date;
    const hasAgenda = active && rowIdx === 0 && item.count;
    return `<button type="button" class="planner-calendar-time-cell ${active ? 'active' : ''}" ${item.empty ? '' : `data-action="selectPlannerDate" data-planner-date="${item.date}"`}>${hasAgenda ? `<em>${item.count}개 계획</em>` : ''}</button>`;
  }).join('')}</div>`).join('');
  return `<div class="planner-calendar-week-panel">${header}<div class="planner-calendar-time-grid">${rows}</div></div>`;
}

function renderPlannerCalendarMonth({ plannerCalendarMonthCells = [], selectedPlannerDate = '' }) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'].map((day) => `<span>${day}</span>`).join('');
  const cells = plannerCalendarMonthCells.map((cell) => {
    if (cell.blank) return `<span class="planner-calendar-month-day is-blank"></span>`;
    return `<button type="button" class="planner-calendar-month-day ${activeClass(cell.isSelected)} ${cell.isToday ? 'is-today' : ''}" data-action="selectPlannerDate" data-planner-date="${cell.date}"><b>${cell.day}</b>${cell.count ? `<span>${cell.count}</span>` : ''}</button>`;
  }).join('');
  return `<div class="planner-calendar-month-panel"><div class="planner-calendar-weekdays">${weekdays}</div><div class="planner-calendar-month-grid">${cells}</div></div>`;
}

function renderPlannerCalendarAgendaPanel({ plannerViewItems = [], plannerViewHour = 0, plannerViewMinute = 0, selectedPlannerDate = '' }) {
  const items = plannerViewItems.length
    ? plannerViewItems.map((item) => `<button type="button" class="planner-calendar-plan-row" data-action="openPlannerEdit" data-planner-id="${item.id}"><span class="planner-calendar-plan-icon ${item.dot || 'etc'}"></span><span><b>${item.content || item.subject || '학습 계획'}</b><small>${item.subject || '기타'} · ${item.minutes || 0}분</small></span><em>수정</em></button>`).join('')
    : `<div class="planner-calendar-plan-empty"><b>아직 등록한 계획이 없어요</b><small>${selectedPlannerDate}일에 계획을 추가해 보세요.</small></div>`;
  return `<section class="planner-calendar-agenda-panel"><div class="planner-calendar-agenda-head"><div><b>${selectedPlannerDate}일 상세 계획</b><small>총 ${plannerViewHour}시간 ${plannerViewMinute}분</small></div><button type="button" data-action="openPlannerAddPage">+ 추가</button></div><div class="planner-calendar-plan-list">${items}</div></section>`;
}

export function renderCalendarSheet({
  plannerCalendarMode = 'week',
  plannerCalendarMonthCells = [],
  plannerCalendarOpen = false,
  plannerCalendarWeekDates = [],
  plannerMonthLabel = '',
  plannerViewHour = 0,
  plannerViewItems = [],
  plannerViewMinute = 0,
  selectedPlannerDate = '',
  selectedPlannerDateKey = ''
}) {
  if (!plannerCalendarOpen) return '';
  const mode = ['week', 'month'].includes(plannerCalendarMode) ? plannerCalendarMode : 'week';
  const viewHtml = mode === 'month'
      ? renderPlannerCalendarMonth({ plannerCalendarMonthCells, selectedPlannerDate })
      : renderPlannerCalendarWeek({ plannerCalendarWeekDates, selectedPlannerDateKey });
  const agendaHtml = renderPlannerCalendarAgendaPanel({ plannerViewItems, plannerViewHour, plannerViewMinute, selectedPlannerDate });
  const body = `<div class="planner-calendar-grabber" aria-hidden="true"></div><div class="planner-calendar-head"><button type="button" class="planner-calendar-nav" data-action="plannerCalendarPrevWeek" aria-label="${mode === 'month' ? '이전 달' : '이전 주'}">‹</button><h3>${plannerMonthLabel}</h3><button type="button" class="planner-calendar-nav" data-action="plannerCalendarNextWeek" aria-label="${mode === 'month' ? '다음 달' : '다음 주'}">›</button></div><div class="planner-calendar-toolbar"><div class="planner-calendar-segment">${renderPlannerCalendarModeButton('week', '주', mode)}${renderPlannerCalendarModeButton('month', '월', mode)}</div><div class="planner-calendar-actions"><button type="button" data-action="plannerCalendarToday">오늘</button><button type="button" data-action="closePlannerCalendar">완료</button></div></div><div class="planner-calendar-scroll">${viewHtml}${agendaHtml}</div>`;
  return renderSheet({ overlayClass: 'planner-calendar-overlay', panelClass: 'planner-calendar-sheet', dismissAction: 'closePlannerCalendar', body });
}

export function renderEditSheet({ plannerEditIndex = null, plannerEditItem = null }) {
  if (plannerEditIndex === null) return '';
  const body = `<button class="planner-sheet-close" data-action="closePlannerEdit">✕</button><h3>플래너 항목 수정</h3><div class="planner-time-row"><div class="planner-sheet-block"><label>시작</label><input class="planner-input" data-field="plannerEditStart" type="time" value="${plannerEditItem?.start && plannerEditItem.start !== '--:--' ? plannerEditItem.start : ''}" /></div><div class="planner-sheet-block"><label>종료</label><input class="planner-input" data-field="plannerEditEnd" type="time" value="${plannerEditItem?.end && plannerEditItem.end !== '--:--' ? plannerEditItem.end : ''}" /></div></div><div class="planner-sheet-block"><label>과목</label><input class="planner-input" data-field="plannerEditSubject" value="${plannerEditItem?.subject || ''}" /></div><div class="planner-sheet-block"><label>세부 과목</label><input class="planner-input" data-field="plannerEditDetailSubject" value="${plannerEditItem?.detailSubject || ''}" /></div><div class="planner-sheet-block"><label>학습 유형</label><input class="planner-input" data-field="plannerEditActivityType" value="${plannerEditItem?.activityType || ''}" /></div><div class="planner-sheet-block"><label>세부 내용</label><input class="planner-input" data-field="plannerEditContent" value="${plannerEditItem?.content || ''}" /></div><div class="planner-sheet-block"><label>메모</label><input class="planner-input" data-field="plannerEditMemo" value="${plannerEditItem?.memo || ''}" /></div><button class="btn btn-primary" data-action="savePlannerEdit">수정 저장</button>`;
  return renderSheet({ dismissAction: 'closePlannerEdit', body });
}

function renderSubjectPills(plannerDraft = {}) {
  return PLANNER_SUBJECTS.map((subject) => `<button class="planner-pill ${activeClass(plannerDraft.subject === subject)}" data-action="setPlannerSubject" data-planner-subject="${subject}">${subject}</button>`).join('');
}

function renderDurationPills(plannerDraft = {}) {
  return PLANNER_DURATIONS.map(([duration, label]) => `<button class="planner-pill ${activeClass(plannerDraft.durationChoice === duration)}" data-action="setPlannerDuration" data-planner-duration="${duration}">${label}</button>`).join('');
}

export function renderPlannerScreen(ctx) {
  const {
    layout,
    plannerCalendarMode,
    plannerCalendarMonthCells,
    plannerCalendarWeekDates,
    plannerEditIndex,
    plannerEditItem,
    plannerFeedback = {},
    plannerMonthLabel = '',
    plannerViewItems = [],
    plannerWeekDates,
    selectedPlannerDate = '',
    selectedPlannerDateKey = '',
    selectedPlannerWeekday = ''
  } = ctx;
  const mode = ['week', 'month'].includes(plannerCalendarMode) ? plannerCalendarMode : 'week';

  return layout(
    `<div class="planner-screen"><header class="planner-context-head"><div><span>오늘의 플래너</span><h3>${escapeHtml(plannerMonthLabel)} ${escapeHtml(selectedPlannerDate)}일 <small>${escapeHtml(selectedPlannerWeekday)}요일</small></h3><p>계획을 확인하고, 오늘의 학습 흐름을 이어가세요.</p></div><span class="planner-checklist-art" aria-hidden="true"><i class="planner-checklist-pen"></i><i class="planner-checklist-paper"><b></b><b></b></i></span></header>
       ${renderInlinePlannerCalendar({ plannerCalendarMode: mode, plannerCalendarMonthCells, plannerWeekDates, selectedPlannerDateKey })}
       ${renderPlannerProgress(plannerViewItems)}
       ${renderPlannerItems({ plannerViewItems, selectedPlannerDate })}
       ${renderPlannerFeedback({ plannerFeedback, hasItems: Boolean(plannerViewItems.length) })}
       ${renderEditSheet({ plannerEditIndex, plannerEditItem })}
       </div>`,
    true
  );
}

export function renderPlannerAddScreen(ctx) {
  const {
    appbar,
    layout,
    plannerContentRef,
    plannerCustomMinutesRef,
    plannerDraft = {},
    selectedPlannerDate = ''
  } = ctx;

  const plannerContent = plannerContentRef?.current || '';
  const customMinutes = plannerCustomMinutesRef?.current || '';
  const selectedMinutes = plannerDraft.durationChoice === 'custom'
    ? Number(customMinutes)
    : Number(plannerDraft.durationChoice);
  const canSubmitPlanner = Boolean(plannerDraft.subject && String(plannerContent).trim() && selectedMinutes > 0);

  return layout(
    `<div class="planner-screen">
        ${appbar(`${selectedPlannerDate}일 플래너 항목 추가`, true)}
        <div class="planner-add-page">
          <div class="planner-add-form">
            <h4>${selectedPlannerDate}일 학습 계획</h4>
            <p class="sub">선택한 날짜에 실행할 학습 계획을 입력해 주세요.</p>
            <div class="planner-sheet-block"><label>과목 선택</label><div class="planner-pill-row">${renderSubjectPills(plannerDraft)}</div></div>
            <div class="planner-sheet-block"><label>학습 내용</label><input class="planner-input" data-field="plannerContent" value="${plannerContent}" placeholder="예: 개념 학습, 독해 문제 풀이" /></div>
            <div class="planner-sheet-block"><label>시간 선택</label><div class="planner-pill-row">${renderDurationPills(plannerDraft)}</div><input class="planner-input ${plannerDraft.durationChoice === 'custom' ? '' : 'is-hidden'}" data-field="plannerCustomMinutes" value="${customMinutes}" type="number" placeholder="분 단위 입력" /></div>
            <button class="btn btn-primary planner-sheet-submit ${canSubmitPlanner ? '' : 'disabled'}" data-action="addPlannerFromSheet" ${canSubmitPlanner ? '' : 'disabled'}>플래너에 추가하기</button>
          </div>
        </div>
      </div>`,
    true
  );
}
