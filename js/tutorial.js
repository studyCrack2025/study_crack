const MASCOTS = {
    hi: '/assets/images/mascots/crack_hi.png',
    thumbsup: '/assets/images/mascots/crack_thumbsup.png',
    startle: '/assets/images/mascots/crack_startle.png',
    sigh: '/assets/images/mascots/crack_sigh.png',
    analysis: '/assets/images/mascots/crack_analysis.png',
    showresult: '/assets/images/mascots/crack_showresult.png'
};

const STEPS = [
    { id: 'intro', msg: '환영합니다! 스터디크랙 온보딩 튜토리얼을 시작할게요.', mascot: 'hi' },
    { id: 'survey-qual', msg: '먼저 학생의 진로와 희망 계열을 알려주세요.', mascot: 'thumbsup' },
    { id: 'survey-quan', msg: '다음은 모의고사 원점수를 입력해주세요. 정확한 분석을 위해 쓰입니다.', mascot: 'analysis' },
    { id: 'mbti', msg: '이제 학습 성향을 파악할 차례예요. MBTI 검사를 진행할까요?', mascot: 'hi' },
    { id: 'univ-rec', msg: '입력하신 데이터를 기반으로 추천 학과를 분석했습니다!', mascot: 'showresult' },
    { id: 'subject-rec', msg: '선택하신 학과 합격을 위한 과목별 공부 시간 배분 솔루션입니다.', mascot: 'showresult' }
];

let currentStepIdx = 0;
let tutorialData = {
    qual: {}, quan: {}, mbti: null, selectedUniv: null
};

document.addEventListener('DOMContentLoaded', async () => {
    // 자동 재개 로직
    const savedStatus = localStorage.getItem('tutorialStatus');
    if (savedStatus) {
        currentStepIdx = parseInt(savedStatus, 10);
        alert('이전 튜토리얼 진행 위치부터 계속합니다.');
    }

    // MBTI 복귀 로직 확인 (URL Query Param)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mbti_completed')) {
        tutorialData.mbti = urlParams.get('mbti_result') || 'INTJ';
        currentStepIdx = 4; // 대학 추천 단계로 강제 점프
        simulateMbtiAnalysis();
        return;
    }

    renderStep();

    document.getElementById('tutPrevBtn').addEventListener('click', prevStep);
    document.getElementById('tutNextBtn').addEventListener('click', nextStep);
});

function updateMascot(msg, mascotKey) {
    document.getElementById('tutorialMsg').textContent = msg;
    document.getElementById('mascotImg').src = MASCOTS[mascotKey];
}

async function renderStep() {
    // 로컬 저장 후 바로 DB로 쏴줍니다.
    localStorage.setItem('tutorialStatus', currentStepIdx);
    apiCall('update_tutorial_status', { step: currentStepIdx });

    const step = STEPS[currentStepIdx];
    updateMascot(step.msg, step.mascot);

    const container = document.getElementById('stepContent');
    container.innerHTML = ''; 
    const template = document.getElementById(`tpl-${step.id}`);
    if (template) {
        container.appendChild(template.content.cloneNode(true));
    }

    const prevBtn = document.getElementById('tutPrevBtn');
    const nextBtn = document.getElementById('tutNextBtn');
    
    prevBtn.style.display = (currentStepIdx === 0 || currentStepIdx >= 4) ? 'none' : 'block';
    
    if (step.id === 'univ-rec') initUnivSim();
    if (step.id === 'mbti' || step.id === 'subject-rec') nextBtn.style.display = 'none';
    else nextBtn.style.display = 'block';
}

async function nextStep() {
    const step = STEPS[currentStepIdx];

    if (step.id === 'survey-qual') {
        tutorialData.qual = {
            status: document.getElementById('tutStatus')?.value || '',
            stream: document.getElementById('tutStream')?.value || ''
        };
        await apiCall('update_qual', tutorialData.qual);
    } else if (step.id === 'survey-quan') {
        // 💡 [수정됨] 탐구 과목 추가 및 Lambda 파싱 오류를 막기 위한 객체 래핑
        tutorialData.quan = {
            "tutorial_exam": { // 임의의 가상 시험 식별자
                kor: { raw: document.getElementById('tutKor')?.value || 0 },
                math: { raw: document.getElementById('tutMath')?.value || 0 },
                inq1: { name: "튜토리얼용탐구1", raw: document.getElementById('tutInq1')?.value || 0 },
                inq2: { name: "튜토리얼용탐구2", raw: document.getElementById('tutInq2')?.value || 0 }
            }
        };
        await apiCall('update_quan', tutorialData.quan);
    }

    if (currentStepIdx < STEPS.length - 1) {
        currentStepIdx++;
        renderStep(); // 여기서 자동으로 상태가 DB에 저장됩니다.
    }
}

function prevStep() {
    if (currentStepIdx > 0) {
        currentStepIdx--;
        renderStep();
    }
}

// --- MBTI 기능 ---
function goToMBTI() {
    localStorage.setItem('tutorialStatus', 3); // 상태 저장
    window.location.href = '/mbti/survey?from_tutorial=true';
}

function skipMBTI() {
    const val = document.getElementById('mbtiDirectInput').value;
    if (!val) { alert('결과를 입력해주세요.'); return; }
    
    // XSS 방지를 위해 textContent로 안전하게 처리된 상태 데이터만 메모리 적재
    tutorialData.mbti = val.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    simulateMbtiAnalysis();
}

function simulateMbtiAnalysis() {
    const container = document.getElementById('stepContent');
    container.innerHTML = '<div class="step-card"><h3 style="text-align:center;">크랙이가 결과를 분석중입니다...</h3></div>';
    updateMascot('입력된 MBTI와 성적을 종합하여 분석중입니다.', 'analysis');
    
    setTimeout(() => {
        currentStepIdx = 4;
        renderStep();
    }, 2500);
}

// --- PDF 다운로드 (Lambda 연동) ---
async function downloadMBTIReport(mbtiResult) {
    try {
        // 💡 [수정됨] 토큰 키를 'accessToken'으로 변경 & 하드코딩 URL 제거
        const response = await fetch(CONFIG.api.user, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` },
            body: JSON.stringify({ type: 'update_mbti_promo', data: { targetUserId: 'me', promoCode: 'TUTORIAL', mbtiResult: mbtiResult } })
        });
        const result = await response.json();
        if (result.success && result.downloadUrl) window.open(result.downloadUrl, '_blank');
    } catch (e) { console.error('PDF 다운로드 실패'); }
}

// --- 추천 대학 시뮬레이션 ---
const DEMO_UNIVS = [
    { school: '연세대학교', major: '컴퓨터과학과', score: 121, simScore: 124, reason: '1점 상승 시 환산점수 120점 돌파 구간' },
    { school: '고려대학교', major: '데이터과학과', score: 95, simScore: 98, reason: '현재 100점 미만이나 상승폭이 가장 큼' },
    { school: '성균관대학교', major: '소프트웨어학과', score: 108, simScore: 110, reason: '안정적인 상승 효율 구간' }
];

function initUnivSim() {
    const list = document.getElementById('univCardList');
    list.innerHTML = '';
    
    DEMO_UNIVS.forEach((u, i) => {
        const div = document.createElement('div');
        div.className = 'univ-card';
        div.innerHTML = `
            <div class="univ-card-title">${u.school} ${u.major}</div>
            <div class="univ-score">현재 환산점수: ${u.score}점</div>
            <div class="univ-sim-result">원점수 1점 상승 시 예상 환산점수: ${u.simScore}점<br><small>${u.reason}</small></div>
        `;
        div.onclick = () => selectUniv(div, u);
        list.appendChild(div);
    });
}

function selectUniv(element, data) {
    document.querySelectorAll('.univ-card').forEach(c => {
        c.classList.remove('selected');
        c.querySelector('.univ-sim-result').style.display = 'none';
    });
    
    element.classList.add('selected');
    element.querySelector('.univ-sim-result').style.display = 'block';
    tutorialData.selectedUniv = data;
    
    document.getElementById('tutNextBtn').style.display = 'block';
}

// --- 결제 및 완료 로직 ---
async function upsellPayment() {
    // 버튼 연타 방지
    const actionBtn = document.querySelector('.tut-action-btn');
    if (actionBtn) actionBtn.disabled = true;

    try {
        // 1. 선택 대학 디비 저장 (Lambda: update_target_univs)
        if (tutorialData.selectedUniv) {
            const payload = [ { univ: tutorialData.selectedUniv.school, major: tutorialData.selectedUniv.major } ];
            await apiCall('update_target_univs', payload);
        }
        
        // 2. 보상 지급 (Lambda: grant_tutorial_trial)
        const trialResult = await apiCall('grant_tutorial_trial', {});
        
        // 성공했거나 이미 유료 멤버십이라서 바로 넘어간 경우
        if (trialResult.success || trialResult.message) {
            // 3. 상태 정리 및 이동
            localStorage.removeItem('tutorialStatus');
            localStorage.setItem('tutorial_completed', 'true'); // 문지기 프리패스 도장 발급!
            
            alert('튜토리얼을 모두 완료하셨습니다! Trial 등급이 부여되었으며, 추가 목표대학 설정 기회가 제공됩니다.\n결제 페이지로 이동하여 다른 추천대학과 1순위 과목을 확인하세요!');
            window.location.href = '/payment';
        } else {
            alert(trialResult.error || '튜토리얼 완료 처리 중 문제가 발생했습니다.');
            if (actionBtn) actionBtn.disabled = false;
        }
    } catch (e) {
        console.error("튜토리얼 완료 처리 에러:", e);
        alert('통신 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        if (actionBtn) actionBtn.disabled = false;
    }
}

async function apiCall(type, data) {
    const token = localStorage.getItem('accessToken'); // 로그인 시 저장된 토큰 사용
    if (!token) return { success: false, error: 'Unauthorized' };

    try {
        const response = await fetch(CONFIG.api.user, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ type: type, data: data })
        });
        
        if (!response.ok) throw new Error('API 통신 에러');
        return await response.json();
    } catch (e) {
        console.error(`[API Error] ${type}:`, e);
        return { success: false };
    }
}