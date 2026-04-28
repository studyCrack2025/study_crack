// MBTI 유형별 과목 가중치 [국어, 수학, 탐구, 영어]
// Dim1: C=개념중심, I=문제중심 | Dim2: S=루틴선호, M=변화선호
// Dim3: D=근거중심, E=흐름중심 | Dim4: R=계획고수, F=유연조정
const MBTI_SUBJECT_WEIGHTS = {
    'CSDR': [0.6, 0.7, 0.8, 0.4], 'CSDF': [0.6, 0.6, 0.7, 0.5],
    'CSER': [0.8, 0.5, 0.6, 0.5], 'CSEF': [0.8, 0.4, 0.5, 0.6],
    'CMDR': [0.5, 0.8, 0.9, 0.3], 'CMDF': [0.5, 0.7, 0.8, 0.4],
    'CMER': [0.7, 0.5, 0.6, 0.5], 'CMEF': [0.7, 0.4, 0.5, 0.6],
    'ISDR': [0.4, 0.9, 0.8, 0.3], 'ISDF': [0.4, 0.8, 0.8, 0.4],
    'ISER': [0.5, 0.7, 0.6, 0.5], 'ISEF': [0.5, 0.6, 0.6, 0.6],
    'IMDR': [0.3, 0.9, 0.9, 0.3], 'IMDF': [0.3, 0.9, 0.8, 0.3],
    'IMER': [0.4, 0.8, 0.7, 0.4], 'IMEF': [0.4, 0.7, 0.6, 0.5]
};

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
let tutorialData = { qual: {}, quan: {}, mbti: null, selectedUniv: null, selectedUnivs: null, totalStdScore: 0 };
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

    // 브라우저 종료·새로고침 시 currentStepIdx를 서버에 안정적으로 전송
    // fetch keepalive=true: sendBeacon과 달리 Authorization 헤더를 유지한 채 페이지 언로드 후에도 요청 완료
    window.addEventListener('beforeunload', () => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        fetch(CONFIG.api.user, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_tutorial_status', data: { step: currentStepIdx } }),
            keepalive: true
        }).catch(() => {});
    });

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

function showTutLoading(show) {
    const overlay = document.getElementById('tutLoadingOverlay');
    if (!overlay) return;
    if (show) overlay.classList.add('active');
    else overlay.classList.remove('active');
}

async function nextStep() {
    if (isInterrupted) {
        isInterrupted = false;
        renderStep();
        return;
    }

    const nextBtn = document.getElementById('tutNextBtn');
    if (nextBtn) nextBtn.disabled = true;
    showTutLoading(true);

    try {
        await _nextStepCore();
    } finally {
        showTutLoading(false);
        if (nextBtn) nextBtn.disabled = false;
    }
}

async function _nextStepCore() {
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
        // 새 점수 입력 시 이전 시뮬레이션 결과 초기화
        tutorialData.selectedUnivs = null;
        tutorialData.totalStdScore = 0;

        const korCommon  = parseInt(document.getElementById('tutKorCommon')?.value)  || 0;
        const korSel     = parseInt(document.getElementById('tutKorSel')?.value)     || 0;
        const mathCommon = parseInt(document.getElementById('tutMathCommon')?.value) || 0;
        const mathSel    = parseInt(document.getElementById('tutMathSel')?.value)    || 0;
        const korOpt     = document.getElementById('tutKorSub')?.value   || 'none';
        const mathOpt    = document.getElementById('tutMathSub')?.value  || 'none';
        const inq1Name   = document.getElementById('tutInq1Name')?.value || '';
        const inq2Name   = document.getElementById('tutInq2Name')?.value || '';
        const inq1Raw    = parseInt(document.getElementById('tutInq1')?.value) || 0;
        const inq2Raw    = parseInt(document.getElementById('tutInq2')?.value) || 0;
        const engGrd     = document.getElementById('tutEngGrd')?.value   || '';
        const histGrd    = document.getElementById('tutHistGrd')?.value  || '';

        // 점수 환산 API 병렬 호출 → survey.js 로드 시 std/pct/grd 즉시 표시
        const [korConv, mathConv, inq1Conv, inq2Conv] = await Promise.all([
            convertScore('mar', 'kor',  korCommon + korSel,   korOpt,  ''),
            convertScore('mar', 'math', mathCommon + mathSel, mathOpt, ''),
            convertScore('mar', 'inq1', inq1Raw, '', inq1Name),
            convertScore('mar', 'inq2', inq2Raw, '', inq2Name)
        ]);

        tutorialData.quan = {
            mar: {
                kor:     { opt: korOpt,  common: korCommon,  elective: korSel,  raw: korCommon  + korSel,  ...korConv  },
                math:    { opt: mathOpt, common: mathCommon, elective: mathSel, raw: mathCommon + mathSel, ...mathConv },
                eng:     { grd: engGrd },
                hist:    { grd: histGrd },
                inq1:    { name: inq1Name, raw: inq1Raw,  ...inq1Conv },
                inq2:    { name: inq2Name, raw: inq2Raw,  ...inq2Conv },
                foreign: { name: '', grd: '' }
            }
        };
        await apiCall('update_quan', tutorialData.quan);

        // 보정 표준점수 단순합 계산 후 백그라운드로 학교 선정
        tutorialData.totalStdScore = [korConv.std, mathConv.std, inq1Conv.std, inq2Conv.std]
            .reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

        const stream = tutorialData.qual.stream;
        if (stream && tutorialData.totalStdScore > 0) {
            fetchTutScoreData().then(scoreData => {
                if (!scoreData) return null;
                return selectTutorialUnivsWithAnalysis(stream, tutorialData.quan.mar, tutorialData.totalStdScore, scoreData);
            }).then(selected => {
                if (selected && selected.length > 0) tutorialData.selectedUnivs = selected;
            }).catch(() => {});
        }
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

// ── 튜토리얼 학교 선정 로직 ──────────────────────────────────────
async function fetchTutScoreData() {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    try {
        const res = await fetch(CONFIG.api.analysis, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_tut_score_data' })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.scoreData || null;
    } catch {
        return null;
    }
}

function selectTutorialUnivs(stream, totalScore, data) {
    const streamData = data[stream];
    if (!streamData) return null;

    const allBandNums = Object.keys(streamData).map(Number).sort((a, b) => a - b);
    if (allBandNums.length === 0) return null;

    const currentBand = Math.floor(totalScore / 10) * 10;
    const minBand = allBandNums[0];
    const maxBand = allBandNums[allBandNums.length - 1];
    const maxOffset = Math.max(currentBand - minBand, maxBand - currentBand) + 10;

    const searchOrder = [currentBand];
    for (let offset = 10; offset <= maxOffset; offset += 10) {
        const upper = currentBand + offset;
        const lower = currentBand - offset;
        if (upper <= maxBand + offset) searchOrder.push(upper);
        if (lower >= minBand - offset) searchOrder.push(lower);
    }

    const slots = [null, null, null];
    const labelOrder = ['A', 'B', 'C', 'D', 'E'];
    const usedSchools = new Set();

    for (const band of searchOrder) {
        const bandData = streamData[String(band)];
        if (!bandData) continue;

        for (const label of labelOrder) {
            const labelData = bandData[label];
            if (!labelData) continue;

            const slotIdx = labelOrder.indexOf(label);
            if (slotIdx >= slots.length) continue;
            if (slots[slotIdx] !== null) continue;

            const schoolNames = Object.keys(labelData);
            let picked = null;

            // 중복 없는 학교 우선 탐색
            for (const schoolName of schoolNames) {
                if (!usedSchools.has(schoolName) && labelData[schoolName].length > 0) {
                    const entry = labelData[schoolName][0];
                    picked = { school: schoolName, major: entry['학과'], passCut: entry['표준점수'] };
                    break;
                }
            }
            // 불가피한 경우 중복 허용
            if (!picked) {
                for (const schoolName of schoolNames) {
                    if (labelData[schoolName].length > 0) {
                        const entry = labelData[schoolName][0];
                        picked = { school: schoolName, major: entry['학과'], passCut: entry['표준점수'] };
                        break;
                    }
                }
            }

            if (picked) {
                slots[slotIdx] = picked;
                usedSchools.add(picked.school);
            }
        }

        // 조기 종료: 현재 점수대에서 3개 모두 확정
        if (slots.every(s => s !== null)) break;
    }

    return slots.filter(s => s !== null);
}

// ── 환산점수 기반 학교 선정 (자체 환산점수 계산 로직 적용) ────────────────

function buildUserScoresForAnalysis(mar) {
    const mathOpt = (mar.math?.opt || '').replace(/\s/g, '');
    const inq1Name = mar.inq1?.name || '';
    const inq2Name = mar.inq2?.name || '';
    const sciSubjects = ['물리학1','물리학2','화학1','화학2','생명과학1','생명과학2','지구과학1','지구과학2'];
    const hasSci = [inq1Name, inq2Name].some(n => sciSubjects.some(s => n.replace(/\s/g, '').includes(s)));
    const isMijet = mathOpt.includes('미적분') || mathOpt.includes('기하');
    const restriction = [];
    if (isMijet) restriction.push('미적기하 필수');
    if (hasSci) restriction.push('과탐 필수');
    if (restriction.length === 0) restriction.push('자유선택');
    return {
        kor: { std: parseFloat(mar.kor?.std) || 0, pct: parseFloat(mar.kor?.pct) || 0, grd: parseInt(mar.kor?.grd) || 9, opt: mar.kor?.opt || '', name: '국어' },
        math: { std: parseFloat(mar.math?.std) || 0, pct: parseFloat(mar.math?.pct) || 0, grd: parseInt(mar.math?.grd) || 9, opt: mar.math?.opt || '', name: '수학' },
        eng: { grd: mar.eng?.grd || 9 },
        inq1: { std: parseFloat(mar.inq1?.std) || 0, pct: parseFloat(mar.inq1?.pct) || 0, grd: parseInt(mar.inq1?.grd) || 9, name: inq1Name },
        inq2: { std: parseFloat(mar.inq2?.std) || 0, pct: parseFloat(mar.inq2?.pct) || 0, grd: parseInt(mar.inq2?.grd) || 9, name: inq2Name },
        restriction
    };
}

function boostUserScores(scores, boost) {
    const b = JSON.parse(JSON.stringify(scores));
    ['kor', 'math', 'inq1', 'inq2'].forEach(k => {
        if (b[k]) b[k].std = (parseFloat(b[k].std) || 0) + boost;
    });
    return b;
}

async function callAnalyzeMyTargets(token, targetUnivs, userScores) {
    try {
        const res = await fetch(CONFIG.api.analysis, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'analyze_my_targets', targetUnivs, userScores, examMode: 'mock' })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.results || null;
    } catch { return null; }
}

function getTutorialCandidates(streamData, totalStdScore, maxCandidates) {
    const allBandNums = Object.keys(streamData).map(Number).sort((a, b) => a - b);
    const currentBand = Math.floor(totalStdScore / 10) * 10;
    const orderedBands = allBandNums.slice().sort((a, b) => Math.abs(a - currentBand) - Math.abs(b - currentBand));
    const candidates = [];
    const usedKeys = new Set();
    for (const band of orderedBands) {
        if (candidates.length >= maxCandidates) break;
        const bandData = streamData[String(band)];
        if (!bandData) continue;
        for (const label of ['A', 'B', 'C', 'D', 'E']) {
            const labelData = bandData[label];
            if (!labelData) continue;
            for (const schoolName of Object.keys(labelData)) {
                const entries = labelData[schoolName];
                if (entries && entries.length > 0) {
                    const key = `${schoolName}||${entries[0]['학과']}`;
                    if (!usedKeys.has(key)) {
                        usedKeys.add(key);
                        candidates.push({ univ: schoolName, major: entries[0]['학과'] });
                        if (candidates.length >= maxCandidates) break;
                    }
                }
                if (candidates.length >= maxCandidates) break;
            }
            if (candidates.length >= maxCandidates) break;
        }
    }
    return candidates;
}

async function selectTutorialUnivsWithAnalysis(stream, mar, totalStdScore, scoreData) {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    const streamData = scoreData[stream];
    if (!streamData) return null;

    const candidates = getTutorialCandidates(streamData, totalStdScore, 24);
    if (candidates.length === 0) return null;

    const userScores = buildUserScoresForAnalysis(mar);
    const boostedScores = boostUserScores(userScores, 5);

    const [currentResults, simResults] = await Promise.all([
        callAnalyzeMyTargets(token, candidates, userScores),
        callAnalyzeMyTargets(token, candidates, boostedScores)
    ]);
    if (!currentResults) return null;

    const currentMap = {}, simMap = {};
    for (const r of currentResults) {
        if (r && r.is_eligible && r.converted_score > 0) currentMap[`${r.univ}||${r.major}`] = r.converted_score;
    }
    if (simResults) {
        for (const r of simResults) {
            if (r && r.is_eligible && r.converted_score > 0) simMap[`${r.univ}||${r.major}`] = r.converted_score;
        }
    }

    // 시나리오별 분류
    // 학교1(안정/하향): 현재<100 AND 상승후<100
    // 학교2(적정/도전): 현재<100 AND 상승후 100~125 (범위 확장)
    // 학교3(상향/초과달성): 현재>=100 OR 상승후>125 (경계값 포함, 나머지 전부 커버)
    const scenario1 = [], scenario2 = [], scenario3 = [], allEligible = [];
    for (const cand of candidates) {
        const key = `${cand.univ}||${cand.major}`;
        const cur = currentMap[key];
        if (!cur) continue;
        const sim = simMap[key] ?? (cur + 10);
        const item = { school: cand.univ, major: cand.major, currentScore: cur, simScore: sim };
        allEligible.push(item);
        if (cur < 100 && sim < 100)                        scenario1.push(item);
        else if (cur < 100 && sim >= 100 && sim <= 125)    scenario2.push(item);
        else                                               scenario3.push(item); // cur>=100 OR sim>125
    }

    // 시나리오 내 정렬
    scenario1.sort((a, b) => b.currentScore - a.currentScore);
    scenario2.sort((a, b) => Math.abs(a.simScore - 110) - Math.abs(b.simScore - 110));
    scenario3.sort((a, b) => a.currentScore - b.currentScore);

    // 폴백: 고정값 대신 실제 점수 분포의 4분위 기반으로 계산
    const sortedByScore = [...allEligible].sort((a, b) => a.currentScore - b.currentScore);
    const n = sortedByScore.length;
    const t1 = sortedByScore[Math.floor(n * 0.20)]?.currentScore ?? 88;
    const t2 = sortedByScore[Math.floor(n * 0.50)]?.currentScore ?? 97;
    const t3 = sortedByScore[Math.floor(n * 0.75)]?.currentScore ?? 108;
    const fallback1 = [...allEligible].sort((a, b) => Math.abs(a.currentScore - t1) - Math.abs(b.currentScore - t1));
    const fallback2 = [...allEligible].sort((a, b) => Math.abs(a.currentScore - t2) - Math.abs(b.currentScore - t2));
    const fallback3 = [...allEligible].sort((a, b) => Math.abs(a.currentScore - t3) - Math.abs(b.currentScore - t3));

    const selected = [];
    const usedSchools = new Set();

    const tryPick = (primary, fallback) => {
        const sources = primary.length > 0 ? [primary, fallback] : [fallback];
        for (const src of sources) {
            for (const item of src) {
                if (!usedSchools.has(item.school)) {
                    usedSchools.add(item.school);
                    selected.push(item);
                    return;
                }
            }
        }
    };

    tryPick(scenario1, fallback1);
    tryPick(scenario2, fallback2);
    tryPick(scenario3, fallback3);

    return selected.length > 0 ? selected : null;
}

function buildUnivCards(selectedUnivs, studentScore) {
    const defaultAlloc = [
        { label: '수학', pct: 40, color: '#3b82f6' },
        { label: '국어', pct: 28, color: '#8b5cf6' },
        { label: '탐구', pct: 22, color: '#10b981' },
        { label: '기타', pct: 10, color: '#f59e0b' }
    ];

    // 신규 포맷: currentScore가 이미 환산점수(0–250 UI 스케일)로 들어온 경우
    if (selectedUnivs.length > 0 && 'currentScore' in selectedUnivs[0]) {
        const PASS_CUT = 100, TOP70_CUT = 150, MAX_SCORE = 200;
        return selectedUnivs.map(u => {
            const gain = Math.max(0, Math.round(u.simScore - u.currentScore));
            return {
                school: u.school, major: u.major,
                currentScore: Math.round(u.currentScore),
                passCut: PASS_CUT, top70Cut: TOP70_CUT, maxScore: MAX_SCORE,
                simScore: Math.round(Math.min(u.simScore, MAX_SCORE)),
                gain,
                subjectAlloc: defaultAlloc, top2Subject: '국어', top2Pct: 28,
                top2NeedPts: Math.max(2, Math.round(Math.abs(PASS_CUT - u.currentScore) * 0.3) + 1)
            };
        });
    }

    // 구 포맷: passCut이 표준점수 단순합인 경우 (레거시 폴백)
    const allScores = [studentScore, ...selectedUnivs.map(u => u.passCut)];
    const maxScore = Math.ceil(Math.max(...allScores) * 1.08 / 10) * 10;
    return selectedUnivs.map(u => {
        const gap = Math.round(u.passCut - studentScore);
        const gain = Math.max(3, Math.round(Math.abs(gap) * 0.15) + 2);
        const simScore = Math.min(Math.round(studentScore + gain), maxScore);
        return {
            school: u.school, major: u.major,
            currentScore: Math.round(studentScore),
            passCut: Math.round(u.passCut),
            top70Cut: Math.min(Math.round(u.passCut + 10), maxScore),
            maxScore, simScore, gain,
            subjectAlloc: defaultAlloc, top2Subject: '국어', top2Pct: 28,
            top2NeedPts: Math.max(2, Math.round(Math.abs(gap) * 0.3) + 1)
        };
    });
}

// ── 추천 대학 시뮬레이션 ──────────────────────────────────────────
function initUnivSim() {
    const list = document.getElementById('univCardList');
    if (!list) return;
    list.innerHTML = '';

    const univsToRender = (tutorialData.selectedUnivs && tutorialData.selectedUnivs.length > 0)
        ? buildUnivCards(tutorialData.selectedUnivs, tutorialData.totalStdScore)
        : DEMO_UNIVS;

    univsToRender.forEach((u) => {
        const card = document.createElement('div');
        card.className = 'univ-card';

        const gapToPass = u.passCut - u.currentScore;
        const badgeClass = gapToPass <= 5 ? 'badge-close' : gapToPass <= 15 ? 'badge-mid' : 'badge-far';
        const badgeText = gapToPass <= 0 ? `합격선 초과 ${Math.abs(gapToPass)}점` : `합격까지 ${gapToPass}점`;

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
                <div class="univ-gap-badge ${badgeClass}">${badgeText}</div>
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

// ── 최소 노력 합격 최적화 (Greedy Algorithm) ─────────────────────

function gradeToApproxPct(grd) {
    const map = { '1': 96, '2': 89, '3': 77, '4': 60, '5': 40, '6': 23, '7': 11, '8': 4, '9': 1 };
    return map[String(grd)] || 50;
}

function calcGreedySubjectPlan(univ, mar, mbti) {
    const currentScore = univ.currentScore || 0;
    // delta: 합격선(100)까지 부족한 점수. 이미 초과해도 최소 20점으로 개선 추천 제공
    const delta = Math.max(20, 100 - currentScore);

    const w = MBTI_SUBJECT_WEIGHTS[mbti] || [0.5, 0.7, 0.7, 0.4];
    // w = [국어, 수학, 탐구, 영어]

    // 대학 반영비율 — subjectAlloc에서 파싱, 없으면 기본값
    const allocArr = univ.subjectAlloc || [];
    const ur = { kor: 0.28, math: 0.40, inq1: 0.11, inq2: 0.11, eng: 0.10 };
    allocArr.forEach(a => {
        if (a.label === '수학') ur.math = a.pct / 100;
        else if (a.label === '국어') ur.kor = a.pct / 100;
        else if (a.label === '탐구') { ur.inq1 = a.pct / 200; ur.inq2 = a.pct / 200; }
        else if (a.label === '기타') ur.eng = a.pct / 100;
    });

    const curPct = {
        kor: parseFloat(mar.kor?.pct) || 50,
        math: parseFloat(mar.math?.pct) || 50,
        inq1: parseFloat(mar.inq1?.pct) || 50,
        inq2: parseFloat(mar.inq2?.pct) || 50,
        eng: gradeToApproxPct(mar.eng?.grd)
    };

    const HARD_LIMIT = { kor: 10, math: 15, inq1: 8, inq2: 8, eng: 5 };
    const COLORS = { kor: '#8b5cf6', math: '#3b82f6', inq1: '#10b981', inq2: '#06b6d4', eng: '#f59e0b' };
    const LABELS = {
        kor: '국어', math: '수학',
        inq1: mar.inq1?.name || '탐구1',
        inq2: mar.inq2?.name || '탐구2',
        eng: '영어'
    };
    const mbtiW = { kor: w[0], math: w[1], inq1: w[2], inq2: w[2], eng: w[3] };

    // 최종 효율 = MBTI가중치 × (1 - 현재백분위/100) × 대학반영비율
    const subjects = ['kor', 'math', 'inq1', 'inq2', 'eng'].map(key => ({
        key,
        label: LABELS[key],
        color: COLORS[key],
        efficiency: mbtiW[key] * (1 - curPct[key] / 100) * ur[key],
        hardLimit: HARD_LIMIT[key]
    })).sort((a, b) => b.efficiency - a.efficiency);

    // Greedy 점수 할당
    let remaining = delta;
    subjects.forEach(s => {
        if (remaining <= 0) { s.assigned = 0; return; }
        const alloc = Math.min(remaining, s.hardLimit);
        s.assigned = Math.round(alloc * 10) / 10;
        remaining -= alloc;
    });

    return subjects;
}

// ── 과목별 최적 상승 계획 + 도달 가능 대학 ───────────────────────
async function initSubjectRec() {
    const container = document.getElementById('subjectRecContent');
    if (!container) return;

    showTutLoading(true);

    const univ = tutorialData.selectedUniv || DEMO_UNIVS[0];
    const mar  = tutorialData.quan?.mar;
    const mbti = tutorialData.mbti;

    // 1. Greedy 알고리즘으로 과목별 최적 상승 계획 계산
    let plan = null;
    if (mar && mbti) {
        try { plan = calcGreedySubjectPlan(univ, mar, mbti); } catch(e) {}
    }
    if (!plan) {
        plan = [
            { key: 'math', label: '수학',  color: '#3b82f6', assigned: 15, hardLimit: 15 },
            { key: 'inq1', label: '탐구1', color: '#10b981', assigned: 10, hardLimit: 10 },
            { key: 'kor',  label: '국어',  color: '#8b5cf6', assigned:  4, hardLimit: 10 },
            { key: 'eng',  label: '영어',  color: '#f59e0b', assigned:  0, hardLimit:  5 }
        ];
    }

    // 2. 백엔드에서 예상 도달 기간(개월) 가져오기
    let estimatedMonths = 3;
    try {
        const token = localStorage.getItem('accessToken');
        if (token) {
            const res = await fetch(CONFIG.api.analysis, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'get_estimated_months' })
            });
            if (res.ok) {
                const d = await res.json();
                if (d.months) estimatedMonths = d.months;
            }
        }
    } catch(e) {}

    showTutLoading(false);

    // 3. 과목별 계획 행 렌더링 (assigned > 0인 것만, 최대 4개)
    const activePlan = plan.filter(s => s.assigned > 0).slice(0, 4);
    const totalGain  = activePlan.reduce((sum, s) => sum + (s.assigned || 0), 0);
    const rankLabels = ['1순위', '2순위', '3순위', '4순위'];

    const planRows = activePlan.map((s, i) => {
        const curPct = mar
            ? (s.key === 'eng' ? gradeToApproxPct(mar.eng?.grd) : (parseFloat(mar[s.key]?.pct) || 50))
            : 50;
        const visible = (i === 0 || i === 1); // 1·2순위만 공개
        const barWidth = Math.min(Math.round(curPct), 100);
        return `
        <div class="score-plan-row${visible ? '' : ' score-plan-blurred'}">
            <div class="score-plan-rank rank-${i < 2 ? i + 1 : 'other'}">${rankLabels[i]}</div>
            <div class="score-plan-subject" style="color:${s.color}">${visible ? s.label : '???'}</div>
            <div class="score-plan-progress">
                <div class="score-plan-bar-bg">
                    <div class="score-plan-bar-fill" style="width:${barWidth}%;background:${s.color}"></div>
                </div>
                <span class="score-plan-pct">${visible ? `백분위 ${Math.round(curPct)}%` : '비공개'}</span>
            </div>
            <div class="score-plan-gain" style="color:${visible ? s.color : '#94a3b8'}">
                ${visible ? `+${Math.round(s.assigned)}점` : '🔒'}
            </div>
        </div>`;
    }).join('');

    // 4. 도달 가능 대학 카드 (univ-rec와 동일한 buildUnivCards + 같은 카드 HTML)
    const univSource = (tutorialData.selectedUnivs && tutorialData.selectedUnivs.length > 0)
        ? tutorialData.selectedUnivs : null;
    const univsToRender = univSource ? buildUnivCards(univSource, tutorialData.totalStdScore) : DEMO_UNIVS;

    const reachableCardsHtml = univsToRender.map(u => {
        const PASS_CUT = u.passCut, MAX_SCORE = u.maxScore;
        const currentPct = (u.currentScore / MAX_SCORE * 100).toFixed(1);
        const passPct    = (PASS_CUT       / MAX_SCORE * 100).toFixed(1);
        const top70Pct   = (u.top70Cut     / MAX_SCORE * 100).toFixed(1);
        const simPct     = (u.simScore     / MAX_SCORE * 100).toFixed(1);
        const gapToPass  = PASS_CUT - u.currentScore;
        const badgeClass = gapToPass <= 5 ? 'badge-close' : gapToPass <= 15 ? 'badge-mid' : 'badge-far';
        const badgeText  = gapToPass <= 0 ? `합격선 초과 ${Math.abs(gapToPass)}점` : `합격까지 ${gapToPass}점`;
        return `
        <div class="univ-card">
            <div class="univ-card-header">
                <div>
                    <div class="univ-card-title">${u.school}</div>
                    <div class="univ-card-major">${u.major}</div>
                </div>
                <div class="univ-gap-badge ${badgeClass}">${badgeText}</div>
            </div>
            <div class="sbc-wrap">
                <div class="sbc-labels">
                    <span class="sbc-lbl lbl-top70" style="left:${top70Pct}%">상위 70%<br>${u.top70Cut}점</span>
                    <span class="sbc-lbl lbl-pass"  style="left:${passPct}%">합격 예측선<br>${u.passCut}점</span>
                </div>
                <div class="sbc-track">
                    <div class="sbc-fill" style="width:${simPct}%"></div>
                    <div class="sbc-mark mark-top70" style="left:${top70Pct}%"></div>
                    <div class="sbc-mark mark-pass"  style="left:${passPct}%"></div>
                </div>
                <div class="sbc-current-label">향상 후 <strong>${u.simScore}점</strong> <em style="color:#10b981;font-size:0.82rem">+${u.gain}</em></div>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
        <div class="score-plan-section">
            <div class="score-plan-header">
                <span class="score-plan-title">📊 과목별 최적 상승 계획</span>
                <span class="score-plan-total">합격선까지 총 <strong>+${Math.round(totalGain)}점</strong></span>
            </div>
            <div class="score-plan-rows">${planRows}</div>
            <div class="score-plan-note">3·4순위 전략은 Standard 플랜 시작 후 공개됩니다.</div>
        </div>
        <div class="reach-period-section">
            <div class="reach-period-label">Standard 이용 시 예상 도달 기간</div>
            <div class="reach-period-value">평균 <strong>${estimatedMonths}개월</strong> 예상</div>
        </div>
        <div class="reachable-univs-section">
            <div class="reachable-univs-title">🎯 향상된 성적으로 도달 가능한 대학</div>
            <div class="univ-card-list">${reachableCardsHtml}</div>
        </div>`;
}

// ── 결제 / 완료 ──────────────────────────────────────────────────

function _setUpsellBtnsDisabled(disabled) {
    document.querySelectorAll('.tut-upsell-btn').forEach(b => { b.disabled = disabled; });
}

async function upsellPayment() {
    _setUpsellBtnsDisabled(true);
    try {
        if (tutorialData.selectedUniv) {
            const payload = [{ univ: tutorialData.selectedUniv.school, major: tutorialData.selectedUniv.major }];
            await apiCall('update_target_univs', payload);
        }
        const trialResult = await apiCall('grant_tutorial_trial', {});
        if (trialResult.success || trialResult.message) {
            localStorage.removeItem('tutorialStatus');
            localStorage.setItem('tutorial_completed', 'true');
            window.location.href = '/payment';
        } else {
            alert(trialResult.error || '완료 처리 중 문제가 발생했습니다.');
            _setUpsellBtnsDisabled(false);
        }
    } catch (e) {
        alert('통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        _setUpsellBtnsDisabled(false);
    }
}

async function endTutorial() {
    _setUpsellBtnsDisabled(true);
    try {
        if (tutorialData.selectedUniv) {
            const payload = [{ univ: tutorialData.selectedUniv.school, major: tutorialData.selectedUniv.major }];
            await apiCall('update_target_univs', payload);
        }
        const trialResult = await apiCall('grant_tutorial_trial', {});
        if (trialResult.success || trialResult.message) {
            localStorage.removeItem('tutorialStatus');
            localStorage.setItem('tutorial_completed', 'true');
            window.location.href = '/';
        } else {
            alert(trialResult.error || '완료 처리 중 문제가 발생했습니다.');
            _setUpsellBtnsDisabled(false);
        }
    } catch (e) {
        alert('통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        _setUpsellBtnsDisabled(false);
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

// 점수 환산 API 호출 (survey.js requestScoreConversion과 동일한 엔드포인트)
async function convertScore(month, subject, score, opt, subName) {
    if (!score || score <= 0) return { std: '', pct: '', grd: '' };
    const token = localStorage.getItem('accessToken');
    if (!token) return { std: '', pct: '', grd: '' };
    try {
        const res = await fetch(CONFIG.api.analysis, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'convert_score', month, subject, score, opt: opt || '', subName: subName || '' })
        });
        if (!res.ok) return { std: '', pct: '', grd: '' };
        const data = await res.json();
        if (data.error) return { std: '', pct: '', grd: '' };
        return { std: data.std || '', pct: data.pct || '', grd: data.grd || '' };
    } catch {
        return { std: '', pct: '', grd: '' };
    }
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
