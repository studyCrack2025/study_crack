// js/mypage_tutor.js

const TUTOR_API_URL = CONFIG.api.admin;
const FILE_API_URL = CONFIG.api.file;
const NOTI_API_URL = CONFIG.api.noti;

let tutorInfoData = {};
let tutorCognitoUser = null; 
let tutorTimerInterval = null;
let mypagePhoneTimerInterval = null;

// 💡 공통 apiFetch 함수 (accessToken 기반 통합 및 401 예외 처리)
async function apiFetch(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...(options.headers || {}) };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                handleSignOut(); 
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

// 💡 공통 XSS 방어 유틸리티
function escapeHtml(text) {
    if (text == null) return ""; 
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
    if (Array.isArray(item)) return item.map(parseDynamoItem);
    if (item.S !== undefined) return item.S;
    if (item.N !== undefined) return Number(item.N);
    if (item.BOOL !== undefined) return item.BOOL;
    if (item.NULL === true) return null;
    if (item.L !== undefined) {
        if (Array.isArray(item.L)) return item.L.map(parseDynamoItem);
        return [];
    }
    if (item.M !== undefined) {
        const obj = {};
        for (const key in item.M) obj[key] = parseDynamoItem(item.M[key]);
        return obj;
    }
    
    // 일반 객체인 경우 (이미 언마샬링 된 경우)
    const obj = {};
    for (const key in item) {
        obj[key] = parseDynamoItem(item[key]);
    }
    return obj; 
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

    initTutorCognito();
    await loadTutorInfo(userId);
    fetchTutorNotifications();

    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    if (tab === 'students') switchTab('students');
    else switchTab('info'); 

    window.onclick = function(event) {
        if (event.target.classList.contains('modal-overlay') || event.target.classList.contains('modal')) {
            event.target.classList.add('hidden');
        }
    }
});

function initTutorCognito() {
    const poolData = { 
        UserPoolId: CONFIG.cognito.userPoolId, 
        ClientId: CONFIG.cognito.clientId 
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    
    tutorCognitoUser = userPool.getCurrentUser();
    
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

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const btns = document.querySelectorAll('.tab-btn');
    if (tabName === 'info' && btns[0]) btns[0].classList.add('active');
    else if (tabName === 'students' && btns[1]) { 
        btns[1].classList.add('active'); 
        loadMyStudents(); 
    }

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
        const data = parseDynamoItem(rawData);
        tutorInfoData = data;

        const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

        setTxt('userNameDisplay', data.name || '이름 없음');
        setTxt('userEmailDisplay', data.email || '');
        setTxt('currentEmailDisplay', data.email || '');
        setTxt('currentPhoneDisplay', data.phone || '등록된 번호 없음');

        setVal('modalNickname', data.nickname || '');
        setVal('modalSchool', data.school || '');
        setVal('modalMajor', data.major || '');
        setVal('modalStrengths', data.strengths || '');
        setVal('modalMessage', data.message || '');
        setVal('accountNumber', data.accountNumber || '');
        setVal('profileMaxStudents', data.maxStudents || '');
        setVal('profileMaxHours', data.maxHours || '');
        
        tutorInfoData.withdrawalStatus = data.withdrawalStatus || 'none';

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
    const nickname = document.getElementById('modalNickname').value.trim();
    const school = document.getElementById('modalSchool').value.trim();
    const major = document.getElementById('modalMajor').value.trim();
    const strengths = document.getElementById('modalStrengths').value.trim();
    const message = document.getElementById('modalMessage').value.trim();
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
        input.disabled = false; input.type = 'text'; input.focus();
        btn.innerText = "저장하기"; btn.classList.add('saving');
    } else {
        const newAccount = input.value.trim();
        if (!newAccount) { alert("계좌번호를 입력해주세요."); return; }

        const success = await saveSingleField('accountNumber', newAccount);
        if (success) {
            alert("계좌 정보가 수정되었습니다.");
            input.disabled = true; input.type = 'password';
            btn.innerText = "수정하기"; btn.classList.remove('saving');
        } else { alert("저장 실패"); }
    }
}

window.toggleDepositHistory = function() {
    const area = document.getElementById('depositHistoryArea');
    const icon = document.getElementById('depositIcon');
    
    if (area.classList.contains('hidden')) {
        area.classList.remove('hidden'); icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up');
        loadDepositHistoryData();
    } else {
        area.classList.add('hidden'); icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down');
    }
}

async function loadDepositHistoryData() {
    const tbody = document.getElementById('depositListBody');
    tbody.innerHTML = '<tr><td colspan="4" class="empty-msg"><i class="fas fa-spinner fa-spin"></i> 내역 조회 중...</td></tr>';
    const userId = localStorage.getItem('userId');

    try {
        const response = await apiFetch(TUTOR_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'tutor_get_payment_history', userId: userId })
        });
        
        const rawList = await response.json();
        let list = Array.isArray(rawList) ? rawList.map(parseDynamoItem) : [];

        tbody.innerHTML = '';
        if (list.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">정산 내역이 없습니다.</td></tr>';
            return;
        }

        list.sort((a, b) => (b.yearMonth || '').localeCompare(a.yearMonth || ''));

        list.forEach(item => {
            const stdCount = Number(item.standardCount || 0); const proCount = Number(item.proCount || 0);
            const stdAmt = Number(item.standardAmount || 0).toLocaleString(); const proAmt = Number(item.proAmount || 0).toLocaleString();
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
            body: JSON.stringify({ type: 'tutor_update_member_info', userId, data: { [field]: value } })
        });
        return true;
    } catch (error) {
        if (error.message !== "Auth expired") console.error(error);
        return false;
    }
}

// ==========================================
// [기타] 프로필 사진 관리
// ==========================================
window.triggerFileUpload = function(){ document.getElementById('profileFileInput').click(); }

window.handleProfileUpload = async function(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return; }

    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    imgElem.style.opacity = '0.5';

    try {
        const presignRes = await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_presigned_url', data: { fileName: encodeURIComponent(file.name), fileType: file.type, folder: 'profile' } })
        });
        
        const { uploadUrl, fileUrl, fields } = await presignRes.json();
        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
        formData.append('file', file);
        
        // 💡 S3 업로드는 순수 fetch 사용 필수
        const s3Upload = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_user_profile_image', data: { profileImageUrl: fileUrl } })
        });

        imgElem.src = escapeHtml(fileUrl);
        alert("프로필 사진이 변경되었습니다.");
        checkDeleteButtonVisibility(fileUrl);

    } catch (e) {
        if (e.message !== "Auth expired") alert("사진 업로드 중 오류가 발생했습니다.");
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
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            await apiFetch(FILE_API_URL, {
                method: 'POST', body: JSON.stringify({ type: 'delete_s3_file', data: { fileUrl: currentUrl } })
            });
        }
        
        await apiFetch(FILE_API_URL, {
            method: 'POST', body: JSON.stringify({ type: 'update_user_profile_image', data: { profileImageUrl: "" } })
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

// ==========================================
// [핵심] 학생 관리 렌더링 로직 (바뀐 티어 스키마 대응)
// ==========================================
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
            // 💡 [수정] 백엔드에서 주는 최신 계산식 티어를 받아서 렌더링
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

// ==========================================
// 튜터 알림(Notification) 기능
// ==========================================
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
            badge.style.display = 'flex'; badge.innerText = unreadCount;
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
            div.onclick = async () => {
                if (!n.isRead) await markTutorNotiAsRead(n.id);
                handleTutorNotiAction(n);
            };
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
// 사이드바 활동 정보 관리
// ==========================================
window.toggleEditMaxStudents = async function(btn) {
    const input = document.getElementById('profileMaxStudents');
    if (input.disabled) {
        input.disabled = false; input.focus();
        btn.innerText = "저장"; btn.classList.add('saving');
    } else {
        const newValue = parseInt(input.value);
        if (!newValue || newValue < 1 || newValue > 15) return alert("최대 희망 학생 수는 1~15명 사이로 입력해주세요.");
        const success = await saveSingleField('maxStudents', newValue);
        if (success) {
            alert("최대 희망 학생 수가 수정되었습니다.");
            input.disabled = true; btn.innerText = "수정"; btn.classList.remove('saving');
            tutorInfoData.maxStudents = newValue;
        } else { alert("수정에 실패했습니다. 다시 시도해주세요."); }
    }
};

window.toggleEditMaxHours = async function(btn) {
    const input = document.getElementById('profileMaxHours');
    if (input.disabled) {
        input.disabled = false; input.focus();
        btn.innerText = "저장"; btn.classList.add('saving');
    } else {
        const newValue = parseInt(input.value);
        if (!newValue || newValue < 1) return alert("주 최대 근무가능 시간은 1시간 이상으로 입력해주세요.");
        const success = await saveSingleField('maxHours', newValue);
        if (success) {
            alert("주 최대 근무가능 시간이 수정되었습니다.");
            input.disabled = true; btn.innerText = "수정"; btn.classList.remove('saving');
            tutorInfoData.maxHours = newValue;
        } else { alert("수정에 실패했습니다. 다시 시도해주세요."); }
    }
};

// ==========================================
// 튜터 파트너십 해지 (2단계 회원 탈퇴)
// ==========================================
window.openTutorWithdrawalModal = function() {
    if(document.getElementById('withdrawalReqPassword')) document.getElementById('withdrawalReqPassword').value = '';
    if(document.getElementById('withdrawalFinalPassword')) document.getElementById('withdrawalFinalPassword').value = '';
    if(document.getElementById('withdrawalReason')) document.getElementById('withdrawalReason').value = '';

    const reqForm = document.getElementById('withdrawalRequestForm');
    const pendingForm = document.getElementById('withdrawalPendingForm');
    const finalForm = document.getElementById('withdrawalFinalForm');

    if (tutorInfoData.withdrawalStatus === 'approved') {
        reqForm.classList.add('hidden'); pendingForm.classList.add('hidden'); finalForm.classList.remove('hidden'); 
    } else if (tutorInfoData.withdrawalStatus === 'pending') {
        reqForm.classList.add('hidden'); pendingForm.classList.remove('hidden'); finalForm.classList.add('hidden');
    } else {
        reqForm.classList.remove('hidden'); pendingForm.classList.add('hidden'); finalForm.classList.add('hidden');
    }
    
    document.getElementById('tutorWithdrawalModal').classList.remove('hidden');
};

window.requestTutorWithdrawal = function() {
    const password = document.getElementById('withdrawalReqPassword').value;
    const reason = document.getElementById('withdrawalReason').value.trim();

    if (!password || !reason) return alert("비밀번호와 사유를 모두 입력해주세요.");
    if (!tutorCognitoUser) { alert("세션이 만료되었습니다. 다시 로그인해주세요."); handleSignOut(); return; }

    const btn = document.querySelector('#withdrawalRequestForm .danger-btn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 요청 중...`; btn.disabled = true;

    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({ Username: tutorCognitoUser.getUsername(), Password: password });

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
                btn.innerText = "탈퇴 승인 요청하기"; btn.disabled = false;
            }
        },
        onFailure: function(err) {
            alert("비밀번호가 일치하지 않습니다.");
            btn.innerText = "탈퇴 승인 요청하기"; btn.disabled = false;
        }
    });
};

window.executeTutorWithdrawal = function() {
    const password = document.getElementById('withdrawalFinalPassword').value;
    if (!password) { alert("비밀번호를 입력해주세요."); return; }
    if (!tutorCognitoUser) { alert("세션이 만료되었습니다. 다시 로그인해주세요."); handleSignOut(); return; }

    const btn = document.querySelector('#withdrawalFinalForm .danger-btn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 데이터 삭제 중...`; btn.disabled = true;

    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({ Username: tutorCognitoUser.getUsername(), Password: password });

    tutorCognitoUser.authenticateUser(authDetails, {
        onSuccess: async function(result) {
            try {
                await apiFetch(CONFIG.api.user, {
                    method: 'POST', body: JSON.stringify({ type: 'delete_user' })
                });
                alert("튜터 파트너십 해지 및 탈퇴가 완료되었습니다. 그동안 함께해주셔서 감사합니다.");
                handleSignOut();
            } catch (e) {
                if (e.message !== "Auth expired") alert("탈퇴 처리 중 오류가 발생했습니다.");
                btn.innerText = "네, 모든 데이터를 삭제하고 탈퇴합니다"; btn.disabled = false;
            }
        },
        onFailure: function(err) {
            alert("비밀번호가 일치하지 않습니다.");
            btn.innerText = "네, 모든 데이터를 삭제하고 탈퇴합니다"; btn.disabled = false;
        }
    });
};

/* 전화번호 수정 */
window.openPhoneModal = function() {
    document.getElementById('phoneModal').classList.remove('hidden');
    document.getElementById('step-phone-input').classList.remove('hidden');
    document.getElementById('step-phone-verify').classList.add('hidden');
    
    document.getElementById('newPhoneInput').value = '';
    document.getElementById('phoneVerifyCode').value = '';
    document.getElementById('newPhoneInput').disabled = false;
    
    const sendBtn = document.getElementById('sendPhoneCodeBtn');
    if (sendBtn) { 
        sendBtn.innerText = "인증번호 전송"; 
        sendBtn.disabled = false; 
    }
    if (mypagePhoneTimerInterval) clearInterval(mypagePhoneTimerInterval);
}

// 1단계: 인증번호 발송 요청
window.requestPhoneChange = async function() {
    let phone = document.getElementById('newPhoneInput').value;
    if (!phone) { alert("새 전화번호를 입력해주세요."); return; }

    let cleanPhone = phone.replace(/-/g, '').trim();
    if (cleanPhone.startsWith('010')) {
        cleanPhone = '+82' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('10')) {
        cleanPhone = '+82' + cleanPhone;
    } else if (!cleanPhone.startsWith('+')) {
        alert("휴대폰 번호 형식을 확인해주세요. (예: 01012345678)");
        return;
    }

    const btn = document.getElementById('sendPhoneCodeBtn');
    btn.innerText = "전송 중...";
    btn.disabled = true;

    try {
        const response = await apiFetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'send_sms_auth', phone: cleanPhone })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "SMS 발송 실패");
        }

        alert("인증번호가 발송되었습니다. 5분 이내에 입력해주세요.");
        document.getElementById('step-phone-input').classList.add('hidden');
        document.getElementById('step-phone-verify').classList.remove('hidden');
        
        startMypagePhoneTimer(5 * 60, 'phoneTimer');

    } catch (error) {
        if (error.message !== "Auth expired") alert("인증번호 발송에 실패했습니다.");
        btn.innerText = "인증번호 전송";
        btn.disabled = false;
    }
}

// 2단계: 인증번호 확인 및 사용자 정보 업데이트
window.verifyPhoneChange = async function() {
    let phoneRaw = document.getElementById('newPhoneInput').value.replace(/-/g, '').trim();
    let cleanPhone = phoneRaw;

    if (cleanPhone.startsWith('010')) {
        cleanPhone = '+82' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('10')) {
        cleanPhone = '+82' + cleanPhone;
    }

    const inputCode = document.getElementById('phoneVerifyCode').value;
    if (!inputCode) { alert("인증코드를 입력해주세요."); return; }

    try {
        // 인증번호 검증
        const response = await apiFetch(AUTH_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'verify_code',
                phone: cleanPhone,
                code: inputCode
            })
        });

        const result = await response.json();

        if (result.success) {
            // 검증 성공 시 DB에 저장하기 위한 포맷으로 변경 (예: 010-1234-5678)
            let dbFormattedPhone = phoneRaw.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/, "$1-$2-$3");

            // 기존에 작성되어 있는 saveSingleField 함수를 재활용하여 DB 업데이트
            const success = await saveSingleField('phone', dbFormattedPhone);
            
            if (success) {
                alert("전화번호가 성공적으로 변경되었습니다.");
                document.getElementById('currentPhoneDisplay').innerText = escapeHtml(dbFormattedPhone);
                tutorInfoData.phone = dbFormattedPhone;
                closeModal('phoneModal');
            } else {
                alert("변경사항을 서버에 저장하는데 실패했습니다.");
            }
        } else {
            alert("인증번호가 일치하지 않거나 만료되었습니다.");
        }
    } catch (error) {
        if (error.message !== "Auth expired") alert("인증 확인 중 오류가 발생했습니다.");
    }
}

// 3단계: 전용 타이머 동작 함수
function startMypagePhoneTimer(duration, displayId) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById(displayId);
    if(mypagePhoneTimerInterval) clearInterval(mypagePhoneTimerInterval);

    mypagePhoneTimerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);
        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        if(display) display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(mypagePhoneTimerInterval);
            if(display) display.textContent = "만료";
            alert("인증 시간이 만료되었습니다. 창을 닫고 다시 시도해주세요.");
        }
    }, 1000);
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

// 알림 타입에 따른 액션 처리 (공지사항 모달 등)
function handleTutorNotiAction(noti) {
    // 알림 패널 닫기
    const panel = document.getElementById('tutorNotiPanel');
    if (panel) panel.classList.add('hidden');

    // 관리자 공지사항인 경우 모달 팝업
    if (noti.actionType === 'admin_notice') {
        const titleEl = document.getElementById('noticeModalTitle');
        const dateEl = document.getElementById('noticeModalDate');
        const contentEl = document.getElementById('noticeModalContent');
        const modal = document.getElementById('noticeDetail-modal');

        if (titleEl) titleEl.innerText = noti.title || "공지사항";
        if (dateEl) dateEl.innerText = new Date(noti.createdAt).toLocaleDateString();
        if (contentEl) contentEl.innerText = noti.detail || noti.message || "내용이 없습니다.";
        
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    } 
}

function startTutorTimer(duration, displayId) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById(displayId);
    if(tutorTimerInterval) clearInterval(tutorTimerInterval);
    tutorTimerInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10); seconds = parseInt(timer % 60, 10);
        minutes = minutes < 10 ? "0" + minutes : minutes; seconds = seconds < 10 ? "0" + seconds : seconds;
        if(display) display.textContent = minutes + ":" + seconds;
        if (--timer < 0) { clearInterval(tutorTimerInterval); if(display) display.textContent = "만료"; }
    }, 1000);
}