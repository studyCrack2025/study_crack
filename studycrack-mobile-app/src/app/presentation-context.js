import { buildStudyOverview } from '../features/study/overview-presentation.js';
import { aquariumShareText, buildAquariumPresentation } from '../features/gamification/aquarium-presentation.js';
import { TODAY_DATE } from '../constants/runtime-defaults.js';
import { buildMyPagePresentation } from '../screens/mypage/presentation.js';
import { buildStreakPresentation } from '../features/gamification/streak-presentation.js';
import { buildAnalysisSnapshot } from '../screens/analysis/snapshot.js';

export function buildAppPresentations({ state, derived, liveSeconds }) {
  const plannerItems = Array.isArray(derived.todayPlannerItems) ? derived.todayPlannerItems.map(item => ({ ...item, date: TODAY_DATE })) : undefined;
  const studyOverview = buildStudyOverview({ ...state, plannerItems, localDate: TODAY_DATE, liveSeconds });
  const aquariumPresentation = buildAquariumPresentation({ ...state, todayPlannerItems: derived.todayPlannerItems, planner: studyOverview.planner });
  const myPresentation = buildMyPagePresentation({ ...state, studyOverview, aquariumPresentation });
  return { studyOverview, aquariumPresentation, myPresentation, analysisPresentation: buildAnalysisSnapshot(state), streakPresentation: buildStreakPresentation(state), aquariumShareText: aquariumShareText(aquariumPresentation) };
}
