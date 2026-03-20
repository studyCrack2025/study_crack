// js/mypage_tutor.js

var TUTOR_API_URL = CONFIG.api.base;
const FILE_API_URL = CONFIG.api.file;
const NOTI_API_URL = CONFIG.api.noti;

let tutorInfoData = {};
let tutorCognitoUser = null; 
let tutorTimerInterval = null;

// ==========================================
// [초기화] DOM 로드 및 데이터 페치
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const idToken = localStorage.getItem('idToken'); 
    const userId = localStorage.getItem('userId');

    if (!idToken) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    // Cognito 초기화
    initTutorCognito();

    // 튜터 정보를 먼저 확실하게 로드하고 기다립니다(await).
    await loadTutorInfo(userId);
    fetchTutorNotifications();

    // 탭 상태 확인 (튜터 정보 로드 후 실행됨)
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    if (tab === 'students') {
        switchTab('students');
    } else {
        switchTab('info'); // 기본값
    }

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

// 탭 전환 함수
window.switchTab = function(tabName) {
    // UI 초기화
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // 버튼 활성화
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'info' && btns[0]) btns[0].classList.add('active');
    else if (tabName === 'students' && btns[1]) { 
        btns[1].classList.add('active'); 
        // [핵심] 여기서 loadMyStudents 호출
        loadMyStudents(); 
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
            body: JSON.stringify({ type: 'tutor_get_user', userId: userId })
        });
        
        if (!res.ok) throw new Error("Load Failed");
        
        // [수정] DocumentClient를 쓰면 이미 파싱된 JSON이 옴. 이중 파싱 방지.
        let rawData = await res.json();
        // 만약 DynamoDB JSON 포맷(.S, .N 등)이 남아있다면 파싱, 아니면 그대로 사용
        const data = (rawData.S || rawData.N || rawData.M) ? parseDynamoItem(rawData) : rawData;

        // 전역 변수에 저장 (학생 로드 시 사용됨)
        tutorInfoData = data;

        // 1. 기본 정보 렌더링
        if(document.getElementById('userNameDisplay')) document.getElementById('userNameDisplay').innerText = data.name || '이름 없음';
        if(document.getElementById('userEmailDisplay')) document.getElementById('userEmailDisplay').innerText = data.email || '';
        if(document.getElementById('currentEmailDisplay')) document.getElementById('currentEmailDisplay').innerText = data.email || '';

        // 2. 모달 Input
        if(document.getElementById('modalNickname')) document.getElementById('modalNickname').value = data.nickname || '';
        if(document.getElementById('modalSchool')) document.getElementById('modalSchool').value = data.school || '';
        if(document.getElementById('modalMajor')) document.getElementById('modalMajor').value = data.major || '';
        if(document.getElementById('modalStrengths')) document.getElementById('modalStrengths').value = data.strengths || '';
        if(document.getElementById('modalMessage')) document.getElementById('modalMessage').value = data.message || '';

        // 3. 계좌번호
        if(document.getElementById('accountNumber')) document.getElementById('accountNumber').value = data.accountNumber || '';

        // 4. 프로필 이미지
        if (data.profileImage) {
            const imgElem = document.getElementById('profileImg');
            if(imgElem) {
                imgElem.src = escapeHtml(data.profileImage);
                checkDeleteButtonVisibility(data.profileImage);
            }
        }
        return true; // 성공 리턴

    } catch (e) {
        console.error("Tutor Info Load Error:", e);
        return false; // 실패 리턴
    }
}

// ==========================================
// [기능 2] 프로필 수정 모달 관련
// ==========================================
window.openProfileModal = function() {
    document.getElementById('profileModal').classList.remove('hidden');
}

// 프로필 상세 정보 저장
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
                type: 'tutor_update_profile_detail', 
                userId, 
                data: { nickname, school, major, strengths, message } 
            })
        });

        if (response.ok) {
            alert("프로필 정보가 저장되었습니다.");
            closeModal('profileModal');
            
            // 로컬 데이터 즉시 반영
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
        alert("통신 오류가 발생했습니다.");
    }
}

// ==========================================
// [기능 3] 계좌번호 및 입금 내역
// ==========================================
window.toggleAccountEdit = async function(btn) {
    const input = document.getElementById('accountNumber');
    
    if (input.disabled) {
        input.disabled = false;
        input.type = 'text';
        input.focus();
        btn.innerText = "저장하기";
        btn.classList.add('saving');
    } else {
        const newAccount = input.value.trim();
        if (!newAccount) { alert("계좌번호를 입력해주세요."); return; }

        const success = await saveSingleField('accountNumber', newAccount);
        
        if (success) {
            alert("계좌 정보가 수정되었습니다.");
            input.disabled = true;
            input.type = 'password';
            btn.innerText = "수정하기";
            btn.classList.remove('saving');
        } else {
            alert("저장 실패");
        }
    }
}

window.toggleDepositHistory = function() {
    const area = document.getElementById('depositHistoryArea');
    const icon = document.getElementById('depositIcon');
    
    if (area.classList.contains('hidden')) {
        area.classList.remove('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-up');
        loadDepositHistoryData();
    } else {
        area.classList.add('hidden');
        icon.classList.remove('fa-chevron-up');
        icon.classList.add('fa-chevron-down');
    }
}

async function loadDepositHistoryData() {
    const tbody = document.getElementById('depositListBody');
    tbody.innerHTML = '<tr><td colspan="4" class="empty-msg"><i class="fas fa-spinner fa-spin"></i> 내역 조회 중...</td></tr>';

    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');

    try {
        const response = await fetch(TUTOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'tutor_get_payment_history', 
                userId: userId 
            })
        });

        if (!response.ok) throw new Error("Payment History Load Failed");
        
        const rawList = await response.json();
        // 마찬가지로 이중 파싱 방지
        let list = [];
        if (Array.isArray(rawList)) {
            list = rawList.map(item => (item.S || item.N || item.M) ? parseDynamoItem(item) : item);
        }

        tbody.innerHTML = '';
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">정산 내역이 없습니다.</td></tr>';
            return;
        }

        list.sort((a, b) => (b.yearMonth || '').localeCompare(a.yearMonth || ''));

        list.forEach(item => {
            const stdCount = Number(item.standardCount || 0);
            const proCount = Number(item.proCount || 0);
            const stdAmt = Number(item.standardAmount || 0).toLocaleString();
            const proAmt = Number(item.proAmount || 0).toLocaleString();
            const totalAmt = Number(item.totalAmount || 0).toLocaleString();

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${escapeHtml(item.yearMonth)}</strong></td>
                <td>
                    <div style="font-size:0.9rem;"><span style="color:#64748b;">Standard:</span> <strong>${stdCount}명</strong></div>
                    <div style="font-size:0.9rem;"><span style="color:#2563eb;">Pro:</span> <strong>${proCount}명</strong></div>
                </td>
                <td>
                    <div style="font-size:0.9rem;"><span style="color:#64748b;">Std:</span> ${stdAmt}원</div>
                    <div style="font-size:0.9rem;"><span style="color:#2563eb;">Pro:</span> ${proAmt}원</div>
                </td>
                <td>
                    <div style="font-weight:bold; color:#1e293b; font-size:1rem;">${totalAmt}원</div>
                    <div style="font-size:0.8rem; color:${item.status === '입금완료' ? 'green' : '#f59e0b'}; margin-top:4px;">
                        ${escapeHtml(item.status)}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">데이터를 불러오지 못했습니다.</td></tr>';
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
                type: 'tutor_update_member_info', 
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
// [기타] 프로필 사진, 학생 관리, 계정 관리
// ==========================================

// [프로필 사진]
window.triggerFileUpload = function(){ 
    document.getElementById('profileFileInput').click(); 
}

window.handleProfileUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return; }

    const token = localStorage.getItem('idToken');
    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    
    imgElem.style.opacity = '0.5';

    try {
        // 1. Presigned URL
        const presignRes = await fetch(FILE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'get_presigned_url',
                data: { fileName: file.name, fileType: file.type, folder: 'profile' }
            })
        });
        if (!presignRes.ok) throw new Error("업로드 URL 발급 실패");
        
        // 🚨 [수정 1] fields 추출 추가
        const { uploadUrl, fileUrl, fields } = await presignRes.json();

        // 🚨 [수정 2] FormData 생성 및 POST 방식으로 S3 업로드
        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
            formData.append(key, value);
        });
        formData.append('file', file); // 파일은 무조건 맨 마지막에 추가

        const s3Upload = await fetch(uploadUrl, { 
            method: 'POST', // PUT -> POST
            body: formData  // 헤더 없이 전송
        });
        
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        // 3. DB Update
        const updateRes = await fetch(FILE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
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

    try {
        // 1. S3 파일 삭제
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            await fetch(FILE_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    type: 'delete_s3_file', 
                    data: { fileUrl: currentUrl } 
                })
            });
        }
        
        // 2. DB 업데이트 (프로필 이미지 지우기)
        await fetch(FILE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                // userId 제거, data 객체 구조화
                data: { profileImageUrl: "" } 
            })
        });
        
        imgElem.src = "https://placehold.co/150x150?text=Profile"; 
        alert("삭제되었습니다.");
        checkDeleteButtonVisibility("");
    } catch (e) { 
        console.error(e); 
        alert("삭제 실패"); 
    }
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
    let myName = tutorInfoData.nickname || document.getElementById('userNameDisplay')?.innerText;

    if (!myName || myName === '이름 없음') {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">튜터 정보를 불러오지 못했습니다. 새로고침 해주세요.</td></tr>';
        return;
    }

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
             // 🔥 [핵심 수정] 백엔드에서 넘어온 s.tier 값을 직접 활용합니다.
             let tier = (s.tier || 'FREE').toUpperCase();
             let tierClass = 'tier-free';
             
             if (tier === 'PRO') tierClass = 'tier-pro';
             else if (tier === 'STANDARD') tierClass = 'tier-standard';
             else if (tier === 'BASIC') tierClass = 'tier-basic';

             const tr = document.createElement('tr');
             tr.innerHTML = `
                 <td><strong>${escapeHtml(s.name)}</strong></td>
                 <td>${escapeHtml(s.school || '-')}</td>
                 <td>${escapeHtml(s.phone || '-')}</td>
                 <td><span class="tier-badge ${tierClass}">${tier}</span></td>
                 <td><button class="manage-btn" onclick="goToStudentDetail('${s.userid}')">상세관리</button></td>
             `;
             tbody.appendChild(tr);
        });

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">데이터를 불러오지 못했습니다.</td></tr>';
    }
}

window.goToStudentDetail = function(studentId) { 
    window.location.href = `/admin/detail?uid=${studentId}`; 
}

// 튜터 알림(Notification) 기능
window.toggleTutorNotiPanel = function() {
    const panel = document.getElementById('tutorNotiPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        fetchTutorNotifications(); // 열 때 최신화
    }
}

window.fetchTutorNotifications = async function() {
    const token = localStorage.getItem('idToken');
    
    try {
        const response = await fetch(NOTI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'tutor_get_notifications' })
        });
        const data = await response.json();
        const notis = data.notifications || [];
        
        const unreadCount = notis.filter(n => !n.isRead).length;
        const badge = document.getElementById('tutorNotiBadge');
        if (unreadCount > 0) {
            badge.style.display = 'flex';
            badge.innerText = unreadCount;
        } else {
            badge.style.display = 'none';
        }

        const listArea = document.getElementById('tutorNotiList');
        listArea.innerHTML = '';
        if (notis.length === 0) {
            listArea.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; color: #94a3b8;">
                    <i class="far fa-bell-slash" style="font-size: 2.5rem; margin-bottom: 15px; opacity: 0.5;"></i>
                    <span style="font-size: 0.95rem;">새로운 알림이 없습니다.</span>
                </div>
            `;
            return;
        }

        notis.forEach(n => {
            const div = document.createElement('div');
            div.className = `tutor-noti-item ${n.isRead ? '' : 'unread'}`;
            div.onclick = () => { if (!n.isRead) markTutorNotiAsRead(n.id); };
            
            div.innerHTML = `
                <div class="tutor-noti-meta">
                    <span class="tutor-noti-sender">보낸사람: ${escapeHtml(n.senderName)}</span>
                    <span>${new Date(n.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="tutor-noti-msg">${escapeHtml(n.message)}</div>
            `;
            listArea.appendChild(div);
        });

    } catch (e) { console.error(e); }
}

window.markTutorNotiAsRead = async function(notiId) {
    const token = localStorage.getItem('idToken');
    try {
        await fetch(NOTI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'tutor_read_notification', data: { notiId: notiId } })
        });
        fetchTutorNotifications();
    } catch(e) {}
}

window.markAllTutorNotiRead = async function() {
    if(!confirm("모든 알림을 읽음 처리하시겠습니까?")) return;
    await markTutorNotiAsRead('all');
}

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