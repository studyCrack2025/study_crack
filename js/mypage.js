// js/mypage.js

// Lambda URL (StudyCrack_API URL 유지)
const MYPAGE_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/"; 

let currentUserData = {}; 
let examScores = {};      

document.addEventListener('DOMContentLoaded', () => {
    const accessToken = localStorage.getItem('accessToken');
    const userId = localStorage.getItem('userId'); 

    if (!accessToken || !userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }

    fetchUserData(userId);
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

async function fetchUserData(userId) {
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });

        if (!response.ok) throw new Error("서버 오류");

        const data = await response.json();
        currentUserData = data || {}; 
        
        renderUserInfo(currentUserData);
        
        if (currentUserData.qualitative) fillQualitativeForm(currentUserData.qualitative);
        if (currentUserData.quantitative) examScores = currentUserData.quantitative;
        
        // ★ [추가] 결제 상태 확인 및 UI 업데이트
        checkPaymentStatus(currentUserData.payments);

        loadExamData(); 
        updateStatusUI(currentUserData);

    } catch (error) {
        console.error("데이터 로드 중 오류:", error);
    }
}

// ★ [신규 기능] 결제 여부 확인 함수
function checkPaymentStatus(payments) {
    const profileBox = document.querySelector('.profile-summary');
    
    // payments 배열이 있고, 그 중에 status가 'paid'인 게 하나라도 있으면
    if (payments && payments.length > 0) {
        const hasPaid = payments.some(p => p.status === 'paid');
        
        if (hasPaid) {
            // 유료 회원 디자인 적용
            profileBox.classList.add('paid-member');
            
            // 프리미엄 뱃지 요소 추가 (없으면 생성)
            if (!document.querySelector('.premium-badge')) {
                const badge = document.createElement('div');
                badge.className = 'premium-badge';
                badge.innerText = "PREMIUM MEMBER";
                profileBox.appendChild(badge);
            }
        }
    }
}

function renderUserInfo(data) {
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

async function saveProfile() {
    const userId = localStorage.getItem('userId');
    const newPhone = document.getElementById('profilePhone').value;
    const newSchool = document.getElementById('profileSchool').value;
    const newName = document.getElementById('profileName').value;

    if (!newName) {
        alert("이름을 입력해주세요.");
        return;
    }

    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_profile',
                userId: userId,
                data: { phone: newPhone, school: newSchool, name: newName }
            })
        });
        
        if(response.ok) {
            alert("정보가 저장되었습니다.");
            location.reload(); 
        } else {
            throw new Error("저장 실패");
        }
    } catch (error) {
        alert("저장 중 오류가 발생했습니다.");
    }
}

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
        const response = await fetch(MYPAGE_API_URL, {
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

function loadExamData() {
    const examMonth = document.getElementById('examSelect').value;
    const data = examScores[examMonth] || {}; 

    document.getElementById('koreanOpt').value = data.kor?.opt || 'none';
    document.getElementById('korStd').value = data.kor?.std || '';
    document.getElementById('korPct').value = data.kor?.pct || '';
    document.getElementById('korGrd').value = data.kor?.grd || '';
    
    document.getElementById('mathOpt').value = data.math?.opt || 'none';
    document.getElementById('mathStd').value = data.math?.std || '';
    document.getElementById('mathPct').value = data.math?.pct || '';
    document.getElementById('mathGrd').value = data.math?.grd || '';
    
    document.getElementById('engGrd').value = data.eng?.grd || '';
    document.getElementById('histGrd').value = data.hist?.grd || '';
    
    document.getElementById('inq1Name').value = data.inq1?.name || '';
    document.getElementById('inq1Std').value = data.inq1?.std || '';
    document.getElementById('inq1Pct').value = data.inq1?.pct || '';
    document.getElementById('inq1Grd').value = data.inq1?.grd || '';
    
    document.getElementById('inq2Name').value = data.inq2?.name || '';
    document.getElementById('inq2Std').value = data.inq2?.std || '';
    document.getElementById('inq2Pct').value = data.inq2?.pct || '';
    document.getElementById('inq2Grd').value = data.inq2?.grd || '';
    
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
        const response = await fetch(MYPAGE_API_URL, {
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

// === 회원 탈퇴 함수 ===
async function handleDeleteAccount() {
    // 1. 확인 절차
    const isConfirmed = confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 성적 및 상담 데이터가 모두 삭제되며 복구할 수 없습니다.");
    
    if (!isConfirmed) return;

    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');

    try {
        // 2. DynamoDB 데이터 삭제 (Lambda 호출)
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'delete_user',
                userId: userId
            })
        });

        if (!response.ok) throw new Error("DB 삭제 실패");

        // 3. Cognito 계정 삭제
        // (현재 로그인된 세션을 가져와서 삭제 요청)
        const poolData = {
            UserPoolId: CONFIG.cognito.userPoolId,
            ClientId: CONFIG.cognito.clientId
        };
        const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        const cognitoUser = userPool.getCurrentUser();

        if (cognitoUser) {
            cognitoUser.getSession((err, session) => {
                if (err) {
                    alert("세션 오류로 탈퇴에 실패했습니다. 다시 로그인 후 시도해주세요.");
                    return;
                }
                
                // 실제 계정 삭제 API 호출
                cognitoUser.deleteUser((err, result) => {
                    if (err) {
                        alert("계정 삭제 실패: " + err.message);
                        return;
                    }
                    
                    // 4. 성공 시 마무리
                    alert("회원 탈퇴가 완료되었습니다.\n그동안 이용해 주셔서 감사합니다.");
                    localStorage.clear(); // 로컬 저장소 비우기
                    window.location.href = 'index.html'; // 메인으로 이동
                });
            });
        } else {
            // 이미 세션이 없는 경우 로컬만 지우고 보냄
            localStorage.clear();
            window.location.href = 'index.html';
        }

    } catch (error) {
        console.error(error);
        alert("탈퇴 처리 중 오류가 발생했습니다 관리자에게 문의하세요.");
    }
}