import { AnalysisContent, AnalysisSearchSheet } from './AnalysisContent.jsx';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { AppContextHeader } from '../../components/AppContextHeader.jsx';

export function AnalysisScreen(ctx) {
  const {
    dimmed = false,
    isAnalyzing = false,
    analysisApiStatus = 'idle',
    analysisApiError = '',
    tab = 'analysis'
  } = ctx;

  const isStale = analysisApiStatus === 'stale';
  const hasAnalysisError = Boolean(analysisApiError) && ['error', 'stale', 'empty'].includes(analysisApiStatus);
  const showAnalysisBody = !isAnalyzing;

  return (
    <AppScreenShell
      screen="analysis"
      tab={tab}
      dimmed={dimmed}
      overlays={<AnalysisSearchSheet {...ctx} />}
    >
          <section className={`analysis-v2 ${isAnalyzing ? 'loading' : 'ready'}`}>
            {isAnalyzing ? (
              <div className="analysis-loading-stage" role="status" aria-live="polite">
                <div className="analysis-loading-panel">
                  <div className="analysis-loading-orbit">
                    <i />
                    <i />
                    <i />
                  </div>
                  <div>
                    <span>환산 분석 진행 중</span>
                    <b>목표 대학 기준 환산점수를 계산하고 있어요</b>
                    <p>현재 점수와 과목별 원점수 1점 효과를 확인합니다.</p>
                  </div>
                </div>
              </div>
            ) : null}

            {showAnalysisBody ? (
              <div className="analysis-content-stage">
                <AppContextHeader className="analysis-context-head" description="환산점수와 과목별 효율을 한눈에 확인하세요." eyebrow="대학별 성적 분석" icon="chart" title="분석" />
                {isStale && (
                  <div className="analysis-stale-note" role="status" aria-live="polite">
                    <i aria-hidden="true" />
                    <div><b>이전 분석 결과를 먼저 보여드리고 있어요</b><span>{analysisApiError || '새 기준으로 계산이 끝나면 결과가 자동으로 갱신됩니다.'}</span></div>
                  </div>
                )}
                {hasAnalysisError && !isStale && (
                  <div className="analysis-stale-note error" role="status" aria-live="polite">
                    <i aria-hidden="true" />
                    <div><b>분석 결과를 불러오지 못했습니다</b><span>{analysisApiError}</span></div>
                  </div>
                )}
                <div className="analysis-result-stage" style={{ display: 'contents' }}><AnalysisContent {...ctx} /></div>
              </div>
            ) : null}
          </section>
    </AppScreenShell>
  );
}
