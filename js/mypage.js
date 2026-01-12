// js/mypage.js

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
    setupQualitativeFormUI(); // 정성 조사서 UI 로직 연결
});

function openTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

// === 정성 조사서 UI 로직 (기타 입력창 토글 & 유효성 검사) ===
function setupQualitativeFormUI() {
    const radioGroup = document.getElementById('statusRadioGroup');
    const etcInput = document.getElementById('statusEtcInput');
    const qualitativeTab = document.getElementById('qualitative');

    // 1. 기타 입력창 토글
    radioGroup.addEventListener('change', function(e) {
        if (e.target.value === 'other') {
            etcInput.style.display = 'block';
            etcInput.required = true;
        } else {
            etcInput.style.display = 'none';
            etcInput.required = false;
            etcInput.value = ''; 
        }
        checkQualitativeForm();
    });

    // 2. 유효성 검사 이벤트 연결
    qualitativeTab.addEventListener('input', checkQualitativeForm);
    qualitativeTab.addEventListener('change', checkQualitativeForm);
}

function checkQualitativeForm() {
    const saveBtn = document.getElementById('btnSaveQual');
    const qualitativeTab = document.getElementById('qualitative');
    // 필수 항목 체크 (required 속성이 있는 요소들)
    const requiredInputs = qualitativeTab.querySelectorAll('[required]');
    let allValid = true;

    requiredInputs.forEach(input => {
        if (input.type === 'radio') {
            const groupName = input.name;
            const isChecked = document.querySelector(`input[name="${groupName}"]:checked`);
            if (!isChecked) allValid = false;
        } else if (input.type === 'checkbox') {
            if (!input.checked) allValid = false;
        } else {
            // hidden 상태가 아니고 값이 비어있으면 invalid
            if (input.offsetParent !== null && !input.value.trim()) {
                allValid = false;
            }
        }
    });

    saveBtn.disabled = !allValid;
    saveBtn.innerText = allValid ? "정성 데이터 저장" : "모든 필수 항목을 입력해주세요";
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
        
        checkPaymentStatus(currentUserData.payments);

        loadExamData(); 
        updateStatusUI(currentUserData);

        // 데이터 로드 후 유효성 검사 한 번 실행
        checkQualitativeForm();

    } catch (error) {
        console.error("데이터 로드 중 오류:", error);
    }
}

function checkPaymentStatus(payments) {
    const profileBox = document.querySelector('.profile-summary');
    if (payments && payments.length > 0) {
        const hasPaid = payments.some(p => p.status === 'paid');
        if (hasPaid) {
            profileBox.classList.add('paid-member');
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
    document.getElementById('userEmailDisplay').innerText = data.email || localStorage.getItem('userEmail') || '';
    
    document.getElementById('profileName').value = data.name || '';
    document.getElementById('profilePhone').value = data.phone || '';
    document.getElementById('profileSchool').value = data.school || '';
    document.getElementById('profileEmail').value = data.email || '';
}

function fillQualitativeForm(qual) {
    if (!qual) return;
    
    // 상태
    if (qual.status) {
        // 기존 status 값이 있는지 확인
        const radio = document.querySelector(`input[name="studentStatus"][value="${qual.status}"]`);
        if (radio) {
            radio.checked = true;
        } else {
            // 값이 있는데 라디오버튼에 없으면 '기타'일 확률 높음 (또는 statusOther에 저장된 값)
            const otherRadio = document.getElementById('statusOther');
            otherRadio.checked = true;
            const etcInput = document.getElementById('statusEtcInput');
            etcInput.style.display = 'block';
            etcInput.value = qual.status; // 기타 내용 채우기
        }
    }

    // 기본 정보
    document.getElementById('targetStream').value = qual.stream || '';
    document.getElementById('careerPath').value = qual.career || '';

    // 원서 가치관
    if (qual.values) {
        document.getElementById('mustGoCollege').value = qual.values.mustGo || '';
        document.getElementById('priorityType').value = qual.values.priority || '';
        document.getElementById('appStrategy').value = qual.values.strategy || '';
        document.getElementById('worstScenario').value = qual.values.worst || '';
        document.getElementById('regionRange').value = qual.values.region || '';
        document.getElementById('crossApply').value = qual.values.cross || '';
    }

    // 대학 후보군
    if (qual.candidates) {
        document.getElementById('groupGa').value = qual.candidates.ga || '';
        document.getElementById('groupNa').value = qual.candidates.na || '';
        document.getElementById('groupDa').value = qual.candidates.da || '';
        document.getElementById('mostWanted').value = qual.candidates.most || '';
        document.getElementById('leastWanted').value = qual.candidates.least || '';
        document.getElementById('selfAssessment').value = qual.candidates.self || '';
    }

    // 희망 대학
    if (qual.targets) {
        qual.targets.forEach((val, idx) => {
            const input = document.getElementById(`target${idx+1}`);
            if(input) input.value = val;
        });
    }

    // 부모님/환경
    if (qual.parents) {
        document.getElementById('parentOpinion').value = qual.parents.opinion || '';
        document.getElementById('parentInfluence').value = qual.parents.influence || '';
    }

    // 특이사항
    if (qual.special) {
        document.getElementById('transferPlan').value = qual.special.transfer || '';
        document.getElementById('teachingCert').value = qual.special.teaching || '';
        document.getElementById('etcConsultingInfo').value = qual.special.etc || '';
    }
}

async function saveProfile() {
    const userId = localStorage.getItem('userId');
    const newPhone = document.getElementById('profilePhone').value;
    const newSchool = document.getElementById('profileSchool').value;
    const newName = document.getElementById('profileName').value;
    const newEmail = document.getElementById('profileEmail').value;
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('newPasswordConfirm').value;

    if (!newName) return alert("이름을 입력해주세요.");
    
    // 비밀번호 변경 확인
    if (newPw && newPw !== confirmPw) {
        return alert("비밀번호가 일치하지 않습니다.");
    }

    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_profile',
                userId: userId,
                data: { 
                    phone: newPhone, 
                    school: newSchool, 
                    name: newName,
                    email: newEmail // 이메일 추가 전송
                    // 비밀번호는 별도 API나 Cognito SDK로 처리해야 하지만 여기선 정보 전송만
                }
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
    
    // 상태값 처리 (기타인 경우 텍스트 입력값 사용)
    let statusVal = document.querySelector('input[name="studentStatus"]:checked')?.value;
    if (statusVal === 'other') {
        statusVal = document.getElementById('statusEtcInput').value;
    }

    const qualData = {
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
            ga: document.getElementById('groupGa').value,
            na: document.getElementById('groupNa').value,
            da: document.getElementById('groupDa').value,
            most: document.getElementById('mostWanted').value,
            least: document.getElementById('leastWanted').value,
            self: document.getElementById('selfAssessment').value,
        },
        targets: [
            document.getElementById('target1').value,
            document.getElementById('target2').value,
            document.getElementById('target3').value,
            document.getElementById('target4').value,
            document.getElementById('target5').value
        ],
        parents: {
            opinion: document.getElementById('parentOpinion').value,
            influence: document.getElementById('parentInfluence').value,
        },
        special: {
            transfer: document.getElementById('transferPlan').value,
            teaching: document.getElementById('teachingCert').value,
            etc: document.getElementById('etcConsultingInfo').value,
        }
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
    const isConfirmed = confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 성적 및 상담 데이터가 모두 삭제되며 복구할 수 없습니다.");
    if (!isConfirmed) return;

    const userId = localStorage.getItem('userId');

    try {
        // 1. DynamoDB 데이터 삭제
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'delete_user', userId: userId })
        });

        if (!response.ok) throw new Error("DB 삭제 실패");

        // 2. Cognito 계정 삭제
        const poolData = {
            UserPoolId: CONFIG.cognito.userPoolId,
            ClientId: CONFIG.cognito.clientId
        };
        const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        const cognitoUser = userPool.getCurrentUser();

        if (cognitoUser) {
            cognitoUser.getSession((err, session) => {
                if (err) return alert("세션 오류. 다시 로그인해주세요.");
                cognitoUser.deleteUser((err, result) => {
                    if (err) return alert("계정 삭제 실패: " + err.message);
                    alert("회원 탈퇴가 완료되었습니다.");
                    localStorage.clear();
                    window.location.href = 'index.html';
                });
            });
        } else {
            localStorage.clear();
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error(error);
        alert("탈퇴 처리 중 오류가 발생했습니다.");
    }
}