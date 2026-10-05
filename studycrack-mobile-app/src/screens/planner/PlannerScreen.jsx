import { buildPlannerPresentation } from './presentation.js';
import { PlannerEditSheet } from './PlannerEditSheet.jsx';
import { AdmissionCalendar } from './AdmissionCalendar.jsx';
import { EmptyState } from '../../components/EmptyState.jsx';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { PrimaryScreenHeader } from '../../components/PrimaryScreenHeader.jsx';
import { PlannerStudyStatus } from './PlannerStudyStatus.jsx';
import { getTodayDateKey } from '../../constants/runtime-defaults.js';
import { FishArtwork } from '../aquarium/FishArtwork.jsx';
import { PlannerAccountPanel } from '../../features/planner/PlannerAccountPanel.jsx';
import { useContext } from 'react';
import { PlannerStorageContext } from '../../features/planner/PlannerStorageContext.js';
import { PlannerAccountNotice } from '../../features/planner/PlannerAccountNotice.jsx';

function PlannerItemCard({ item }) {
  const timeLabel = item.accountDurationState === 'unknown' ? '시간 확인 필요' : item.accountDurationState === 'confirmed' ? `${item.minutes}분` : item.start && item.end && item.start !== '--:--' && item.end !== '--:--'
    ? `${item.start} - ${item.end}`
    : item.minutes ? `${item.minutes}분` : '시간 미설정';
  const titleId = `planner-title-${encodeURIComponent(item.id)}`;
  return (
    <article className={`planner-item planner-item-v2 ${item.done ? 'done' : ''}`} data-planner-id={item.id}>
      <button type="button" disabled={item.accountPending} className="planner-item-done" data-action="togglePlannerDone" data-planner-id={item.id} aria-pressed={Boolean(item.done)} aria-describedby={titleId} aria-label={item.done ? '완료 취소' : '계획 완료'}><i aria-hidden="true">{item.done ? '✓' : ''}</i></button>
      <button type="button" className="planner-item-main" data-action="openPlannerEdit" data-planner-id={item.id} aria-label="계획 편집" aria-describedby={titleId}>
        <span className="planner-item-meta"><span className={`planner-item-subject ${item.dot || 'etc'}`}><i aria-hidden="true" />{item.subject || '기타'}</span><small className="planner-item-time">{timeLabel}</small></span>
        <b id={titleId}>{item.content}</b>
        {item.accountPending ? <span className="planner-item-detail">서버 반영 대기</span> : null}
      </button>
      <div className="planner-item-actions">
        <div>
          <button type="button" disabled={item.accountPending} className="planner-item-remove" data-action="removePlannerItem" data-planner-id={item.id} aria-describedby={titleId} aria-label="계획 삭제">×</button>
        </div>
      </div>
    </article>
  );
}

function PlannerProgress({ presentation, isToday }) {
  const progressTone = presentation.remainingCount ? 'pending' : presentation.totalCount ? 'complete' : 'waiting';
  return (
    <section className="card planner-progress-card">
      <div className="planner-progress-head"><div><span>{isToday ? '오늘의 계획 진행률' : '선택한 날의 계획 진행률'}</span><h4 className="sc-metric">{presentation.completedCount}/{presentation.totalCount} <small>완료</small></h4></div><span className={`planner-progress-fish ${presentation.progress === 100 ? 'is-complete' : ''}`} aria-hidden="true"><FishArtwork growthStage={presentation.progress === 100 ? 'adult' : 'young'} speciesId="clownfish" variant="grid" /></span></div>
      <div className="progress planner-progress-track" role="progressbar" aria-label="플래너 완료율" aria-valuemin="0" aria-valuemax="100" aria-valuenow={presentation.progress}><i style={{ width: `${presentation.progress}%` }} /></div>
      <div className="planner-progress-caption"><b className={progressTone}>{presentation.remainingCount ? `계획 ${presentation.remainingCount}개가 남았어요` : presentation.totalCount ? '모두 완료' : '계획 없음'}</b><span>완료 계획 {presentation.completedDurationLabel} / 전체 {presentation.totalDurationLabel}</span></div>
    </section>
  );
}

function PlannerFeedback({ plannerFeedback = {}, hasItems = false, canAccessStandard = false }) {
  const warning = canAccessStandard && plannerFeedback.tone === 'warn';
  const title = warning ? '과목 균형 점검' : '튜터 피드백';
  const description = canAccessStandard ? plannerFeedback.message : '';
  return (
    <section className={`card planner-feedback-card ${warning ? 'warn' : ''}`}>
      <div className="planner-feedback-copy"><span>{canAccessStandard ? 'SKY MENTOR' : '개인 플래너는 무료로 이용해요'}</span><h4>{title}</h4>{description ? <p>{description}</p> : !canAccessStandard ? <p>선택형 유료 코칭</p> : null}</div>
      <button type="button" data-action="goto" data-target={canAccessStandard ? 'weekly' : 'proIntro'}>{canAccessStandard ? '주간 피드백 보기' : '튜터 코칭 알아보기'} <b aria-hidden="true">›</b></button>
    </section>
  );
}

function PlannerWorkspaceScreen(ctx) {
  const account = useContext(PlannerStorageContext)?.controller?.account;
  const accountMode = account?.getView().mode === 'account';
  if (accountMode) {
    const items = account.getItems();
    ctx = { ...ctx, plannerViewItems: items.filter(item => item.date === ctx.selectedPlannerDateKey), plannerEditItem: items.find(item => item.id === ctx.plannerEditIndex) };
  }
  const {
    dimmed = false,
    tab = 'planner',
    plannerEditIndex = null,
    plannerEditItem,
    plannerFeedback = {},
    canAccessStandard = false,
    plannerMonthLabel = '',
    plannerViewItems = [],
    normalizedTargetMajor = '',
    calendarNearestDdayLabel = '',
    selectedPlannerDate = '',
    selectedPlannerDateKey = '',
    selectedPlannerWeekday = ''
  } = ctx;

  const presentation = buildPlannerPresentation(plannerViewItems);
  const isToday = selectedPlannerDateKey === (ctx.todayDate || getTodayDateKey());
  const planHeading = isToday ? '오늘 할 일' : `${selectedPlannerDate}일 할 일`;
  const plannerOverlayOpen = plannerEditIndex !== null;

  return (
    <AppScreenShell
      screen="planner"
      tab={tab}
      dimmed={dimmed}
      overlayOpen={plannerOverlayOpen}
      overlays={plannerOverlayOpen ? <>{plannerEditIndex !== null ? <PlannerEditSheet key={`${account?.getView().scope || 0}:${plannerEditIndex}`} plannerEditIndex={plannerEditIndex} plannerEditItem={plannerEditItem} /> : null}</> : null}
    >
          <main className={`planner-screen ${plannerViewItems.length ? '' : 'planner-empty-state-screen'}`}>
            <PrimaryScreenHeader className="planner-context-head" eyebrow={[normalizedTargetMajor || '목표 대학 설정', calendarNearestDdayLabel].filter(Boolean).join(' · ')} title="Planner of Today" />
            <AdmissionCalendar {...ctx} />
            <PlannerProgress presentation={presentation} isToday={isToday} />
            <PlannerStudyStatus overview={ctx.studyOverview} isToday={isToday} />
            <PlannerAccountNotice />
            {accountMode ? <button type="button" className="btn" disabled={account.getView().busy} onClick={() => account.setMode('device')}>기기 계획 보기</button> : null}

            <section className="planner-tasks-section">
              <div className="planner-section-head"><div><span>{plannerMonthLabel} {selectedPlannerDate}일 · {selectedPlannerWeekday}요일</span><h4>{planHeading}</h4></div><button type="button" className="planner-add-icon" data-action="openPlannerAddPage" aria-label="계획 추가">+</button></div>
              <div className="planner-plan-list">
                {plannerViewItems.length ? (
                  plannerViewItems.map((item) => <PlannerItemCard key={item.id} item={item} />)
                ) : (
                  <EmptyState className="planner-empty-day" title="아직 등록한 계획이 없어요" />
                )}
                <button type="button" className="planner-add-cta" data-action="openPlannerAddPage">{selectedPlannerDate}일 계획 추가</button>
              </div>
            </section>

            <PlannerFeedback plannerFeedback={plannerFeedback} hasItems={Boolean(plannerViewItems.length)} canAccessStandard={canAccessStandard} />
            <PlannerAccountPanel />


          </main>
    </AppScreenShell>
  );
}

export function PlannerScreen(ctx) { return <PlannerWorkspaceScreen {...ctx} />; }
