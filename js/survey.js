// js/survey.js

// 1. JS 로드 확인용 로그 (콘솔에 이 메시지가 안 뜨면 파일 경로 문제임)
console.log("🚀 [survey.js] 스크립트가 로드되었습니다.");

const API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
let examScores = {}; 

document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ [survey.js] DOMContentLoaded 이벤트 발생");
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    // 초기화 함수들 실행
    fetchUserData(userId);
    setupUI();
    
    // 강제로 한 번 검사 실행
    setTimeout(checkQualitativeForm, 500); 
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// === UI 설정 ===
function setupUI() {
    console.log("🔧 [survey.js] UI 설정 시작");

    const radioGroup = document.getElementById('statusRadioGroup');
    const etcInput = document.getElementById('statusEtcInput');
    const qualTab = document.getElementById('qualitative');

    // 1. 기타 입력창 초기화
    if(etcInput) {
        etcInput.style.display = 'none';
        etcInput.removeAttribute('required'); 
        console.log("🔧 기타 입력창 초기화 완료");
    } else {
        console.error("❌ HTML에서 id='statusEtcInput' 요소를 찾을 수 없습니다.");
    }

    // 2. 라디오 버튼 이벤트 연결
    if (radioGroup) {
        radioGroup.addEventListener('change', (e) => {
            console.log("🖱️ 라디오 버튼 변경 감지:", e.target.value);
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
    } else {
        console.error("❌ HTML에서 id='statusRadioGroup' 요소를 찾을 수 없습니다.");
    }

    // 3. 폼 전체 이벤트 감지 (입력할 때마다 검사)
    if (qualTab) {
        qualTab.addEventListener('input', checkQualitativeForm);
        qualTab.addEventListener('change', checkQualitativeForm);
        qualTab.addEventListener('click', checkQualitativeForm); // 라디오/체크박스 클릭 감지
        console.log("👂 폼 이벤트 리스너 연결 완료");
    } else {
        console.error("❌ HTML에서 id='qualitative' (탭 영역)을 찾을 수 없습니다.");
    }
}

// === ★ 핵심: 유효성 검사 (범인 색출) ===
function checkQualitativeForm() {
    // console.log("🔍 유효성 검사 시작..."); // 너무 많이 뜨면 주석 처리

    const saveBtn = document.getElementById('btnSaveQual');
    const container = document.getElementById('qualitative');
    
    if (!saveBtn || !container) return;

    // 현재 required 속성이 있는 모든 요소 찾기
    const inputs = container.querySelectorAll('[required]');
    
    let isValid = true;
    let blocker = null; // 범인을 저장할 변수

    for (const input of inputs) {
        // 1. 숨겨진 요소(Hidden)는 검사 제외
        // offsetParent가 null이면 화면에 안 보이는 상태임 (display: none 등)
        if (input.offsetParent === null) {
            continue; 
        }

        // 2. 라디오 버튼 검사
        if (input.type === 'radio') {
            const groupName = input.name;
            const isChecked = container.querySelector(`input[name="${groupName}"]:checked`);
            if (!isChecked) {
                isValid = false;
                blocker = `🔘 라디오 버튼 선택 안함: [${groupName}]`;
                break; // 범인 찾았으니 중단
            }
        } 
        // 3. 체크박스 검사 (동의 등)
        else if (input.type === 'checkbox') {
            if (!input.checked) {
                isValid = false;
                blocker = `✅ 체크박스 미동의: [${input.id}]`;
                break;
            }
        } 
        // 4. 일반 입력창 검사 (텍스트, 셀렉트)
        else {
            if (!input.value || !input.value.trim()) {
                isValid = false;
                blocker = `📝 빈칸 있음: [${input.id || input.placeholder || '이름없는 필드'}]`;
                break;
            }
        }
    }

    // 결과 처리
    saveBtn.disabled = !isValid;
    
    if (isValid) {
        saveBtn.innerText = "정성 데이터 저장 (활성화됨)";
        saveBtn.style.backgroundColor = "#2563EB"; 
        saveBtn.style.cursor = "pointer";
        // console.log("🟢 모든 조건 충족! 버튼 활성화");
    } else {
        saveBtn.innerText = "필수 항목을 모두 입력해주세요";
        saveBtn.style.backgroundColor = "#cbd5e1"; 
        saveBtn.style.cursor = "not-allowed";
        
        // ★ 범인이 누군지 콘솔에 찍어줍니다!
        if (blocker) {
            console.warn("⛔ 저장 불가 원인:", blocker);
        }
    }
}

// === 서버 데이터 로드 ===
async function fetchUserData(userId) {
    try {
        console.log("📡 데이터 로드 시작...");
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        const data = await response.json();
        console.log("📦 데이터 수신 완료:", data);

        if (data.qualitative) fillQualitativeForm(data.qualitative);
        if (data.quantitative) examScores = data.quantitative;
        
        loadExamData();
        checkQualitativeForm(); // 데이터 채운 후 재검사

    } catch (error) { console.error("데이터 로드 오류:", error); }
}

function fillQualitativeForm(qual) {
    if (!qual) return;
    
    // 라디오 버튼 채우기
    if (qual.status) {
        const radio = document.querySelector(`input[name="studentStatus"][value="${qual.status}"]`);
        if (radio) {
            radio.checked = true;
        } else {
            // 기타 값 처리
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

    // 나머지 필드 채우기 (ID 매핑)
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

    // 희망 대학 채우기
    if (qual.targets) {
        qual.targets.forEach((val, idx) => {
            const input = document.getElementById(`target${idx+1}`);
            if(input) input.value = val;
        });
    }
    
    checkQualitativeForm();
}

// === 저장 함수들 ===
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
        const res = await fetch(API_URL, {
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
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_quan', userId, data: examScores })
        });
        if (res.ok) {
            alert("성적 데이터가 저장되었습니다.\n마이페이지로 이동합니다.");
            window.location.href = 'mypage.html';
        }
    } catch (e) { alert("저장 실패"); }
}