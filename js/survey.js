// js/survey.js

const SURVEY_API_URL = CONFIG.api.base;       
const DATA_FETCH_URL = CONFIG.api.analysis;   

let examScores = {}; 

document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    fetchUserData(userId);
    setupUI();
    
    setTimeout(checkQualitativeForm, 500);
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// ============================================================
// 성적 자동 환산 요청
// ============================================================
async function requestScoreConversion(type) {
    const month = document.getElementById('examSelect').value;
    let subjectKey = type;
    let scoreVal = 0;
    let optVal = "";
    let subNameVal = "";
    
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

    const stdEl = document.getElementById(stdId);
    if (!stdEl || !stdEl.value) return; 
    scoreVal = parseInt(stdEl.value);

    if (scoreVal < 0 || scoreVal > 200) {
        alert("유효하지 않은 점수입니다. (0~200점 사이)");
        stdEl.value = "";
        return;
    }

    const token = localStorage.getItem('accessToken');

    try {
        const pctEl = document.getElementById(pctId);
        const grdEl = document.getElementById(grdId);
        if(pctEl) pctEl.value = ""; pctEl.placeholder = "...";
        if(grdEl) grdEl.value = ""; grdEl.placeholder = "...";
        
        const response = await fetch(DATA_FETCH_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                type: 'convert_score', 
                month: month,
                subject: subjectKey,
                score: scoreVal,
                opt: optVal,
                subName: subNameVal
            })
        });

        if (!response.ok) throw new Error("Conversion failed");
        
        const data = await response.json(); 
        
        if (data.error || (!data.pct && !data.grd)) {
            alert("입력하신 표준점수에 해당하는 등급/백분위 데이터가 없습니다.\n(범위를 벗어났거나 해당 점수가 존재하지 않음)");
            stdEl.value = "";
            if(pctEl) pctEl.placeholder = "-";
            if(grdEl) grdEl.placeholder = "-";
            stdEl.focus();
            return;
        }
        
        if (data.pct && pctEl) pctEl.value = data.pct;
        if (data.grd && grdEl) grdEl.value = data.grd;

    } catch (e) {
        console.error("환산 실패:", e);
        alert("점수 환산 중 오류가 발생했습니다.");
    }
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

// === 데이터 로드 ===
async function fetchUserData(userId) {
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(SURVEY_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ type: 'get_user' })
        });
        const data = await response.json();

        if (data.qualitative) fillQualitativeForm(data.qualitative);
        if (data.quantitative) {
            examScores = data.quantitative;
            loadExamData(); 
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
    const token = localStorage.getItem('accessToken');
    
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
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ type: 'update_qual', userId, data })
        });
        if (res.ok) {
            alert("저장되었습니다! 다음으로 '성적 입력' 탭을 작성해주세요.");
            openTab('quantitative');
            window.scrollTo(0,0);
        }
    } catch (e) { alert("에러 발생: " + e.message); }
}

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

// ============================================================
// 성적 저장 + restriction(제약조건) 자동 생성 로직 포함
// ============================================================
async function saveQuantitative() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    const month = document.getElementById('examSelect').value;
    const getVal = (id) => document.getElementById(id).value;

    // 1. 기본 점수 데이터 수집
    const currentData = {
        kor: { opt: getVal('koreanOpt'), std: getVal('korStd'), pct: getVal('korPct'), grd: getVal('korGrd') },
        math: { opt: getVal('mathOpt'), std: getVal('mathStd'), pct: getVal('mathPct'), grd: getVal('mathGrd') },
        eng: { grd: getVal('engGrd') }, 
        hist: { grd: getVal('histGrd') },
        inq1: { name: getVal('inq1Name'), std: getVal('inq1Std'), pct: getVal('inq1Pct'), grd: getVal('inq1Grd') },
        inq2: { name: getVal('inq2Name'), std: getVal('inq2Std'), pct: getVal('inq2Pct'), grd: getVal('inq2Grd') },
        foreign: { name: getVal('foreignName'), grd: getVal('foreignGrd') }
    };

    // 2. restriction 자동 생성 로직
    const restriction = ["자유선택"]; // 디폴트

    // (A) 과탐 과목 리스트 (물화생지 1,2)
    const sciSubjects = ["물원","화원","생원","지원","물투","화투","생투","지투"];
    // (B) 사탐 과목 리스트 (나머지)
    // 참고: html value가 한글로 되어있으므로 이에 맞춤
    const socSubjects = ["생활과 윤리","윤리와 사상","한국지리","세계지리","동아시아사","세계사","경제","정치와 법","사회·문화"];

    const inq1 = currentData.inq1.name;
    const inq2 = currentData.inq2.name;
    const mathOpt = currentData.math.opt; // mi(미적), ki(기하), geo(확통)
    const foreignGrd = currentData.foreign.grd;

    // 탐구 판별
    const isSci1 = sciSubjects.includes(inq1);
    const isSci2 = sciSubjects.includes(inq2);
    const isSoc1 = socSubjects.includes(inq1);
    const isSoc2 = socSubjects.includes(inq2);

    const isSciAll = isSci1 && isSci2; // 탐구 2개 다 과탐
    const isSocAll = isSoc1 && isSoc2; // 탐구 2개 다 사탐

    // 수학 판별
    const isMiKi = (mathOpt === 'mi' || mathOpt === 'ki'); // 미적 or 기하
    const isGeo = (mathOpt === 'geo'); // 확통

    // 조건별 추가
    if (isSciAll) restriction.push("과탐 필수");
    if (isMiKi) restriction.push("미적기하 필수");
    if (isMiKi && isSciAll) restriction.push("미적기하+과탐 필수");
    if (isGeo) restriction.push("확통 필수");
    if (isGeo && isSocAll) restriction.push("확통+사탐 필수");
    if (foreignGrd && parseInt(foreignGrd) > 0) restriction.push("제2외 필수");

    // 3. 데이터 합치기 (restriction 필드 추가)
    currentData.restriction = restriction;
    
    // 전역 변수에 저장
    examScores[month] = currentData;

    try {
        const res = await fetch(SURVEY_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ type: 'update_quan', userId, data: examScores })
        });
        if (res.ok) {
            alert("성적 데이터가 저장되었습니다.\n(지원 가능 전형이 자동 계산되었습니다)\n\n마이페이지로 이동합니다.");
            window.location.href = 'mypage.html';
        }
    } catch (e) { alert("저장 실패"); }
}