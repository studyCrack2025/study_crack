import {
  renderAnalysisSearchModal,
  renderSimulationMode,
  renderSummaryMode
} from './renderers.js';
import { EXAM_OPTIONS } from '../../constants/options.js';

// analysis 화면의 React-트리(JSX) 버전. 탭/상단 shell은 React 노드로 유지하고,
// 아직 JSX로 풀지 않은 세부 요약·시뮬레이션·검색 모달은 기존 문자열 renderer를 leaf로 임베드한다.
// 이렇게 하면 analysisMode 전환 시 화면 컨테이너와 탭 DOM은 유지되고, 나머지는 기존 동작을 보존한다.
export function AnalysisScreen(ctx) {
  const {
    analysisMode = 'summary',
    canAccessStandard = false,
    canUseScoreSimulation = canAccessStandard,
    dimmed = false,
    isAnalyzing = false,
    analysisApiStatus = 'idle',
    scoreExamType = '',
    tabBarHtml = ''
  } = ctx;

  const effectiveMode = canUseScoreSimulation ? analysisMode : 'summary';
  const isStale = analysisApiStatus === 'stale';
  const modeBodyHtml = effectiveMode === 'summary'
    ? renderSummaryMode(ctx)
    : renderSimulationMode(ctx);
  const searchModalHtml = renderAnalysisSearchModal(ctx);

  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${dimmed ? 'modal-lock' : ''}`} data-screen="analysis">
          <section className={`analysis-v2 ${isAnalyzing ? 'loading' : ''}`}>
            <div className="card analysis-v2-head">
              <div className="top-card-head">
                <div>
                  <h3>분석</h3>
                  <p>결과를 보고, 전략을 이해하고, 바로 실행으로 연결하세요.</p>
                </div>
                <span className="top-infographic top-infographic-analysis" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>

            {isAnalyzing && (
              <div className="analysis-loading-panel" role="status" aria-live="polite">
                <div className="analysis-loading-orbit">
                  <i />
                  <i />
                  <i />
                </div>
                <div>
                  <span>AI 분석 진행 중</span>
                  <b>목표 대학 기준으로 합격 가능성을 계산하고 있어요</b>
                  <p>성적, 목표 대학, 과목별 효율을 순서대로 확인합니다.</p>
                </div>
              </div>
            )}

            {isStale && (
              <div className="analysis-stale-note" role="status" aria-live="polite">
                <i aria-hidden="true" />
                <div>
                  <b>이전 분석 결과를 먼저 보여드리고 있어요</b>
                  <span>새 기준으로 계산이 끝나면 결과가 자동으로 갱신됩니다.</span>
                </div>
              </div>
            )}

            <div className="analysis-exam-picker">
              <div>
                <b>분석 기준 시험</b>
                <span>홈과 분석 결과가 같은 시험 기준으로 계산됩니다.</span>
              </div>
              <select className="planner-input" data-field="scoreExamType" defaultValue={scoreExamType}>
                {EXAM_OPTIONS.map((label) => (
                  <option value={label} key={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="analysis-v2-tabs">
              <button
                className={`analysis-v2-tab ${effectiveMode === 'summary' ? 'active' : ''}`}
                data-action="setAnalysisMode"
                data-analysis-mode="summary"
              >
                전략 요약
              </button>
              <button
                className={`analysis-v2-tab ${effectiveMode === 'simulation' ? 'active' : ''} ${canUseScoreSimulation ? '' : 'locked'}`}
                data-action={canUseScoreSimulation ? 'setAnalysisMode' : 'goto'}
                data-analysis-mode="simulation"
                data-target={canUseScoreSimulation ? undefined : 'proIntro'}
              >
                점수 상승 시뮬레이션
              </button>
            </div>

            <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: modeBodyHtml }} />
            <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: searchModalHtml }} />
          </section>
        </div>
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: tabBarHtml }} />
      </div>
    </div>
  );
}
