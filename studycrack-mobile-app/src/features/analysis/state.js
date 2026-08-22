import { createFeatureSlice } from '../../state/create-feature-slice.js';
import { normalizeTargetUnivSlots } from './target-model.js';

const DEFAULT_SCORE_STATE = {
  korean: { type: '', common: '', elective: '' },
  math: { type: '', common: '', elective: '' },
  english: '',
  history: '',
  inquiry1: { subject: '', score: '' },
  inquiry2: { subject: '', score: '' }
};

const DEFAULT_SCORE_EDIT_STATE = {
  korean: { type: '화법과작문', common: '', elective: '' },
  math: { type: '확률과통계', common: '', elective: '' },
  english: '',
  history: '',
  inquiry1: { subject: '', score: '' },
  inquiry2: { subject: '', score: '' }
};

export function createAnalysisInitialState() {
  return {
    serverResource: {
      analysisTargetList: [],
      homeTargetList: [],
      targetUnivSlots: normalizeTargetUnivSlots([]),
      universityCatalog: [],
      universityCatalogStatus: 'idle',
      universityCatalogError: '',
      universityCatalogRetryTick: 0,
      universityRecommendations: [],
      universityRecommendationStatus: 'idle',
      universityRecommendationError: '',
      universityRecommendationRetryTick: 0,
      analysisResults: [],
      analysisSimulations: [],
      analysisResultExamMode: '',
      analysisResultSignature: '',
      analysisApiStatus: 'idle',
      analysisApiError: '',
      analysisBacktraceStatus: 'idle',
      analysisBacktracePlan: null,
      analysisBacktraceError: '',
      analysisBacktraceSignature: '',
      lastAnalysisSnapshot: null,
      scoreCache: {},
      scoreFetchStatus: 'idle',
      scoreFetchSignature: '',
      scoreFetchRetryTick: 0,
      scores: {}
    },
    localDraft: {
      targetMajor: '',
      analysisSearchTerm: '',
      universitySelectedName: '',
      scoreState: structuredClone(DEFAULT_SCORE_STATE),
      scoreEditState: structuredClone(DEFAULT_SCORE_EDIT_STATE),
      scoreExamType: '3월 모의고사',
      scoreExamKey: 'mar'
    },
    ephemeralUi: {
      analysisCalculationRequested: false,
      targetOpen: false,
      selectedUniversityIndex: 0,
      targetDeleteModalOpen: false,
      targetDeleteCandidate: '',
      targetDeleteSaving: false,
      targetDeleteError: '',
      analysisSearchOpen: false,
      analysisEtaStage: 1,
      analysisHighlightedSubject: '',
      analysisBarProjectionTarget: '',
      activeScoreView: 'target',
      universityModalOpen: false,
      analysisSelectedIndex: 0,
      addingUniversity: false,
      homeSlideIndex: 0,
      homeSlideMotion: '',
      scoreSlideMotion: '',
      homeDragOffset: 0,
      scoreDragOffset: 0,
      scoreEditOpen: false,
      scoreEditStep: 1,
      scoreSubjectSaving: false
    }
  };
}

export const analysisSlice = createFeatureSlice('analysis', createAnalysisInitialState);
