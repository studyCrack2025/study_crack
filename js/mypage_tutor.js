// js/mypage_tutor.js

const MYPAGE_API_URL = CONFIG.api.base; 
let tutorInfo = {};
let cognitoUser = null; // Cognito 유저 객체 전역 관리
let emailTimerInterval = null;

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
    initCognitoUser();

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

// Cognito 유저 초기화 (mypage.js 로직 동일)
function initCognitoUser() {
    const poolData = { 
        UserPoolId: CONFIG.cognito.userPoolId, 
        ClientId: CONFIG.cognito.clientId 
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const username = localStorage.getItem('username') || localStorage.getItem('email'); 

    if (username) {
        cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: username,
            Pool: userPool
        });
    }
}

// 탭 전환 함수
function switchTab(tabName) {
    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    // 모든 탭 컨텐츠 숨김
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 선택된 탭 활성화
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'info') btns[0].classList.add('active');
    else if (tabName === 'intro') { 
        btns[1].classList.add('active'); 
        loadMyColumns(); // 칼럼 로드
    }
    else if (tabName === 'students') { 
        btns[2].classList.add('active'); 
        loadMyStudents(); // 학생 로드
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
        const res = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        
        if (!res.ok) throw new Error("Load Failed");
        
        // DynamoDB 포맷 파싱 (mypage.js에 있던 함수 내장)
        const rawData = await res.json();
        const data = parseDynamoItem(rawData);
        tutorInfo = data;

        // 사이드바 렌더링
        document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
        document.getElementById('userEmailDisplay').innerText = data.email || '';
        
        // 내 정보 탭 렌더링
        document.getElementById('profileName').value = data.name || '';
        document.getElementById('profilePhone').value = data.phone || '';
        document.getElementById('profileSchool').value = data.school || ''; // 소속/학교
        document.getElementById('currentEmailDisplay').innerText = data.email || '';

        // 소개글 렌더링
        if (data.bio) document.getElementById('tutorBio').value = data.bio;

        // 프로필 이미지
        if (data.profileImage) {
            const imgElem = document.getElementById('profileImg');
            imgElem.src = escapeHtml(data.profileImage);
            checkDeleteButtonVisibility(data.profileImage);
        }

    } catch (e) {
        console.error(e);
        if(e.message.includes("401")) location.href='/login';
    }
}

// 정보 수정 (개별 필드)
async function toggleEdit(fieldId, btn) {
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
        const response = await fetch(MYPAGE_API_URL, {
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
async function saveTutorBio() {
    const bio = document.getElementById('tutorBio').value;
    const success = await saveSingleField('bio', bio); // DB에 bio 컬럼 사용 가정
    if(success) alert("소개가 저장되었습니다.");
    else alert("저장 실패");
}

// ==========================================
// [기능 2] 칼럼 관리 (수정됨)
// ==========================================
// 모달 열기
function openColumnModal() { 
    document.getElementById('columnModal').classList.remove('hidden'); 
}

async function loadMyColumns() {
    const list = document.getElementById('myColumnList');
    // TODO: 백엔드 API 연결 (type: 'get_tutor_columns')
    // 현재는 더미 데이터 처리
    list.innerHTML = '<div class="empty-msg">작성된 칼럼이 없습니다.</div>';
}

async function submitColumn() {
    const title = document.getElementById('colTitle').value;
    const content = document.getElementById('colContent').value;
    if(!title || !content) { alert("제목과 내용을 입력해주세요."); return; }
    
    // TODO: 백엔드 API 전송 logic
    alert("칼럼이 등록되었습니다. (DB 연결 필요)");
    closeModal('columnModal');
}

// ==========================================
// [기능 3] 학생 관리
// ==========================================
async function loadMyStudents() {
    const tbody = document.getElementById('myStudentListBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg"><i class="fas fa-spinner fa-spin"></i> 데이터 로딩 중...</td></tr>';

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    const myName = tutorInfo.name || 'Tutor';

    try {
        // [API 호출] 담당 학생 리스트 가져오기
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'tutor_get_students', // 백엔드 구현 필요
                userId: userId,
                tutorName: myName 
            })
        });

        // if (!response.ok) throw new Error("Load Failed");
        // const students = await response.json();
        
        // [임시] 데이터가 없거나 에러 시 빈 화면 처리 (백엔드 미구현 대비)
        const students = []; 

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
// [기능 4] 프로필 사진, 계정 변경 등 (공통 기능)
// ==========================================
// mypage.js의 로직들을 그대로 사용 (triggerFileUpload, handleProfileUpload, openEmailModal 등)
// 중복을 피하기 위해 핵심 로직만 아래에 포함 (위 HTML에서는 mypage_tutor.js 하나만 로드하므로)

function triggerFileUpload() { document.getElementById('profileFileInput').click(); }

async function handleProfileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    /* (S3 업로드 로직 생략 - mypage.js와 동일하게 구현하면 됨) */
    alert("기능 연결 필요 (mypage.js 참조)");
}

function handleProfileDelete() {
    if(!confirm("삭제하시겠습니까?")) return;
    // ...
}

function checkDeleteButtonVisibility(url) {
    const deleteBtn = document.getElementById('deletePicBtn');
    if (url && !url.includes('sample_profile') && !url.includes('placehold.co')) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
}

function handleDeleteAccount() {
    if(!confirm("탈퇴하시겠습니까?")) return;
    alert("관리자에게 문의해주세요.");
}

function handleSignOut() {
    if (cognitoUser) cognitoUser.signOut();
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/login';
}

// 모달 닫기
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// 이메일/비밀번호 변경 함수들 (mypage.js에서 복사 필요)
function openEmailModal() { document.getElementById('emailModal').classList.remove('hidden'); }
function openPasswordModal() { document.getElementById('passwordModal').classList.remove('hidden'); }
function requestEmailChange() { alert("이메일 변경 로직 구현 필요"); }
function verifyEmailChange() { alert("인증 로직 구현 필요"); }
function changePassword() { alert("비밀번호 변경 로직 구현 필요"); }

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
    // ... (나머지 파싱 로직)
    return item; // 임시 반환
}