// js/survey.js

// API URL (기존과 동일)
const API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";
let examScores = {}; // 성적 데이터 저장용 객체

document.addEventListener('DOMContentLoaded', () => {
    // 1. 로그인 체크
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    // 2. 기존 데이터 로드 (수정 모드일 경우 대비)
    fetchUserData(userId);

    // 3. UI 초기화 (기타 입력창, 유효성 검사 등)
    setupUI();
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// === 데이터 로드 ===
async function fetchUserData(userId) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        
        if (!response.ok) throw new Error("데이터 로드 실패");
        const data = await response.json();

        // 정성 데이터 있으면 채우기
        if (data.qualitative) fillQualitativeForm(data.qualitative);
        
        // 정량 데이터 있으면 채우기
        if (data.quantitative) examScores = data.quantitative;
        
        // 초기 렌더링
        loadExamData();
        checkQualitativeForm();

    } catch (error) {
        console.error(error);
    }
}

// === UI 설정 ===
function setupUI() {
    // 1. '기타' 상태 토글
    const radioGroup = document.getElementById('statusRadioGroup');
    const etcInput = document.getElementById('statusEtcInput');
    
    if (radioGroup) {
        radioGroup.addEventListener('change', (e) => {
            if (e.target.value === 'other') {
                etcInput.style.display = 'block';
                // setAttribute를 사용하여 확실하게 속성 부여
                etcInput.setAttribute('required', 'true');
            } else {
                etcInput.style.display = 'none';
                etcInput.removeAttribute('required');
                etcInput.value = '';
            }
            checkQualitativeForm();
        });
    }

    // 2. 정성 탭 유효성 검사 리스너
    const qualTab = document.getElementById('qualitative');
    if (qualTab) {
        // change, input 뿐만 아니라 click(라디오/체크박스)도 감지
        qualTab.addEventListener('input', checkQualitativeForm);
        qualTab.addEventListener('change', checkQualitativeForm);
        qualTab.addEventListener('click', checkQualitativeForm);
    }
}

// === 정성 데이터 관련 로직 ===
function fillQualitativeForm(qual) {
    if (!qual) return;
    
    // 상태 체크
    if (qual.status) {
        const radio = document.querySelector(`input[name="studentStatus"][value="${qual.status}"]`);
        if (radio) {
            radio.checked = true;
        } else {
            document.querySelector('input[value="other"]').checked = true;
            const etc = document.getElementById('statusEtcInput');
            etc.style.display = 'block';
            etc.value = qual.status;
        }
    }

    // 기본 & 질문지 데이터 채우기
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

    // 희망 대학
    if (qual.targets) {
        qual.targets.forEach((val, idx) => {
            const input = document.getElementById(`target${idx+1}`);
            if(input) input.value = val;
        });
    }
}

function checkQualitativeForm() {
    const saveBtn = document.getElementById('btnSaveQual');
    const container = document.getElementById('qualitative');
    // required 속성이 있는 모든 입력 요소 가져오기
    const inputs = container.querySelectorAll('[required]');
    
    let isValid = true;
    let invalidFieldName = ""; // 디버깅용: 어떤 필드가 문제인지 저장

    for (const input of inputs) {
        // 1. 숨겨진 요소는 검사 제외 (offsetHeight가 0이면 숨겨진 상태)
        if (input.offsetHeight === 0 && input.offsetWidth === 0) {
            continue;
        }

        // 2. 타입별 검사
        if (input.type === 'radio') {
            // 라디오 버튼은 그룹 중 하나라도 체크되어 있으면 통과
            const groupName = input.name;
            const isChecked = container.querySelector(`input[name="${groupName}"]:checked`);
            if (!isChecked) {
                isValid = false;
                invalidFieldName = `라디오 버튼 (${groupName})`;
                break; // 하나라도 실패하면 루프 종료
            }
        } else if (input.type === 'checkbox') {
            // 체크박스는 반드시 체크되어야 함
            if (!input.checked) {
                isValid = false;
                invalidFieldName = `체크박스 (${input.id})`;
                break;
            }
        } else {
            // 텍스트, 셀렉트 박스 등은 값이 비어있으면 안 됨
            if (!input.value.trim()) {
                isValid = false;
                invalidFieldName = `입력창 (${input.placeholder || input.id})`;
                break;
            }
        }
    }

    // 버튼 상태 업데이트
    saveBtn.disabled = !isValid;
    
    if (isValid) {
        saveBtn.innerText = "정성 데이터 저장";
        saveBtn.style.backgroundColor = "#2563EB"; // 활성화 색상 (파랑)
        saveBtn.style.cursor = "pointer";
    } else {
        saveBtn.innerText = "모든 필수 항목을 입력해주세요";
        saveBtn.style.backgroundColor = "#cbd5e1"; // 비활성화 색상 (회색)
        saveBtn.style.cursor = "not-allowed";
        
        // 개발자 도구(F12) 콘솔에서 원인 확인 가능
        // console.log("유효성 검사 실패:", invalidFieldName); 
    }
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
        targets: [1,2,3,4,5].map(i => document.getElementById(`target${i}`).value),
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
            openTab('quantitative'); // 자동 탭 전환 유도
            window.scrollTo(0,0);
        }
    } catch (e) { alert("저장 실패"); }
}

// === 정량 데이터(성적) 관련 로직 ===
function loadExamData() {
    const month = document.getElementById('examSelect').value;
    const d = examScores[month] || {};

    const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };

    setVal('koreanOpt', d.kor?.opt || 'none');
    setVal('korStd', d.kor?.std); setVal('korPct', d.kor?.pct); setVal('korGrd', d.kor?.grd);
    
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