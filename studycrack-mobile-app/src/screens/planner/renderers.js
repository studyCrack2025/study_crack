import { renderSheet } from '../../components/sheet.js';

const PLANNER_SUBJECTS = ['수학', '국어', '영어', '탐구', '기타'];
const PLANNER_DURATIONS = [
  ['30', '30분'],
  ['60', '60분'],
  ['90', '90분'],
  ['120', '120분'],
  ['custom', '직접 입력']
];

function defaultIcon() {
  return '';
}

function activeClass(value) {
  return value ? 'active' : '';
}

function renderDateStrip({ plannerWeekDates = [], selectedPlannerDate = '' }) {
  return `<div class="planner-days planner-days-carousel planner-date-strip">${plannerWeekDates.map(({ day, weekday }) => `<button class="planner-date-item ${activeClass(selectedPlannerDate === day)}" data-action="selectPlannerDate" data-planner-date="${day}"><small>${weekday}</small><strong>${day}</strong></button>`).join('')}</div>`;
}

function renderSubjectDonut({ plannerViewDonutGradient = '', plannerViewSubjectStats = [] }) {
  if (!plannerViewSubjectStats.length) return '';
  return `<div class="planner-donut-wrap"><div class="planner-donut" style="--donut:${plannerViewDonutGradient}"></div><div class="planner-donut-legend">${plannerViewSubjectStats.map((item) => `<span><i style="background:${item.color}"></i>${item.subject} ${item.percent}%</span>`).join('')}</div></div>`;
}

function renderPlannerItemCard(item) {
  return `<div class="planner-item ${item.done ? 'done' : ''}" data-action="openPlannerEdit" data-planner-id="${item.id}"><i class="dot ${item.dot}"></i><div class="planner-item-main"><b>${item.subject}</b><p>${item.content}</p></div><div class="planner-item-right"><strong>${item.minutes}분</strong><div class="planner-item-controls"><button class="planner-item-done" data-action="togglePlannerDone" data-planner-id="${item.id}">✓ ${item.done ? '완료!' : '완료'}</button><button class="planner-item-remove" data-action="removePlannerItem" data-planner-id="${item.id}">✕</button></div></div></div>`;
}

function formatPlannerMinutes(minutes = 0) {
  const safe = Math.max(0, Number(minutes) || 0);
  const hour = Math.floor(safe / 60);
  const min = safe % 60;
  if (hour && min) return `${hour}시간 ${min}분`;
  if (hour) return `${hour}시간`;
  return `${min}분`;
}

function renderPlannerItems({ plannerViewItems = [], selectedPlannerDate = '' }) {
  const items = plannerViewItems.map(renderPlannerItemCard).join('');
  return `<div class="planner-plan-list">
         ${items || `<div class="planner-empty-day"><b>아직 등록한 계획이 없어요</b><p>${selectedPlannerDate}일에 학습을 추가해 하루 목표를 만들어 보세요.</p></div>`}
         <button class="planner-add-cta" data-action="openPlannerAddPage">+ ${selectedPlannerDate}일 계획 추가하기</button>
       </div>`;
}

function renderPlannerCalendarModeButton(mode, label, activeMode) {
  return `<button type="button" class="${activeClass(activeMode === mode)}" data-action="setPlannerCalendarMode" data-planner-calendar-mode="${mode}">${label}</button>`;
}

function renderPlannerCalendarDay({ plannerViewHour = 0, plannerViewItems = [], plannerViewMinute = 0, selectedPlannerDate = '' }) {
  const totalLabel = `${plannerViewHour ? `${plannerViewHour}시간 ` : ''}${plannerViewMinute}분`;
  const items = plannerViewItems.length
    ? plannerViewItems.map((item) => `<div class="planner-calendar-agenda-item"><span class="dot ${item.dot || 'etc'}"></span><div><b>${item.subject || '기타'}</b><p>${item.content || ''}</p></div><strong>${item.minutes || 0}분</strong></div>`).join('')
    : '<div class="planner-calendar-empty">이 날 등록된 계획이 없어요.</div>';
  return `<div class="planner-calendar-day-panel"><div class="planner-calendar-day-score"><span>${selectedPlannerDate}일</span><b>${plannerViewItems.length}개 계획</b><p>총 ${totalLabel}</p></div><div class="planner-calendar-agenda">${items}</div></div>`;
}

function renderPlannerCalendarWeek({ plannerCalendarWeekDates = [], selectedPlannerDate = '' }) {
  return `<div class="planner-calendar-week-panel">${plannerCalendarWeekDates.map((item) => {
    if (item.empty) return `<span class="planner-calendar-week-card is-empty"><small>${item.weekday}</small></span>`;
    return `<button type="button" class="planner-calendar-week-card ${activeClass(selectedPlannerDate === item.day)}" data-action="selectPlannerDate" data-planner-date="${item.day}"><small>${item.weekday}</small><b>${item.day}</b><span>${item.count ? `${item.count}개` : '비어있음'}</span>${item.minutes ? `<em>${formatPlannerMinutes(item.minutes)}</em>` : ''}</button>`;
  }).join('')}</div>`;
}

function renderPlannerCalendarMonth({ plannerCalendarMonthCells = [], selectedPlannerDate = '' }) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'].map((day) => `<span>${day}</span>`).join('');
  const cells = plannerCalendarMonthCells.map((cell) => {
    if (cell.blank) return `<span class="planner-calendar-month-day is-blank"></span>`;
    return `<button type="button" class="planner-calendar-month-day ${activeClass(selectedPlannerDate === cell.day)} ${cell.isToday ? 'is-today' : ''}" data-action="selectPlannerDate" data-planner-date="${cell.day}"><b>${cell.day}</b>${cell.count ? `<span>${cell.count}</span>` : ''}</button>`;
  }).join('');
  return `<div class="planner-calendar-month-panel"><div class="planner-calendar-weekdays">${weekdays}</div><div class="planner-calendar-month-grid">${cells}</div></div>`;
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
  selectedPlannerDate = ''
}) {
  if (!plannerCalendarOpen) return '';
  const mode = ['day', 'week', 'month'].includes(plannerCalendarMode) ? plannerCalendarMode : 'week';
  const viewHtml = mode === 'day'
    ? renderPlannerCalendarDay({ plannerViewHour, plannerViewItems, plannerViewMinute, selectedPlannerDate })
    : mode === 'month'
      ? renderPlannerCalendarMonth({ plannerCalendarMonthCells, selectedPlannerDate })
      : renderPlannerCalendarWeek({ plannerCalendarWeekDates, selectedPlannerDate });
  const body = `<button type="button" class="planner-sheet-close" data-action="closePlannerCalendar">✕</button><div class="planner-calendar-head"><div><span>학습 캘린더</span><h3>${plannerMonthLabel}</h3></div><button type="button" class="btn btn-secondary mini" data-action="closePlannerCalendar">완료</button></div><div class="planner-calendar-segment">${renderPlannerCalendarModeButton('day', '일', mode)}${renderPlannerCalendarModeButton('week', '주', mode)}${renderPlannerCalendarModeButton('month', '월', mode)}</div>${viewHtml}`;
  return renderSheet({ panelClass: 'planner-calendar-sheet', dismissAction: 'closePlannerCalendar', body });
}

export function renderEditSheet({ plannerEditIndex = null, plannerEditItem = null }) {
  if (plannerEditIndex === null) return '';
  const body = `<button class="planner-sheet-close" data-action="closePlannerEdit">✕</button><h3>플래너 항목 수정</h3><div class="planner-sheet-block"><label>과목</label><input class="planner-input" data-field="plannerEditSubject" value="${plannerEditItem?.subject || ''}" /></div><div class="planner-sheet-block"><label>세부 내용</label><input class="planner-input" data-field="plannerEditContent" value="${plannerEditItem?.content || ''}" /></div><div class="planner-sheet-block"><label>소요 시간(분)</label><input class="planner-input" data-field="plannerEditMinutes" type="number" value="${plannerEditItem?.minutes || ''}" /></div><button class="btn btn-primary" data-action="savePlannerEdit">수정 저장</button>`;
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
    icon = defaultIcon,
    layout,
    plannerCalendarOpen,
    plannerCalendarMode,
    plannerCalendarMonthCells,
    plannerCalendarWeekDates,
    plannerEditIndex,
    plannerEditItem,
    plannerFeedback = {},
    plannerMonthDays,
    plannerMonthLabel = '',
    plannerViewDonutGradient,
    plannerViewHour = 0,
    plannerViewItems,
    plannerViewMinute = 0,
    plannerViewSubjectStats,
    plannerWeekDates,
    selectedPlannerDate = '',
    selectedPlannerWeekday = ''
  } = ctx;

  return layout(
    `<div class="planner-screen"><div class="planner-head"><h3>${plannerMonthLabel} ${selectedPlannerDate}일 (${selectedPlannerWeekday})</h3><button class="planner-cal-btn" data-action="openPlannerCalendar">${icon('calendar', false)}</button></div>
       ${renderDateStrip({ plannerWeekDates, selectedPlannerDate })}
       <div class="planner-section-title planner-fade"><div><h4>${selectedPlannerDate}일 계획</h4><p>총 ${plannerViewHour}시간 ${plannerViewMinute}분</p>${plannerFeedback.tone === 'warn' ? '<span class="planner-warning-pill">⚠ 수학 비중 높음 · 과목 균형 필요</span>' : ''}</div>${renderSubjectDonut({ plannerViewDonutGradient, plannerViewSubjectStats })}</div>
       <div class="card planner-premium-cta"><div class="planner-premium-copy"><span class="badge">SKY MENTOR</span><b>혼자 짠 플래너, 불안하신가요?</b><p>SKY 선생님이<br/>직접 이번 주 플래너를 짜드립니다.</p></div><button type="button" class="planner-premium-btn" data-action="startStandard">플래너 직접 받기</button></div>
       ${renderPlannerItems({ plannerViewItems, selectedPlannerDate })}

       <div class="planner-bottom-space"></div>
       ${renderCalendarSheet({ plannerCalendarMode, plannerCalendarMonthCells, plannerCalendarOpen, plannerCalendarWeekDates, plannerMonthLabel, plannerViewHour, plannerViewItems, plannerViewMinute, selectedPlannerDate })}
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
