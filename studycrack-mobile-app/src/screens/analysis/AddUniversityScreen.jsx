import { SecondaryIntro, SecondaryScreenShell, SecondaryState } from '../../components/SecondaryScreen.jsx';
import { Sheet } from '../../components/Sheet.jsx';
import { TargetAllowance } from './TargetAllowance.jsx';

function AddButton({ added, major, targetPolicy, addingUniversity }) {
  return <button type="button" className={`btn ${added ? 'btn-secondary' : 'btn-primary'} mini`} data-action="addAnalysisTarget" data-target-major={major} disabled={added || addingUniversity || targetPolicy?.canAdd === false}>{added ? '추가됨' : addingUniversity ? '저장 중' : '추가'}</button>;
}

function RecommendationRow({ analysisTargetList, name, targetPolicy, addingUniversity }) {
  const added = analysisTargetList.includes(name);
  return (
    <div className="sc-secondary-row add-univ-card">
      <div className="sc-secondary-row-main add-univ-item-text"><b>{name}</b><p>현재 성적 기준 우선 검토 대학</p></div>
      <span className="sc-badge">추천</span>
      <AddButton added={added} major={name} targetPolicy={targetPolicy} addingUniversity={addingUniversity} />
    </div>
  );
}

function SearchResult({ analysisTargetList, name, universitySelectedName, targetPolicy, addingUniversity }) {
  if (!universitySelectedName) {
    return (
      <button type="button" className="sc-secondary-row add-univ-university-row" data-action="selectUniversityForMajor" data-university-name={name}>
        <span className="add-univ-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 9-5 9 5H3ZM5 11v7m7-7v7m7-7v7M3 21h18M3 18h18" /></svg></span><span className="sc-secondary-row-main"><b>{name}</b><p>모집 학과 살펴보기</p></span><em aria-hidden="true">→</em>
      </button>
    );
  }
  return (
    <div className="sc-secondary-row add-univ-row">
      <div className="sc-secondary-row-main add-univ-item-text"><b>{name}</b><p>선택한 대학의 모집 학과</p></div>
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
    universityRecommendationStatus = 'idle'
  } = ctx;
  const recommendationState = analysisRecommended.length ? analysisRecommended.map((name) => <RecommendationRow analysisTargetList={analysisTargetList} name={name} key={name} targetPolicy={targetPolicy} addingUniversity={addingUniversity} />) : (
    <SecondaryState kind={universityRecommendationStatus === 'loading' ? 'loading' : universityRecommendationError ? 'error' : 'empty'} title={universityRecommendationStatus === 'loading' ? '추천 대학을 계산 중이에요' : universityRecommendationError ? '추천을 불러오지 못했어요' : '현재 조건에 맞는 추천이 없어요'} description={universityRecommendationError || (universityRecommendationStatus === 'loading' ? '선택한 시험의 저장된 성적을 확인하고 있어요.' : '이미 등록한 대학은 제외돼요. 성적을 확인하거나 아래에서 직접 추가할 수 있어요.')} />
  );
  return (
    <SecondaryScreenShell screen="addUniversity" title="대학 추가" tab={tab} overlayOpen={analysisSearchOpen} overlays={analysisSearchOpen ? <UniversitySearchSheet {...ctx} /> : null}>
          <div className="sc-secondary-page add-univ-page">
            <SecondaryIntro eyebrow="TARGET UNIVERSITY" title="희망 대학 추가" description="현재 성적 추천을 확인하거나 대학과 학과를 순서대로 직접 선택하세요." aside={<span className="sc-chip">최대 6개</span>} />
            <TargetAllowance policy={targetPolicy} showPlanAction={false} />
            {targetSaveError && !analysisSearchOpen ? <p className="add-univ-save-error" role="alert">{targetSaveError}</p> : null}
            <section className="sc-secondary-section add-univ-section">
              <div className="sc-secondary-section-head add-univ-head"><div><h3>현재 성적 기준 추천</h3><p>웹과 동일한 분석 로직으로 계산한 결과입니다.</p></div><button type="button" className="btn btn-secondary mini" data-action="refreshUniversityRecommendations" disabled={universityRecommendationStatus === 'loading'}>{universityRecommendationStatus === 'loading' ? '추천 중' : '새로고침'}</button></div>
              <div className="sc-secondary-list add-univ-grid">{recommendationState}</div>
            </section>
            <section className="sc-secondary-section add-univ-section">
              <div className="sc-secondary-section-head add-univ-head"><div><h3>원하는 대학이 있나요?</h3><p>대학 → 학과 순서로 검색하고 추가하세요.</p></div></div>
              <button type="button" className="btn btn-primary" data-action="openUniversitySearch" disabled={targetPolicy?.canAdd === false}>직접 추가하기 →</button>
              {!targetPolicy?.unlimited && targetPolicy?.remaining === 0 ? <button type="button" className="btn btn-secondary" data-action="goto" data-target="proIntro">플랜 선택하기 →</button> : null}
            </section>
          </div>
    </SecondaryScreenShell>
  );
}
