// js/survey.js

const SURVEY_API_URL = CONFIG.api.base;       
const DATA_FETCH_URL = CONFIG.api.analysis;   

let examScores = {}; 

document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    fetchUserData(userId);
    setupUI();
    
    setTimeout(checkQualitativeForm, 500);
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    // 1. 콘텐츠 탭 활성화
    const targetContent = document.getElementById(tabName);
    if (targetContent) targetContent.classList.add('active');
    
    // 2. 버튼 탭 활성화 (이벤트 대신 요소 속성으로 직접 찾기)
    const targetBtn = document.querySelector(`.tab-btn[onclick="openTab('${tabName}')"]`);
    if (targetBtn) targetBtn.classList.add('active');
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
    
    // 이전 영어 데이터를 한글로 매핑해주기 위한 호환성 딕셔너리
    const LEGACY_MAP = {
        'humanities': '인문사회', 'business': '상경계열', 'nature': '자연/공학', 'medical': '의치한약수', 'nursing': '간호', 'education': '사범/교대', 'art': '예체능', 'etc': '기타',
        'yes': '예 (필수)', 'no': '아니오 (재수 가능)',
        'univ': '대학 간판 중요', 'major': '학과 전공 중요', 'balance': '균형 있게 고려',
        'low': '낮음', 'mid': '중간', 'high': '높음'
    };

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
        'highSchool': qual.school, // [추가] 출신 학교 불러오기
        'targetStream': LEGACY_MAP[qual.stream] || qual.stream,
        'careerPath': qual.career,
        'mustGoCollege': LEGACY_MAP[qual.values?.mustGo] || qual.values?.mustGo,
        'priorityType': LEGACY_MAP[qual.values?.priority] || qual.values?.priority,
        'appStrategy': qual.values?.strategy, 'worstScenario': qual.values?.worst,
        'regionRange': qual.values?.region, 'crossApply': qual.values?.cross,
        'groupGa': qual.candidates?.ga, 'groupNa': qual.candidates?.na, 'groupDa': qual.candidates?.da,
        'mostWanted': qual.candidates?.most, 'leastWanted': qual.candidates?.least,
        'selfAssessment': qual.candidates?.self,
        'parentOpinion': qual.parents?.opinion, 'parentInfluence': LEGACY_MAP[qual.parents?.influence] || qual.parents?.influence,
        'transferPlan': qual.special?.transfer, 'teachingCert': qual.special?.teaching,
        'etcConsultingInfo': qual.special?.etc
    };
    
    for (const [id, val] of Object.entries(ids)) {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    }
    
    // [추가] 불러온 학교 이름이 '검정고시'면 체크박스 ON
    if (qual.school === '검정고시') {
        const gedCheck = document.getElementById('isGed');
        if(gedCheck) {
            gedCheck.checked = true;
            toggleSchoolInput();
        }
    }

    if (qual.targets) {
        qual.targets.forEach((val, idx) => {
            const input = document.getElementById(`target${idx+1}`);
            if(input) input.value = val;
        });
    }
    checkQualitativeForm();
}

function toggleSchoolInput() {
    const isGed = document.getElementById('isGed').checked;
    const hsInput = document.getElementById('highSchool');
    
    if (isGed) {
        hsInput.value = "검정고시";
        hsInput.disabled = true;
        hsInput.removeAttribute('required');
    } else {
        if (hsInput.value === "검정고시") hsInput.value = "";
        hsInput.disabled = false;
        hsInput.setAttribute('required', 'true');
    }
    checkQualitativeForm(); // 저장 버튼 상태 즉시 업데이트
}

async function saveQualitative() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    
    let statusVal = document.querySelector('input[name="studentStatus"]:checked')?.value;
    if (statusVal === 'other') statusVal = document.getElementById('statusEtcInput').value;

    const data = {
        status: statusVal,
        school: document.getElementById('highSchool').value,
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
    } catch (e) { alert("저장 중 일시적인 문제가 발생했습니다. 닫고 다시 시도해주세요."); }
}

const TO_KOREAN = {
    'hwa': '화작', 'un': '언매',
    'hwak': '확통', 'mi': '미적', 'ki': '기하',
    '물원': '물1', '화원': '화1', '생원': '생1', '지원': '지1',
    '물투': '물2', '화투': '화2', '생투': '생2', '지투': '지2'
};

const TO_HTML_VALUE = {
    '화작': 'hwa', '언매': 'un',
    '확통': 'hwak', '미적': 'mi', '기하': 'ki',
    '물1': '물원', '화1': '화원', '생1': '생원', '지1': '지원',
    '물2': '물투', '화2': '화투', '생2': '생투', '지2': '지투'
};

function loadExamData() {
    const month = document.getElementById('examSelect').value;
    const d = examScores[month] || {};
    
    // 역변환 로직이 추가된 setVal 함수
    const setVal = (id, val) => { 
        const el = document.getElementById(id); 
        if(el) {
            // DB에 저장된 예쁜 한글(예: '확통')이 들어오면 HTML용('hwak')으로 변환
            el.value = TO_HTML_VALUE[val] || val || ''; 
        }
    };

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
// 성적 저장 + restriction(제약조건) 자동 생성 로직 (한글로 DB 저장)
// ============================================================
async function saveQuantitative() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('accessToken');
    const month = document.getElementById('examSelect').value;
    const getVal = (id) => document.getElementById(id).value;

    // 1. 선택된 드롭다운 값을 가져오기
    const korOpt = getVal('koreanOpt');
    const mathOpt = getVal('mathOpt');
    const inq1Name = getVal('inq1Name');
    const inq2Name = getVal('inq2Name');

    // 2. DB에 넣기 직전에 예쁜 한글명으로 변환해서 currentData 구성
    const currentData = {
        kor: { opt: TO_KOREAN[korOpt] || korOpt, std: getVal('korStd'), pct: getVal('korPct'), grd: getVal('korGrd') },
        math: { opt: TO_KOREAN[mathOpt] || mathOpt, std: getVal('mathStd'), pct: getVal('mathPct'), grd: getVal('mathGrd') },
        eng: { grd: getVal('engGrd') }, 
        hist: { grd: getVal('histGrd') },
        inq1: { name: TO_KOREAN[inq1Name] || inq1Name, std: getVal('inq1Std'), pct: getVal('inq1Pct'), grd: getVal('inq1Grd') },
        inq2: { name: TO_KOREAN[inq2Name] || inq2Name, std: getVal('inq2Std'), pct: getVal('inq2Pct'), grd: getVal('inq2Grd') },
        foreign: { name: getVal('foreignName'), grd: getVal('foreignGrd') }
    };

    // 3. restriction 자동 생성 로직
    const restriction = ["자유선택"]; 

    // (A) 과탐 과목 리스트 (물원 -> 물1 형식으로 업데이트)
    const sciSubjects = ["물1","화1","생1","지1","물2","화2","생2","지2"];
    const socSubjects = ["생활과 윤리","윤리와 사상","한국지리","세계지리","동아시아사","세계사","경제","정치와 법","사회·문화"];

    const inq1 = currentData.inq1.name;
    const inq2 = currentData.inq2.name;
    const mathVal = currentData.math.opt; 
    const foreignGrd = currentData.foreign.grd;

    const isSciAll = sciSubjects.includes(inq1) && sciSubjects.includes(inq2);
    const isSocAll = socSubjects.includes(inq1) && socSubjects.includes(inq2);

    // 수학 판별 (한글 기준으로 판별)
    const isMiKi = (mathVal === '미적' || mathVal === '기하'); 
    const isHwak = (mathVal === '확통'); // 🚨 기존 버그(geo) 픽스 완료!

    if (isSciAll) restriction.push("과탐 필수");
    if (isMiKi) restriction.push("미적기하 필수");
    if (isMiKi && isSciAll) restriction.push("미적기하+과탐 필수");
    if (isHwak) restriction.push("확통 필수");
    if (isHwak && isSocAll) restriction.push("확통+사탐 필수");
    if (foreignGrd && parseInt(foreignGrd) > 0) restriction.push("제2외 필수");

    currentData.restriction = restriction;
    
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
            alert("성적 데이터가 저장되었습니다.\n(지원 가능 전형이 자동 계산되었습니다)\n\n솔루션 페이지로 이동합니다.");
            window.location.href = '/analysis';
        }
    } catch (e) { alert("저장 실패"); }
}