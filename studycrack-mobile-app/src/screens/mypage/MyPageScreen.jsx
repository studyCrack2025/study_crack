import { buildMyPagePresentation } from './presentation.js';
import { MyProfileHeader } from './MyProfileHeader.jsx';
import { MbtiInsightCard } from './MbtiInsightCard.jsx';
import { MyMenuList } from './MyMenuList.jsx';
import { MyPageOverlays } from './ProfileOverlays.jsx';

function MyStudyStats({ stats }) {
  return (
    <section className="my-study-stats" aria-label="내 학습 기록">
      {stats.map((stat) => <div key={stat.label}><span>{stat.label}</span><b>{stat.value}</b></div>)}
    </section>
  );
}

export function MyPageScreen(ctx) {
  const { dimmed = false, icon, mbtiResult, plannerItems, selectedPlan, studyRecords, studyTimerRunning, studyTimerSecondsRef, tabBarHtml = '', user } = ctx;
  const presentation = buildMyPagePresentation({
    liveStudySeconds: studyTimerRunning ? Number(studyTimerSecondsRef?.current) || 0 : 0,
    mbtiResult,
    plannerItems,
    selectedPlan,
    studyRecords,
    user
  });
  const overlayOpen = Boolean(ctx.profileDetailModalOpen || ctx.mbtiModalOpen);

  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${dimmed || overlayOpen ? 'modal-lock' : ''}`} data-screen="my">
          <main className="my-page">
            <MyProfileHeader icon={icon} presentation={presentation} />
            <MbtiInsightCard mbti={presentation.mbti} />
            <MyStudyStats stats={presentation.stats} />
            <MyMenuList icon={icon} />
          </main>
        </div>
        {overlayOpen ? <div className="app-screen-overlays" style={{ display: 'contents' }}><MyPageOverlays {...ctx} /></div> : null}
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: tabBarHtml }} />
      </div>
    </div>
  );
}
