const BASIC_PREVIEW_STATE_COPY = {
    needs_scores: { title: '성적 입력이 먼저 필요해요', description: '분석할 시험 성적을 입력하면 나에게 가치 있는 다음 1점을 찾을 수 있어요.', action: '성적 입력 계속하기', href: '/tutorial' },
    needs_target: { title: '목표 대학을 선택해주세요', description: '한 곳을 먼저 선택하면 대학별 반영 방식에 맞춰 과목의 효과를 비교해드려요.', action: '목표 대학 선택하기', href: '/tutorial' },
    needs_profile: { title: '학습 성향 입력을 마쳐주세요', description: '성적 상승 가능성을 함께 보기 위해 남은 학습 성향 입력이 필요해요.', action: '입력 계속하기', href: '/tutorial' },
    analysis_failed: { title: '이번 결과를 완성하지 못했어요', description: '입력한 성적과 목표 대학을 다시 확인한 뒤 재시도해주세요.', action: '다시 시도하기', retry: true },
    temporarily_unavailable: { title: '분석 데이터를 준비하고 있어요', description: '현재 시험 데이터가 준비되는 중입니다. 잠시 후 다시 확인해주세요.', action: '다시 시도하기', retry: true },
    already_unlocked: { title: 'Basic 전체 분석을 이용할 수 있어요', description: '이미 잠금이 해제된 계정입니다. 전체 대학과 과목별 전략을 확인하세요.', action: '전체 분석 보기', href: '/analysis' },
    unauthorized: { title: '로그인이 필요해요', description: '로그인 후 저장된 성적으로 개인화 결과를 확인할 수 있어요.', action: '로그인하기', href: '/login?returnUrl=%2Fbasic-preview' }
};

const BASIC_PREVIEW_EXAM_LABELS = { mar: '3월 학력평가', may: '5월 학력평가', jun: '6월 모의평가', jul: '7월 학력평가', sep: '9월 모의평가', csat: '수능' };

let basicPreviewLoading = false;

function trackBasicPreview(eventName, properties = {}) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...properties });
}

function setBasicPreviewStatus(title, description, { loading = false, action = null } = {}) {
    const status = document.getElementById('basicPreviewStatus');
    const result = document.getElementById('basicPreviewResult');
    const spinner = status.querySelector('.basic-preview-spinner');
    const actions = document.getElementById('basicPreviewStatusActions');
    status.classList.remove('hidden');
    result.classList.add('hidden');
    status.setAttribute('aria-busy', loading ? 'true' : 'false');
    spinner.classList.toggle('hidden', !loading);
    document.getElementById('basicPreviewStatusTitle').textContent = title;
    document.getElementById('basicPreviewStatusDescription').textContent = description;
    actions.replaceChildren();
    if (action) actions.appendChild(action);
}

function createStatusAction(config) {
    if (!config?.action) return null;
    if (config.retry) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'basic-preview-status-primary';
        button.textContent = config.action;
        button.addEventListener('click', loadBasicPreview);
        return button;
    }
    const link = document.createElement('a');
    link.className = 'basic-preview-status-primary';
    link.href = config.href;
    link.textContent = config.action;
    return link;
}

function showBasicPreviewState(state) {
    const config = BASIC_PREVIEW_STATE_COPY[state] || BASIC_PREVIEW_STATE_COPY.analysis_failed;
    setBasicPreviewStatus(config.title, config.description, { action: createStatusAction(config) });
    trackBasicPreview('basic_preview_state', { preview_state: state });
}

function formatNumber(value, digits = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '-';
    return Number.isInteger(number) ? String(number) : number.toFixed(digits);
}

function formatEffect(effect) {
    const number = Number(effect);
    if (!Number.isFinite(number)) return '계산 불가';
    return `${number > 0 ? '+' : ''}${formatNumber(number)}점`;
}

function effectNote(effect) {
    if (effect.availability === 'unavailable') return '현재 입력으로 계산할 수 없어요.';
    if (effect.availability === 'at_maximum') return '현재 만점인 과목이에요.';
    if (Number(effect.uiEffect) > 0) return '원점수 1점 상승 시 변화';
    if (Number(effect.rawNeeded) > 1 && Number(effect.firstPositiveUiEffect) > 0) return `원점수 +${effect.rawNeeded}점부터 변화`;
    return '1점 구간에서는 환산 변화가 없어요.';
}

function renderEffectCards(data) {
    const container = document.getElementById('previewEffectsList');
    const effects = Array.isArray(data.onePointEffects) ? data.onePointEffects : [];
    const maxEffect = Math.max(0.01, ...effects.map((item) => Math.max(0, Number(item.uiEffect) || 0)));
    container.replaceChildren();
    effects.forEach((effect) => {
        const card = document.createElement('article');
        card.className = 'basic-preview-effect-card';
        if (effect.key === data.prioritySubject?.key) card.classList.add('is-priority');

        const head = document.createElement('div');
        head.className = 'basic-preview-effect-card-head';
        const label = document.createElement('strong');
        label.textContent = effect.label || '과목';
        head.appendChild(label);
        if (effect.key === data.prioritySubject?.key) {
            const badge = document.createElement('span');
            badge.textContent = '우선 추천';
            head.appendChild(badge);
        }

        const value = document.createElement('div');
        value.className = 'basic-preview-effect-value';
        value.textContent = formatEffect(effect.uiEffect);
        const track = document.createElement('div');
        track.className = 'basic-preview-effect-track';
        const fill = document.createElement('div');
        fill.className = 'basic-preview-effect-fill';
        const width = effect.availability === 'ready' ? Math.max(3, Math.min(100, ((Number(effect.uiEffect) || 0) / maxEffect) * 100)) : 0;
        fill.style.setProperty('--effect-width', `${width}%`);
        track.appendChild(fill);
        const note = document.createElement('p');
        note.className = 'basic-preview-effect-note';
        note.textContent = effectNote(effect);

        card.append(head, value, track, note);
        container.appendChild(card);
    });
}

function createScoreRow(subject, recommended) {
    const row = document.createElement('div');
    row.className = 'basic-preview-score-row';
    if (recommended && subject.changed) row.classList.add('is-changed');
    const label = document.createElement('span');
    label.textContent = subject.label || '과목';
    const score = document.createElement('strong');
    const value = recommended ? subject.recommendedRaw : subject.currentRaw;
    score.textContent = Number.isFinite(Number(value)) ? `${formatNumber(value, 0)}점` : '-';
    row.append(label, score);
    return row;
}

function renderCombination(data) {
    const combination = data.recommendedCombination || {};
    const subjects = Array.isArray(combination.subjects) ? combination.subjects : [];
    const current = document.getElementById('previewCurrentCombination');
    const recommended = document.getElementById('previewRecommendedCombination');
    current.replaceChildren();
    recommended.replaceChildren();
    subjects.forEach((subject) => {
        current.appendChild(createScoreRow(subject, false));
        recommended.appendChild(createScoreRow(subject, true));
    });
    const gain = Number(combination.totalRawGain);
    const weeks = Number(combination.weeks);
    const parts = [];
    if (Number.isFinite(gain) && gain > 0) parts.push(`총 +${formatNumber(gain, 0)}점`);
    if (Number.isFinite(weeks) && weeks > 0) parts.push(`약 ${formatNumber(weeks, 0)}주 목표`);
    document.getElementById('previewCombinationMeta').textContent = parts.join(' · ');
}

function renderBasicPreview(data) {
    const status = document.getElementById('basicPreviewStatus');
    const result = document.getElementById('basicPreviewResult');
    status.classList.add('hidden');
    status.setAttribute('aria-busy', 'false');
    result.classList.remove('hidden');

    document.getElementById('previewExamLabel').textContent = BASIC_PREVIEW_EXAM_LABELS[data.examMode] || '저장 성적 기준';
    document.getElementById('previewUniversity').textContent = data.target?.univ || '';
    document.getElementById('previewMajor').textContent = data.target?.major || '';
    document.getElementById('previewPrioritySubject').textContent = data.prioritySubject?.label || '추천 과목';
    document.getElementById('previewCurrentRaw').textContent = Number.isFinite(Number(data.prioritySubject?.currentRaw)) ? `${formatNumber(data.prioritySubject.currentRaw, 0)}점` : '-';
    document.getElementById('previewRecommendedRaw').textContent = Number.isFinite(Number(data.prioritySubject?.recommendedRaw)) ? `${formatNumber(data.prioritySubject.recommendedRaw, 0)}점` : '-';
    document.getElementById('previewPriorityEffect').textContent = formatEffect(data.prioritySubject?.onePointUiEffect);
    document.getElementById('previewRisePotential').textContent = data.prioritySubject?.risePotential || '우선 추천';
    const reasons = Array.isArray(data.reasons) ? data.reasons.filter(Boolean) : [];
    document.getElementById('previewPriorityReason').textContent = reasons[0] || '입시 효과와 현재 점수에서의 상승 여지를 함께 반영했습니다.';
    renderEffectCards(data);
    renderCombination(data);
    trackBasicPreview('basic_preview_ready', { preview_state: 'ready' });
}

async function ensureBasicPreviewSession() {
    if (localStorage.getItem('userId')) return true;
    const refreshed = await tryRefreshToken();
    if (refreshed && localStorage.getItem('userId')) return true;
    window.location.replace('/login?returnUrl=%2Fbasic-preview');
    return false;
}

async function loadBasicPreview() {
    if (basicPreviewLoading) return;
    basicPreviewLoading = true;
    setBasicPreviewStatus('개인화 결과를 불러오고 있어요', '저장된 성적과 목표 대학을 확인하고 있습니다.', { loading: true });
    try {
        if (!await ensureBasicPreviewSession()) return;
        const response = await apiFetch(CONFIG.api.analysis, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_basic_preview' })
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            showBasicPreviewState('unauthorized');
            return;
        }
        if (response.status === 503) {
            showBasicPreviewState('temporarily_unavailable');
            return;
        }
        if (!response.ok || !data.status) {
            showBasicPreviewState('analysis_failed');
            return;
        }
        if (data.status === 'ready_free') renderBasicPreview(data);
        else showBasicPreviewState(data.status);
    } catch {
        showBasicPreviewState('temporarily_unavailable');
    } finally {
        basicPreviewLoading = false;
    }
}

function bindBasicPreviewActions() {
    const dialog = document.getElementById('previewCriteriaDialog');
    document.getElementById('previewCriteriaButton').addEventListener('click', () => dialog.showModal());
    document.getElementById('previewCriteriaClose').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });
    document.getElementById('basicPreviewPurchase').addEventListener('click', () => {
        trackBasicPreview('basic_unlock_click', { preview_state: 'ready', tier_state: 'free' });
    });
    document.getElementById('logoutBtn').addEventListener('click', (event) => {
        event.preventDefault();
        handleSignOut();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    bindBasicPreviewActions();
    trackBasicPreview('basic_preview_start', { preview_state: 'loading' });
    loadBasicPreview();
});
