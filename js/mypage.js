// js/mypage.js

// 1. 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', () => {
    // 로그인 체크 (auth.js의 함수 활용 가능하지만 안전하게 한번 더 체크)
    if (!localStorage.getItem('accessToken')) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    // 사용자 기본 정보 표시
    const email = localStorage.getItem('userEmail');
    if(email) document.getElementById('userEmailDisplay').innerText = email;

    // 서버에서 사용자 데이터(기초조사서 포함) 불러오기
    fetchUserData();
});

// 전역 변수: 성적 데이터를 임시 저장할 객체
let examScores = {}; 

// 2. 탭 전환 로직
function openTab(tabName) {
    // 모든 탭 컨텐츠 숨김
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // 선택된 탭 활성화
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// 3. 서버에서 데이터 가져오기 (Lambda 연결 필요)
async function fetchUserData() {
    // ★ 실제로는 여기서 API 호출을 해야 합니다.
    // 지금은 예시 데이터를 사용하여 UI가 작동하는지 보여드립니다.
    // 나중에 아래 fetch 로직을 주석 해제하고 Lambda URL을 넣으세요.
    
    /*
    const response = await fetch('YOUR_LAMBDA_URL', {
        method: 'POST',
        body: JSON.stringify({ type: 'get_user_info', email: localStorage.getItem('userEmail') })
    });
    const data = await response.json();
    */

    // [테스트용 가짜 데이터]
    const data = {
        name: "임태륭",
        school: "서울고등학교",
        phone: "010-1234-5678",
        qualitative: null, // 아직 안 씀
        quantitative: {}   // 빈 객체
    };

    // 데이터 바인딩
    document.getElementById('userNameDisplay').innerText = data.name;
    document.getElementById('profileName').value = data.name;
    document.getElementById('profilePhone').value = data.phone;
    document.getElementById('profileSchool').value = data.school;

    // 기존 성적 데이터가 있다면 로드
    if(data.quantitative) {
        examScores = data.quantitative;
    }

    updateStatusUI(data);
}

// 4. 상태 업데이트 UI 로직 (핵심 요구사항)
function updateStatusUI(data) {
    const isQualDone = data.qualitative != null;
    const isQuanDone = Object.keys(examScores).length > 0; // 하나라도 성적이 있으면 완료 간주

    const qualStatus = document.getElementById('qualStatus');
    const quanStatus = document.getElementById('quanStatus');
    const badge = document.getElementById('statusBadge');

    // O/X 표시
    qualStatus.innerText = isQualDone ? "✅ 작성완료" : "❌ 미작성";
    quanStatus.innerText = isQuanDone ? "✅ 작성완료" : "❌ 미작성";

    // 배지 색상 및 텍스트 변경
    badge.className = 'status-badge'; // 클래스 초기화
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

// 5. 정성 데이터 저장
async function saveQualitative() {
    const consent = document.getElementById('dataConsent').checked;
    if (!consent) {
        alert("개인정보 활용 동의에 체크해주세요.");
        return;
    }

    const qualitativeData = {
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

    // API 호출 (가정)
    console.log("정성 데이터 저장:", qualitativeData);
    alert("정성 데이터가 저장되었습니다.");
    
    // UI 업데이트 시뮬레이션
    document.getElementById('qualStatus').innerText = "✅ 작성완료";
    // 실제로는 fetchUserData()를 다시 호출해서 서버 데이터를 반영해야 함
}

// 6. 정량 데이터 (성적) 로드 & 저장
function loadExamData() {
    const examMonth = document.getElementById('examSelect').value;
    const data = examScores[examMonth] || {}; // 저장된 게 없으면 빈값

    // 입력창 초기화 또는 값 채우기
    document.getElementById('korStd').value = data.kor?.std || '';
    document.getElementById('korPct').value = data.kor?.pct || '';
    document.getElementById('korGrd').value = data.kor?.grd || '';
    // ... 나머지 과목들도 동일하게 매핑 ...
}

async function saveQuantitative() {
    const examMonth = document.getElementById('examSelect').value;
    
    // 현재 입력창의 값을 객체로 구성
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
        // ... 탐구영역 데이터 추가 ...
    };

    // 전역 객체에 저장
    examScores[examMonth] = currentScore;

    console.log("전체 성적 데이터:", examScores);
    alert(`${examMonth} 시험 성적이 저장되었습니다.`);
    
    // 상태 업데이트
    document.getElementById('quanStatus').innerText = "✅ 작성완료";
}

function saveProfile() {
    // 프로필 수정 (비번 변경 등) 로직
    const newPw = document.getElementById('newPassword').value;
    if(newPw) {
        // Cognito 비밀번호 변경 API 호출 필요
        alert("비밀번호 변경 요청이 전송되었습니다.");
    } else {
        alert("정보가 수정되었습니다.");
    }
}