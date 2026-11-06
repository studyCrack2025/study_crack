import { SecondaryIntro, SecondaryScreenShell, SecondaryState } from '../../components/SecondaryScreen.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { TargetAllowance } from './TargetAllowance.jsx';

function AddButton({ added, major, targetPolicy, addingUniversity }) {
  return <button type="button" className={`btn ${added ? 'btn-secondary' : 'btn-primary'} mini`} data-action="addAnalysisTarget" data-target-major={major} disabled={added || addingUniversity || targetPolicy?.canAdd === false}>{added ? '추가됨' : addingUniversity ? '저장 중' : '추가'}</button>;
}

const recommendationBands = { safe: '안정', match: '적정', reach: '상향' };

function recommendationDiagnosticText(summary) {
  const diagnostic = summary?.diagnostics;
  if (!diagnostic || diagnostic.version !== 'diagnostics-v1') return '';
  const messages = new Map([
      ['NO_PREPARED_CANDIDATES', '선택한 계열의 추천 자료를 준비하지 못했습니다. 잠시 후 다시 확인해 주세요.'],
      ['REVIEWED_CANDIDATES_UNAVAILABLE', '검수 기준에 따라 현재 추천에 포함할 후보가 없습니다.'],
      ['NO_ADMISSION_FILTER_MATCH', '선택한 연도·지역·모집군에 맞는 검수 후보가 없습니다.'],
      ['CANDIDATE_EVALUATION_FAILED', '일부 후보를 계산하지 못했습니다. 잠시 후 다시 확인해 주세요.'],
      ['SUBJECT_REQUIREMENTS_NOT_MET', '선택과목 조건으로 후보가 제외되었습니다. 저장한 과목을 확인해 주세요.'],
      ['MINIMUM_CURRENT_SCORE_NOT_MET', '설정한 현재 점수 기준으로 후보가 제외되었습니다.'],
      ['MATCHES_EXCLUDED_BY_REQUEST', '제외 목록에 포함된 후보는 표시하지 않았습니다.'],
      ['SIMULATION_CHECK_FAILED', '일부 후보의 상승 점수를 계산하지 못했습니다. 잠시 후 다시 확인해 주세요.'],
      ['MINIMUM_SIMULATION_SCORE_NOT_MET', '설정한 상승 후 점수 기준으로 후보가 제외되었습니다.'],
      ['REQUESTED_BANDS_UNAVAILABLE', '요청한 안정·적정·상향 구성을 채울 후보가 부족합니다.'],
      ['PAGE_EXHAUSTED', '현재 조건에 맞는 후보를 모두 확인했습니다.'],
      ['INSUFFICIENT_MATCHES', '현재 조건을 모두 충족하는 후보가 요청한 수보다 적습니다.'],
      ['CANDIDATE_DATA_GAPS', '일부 후보의 자료를 확인하지 못해 확인 가능한 후보만 표시했습니다.'],
      ['SIMULATION_DATA_UNAVAILABLE', '원점수 상승 자료가 없어 현재 점수로 비교했습니다.']
  ]);
  const reasons = Array.isArray(diagnostic.reasonCodes) ? diagnostic.reasonCodes.slice(0, 16) : [];
  const notices = Array.isArray(diagnostic.noticeCodes) ? diagnostic.noticeCodes.slice(0, 16) : [];
  const codes = [...reasons, ...notices.filter(code => code !== 'SIMULATION_DATA_UNAVAILABLE'
      || reasons.includes('MINIMUM_SIMULATION_SCORE_NOT_MET'))];
  return [...new Set(codes.filter(code => typeof code === 'string').map(code => messages.get(code)).filter(Boolean))].slice(0, 2).join(' ');
}

function simulationLabel(detail) {
  const subject = new Map([['kor', '국어'], ['math', '수학'], ['inq1', '탐구1'], ['inq2', '탐구2']]).get(detail?.subject);
  if (detail?.status === 'available' && subject && Number.isInteger(detail.rawIncrease) && detail.rawIncrease >= 1 && detail.rawIncrease <= 5
    && typeof detail.uiGain === 'number' && Number.isFinite(detail.uiGain) && detail.uiGain > 0) {
    const estimated = detail.rawSource === 'percentile_estimate' || detail.combinationEstimated === true;
    return `${estimated ? '추정 기준 · ' : ''}${subject} 원점수 +${detail.rawIncrease}점 → 표시 점수 +${detail.uiGain}점`;
  }
  return detail?.status === 'unavailable' ? '원점수 상승 자료 없음 · 현재 점수 기준 추천'
    : detail?.status === 'at_maximum' ? '확인 가능한 원점수는 만점입니다.'
      : detail?.status === 'no_gain' ? '원점수 +1~5점 범위에서 표시 점수 변화 없음' : '';
}

function RecommendationRow({ analysisTargetList, name, detail, targetPolicy, addingUniversity }) {
  const added = analysisTargetList.includes(name);
  return (
    <div className="sc-secondary-row add-univ-card">
      <div className="sc-secondary-row-main add-univ-item-text"><b>{name}</b>{detail ? <div className="add-univ-recommendation-detail"><span>환산점수 {detail.convertedScore}</span><span>예상 컷 {detail.estimatedCut} · 차이 {detail.marginToCut > 0 ? '+' : ''}{detail.marginToCut}</span><span>선택과목 조건을 충족한 후보</span>{simulationLabel(detail.simulation) ? <span>{simulationLabel(detail.simulation)}</span> : null}</div> : null}</div>
      <div className="add-univ-recommendation-actions"><span className="sc-badge">{recommendationBands[detail?.band] || '추천'}</span><AddButton added={added} major={name} targetPolicy={targetPolicy} addingUniversity={addingUniversity} /></div>
    </div>
  );
}

function SearchResult({ analysisTargetList, name, universitySelectedName, targetPolicy, addingUniversity }) {
  if (!universitySelectedName) {
    return (
      <button type="button" className="sc-secondary-row add-univ-university-row" data-action="selectUniversityForMajor" data-university-name={name}>
        <span className="add-univ-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 9-5 9 5H3ZM5 11v7m7-7v7m7-7v7M3 21h18M3 18h18" /></svg></span><span className="sc-secondary-row-main"><b>{name}</b></span><em aria-hidden="true">→</em>
      </button>
    );
  }
  return (
    <div className="sc-secondary-row add-univ-row">
      <div className="sc-secondary-row-main add-univ-item-text"><b>{name}</b></div>
      <AddButton added={analysisTargetList.includes(name)} major={name} targetPolicy={targetPolicy} addingUniversity={addingUniversity} />
    </div>
  );
}

function CatalogResults(ctx) {
  const {
    analysisSearchList = [],
    analysisTargetList = [],
    universityCatalogError = '',
    universityCatalogStatus = 'idle',
    universitySelectedName = ''
  } = ctx;
  if (universityCatalogStatus === 'idle' || universityCatalogStatus === 'loading') {
    return <SecondaryState kind="loading" title="대학·학과 목록을 불러오고 있어요" description="잠시만 기다려주세요." />;
  }
  if (universityCatalogStatus === 'error') {
    return <SecondaryState kind="error" title="대학·학과 목록을 불러오지 못했어요" description={universityCatalogError || '네트워크 상태를 확인한 뒤 다시 시도해주세요.'} action={<button type="button" className="btn btn-secondary mini add-univ-retry" data-action="retryUniversityCatalog">다시 시도</button>} />;
  }
  if (!analysisSearchList.length) {
    return <SecondaryState kind="empty" title="검색 결과가 없어요" description={universitySelectedName ? '학과명을 다시 확인하거나 다른 대학을 선택해주세요.' : '대학명을 다시 확인해주세요.'} />;
  }
  return analysisSearchList.map((name) => <SearchResult {...ctx} analysisTargetList={analysisTargetList} name={name} universitySelectedName={universitySelectedName} key={name} />);
}

function UniversitySearchSheet(ctx) {
  const { analysisSearchOpen, analysisSearchTerm, universitySelectedName, targetSaveError, addingUniversity, analysisSearchList = [], universityCatalogStatus } = ctx;
  return <Sheet open={analysisSearchOpen} variant="planner" overlayClass="analysis-search-overlay" panelClass="analysis-search-modal" dismissAction="closeAnalysisSearch" ariaLabel="대학·학과 직접 추가">
    <div className="sc-sheet-head analysis-search-head add-univ-modal-head"><h4>{universitySelectedName ? '학과 선택' : '대학 선택'}</h4><button type="button" className="sc-overlay-close" data-action="closeAnalysisSearch" aria-label="닫기">✕</button></div>
    <div className="sc-sheet-body analysis-search-body">
      <ol className="add-univ-steps" aria-label="추가 단계"><li aria-current={!universitySelectedName ? 'step' : undefined} data-complete={Boolean(universitySelectedName)}><span aria-hidden="true">{universitySelectedName ? '✓' : '1'}</span>대학 선택</li><li aria-current={universitySelectedName ? 'step' : undefined}><span aria-hidden="true">2</span>학과 선택</li></ol>
      {universitySelectedName ? <div className="add-univ-selection"><button type="button" className="add-univ-back" data-action="backToUniversityList">← 대학 다시 선택</button><b>{universitySelectedName}</b></div> : null}
      <div className="analysis-search-inline"><input key={universitySelectedName || 'universities'} className="planner-input sc-input add-univ-search" data-field="analysisSearchTerm" defaultValue={analysisSearchTerm} aria-label={universitySelectedName ? '학과명 검색' : '대학명 검색'} placeholder={universitySelectedName ? '학과명 검색' : '대학명 검색'} autoComplete="off" enterKeyHint="search" /><button type="button" className="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div>
      {targetSaveError ? <p className="add-univ-save-error" role="alert">{targetSaveError}</p> : null}
      {addingUniversity ? <p role="status">대학을 저장하고 있어요.</p> : null}
      <div className="add-univ-results-heading"><b>{universitySelectedName ? '학과 목록' : '대학 목록'}</b><span role="status">{universityCatalogStatus === 'ready' ? `${analysisSearchList.length}개 표시 중` : '검색할 대학·학과를 확인하세요'}</span></div>
      <div className="sc-secondary-list add-univ-results"><CatalogResults {...ctx} /></div>
    </div>
  </Sheet>;
}

export function AddUniversityScreen(ctx) {
  const {
    analysisRecommended = [],
    analysisTargetList = [],
    analysisSearchOpen = false,
    targetPolicy,
    targetSaveError = '',
    addingUniversity = false,
    tab = 'analysis',
    universityRecommendationError = '',
    universityRecommendationDetails = [],
    universityRecommendationSummary = null,
    universityRecommendationStatus = 'idle'
  } = ctx;
  const missing = universityRecommendationSummary?.missing;
  const shortage = missing ? Object.entries(recommendationBands).filter(([key]) => Number.isSafeInteger(missing[key]) && missing[key] > 0)
    .map(([key, label]) => `${label} ${missing[key]}개`).join(' · ') : '';
  const diagnostic = universityRecommendationStatus !== 'loading' && !universityRecommendationError
    ? recommendationDiagnosticText(universityRecommendationSummary) : '';
  const recommendationState = analysisRecommended.length ? analysisRecommended.map((name) => <RecommendationRow analysisTargetList={analysisTargetList} name={name} detail={universityRecommendationDetails.find(item => item.label === name)} key={name} targetPolicy={targetPolicy} addingUniversity={addingUniversity} />) : (
    <SecondaryState kind={universityRecommendationStatus === 'loading' ? 'loading' : universityRecommendationError ? 'error' : 'empty'} title={universityRecommendationStatus === 'loading' ? '추천 대학을 계산 중이에요' : universityRecommendationError ? '추천을 불러오지 못했어요' : diagnostic ? '추천 결과를 확인해 주세요' : '현재 조건에 맞는 추천이 없어요'} description={universityRecommendationError || (universityRecommendationStatus === 'loading' ? '선택한 시험의 저장된 성적을 확인하고 있어요.' : diagnostic || '이미 등록한 대학은 제외돼요. 성적을 확인하거나 아래에서 직접 추가할 수 있어요.')} />
  );
  return (
    <SecondaryScreenShell screen="addUniversity" title="대학 추가" tab={tab} overlayOpen={analysisSearchOpen} overlays={analysisSearchOpen ? <UniversitySearchSheet {...ctx} /> : null}>
          <div className="sc-secondary-page add-univ-page">
            <SecondaryIntro eyebrow="TARGET UNIVERSITY" title="희망 대학 추가" aside={<span className="sc-chip">최대 6개</span>} />
            <TargetAllowance policy={targetPolicy} showPlanAction={false} />
            {targetSaveError && !analysisSearchOpen ? <p className="add-univ-save-error" role="alert">{targetSaveError}</p> : null}
            <section className="sc-secondary-section add-univ-section">
              <div className="sc-secondary-section-head add-univ-head"><div><h3>현재 성적 기준 추천</h3></div><button type="button" className="btn btn-secondary mini" data-action="refreshUniversityRecommendations" disabled={universityRecommendationStatus === 'loading'}>{universityRecommendationStatus === 'loading' ? '추천 중' : universityRecommendationStatus === 'exhausted' ? '처음 추천 다시 보기' : universityRecommendationStatus === 'error' ? '다시 시도' : '다른 후보 보기'}</button></div>
              <p className="add-univ-recommendation-note">안정·적정·상향은 표시 점수 기준 분류이며 합격 확률이 아닙니다.</p>
              {analysisRecommended.length && (diagnostic || shortage) ? <p className="add-univ-recommendation-note" role="status">{[diagnostic, shortage ? `조건에 맞는 후보 부족: ${shortage}. 다른 분류로 채우지 않았어요.` : ''].filter(Boolean).join(' ')}</p> : null}
              <div className="sc-secondary-list add-univ-grid">{recommendationState}</div>
            </section>
            <section className="sc-secondary-section add-univ-section">
              <div className="sc-secondary-section-head add-univ-head"><div><h3>원하는 대학이 있나요?</h3></div></div>
              <button type="button" className="btn btn-primary" data-action="openUniversitySearch" disabled={targetPolicy?.canAdd === false}>직접 추가하기 →</button>
              {!targetPolicy?.unlimited && targetPolicy?.remaining === 0 ? <button type="button" className="btn btn-secondary" data-action="goto" data-target="proIntro">플랜 선택하기 →</button> : null}
            </section>
          </div>
    </SecondaryScreenShell>
  );
}
