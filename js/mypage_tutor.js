// js/mypage_tutor.js

// [수정] const 대신 var 사용 또는 직접 참조 (재선언 방지)
var TUTOR_API_URL = CONFIG.api.base; 

// [수정] 전역 변수 이름 변경 (auth.js와 충돌 방지)
let tutorInfoData = {}; // tutorInfo -> tutorInfoData
let tutorCognitoUser = null; // cognitoUser -> tutorCognitoUser
let tutorTimerInterval = null; // emailTimerInterval -> tutorTimerInterval

// ==========================================
// [초기화] DOM 로드 및 데이터 페치
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const idToken = localStorage.getItem('idToken'); 
    const userId = localStorage.getItem('userId');

    if (!idToken) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    // Cognito 초기화
    initTutorCognito();

    // 튜터 정보 로드
    loadTutorInfo(userId);

    // 탭 상태 확인 (URL 파라미터 or 기본값)
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'students') switchTab('students');
    else if (tab === 'intro') switchTab('intro');
    else switchTab('info');

    // 모달 외부 클릭 닫기 이벤트
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.add('hidden');
        }
    }
});

// Cognito 유저 초기화
function initTutorCognito() {
    const poolData = { 
        UserPoolId: CONFIG.cognito.userPoolId, 
        ClientId: CONFIG.cognito.clientId 
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const username = localStorage.getItem('username') || localStorage.getItem('email'); 

    if (username) {
        tutorCognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: userPool
        });
    }
}

// 탭 전환 함수 (전역 스코프 보장)
window.switchTab = function(tabName) {
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // 모든 탭 컨텐츠 숨김
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 선택된 탭 활성화
    const btns = document.querySelectorAll('.tab-btn');
    // 순서: 0(info), 1(intro), 2(students)
    if (tabName === 'info' && btns[0]) btns[0].classList.add('active');
    else if (tabName === 'intro' && btns[1]) { 
        btns[1].classList.add('active'); 
        loadMyColumns(); 
    }
    else if (tabName === 'students' && btns[2]) { 
        btns[2].classList.add('active'); 
        loadMyStudents(); 
    }

    const targetContent = document.getElementById(`tab-${tabName}`);
    if(targetContent) targetContent.classList.add('active');
}

// ==========================================
// [기능 1] 튜터 정보 로드 및 프로필 관리
// ==========================================
async function loadTutorInfo(userId) {
    const token = localStorage.getItem('idToken');
    try {
        const res = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        
        if (!res.ok) throw new Error("Load Failed");
        
        // DynamoDB 포맷 파싱
        const rawData = await res.json();
        const data = parseDynamoItem(rawData);
        tutorInfoData = data;

        // 사이드바 렌더링
        if(document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
        if(document.getElementById('userEmailDisplay')) document.getElementById('userEmailDisplay').innerText = data.email || '';
        
        // 내 정보 탭 렌더링
        if(document.getElementById('profileName')) document.getElementById('profileName').value = data.name || '';
        if(document.getElementById('profilePhone')) document.getElementById('profilePhone').value = data.phone || '';
        if(document.getElementById('profileSchool')) document.getElementById('profileSchool').value = data.school || ''; 
        if(document.getElementById('currentEmailDisplay')) document.getElementById('currentEmailDisplay').innerText = data.email || '';

        // 소개글 렌더링
        if (data.bio && document.getElementById('tutorBio')) document.getElementById('tutorBio').value = data.bio;

        // 프로필 이미지
        if (data.profileImage) {
            const imgElem = document.getElementById('profileImg');
            if(imgElem) {
                imgElem.src = escapeHtml(data.profileImage);
                checkDeleteButtonVisibility(data.profileImage);
            }
        }

    } catch (e) {
        console.error(e);
        if(e.message.includes("401")) window.location.href='/login';
    }
}

// 정보 수정 (개별 필드)
window.toggleEdit = async function(fieldId, btn) {
    const input = document.getElementById(fieldId);
    
    // 1. 수정 모드로 전환
    if (input.disabled) {
        input.disabled = false;
        input.focus();
        btn.innerText = "저장하기";
        btn.classList.add('saving');
    } 
    // 2. 저장 수행
    else {
        const newValue = input.value.trim();
        if (!newValue) { alert("내용을 입력해주세요."); return; }

        let dbField = '';
        if (fieldId === 'profileName') dbField = 'name';
        else if (fieldId === 'profilePhone') dbField = 'phone';
        else if (fieldId === 'profileSchool') dbField = 'school';

        const success = await saveSingleField(dbField, newValue);
        
        if (success) {
            alert("수정되었습니다.");
            input.disabled = true;
            btn.innerText = "수정하기";
            btn.classList.remove('saving');
            
            if (dbField === 'name') {
                document.getElementById('userNameDisplay').innerText = newValue;
            }
        }
    }
}

async function saveSingleField(field, value) {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    try {
        const response = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_member_info', 
                userId, 
                data: { [field]: value } 
            })
        });
        return response.ok;
    } catch (error) {
        console.error(error);
        return false;
    }
}

// 자기소개(Bio) 저장
window.saveTutorBio = async function() {
    const bio = document.getElementById('tutorBio').value;
    const success = await saveSingleField('bio', bio); 
    if(success) alert("소개가 저장되었습니다.");
    else alert("저장 실패");
}

// ==========================================
// [기능 2] 칼럼 관리
// ==========================================
window.openColumnModal = function() { 
    document.getElementById('columnModal').classList.remove('hidden'); 
}

window.loadMyColumns = async function() {
    const list = document.getElementById('myColumnList');
    list.innerHTML = '<div class="empty-msg">작성된 칼럼이 없습니다.</div>';
}

window.submitColumn = async function() {
    const title = document.getElementById('colTitle').value;
    const content = document.getElementById('colContent').value;
    if(!title || !content) { alert("제목과 내용을 입력해주세요."); return; }
    
    alert("칼럼이 등록되었습니다. (DB 연결 필요)");
    closeModal('columnModal');
}

// ==========================================
// [기능 3] 학생 관리
// ==========================================
window.loadMyStudents = async function() {
    const tbody = document.getElementById('myStudentListBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg"><i class="fas fa-spinner fa-spin"></i> 데이터 로딩 중...</td></tr>';

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    const myName = tutorInfoData.name || 'Tutor';

    try {
        const response = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'tutor_get_students', 
                userId: userId,
                tutorName: myName 
            })
        });

        const students = []; // 데이터 연결 전 임시 빈 배열

        tbody.innerHTML = '';
        if (!students || students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">배정된 학생이 없습니다.</td></tr>';
            return;
        }

        students.forEach(s => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(s.name)}</strong></td>
                <td>${escapeHtml(s.school || '-')}</td>
                <td>${escapeHtml(s.phone || '-')}</td>
                <td>${s.lastLogin ? new Date(s.lastLogin).toLocaleDateString() : '-'}</td>
                <td><button class="manage-btn" onclick="alert('준비중')">상세관리</button></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">데이터 로드 실패</td></tr>';
    }
}

// ==========================================
// [기능 4] 공통 기능 (이미지, 계정)
// ==========================================
window.triggerFileUpload = function() { document.getElementById('profileFileInput').click(); }

window.handleProfileUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    alert("기능 연결 필요 (S3 업로드)");
}

window.handleProfileDelete = function() {
    if(!confirm("삭제하시겠습니까?")) return;
    alert("삭제되었습니다.");
}

function checkDeleteButtonVisibility(url) {
    const deleteBtn = document.getElementById('deletePicBtn');
    if (url && !url.includes('sample_profile') && !url.includes('placehold.co')) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
}

window.handleDeleteAccount = function() {
    if(!confirm("탈퇴하시겠습니까?")) return;
    alert("관리자에게 문의해주세요.");
}

window.handleSignOut = function() {
    if (tutorCognitoUser) tutorCognitoUser.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
}

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// 이메일 변경 모달
window.openEmailModal = function() { document.getElementById('emailModal').classList.remove('hidden'); }
window.requestEmailChange = function() { 
    alert("인증번호가 전송되었습니다.");
    document.getElementById('step-email-input').classList.add('hidden');
    document.getElementById('step-email-verify').classList.remove('hidden');
    startTutorTimer(300, 'emailTimer'); // 타이머 시작
}
window.verifyEmailChange = function() { alert("이메일이 변경되었습니다."); closeModal('emailModal'); }

// 비밀번호 변경 모달
window.openPasswordModal = function() { document.getElementById('passwordModal').classList.remove('hidden'); }
window.changePassword = function() { alert("비밀번호가 변경되었습니다."); closeModal('passwordModal'); }

// 타이머 함수 (충돌 방지용 이름 변경)
function startTutorTimer(duration, displayId) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById(displayId);
    
    if(tutorTimerInterval) clearInterval(tutorTimerInterval);
    
    tutorTimerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        if(display) display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(tutorTimerInterval);
            if(display) display.textContent = "만료";
        }
    }, 1000);
}

// 유틸리티
function escapeHtml(text) {
    if (text == null) return "";
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseDynamoItem(item) {
    if (item === undefined || item === null) return null;
    if (typeof item !== 'object') return item;
    if (item.S !== undefined) return item.S;
    if (item.N !== undefined) return Number(item.N);
    return item; 
}