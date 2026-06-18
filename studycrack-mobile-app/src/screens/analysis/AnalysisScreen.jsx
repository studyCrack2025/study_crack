import {
  renderAnalysisSearchModal,
  renderSimulationMode,
  renderSummaryMode
} from './renderers.js';

// analysis 화면의 React-트리(JSX) 버전. 탭/상단 shell은 React 노드로 유지하고,
// 아직 JSX로 풀지 않은 세부 요약·시뮬레이션·검색 모달은 기존 문자열 renderer를 leaf로 임베드한다.
// 이렇게 하면 analysisMode 전환 시 화면 컨테이너와 탭 DOM은 유지되고, 나머지는 기존 동작을 보존한다.
export function AnalysisScreen(ctx) {
  const {
    analysisMode = 'summary',
    dimmed = false,
    isAnalyzing = false,
    tabBarHtml = ''
  } = ctx;

  const modeBodyHtml = analysisMode === 'summary'
    ? renderSummaryMode(ctx)
    : renderSimulationMode(ctx);
  const searchModalHtml = renderAnalysisSearchModal(ctx);

  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className={`screen app-screen app-content ${dimmed ? 'modal-lock' : ''}`}>
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

            <div className="analysis-v2-tabs">
              <button
                className={`analysis-v2-tab ${analysisMode === 'summary' ? 'active' : ''}`}
                data-action="setAnalysisMode"
                data-analysis-mode="summary"
              >
                전략 요약
              </button>
              <button
                className={`analysis-v2-tab ${analysisMode === 'simulation' ? 'active' : ''}`}
                data-action="setAnalysisMode"
                data-analysis-mode="simulation"
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
