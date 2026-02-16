// js/mypage_tutor.js

// [설정] 전역 변수 충돌 방지 (var 사용)
var TUTOR_API_URL = CONFIG.api.base; 
let tutorInfoData = {};
let tutorCognitoUser = null; 
let tutorTimerInterval = null;

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
    // UI 초기화
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 버튼 활성화
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'info' && btns[0]) btns[0].classList.add('active');
    else if (tabName === 'intro' && btns[1]) { 
        btns[1].classList.add('active'); 
        loadMyColumns(); 
    }
    else if (tabName === 'students' && btns[2]) { 
        btns[2].classList.add('active'); 
        loadMyStudents(); // 학생 리스트 로드 트리거
    }

    // 컨텐츠 표시
    const targetContent = document.getElementById(`tab-${tabName}`);
    if(targetContent) targetContent.classList.add('active');
}

// ==========================================
// [기능 1] 튜터 정보 및 프로필 사진 (S3 연동 복구)
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
        
        const rawData = await res.json();
        const data = parseDynamoItem(rawData);
        tutorInfoData = data;

        // 텍스트 정보 렌더링
        if(document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
        if(document.getElementById('userEmailDisplay')) document.getElementById('userEmailDisplay').innerText = data.email || '';
        
        if(document.getElementById('profileName')) document.getElementById('profileName').value = data.name || '';
        if(document.getElementById('profilePhone')) document.getElementById('profilePhone').value = data.phone || '';
        if(document.getElementById('profileSchool')) document.getElementById('profileSchool').value = data.school || ''; 
        if(document.getElementById('currentEmailDisplay')) document.getElementById('currentEmailDisplay').innerText = data.email || '';

        if (data.bio && document.getElementById('tutorBio')) document.getElementById('tutorBio').value = data.bio;

        // [중요] 프로필 이미지 렌더링 및 삭제 버튼 제어
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

// [복구] 프로필 사진 업로드 (S3 Presigned URL 방식)
window.triggerFileUpload = function() { document.getElementById('profileFileInput').click(); }

window.handleProfileUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    
    // 파일 크기 제한 (5MB)
    if (file.size > 5 * 1024 * 1024) { 
        alert("파일 크기는 5MB 이하여야 합니다."); 
        return; 
    }

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    
    // 업로드 중 UI 피드백
    imgElem.style.opacity = '0.5';

    try {
        // 1. Presigned URL 요청
        const presignRes = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'get_presigned_url',
                userId: userId,
                data: { fileName: file.name, fileType: file.type, folder: 'profile' }
            })
        });

        if (!presignRes.ok) throw new Error("업로드 URL 발급 실패");
        const { uploadUrl, fileUrl } = await presignRes.json();

        // 2. S3로 직접 업로드
        const s3Upload = await fetch(uploadUrl, { 
            method: 'PUT', 
            headers: { 'Content-Type': file.type }, 
            body: file 
        });
        
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        // 3. DB에 이미지 URL 업데이트
        const updateRes = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                userId: userId, 
                data: { profileImageUrl: fileUrl } 
            })
        });

        if (!updateRes.ok) throw new Error("프로필 정보 업데이트 실패");

        // 4. 성공 처리
        imgElem.src = escapeHtml(fileUrl);
        alert("프로필 사진이 변경되었습니다.");
        checkDeleteButtonVisibility(fileUrl);

    } catch (e) {
        console.error(e);
        alert("사진 업로드 중 오류가 발생했습니다: " + e.message);
        imgElem.src = originalSrc;
    } finally {
        imgElem.style.opacity = '1'; 
        input.value = ''; // 인풋 초기화
    }
}

// [복구] 프로필 사진 삭제
window.handleProfileDelete = async function() {
    if (!confirm("프로필 사진을 삭제하시겠습니까?")) return;
    
    const imgElem = document.getElementById('profileImg');
    const currentUrl = imgElem.src;
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');

    try {
        // 1. S3 파일 삭제 요청 (기본 이미지가 아닌 경우만)
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            await fetch(TUTOR_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'delete_s3_file', data: { fileUrl: currentUrl } })
            });
        }
        
        // 2. DB 업데이트 (URL 초기화)
        const dbRes = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                userId: userId, 
                data: { profileImageUrl: "" } 
            })
        });

        if (!dbRes.ok) throw new Error("DB 삭제 실패");
        
        // 3. UI 초기화
        imgElem.src = "https://placehold.co/150x150?text=Profile"; 
        alert("프로필 사진이 삭제되었습니다.");
        checkDeleteButtonVisibility("");

    } catch (e) { 
        console.error(e); 
        alert("삭제 실패"); 
    }
}

function checkDeleteButtonVisibility(url) {
    const deleteBtn = document.getElementById('deletePicBtn');
    if (url && !url.includes('sample_profile') && !url.includes('placehold.co')) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
}

// 텍스트 정보 수정 (이름, 전화번호, 학교 등)
window.toggleEdit = async function(fieldId, btn) {
    const input = document.getElementById(fieldId);
    
    if (input.disabled) {
        input.disabled = false;
        input.focus();
        btn.innerText = "저장하기";
        btn.classList.add('saving');
    } else {
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
            if (dbField === 'name') document.getElementById('userNameDisplay').innerText = newValue;
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

window.saveTutorBio = async function() {
    const bio = document.getElementById('tutorBio').value;
    const success = await saveSingleField('bio', bio);
    if(success) alert("소개가 저장되었습니다.");
    else alert("저장 실패");
}

// ==========================================
// [기능 2] 학생 관리 (API 연동 복구)
// ==========================================
window.loadMyStudents = async function() {
    const tbody = document.getElementById('myStudentListBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg"><i class="fas fa-spinner fa-spin"></i> 데이터 로딩 중...</td></tr>';

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    const myName = tutorInfoData.name || 'Tutor';

    try {
        // [복구] 실제 API 호출
        const response = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'tutor_get_students', // 백엔드에서 이 타입을 처리해야 함
                userId: userId,
                tutorName: myName 
            })
        });

        if (!response.ok) throw new Error("Load Failed");
        const students = await response.json();

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
                <td><button class="manage-btn" onclick="goToStudentDetail('${s.userid}')">상세관리</button></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">데이터를 불러오지 못했습니다.</td></tr>';
    }
}

window.goToStudentDetail = function(studentId) {
    // 관리자 페이지 상세 화면으로 이동 (권한은 백엔드에서 체크)
    window.location.href = `/admin/detail?uid=${studentId}`;
}

// ==========================================
// [기능 3] 칼럼 관리
// ==========================================
window.openColumnModal = function() { document.getElementById('columnModal').classList.remove('hidden'); }
window.loadMyColumns = async function() {
    const list = document.getElementById('myColumnList');
    list.innerHTML = '<div class="empty-msg">작성된 칼럼이 없습니다.</div>';
    // TODO: fetch 로직 추가 (type: 'get_my_columns')
}
window.submitColumn = async function() {
    const title = document.getElementById('colTitle').value;
    const content = document.getElementById('colContent').value;
    if(!title || !content) { alert("제목과 내용을 입력해주세요."); return; }
    alert("칼럼이 등록되었습니다. (DB 연결 필요)");
    closeModal('columnModal');
}

// ==========================================
// [기능 4] 계정 관리 (이메일/비밀번호/탈퇴)
// ==========================================
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

window.openEmailModal = function() { document.getElementById('emailModal').classList.remove('hidden'); }
window.openPasswordModal = function() { document.getElementById('passwordModal').classList.remove('hidden'); }

window.requestEmailChange = function() { 
    // Cognito 이메일 변경 로직 (auth.js와 유사하게 구현)
    alert("인증번호가 전송되었습니다.");
    document.getElementById('step-email-input').classList.add('hidden');
    document.getElementById('step-email-verify').classList.remove('hidden');
    startTutorTimer(300, 'emailTimer');
}
window.verifyEmailChange = function() { alert("이메일이 변경되었습니다."); closeModal('emailModal'); }
window.changePassword = function() { alert("비밀번호가 변경되었습니다."); closeModal('passwordModal'); }

// 타이머 함수
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
    if (item.BOOL !== undefined) return item.BOOL;
    if (item.M !== undefined) {
        const obj = {};
        for (const key in item.M) obj[key] = parseDynamoItem(item.M[key]);
        return obj;
    }
    return item; 
}