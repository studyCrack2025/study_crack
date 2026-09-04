import { buildPlannerPresentation } from './presentation.js';
import { PlannerEditSheet } from './PlannerEditSheet.jsx';
import { AdmissionCalendarSheet } from './AdmissionCalendarSheet.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { PrimaryScreenHeader } from '../../components/PrimaryScreenHeader.jsx';
import { TODAY_DATE } from '../../constants/runtime-defaults.js';
import { FishArtwork } from '../aquarium/FishArtwork.jsx';

function PlannerItemCard({ item }) {
  const timeLabel = item.start && item.end && item.start !== '--:--' && item.end !== '--:--'
    ? `${item.start} - ${item.end}`
    : `${item.minutes}분`;
  const detailLabel = [item.subject, item.detailSubject, item.activityType].filter(Boolean).join(' · ');
  return (
    <article className={`planner-item planner-item-v2 ${item.done ? 'done' : ''}`} data-action="openPlannerEdit" data-planner-id={item.id}>
      <span className={`planner-item-subject ${item.dot || 'etc'}`} aria-hidden="true"><i /></span>
      <div className="planner-item-main">
        <small className="planner-item-time">{timeLabel}</small>
        <b>{item.content}</b>
        <p>{detailLabel || '학습 계획'}</p>
      </div>
      <div className="planner-item-actions">
        <span>{item.minutes}분</span>
        <div>
          <button type="button" className="planner-item-done" data-action="togglePlannerDone" data-planner-id={item.id} aria-label={item.done ? '완료 취소' : '계획 완료'}><i aria-hidden="true">✓</i></button>
          <button type="button" className="planner-item-remove" data-action="removePlannerItem" data-planner-id={item.id} aria-label="계획 삭제">×</button>
        </div>
      </div>
    </article>
  );
}

function PlannerCalendarSegment({ activeMode = 'week' }) {
  return (
    <div className="planner-calendar-segment planner-inline-segment" aria-label="달력 보기 방식">
      <button type="button" className={activeMode === 'week' ? 'active' : ''} data-action="setPlannerCalendarMode" data-planner-calendar-mode="week">주</button>
      <button type="button" className={activeMode === 'month' ? 'active' : ''} data-action="setPlannerCalendarMode" data-planner-calendar-mode="month">월</button>
    </div>
  );
}

function PlannerDateStrip({ plannerWeekDates = [], selectedPlannerDateKey = '' }) {
  return (
    <div className="planner-days planner-date-strip">
      {plannerWeekDates.map(({ date, day, weekday, empty }, idx) => (
        <button
          key={date || `empty-${idx}`}
          type="button"
          className={`planner-date-item ${empty ? 'is-empty' : ''} ${selectedPlannerDateKey === date ? 'active' : ''}`}
          data-action="selectPlannerDate"
          data-planner-date={date || ''}
          disabled={empty}
        >
          <small>{weekday}</small>
          <strong>{day}</strong>
        </button>
      ))}
    </div>
  );
}

function PlannerMonthGrid({ plannerCalendarMonthCells = [] }) {
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return (
    <div className="planner-calendar-month-panel planner-inline-month-panel">
      <div className="planner-calendar-weekdays">
        {weekdays.map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="planner-calendar-month-grid">
        {plannerCalendarMonthCells.map((cell, idx) => (
          cell.blank ? (
            <span key={cell.key || `blank-${idx}`} className="planner-calendar-month-day is-blank" />
          ) : (
            <button
              key={cell.key || cell.date}
              type="button"
              className={`planner-calendar-month-day ${cell.isSelected ? 'active' : ''} ${cell.isToday ? 'is-today' : ''}`}
              data-action="selectPlannerDate"
              data-planner-date={cell.date}
            >
              <b>{cell.day}</b>
              {cell.count ? <span>{cell.count}</span> : null}
            </button>
          )
        ))}
      </div>
    </div>
  );
}

function PlannerProgress({ presentation }) {
  const progressTone = presentation.remainingCount ? 'pending' : presentation.totalCount ? 'complete' : 'waiting';
  return (
    <section className="card planner-progress-card">
      <div className="planner-progress-head"><div><span>오늘의 공부 진행률</span><h4 className="sc-metric">{presentation.completedCount}/{presentation.totalCount} <small>완료</small></h4></div><span className={`planner-progress-fish ${presentation.progress === 100 ? 'is-complete' : ''}`}><FishArtwork growthStage={presentation.progress === 100 ? 'adult' : 'young'} speciesId="clownfish" variant="grid" /></span></div>
      <div className="progress planner-progress-track" role="progressbar" aria-label="플래너 완료율" aria-valuemin="0" aria-valuemax="100" aria-valuenow={presentation.progress}><i style={{ width: `${presentation.progress}%` }} /></div>
      <div className="planner-progress-caption"><b className={progressTone}>{presentation.remainingCount ? `다음 계획까지 ${presentation.remainingCount}개 남았어요` : presentation.totalCount ? '오늘의 공부를 모두 끝냈어요' : '계획을 추가하면 진행률을 확인할 수 있어요'}</b><span>{presentation.completedDurationLabel} / {presentation.totalDurationLabel}</span></div>
    </section>
  );
}

function PlannerFeedback({ plannerFeedback = {}, hasItems = false }) {
  const warning = plannerFeedback.tone === 'warn';
  const title = warning ? '과목 균형을 한 번 점검해 보세요' : hasItems ? '이번 주 계획을 함께 점검해요' : '계획을 만들면 피드백을 받을 수 있어요';
  const description = plannerFeedback.message || (warning ? '특정 과목에 시간이 몰려 있어 우선순위 조정이 필요해요.' : '주간 계획과 실행 기록을 바탕으로 다음 학습 방향을 정리합니다.');
  return (
    <section className={`card planner-feedback-card ${warning ? 'warn' : ''}`}>
      <div className="planner-feedback-copy"><span>SKY MENTOR</span><h4>{title}</h4><p>{description}</p></div>
      <button type="button" data-action="goto" data-target="weekly">주간 피드백 보기 <b aria-hidden="true">›</b></button>
    </section>
  );
}

export function PlannerScreen(ctx) {
  const {
    calendarEventFormOpen = false,
    calendarSheetOpen = false,
    dimmed = false,
    tab = 'planner',
    plannerCalendarMode,
    plannerCalendarMonthCells,
    plannerEditIndex,
    plannerEditItem,
    plannerFeedback = {},
    plannerMonthLabel = '',
    plannerViewItems = [],
    plannerWeekDates = [],
    normalizedTargetMajor = '',
    calendarNearestDdayLabel = '',
    selectedPlannerDate = '',
    selectedPlannerDateKey = '',
    selectedPlannerWeekday = ''
  } = ctx;

  const calendarMode = ['week', 'month'].includes(plannerCalendarMode) ? plannerCalendarMode : 'week';
  const presentation = buildPlannerPresentation(plannerViewItems);
  const isToday = selectedPlannerDateKey === TODAY_DATE;
  const planHeading = isToday ? '오늘 할 일' : `${selectedPlannerDate}일 할 일`;
  const plannerOverlayOpen = plannerEditIndex !== null || calendarSheetOpen || calendarEventFormOpen;

  return (
    <AppScreenShell
      screen="planner"
      tab={tab}
      dimmed={dimmed}
      overlayOpen={plannerOverlayOpen}
      overlays={plannerOverlayOpen ? <>{plannerEditIndex !== null ? <PlannerEditSheet plannerEditIndex={plannerEditIndex} plannerEditItem={plannerEditItem} /> : null}{calendarSheetOpen || calendarEventFormOpen ? <AdmissionCalendarSheet {...ctx} /> : null}</> : null}
    >
          <main className={`planner-screen ${plannerViewItems.length ? '' : 'planner-empty-state-screen'}`}>
            <PrimaryScreenHeader className="planner-context-head" eyebrow={[normalizedTargetMajor || '목표 대학 설정', calendarNearestDdayLabel].filter(Boolean).join(' · ')} title="오늘의 플래너" />

            <PlannerProgress presentation={presentation} />

            <section className="planner-tasks-section">
              <div className="planner-section-head"><div><span>{plannerMonthLabel} {selectedPlannerDate}일 · {selectedPlannerWeekday}요일</span><h4>{planHeading}</h4></div><button type="button" className="planner-add-icon" data-action="openPlannerAddPage" aria-label="계획 추가">+</button></div>
              <div className="planner-plan-list">
                {plannerViewItems.length ? (
                  plannerViewItems.map((item) => <PlannerItemCard key={item.id} item={item} />)
                ) : (
                  <EmptyState className="planner-empty-day" title="아직 등록한 계획이 없어요" description="실행할 과목과 시간을 추가해 하루 목표를 만들어 보세요." />
                )}
                <button type="button" className="planner-add-cta" data-action="openPlannerAddPage">{selectedPlannerDate}일 계획 추가</button>
              </div>
            </section>

            <section className="planner-calendar-section">
              <div className="planner-section-head"><div><span>&#xC77C;&#xC815; &#xD0D0;&#xC0C9;</span><h4>&#xB2E4;&#xB978; &#xB0A0;&#xC9DC; &#xBCF4;&#xAE30;</h4></div><button type="button" className="planner-admission-trigger" data-action="openCalendarSheet">&#xC218;&#xD5D8; &#xC77C;&#xC815;</button></div>
              <div className="card planner-calendar-card">
                <div className="planner-inline-calendar-toolbar">
                  <PlannerCalendarSegment activeMode={calendarMode} />
                  <div className="planner-inline-calendar-nav">
                    <button type="button" data-action="plannerCalendarPrevWeek" aria-label={calendarMode === 'month' ? '이전 달' : '이전 주'}>‹</button>
                    <button type="button" data-action="plannerCalendarToday">오늘</button>
                    <button type="button" data-action="plannerCalendarNextWeek" aria-label={calendarMode === 'month' ? '다음 달' : '다음 주'}>›</button>
                  </div>
                </div>
                {calendarMode === 'month' ? (
                  <PlannerMonthGrid plannerCalendarMonthCells={plannerCalendarMonthCells} />
                ) : (
                  <PlannerDateStrip plannerWeekDates={plannerWeekDates} selectedPlannerDateKey={selectedPlannerDateKey} />
                )}
              </div>
            </section>

            <PlannerFeedback plannerFeedback={plannerFeedback} hasItems={Boolean(plannerViewItems.length)} />
          </main>
    </AppScreenShell>
  );
}
