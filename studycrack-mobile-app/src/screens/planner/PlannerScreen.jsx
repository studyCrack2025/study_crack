import { renderCalendarSheet, renderEditSheet } from './renderers.js';

// planner 화면의 React-트리(JSX) 버전. 문자열 renderer(renderPlannerScreen)와 DOM 구조·data-action을
// 1:1로 맞추되, 날짜 스트립(.planner-date-strip)을 실제 React 노드로 두어 재렌더 간 scrollLeft를 보존한다.
// 이벤트는 셸 래퍼(main.js)의 위임 디스패처가 처리하므로 data-action 속성만 유지하면 된다.
// 스크롤 상태가 없는 탭바·오버레이 시트는 기존 문자열 renderer를 leaf로 임베드해 변환 범위를 한정한다.

function SubjectDonut({ plannerViewDonutGradient = '', plannerViewSubjectStats = [] }) {
  if (!plannerViewSubjectStats.length) return null;
  return (
    <div className="planner-donut-wrap">
      <div className="planner-donut" style={{ '--donut': plannerViewDonutGradient }} />
      <div className="planner-donut-legend">
        {plannerViewSubjectStats.map((item, idx) => (
          <span key={idx}>
            <i style={{ background: item.color }} />
            {item.subject} {item.percent}%
          </span>
        ))}
      </div>
    </div>
  );
}

function PlannerItemCard({ item }) {
  return (
    <div className={`planner-item ${item.done ? 'done' : ''}`} data-action="openPlannerEdit" data-planner-id={item.id}>
      <i className={`dot ${item.dot}`} />
      <div className="planner-item-main">
        <b>{item.subject}</b>
        <p>{item.content}</p>
      </div>
      <div className="planner-item-right">
        <strong>{item.minutes}분</strong>
        <div className="planner-item-controls">
          <button className="planner-item-done" data-action="togglePlannerDone" data-planner-id={item.id}>
            ✓ {item.done ? '완료!' : '완료'}
          </button>
          <button className="planner-item-remove" data-action="removePlannerItem" data-planner-id={item.id}>
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlannerScreen(ctx) {
  const {
    dimmed = false,
    icon = () => '',
    tabBarHtml = '',
    plannerCalendarMode,
    plannerCalendarMonthCells,
    plannerCalendarOpen,
    plannerCalendarWeekDates,
    plannerEditIndex,
    plannerEditItem,
    plannerFeedback = {},
    plannerMonthLabel = '',
    plannerViewDonutGradient,
    plannerViewHour = 0,
    plannerViewItems = [],
    plannerViewMinute = 0,
    plannerViewSubjectStats = [],
    plannerWeekDates = [],
    selectedPlannerDate = '',
    selectedPlannerDateKey = '',
    selectedPlannerWeekday = ''
  } = ctx;

  const overlaysHtml =
    renderCalendarSheet({
      plannerCalendarMode,
      plannerCalendarMonthCells,
      plannerCalendarOpen,
      plannerCalendarWeekDates,
      plannerMonthLabel,
      plannerViewHour,
      plannerViewItems,
      plannerViewMinute,
      selectedPlannerDate,
      selectedPlannerDateKey
    }) +
    renderEditSheet({ plannerEditIndex, plannerEditItem });

  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${dimmed ? 'modal-lock' : ''}`} data-screen="planner">
          <div className="planner-screen">
            <div className="card planner-title-card">
              <div className="top-card-head">
                <div>
                  <h3>플래너</h3>
                  <p>오늘 계획을 확인하고, 학습 흐름을 이어가세요.</p>
                </div>
                <span
                  className="planner-checklist-art"
                  aria-hidden="true"
                >
                  <i className="planner-checklist-pen" />
                  <i className="planner-checklist-paper"><b /><b /></i>
                </span>
              </div>
            </div>

            <div className="planner-head planner-date-head">
              <h3>{plannerMonthLabel} {selectedPlannerDate}일 ({selectedPlannerWeekday})</h3>
              <button
                className="planner-cal-btn"
                data-action="openPlannerCalendar"
                dangerouslySetInnerHTML={{ __html: icon('calendar', false) }}
              />
            </div>

            <div className="planner-days planner-days-carousel planner-date-strip">
              {plannerWeekDates.map(({ date, day, weekday, empty }, idx) => (
                <button
                  key={date || `empty-${idx}`}
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

            <div className="planner-section-title planner-day-summary planner-fade">
              <div>
                <h4>{selectedPlannerDate}일 계획</h4>
                <p>
                  총 {plannerViewHour}시간 {plannerViewMinute}분
                </p>
                {plannerFeedback.tone === 'warn' && (
                  <span className="planner-warning-pill">⚠ 수학 비중 높음 · 과목 균형 필요</span>
                )}
              </div>
              <SubjectDonut
                plannerViewDonutGradient={plannerViewDonutGradient}
                plannerViewSubjectStats={plannerViewSubjectStats}
              />
            </div>

            <div className="card planner-premium-cta">
              <div className="planner-premium-copy">
                <span className="badge">SKY MENTOR</span>
                <b>혼자 짠 플래너, 불안하신가요?</b>
                <p>
                  SKY 선생님이<br />
                  직접 이번 주 플래너를 짜드립니다.
                </p>
              </div>
              <button type="button" className="planner-premium-btn" data-action="startStandard">
                플래너 직접 받기
              </button>
            </div>

            <div className="planner-plan-list">
              {plannerViewItems.length ? (
                plannerViewItems.map((item) => <PlannerItemCard key={item.id} item={item} />)
              ) : (
                <div className="planner-empty-day">
                  <b>아직 등록한 계획이 없어요</b>
                  <p>{selectedPlannerDate}일에 학습을 추가해 하루 목표를 만들어 보세요.</p>
                </div>
              )}
              <button className="planner-add-cta" data-action="openPlannerAddPage">
                + {selectedPlannerDate}일 계획 추가하기
              </button>
            </div>

            <div className="planner-bottom-space" />
          </div>
        </div>
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: overlaysHtml }} />
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: tabBarHtml }} />
      </div>
    </div>
  );
}
