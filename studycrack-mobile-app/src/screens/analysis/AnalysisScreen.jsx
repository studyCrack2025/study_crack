import { AnalysisContent, AnalysisSearchSheet } from './AnalysisContent.jsx';
import { AppScreenShell } from '../../components/AppScreenShell.jsx';
import { PrimaryScreenHeader } from '../../components/PrimaryScreenHeader.jsx';

export function AnalysisScreen(ctx) {
  const {
    dimmed = false,
    isAnalyzing = false,
    analysisApiStatus = 'idle',
    analysisApiError = '',
    analysisSearchOpen = false,
    tab = 'analysis'
  } = ctx;

  const isStale = analysisApiStatus === 'stale';
  const hasAnalysisError = Boolean(analysisApiError) && ['error', 'stale', 'empty'].includes(analysisApiStatus);

  return (
    <AppScreenShell
      screen="analysis"
      tab={tab}
      dimmed={dimmed}
      overlayOpen={analysisSearchOpen}
      overlays={analysisSearchOpen ? <AnalysisSearchSheet {...ctx} /> : null}
    >
          <section className={`analysis-v2 ${isAnalyzing ? 'loading' : 'ready'}`}>
            <div className="analysis-content-stage">
              <PrimaryScreenHeader className="analysis-context-head" eyebrow="대학별 성적 분석" title="환산점수 분석" />
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
          </section>
    </AppScreenShell>
  );
}
