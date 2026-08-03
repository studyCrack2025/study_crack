import { renderSecondaryIntro, renderSecondaryState } from '../../components/secondary-page.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderAddUniversityCard({ analysisTargetList = [], name }) {
  const added = analysisTargetList.includes(name);
  return `<div class="sc-secondary-row add-univ-card"><div class="sc-secondary-row-main add-univ-item-text"><b>${escapeHtml(name)}</b><p>현재 성적 기준 우선 검토 대학</p></div><span class="sc-badge">추천</span><button class="btn ${added ? 'btn-secondary' : 'btn-primary'} mini" data-action="addAnalysisTarget" data-target-major="${escapeHtml(name)}" ${added ? 'disabled' : ''}>${added ? '추가됨' : '추가'}</button></div>`;
}

function renderSearchRow({ analysisTargetList = [], name }) {
  const added = analysisTargetList.includes(name);
  return `<div class="sc-secondary-row add-univ-row"><div class="sc-secondary-row-main add-univ-item-text"><b>${escapeHtml(name)}</b><p>선택한 대학의 모집 학과</p></div><button class="btn ${added ? 'btn-secondary' : 'btn-primary'} mini" data-action="addAnalysisTarget" data-target-major="${escapeHtml(name)}" ${added ? 'disabled' : ''}>${added ? '추가됨' : '추가'}</button></div>`;
}

export function renderAddUniversityScreen(ctx) {
  const {
    analysisRecommended = [],
    analysisSearchList = [],
    analysisSearchTerm = '',
    analysisTargetList = [],
    universitySelectedName = '',
    universityRecommendationStatus = 'idle',
    universityRecommendationError = '',
    appbar,
    layout
  } = ctx;

  return layout(
    appbar('대학 추가', true) + `<div class="sc-secondary-page add-univ-page">
        ${renderSecondaryIntro({ eyebrow: 'TARGET UNIVERSITY', title: '희망 대학 추가', description: '현재 성적 추천을 확인하거나 대학과 학과를 순서대로 직접 선택하세요.', aside: `<span class="sc-chip">최대 6개</span>` })}
        <section class="sc-secondary-section add-univ-section">
          <div class="sc-secondary-section-head add-univ-head"><div><h3>현재 성적 기준 추천</h3><p>웹과 동일한 분석 로직으로 계산한 결과입니다.</p></div><button type="button" class="btn btn-secondary mini" data-action="refreshUniversityRecommendations" ${universityRecommendationStatus === 'loading' ? 'disabled' : ''}>${universityRecommendationStatus === 'loading' ? '추천 중' : '새로고침'}</button></div>
          <div class="sc-secondary-list add-univ-grid">
            ${analysisRecommended.map((name) => renderAddUniversityCard({ analysisTargetList, name })).join('') || renderSecondaryState({ kind: universityRecommendationStatus === 'loading' ? 'loading' : universityRecommendationError ? 'error' : 'empty', title: universityRecommendationStatus === 'loading' ? '추천 대학을 계산 중이에요' : universityRecommendationError || '추천 결과가 아직 없어요', description: '성적 입력 상태를 확인한 뒤 다시 추천을 요청해주세요.' })}
          </div>
        </section>
        <section class="sc-secondary-section add-univ-section">
          <div class="sc-secondary-section-head add-univ-head"><div>${universitySelectedName ? `<button type="button" class="add-univ-back" data-action="backToUniversityList">대학 다시 선택</button><h3>${escapeHtml(universitySelectedName)} 학과</h3><p>추가할 학과를 선택해주세요.</p>` : '<h3>직접 검색</h3><p>대학을 먼저 선택하면 해당 대학의 학과만 보여드려요.</p>'}</div><span class="sc-badge">${universitySelectedName ? '2 / 2' : '1 / 2'}</span></div>
          <div class="analysis-search-inline"><input class="planner-input add-univ-search" data-field="analysisSearchTerm" value="${escapeHtml(analysisSearchTerm)}" placeholder="${universitySelectedName ? '학과명 검색' : '대학명 검색'}"/><button type="button" class="btn btn-secondary mini analysis-search-btn" data-action="runUniversitySearch">검색</button></div>
          <div class="sc-secondary-list add-univ-results">
            ${analysisSearchList.map((name) => universitySelectedName
              ? renderSearchRow({ analysisTargetList, name })
              : `<button type="button" class="sc-secondary-row add-univ-university-row" data-action="selectUniversityForMajor" data-university-name="${escapeHtml(name)}"><span class="sc-secondary-row-main"><b>${escapeHtml(name)}</b><p>학과 목록 보기</p></span><em>다음</em></button>`).join('') || renderSecondaryState({ title: '검색 결과가 없어요', description: '대학명 또는 학과명을 다시 확인해주세요.' })}
          </div>
        </section>
      </div>`,
    true
  );
}
