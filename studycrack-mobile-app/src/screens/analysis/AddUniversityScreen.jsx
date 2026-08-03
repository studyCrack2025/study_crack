import { SecondaryIntro } from '../../components/SecondaryScreen.jsx';

function ScreenState({ action = null, description = '', kind = 'empty', title }) {
  return (
    <div className={`sc-secondary-state is-${kind}`} role="status">
      <span aria-hidden="true">{kind === 'loading' ? <i /> : kind === 'error' ? '!' : '—'}</span>
      <div><b>{title}</b>{description ? <p>{description}</p> : null}{action}</div>
    </div>
  );
}

function AddButton({ added, major }) {
  return <button type="button" className={`btn ${added ? 'btn-secondary' : 'btn-primary'} mini`} data-action="addAnalysisTarget" data-target-major={major} disabled={added}>{added ? '추가됨' : '추가'}</button>;
}

function RecommendationRow({ analysisTargetList, name }) {
  const added = analysisTargetList.includes(name);
  return (
    <div className="sc-secondary-row add-univ-card">
      <div className="sc-secondary-row-main add-univ-item-text"><b>{name}</b><p>현재 성적 기준 우선 검토 대학</p></div>
      <span className="sc-badge">추천</span>
      <AddButton added={added} major={name} />
    </div>
  );
}

function SearchResult({ analysisTargetList, name, universitySelectedName }) {
  if (!universitySelectedName) {
    return (
      <button type="button" className="sc-secondary-row add-univ-university-row" data-action="selectUniversityForMajor" data-university-name={name}>
        <span className="sc-secondary-row-main"><b>{name}</b><p>학과 목록 보기</p></span><em>다음</em>
      </button>
    );
  }
  return (
    <div className="sc-secondary-row add-univ-row">
      <div className="sc-secondary-row-main add-univ-item-text"><b>{name}</b><p>선택한 대학의 모집 학과</p></div>
      <AddButton added={analysisTargetList.includes(name)} major={name} />
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
    return <ScreenState kind="loading" title="대학·학과 목록을 불러오고 있어요" description="잠시만 기다려주세요." />;
  }
  if (universityCatalogStatus === 'error') {
    return <ScreenState kind="error" title="대학·학과 목록을 불러오지 못했어요" description={universityCatalogError || '네트워크 상태를 확인한 뒤 다시 시도해주세요.'} action={<button type="button" className="btn btn-secondary mini add-univ-retry" data-action="retryUniversityCatalog">다시 시도</button>} />;
  }
  if (!analysisSearchList.length) {
    return <ScreenState kind={universitySelectedName ? 'error' : 'empty'} title={universitySelectedName ? '학과 목록을 확인하지 못했어요' : '검색 결과가 없어요'} description={universitySelectedName ? '대학 목록을 다시 불러오거나 대학을 다시 선택해주세요.' : '대학명을 다시 확인해주세요.'} />;
  }
  return analysisSearchList.map((name) => <SearchResult analysisTargetList={analysisTargetList} name={name} universitySelectedName={universitySelectedName} key={name} />);
}

export function AddUniversityScreen(ctx) {
  const {
    analysisRecommended = [],
    analysisSearchTerm = '',
    analysisTargetList = [],
    tabBarHtml = '',
    universityRecommendationError = '',
    universityRecommendationStatus = 'idle',
    universitySelectedName = ''
  } = ctx;
  const recommendationState = analysisRecommended.length ? analysisRecommended.map((name) => <RecommendationRow analysisTargetList={analysisTargetList} name={name} key={name} />) : (
    <ScreenState kind={universityRecommendationStatus === 'loading' ? 'loading' : universityRecommendationError ? 'error' : 'empty'} title={universityRecommendationStatus === 'loading' ? '추천 대학을 계산 중이에요' : universityRecommendationError || '추천 결과가 아직 없어요'} description="성적 입력 상태를 확인한 뒤 다시 추천을 요청해주세요." />
  );
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div className="screen app-screen app-content" data-screen="addUniversity">
          <div className="appbar"><button type="button" className="back-btn" data-action="back" aria-label="뒤로가기">←</button><div className="title">대학 추가</div></div>
          <div className="sc-secondary-page add-univ-page">
            <SecondaryIntro eyebrow="TARGET UNIVERSITY" title="희망 대학 추가" description="현재 성적 추천을 확인하거나 대학과 학과를 순서대로 직접 선택하세요." aside={<span className="sc-chip">최대 6개</span>} />
            <section className="sc-secondary-section add-univ-section">
              <div className="sc-secondary-section-head add-univ-head"><div><h3>현재 성적 기준 추천</h3><p>웹과 동일한 분석 로직으로 계산한 결과입니다.</p></div><button type="button" className="btn btn-secondary mini" data-action="refreshUniversityRecommendations" disabled={universityRecommendationStatus === 'loading'}>{universityRecommendationStatus === 'loading' ? '추천 중' : '새로고침'}</button></div>
              <div className="sc-secondary-list add-univ-grid">{recommendationState}</div>
            </section>
            <section className="sc-secondary-section add-univ-section">
              <div className="sc-secondary-section-head add-univ-head"><div>{universitySelectedName ? <><button type="button" className="add-univ-back" data-action="backToUniversityList">대학 다시 선택</button><h3>{universitySelectedName} 학과</h3><p>추가할 학과를 선택해주세요.</p></> : <><h3>직접 검색</h3><p>대학을 먼저 선택하면 해당 대학의 학과만 보여드려요.</p></>}</div><span className="sc-badge">{universitySelectedName ? '2 / 2' : '1 / 2'}</span></div>
              <div className="analysis-search-inline"><input key={universitySelectedName || 'universities'} className="planner-input add-univ-search" data-field="analysisSearchTerm" defaultValue={analysisSearchTerm} placeholder={universitySelectedName ? '학과명 검색' : '대학명 검색'} autoComplete="off" enterKeyHint="search" /><button type="button" className="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div>
              <div className="sc-secondary-list add-univ-results"><CatalogResults {...ctx} /></div>
            </section>
          </div>
        </div>
        <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: tabBarHtml }} />
      </div>
    </div>
  );
}
