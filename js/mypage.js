// js/mypage.js

// Lambda URL (공백 없음 확인 완료)
const API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/"; 

let currentUserData = {}; 
let examScores = {};      

document.addEventListener('DOMContentLoaded', () => {
    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId'); // auth.js에서 저장한 대문자 Key

    if (!accessToken || !userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    // 서버에서 데이터 가져오기
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
        
        currentUserData = data;
        renderUserInfo(data);
        
        if (data.qualitative) fillQualitativeForm(data.qualitative);
        if (data.quantitative) examScores = data.quantitative;
        
        loadExamData(); 
        updateStatusUI(data);

    } catch (error) {
        console.error("데이터 로드 실패 (신규 회원은 정상):", error);
        // DB가 비어있으면 아무것도 안 함 (신규 회원)
    }
}

// === 화면 그리기 ===
function renderUserInfo(data) {
    // DB에 이름이 없으면 '이름 없음' 표시
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
            if(document.getElementById(`target${idx+1}`)) 
                document.getElementById(`target${idx+1}`).value = val;
        });
    }
}

// === [중요] 프로필 저장 (이때 DB 데이터가 생성됨) ===
async function saveProfile() {
    const userId = localStorage.getItem('userId');
    const newPhone = document.getElementById('profilePhone').value;
    const newSchool = document.getElementById('profileSchool').value;
    const newName = document.getElementById('profileName').value; // 이름도 같이 저장

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_profile',
                userId: userId,
                data: { 
                    phone: newPhone, 
                    school: newSchool,
                    name: newName // 이름 데이터 추가
                }
            })
        });
        
        if(response.ok) {
            alert("회원 정보가 저장되었습니다.");
            location.reload(); 
        }
    } catch (error) {
        alert("저장 실패");
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