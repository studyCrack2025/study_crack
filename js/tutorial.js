const MASCOTS = {
    hi: '/assets/images/mascots/crack_hi.png',
    thumbsup: '/assets/images/mascots/crack_thumbsup.png',
    startle: '/assets/images/mascots/crack_startle.png',
    sigh: '/assets/images/mascots/crack_sigh.png',
    analysis: '/assets/images/mascots/crack_analysis.png',
    showresult: '/assets/images/mascots/crack_showresult.png'
};

const STEPS = [
    { id: 'intro',       msg: '지금 바로 나만의 합격 전략을 확인해보세요.',                        mascot: 'hi' },
    { id: 'survey-qual', msg: '먼저 현재 학년과 희망 계열을 알려주세요.',                          mascot: 'thumbsup' },
    { id: 'survey-quan', msg: '모의고사 원점수를 입력해주세요. 수능 예측 점수로 자동 보정돼요.',    mascot: 'analysis' },
    { id: 'mbti',        msg: '학습 성향을 파악할게요. 검사를 시작하거나 직접 선택해주세요.',       mascot: 'hi' },
    { id: 'univ-rec',    msg: '성적을 분석했어요! 목표 대학을 선택하면 상세 시뮬레이션을 볼 수 있어요.', mascot: 'showresult' },
    { id: 'subject-rec', msg: '선택한 대학 합격선까지, 가장 효율적인 과목 전략을 알려드릴게요.',   mascot: 'showresult' }
];

// passCut=100 / top70Cut=150 은 전 학교 공통 고정값
// 시나리오: 학교1(현재<100, 상승후<100) / 학교2(현재<100, 상승후 100-120) / 학교3(현재>100, 상승후>120)
const DEMO_UNIVS = [
    {
        school: '인하대학교', major: '컴퓨터공학과',
        currentScore: 88, passCut: 100, top70Cut: 150, maxScore: 150,
        simScore: 91, gain: 3,
        subjectAlloc: [
            { label: '수학', pct: 38, color: '#3b82f6' },
            { label: '국어', pct: 28, color: '#8b5cf6' },
            { label: '탐구', pct: 22, color: '#10b981' },
            { label: '기타', pct: 12, color: '#f59e0b' }
        ],
        top2Subject: '국어', top2Pct: 28, top2NeedPts: 11
    },
    {
        school: '경희대학교', major: '소프트웨어융합학과',
        currentScore: 97, passCut: 100, top70Cut: 150, maxScore: 150,
        simScore: 104, gain: 7,
        subjectAlloc: [
            { label: '수학', pct: 40, color: '#3b82f6' },
            { label: '탐구', pct: 27, color: '#10b981' },
            { label: '국어', pct: 23, color: '#8b5cf6' },
            { label: '기타', pct: 10, color: '#f59e0b' }
        ],
        top2Subject: '탐구', top2Pct: 27, top2NeedPts: 4
    },
    {
        school: '한양대학교', major: '컴퓨터소프트웨어학부',
        currentScore: 112, passCut: 100, top70Cut: 150, maxScore: 150,
        simScore: 126, gain: 14,
        subjectAlloc: [
            { label: '수학', pct: 42, color: '#3b82f6' },
            { label: '국어', pct: 26, color: '#8b5cf6' },
            { label: '탐구', pct: 21, color: '#10b981' },
            { label: '기타', pct: 11, color: '#f59e0b' }
        ],
        top2Subject: '국어', top2Pct: 26, top2NeedPts: 6
    }
];

let currentStepIdx = 0;
let tutorialData = { qual: {}, quan: {}, mbti: null, selectedUniv: null };
let isInterrupted = false;
let mbtiDimSelections = [null, null, null, null];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mbti_completed')) {
        tutorialData.mbti = urlParams.get('mbti_result') || 'CSDR';
        currentStepIdx = 4;
        localStorage.setItem('tutorialStatus', currentStepIdx);
        simulateMbtiAnalysis();
        bindEvents();
        return;
    }

    const token = localStorage.getItem('accessToken');
    if (token) {
        try {
            const response = await fetch(CONFIG.api.user, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'get_user' })
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.tutorialStatus !== undefined) {
                    currentStepIdx = parseInt(data.tutorialStatus, 10);
                    localStorage.setItem('tutorialStatus', currentStepIdx);
                }
            }
        } catch (e) {
            const savedStatus = localStorage.getItem('tutorialStatus');
            if (savedStatus) currentStepIdx = parseInt(savedStatus, 10);
        }
    }

    if (currentStepIdx > 0 && currentStepIdx < STEPS.length - 1) {
        alert('이전 진행 위치부터 이어서 시작합니다.');
    }

    renderStep();
    bindEvents();
});

function bindEvents() {
    document.getElementById('tutPrevBtn').addEventListener('click', prevStep);
    document.getElementById('tutNextBtn').addEventListener('click', nextStep);

    const logoLink = document.querySelector('.logo-link');
    if (logoLink) {
        logoLink.addEventListener('click', (e) => {
            if (currentStepIdx < STEPS.length - 1 && !isInterrupted) {
                e.preventDefault();
                isInterrupted = true;
                updateMascot('앗! 아직 입시 전략 설정이 완료되지 않았어요!\n끝까지 마치면 추천 대학과 공부 전략을 확인할 수 있어요.', 'startle');
                document.getElementById('stepContent').style.display = 'none';
                document.getElementById('tutPrevBtn').style.display = 'none';
                const nextBtn = document.getElementById('tutNextBtn');
                nextBtn.style.display = 'block';
                nextBtn.textContent = '전략 설정 계속하기';
                nextBtn.classList.add('btn-highlight-pulse');
            } else if (isInterrupted) {
                e.preventDefault();
            }
        });
    }
}

function updateMascot(msg, mascotKey) {
    const mascotImg = document.getElementById('mascotImg');
    const newImg = mascotImg.cloneNode(true);
    newImg.src = MASCOTS[mascotKey];
    mascotImg.parentNode.replaceChild(newImg, mascotImg);
    const bubble = document.getElementById('tutorialMsg');
    const newBubble = bubble.cloneNode(true);
    newBubble.textContent = msg;
    bubble.parentNode.replaceChild(newBubble, bubble);
}

async function renderStep() {
    localStorage.setItem('tutorialStatus', currentStepIdx);
    apiCall('update_tutorial_status', { step: currentStepIdx });

    const step = STEPS[currentStepIdx];
    updateMascot(step.msg, step.mascot);

    const container = document.getElementById('stepContent');
    container.innerHTML = '';
    const template = document.getElementById(`tpl-${step.id}`);
    if (template) container.appendChild(template.content.cloneNode(true));

    container.style.display = 'block';

    const prevBtn = document.getElementById('tutPrevBtn');
    const nextBtn = document.getElementById('tutNextBtn');

    prevBtn.style.display = (currentStepIdx === 0 || currentStepIdx >= 4) ? 'none' : 'block';

    if (step.id === 'mbti') {
        mbtiDimSelections = [null, null, null, null];
        nextBtn.style.display = 'none';
    } else if (step.id === 'subject-rec') {
        nextBtn.style.display = 'none';
        initSubjectRec();
    } else {
        nextBtn.style.display = 'block';
        nextBtn.textContent = '다음';
        nextBtn.classList.remove('btn-highlight-pulse');
    }

    if (step.id === 'univ-rec') initUnivSim();
}

async function nextStep() {
    if (isInterrupted) {
        isInterrupted = false;
        renderStep();
        return;
    }

    const step = STEPS[currentStepIdx];

    if (step.id === 'survey-qual') {
        let statusVal = document.querySelector('input[name="tutStudentStatus"]:checked')?.value || '';
        if (statusVal === 'other') statusVal = document.getElementById('tutStatusEtc')?.value || '';
        tutorialData.qual = {
            status:    statusVal,
            school:    document.getElementById('tutHighSchool')?.value  || '',
            stream:    document.getElementById('tutStream')?.value      || '',
            benefits:  document.getElementById('tutBenefits')?.value    || '',
            questions: document.getElementById('tutQuestions')?.value   || ''
        };
        await apiCall('update_qual', tutorialData.qual);
    } else if (step.id === 'survey-quan') {
        const korCommon  = parseInt(document.getElementById('tutKorCommon')?.value)  || 0;
        const korSel     = parseInt(document.getElementById('tutKorSel')?.value)     || 0;
        const mathCommon = parseInt(document.getElementById('tutMathCommon')?.value) || 0;
        const mathSel    = parseInt(document.getElementById('tutMathSel')?.value)    || 0;
        // survey.js와 동일한 키 구조: { mar: { kor: {opt,common,elective,raw,...}, math:..., inq1:..., inq2:... } }
        tutorialData.quan = {
            mar: {
                kor:     { opt: document.getElementById('tutKorSub')?.value  || 'none', common: korCommon,  elective: korSel,  raw: korCommon  + korSel,  std: '', pct: '', grd: '' },
                math:    { opt: document.getElementById('tutMathSub')?.value || 'none', common: mathCommon, elective: mathSel, raw: mathCommon + mathSel, std: '', pct: '', grd: '' },
                eng:     { grd: '' },
                hist:    { grd: '' },
                inq1:    { name: document.getElementById('tutInq1Name')?.value || '', raw: parseInt(document.getElementById('tutInq1')?.value) || 0, std: '', pct: '', grd: '' },
                inq2:    { name: document.getElementById('tutInq2Name')?.value || '', raw: parseInt(document.getElementById('tutInq2')?.value) || 0, std: '', pct: '', grd: '' },
                foreign: { name: '', grd: '' }
            }
        };
        await apiCall('update_quan', tutorialData.quan);
    }

    if (currentStepIdx < STEPS.length - 1) {
        currentStepIdx++;
        renderStep();
    }
}

function prevStep() {
    if (currentStepIdx > 0) {
        currentStepIdx--;
        renderStep();
    }
}

// ── 성적 입력 바 ──────────────────────────────────────────────────
function updateScoreBar(inputEl, max, barId) {
    const raw = parseInt(inputEl.value) || 0;
    const val = Math.min(Math.max(raw, 0), max);
    if (raw !== val) inputEl.value = val;
    const bar = document.getElementById(barId);
    if (bar) bar.style.width = ((val / max) * 100) + '%';
}

function updateCombinedBar(commonId, selId, maxCommon, maxSel, barId, totalId) {
    const commonEl = document.getElementById(commonId);
    const selEl    = document.getElementById(selId);
    const rawC = parseInt(commonEl?.value) || 0;
    const rawS = parseInt(selEl?.value)    || 0;
    const common = Math.min(Math.max(rawC, 0), maxCommon);
    const sel    = Math.min(Math.max(rawS, 0), maxSel);
    if (commonEl && rawC !== common) commonEl.value = common;
    if (selEl    && rawS !== sel)    selEl.value    = sel;
    const total    = common + sel;
    const maxTotal = maxCommon + maxSel;
    const bar = document.getElementById(barId);
    if (bar) bar.style.width = ((total / maxTotal) * 100) + '%';
    const lbl = document.getElementById(totalId);
    if (lbl) lbl.textContent = `총점 ${total} / ${maxTotal}점`;
}

// ── 정성 폼 헬퍼 ─────────────────────────────────────────────────
function handleTutStatusChange(val) {
    const etc = document.getElementById('tutStatusEtc');
    if (etc) etc.style.display = (val === 'other') ? 'block' : 'none';
}

function handleTutGed(checked) {
    const hs = document.getElementById('tutHighSchool');
    if (!hs) return;
    if (checked) { hs.value = '검정고시'; hs.disabled = true; }
    else { if (hs.value === '검정고시') hs.value = ''; hs.disabled = false; }
}

// ── MBTI 직접 선택 ────────────────────────────────────────────────
function selectMBTIDim(dimIdx, letter, btnEl) {
    const row = btnEl.closest('.mbti-dim-btns');
    row.querySelectorAll('.mbti-dim-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    mbtiDimSelections[dimIdx] = letter;

    const allSelected = mbtiDimSelections.every(s => s !== null);
    const codeEl = document.getElementById('mbtiPreviewCode');
    const confirmBtn = document.getElementById('mbtiConfirmBtn');

    if (codeEl) {
        codeEl.textContent = mbtiDimSelections.map(s => s || '?').join('\u00a0');
    }
    if (confirmBtn) {
        confirmBtn.disabled = !allSelected;
        if (allSelected) confirmBtn.classList.add('active');
    }
}

function confirmMBTIDims() {
    if (mbtiDimSelections.some(s => s === null)) {
        alert('4가지 항목을 모두 선택해주세요.');
        return;
    }
    tutorialData.mbti = mbtiDimSelections.join('');
    simulateMbtiAnalysis();
}

function goToMBTI() {
    localStorage.setItem('tutorialStatus', 3);
    window.location.href = '/mbti_survey?from_tutorial=true';
}

function simulateMbtiAnalysis() {
    const container = document.getElementById('stepContent');
    container.innerHTML = `
        <div class="step-card" style="text-align:center; padding: 48px 20px;">
            <div style="font-size:2.5rem; margin-bottom:16px;">🔍</div>
            <div style="font-size:1.15rem; font-weight:700; color:#1e293b; margin-bottom:8px;">성적과 학습 유형을 종합 분석 중이에요</div>
            <div style="font-size:0.95rem; color:#64748b;">잠시만 기다려주세요...</div>
        </div>`;
    updateMascot('입력하신 성적과 학습 유형을 종합 분석 중입니다.', 'analysis');

    setTimeout(() => {
        currentStepIdx = 4;
        renderStep();
    }, 2500);
}

// ── 추천 대학 시뮬레이션 ──────────────────────────────────────────
function initUnivSim() {
    const list = document.getElementById('univCardList');
    if (!list) return;
    list.innerHTML = '';

    DEMO_UNIVS.forEach((u) => {
        const card = document.createElement('div');
        card.className = 'univ-card';

        const gapToPass = u.passCut - u.currentScore;
        const badgeClass = gapToPass <= 5 ? 'badge-close' : gapToPass <= 15 ? 'badge-mid' : 'badge-far';

        const currentPct = (u.currentScore / u.maxScore * 100).toFixed(1);
        const top70Pct  = (u.top70Cut    / u.maxScore * 100).toFixed(1);
        const passPct   = (u.passCut     / u.maxScore * 100).toFixed(1);
        const simPct    = (u.simScore    / u.maxScore * 100).toFixed(1);

        const fillId   = 'sbcFill_'   + u.school.replace(/\s/g, '_');
        const detailId = 'simDetail_' + u.school.replace(/\s/g, '_');

        card.innerHTML = `
            <div class="univ-card-header">
                <div>
                    <div class="univ-card-title">${u.school}</div>
                    <div class="univ-card-major">${u.major}</div>
                </div>
                <div class="univ-gap-badge ${badgeClass}">합격까지 ${gapToPass}점</div>
            </div>
            <div class="sbc-wrap">
                <div class="sbc-labels">
                    <span class="sbc-lbl lbl-top70" style="left:${top70Pct}%">상위 70%<br>${u.top70Cut}점</span>
                    <span class="sbc-lbl lbl-pass"  style="left:${passPct}%">합격 예측선<br>${u.passCut}점</span>
                </div>
                <div class="sbc-track">
                    <div class="sbc-fill" id="${fillId}" style="width:${currentPct}%"></div>
                    <div class="sbc-mark mark-top70" style="left:${top70Pct}%"></div>
                    <div class="sbc-mark mark-pass"  style="left:${passPct}%"></div>
                </div>
                <div class="sbc-current-label">현재 <strong>${u.currentScore}점</strong></div>
            </div>
            <div class="univ-sim-detail" id="${detailId}">
                <div class="sim-delta-row">
                    <span class="sim-delta-label">취약 과목 1점 상승 후</span>
                    <span class="sim-delta-score">${u.simScore}점 <em class="sim-gain">+${u.gain}</em></span>
                </div>
                <div class="sim-progress-bar-wrap">
                    <div class="sim-progress-bg">
                        <div class="sim-progress-fill" id="simFill_${u.school.replace(/\s/g,'_')}" style="width:${simPct}%"></div>
                        <div class="sim-mark-pass" style="left:${passPct}%"></div>
                    </div>
                    <div class="sim-gap-note">합격선까지 <strong>${u.passCut - u.simScore}점</strong> 남았어요</div>
                </div>
            </div>`;

        card.onclick = () => selectUniv(card, u, fillId, detailId, simPct);
        list.appendChild(card);
    });
}

function selectUniv(element, data, fillId, detailId, simPct) {
    document.querySelectorAll('.univ-card').forEach(c => {
        c.classList.remove('selected');
        const detail = c.querySelector('.univ-sim-detail');
        if (detail) detail.classList.remove('visible');
    });

    element.classList.add('selected');

    const detail = document.getElementById(detailId);
    if (detail) {
        detail.classList.add('visible');
        // 기존 바를 먼저 현재 점수로 되돌렸다가 시뮬 점수로 애니메이션
        const fill = document.getElementById(fillId);
        if (fill) {
            const origPct = (data.currentScore / data.maxScore * 100).toFixed(1);
            fill.style.transition = 'none';
            fill.style.width = origPct + '%';
            fill.classList.add('animating');
            setTimeout(() => {
                fill.style.transition = '';
                fill.style.width = simPct + '%';
                setTimeout(() => fill.classList.remove('animating'), 900);
            }, 120);
        }
    }

    tutorialData.selectedUniv = data;
    document.getElementById('tutNextBtn').style.display = 'block';
}

// ── 과목별 공부시간 추천 ──────────────────────────────────────────
function initSubjectRec() {
    const container = document.getElementById('subjectRecContent');
    if (!container) return;

    const univ = tutorialData.selectedUniv || DEMO_UNIVS[0];
    const alloc = univ.subjectAlloc;

    // SVG 도넛 차트 생성
    const r = 58, cx = 80, cy = 80;
    const circ = 2 * Math.PI * r;
    let cumPct = 0;
    const segs = alloc.map(seg => {
        const dash   = (seg.pct / 100) * circ;
        const offset = (cumPct  / 100) * circ;
        cumPct += seg.pct;
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="22" stroke-linecap="butt" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" stroke-dashoffset="${(-offset + 0.5).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})" class="donut-seg"/>`;
    }).join('');

    const donutSVG = `<svg viewBox="0 0 160 160" width="160" height="160" style="display:block;">${segs}<circle cx="${cx}" cy="${cy}" r="42" fill="#fff"/><text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="12" font-weight="700" fill="#1e293b" font-family="Noto Sans KR,sans-serif">공부시간</text><text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="11" fill="#64748b" font-family="Noto Sans KR,sans-serif">배분</text></svg>`;

    // 범례: 2순위(index 1)만 공개, 나머지 블러
    const legendHtml = alloc.map((seg, i) => {
        const visible = (i === 1);
        return `
        <div class="donut-legend-item${visible ? '' : ' legend-blurred'}">
            <span class="donut-dot" style="background:${seg.color}"></span>
            <span class="donut-legend-label">${visible ? seg.label : '???'}</span>
            <span class="donut-legend-pct">${seg.pct}%</span>
            <div class="donut-legend-bar-bg"><div class="donut-legend-bar-fill" style="width:${seg.pct * 2}px;background:${seg.color}"></div></div>
        </div>`;
    }).join('');

    // 4개 카드: 2순위만 공개, 1·3·4순위 블러
    const rankLabels = ['1순위', '2순위', '3순위', '4순위'];
    const rankBadgeClass = ['rank-1', 'rank-2', 'rank-other', 'rank-other'];
    const cardsHtml = alloc.map((seg, i) => {
        const visible = (i === 1);
        const blur = visible ? '' : ' subj-blurred';
        const highlight = visible ? ' subj-visible' : '';
        return `
        <div class="subj-card${highlight}${blur}">
            <div class="subj-rank-badge ${rankBadgeClass[i]}">${rankLabels[i]}</div>
            <div class="subj-name">${visible ? seg.label : '???'}</div>
            <div class="subj-stats">
                <div class="subj-stat-row"><span>추천 비중</span><strong>${visible ? `전체 공부의 ${seg.pct}%` : '비공개'}</strong></div>
                <div class="subj-stat-row"><span>목표 점수까지</span><strong>${visible ? `+${univ.top2NeedPts}점 필요` : '비공개'}</strong></div>
            </div>
            ${!visible ? '<div class="subj-blur-overlay">🔒 플랜 시작 후 공개</div>' : ''}
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="subj-donut-section">
            <div class="donut-chart-wrap">${donutSVG}</div>
            <div class="donut-legend">${legendHtml}</div>
        </div>
        <div class="subj-alloc-cards">${cardsHtml}</div>`;
}

// ── 결제 / 완료 ──────────────────────────────────────────────────
async function upsellPayment() {
    const actionBtn = document.querySelector('.tut-action-btn');
    if (actionBtn) actionBtn.disabled = true;

    try {
        if (tutorialData.selectedUniv) {
            const payload = [{ univ: tutorialData.selectedUniv.school, major: tutorialData.selectedUniv.major }];
            await apiCall('update_target_univs', payload);
        }
        const trialResult = await apiCall('grant_tutorial_trial', {});
        if (trialResult.success || trialResult.message) {
            localStorage.removeItem('tutorialStatus');
            localStorage.setItem('tutorial_completed', 'true');
            alert('전략 설정이 완료되었습니다!\nTrial 등급이 부여되었으며, 추가 목표대학 설정 기회가 제공됩니다.\n결제 페이지에서 1순위 과목 전략과 더 많은 대학을 확인해보세요!');
            window.location.href = '/payment';
        } else {
            alert(trialResult.error || '완료 처리 중 문제가 발생했습니다.');
            if (actionBtn) actionBtn.disabled = false;
        }
    } catch (e) {
        alert('통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        if (actionBtn) actionBtn.disabled = false;
    }
}

async function downloadMBTIReport(mbtiResult) {
    try {
        const response = await fetch(CONFIG.api.user, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
            body: JSON.stringify({ type: 'update_mbti_promo', data: { targetUserId: 'me', promoCode: 'TUTORIAL', mbtiResult } })
        });
        const result = await response.json();
        if (result.success && result.downloadUrl) window.open(result.downloadUrl, '_blank');
    } catch (e) { /* silent */ }
}

async function apiCall(type, data) {
    const token = localStorage.getItem('accessToken');
    if (!token) return { success: false, error: 'Unauthorized' };
    try {
        const response = await fetch(CONFIG.api.user, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type, data })
        });
        if (!response.ok) throw new Error('API 통신 에러');
        return await response.json();
    } catch (e) {
        return { success: false };
    }
}
