// js/mypage.js

// Lambda URL (공백 없음 확인)
const API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/"; 

let currentUserData = {}; 
let examScores = {};      

document.addEventListener('DOMContentLoaded', () => {
    const accessToken = localStorage.getItem('accessToken');
    // auth.js에서 대문자 Key로 저장함
    const userId = localStorage.getItem('userId'); 

    if (!accessToken || !userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    // 서버에서 데이터 가져오기 시도
    fetchUserData(userId);
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// === 데이터 불러오기 ===
async function fetchUserData(userId) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });

        if (!response.ok) throw new Error("서버 오류");

        const data = await response.json();
        
        // 데이터가 비어있어도(첫 로그인) 에러가 아닙니다.
        currentUserData = data || {}; 
        
        renderUserInfo(currentUserData);
        
        if (currentUserData.qualitative) fillQualitativeForm(currentUserData.qualitative);
        if (currentUserData.quantitative) examScores = currentUserData.quantitative;
        
        loadExamData(); 
        updateStatusUI(currentUserData);

    } catch (error) {
        console.error("데이터 로드 중 오류 (신규 회원은 무시 가능):", error);
    }
}

// === 화면 그리기 ===
function renderUserInfo(data) {
    // DB에 값이 없으면 공란으로 둠
    document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
    document.getElementById('userEmailDisplay').innerText = localStorage.getItem('userEmail') || '';
    
    document.getElementById('profileName').value = data.name || '';
    document.getElementById('profilePhone').value = data.phone || '';
    document.getElementById('profileSchool').value = data.school || '';
}

function fillQualitativeForm(qual) {
    if (!qual) return;
    if (qual.status) {
        const radio = document.querySelector(`input[name="studentStatus"][value="${qual.status}"]`);
        if (radio) radio.checked = true;
    }
    document.getElementById('targetStream').value = qual.stream || '';
    document.getElementById('careerPath').value = qual.career || '';
    
    if (qual.targets) {
        qual.targets.forEach((val, idx) => {
            const input = document.getElementById(`target${idx+1}`);
            if(input) input.value = val;
        });
    }
}

// === ★ [핵심] 프로필 저장 (이 버튼을 눌러야 DB가 생성됨) ===
async function saveProfile() {
    const userId = localStorage.getItem('userId');
    const newPhone = document.getElementById('profilePhone').value;
    const newSchool = document.getElementById('profileSchool').value;
    const newName = document.getElementById('profileName').value; // 이름 입력값

    if (!newName) {
        alert("이름을 입력해주세요.");
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_profile',
                userId: userId,
                data: { 
                    phone: newPhone, 
                    school: newSchool,
                    name: newName 
                }
            })
        });
        
        if(response.ok) {
            alert("정보가 저장되었습니다.");
            location.reload(); // 새로고침하면 이제 이름이 보일 겁니다!
        } else {
            throw new Error("저장 실패");
        }
    } catch (error) {
        console.error(error);
        alert("저장 중 오류가 발생했습니다.");
    }
}

// === 정성 데이터 저장 ===
async function saveQualitative() {
    const userId = localStorage.getItem('userId');
    const consent = document.getElementById('dataConsent').checked;
    
    if (!consent) {
        alert("개인정보 활용 동의에 체크해주세요.");
        return;
    }

    const qualData = {
        status: document.querySelector('input[name="studentStatus"]:checked')?.value,
        stream: document.getElementById('targetStream').value,
        career: document.getElementById('careerPath').value,
        targets: [
            document.getElementById('target1').value,
            document.getElementById('target2').value,
            document.getElementById('target3').value,
            document.getElementById('target4').value,
            document.getElementById('target5').value
        ]
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_qual',
                userId: userId,
                data: qualData
            })
        });
        
        if(response.ok) {
            alert("정성 조사서가 저장되었습니다.");
            location.reload();
        }
    } catch (error) {
        alert("저장 실패");
    }
}

// === 정량 데이터 저장 ===
function loadExamData() {
    const examMonth = document.getElementById('examSelect').value;
    const data = examScores[examMonth] || {}; 

    // 국어
    document.getElementById('koreanOpt').value = data.kor?.opt || 'none';
    document.getElementById('korStd').value = data.kor?.std || '';
    document.getElementById('korPct').value = data.kor?.pct || '';
    document.getElementById('korGrd').value = data.kor?.grd || '';
    // 수학
    document.getElementById('mathOpt').value = data.math?.opt || 'none';
    document.getElementById('mathStd').value = data.math?.std || '';
    document.getElementById('mathPct').value = data.math?.pct || '';
    document.getElementById('mathGrd').value = data.math?.grd || '';
    // 영어/한국사
    document.getElementById('engGrd').value = data.eng?.grd || '';
    document.getElementById('histGrd').value = data.hist?.grd || '';
    // 탐구
    document.getElementById('inq1Name').value = data.inq1?.name || '';
    document.getElementById('inq1Std').value = data.inq1?.std || '';
    document.getElementById('inq1Pct').value = data.inq1?.pct || '';
    document.getElementById('inq1Grd').value = data.inq1?.grd || '';
    
    document.getElementById('inq2Name').value = data.inq2?.name || '';
    document.getElementById('inq2Std').value = data.inq2?.std || '';
    document.getElementById('inq2Pct').value = data.inq2?.pct || '';
    document.getElementById('inq2Grd').value = data.inq2?.grd || '';
    // 제2외국어
    document.getElementById('foreignName').value = data.foreign?.name || '';
    document.getElementById('foreignGrd').value = data.foreign?.grd || '';
}

async function saveQuantitative() {
    const userId = localStorage.getItem('userId');
    const examMonth = document.getElementById('examSelect').value;

    const currentScore = {
        kor: {
            opt: document.getElementById('koreanOpt').value,
            std: document.getElementById('korStd').value,
            pct: document.getElementById('korPct').value,
            grd: document.getElementById('korGrd').value
        },
        math: {
            opt: document.getElementById('mathOpt').value,
            std: document.getElementById('mathStd').value,
            pct: document.getElementById('mathPct').value,
            grd: document.getElementById('mathGrd').value
        },
        eng: { grd: document.getElementById('engGrd').value },
        hist: { grd: document.getElementById('histGrd').value },
        inq1: {
            name: document.getElementById('inq1Name').value,
            std: document.getElementById('inq1Std').value,
            pct: document.getElementById('inq1Pct').value,
            grd: document.getElementById('inq1Grd').value
        },
        inq2: {
            name: document.getElementById('inq2Name').value,
            std: document.getElementById('inq2Std').value,
            pct: document.getElementById('inq2Pct').value,
            grd: document.getElementById('inq2Grd').value
        },
        foreign: {
            name: document.getElementById('foreignName').value,
            grd: document.getElementById('foreignGrd').value
        }
    };

    examScores[examMonth] = currentScore;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_quan',
                userId: userId,
                data: examScores
            })
        });
        
        if(response.ok) {
            alert("성적 데이터가 저장되었습니다.");
            location.reload();
        }
    } catch (error) {
        alert("저장 실패");
    }
}

function updateStatusUI(data) {
    const isQualDone = !!data.qualitative;
    const isQuanDone = data.quantitative && Object.keys(data.quantitative).length > 0;
    const badge = document.getElementById('statusBadge');
    
    document.getElementById('qualStatus').innerText = isQualDone ? "✅ 작성완료" : "❌ 미작성";
    document.getElementById('quanStatus').innerText = isQuanDone ? "✅ 작성완료" : "❌ 미작성";

    badge.className = 'status-badge';
    if (isQualDone && isQuanDone) {
        badge.classList.add('complete');
        badge.innerText = "기초조사서 작성 완료";
    } else if (isQualDone || isQuanDone) {
        badge.classList.add('partial');
        badge.innerText = "작성 진행 중";
    } else {
        badge.classList.add('incomplete');
        badge.innerText = "미작성 상태";
    }
}