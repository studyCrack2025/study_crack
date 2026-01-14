// js/survey.js

// 1. 변수명 충돌 방지를 위해 이름 변경 (API_URL -> SURVEY_API_URL)
const SURVEY_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
let examScores = {}; 

console.log("🚀 [survey.js] 스크립트 정상 로드됨! (변수명 충돌 해결)");

document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    // 초기화 실행
    fetchUserData(userId);
    setupUI();
    
    // 강제 검사 실행 (0.5초 뒤)
    setTimeout(checkQualitativeForm, 500);
});

// 탭 전환 함수 (이제 정상 작동할 것입니다)
function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// === UI 설정 ===
function setupUI() {
    const radioGroup = document.getElementById('statusRadioGroup');
    const etcInput = document.getElementById('statusEtcInput');
    const qualTab = document.getElementById('qualitative');

    // 1. 초기화: 숨겨진 입력창 필수 속성 제거
    if(etcInput) {
        etcInput.style.display = 'none';
        etcInput.removeAttribute('required'); 
    }

    // 2. 라디오 버튼 이벤트
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

    // 3. 폼 전체 이벤트 감지
    if (qualTab) {
        qualTab.addEventListener('input', checkQualitativeForm);
        qualTab.addEventListener('change', checkQualitativeForm);
        qualTab.addEventListener('click', checkQualitativeForm);
    }
}

// === 유효성 검사 (디버깅 로그 포함) ===
function checkQualitativeForm() {
    const saveBtn = document.getElementById('btnSaveQual');
    const container = document.getElementById('qualitative');
    
    if (!saveBtn || !container) return;

    const inputs = container.querySelectorAll('[required]');
    
    let isValid = true;
    let blocker = null;

    for (const input of inputs) {
        // 화면에 안 보이는 요소는 검사 패스
        if (input.offsetParent === null) continue; 

        // 라디오 버튼 검사
        if (input.type === 'radio') {
            const groupName = input.name;
            const isChecked = container.querySelector(`input[name="${groupName}"]:checked`);
            if (!isChecked) {
                isValid = false;
                blocker = `🔘 라디오 선택 안함: [${groupName}]`;
                break; 
            }
        } 
        // 체크박스 검사
        else if (input.type === 'checkbox') {
            if (!input.checked) {
                isValid = false;
                blocker = `✅ 체크박스 미동의: [${input.id}]`;
                break;
            }
        } 
        // 일반 입력창 검사
        else {
            if (!input.value || !input.value.trim()) {
                isValid = false;
                blocker = `📝 빈칸 있음: [${input.id || input.placeholder}]`;
                break;
            }
        }
    }

    // 버튼 상태 업데이트
    saveBtn.disabled = !isValid;
    
    if (isValid) {
        saveBtn.innerText = "정성 데이터 저장";
        saveBtn.style.backgroundColor = "#2563EB"; 
        saveBtn.style.cursor = "pointer";
    } else {
        saveBtn.innerText = "필수 항목을 모두 입력해주세요";
        saveBtn.style.backgroundColor = "#cbd5e1"; 
        saveBtn.style.cursor = "not-allowed";
        
        // ★ 아직도 안되면 콘솔 확인!
        if (blocker) console.warn("⛔ 저장 불가 원인:", blocker);
    }
}

// === 데이터 로드 ===
async function fetchUserData(userId) {
    try {
        // 변수명 변경된 것 사용 (SURVEY_API_URL)
        const response = await fetch(SURVEY_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        const data = await response.json();

        if (data.qualitative) fillQualitativeForm(data.qualitative);
        if (data.quantitative) examScores = data.quantitative;
        
        loadExamData();
        checkQualitativeForm();

    } catch (error) { console.error("데이터 로드 오류:", error); }
}

function fillQualitativeForm(qual) {
    if (!qual) return;
    
    if (qual.status) {
        const radio = document.querySelector(`input[name="studentStatus"][value="${qual.status}"]`);
        if (radio) {
            radio.checked = true;
        } else {
            const otherBtn = document.querySelector('input[name="studentStatus"][value="other"]');
            if(otherBtn) otherBtn.checked = true;
            
            const etc = document.getElementById('statusEtcInput');
            if(etc) {
                etc.style.display = 'block';
                etc.setAttribute('required', 'true');
                etc.value = qual.status;
            }
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
    
    if (statusVal === 'other') {
        statusVal = document.getElementById('statusEtcInput').value;
    }

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
        parents: {
            opinion: document.getElementById('parentOpinion').value, influence: document.getElementById('parentInfluence').value
        },
        special: {
            transfer: document.getElementById('transferPlan').value, teaching: document.getElementById('teachingCert').value, etc: document.getElementById('etcConsultingInfo').value
        }
    };

    try {
        // 변수명 변경된 것 사용 (SURVEY_API_URL)
        const res = await fetch(SURVEY_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_qual', userId, data })
        });
        if (res.ok) {
            alert("저장되었습니다! 다음으로 '성적 입력' 탭을 작성해주세요.");
            openTab('quantitative');
            window.scrollTo(0,0);
        }
    } catch (e) { alert("저장 실패"); }
}

function loadExamData() {
    const month = document.getElementById('examSelect').value;
    const d = examScores[month] || {};
    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };

    setVal('koreanOpt', d.kor?.opt || 'none');
    setVal('korStd', d.kor?.std); setVal('korPct', d.kor?.pct); setVal('korGrd', d.kor?.grd);
    setVal('mathOpt', d.math?.opt || 'none');
    setVal('mathStd', d.math?.std); setVal('mathPct', d.math?.pct); setVal('mathGrd', d.math?.grd);
    setVal('engGrd', d.eng?.grd); setVal('histGrd', d.hist?.grd);
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
        eng: { grd: getVal('engGrd') }, hist: { grd: getVal('histGrd') },
        inq1: { name: getVal('inq1Name'), std: getVal('inq1Std'), pct: getVal('inq1Pct'), grd: getVal('inq1Grd') },
        inq2: { name: getVal('inq2Name'), std: getVal('inq2Std'), pct: getVal('inq2Pct'), grd: getVal('inq2Grd') },
        foreign: { name: getVal('foreignName'), grd: getVal('foreignGrd') }
    };

    try {
        // 변수명 변경된 것 사용 (SURVEY_API_URL)
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