// js/survey.js

const SURVEY_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
// [주의] 데이터를 가져올 람다 함수(Analysis/Proxy) 주소
const DATA_FETCH_URL = "https://ftbrlbyaprizjcp5w7b2g5t6sq0srwem.lambda-url.ap-northeast-2.on.aws/";

let examScores = {}; 

console.log("🚀 [survey.js] Loaded (Secure Mode)");

document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    fetchUserData(userId);
    setupUI();
    
    // 자동 계산을 위한 이벤트 리스너 등록
    setupAutoCalculation();
    
    setTimeout(checkQualitativeForm, 500);
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// ============================================================
// 성적 자동 환산 요청 (서버로 요청)
// 사용자가 점수를 입력하면 서버에서 등급/백분위를 받아옵니다.
// ============================================================
async function requestScoreConversion(type) {
    // 1. 필요한 값 수집
    const month = document.getElementById('examSelect').value;
    let subjectKey = type;
    let scoreVal = 0;
    let optVal = "";
    let subNameVal = "";
    
    // ID 매핑
    let stdId = "", pctId = "", grdId = "";

    if (type === 'kor') {
        stdId = "korStd"; pctId = "korPct"; grdId = "korGrd";
        optVal = document.getElementById('koreanOpt').value;
    } else if (type === 'math') {
        stdId = "mathStd"; pctId = "mathPct"; grdId = "mathGrd";
        optVal = document.getElementById('mathOpt').value;
    } else if (type === 'inq1') {
        stdId = "inq1Std"; pctId = "inq1Pct"; grdId = "inq1Grd";
        subNameVal = document.getElementById('inq1Name').value;
    } else if (type === 'inq2') {
        stdId = "inq2Std"; pctId = "inq2Pct"; grdId = "inq2Grd";
        subNameVal = document.getElementById('inq2Name').value;
    }

    // 값 유효성 확인
    const stdEl = document.getElementById(stdId);
    if (!stdEl || !stdEl.value) return; // 점수가 없으면 요청 안함
    scoreVal = parseInt(stdEl.value);

    // 2. 서버 요청
    try {
        // 로딩 중 표시 (사용자 경험 개선)
        const pctEl = document.getElementById(pctId);
        const grdEl = document.getElementById(grdId);
        if(pctEl) pctEl.placeholder = "...";
        if(grdEl) grdEl.placeholder = "...";
        
        const response = await fetch(DATA_FETCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'convert_score', // [중요] Analysis Lambda에 새로 만든 기능 호출
                month: month,
                subject: subjectKey,
                score: scoreVal,
                opt: optVal,
                subName: subNameVal
            })
        });

        if (!response.ok) throw new Error("Conversion failed");
        
        const data = await response.json(); // { pct: "98", grd: "1" }
        
        // 3. 결과 적용
        if (data.pct && pctEl) pctEl.value = data.pct;
        if (data.grd && grdEl) grdEl.value = data.grd;

    } catch (e) {
        console.error("환산 실패:", e);
    }
}

// 이벤트 리스너 설정
// 입력 필드의 값이 변경(change)될 때마다 서버에 환산 요청
function setupAutoCalculation() {
    // 국어
    document.getElementById('korStd')?.addEventListener('change', () => requestScoreConversion('kor'));
    // 수학 (점수 변경 시, 선택과목 변경 시)
    document.getElementById('mathStd')?.addEventListener('change', () => requestScoreConversion('math'));
    document.getElementById('mathOpt')?.addEventListener('change', () => requestScoreConversion('math')); 
    // 탐구
    document.getElementById('inq1Std')?.addEventListener('change', () => requestScoreConversion('inq1'));
    document.getElementById('inq2Std')?.addEventListener('change', () => requestScoreConversion('inq2'));
    // 탐구 과목명이 바뀌어도 재계산 필요할 수 있음
    document.getElementById('inq1Name')?.addEventListener('change', () => requestScoreConversion('inq1'));
    document.getElementById('inq2Name')?.addEventListener('change', () => requestScoreConversion('inq2'));
}

// === UI 설정 ===
function setupUI() {
    const radioGroup = document.getElementById('statusRadioGroup');
    const etcInput = document.getElementById('statusEtcInput');
    const qualTab = document.getElementById('qualitative');

    if(etcInput) {
        etcInput.style.display = 'none';
        etcInput.removeAttribute('required'); 
    }

    if (radioGroup) {
        radioGroup.addEventListener('change', (e) => {
            if (e.target.value === 'other') {
                etcInput.style.display = 'block';
                etcInput.setAttribute('required', 'true');
            } else {
                etcInput.style.display = 'none';
                etcInput.removeAttribute('required');
                etcInput.value = '';
            }
            checkQualitativeForm();
        });
    }

    if (qualTab) {
        qualTab.addEventListener('input', checkQualitativeForm);
        qualTab.addEventListener('change', checkQualitativeForm);
        qualTab.addEventListener('click', checkQualitativeForm);
    }
}

// === 유효성 검사 ===
function checkQualitativeForm() {
    const saveBtn = document.getElementById('btnSaveQual');
    const container = document.getElementById('qualitative');
    if (!saveBtn || !container) return;

    const inputs = container.querySelectorAll('[required]');
    let isValid = true;

    for (const input of inputs) {
        if (input.offsetParent === null) continue; 
        if (input.type === 'radio') {
            if (!container.querySelector(`input[name="${input.name}"]:checked`)) {
                isValid = false; break; 
            }
        } else if (input.type === 'checkbox') {
            if (!input.checked) { isValid = false; break; }
        } else {
            if (!input.value || !input.value.trim()) { isValid = false; break; }
        }
    }

    saveBtn.disabled = !isValid;
    if (isValid) {
        saveBtn.innerText = "정성 데이터 저장";
        saveBtn.style.backgroundColor = "#2563EB"; 
        saveBtn.style.cursor = "pointer";
    } else {
        saveBtn.innerText = "필수 항목을 모두 입력해주세요";
        saveBtn.style.backgroundColor = "#cbd5e1"; 
        saveBtn.style.cursor = "not-allowed";
    }
}

// === 데이터 로드 및 저장 ===
async function fetchUserData(userId) {
    try {
        const response = await fetch(SURVEY_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        const data = await response.json();

        if (data.qualitative) fillQualitativeForm(data.qualitative);
        if (data.quantitative) {
            examScores = data.quantitative;
            loadExamData(); // 화면에 뿌리기
        }
    } catch (error) { console.error("데이터 로드 오류:", error); }
}

function fillQualitativeForm(qual) {
    if (!qual) return;
    if (qual.status) {
        const radio = document.querySelector(`input[name="studentStatus"][value="${qual.status}"]`);
        if (radio) radio.checked = true;
        else {
            const otherBtn = document.querySelector('input[name="studentStatus"][value="other"]');
            if(otherBtn) otherBtn.checked = true;
            const etc = document.getElementById('statusEtcInput');
            if(etc) { etc.style.display = 'block'; etc.value = qual.status; }
        }
    }
    const ids = {
        'targetStream': qual.stream, 'careerPath': qual.career,
        'mustGoCollege': qual.values?.mustGo, 'priorityType': qual.values?.priority,
        'appStrategy': qual.values?.strategy, 'worstScenario': qual.values?.worst,
        'regionRange': qual.values?.region, 'crossApply': qual.values?.cross,
        'groupGa': qual.candidates?.ga, 'groupNa': qual.candidates?.na, 'groupDa': qual.candidates?.da,
        'mostWanted': qual.candidates?.most, 'leastWanted': qual.candidates?.least,
        'selfAssessment': qual.candidates?.self,
        'parentOpinion': qual.parents?.opinion, 'parentInfluence': qual.parents?.influence,
        'transferPlan': qual.special?.transfer, 'teachingCert': qual.special?.teaching,
        'etcConsultingInfo': qual.special?.etc
    };
    for (const [id, val] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }
    if (qual.targets) {
        qual.targets.forEach((val, idx) => {
            const input = document.getElementById(`target${idx+1}`);
            if(input) input.value = val;
        });
    }
    checkQualitativeForm();
}

async function saveQualitative() {
    const userId = localStorage.getItem('userId');
    let statusVal = document.querySelector('input[name="studentStatus"]:checked')?.value;
    if (statusVal === 'other') statusVal = document.getElementById('statusEtcInput').value;

    const data = {
        status: statusVal,
        stream: document.getElementById('targetStream').value,
        career: document.getElementById('careerPath').value,
        values: {
            mustGo: document.getElementById('mustGoCollege').value,
            priority: document.getElementById('priorityType').value,
            strategy: document.getElementById('appStrategy').value,
            worst: document.getElementById('worstScenario').value,
            region: document.getElementById('regionRange').value,
            cross: document.getElementById('crossApply').value,
        },
        candidates: {
            ga: document.getElementById('groupGa').value, na: document.getElementById('groupNa').value, da: document.getElementById('groupDa').value,
            most: document.getElementById('mostWanted').value, least: document.getElementById('leastWanted').value, self: document.getElementById('selfAssessment').value
        },
        targets: [1,2,3,4,5].map(i => document.getElementById(`target${i}`)?.value || ''),
        parents: { opinion: document.getElementById('parentOpinion').value, influence: document.getElementById('parentInfluence').value },
        special: { transfer: document.getElementById('transferPlan').value, teaching: document.getElementById('teachingCert').value, etc: document.getElementById('etcConsultingInfo').value }
    };

    try {
        const res = await fetch(SURVEY_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_qual', userId, data })
        });
        if (res.ok) {
            alert("저장되었습니다! 다음으로 '성적 입력' 탭을 작성해주세요.");
            openTab('quantitative');
            window.scrollTo(0,0);
        }
    } catch (e) { alert("에러 발생: " + e.message); }
}

// 화면에 성적 불러오기
function loadExamData() {
    const month = document.getElementById('examSelect').value;

    const d = examScores[month] || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };

    setVal('koreanOpt', d.kor?.opt || 'none');
    setVal('korStd', d.kor?.std); 
    setVal('korPct', d.kor?.pct); setVal('korGrd', d.kor?.grd);
    
    setVal('mathOpt', d.math?.opt || 'none');
    setVal('mathStd', d.math?.std); setVal('mathPct', d.math?.pct); setVal('mathGrd', d.math?.grd);
    
    setVal('engGrd', d.eng?.grd); 
    setVal('histGrd', d.hist?.grd);
    
    setVal('inq1Name', d.inq1?.name); setVal('inq1Std', d.inq1?.std); setVal('inq1Pct', d.inq1?.pct); setVal('inq1Grd', d.inq1?.grd);
    setVal('inq2Name', d.inq2?.name); setVal('inq2Std', d.inq2?.std); setVal('inq2Pct', d.inq2?.pct); setVal('inq2Grd', d.inq2?.grd);
    
    setVal('foreignName', d.foreign?.name); setVal('foreignGrd', d.foreign?.grd);
}

async function saveQuantitative() {
    const userId = localStorage.getItem('userId');
    const month = document.getElementById('examSelect').value;
    const getVal = (id) => document.getElementById(id).value;

    examScores[month] = {
        kor: { opt: getVal('koreanOpt'), std: getVal('korStd'), pct: getVal('korPct'), grd: getVal('korGrd') },
        math: { opt: getVal('mathOpt'), std: getVal('mathStd'), pct: getVal('mathPct'), grd: getVal('mathGrd') },
        eng: { grd: getVal('engGrd') }, 
        hist: { grd: getVal('histGrd') },
        inq1: { name: getVal('inq1Name'), std: getVal('inq1Std'), pct: getVal('inq1Pct'), grd: getVal('inq1Grd') },
        inq2: { name: getVal('inq2Name'), std: getVal('inq2Std'), pct: getVal('inq2Pct'), grd: getVal('inq2Grd') },
        foreign: { name: getVal('foreignName'), grd: getVal('foreignGrd') }
    };

    try {
        const res = await fetch(SURVEY_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_quan', userId, data: examScores })
        });
        if (res.ok) {
            alert("성적 데이터가 저장되었습니다.\n마이페이지로 이동합니다.");
            window.location.href = 'mypage.html';
        }
    } catch (e) { alert("저장 실패"); }
}