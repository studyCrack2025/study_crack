// js/mypage_tutor.js

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

    // 튜터 정보 로드 (프로필, 계좌 등)
    loadTutorInfo(userId);

    // 탭 상태 확인
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab === 'students') switchTab('students');
    else switchTab('info'); // 기본값

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

// 탭 전환 함수 (2개 탭만 처리)
window.switchTab = function(tabName) {
    // UI 초기화
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 버튼 활성화
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'info' && btns[0]) btns[0].classList.add('active');
    else if (tabName === 'students' && btns[1]) { 
        btns[1].classList.add('active'); 
        loadMyStudents(); // 학생 리스트 로드 트리거
    }

    // 컨텐츠 표시
    const targetContent = document.getElementById(`tab-${tabName}`);
    if(targetContent) targetContent.classList.add('active');
}

// ==========================================
// [기능 1] 튜터 정보 로드 (프로필 & 계좌)
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

        // 1. 사이드바 기본 정보
        if(document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
        if(document.getElementById('userEmailDisplay')) document.getElementById('userEmailDisplay').innerText = data.email || '';
        if(document.getElementById('currentEmailDisplay')) document.getElementById('currentEmailDisplay').innerText = data.email || '';

        // 2. 모달 Input에 기존 데이터 미리 채우기 (닉네임, 학교, 전공 등)
        if(document.getElementById('modalNickname')) document.getElementById('modalNickname').value = data.nickname || '';
        if(document.getElementById('modalSchool')) document.getElementById('modalSchool').value = data.school || '';
        if(document.getElementById('modalMajor')) document.getElementById('modalMajor').value = data.major || '';
        if(document.getElementById('modalStrengths')) document.getElementById('modalStrengths').value = data.strengths || '';
        if(document.getElementById('modalMessage')) document.getElementById('modalMessage').value = data.message || '';

        // 3. 계좌번호 (암호화되어 있거나 숨겨져 있다고 가정)
        if(document.getElementById('accountNumber')) document.getElementById('accountNumber').value = data.accountNumber || '';

        // 4. 프로필 이미지
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

// ==========================================
// [기능 2] 프로필 수정 모달 관련
// ==========================================
window.openProfileModal = function() {
    document.getElementById('profileModal').classList.remove('hidden');
}

// 프로필 상세 정보 저장 (DB 연동)
window.saveProfileModalData = async function() {
    const nickname = document.getElementById('modalNickname').value;
    const school = document.getElementById('modalSchool').value;
    const major = document.getElementById('modalMajor').value;
    const strengths = document.getElementById('modalStrengths').value;
    const message = document.getElementById('modalMessage').value;

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    try {
        const response = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_tutor_profile_detail', // 백엔드에서 이 타입 처리 필요
                userId, 
                data: { nickname, school, major, strengths, message } 
            })
        });

        if (response.ok) {
            alert("프로필 정보가 저장되었습니다.");
            closeModal('profileModal');
            // 로컬 데이터 업데이트
            tutorInfoData.nickname = nickname;
            tutorInfoData.school = school;
            tutorInfoData.major = major;
            tutorInfoData.strengths = strengths;
            tutorInfoData.message = message;
        } else {
            alert("저장에 실패했습니다.");
        }
    } catch (error) {
        console.error(error);
        alert("오류가 발생했습니다.");
    }
}

// ==========================================
// [기능 3] 계좌번호 수정 및 입금 내역
// ==========================================
window.toggleAccountEdit = async function(btn) {
    const input = document.getElementById('accountNumber');
    
    if (input.disabled) {
        // 수정 모드 진입
        input.disabled = false;
        input.type = 'text'; // 수정할 땐 보이게 (원하면 'password' 유지 가능)
        input.focus();
        btn.innerText = "저장하기";
        btn.classList.add('saving');
    } else {
        // 저장 요청
        const newAccount = input.value.trim();
        if (!newAccount) { alert("계좌번호를 입력해주세요."); return; }

        const success = await saveSingleField('accountNumber', newAccount);
        
        if (success) {
            alert("계좌 정보가 수정되었습니다.");
            input.disabled = true;
            input.type = 'password'; // 다시 가리기
            btn.innerText = "수정하기";
            btn.classList.remove('saving');
        } else {
            alert("저장 실패");
        }
    }
}

// 입금 내역 아코디언 토글
window.toggleDepositHistory = function() {
    const area = document.getElementById('depositHistoryArea');
    const icon = document.getElementById('depositIcon');
    
    if (area.classList.contains('hidden')) {
        area.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        loadDepositHistoryData(); // 열릴 때 데이터 로드
    } else {
        area.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

// 입금 내역 데이터 로드 (Mockup -> API 연동 필요)
async function loadDepositHistoryData() {
    const tbody = document.getElementById('depositListBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty-msg"><i class="fas fa-spinner fa-spin"></i> 내역 조회 중...</td></tr>';

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    try {
        // [TODO] 실제 API로 교체 필요
        // const res = await fetch(...)
        
        // 더미 데이터 예시
        setTimeout(() => {
            const dummyData = [
                { month: '2025-01', students: 3, gradeInfo: '고3(2), 고2(1)', amount: '900,000원', status: '입금완료' },
                { month: '2024-12', students: 2, gradeInfo: '고3(2)', amount: '600,000원', status: '입금완료' }
            ];

            if (dummyData.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">정산 내역이 없습니다.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            dummyData.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.month}</td>
                    <td>${item.students}명</td>
                    <td>${item.gradeInfo}</td>
                    <td style="font-weight:bold; color:#2563eb;">${item.amount}</td>
                    <td><span style="color:green;">${item.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }, 500); // 0.5초 딜레이 시뮬레이션

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">데이터 로드 실패</td></tr>';
    }
}

// 공통 필드 저장 (계좌번호 등)
async function saveSingleField(field, value) {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    try {
        const response = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_member_info', // 혹은 update_account_info 등 별도 타입
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

// ==========================================
// [기타] 프로필 사진, 학생 관리, 계정 관리 등 기존 기능 유지
// ==========================================

// [프로필 사진]
window.triggerFileUpload = function() { document.getElementById('profileFileInput').click(); }
window.handleProfileUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return; }

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    
    imgElem.style.opacity = '0.5';

    try {
        // 1. Presigned URL
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

        // 2. S3 Upload
        const s3Upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        // 3. DB Update
        const updateRes = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                userId: userId, 
                data: { profileImageUrl: fileUrl } 
            })
        });
        if (!updateRes.ok) throw new Error("업데이트 실패");

        imgElem.src = escapeHtml(fileUrl);
        alert("프로필 사진이 변경되었습니다.");
        checkDeleteButtonVisibility(fileUrl);

    } catch (e) {
        console.error(e);
        alert("오류: " + e.message);
        imgElem.src = originalSrc;
    } finally {
        imgElem.style.opacity = '1'; 
        input.value = '';
    }
}

window.handleProfileDelete = async function() {
    if (!confirm("프로필 사진을 삭제하시겠습니까?")) return;
    const imgElem = document.getElementById('profileImg');
    const currentUrl = imgElem.src;
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');

    try {
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            await fetch(TUTOR_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'delete_s3_file', data: { fileUrl: currentUrl } })
            });
        }
        await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_user_profile_image', userId: userId, data: { profileImageUrl: "" } })
        });
        imgElem.src = "https://placehold.co/150x150?text=Profile"; 
        alert("삭제되었습니다.");
        checkDeleteButtonVisibility("");
    } catch (e) { console.error(e); alert("삭제 실패"); }
}

function checkDeleteButtonVisibility(url) {
    const deleteBtn = document.getElementById('deletePicBtn');
    if (url && !url.includes('sample_profile') && !url.includes('placehold.co')) deleteBtn.classList.remove('hidden');
    else deleteBtn.classList.add('hidden');
}

// [학생 관리]
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
            body: JSON.stringify({ type: 'tutor_get_students', userId: userId, tutorName: myName })
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
window.goToStudentDetail = function(studentId) { window.location.href = `/admin/detail?uid=${studentId}`; }

// [계정 관리 및 모달 유틸]
window.handleSignOut = function() {
    if (tutorCognitoUser) tutorCognitoUser.signOut();
    localStorage.clear(); sessionStorage.clear();
    window.location.href = '/login';
}
window.closeModal = function(modalId) { document.getElementById(modalId).classList.add('hidden'); }
window.openEmailModal = function() { document.getElementById('emailModal').classList.remove('hidden'); }
window.openPasswordModal = function() { document.getElementById('passwordModal').classList.remove('hidden'); }
window.requestEmailChange = function() { 
    alert("인증번호가 전송되었습니다.");
    document.getElementById('step-email-input').classList.add('hidden');
    document.getElementById('step-email-verify').classList.remove('hidden');
    startTutorTimer(300, 'emailTimer');
}
window.verifyEmailChange = function() { alert("이메일이 변경되었습니다."); closeModal('emailModal'); }
window.changePassword = function() { alert("비밀번호가 변경되었습니다."); closeModal('passwordModal'); }

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
        if (--timer < 0) { clearInterval(tutorTimerInterval); if(display) display.textContent = "만료"; }
    }, 1000);
}

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