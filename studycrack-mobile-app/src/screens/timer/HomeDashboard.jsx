import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { STUDYCRACK_LOGO_SRC } from '../../constants/assets.js';
import { HomePlannerPreview } from './HomePlannerPreview.jsx';
import { HomeStudyPanel } from './HomeStudyPanel.jsx';
import { StudyWeekSummary } from './StudyGamificationPanels.jsx';


function TimerProfileShortcut({ user = {} }) {
  const profileImage = String(user?.profileImage || '').trim();
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [profileImage]);
  return (
    <button type="button" className="timer-v2-profile" data-action="openDrawer" aria-label="프로필 메뉴 열기">
      {profileImage && !imageFailed ? <img src={profileImage} alt="" onError={() => setImageFailed(true)} /> : <Icon name="user" />}
    </button>
  );
}

function TimerHeader({ user = {} }) {
  return (
    <header className="timer-v2-brand-head">
      <span className="timer-v2-brand"><img src={STUDYCRACK_LOGO_SRC} alt="StudyCrack" /><span><b>STUDY CRACK</b><small>{user?.name ? `${user.name}님의 합격 루틴` : 'ADMISSIONS PLATFORM'}</small></span></span>
      <TimerProfileShortcut user={user} />
    </header>
  );
}

function HomeTargetSummary({ calendarNearestDdayLabel = '', calendarNearestEvent = null, normalizedTargetMajor = '' }) {
  return (
    <section className="timer-v2-target-summary" aria-label="목표 대학과 다가오는 일정">
      <button type="button" data-action="goto" data-target="analysis"><small>1지망 목표</small><b>{normalizedTargetMajor || '희망 대학을 설정해주세요'}</b><em>오늘의 공부를 목표와 연결해보세요</em></button>
      <button type="button" data-action="openPlannerCalendar" data-date={calendarNearestEvent?.date} aria-label="다가오는 일정 확인 및 추가"><b>{calendarNearestDdayLabel || '일정 추가'}</b><small>{calendarNearestEvent?.title || '다가오는 일정 없음'}</small><em>일정 관리 ›</em></button>
    </section>
  );
}

export function HomeDashboard(props) {
  const { user, normalizedTargetMajor, calendarNearestDdayLabel, calendarNearestEvent, studyOverview } = props;
  const forcedOpen = Boolean(props.studyStartBlocked || props.studyTimerRunning || props.timerPhase !== 'idle' || props.lastCompletedSession || props.rewardResult);
  return <main className="timer-screen-v2">
    <TimerHeader user={user} />
    <section className="home-study-highlight" aria-label="오늘의 학습 지표"><HomeStudyPanel {...props} showStudyPanel={forcedOpen} /></section>
    <HomeTargetSummary calendarNearestDdayLabel={calendarNearestDdayLabel} calendarNearestEvent={calendarNearestEvent} normalizedTargetMajor={normalizedTargetMajor} />
    <HomePlannerPreview {...props} />
    <section className="home-week-flow" aria-label="이번 주 공부 흐름"><StudyWeekSummary key={props.user?.email || 'guest'} overview={studyOverview} summary={props.studySummary} status={props.studySummaryStatus} compact /></section>
  </main>;
}
