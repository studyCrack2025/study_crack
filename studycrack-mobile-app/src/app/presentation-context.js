import { buildStudyOverview } from '../features/study/overview-presentation.js';
import { aquariumShareText, buildAquariumPresentation } from '../features/gamification/aquarium-presentation.js';
import { TODAY_DATE } from '../constants/runtime-defaults.js';
import { buildMyPagePresentation } from '../screens/mypage/presentation.js';
import { buildStreakPresentation } from '../features/gamification/streak-presentation.js';
import { buildAnalysisSnapshot } from '../screens/analysis/snapshot.js';
import { buildTargetPolicy } from '../features/analysis/target-policy.js';

function analysisCalculationPatch(current) {
  return { analysisCalculationRequested: true, analysisApiStatus: 'loading', analysisApiError: '', analysisResults: [], analysisSimulations: [], analysisSimulationStatus: 'idle', analysisResultSignature: '', scoreFetchStatus: 'idle', scoreFetchSignature: '', scoreFetchRetryTick: Number(current.scoreFetchRetryTick || 0) + 1, analysisBacktraceStatus: 'idle', analysisBacktracePlan: null, analysisBacktraceError: '', analysisBacktraceSignature: '' };
}


function buildDefaultCoachingSubjects(derived = {}) {
  const { todayPlannerItems = [], todayStudySeconds = 0, todaySubjectsWithTimer = {} } = derived;
  const rows = todayPlannerItems.map((item, index) => {
    const subject = item.subject || '기타';
    const plannedHour = Number(item.minutes || 0) / 60;
    const actualHour = Number(todaySubjectsWithTimer[subject] || 0) / 3600;
    return {
      id: `plan-${index}-${subject}`,
      sourceId: item.id || `plan-${index}`,
      subject,
      detail: item.content || '',
      planned: plannedHour ? plannedHour.toFixed(1) : '',
      actual: actualHour ? actualHour.toFixed(1) : '',
      removable: true,
      placeholder: '세부과목 입력'
    };
  });
  if (rows.length) return rows;
  return ['국어', '수학', '영어', '탐구', '기타'].map((subject) => {
    const actualHour = (Number(todaySubjectsWithTimer[subject] || 0) || Number(todayStudySeconds || 0)) / 3600;
    const placeholders = {
      국어: '세부과목 (예: 언매)',
      수학: '세부과목 (예: 미적)',
      영어: '세부과목 (예: 독해)',
      탐구: '세부과목 (예: 생1)'
    };
    return {
      id: `${subject}-base`,
      sourceId: `${subject}-base`,
      subject,
      detail: '',
      planned: '',
      actual: actualHour ? actualHour.toFixed(1) : '',
      removable: subject === '기타',
      placeholder: placeholders[subject] || '세부과목 입력'
    };
  });
}

export function buildAppPresentations({ state, derived, liveSeconds }) {
  const plannerItems = Array.isArray(derived.todayPlannerItems) ? derived.todayPlannerItems.map(item => ({ ...item, date: TODAY_DATE })) : undefined;
  const studyOverview = buildStudyOverview({ ...state, plannerItems, localDate: TODAY_DATE, liveSeconds });
  const aquariumPresentation = buildAquariumPresentation({ ...state, todayPlannerItems: derived.todayPlannerItems, planner: studyOverview.planner });
  const myPresentation = buildMyPagePresentation({ ...state, studyOverview, aquariumPresentation });
  return { analysisResetPatch: { analysisSimulationStatus: 'idle', analysisHighlightedSubject: '', analysisCalculationRequested: false, analysisApiStatus: 'idle', analysisApiError: '', scoreFetchStatus: 'idle', scoreFetchSignature: '' }, analysisCalculationPatch, buildDefaultCoachingSubjects: () => buildDefaultCoachingSubjects(derived), studyOverview, aquariumPresentation, myPresentation, targetPolicy: buildTargetPolicy(state), analysisPresentation: buildAnalysisSnapshot(state), streakPresentation: buildStreakPresentation(state), aquariumShareText: aquariumShareText(aquariumPresentation) };
}
