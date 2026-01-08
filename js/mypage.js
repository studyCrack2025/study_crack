// js/mypage.js

// ★ 여기에 아까 만든 Lambda 함수 URL을 넣으세요!
const API_URL = "https://YOUR_LAMBDA_URL_HERE.lambda-url.ap-northeast-2.on.aws/"; 

let currentUserData = {}; // 전체 데이터 보관용
let examScores = {};      // 성적 데이터 보관용

document.addEventListener('DOMContentLoaded', () => {
    // 1. 로그인 체크 (Cognito 토큰 & UserId 확인)
    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId'); // Cognito Sub ID (DB의 PK)

    if (!accessToken || !userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    // 2. 서버에서 데이터 가져오기
    fetchUserData(userId);
});

// 탭 전환 기능
function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// === [API 통신] 데이터 불러오기 ===
async function fetchUserData(userId) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        const data = await response.json();
        
        // 데이터 바인딩
        currentUserData = data;
        renderUserInfo(data);
        
        // 정성 데이터 채우기
        if (data.qualitative) fillQualitativeForm(data.qualitative);
        
        // 정량 데이터(성적) 준비
        if (data.quantitative) {
            examScores = data.quantitative;
        }
        
        // 성적 입력창 초기화 (기본값: 3월)
        loadExamData(); 
        
        // 상태 배지 업데이트
        updateStatusUI(data);

    } catch (error) {
        console.error("데이터 로드 실패:", error);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
    }
}

// 화면 그리기 함수들
function renderUserInfo(data) {
    document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
    document.getElementById('userEmailDisplay').innerText = data.email || '';
    
    document.getElementById('profileName').value = data.name || '';
    document.getElementById('profilePhone').value = data.phone || '';
    document.getElementById('profileSchool').value = data.school || '';
}

function fillQualitativeForm(qual) {
    if (!qual) return;
    
    // 라디오 버튼 선택
    if (qual.status) {
        const radio = document.querySelector(`input[name="studentStatus"][value="${qual.status}"]`);
        if (radio) radio.checked = true;
    }
    
    document.getElementById('targetStream').value = qual.stream || '';
    document.getElementById('careerPath').value = qual.career || '';
    
    // 지망 대학 (배열)
    if (qual.targets && qual.targets.length > 0) {
        document.getElementById('target1').value = qual.targets[0] || '';
        document.getElementById('target2').value = qual.targets[1] || '';
        document.getElementById('target3').value = qual.targets[2] || '';
        document.getElementById('target4').value = qual.targets[3] || '';
        document.getElementById('target5').value = qual.targets[4] || '';
    }
}

// === [API 통신] 1. 프로필 수정 저장 ===
async function saveProfile() {
    const userId = localStorage.getItem('userId');
    const newPhone = document.getElementById('profilePhone').value;
    const newSchool = document.getElementById('profileSchool').value;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_profile',
                userId: userId,
                data: { phone: newPhone, school: newSchool }
            })
        });
        
        if(response.ok) {
            alert("회원 정보가 수정되었습니다.");
            location.reload(); // 새로고침하여 반영
        }
    } catch (error) {
        console.error(error);
        alert("저장 실패");
    }
}

// === [API 통신] 2. 정성 데이터 저장 ===
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

// === [API 통신] 3. 정량 데이터 저장 ===
function loadExamData() {
    const examMonth = document.getElementById('examSelect').value;
    const data = examScores[examMonth] || {}; 

    // 데이터가 있으면 넣고, 없으면 빈칸
    document.getElementById('koreanOpt').value = data.kor?.opt || 'none';
    document.getElementById('korStd').value = data.kor?.std || '';
    document.getElementById('korPct').value = data.kor?.pct || '';
    document.getElementById('korGrd').value = data.kor?.grd || '';

    document.getElementById('mathOpt').value = data.math?.opt || 'none';
    document.getElementById('mathStd').value = data.math?.std || '';
    document.getElementById('mathPct').value = data.math?.pct || '';
    document.getElementById('mathGrd').value = data.math?.grd || '';

    // ... (나머지 과목들도 동일한 패턴으로 매핑 필요) ...
    // 예시로 영어만 추가함
    document.getElementById('engGrd').value = data.eng?.grd || '';
}

async function saveQuantitative() {
    const userId = localStorage.getItem('userId');
    const examMonth = document.getElementById('examSelect').value;

    // 현재 화면의 데이터를 객체로 만듦
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
        // ... 나머지 과목 데이터 ...
    };

    // 전역 변수 업데이트
    examScores[examMonth] = currentScore;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_quan',
                userId: userId,
                data: examScores // 전체 데이터를 통째로 업데이트
            })
        });
        
        if(response.ok) {
            alert("성적 데이터가 저장되었습니다.");
            // 새로고침 안 해도 되지만 확실한 확인을 위해
            location.reload();
        }
    } catch (error) {
        alert("저장 실패");
    }
}

// 상태 UI 업데이트 (배지)
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