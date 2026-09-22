import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon.jsx';
import { STUDYCRACK_LOGO_SRC } from '../../constants/assets.js';
import { StudyOverviewCard } from '../../components/StudyOverviewCard.jsx';
import { HomePlannerPreview } from './HomePlannerPreview.jsx';
import { HomeAquariumPreview } from './HomeAquariumPreview.jsx';

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

function HomeStatusRail({ aquariumPresentation, normalizedTargetMajor = '' }) {
  const targetLabel = normalizedTargetMajor ? String(normalizedTargetMajor).split(' ')[0] : '목표 설정';
  const streakDays = aquariumPresentation?.streakDays;
  return (
    <section className="timer-v2-status-rail" aria-label="학습 현황 바로가기">
      <button type="button" data-action="goto" data-target="analysis"><Icon name="target" /><small>목표 대학</small><b>{targetLabel}</b></button>
      <button type="button" data-action="openStreakSummary"><Icon name="bolt" /><small>연속 학습</small><b>{streakDays != null ? `${streakDays}일` : '확인 필요'}</b></button>
      <button type="button" data-action="goto" data-target="aquarium"><Icon name="fish" /><small>보유 물고기</small><b>{aquariumPresentation?.ownedCount != null ? `${aquariumPresentation.ownedCount}마리` : '확인 필요'}</b></button>
      <button type="button" data-action="goto" data-target="strategy"><Icon name="chat" /><small>SKY 코칭</small><b>바로가기</b></button>
    </section>
  );
}

function HomeTargetSummary({ calendarNearestDdayLabel = '', calendarNearestEvent = null, normalizedTargetMajor = '' }) {
  return (
    <button type="button" className="timer-v2-target-summary" data-action="goto" data-target="analysis">
      <span><small>1지망 목표</small><b>{normalizedTargetMajor || '희망 대학을 설정해주세요'}</b><em>오늘의 공부를 목표와 연결해보세요</em></span>
      <span><b>{calendarNearestDdayLabel || '일정'}</b><small>{calendarNearestEvent?.title || '입시 일정 확인'}</small></span>
    </button>
  );
}

export function HomeDashboard(props) {
  const { user, aquariumPresentation, normalizedTargetMajor, analysisScoreView, calendarNearestDdayLabel, calendarNearestEvent, studyOverview } = props;
  const forcedOpen = Boolean(props.studyStartBlocked || props.studyTimerRunning || props.timerPhase !== 'idle' || props.lastCompletedSession || props.rewardResult);
  return <main className="timer-screen-v2">
    <TimerHeader user={user} />
    <HomeStatusRail aquariumPresentation={aquariumPresentation} normalizedTargetMajor={normalizedTargetMajor} />
    <HomeTargetSummary analysisScoreView={analysisScoreView} calendarNearestDdayLabel={calendarNearestDdayLabel} calendarNearestEvent={calendarNearestEvent} normalizedTargetMajor={normalizedTargetMajor} />
    <section className="home-study-highlight" aria-label="오늘의 학습 지표"><StudyOverviewCard overview={studyOverview} scoreView={analysisScoreView} variant="banner" compact /></section>
    <HomePlannerPreview {...props} showStudyPanel={forcedOpen} />
    <HomeAquariumPreview presentation={aquariumPresentation} />
  </main>;
}
