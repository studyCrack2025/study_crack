import { Icon } from '../../components/Icon.jsx';
import { buildPlanPresentation } from './presentation.js';

const PROFILE_MENU = [
  { icon: 'user', label: '마이페이지 전체 보기', target: 'my' },
  { icon: 'shield', label: '계정정보 관리', target: 'accountInfo' },
  { icon: 'chart', label: '목표 대학 · 성적', target: 'scoreInfo' },
  { icon: 'bolt', label: '플랜 · 결제', target: 'proIntro' },
  { icon: 'bell', label: '알림', target: 'notificationList' },
  { icon: 'chat', label: '문의 · FAQ', target: 'customerSupport' }
];

function formatStudyDuration(seconds = 0) {
  const minutes = Math.floor(Math.max(0, Number(seconds) || 0) / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) return `${hours}시간 ${rest}분`;
  if (hours) return `${hours}시간`;
  return `${rest}분`;
}

function profileMeta(user = {}) {
  const qualitative = user?.qualitative && typeof user.qualitative === 'object' ? user.qualitative : {};
  const streamLabels = { humanities: '인문계', liberal: '인문계', natural: '자연계', science: '자연계' };
  const stream = streamLabels[String(qualitative.stream || '').trim().toLowerCase()] || qualitative.stream;
  return [qualitative.status, stream].filter(Boolean).join(' · ') || '학습 정보를 확인해보세요';
}

export function ProfileDrawer({ drawerOpen = false, gameProfile = null, gameProfileStatus = 'idle', selectedPlan = '', studySummary = null, studySummaryStatus = 'idle', user = {} }) {
  if (!drawerOpen) return null;
  const plan = buildPlanPresentation(user, selectedPlan);
  const summaryReady = studySummaryStatus === 'ready' && studySummary?.available !== false;
  const gameReady = gameProfileStatus === 'ready' && gameProfile;
  const weeklyStudy = summaryReady ? formatStudyDuration(studySummary?.week?.totalSeconds) : '불러오는 중';
  const shells = gameReady ? `${Math.max(0, Number(gameProfile.shellBalance) || 0)}개` : '확인 중';
  const streak = gameReady ? `${Math.max(0, Number(gameProfile.streakDays) || 0)}일` : '확인 중';
  const name = String(user?.name || '').trim() || '회원';
  return (
    <div className="sc-overlay drawer-overlay profile-drawer-overlay" data-action="closeDrawer">
      <aside className="side-drawer profile-drawer" data-action="noopModal" role="dialog" aria-modal="true" aria-label="프로필 메뉴">
        <header className="profile-drawer-head"><span>MY STUDYCRACK</span><button type="button" data-action="closeDrawer" aria-label="프로필 메뉴 닫기">×</button></header>
        <section className="profile-drawer-identity">
          <span className="profile-drawer-avatar">{user?.profileImage ? <img src={user.profileImage} alt="프로필 사진" /> : <Icon name="user" />}</span>
          <div><h2>{name}님</h2><p>{profileMeta(user)}</p><span className={`plan-${plan.key || 'none'}`}>{plan.label}</span></div>
        </section>
        <p className="profile-drawer-plan">{plan.periodLabel}</p>
        <section className="profile-drawer-stats" aria-label="공부와 수조 요약"><div><span>이번 주 공부</span><b>{weeklyStudy}</b></div><div><span>보유 조개</span><b>{shells}</b></div><div><span>연속 학습</span><b>{streak}</b></div></section>
        {studySummaryStatus === 'error' || gameProfileStatus === 'error' ? <p className="profile-drawer-resource-note">일부 공부·수조 통계는 잠시 표시할 수 없어요. 계정 기능은 계속 이용할 수 있습니다.</p> : null}
        <nav className="profile-drawer-menu" aria-label="마이 메뉴">{PROFILE_MENU.map((item) => <button type="button" data-action="drawerGoto" data-target={item.target} key={item.target}><span><Icon name={item.icon} /></span><b>{item.label}</b><Icon name="chevron" /></button>)}</nav>
      </aside>
    </div>
  );
}
