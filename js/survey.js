// js/survey.js

const SURVEY_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
// [주의] 데이터를 가져올 람다 함수(S3 Proxy) 주소. 만약 mypage와 다르다면 수정 필요.
// 같은 람다를 쓴다면 아래 주소를 사용하세요. (파일명은 요청시 보냄)
const DATA_FETCH_URL = "https://ftbrlbyaprizjcp5w7b2g5t6sq0srwem.lambda-url.ap-northeast-2.on.aws/";

// 시험별 참조할 데이터 파일 매핑 (미래 확장성 고려)
const SCORE_FILE_MAP = {
    'mar': '2026_KSAT_scoreboard.json',
    'may': '2026_KSAT_scoreboard.json',
    'jun': '2026_KSAT_scoreboard.json',
    'jul': '2026_KSAT_scoreboard.json',
    'sep': '2026_KSAT_scoreboard.json',
    'oct': '2026_KSAT_scoreboard.json',
    'csat': '2026_KSAT_scoreboard.json'
};

let examScores = {}; 
let scoreDataMap = {}; // 로드된 성적표 데이터 (빠른 검색용)

console.log("🚀 [survey.js] Loaded");

document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    fetchUserData(userId);
    setupUI();
    
    // 초기 로딩 시 현재 선택된 시험의 데이터 가져오기
    loadScoreboardData(); 

    setTimeout(checkQualitativeForm, 500);
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// === 데이터 로드 (성적표 JSON) ===
async function loadScoreboardData() {
    const month = document.getElementById('examSelect').value;
    const fileName = SCORE_FILE_MAP[month];

    if (!fileName) {
        console.warn("해당 시험에 대한 데이터 파일이 정의되지 않았습니다.");
        return;
    }

    try {
        console.log(`📥 성적 데이터 로드 중... (${fileName})`);
        
        // 람다에 'get_s3_file' 타입으로 요청 (람다가 이를 지원해야 함)
        // 만약 람다가 파일명을 직접 받지 않는다면, 람다 코드를 수정하거나 
        // 람다가 알아서 'type: get_scoreboard' 등으로 처리하도록 맞춰야 합니다.
        // 여기서는 기존 fetchUnivData와 비슷한 방식으로 요청합니다.
        
        const response = await fetch(DATA_FETCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                type: 'get_s3_file', // ★ Lambda에서 이 타입을 처리하도록 로직 추가 필요 (아래 설명 참조)
                key: fileName 
            })
        });

        if (!response.ok) throw new Error("서버 응답 오류");
        const json = await response.json();
        
        // 데이터 파싱 및 맵핑 (검색 속도 최적화)
        parseScoreData(json);

    } catch (e) {
        console.error("성적 데이터 로드 실패:", e);
        // 실패해도 입력은 가능해야 하므로 조용히 실패 처리
    }
}

// JSON 데이터를 검색하기 쉬운 구조로 변환
function parseScoreData(jsonList) {
    scoreDataMap = {}; // 초기화

    // 구조: scoreDataMap[과목명][표준점수] = { pct, grd }
    jsonList.forEach(area => {
        if (area.데이터 && Array.isArray(area.데이터)) {
            area.데이터.forEach(row => {
                const subject = row["과목"];
                const std = row["표준점수"];
                
                if (!scoreDataMap[subject]) {
                    scoreDataMap[subject] = {};
                }
                
                scoreDataMap[subject][std] = {
                    pct: row["백분위(성적표)"],
                    grd: row["등급(성적표)"]
                };
            });
        }
    });
    console.log("✅ 성적 데이터 파싱 완료");
}

// === 자동 계산 로직 ===
function calculateScore(type) {
    // 1. 과목명 결정
    let subjectName = "";
    let stdInputId = "";
    let pctInputId = "";
    let grdInputId = "";

    if (type === 'kor') {
        subjectName = "국어"; // 국어는 선택과목 상관없이 공통 등급 산출이 일반적
        stdInputId = "korStd"; pctInputId = "korPct"; grdInputId = "korGrd";
    } else if (type === 'math') {
        const opt = document.getElementById('mathOpt').value;
        if (opt === 'mi') subjectName = "수학(미적)";
        else if (opt === 'hwak') subjectName = "수학(확통)";
        else if (opt === 'ki') subjectName = "수학(기하)";
        else return; // 선택 안함
        
        stdInputId = "mathStd"; pctInputId = "mathPct"; grdInputId = "mathGrd";
    } else if (type === 'inq1') {
        subjectName = document.getElementById('inq1Name').value;
        stdInputId = "inq1Std"; pctInputId = "inq1Pct"; grdInputId = "inq1Grd";
    } else if (type === 'inq2') {
        subjectName = document.getElementById('inq2Name').value;
        stdInputId = "inq2Std"; pctInputId = "inq2Pct"; grdInputId = "inq2Grd";
    }

    if (!subjectName) return;

    // 2. 표준점수 가져오기
    const stdVal = parseInt(document.getElementById(stdInputId).value);
    if (isNaN(stdVal)) {
        // 비어있으면 초기화
        document.getElementById(pctInputId).value = "";
        document.getElementById(grdInputId).value = "";
        return;
    }

    // 3. 데이터 조회 및 적용
    if (scoreDataMap[subjectName] && scoreDataMap[subjectName][stdVal]) {
        const data = scoreDataMap[subjectName][stdVal];
        document.getElementById(pctInputId).value = data.pct;
        document.getElementById(grdInputId).value = data.grd;
    } else {
        // 데이터가 없는 경우 (범위 벗어남 등)
        console.warn(`데이터 없음: ${subjectName} - ${stdVal}점`);
        document.getElementById(pctInputId).value = "";
        document.getElementById(grdInputId).value = "";
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

// 화면에 성적 불러오기 (및 자동 계산 트리거)
function loadExamData() {
    const month = document.getElementById('examSelect').value;
    
    // 시험 종류가 바뀌면 해당 데이터 파일을 다시 로드해야 함 (구조상 파일이 나뉘어져 있다면)
    loadScoreboardData(); 

    const d = examScores[month] || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };

    setVal('koreanOpt', d.kor?.opt || 'none');
    setVal('korStd', d.kor?.std); 
    // 저장된 값이 있더라도 자동계산이 우선인지, 저장값이 우선인지?
    // 보통은 저장된 값을 보여주지만, 데이터 일관성을 위해 재계산하는 것이 좋을 수도 있음.
    // 여기서는 저장된 값을 우선 보여줌.
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