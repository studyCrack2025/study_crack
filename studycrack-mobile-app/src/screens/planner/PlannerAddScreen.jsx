import { formatPlannerMinutes, PLANNER_ACTIVITY_OPTIONS, PLANNER_CATEGORY_OPTIONS } from './planner-options.js';

function getWeekdayLabel(dateKey = '') {
  const [year, month, day] = String(dateKey || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(year, month - 1, day).getDay()];
}

function RadioChip({ checked = false, name = '', value = '', children, extraAttrs = {} }) {
  return (
    <label className="planner-choice-chip">
      <input type="radio" name={name} value={value} defaultChecked={checked} {...extraAttrs} />
      <span>{children}</span>
    </label>
  );
}

export function PlannerAddScreen(ctx) {
  const {
    appbar,
    selectedPlannerDate = '',
    selectedPlannerDateKey = ''
  } = ctx;
  const weekday = getWeekdayLabel(selectedPlannerDateKey);
  const dateLabel = selectedPlannerDateKey
    ? `${selectedPlannerDateKey.replace(/-/g, '.')} ${weekday ? `(${weekday})` : ''}`
    : `${selectedPlannerDate}일`;
  const defaultCategory = PLANNER_CATEGORY_OPTIONS[0];
  const defaultStart = '09:00';
  const defaultEnd = '10:00';
  const defaultMinutes = formatPlannerMinutes(60);
  const steps = [
    { key: 'time', label: '시간' },
    { key: 'subject', label: '과목' },
    { key: 'activity', label: '유형' },
    { key: 'content', label: '내용' }
  ];

  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className="screen app-screen app-content" data-screen="plannerAdd">
          <div className="planner-screen planner-add-screen" data-planner-add-root>
            <div dangerouslySetInnerHTML={{ __html: appbar('계획 추가', true) }} />
            <section className="planner-add-hero">
              <span>선택 날짜</span>
              <h3>{dateLabel}</h3>
              <p>하나씩 입력하면 오늘 계획에 깔끔하게 정리됩니다.</p>
            </section>

            <div className="planner-step-progress" aria-label="계획 추가 단계">
              {steps.map((step, idx) => (
                <span key={step.key} className={idx === 0 ? 'active' : ''} data-planner-step-dot={step.key}>
                  <i>{idx + 1}</i>
                  <b>{step.label}</b>
                </span>
              ))}
            </div>

            <section className="planner-add-card planner-add-step planner-time-card active" data-planner-add-step="time">
              <div className="planner-add-card-head">
                <div>
                  <b>공부할 시간</b>
                  <small>실제 공부할 시간 범위를 입력해 주세요.</small>
                </div>
                <strong data-planner-duration-preview>{defaultMinutes}</strong>
              </div>
              <div className="planner-time-input-grid">
                <label>
                  <span>시작</span>
                  <input className="planner-input" data-field="plannerStartTime" type="time" step="600" defaultValue={defaultStart} />
                </label>
                <label>
                  <span>종료</span>
                  <input className="planner-input" data-field="plannerEndTime" type="time" step="600" defaultValue={defaultEnd} />
                </label>
              </div>
              <p className="planner-form-hint" data-planner-time-error>종료 시간이 시작 시간보다 늦어야 저장할 수 있어요.</p>
            </section>

            <section className="planner-add-card planner-add-step" data-planner-add-step="subject">
              <div className="planner-add-card-head">
                <div>
                  <b>과목</b>
                  <small>대분류와 세부 영역을 선택하세요.</small>
                </div>
              </div>
              <div className="planner-choice-row planner-category-row">
                {PLANNER_CATEGORY_OPTIONS.map((category, idx) => (
                  <RadioChip
                    key={category.value}
                    name="plannerCategory"
                    value={category.value}
                    checked={idx === 0}
                    extraAttrs={{ 'data-planner-category-radio': category.value }}
                  >
                    {category.label}
                  </RadioChip>
                ))}
              </div>
              <div className="planner-detail-groups">
                {PLANNER_CATEGORY_OPTIONS.map((category, categoryIdx) => (
                  <div
                    key={category.value}
                    className={`planner-detail-group ${categoryIdx === 0 ? 'active' : ''}`}
                    data-planner-detail-group={category.value}
                  >
                    {category.details.map((detail, idx) => (
                      <RadioChip
                        key={`${category.value}-${detail}`}
                        name="plannerDetailSubject"
                        value={detail}
                        checked={categoryIdx === 0 && idx === 0}
                        extraAttrs={{ 'data-planner-detail-radio': detail }}
                      >
                        {detail}
                      </RadioChip>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="planner-add-card planner-add-step" data-planner-add-step="activity">
              <div className="planner-add-card-head">
                <div>
                  <b>학습 유형</b>
                  <small>오늘 할 공부의 성격을 골라주세요.</small>
                </div>
              </div>
              <div className="planner-choice-row">
                {PLANNER_ACTIVITY_OPTIONS.map((activity, idx) => (
                  <RadioChip key={activity} name="plannerActivityType" value={activity} checked={idx === 0}>
                    {activity}
                  </RadioChip>
                ))}
              </div>
            </section>

            <section className="planner-add-card planner-add-step" data-planner-add-step="content">
              <div className="planner-add-card-head">
                <div>
                  <b>내용</b>
                  <small>계획 제목과 메모를 남길 수 있어요.</small>
                </div>
              </div>
              <input className="planner-input" data-field="plannerContent" placeholder="예: 영어 인강 시청" />
              <textarea className="planner-input planner-memo-input" data-field="plannerMemo" placeholder="메모 선택 입력" rows="3" />
            </section>

            <div className="planner-add-footer">
              <button className="btn btn-secondary planner-step-prev" data-action="plannerAddPrevStep" data-planner-step-prev disabled>
                이전
              </button>
              <button className="btn btn-primary planner-step-next" data-action="plannerAddNextStep" data-planner-step-next>
                다음
              </button>
              <button className="btn btn-primary planner-sheet-submit disabled" data-action="addPlannerFromSheet" data-planner-step-submit hidden disabled>
                계획 저장하기
              </button>
            </div>
            <div className="planner-bottom-space" />
          </div>
        </div>
      </div>
    </div>
  );
}
