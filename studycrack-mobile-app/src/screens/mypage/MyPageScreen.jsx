import { buildMyPagePresentation } from './presentation.js';
import { MyProfileHeader } from './MyProfileHeader.jsx';
import { MbtiInsightCard } from './MbtiInsightCard.jsx';
import { MyMenuList } from './MyMenuList.jsx';
import { MyPageOverlays } from './ProfileOverlays.jsx';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';

function MyStudyStats({ stats }) {
  return (
    <section className="my-study-stats" aria-label="내 학습 기록">
      {stats.map((stat) => <div key={stat.label}><span>{stat.label}</span><b>{stat.value}</b></div>)}
    </section>
  );
}

export function MyPageScreen(ctx) {
  const { dimmed = false, mbtiResult, plannerItems, selectedPlan, studyRecords, studyTimerRunning, studyTimerSecondsRef, tab = 'my', user } = ctx;
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
    <AppScreenShell
      screen="my"
      tab={tab}
      dimmed={dimmed || overlayOpen}
      overlays={overlayOpen ? <MyPageOverlays {...ctx} /> : null}
    >
          <main className="my-page">
            <MyProfileHeader presentation={presentation} />
            <MbtiInsightCard mbti={presentation.mbti} />
            <MyStudyStats stats={presentation.stats} />
            <MyMenuList />
          </main>
    </AppScreenShell>
  );
}
