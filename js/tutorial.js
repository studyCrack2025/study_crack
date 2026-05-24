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
    { id: 'survey-quan', msg: '3월 또는 5월 학력평가 원점수를 입력해주세요. 수능 예측 점수로 자동 보정돼요.',    mascot: 'analysis' },
    { id: 'mbti',        msg: '학습 성향을 파악할게요. 검사를 시작하거나 직접 선택해주세요.',       mascot: 'hi' },
    { id: 'univ-rec',    msg: '성적을 분석했어요! 목표 대학을 선택하면 상세 시뮬레이션을 볼 수 있어요.', mascot: 'showresult' },
    { id: 'subject-rec', msg: '선택한 대학 합격선까지, 가장 효율적인 과목 전략을 알려드릴게요.',   mascot: 'showresult' }
];


let currentStepIdx = 0;
let tutorialData = { qual: {}, quan: {}, mbti: null, selectedUniv: null, selectedUnivs: null, totalStdScore: 0, examMonth: 'mar' };
let isInterrupted = false;
let tutorialCompleted = false;
let mbtiDimSelections = [null, null, null, null];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    // 인증 가드: 로그인하지 않은 사용자는 로그인 페이지로 이동
    if (!localStorage.getItem('userId')) {
        const refreshed = await tryRefreshToken();
        if (!refreshed) {
            clearClientSession();
            window.location.replace('/login');
            return;
        }
        checkLoginStatus();
    }

    // DB에서 유저 데이터 복원 (mbti_completed 경로 포함)
    try {
        const response = await apiFetch(CONFIG.api.user, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user' })
        });
        if (response.ok) {
            const data = await response.json();
            // 튜토리얼 이미 완료한 유저 → 즉시 홈으로 이동 (재진입 방지)
            if (data.tutorialRewardClaimed === true) {
                localStorage.setItem('tutorial_completed', 'true');
                tutorialCompleted = true;
                window.location.replace('/');
                return;
            }
            if (data && data.tutorialStatus !== undefined) {
                currentStepIdx = parseInt(data.tutorialStatus, 10);
                localStorage.setItem('tutorialStatus', currentStepIdx);
            }
            // 점수 데이터 복원 (may 우선, 없으면 mar)
            if (data.quantitative) {
                tutorialData.quan = data.quantitative;
                const activeMonth = data.quantitative.may ? 'may' : 'mar';
                tutorialData.examMonth = activeMonth;
                const activeQuan = data.quantitative[activeMonth];
                if (activeQuan) {
                    tutorialData.totalStdScore = ['kor', 'math', 'inq1', 'inq2']
                        .reduce((sum, k) => sum + (parseFloat(activeQuan[k]?.std) || 0), 0);
                }
            }
            // 정성 데이터 및 MBTI 복원
            if (data.qualitative) {
                tutorialData.qual = data.qualitative;
                if (data.qualitative.mbti) tutorialData.mbti = data.qualitative.mbti;
            }
            // 추천 대학 목록 DB 복원 (localStorage보다 DB 우선)
            if (data.tut_selectedUnivs && Array.isArray(data.tut_selectedUnivs) && data.tut_selectedUnivs.length > 0) {
                tutorialData.selectedUnivs = data.tut_selectedUnivs;
                localStorage.setItem('tut_selectedUnivs', JSON.stringify(data.tut_selectedUnivs));
            }
        }
    } catch (e) {
        const savedStatus = localStorage.getItem('tutorialStatus');
        if (savedStatus) currentStepIdx = parseInt(savedStatus, 10);
    }

    if (urlParams.get('mbti_completed')) {
        // URL 파라미터 mbti가 DB보다 우선 (방금 완료한 결과)
        tutorialData.mbti = urlParams.get('mbti_result') || tutorialData.mbti || 'CSDR';
        currentStepIdx = 4;
        localStorage.setItem('tutorialStatus', currentStepIdx);
        // MBTI 결과를 DB에 저장
        if (localStorage.getItem('userId')) {
            apiCall('update_qual', { ...tutorialData.qual, mbti: tutorialData.mbti }).catch(() => {});
        }
        // 추천 대학 목록 복원
        const savedUnivs = localStorage.getItem('tut_selectedUnivs');
        if (savedUnivs) {
            try { tutorialData.selectedUnivs = JSON.parse(savedUnivs); } catch(e) {}
        }
        simulateMbtiAnalysis();
        bindEvents();
        return;
    }

    // 추천 대학 목록 및 선택 대학 복원 (4단계 이상 재진입 시)
    if (currentStepIdx >= 4) {
        const savedUnivs = localStorage.getItem('tut_selectedUnivs');
        if (savedUnivs) {
            try {
                tutorialData.selectedUnivs = JSON.parse(savedUnivs);
                // 선택한 대학 복원 (qualitative에 저장된 tutorialUniv 기준)
                if (tutorialData.qual?.tutorialUniv && tutorialData.selectedUnivs?.length > 0) {
                    const tu = tutorialData.qual.tutorialUniv;
                    const cards = buildUnivCards(tutorialData.selectedUnivs, tutorialData.totalStdScore);
                    const match = cards.find(c => c.school === tu.univ && c.major === tu.major);
                    tutorialData.selectedUniv = match || cards[0] || null;
                }
            } catch(e) {}
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

    // 브라우저 종료·새로고침 시 currentStepIdx + 현재 폼 데이터를 서버에 안정적으로 전송
    const _collectCurrentQual = () => {
        const step = STEPS[currentStepIdx];
        if (step?.id !== 'survey-qual') return null;
        let statusVal = document.querySelector('input[name="tutStudentStatus"]:checked')?.value || '';
        if (statusVal === 'other') statusVal = document.getElementById('tutStatusEtc')?.value || '';
        return {
            status: statusVal,
            school: document.getElementById('tutHighSchool')?.value || '',
            stream: document.getElementById('tutStream')?.value || '',
            benefits: document.getElementById('tutBenefits')?.value || '',
            questions: document.getElementById('tutQuestions')?.value || ''
        };
    };

    const _saveOnExit = () => {
        if (tutorialCompleted) return;
        if (!localStorage.getItem('userId')) return;
        const headers = { 'Content-Type': 'application/json' };
        const opts = { method: 'POST', headers, credentials: 'include', keepalive: true };
        // 1. step 저장
        fetch(CONFIG.api.user, { ...opts, body: JSON.stringify({ type: 'update_tutorial_status', data: { step: currentStepIdx } }) }).catch(() => {});
        // 2. qual 저장 (현재 폼에서 재수집, 또는 마지막 저장 상태)
        const freshQual = _collectCurrentQual();
        const qualToSave = freshQual || tutorialData.qual;
        if (qualToSave && Object.keys(qualToSave).length > 0) {
            fetch(CONFIG.api.user, { ...opts, body: JSON.stringify({ type: 'update_qual', data: qualToSave }) }).catch(() => {});
        }
        // 3. quan 저장 (마지막 변환 완료된 상태)
        if (tutorialData.quan && Object.keys(tutorialData.quan).length > 0) {
            fetch(CONFIG.api.user, { ...opts, body: JSON.stringify({ type: 'update_quan', data: tutorialData.quan }) }).catch(() => {});
        }
    };

    window.addEventListener('beforeunload', _saveOnExit);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') _saveOnExit();
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
        const engGrd     = normalizeGradeValue(document.getElementById('tutEngGrd')?.value);
        const histGrd    = normalizeGradeValue(document.getElementById('tutHistGrd')?.value);

        if (!engGrd || !histGrd) {
            alert('영어/한국사는 등급(1~9)만 선택할 수 있어요.');
            return;
        }

        // 선택된 시험 월 (3월 또는 5월)
        const examMonth = document.getElementById('tutExamMonth')?.value || 'mar';
        tutorialData.examMonth = examMonth;

        // 점수 환산 API 병렬 호출 → survey.js 로드 시 std/pct/grd 즉시 표시
        const [korConv, mathConv, inq1Conv, inq2Conv] = await Promise.all([
            convertScore(examMonth, 'kor',  korCommon + korSel,   korOpt,  '', korCommon,  korSel),
            convertScore(examMonth, 'math', mathCommon + mathSel, mathOpt, '', mathCommon, mathSel),
            convertScore(examMonth, 'inq1', inq1Raw, '', inq1Name),
            convertScore(examMonth, 'inq2', inq2Raw, '', inq2Name)
        ]);

        tutorialData.quan = {
            [examMonth]: {
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
            fetchTutorialRecommendations(stream, tutorialData.quan[examMonth], tutorialData.totalStdScore, examMonth)
                .then(selected => {
                    if (selected && selected.length > 0) {
                        tutorialData.selectedUnivs = selected;
                        localStorage.setItem('tut_selectedUnivs', JSON.stringify(selected));
                        apiCall('update_tutorial_status', { selectedUnivs: selected }).catch(() => {});
                    }
                }).catch(e => console.error('[튜토리얼] 추천대학 백그라운드 선정 실패:', e));
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

function normalizeGradeValue(raw) {
    const value = String(raw ?? '').trim();
    return /^[1-9]$/.test(value) ? value : '';
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
    // MBTI 결과를 DB에 저장 (재진입 시 복원용)
    apiCall('update_qual', { ...tutorialData.qual, mbti: tutorialData.mbti }).catch(() => {});
    simulateMbtiAnalysis();
}

function goToMBTI() {
    localStorage.setItem('tutorialStatus', 3);
    // DB에도 MBTI 단계 진입 상태 동기화 (keepalive로 redirect 후에도 전송 보장)
    if (localStorage.getItem('userId')) {
        fetch(CONFIG.api.user, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'update_tutorial_status', data: { step: 3 } }),
            keepalive: true
        }).catch(() => {});
    }
    window.location.href = '/mbti_survey?from_tutorial=true';
}

function simulateMbtiAnalysis() {
    const mbtiCode = tutorialData.mbti || 'CSDR';
    const TYPE_PROFILES = {
        CSDR: { name: '체계적 전략가', desc: '개념을 깊이 파고들고, 검증된 루틴으로 꾸준히 반복하며, 데이터에 근거한 철저한 계획으로 목표를 달성하는 유형입니다. 탄탄한 기본기 위에 전략을 쌓아 안정적으로 성적을 올릴 수 있어요.', traits: ['개념 이해력 우수', '루틴 학습에 강함', '계획 실행력 높음'] },
        CSDF: { name: '유연한 학자', desc: '개념 중심으로 학습하면서도 상황에 따라 전략을 조정할 줄 아는 유형입니다. 루틴 속에서 안정감을 유지하되, 필요하면 계획을 수정하는 유연함이 강점이에요.', traits: ['개념 이해력 우수', '안정적 루틴', '유연한 전략 수정'] },
        CSER: { name: '직관적 기획자', desc: '개념을 중심으로 학습하되 큰 흐름을 읽는 직관력이 뛰어난 유형입니다. 한번 세운 계획은 끝까지 밀고 나가는 실행력이 강점이에요.', traits: ['개념+직관 균형', '강한 실행력', '큰 그림 파악 능력'] },
        CSEF: { name: '자유로운 탐구자', desc: '개념 이해를 중시하면서도 직관과 유연함으로 자기만의 학습법을 찾아가는 유형입니다. 틀에 얽매이지 않는 창의적 학습이 가능해요.', traits: ['창의적 학습 가능', '자기주도적', '유연한 사고'] },
        CMDR: { name: '혁신적 설계자', desc: '새로운 방법을 적극적으로 시도하면서도 데이터에 기반한 견고한 계획을 세우는 유형입니다. 변화 속에서도 방향을 잃지 않는 전략적 사고가 강점이에요.', traits: ['새로운 방법 시도', '데이터 기반 판단', '전략적 변화 관리'] },
        CMDF: { name: '적응형 분석가', desc: '변화를 즐기면서도 근거를 중시하고, 상황에 맞게 전략을 빠르게 수정하는 유형입니다. 빠른 판단력과 적응력으로 효율적인 학습이 가능해요.', traits: ['빠른 적응력', '근거 중심 판단', '효율적 전략 수정'] },
        CMER: { name: '변화 추구 플래너', desc: '개념 학습을 기반으로 다양한 시도를 하면서도 큰 계획은 흔들림 없이 지키는 유형입니다. 흐름을 읽으면서 목표를 향해 나아가는 균형감이 강점이에요.', traits: ['다양한 시도', '흐름 파악 능력', '목표 지향적'] },
        CMEF: { name: '자유로운 학습자', desc: '개념을 기반으로 하되 변화와 직관, 유연함을 모두 갖춘 유형입니다. 고정된 틀 없이 자유롭게 학습하면서도 핵심을 놓치지 않는 감각이 있어요.', traits: ['자유로운 학습', '높은 적응력', '핵심 파악 능력'] },
        ISDR: { name: '실전형 전략가', desc: '문제 풀이를 통해 실력을 쌓고, 검증된 루틴과 데이터 기반 계획으로 목표를 향해 나아가는 유형입니다. 실전 경험에서 얻은 감각과 체계적 전략의 조합이 강점이에요.', traits: ['문제 풀이 중심', '체계적 루틴', '실전 감각 우수'] },
        ISDF: { name: '실전 적응형', desc: '문제 풀이를 통해 학습하며 근거를 중시하되 유연하게 전략을 조정하는 유형입니다. 실전에서 부딪히며 배우는 과정에서 빠르게 성장할 수 있어요.', traits: ['실전 학습 선호', '근거 기반', '유연한 조정력'] },
        ISER: { name: '실전 감각형', desc: '문제 풀이와 반복 루틴을 통해 체화하며, 흐름을 읽는 직관력으로 효율적으로 학습하는 유형입니다. 꾸준한 실전 연습이 성적 향상의 핵심이에요.', traits: ['반복 실전 학습', '직관적 판단', '꾸준한 실행'] },
        ISEF: { name: '자유로운 실전파', desc: '문제 중심으로 학습하면서 직관과 유연함을 겸비한 유형입니다. 다양한 문제를 자유롭게 풀어보며 자기만의 풀이법을 발견하는 능력이 뛰어나요.', traits: ['문제 해결 중심', '직관적 풀이', '자기만의 방법'] },
        IMDR: { name: '도전적 실행가', desc: '다양한 유형의 문제에 도전하며 데이터에 기반한 확고한 계획을 세우는 유형입니다. 새로운 문제에 대한 두려움이 적고 전략적으로 약점을 공략할 수 있어요.', traits: ['도전적 문제 풀이', '데이터 기반 전략', '약점 공략 능력'] },
        IMDF: { name: '민첩한 문제해결사', desc: '문제 풀이를 즐기며 변화에 빠르게 적응하는 전략적 유형입니다. 상황 판단이 빠르고, 근거에 기반해 최적의 풀이 전략을 즉석에서 수정할 수 있어요.', traits: ['빠른 상황 판단', '전략적 문제 풀이', '즉각적 수정 능력'] },
        IMER: { name: '감각적 도전가', desc: '문제 중심으로 다양한 시도를 하며 흐름을 읽는 감각과 계획 실행력을 겸비한 유형입니다. 실전에서 감을 잡으면 빠르게 성적이 오를 수 있어요.', traits: ['다양한 문제 도전', '흐름 파악 감각', '강한 실행력'] },
        IMEF: { name: '자유로운 도전가', desc: '문제 풀이에 변화, 직관, 유연함을 모두 갖춘 유형입니다. 어떤 유형의 문제든 자기만의 방식으로 접근하며, 틀에 얽매이지 않는 학습이 가능해요.', traits: ['자유로운 접근', '높은 적응력', '창의적 문제 해결'] }
    };
    const profile = TYPE_PROFILES[mbtiCode] || TYPE_PROFILES.CSDR;
    const traitsHtml = profile.traits.map(t => `<li class="mbti-trait-item">${t}</li>`).join('');
    const container = document.getElementById('stepContent');
    container.innerHTML = `
        <div class="step-card mbti-result-card">
            <div class="mbti-result-top">
                <div class="mbti-result-code">${mbtiCode}</div>
                <div class="mbti-result-name">${profile.name}</div>
            </div>
            <p class="mbti-result-desc">${profile.desc}</p>
            <ul class="mbti-trait-list">${traitsHtml}</ul>
            <button class="tut-action-btn" id="mbtiResultNextBtn">성적 종합 분석 시작하기</button>
        </div>`;
    updateMascot('학습 유형 분석이 완료되었어요! 결과를 확인하고, 종합 분석을 시작해보세요.', 'showresult');
    document.getElementById('tutNextBtn').style.display = 'none';
    document.getElementById('tutPrevBtn').style.display = 'none';
    document.getElementById('mbtiResultNextBtn').addEventListener('click', () => {
        container.innerHTML = `
            <div class="step-card" style="text-align:center; padding: 48px 20px;">
                <div style="font-size:2.5rem; margin-bottom:16px;">🔍</div>
                <div style="font-size:1.15rem; font-weight:700; color:#1e293b; margin-bottom:8px;">성적과 학습 유형을 종합 분석 중이에요</div>
                <div style="font-size:0.95rem; color:#64748b;">잠시만 기다려주세요...</div>
            </div>`;
        updateMascot('입력하신 성적과 학습 유형을 종합 분석 중입니다.', 'analysis');
        setTimeout(() => { currentStepIdx = 4; renderStep(); }, 2500);
    });
}

// ── 튜토리얼 추천대학 (서버 일괄 처리) ──────────────────────────────
const TUTORIAL_RECO_TARGET_COUNT = 3;
const TUTORIAL_RECO_BASE_MIN = 100;
const TUTORIAL_RECO_SIM_MIN = 125;

function toFiniteNumber(value, fallback = null) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function normalizeRecommendExcludes(excludes) {
    if (!Array.isArray(excludes)) return [];
    return excludes
        .filter(u => u && u.univ && u.major)
        .map(u => ({ univ: u.univ, major: u.major }));
}

function deriveRecommendationScores(item, fallbackCurrentScore = 0) {
    const currentScore = toFiniteNumber(item?.currentScore, toFiniteNumber(fallbackCurrentScore, 0));
    let simScore = toFiniteNumber(item?.simScore, null);
    if (simScore === null) {
        const gain = toFiniteNumber(item?.gain, null);
        if (gain !== null) simScore = currentScore + gain;
    }
    if (simScore === null) {
        const passCut = toFiniteNumber(item?.passCut, null);
        if (passCut !== null) simScore = Math.max(currentScore, passCut);
    }
    if (simScore === null) simScore = currentScore;
    return { currentScore, simScore };
}

function rankTutorialRecommendations(candidates, fallbackCurrentScore = 0, limit = TUTORIAL_RECO_TARGET_COUNT) {
    if (!Array.isArray(candidates) || candidates.length === 0) return [];

    const scored = candidates
        .filter(item => item && item.school && item.major)
        .map((item, idx) => {
            const { currentScore, simScore } = deriveRecommendationScores(item, fallbackCurrentScore);
            const meetsBase = currentScore >= TUTORIAL_RECO_BASE_MIN;
            const meetsBoost = simScore >= TUTORIAL_RECO_SIM_MIN;
            const priority = meetsBase && meetsBoost ? 0 : meetsBoost ? 1 : meetsBase ? 2 : 3;
            const gain = Math.max(0, simScore - currentScore);
            return { ...item, __priority: priority, __simScore: simScore, __currentScore: currentScore, __gain: gain, __idx: idx };
        });

    scored.sort((a, b) =>
        a.__priority - b.__priority ||
        b.__simScore - a.__simScore ||
        b.__currentScore - a.__currentScore ||
        b.__gain - a.__gain ||
        String(a.school || '').localeCompare(String(b.school || '')) ||
        String(a.major || '').localeCompare(String(b.major || '')) ||
        a.__idx - b.__idx
    );

    const picked = [];
    const seen = new Set();
    for (const row of scored) {
        const key = `${row.school}||${row.major}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const { __priority, __simScore, __currentScore, __gain, __idx, ...clean } = row;
        if (!Number.isFinite(Number(clean.currentScore))) clean.currentScore = Math.round(__currentScore);
        if (!Number.isFinite(Number(clean.simScore))) clean.simScore = Math.round(__simScore);
        picked.push(clean);
        if (picked.length >= limit) break;
    }
    return picked;
}

function countPreferredRecommendations(candidates, fallbackCurrentScore = 0) {
    if (!Array.isArray(candidates) || candidates.length === 0) return 0;
    return candidates.reduce((count, item) => {
        const { currentScore, simScore } = deriveRecommendationScores(item, fallbackCurrentScore);
        return count + ((currentScore >= TUTORIAL_RECO_BASE_MIN && simScore >= TUTORIAL_RECO_SIM_MIN) ? 1 : 0);
    }, 0);
}

function logRecommendationReason(stage, reasonCode, detail = {}) {
    // Intentionally no-op in runtime to keep end-user console clean.
    return;
}

function buildTutorialRecommendationPayload(stream, mar, totalStdScore, examMode, boostedRawScores, options = {}) {
    const payload = {
        type: 'get_tutorial_recommendations',
        userScores: buildUserScoresForAnalysis(mar),
        stream,
        totalStdScore,
        examMode: examMode || 'mar'
    };

    if (boostedRawScores) payload.boostedRawScores = boostedRawScores;
    if (options.selectedUniv && options.selectedUniv.univ) {
        payload.selectedUniv = {
            univ: options.selectedUniv.univ,
            major: options.selectedUniv.major
        };
    }

    const excludeUnivs = normalizeRecommendExcludes(options.excludeUnivs);
    if (excludeUnivs.length > 0) payload.excludeUnivs = excludeUnivs;

    if (Number.isFinite(Number(options.minCurrentScore))) {
        payload.minCurrentScore = Number(options.minCurrentScore);
    }
    if (Number.isFinite(Number(options.minSimScore))) {
        payload.minSimScore = Number(options.minSimScore);
    }

    return payload;
}

async function requestTutorialRecommendations(payload) {
    try {
        const res = await tutorialAnalysisFetch({
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            console.error('[튜토리얼] get_tutorial_recommendations 실패:', res.status);
            return null;
        }
        const data = await res.json();
        return Array.isArray(data.selected) ? data.selected : [];
    } catch (e) {
        console.error('[튜토리얼] get_tutorial_recommendations 에러:', e);
        return null;
    }
}

async function fetchTutorialRecommendations(stream, mar, totalStdScore, examMonth, boostedRawScores, extraOptions = {}) {
    if (!localStorage.getItem('userId') || !stream || !mar) return null;

    const requestedExamMode = examMonth || 'mar';
    const fallbackCurrentScore = toFiniteNumber(extraOptions.fallbackCurrentScore, toFiniteNumber(totalStdScore, 0));
    const targetCount = TUTORIAL_RECO_TARGET_COUNT;
    const selectedUniv = (extraOptions.selectedUniv && extraOptions.selectedUniv.univ)
        ? { univ: extraOptions.selectedUniv.univ, major: extraOptions.selectedUniv.major }
        : null;
    const excludeUnivs = normalizeRecommendExcludes(extraOptions.excludeUnivs);
    const candidatePool = [];

    const attempts = [
        {
            stage: 'strict',
            examMode: requestedExamMode,
            options: {
                selectedUniv,
                excludeUnivs,
                minCurrentScore: TUTORIAL_RECO_BASE_MIN,
                minSimScore: TUTORIAL_RECO_SIM_MIN
            }
        },
        {
            stage: 'expand_excludes',
            examMode: requestedExamMode,
            options: {
                selectedUniv,
                excludeUnivs: [],
                minCurrentScore: TUTORIAL_RECO_BASE_MIN,
                minSimScore: TUTORIAL_RECO_SIM_MIN
            }
        },
        {
            stage: 'expand_difficulty',
            examMode: requestedExamMode,
            options: {
                selectedUniv: null,
                excludeUnivs: [],
                minCurrentScore: TUTORIAL_RECO_BASE_MIN - 5,
                minSimScore: TUTORIAL_RECO_SIM_MIN - 5
            }
        }
    ];

    if (requestedExamMode === 'may') {
        attempts.push({
            stage: 'fallback_exam_month_strict',
            examMode: 'mar',
            options: {
                selectedUniv,
                excludeUnivs: [],
                minCurrentScore: TUTORIAL_RECO_BASE_MIN,
                minSimScore: TUTORIAL_RECO_SIM_MIN
            }
        });
        attempts.push({
            stage: 'fallback_exam_month_relaxed',
            examMode: 'mar',
            options: {
                selectedUniv: null,
                excludeUnivs: [],
                minCurrentScore: TUTORIAL_RECO_BASE_MIN - 5,
                minSimScore: TUTORIAL_RECO_SIM_MIN - 5
            }
        });
    }

    attempts.push({
        stage: 'deterministic_top3',
        examMode: requestedExamMode === 'may' ? 'mar' : requestedExamMode,
        options: {
            selectedUniv: null,
            excludeUnivs: []
        }
    });

    for (const attempt of attempts) {
        const attemptScores = tutorialData.quan?.[attempt.examMode] || mar;
        if (!attemptScores) {
            logRecommendationReason(attempt.stage, 'missing_score_payload', { examMode: attempt.examMode });
            continue;
        }
        const payload = buildTutorialRecommendationPayload(
            stream,
            attemptScores,
            totalStdScore,
            attempt.examMode,
            boostedRawScores,
            attempt.options
        );
        const selected = await requestTutorialRecommendations(payload);
        if (selected === null) {
            logRecommendationReason(attempt.stage, 'api_error', { examMode: attempt.examMode });
            continue;
        }

        const ranked = rankTutorialRecommendations(selected, fallbackCurrentScore, targetCount);
        if (ranked.length === 0) {
            logRecommendationReason(attempt.stage, 'empty_candidates', { examMode: attempt.examMode });
            continue;
        }

        candidatePool.push(...ranked);
        const mergedTop = rankTutorialRecommendations(candidatePool, fallbackCurrentScore, targetCount);
        const preferredCount = countPreferredRecommendations(mergedTop, fallbackCurrentScore);

        if (preferredCount >= targetCount) {
            logRecommendationReason(attempt.stage, 'strict_target_met', {
                examMode: attempt.examMode,
                totalCount: mergedTop.length,
                preferredCount
            });
            return mergedTop;
        }

        logRecommendationReason(attempt.stage, 'partial_result', {
            examMode: attempt.examMode,
            totalCount: mergedTop.length,
            preferredCount
        });
    }

    let finalTop = rankTutorialRecommendations(candidatePool, fallbackCurrentScore, targetCount);
    if (finalTop.length < targetCount && Array.isArray(tutorialData.selectedUnivs) && tutorialData.selectedUnivs.length > 0) {
        finalTop = rankTutorialRecommendations(
            [...finalTop, ...tutorialData.selectedUnivs],
            fallbackCurrentScore,
            targetCount
        );
        if (finalTop.length > 0) {
            logRecommendationReason('final', 'used_cached_candidates', { totalCount: finalTop.length });
        }
    }

    if (finalTop.length > 0) {
        logRecommendationReason('final', 'deterministic_fill', {
            totalCount: finalTop.length,
            preferredCount: countPreferredRecommendations(finalTop, fallbackCurrentScore)
        });
        return finalTop;
    }

    logRecommendationReason('final', 'no_candidates_left');
    return null;
}

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
        kor: { std: parseFloat(mar.kor?.std) || 0, pct: parseFloat(mar.kor?.pct) || 0, grd: parseInt(mar.kor?.grd) || 9, opt: mar.kor?.opt || '', name: '국어', raw: parseInt(mar.kor?.raw) || 0, common: parseInt(mar.kor?.common) || 0, elective: parseInt(mar.kor?.elective) || 0 },
        math: { std: parseFloat(mar.math?.std) || 0, pct: parseFloat(mar.math?.pct) || 0, grd: parseInt(mar.math?.grd) || 9, opt: mar.math?.opt || '', name: '수학', raw: parseInt(mar.math?.raw) || 0, common: parseInt(mar.math?.common) || 0, elective: parseInt(mar.math?.elective) || 0 },
        eng: { grd: mar.eng?.grd || 9 },
        inq1: { std: parseFloat(mar.inq1?.std) || 0, pct: parseFloat(mar.inq1?.pct) || 0, grd: parseInt(mar.inq1?.grd) || 9, name: inq1Name, raw: parseInt(mar.inq1?.raw) || 0 },
        inq2: { std: parseFloat(mar.inq2?.std) || 0, pct: parseFloat(mar.inq2?.pct) || 0, grd: parseInt(mar.inq2?.grd) || 9, name: inq2Name, raw: parseInt(mar.inq2?.raw) || 0 },
        restriction
    };
}

async function tutorialAnalysisFetch(options = {}) {
    const buildOptions = () => ({
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    let res = await fetch(CONFIG.api.analysis, buildOptions());
    if (res.status === 401 && typeof tryRefreshToken === 'function') {
        const refreshed = await tryRefreshToken();
        if (refreshed) res = await fetch(CONFIG.api.analysis, buildOptions());
    }
    return res;
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
        const PASS_CUT = 100, TOP70_CUT = 150, MAX_SCORE = 250;
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

function getMaxUiDiffFromSimData(simData) {
    if (!simData || typeof simData !== 'object') return 0;
    let max = 0;
    ['kor', 'math', 'inq1', 'inq2'].forEach((key) => {
        const uiDiff = Number(simData[key]?.uiDiff || 0);
        if (Number.isFinite(uiDiff) && uiDiff > max) max = uiDiff;
    });
    return max;
}

async function alignTutorialCardSimScores(univCards) {
    if (!Array.isArray(univCards) || univCards.length === 0) return univCards;

    const examMonth = tutorialData.examMonth || 'mar';
    const monthScores = tutorialData.quan?.[examMonth];
    if (!monthScores) return univCards;

    const targetUnivs = univCards
        .filter(u => u && u.school && u.major)
        .map(u => ({ univ: u.school, major: u.major }));
    if (targetUnivs.length === 0) return univCards;

    try {
        const res = await tutorialAnalysisFetch({
            method: 'POST',
            body: JSON.stringify({
                type: 'simulate_score_rise',
                isTutorial: true,
                targetUnivs,
                userScores: buildUserScoresForAnalysis(monthScores),
                examMode: examMonth
            })
        });
        if (!res.ok) return univCards;

        const simList = await res.json();
        if (!Array.isArray(simList)) return univCards;

        const simByKey = new Map();
        simList.forEach((item) => {
            if (!item || !item.univ || !item.major) return;
            simByKey.set(`${item.univ}||${item.major}`, item);
        });

        return univCards.map((card) => {
            const simItem = simByKey.get(`${card.school}||${card.major}`);
            if (!simItem || !Number.isFinite(Number(simItem.base_ui_score))) return card;

            const currentScore = Math.round(Number(simItem.base_ui_score));
            const maxUiDiff = getMaxUiDiffFromSimData(simItem.sim_data);
            const simScore = Math.round(Math.min(card.maxScore || 250, currentScore + maxUiDiff));
            const gain = Math.max(0, simScore - currentScore);
            return { ...card, currentScore, simScore, gain };
        });
    } catch (e) {
        console.error('[튜토리얼] 카드 시뮬레이션 정합화 실패:', e);
        return univCards;
    }
}

// ── 추천 대학 시뮬레이션 ──────────────────────────────────────────
async function initUnivSim() {
    const list = document.getElementById('univCardList');
    if (!list) return;
    list.innerHTML = '';

    // P1: 데이터가 없으면 재요청 시도
    if (!tutorialData.selectedUnivs || tutorialData.selectedUnivs.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:32px;color:#64748b;font-size:0.95rem;">추천 대학 재탐색 중입니다…</div>';
        try {
            const stream = tutorialData.qual?.stream;
            const examMonth = tutorialData.examMonth || 'mar';
            const mar = tutorialData.quan?.[examMonth];
            if (stream && tutorialData.totalStdScore > 0) {
                const selected = await fetchTutorialRecommendations(stream, mar, tutorialData.totalStdScore, examMonth);
                if (selected && selected.length > 0) {
                    tutorialData.selectedUnivs = selected;
                    localStorage.setItem('tut_selectedUnivs', JSON.stringify(selected));
                    apiCall('update_tutorial_status', { selectedUnivs: selected }).catch(() => {});
                }
            }
        } catch (e) {
            console.error('[튜토리얼] 추천대학 재요청 실패:', e);
        }
    }

    if (!tutorialData.selectedUnivs || tutorialData.selectedUnivs.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:32px;color:#64748b;font-size:0.95rem;">추천 대학 재탐색 중입니다…<br>잠시 후 다시 시도해 주세요.</div><button class="tut-action-btn" style="margin:16px auto;display:block;" onclick="currentStepIdx=2;renderStep();">성적 입력으로 돌아가기</button>';
        return;
    }

    const rawUnivsToRender = buildUnivCards(tutorialData.selectedUnivs, tutorialData.totalStdScore);
    const univsToRender = await alignTutorialCardSimScores(rawUnivsToRender);

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

        const fillId = 'sbcFill_' + u.school.replace(/\s/g, '_');

        card.dataset.currentPct = currentPct;
        card.dataset.simPct = simPct;
        card.dataset.currentScore = u.currentScore;
        card.dataset.simScore = u.simScore;

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
            <div class="univ-sim-badge" style="display:none">
                <span class="sim-badge-icon">✨</span>
                <span>1점 상승 시뮬레이션 <strong>+${u.gain}점</strong></span>
            </div>`;

        card.onclick = () => selectUniv(card, u, fillId, simPct);
        list.appendChild(card);
    });

    // 추천 대학 리스트가 생성되면 즉시 DB에 저장 (재진입 시 복원용)
    if (univsToRender.length > 0) {
        const univList = univsToRender.map(u => ({ univ: u.school, major: u.major }));
        apiCall('update_tutorial_status', { tutorialUniv: univList }).catch(() => {});
    }
}

function selectUniv(element, data, fillId, simPct) {
    // 이전 선택 카드의 바 및 시뮬레이션 뱃지 원상복구
    document.querySelectorAll('.univ-card.selected').forEach(c => {
        c.classList.remove('selected');
        const prevFill = c.querySelector('.sbc-fill');
        const origPct = c.dataset.currentPct;
        if (prevFill && origPct != null) {
            prevFill.style.transition = 'none';
            prevFill.style.width = origPct + '%';
        }
        const badge = c.querySelector('.univ-sim-badge');
        if (badge) badge.style.display = 'none';
        // 점수 라벨 원상복구
        const prevLabel = c.querySelector('.sbc-current-label');
        if (prevLabel) prevLabel.innerHTML = `현재 <strong>${c.dataset.currentScore}점</strong>`;
    });

    element.classList.add('selected');

    // 시뮬레이션 뱃지 표시
    const badge = element.querySelector('.univ-sim-badge');
    if (badge) badge.style.display = 'flex';

    // 점수 라벨 변경: 현재 → 시뮬레이션 점수
    const scoreLabel = element.querySelector('.sbc-current-label');
    if (scoreLabel) {
        scoreLabel.innerHTML = `<strong>${data.currentScore}점</strong> <span style="color:#10b981;font-weight:700;">→ ${data.simScore}점</span>`;
    }

    const fill = document.getElementById(fillId);
    if (fill) {
        const origPct = element.dataset.currentPct;
        fill.style.transition = 'none';
        fill.style.width = origPct + '%';
        fill.classList.add('animating');
        setTimeout(() => {
            fill.style.transition = '';
            fill.style.width = simPct + '%';
            setTimeout(() => fill.classList.remove('animating'), 900);
        }, 120);
    }

    tutorialData.selectedUniv = data;

    // 선택한 대학을 DB에 저장 (재진입 시 복원 + /analysis 1지망 설정용)
    const qualPayload = { ...tutorialData.qual, mbti: tutorialData.mbti, tutorialUniv: { univ: data.school, major: data.major } };
    apiCall('update_qual', qualPayload).catch(() => {});

    document.getElementById('tutNextBtn').style.display = 'block';
}

// ── 최소 노력 합격 최적화 (Greedy Algorithm) ─────────────────────

function gradeToApproxPct(grd) {
    const map = { '1': 96, '2': 89, '3': 77, '4': 60, '5': 40, '6': 23, '7': 11, '8': 4, '9': 1 };
    return map[String(grd)] || 50;
}

// deltaOverride: 부스트 폭을 명시적으로 지정 (로직 2 retry용). null이면 기존 자동 산정 사용
function calcGreedySubjectPlan(univ, mar, mbti, deltaOverride = null) {
    const currentScore = univ.currentScore || 0;

    // delta: UI 스케일(0~250) 부족분을 원점수 단위로 환산
    // UI 1점 ≈ 원점수 0.3~0.5점 (대학별 가중합 계수에 따라 다름)
    const uiGap = Math.max(20, 100 - currentScore);
    const delta = (deltaOverride !== null && Number.isFinite(deltaOverride))
        ? Math.min(50, Math.max(5, Math.round(deltaOverride)))
        : Math.min(30, Math.max(5, Math.round(uiGap * 0.35)));

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

    // 과목별 현재 원점수 & 만점
    const MAX_RAW = { kor: 100, math: 100, inq1: 50, inq2: 50, eng: 9 };
    const currentRaw = {
        kor: parseInt(mar.kor?.raw) || 0,
        math: parseInt(mar.math?.raw) || 0,
        inq1: parseInt(mar.inq1?.raw) || 0,
        inq2: parseInt(mar.inq2?.raw) || 0,
        eng: parseInt(mar.eng?.grd) || 9
    };

    const BASE_HARD_LIMIT = { kor: 10, math: 15, inq1: 8, inq2: 8, eng: 5 };
    const COLORS = { kor: '#8b5cf6', math: '#3b82f6', inq1: '#10b981', inq2: '#06b6d4', eng: '#f59e0b' };
    const LABELS = {
        kor: '국어', math: '수학',
        inq1: mar.inq1?.name || '탐구1',
        inq2: mar.inq2?.name || '탐구2',
        eng: '영어'
    };
    const mbtiW = { kor: w[0], math: w[1], inq1: w[2], inq2: w[2], eng: w[3] };

    // 최종 효율 = MBTI가중치 × (1 - 현재백분위/100) × 대학반영비율
    // hardLimit = min(기본한도, 만점 - 현재원점수) → 만점 초과 방지
    // 로직 2 retry로 deltaOverride가 들어왔으면 기본 한도를 2배까지 허용 (delta를 다 분배할 수 있게)
    const limitMultiplier = (deltaOverride !== null && deltaOverride > 25) ? 2 : 1;
    const subjects = ['kor', 'math', 'inq1', 'inq2', 'eng'].map(key => {
        const room = key === 'eng'
            ? Math.max(0, currentRaw.eng - 1)  // 영어: 등급 낮출 여유 (1등급이면 0)
            : Math.max(0, MAX_RAW[key] - currentRaw[key]);
        return {
            key,
            label: LABELS[key],
            color: COLORS[key],
            efficiency: mbtiW[key] * (1 - curPct[key] / 100) * ur[key],
            hardLimit: Math.min(BASE_HARD_LIMIT[key] * limitMultiplier, room)
        };
    }).sort((a, b) => b.efficiency - a.efficiency);

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

// ── 과목별 최적 상승 계획 + 선택한 대학 도달 시뮬레이션 ──────────
async function initSubjectRec() {
    const container = document.getElementById('subjectRecContent');
    if (!container) return;

    showTutLoading(true);

    const univ = tutorialData.selectedUniv;
    const activeMonth = tutorialData.examMonth || (tutorialData.quan?.may ? 'may' : 'mar');
    const mar  = tutorialData.quan?.[activeMonth];
    const mbti = tutorialData.mbti;

    // 로직 1: 초기 추천 3대학을 부스트 추천에서 제외하기 위한 목록
    const excludeUnivs = (tutorialData.selectedUnivs || [])
        .map(u => ({ univ: u.school, major: u.major }))
        .filter(u => u.univ && u.major);

    // 로직 2: retry 패턴 — 추천 3개 미달 시 부스트 폭(DELTA_STEP=8)씩 확대, 최대 3회
    const DELTA_STEP = 8;
    const DELTA_HARD_CAP = 45;
    const MAX_RETRIES = 3;

    let plan = null;
    let postSimUnivs = null;
    let finalDelta = 0;

    if (univ && mar && mbti) {
        // 1차 시도: deltaOverride 없이 기존 자동 산정
        try { plan = calcGreedySubjectPlan(univ, mar, mbti); } catch(e) {}

        if (plan && tutorialData.qual?.stream && tutorialData.totalStdScore > 0) {
            const baseDelta = plan.filter(s => s.assigned > 0 && s.key !== 'eng')
                .reduce((sum, s) => sum + s.assigned, 0);

            for (let tryCount = 0; tryCount < MAX_RETRIES; tryCount++) {
                const targetDelta = tryCount === 0 ? baseDelta : Math.min(DELTA_HARD_CAP, baseDelta + tryCount * DELTA_STEP);

                // tryCount > 0 이면 재계획 (확장 한도로 재분배)
                if (tryCount > 0) {
                    try { plan = calcGreedySubjectPlan(univ, mar, mbti, targetDelta); } catch(e) { break; }
                }

                const risingForSim = plan.filter(s => s.assigned > 0 && s.key !== 'eng');
                const totalGainForSim = risingForSim.reduce((sum, s) => sum + s.assigned, 0);
                if (totalGainForSim <= 0) break;

                const boostedRawScores = {};
                risingForSim.forEach(s => {
                    const curRaw = parseInt(mar[s.key]?.raw) || 0;
                    boostedRawScores[s.key] = curRaw + Math.round(s.assigned);
                });

                let attemptResult = null;
                try {
                    attemptResult = await fetchTutorialRecommendations(
                        tutorialData.qual.stream, mar, tutorialData.totalStdScore,
                        tutorialData.examMonth || 'mar', boostedRawScores,
                        {
                            selectedUniv: { univ: univ.school, major: univ.major },
                            excludeUnivs,
                            minCurrentScore: Number(univ.currentScore || 0) // 폴백/호환용 잔류
                        }
                    );
                } catch(e) { break; }

                postSimUnivs = attemptResult;
                finalDelta = totalGainForSim;

                if ((attemptResult || []).length >= 3) break;
                if (targetDelta >= DELTA_HARD_CAP) break;
            }
        }
    }

    // 로직 3: 학습 기간 산정 (8~16주, RAW_PER_WEEK=1.5)
    const RAW_PER_WEEK = 1.5;
    const MIN_WEEKS = 8;
    const MAX_WEEKS = 16;
    const estimatedWeeks = finalDelta > 0
        ? Math.min(MAX_WEEKS, Math.max(MIN_WEEKS, Math.ceil(finalDelta / RAW_PER_WEEK)))
        : MIN_WEEKS;

    showTutLoading(false);

    if (!mar || !plan) {
        container.innerHTML = '<div style="text-align:center;padding:32px;color:#64748b;font-size:0.95rem;">성적 데이터를 불러올 수 없습니다.<br>성적 입력 단계에서 다시 시도해 주세요.</div><button class="tut-action-btn" style="margin:16px auto;display:block;" onclick="currentStepIdx=2;renderStep();">성적 입력으로 돌아가기</button>';
        return;
    }

    // plan은 효율 순 정렬. key → plan item 맵
    const planMap = {};
    plan.forEach(s => { planMap[s.key] = s; });

    // assigned > 0인 과목 우선순위 순서 (블러 판단용)
    const risingByPriority = plan.filter(s => s.assigned > 0);
    const totalGainRawOnly = risingByPriority
        .filter(s => s.key !== 'eng')
        .reduce((sum, s) => sum + s.assigned, 0);

    const subjectOrder = ['kor', 'math', 'eng', 'inq1', 'inq2'];
    const LABELS = {
        kor: '국어', math: '수학', eng: '영어',
        inq1: mar.inq1?.name || '탐구1',
        inq2: mar.inq2?.name || '탐구2'
    };
    const COLORS = { kor: '#8b5cf6', math: '#3b82f6', eng: '#f59e0b', inq1: '#10b981', inq2: '#06b6d4' };

    const planRows = subjectOrder.map(key => {
        const s = planMap[key];
        const assigned = s ? s.assigned : 0;
        const color = COLORS[key];
        const label = LABELS[key];

        // 상승 과목 중 3순위 이상(인덱스 2+)은 잠금
        const priorityIdx = risingByPriority.findIndex(p => p.key === key);
        const isLocked = priorityIdx >= 2;

        if (assigned > 0 && isLocked) {
            return `<div class="score-plan-row score-plan-blurred">
                <div class="score-plan-subject" style="color:#94a3b8">???</div>
                <div class="plan-status plan-rise">🔒</div>
                <div class="plan-score-text" style="color:#94a3b8">비공개</div>
            </div>`;
        }

        if (key === 'eng') {
            const grd = mar.eng?.grd;
            const grdLabel = grd ? `${grd}등급` : '';
            return `<div class="score-plan-row">
                <div class="score-plan-subject" style="color:${color}">${label}</div>
                <div class="plan-status ${assigned > 0 ? 'plan-rise' : 'plan-hold'}">${assigned > 0 ? '향상' : '유지'}</div>
                <div class="plan-score-text">${grdLabel}</div>
            </div>`;
        }

        const rawScore = parseInt(mar[key]?.raw, 10) || 0;
        if (assigned > 0) {
            const newRaw = rawScore + Math.round(assigned);
            return `<div class="score-plan-row">
                <div class="score-plan-subject" style="color:${color}">${label}</div>
                <div class="plan-status plan-rise">+${Math.round(assigned)}</div>
                <div class="plan-score-text">${rawScore} → ${newRaw}</div>
            </div>`;
        }
        return `<div class="score-plan-row">
            <div class="score-plan-subject" style="color:${color}">${label}</div>
            <div class="plan-status plan-hold">유지</div>
            <div class="plan-score-text">${rawScore}</div>
        </div>`;
    }).join('');

    // 통합 "미래 대학" 섹션: (현재 대학) → (향상 후 대학 3개)
    let futureUnivHtml = '';
    if (univ || (postSimUnivs && postSimUnivs.length > 0)) {
        const catColors = { 안정: '#10b981', 적정: '#3b82f6', 도전: '#f59e0b' };
        const catBgs = { 안정: '#ecfdf5', 적정: '#eff6ff', 도전: '#fffbeb' };

        const currentBlock = univ ? `
            <div class="future-stage future-stage-now">
                <div class="future-stage-label">현재</div>
                <div class="future-stage-school">${univ.school}</div>
                <div class="future-stage-major">${univ.major}</div>
            </div>` : '';

        // 정렬 의도: 위→아래로 갈수록 난이도가 올라감 (안정 → 적정 → 도전)
        //   currentScore = 사용자의 UI 점수 (높을수록 그 대학이 사용자에게 쉬움)
        //   따라서 DESC 정렬: 쉬운(높은 currentScore) 대학을 먼저 → index 0 = 안정
        const sortedFutureUnivs = [...(postSimUnivs || [])].sort((a, b) => (b.currentScore || 0) - (a.currentScore || 0));
        const scoredFutureUnivs = sortedFutureUnivs.map((u, i, arr) => {
            const n = arr.length;
            let label = '적정';
            if (n <= 1) {
                label = '적정';
            } else if (n === 2) {
                label = (i === 0) ? '안정' : '도전';
            } else if (i === 0) {
                label = '안정';
            } else if (i === n - 1) {
                label = '도전';
            } else {
                label = '적정';
            }
            return { ...u, _label: label };
        });

        const futureCards = scoredFutureUnivs.map((u) => {
            const label = u._label;
            const color = catColors[label] || '#64748b';
            const bg = catBgs[label] || '#f8fafc';
            return `
            <div class="future-target-card" style="border-left:3px solid ${color}">
                <div class="future-card-badge" style="background:${bg};color:${color}">${label}</div>
                <div class="future-card-school">${u.school}</div>
                <div class="future-card-major">${u.major}</div>
            </div>`;
        }).join('');

        futureUnivHtml = `
        <div class="future-univ-section">
            <div class="future-univ-title">점수가 오르면 이런 대학도 갈 수 있어요</div>
            <div class="future-flow">
                ${currentBlock}
                <div class="future-connector">
                    <div class="future-connector-line"></div>
                    <div class="future-connector-badge">+${Math.round(totalGainRawOnly)}점 향상 시</div>
                    <div class="future-connector-line"></div>
                </div>
                <div class="future-stage future-stage-after">
                    <div class="future-stage-label future-stage-label-up">향상 후</div>
                    <div class="future-targets">
                        ${futureCards}
                    </div>
                </div>
            </div>
            <div class="future-period">
                Standard 이용 시 약 <strong>${estimatedWeeks}주</strong> 소요 예상
                <span style="display:block; font-size:0.78rem; color:#94a3b8; margin-top:3px;">
                    (원점수 +${Math.round(finalDelta)}점 기준, 주당 약 ${RAW_PER_WEEK}점 상승 가정)
                </span>
            </div>
        </div>`;
    }

    container.innerHTML = `
        <div class="score-plan-section">
            <div class="score-plan-header">
                <span class="score-plan-title">📊 과목별 최적 상승 계획</span>
                <span class="score-plan-total">합격선까지 <strong>+${Math.round(totalGainRawOnly)}점</strong></span>
            </div>
            <div class="score-plan-rows">${planRows}</div>
            <div class="score-plan-note">3·4순위 전략은 Standard 플랜 시작 후 공개됩니다.</div>
        </div>
        ${futureUnivHtml}`;
}

// ── 결제 / 완료 ──────────────────────────────────────────────────

function _setUpsellBtnsDisabled(disabled) {
    document.querySelectorAll('.tut-upsell-btn').forEach(b => { b.disabled = disabled; });
}

async function _completeTutorial(redirectUrl) {
    // 1. Trial 지급 (tier 상승 후 quota 부여)
    const trialResult = await apiCall('grant_tutorial_trial', {});
    if (!trialResult.success && !trialResult.message) {
        throw new Error(trialResult.error || '완료 처리 중 문제가 발생했습니다.');
    }
    // 2. Trial 지급 후 목표 대학 저장 (quota가 생긴 뒤에 호출)
    if (tutorialData.selectedUniv) {
        const payload = [{ univ: tutorialData.selectedUniv.school, major: tutorialData.selectedUniv.major }];
        await apiCall('update_target_univs', payload);
    }
    // _saveOnExit 레이스 방지: beforeunload보다 먼저 플래그 설정
    tutorialCompleted = true;
    localStorage.removeItem('tutorialStatus');
    localStorage.setItem('tutorial_completed', 'true');
    window.location.href = redirectUrl;
}

async function upsellPayment() {
    _setUpsellBtnsDisabled(true);
    try {
        await _completeTutorial('/payment');
    } catch (e) {
        alert(e.message || '통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        _setUpsellBtnsDisabled(false);
    }
}

async function endTutorial() {
    _setUpsellBtnsDisabled(true);
    try {
        await _completeTutorial('/');
    } catch (e) {
        alert(e.message || '통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        _setUpsellBtnsDisabled(false);
    }
}

async function downloadMBTIReport(mbtiResult) {
    try {
        const response = await fetch(CONFIG.api.user, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'update_mbti_promo', data: { targetUserId: 'me', promoCode: 'TUTORIAL', mbtiResult } })
        });
        const result = await response.json();
        if (result.success && result.downloadUrl) window.open(result.downloadUrl, '_blank');
    } catch (e) { /* silent */ }
}

async function convertScore(month, subject, score, opt, subName, common, elective) {
    if (!score || score <= 0) return { std: '', pct: '', grd: '' };
    const hasDual = common != null && elective != null;
    const payload = { type: 'convert_score', subject, score, opt: opt || '', subName: subName || '', ...(hasDual ? { common, elective } : {}) };
    try {
        const res = await tutorialAnalysisFetch({ method: 'POST', body: JSON.stringify({ ...payload, month }) });
        if (res.ok) {
            const data = await res.json();
            if (!data.error && (data.std || data.pct || data.grd)) return { std: data.std || '', pct: data.pct || '', grd: data.grd || '' };
        }
        // 5월 변환 실패 시 3월 기준 폴백
        if (month === 'may') {
            const fb = await tutorialAnalysisFetch({ method: 'POST', body: JSON.stringify({ ...payload, month: 'mar' }) });
            if (fb.ok) {
                const fd = await fb.json();
                if (!fd.error && (fd.std || fd.pct || fd.grd)) return { std: fd.std || '', pct: fd.pct || '', grd: fd.grd || '' };
            }
        }
        return { std: '', pct: '', grd: '' };
    } catch {
        return { std: '', pct: '', grd: '' };
    }
}

async function apiCall(type, data) {
    try {
        const response = await apiFetch(CONFIG.api.user, {
            method: 'POST',
            body: JSON.stringify({ type, data })
        });
        return await response.json();
    } catch (e) {
        return { success: false };
    }
}
