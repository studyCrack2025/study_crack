// js/mypage_tutor.js

const TUTOR_API_URL = CONFIG.api.admin;
const FILE_API_URL = CONFIG.api.file;
const NOTI_API_URL = CONFIG.api.noti;

let tutorInfoData = {};
let tutorCognitoUser = null; 
let tutorTimerInterval = null;

// 💡 공통 apiFetch 함수
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...options.headers };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                handleSignOut(); // 하단에 정의된 로그아웃 및 스토리지 클리어 함수 호출
                return Promise.reject(new Error("Auth expired")); 
            }
            throw new Error(`HTTP Error: ${response.status}`);
        }
        return response;
    } catch (error) {
        console.error("API 통신 실패:", error);
        throw error; 
    }
}

// ==========================================
// [초기화] DOM 로드 및 데이터 페치
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    const accessToken = localStorage.getItem('accessToken'); 
    const userId = localStorage.getItem('userId');

    if (!accessToken) {
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
    
    // 1. 현재 캐시된 유저를 먼저 가져옵니다.
    tutorCognitoUser = userPool.getCurrentUser();
    
    // 2. 만약 못 가져왔다면 localStorage에 저장된 userEmail을 사용해 수동 생성합니다.
    if (!tutorCognitoUser) {
        const userEmail = localStorage.getItem('userEmail'); 
        if (userEmail) {
            tutorCognitoUser = new AmazonCognitoIdentity.CognitoUser({
                Username: userEmail,
                Pool: userPool
            });
        }
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
    try {
        const res = await apiFetch(TUTOR_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'tutor_get_user', userId: userId })
        });
        
        let rawData = await res.json();
        const data = (rawData.S || rawData.N || rawData.M) ? parseDynamoItem(rawData) : rawData;

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
        
        // 4. 최대 학생 및 시간 설정
        if(document.getElementById('profileMaxStudents')) document.getElementById('profileMaxStudents').value = data.maxStudents || '';
        if(document.getElementById('profileMaxHours')) document.getElementById('profileMaxHours').value = data.maxHours || '';
        tutorInfoData.withdrawalStatus = data.withdrawalStatus || 'none';

        // 4. 프로필 이미지
        if (data.profileImage) {
            const imgElem = document.getElementById('profileImg');
            if(imgElem) {
                imgElem.src = escapeHtml(data.profileImage);
                checkDeleteButtonVisibility(data.profileImage);
            }
        }
        return true; 

    } catch (e) {
        if (e.message !== "Auth expired") console.error("Tutor Info Load Error:", e);
        return false; 
    }
}

// ==========================================
// [기능 2] 프로필 수정 모달 관련
// ==========================================
window.openProfileModal = function() {
    document.getElementById('profileModal').classList.remove('hidden');
}

window.saveProfileModalData = async function() {
    const nickname = document.getElementById('modalNickname').value;
    const school = document.getElementById('modalSchool').value;
    const major = document.getElementById('modalMajor').value;
    const strengths = document.getElementById('modalStrengths').value;
    const message = document.getElementById('modalMessage').value;

    const userId = localStorage.getItem('userId');

    try {
        await apiFetch(TUTOR_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'tutor_update_profile_detail', 
                userId, 
                data: { nickname, school, major, strengths, message } 
            })
        });

        alert("프로필 정보가 저장되었습니다.");
        closeModal('profileModal');
        
        tutorInfoData.nickname = nickname;
        tutorInfoData.school = school;
        tutorInfoData.major = major;
        tutorInfoData.strengths = strengths;
        tutorInfoData.message = message;
        
    } catch (error) {
        if (error.message !== "Auth expired") alert("저장에 실패했습니다.");
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

    try {
        const response = await apiFetch(TUTOR_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'tutor_get_payment_history', 
                userId: userId 
            })
        });
        
        const rawList = await response.json();
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
    <td data-label="정산 월"><strong>${escapeHtml(item.yearMonth)}</strong></td>
    <td data-label="유료 등급별 학생 수">
        <div style="font-size:0.9rem;"><span style="color:#64748b;">Standard:</span> <strong>${stdCount}명</strong></div>
        <div style="font-size:0.9rem;"><span style="color:#2563eb;">Pro:</span> <strong>${proCount}명</strong></div>
    </td>
    <td data-label="등급별 정산 금액">
        <div style="font-size:0.9rem;"><span style="color:#64748b;">Std:</span> ${stdAmt}원</div>
        <div style="font-size:0.9rem;"><span style="color:#2563eb;">Pro:</span> ${proAmt}원</div>
    </td>
    <td data-label="총 지급액 / 상태">
        <div style="font-weight:bold; color:#1e293b; font-size:1rem;">${totalAmt}원</div>
        <div style="font-size:0.8rem; color:${item.status === '입금완료' ? 'green' : '#f59e0b'}; margin-top:4px;">
            ${escapeHtml(item.status)}
        </div>
    </td>
`;
            tbody.appendChild(tr);
        });

    } catch (e) {
        if (e.message !== "Auth expired") tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">데이터를 불러오지 못했습니다.</td></tr>';
    }
}

async function saveSingleField(field, value) {
    const userId = localStorage.getItem('userId');
    try {
        await apiFetch(TUTOR_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'tutor_update_member_info', 
                userId, 
                data: { [field]: value } 
            })
        });
        return true;
    } catch (error) {
        if (error.message !== "Auth expired") console.error(error);
        return false;
    }
}

// ==========================================
// [기타] 프로필 사진, 학생 관리, 계정 관리
// ==========================================

window.triggerFileUpload = function(){ 
    document.getElementById('profileFileInput').click(); 
}

window.handleProfileUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return; }

    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    
    imgElem.style.opacity = '0.5';

    try {
        // 1. Presigned URL (apiFetch 사용)
        const presignRes = await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'get_presigned_url',
                data: { fileName: file.name, fileType: file.type, folder: 'profile' }
            })
        });
        
        const { uploadUrl, fileUrl, fields } = await presignRes.json();

        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => {
            formData.append(key, value);
        });
        formData.append('file', file);

        // 💡 2. S3 실제 업로드 (apiFetch 절대 사용 금지! 순수 fetch 유지)
        const s3Upload = await fetch(uploadUrl, { 
            method: 'POST', 
            body: formData  
        });
        
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        // 3. DB Update (apiFetch 사용)
        await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                data: { profileImageUrl: fileUrl } 
            })
        });

        imgElem.src = escapeHtml(fileUrl);
        alert("프로필 사진이 변경되었습니다.");
        checkDeleteButtonVisibility(fileUrl);

    } catch (e) {
        if (e.message !== "Auth expired") alert("오류: " + e.message);
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

    try {
        // 1. S3 파일 삭제
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            await apiFetch(FILE_API_URL, {
                method: 'POST',
                body: JSON.stringify({ 
                    type: 'delete_s3_file', 
                    data: { fileUrl: currentUrl } 
                })
            });
        }
        
        // 2. DB 업데이트
        await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                data: { profileImageUrl: "" } 
            })
        });
        
        imgElem.src = "https://placehold.co/150x150?text=Profile"; 
        alert("삭제되었습니다.");
        checkDeleteButtonVisibility("");
    } catch (e) { 
        if (e.message !== "Auth expired") alert("삭제 실패"); 
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
    let myName = tutorInfoData.nickname || document.getElementById('userNameDisplay')?.innerText;

    if (!myName || myName === '이름 없음') {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">튜터 정보를 불러오지 못했습니다. 새로고침 해주세요.</td></tr>';
        return;
    }

    try {
        const response = await apiFetch(TUTOR_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'tutor_get_students', userId: userId, tutorName: myName })
        });
        
        const students = await response.json();

        tbody.innerHTML = '';
        if (!students || students.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">배정된 학생이 없습니다.</td></tr>';
            return;
        }
        
        students.forEach(s => {
             let tier = (s.tier || 'FREE').toUpperCase();
             let tierClass = 'tier-free';
             
             if (tier === 'PRO') tierClass = 'tier-pro';
             else if (tier === 'STANDARD') tierClass = 'tier-standard';
             else if (tier === 'BASIC') tierClass = 'tier-basic';

             const tr = document.createElement('tr');
             tr.innerHTML = `
    <td data-label="이름"><strong>${escapeHtml(s.name)}</strong></td>
    <td data-label="학교">${escapeHtml(s.school || '-')}</td>
    <td data-label="연락처">${escapeHtml(s.phone || '-')}</td>
    <td data-label="유료 등급"><span class="tier-badge ${tierClass}">${tier}</span></td>
    <td data-label="관리"><button class="manage-btn" onclick="goToStudentDetail('${s.userid}')">상세관리</button></td>
`;
             tbody.appendChild(tr);
        });

    } catch (e) {
        if (e.message !== "Auth expired") tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">데이터를 불러오지 못했습니다.</td></tr>';
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
        fetchTutorNotifications(); 
    }
}

window.fetchTutorNotifications = async function() {
    try {
        const response = await apiFetch(NOTI_API_URL, {
            method: 'POST',
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

    } catch (e) { 
        if (e.message !== "Auth expired") console.error(e); 
    }
}

window.markTutorNotiAsRead = async function(notiId) {
    try {
        await apiFetch(NOTI_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'tutor_read_notification', data: { notiId: notiId } })
        });
        fetchTutorNotifications();
    } catch(e) {}
}

window.markAllTutorNotiRead = async function() {
    if(!confirm("모든 알림을 읽음 처리하시겠습니까?")) return;
    await markTutorNotiAsRead('all');
}

// ==========================================
// [기능 7] 사이드바 활동 정보 관리
// ==========================================
window.toggleEditMaxStudents = async function(btn) {
    const input = document.getElementById('profileMaxStudents');
    if (input.disabled) {
        input.disabled = false;
        input.focus();
        btn.innerText = "저장";
        btn.classList.add('saving');
    } else {
        const newValue = parseInt(input.value);
        if (!newValue || newValue < 1 || newValue > 15) {
            alert("최대 희망 학생 수는 1~15명 사이로 입력해주세요.");
            return;
        }
        
        const success = await saveSingleField('maxStudents', newValue);
        if (success) {
            alert("최대 희망 학생 수가 수정되었습니다.");
            input.disabled = true;
            btn.innerText = "수정";
            btn.classList.remove('saving');
            tutorInfoData.maxStudents = newValue;
        } else {
            alert("수정에 실패했습니다. 다시 시도해주세요.");
        }
    }
};

window.toggleEditMaxHours = async function(btn) {
    const input = document.getElementById('profileMaxHours');
    if (input.disabled) {
        input.disabled = false;
        input.focus();
        btn.innerText = "저장";
        btn.classList.add('saving');
    } else {
        const newValue = parseInt(input.value);
        if (!newValue || newValue < 1) {
            alert("주 최대 근무가능 시간은 1시간 이상으로 입력해주세요.");
            return;
        }
        
        const success = await saveSingleField('maxHours', newValue);
        if (success) {
            alert("주 최대 근무가능 시간이 수정되었습니다.");
            input.disabled = true;
            btn.innerText = "수정";
            btn.classList.remove('saving');
            tutorInfoData.maxHours = newValue;
        } else {
            alert("수정에 실패했습니다. 다시 시도해주세요.");
        }
    }
};


// ==========================================
// [기능 8] 튜터 파트너십 해지 (2단계 회원 탈퇴)
// ==========================================
window.openTutorWithdrawalModal = function() {
    if(document.getElementById('withdrawalReqPassword')) document.getElementById('withdrawalReqPassword').value = '';
    if(document.getElementById('withdrawalFinalPassword')) document.getElementById('withdrawalFinalPassword').value = '';
    if(document.getElementById('withdrawalReason')) document.getElementById('withdrawalReason').value = '';

    const reqForm = document.getElementById('withdrawalRequestForm');
    const pendingForm = document.getElementById('withdrawalPendingForm');
    const finalForm = document.getElementById('withdrawalFinalForm');

    if (tutorInfoData.withdrawalStatus === 'approved') {
        reqForm.classList.add('hidden');
        pendingForm.classList.add('hidden');
        finalForm.classList.remove('hidden'); 
    } else if (tutorInfoData.withdrawalStatus === 'pending') {
        reqForm.classList.add('hidden');
        pendingForm.classList.remove('hidden'); 
        finalForm.classList.add('hidden');
    } else {
        reqForm.classList.remove('hidden'); 
        pendingForm.classList.add('hidden');
        finalForm.classList.add('hidden');
    }
    
    document.getElementById('tutorWithdrawalModal').classList.remove('hidden');
};

window.requestTutorWithdrawal = function() {
    const password = document.getElementById('withdrawalReqPassword').value;
    const reason = document.getElementById('withdrawalReason').value.trim();

    if (!password || !reason) {
        alert("비밀번호와 사유를 모두 입력해주세요.");
        return;
    }
    
    if (!tutorCognitoUser) {
        alert("세션이 만료되었습니다. 다시 로그인해주세요.");
        handleSignOut();
        return;
    }

    const btn = document.querySelector('#withdrawalRequestForm .danger-btn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 요청 중...`;
    btn.disabled = true;

    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: tutorCognitoUser.getUsername(),
        Password: password
    });

    tutorCognitoUser.authenticateUser(authDetails, {
        onSuccess: async function(result) {
            try {
                await saveSingleField('withdrawalStatus', 'pending');
                tutorInfoData.withdrawalStatus = 'pending';

                await apiFetch(NOTI_API_URL, {
                    method: 'POST',
                    body: JSON.stringify({ 
                        type: 'tutor_request_withdrawal',
                        data: { reason: reason, tutorName: tutorInfoData.name } 
                    })
                });
                
                alert("관리자에게 튜터 파트너십 해지 요청이 전송되었습니다.\n정산 및 인수인계 확인 후 승인 알림이 발송됩니다.");
                closeModal('tutorWithdrawalModal');

            } catch (e) {
                if (e.message !== "Auth expired") alert("요청 중 오류가 발생했습니다.");
            } finally {
                btn.innerText = "탈퇴 승인 요청하기";
                btn.disabled = false;
            }
        },
        onFailure: function(err) {
            alert("비밀번호가 일치하지 않습니다.");
            btn.innerText = "탈퇴 승인 요청하기";
            btn.disabled = false;
        }
    });
};

window.executeTutorWithdrawal = function() {
    const password = document.getElementById('withdrawalFinalPassword').value;
    if (!password) { alert("비밀번호를 입력해주세요."); return; }
    
    if (!tutorCognitoUser) {
        alert("세션이 만료되었습니다. 다시 로그인해주세요.");
        handleSignOut();
        return;
    }

    const btn = document.querySelector('#withdrawalFinalForm .danger-btn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 데이터 삭제 중...`;
    btn.disabled = true;

    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: tutorCognitoUser.getUsername(),
        Password: password
    });

    tutorCognitoUser.authenticateUser(authDetails, {
        onSuccess: async function(result) {
            try {
                await apiFetch(CONFIG.api.user, {
                    method: 'POST',
                    body: JSON.stringify({ type: 'delete_user' })
                });

                alert("튜터 파트너십 해지 및 탈퇴가 완료되었습니다. 그동안 함께해주셔서 감사합니다.");
                handleSignOut();
                
            } catch (e) {
                if (e.message !== "Auth expired") alert("탈퇴 처리 중 오류가 발생했습니다.");
                btn.innerText = "네, 모든 데이터를 삭제하고 탈퇴합니다";
                btn.disabled = false;
            }
        },
        onFailure: function(err) {
            alert("비밀번호가 일치하지 않습니다.");
            btn.innerText = "네, 모든 데이터를 삭제하고 탈퇴합니다";
            btn.disabled = false;
        }
    });
};

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

// 💡 보완된 전역 escapeHtml 함수
function escapeHtml(text) {
    if (text === null || text === undefined) return ""; 
    return String(text) 
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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