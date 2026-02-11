// js/mypage.js

const MYPAGE_API_URL = CONFIG.api.base; 
let currentUserTier = 'free';

document.addEventListener('DOMContentLoaded', () => {
    const idToken = localStorage.getItem('idToken'); 
    const userId = localStorage.getItem('userId');

    if (!idToken) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    // 1. 사용자 정보 불러오기
    fetchUserData(userId);

    // 2. UI 초기화 (엔터키 이벤트 등)
    setupUI();
});

// [보안] XSS 방지용 이스케이프 함수
function escapeHtml(text) {
    if (text == null) return ""; // null 또는 undefined 처리
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// DynamoDB 포맷 파싱 함수 (mypage에서도 필요할 수 있음)
function parseDynamoItem(item) {
    if (item === undefined || item === null) return null;
    if (typeof item !== 'object') return item;

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
        for (const key in item.M) {
            obj[key] = parseDynamoItem(item.M[key]);
        }
        return obj;
    }
    
    const obj = {};
    const keys = Object.keys(item);
    if (keys.length === 0) return item;

    for (const key of keys) {
        obj[key] = parseDynamoItem(item[key]);
    }
    return obj;
}

async function fetchUserData(userId) {
    const token = localStorage.getItem('idToken');
    const safeUserId = userId || localStorage.getItem('userId'); 
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'get_user', userId: safeUserId }) 
        });
        
        if (response.status === 401) throw new Error("인증 실패 (401): 다시 로그인해주세요.");
        if (!response.ok) {
            const errJson = await response.json();
            throw new Error(errJson.error || "서버 오류");
        }
        
        // [중요] DynamoDB 포맷 파싱
        const rawData = await response.json();
        const data = parseDynamoItem(rawData);

        renderUserInfo(data);
        applyUserTier(data.computedTier || 'free');
        
        // 프로필 사진 로드
        if (data && data.profileImage) {
            const imgElem = document.getElementById('profileImg');
            if (imgElem) {
                imgElem.src = escapeHtml(data.profileImage); // URL도 이스케이프 (src 속성은 상대적으로 안전하지만 습관화)
                checkDeleteButtonVisibility(data.profileImage);
            }
        }
    } catch (error) { 
        console.error("데이터 로드 중 오류:", error); 
        if(error.message.includes("401")) { 
            alert("세션이 만료되었습니다."); 
            location.href='/login'; 
        }
    }
}

function renderUserInfo(data) {
    // 사이드바 정보 (escapeHtml 적용)
    // innerText는 자동으로 이스케이프되지만, 명시적으로 처리
    const nameEl = document.getElementById('userNameDisplay');
    const emailEl = document.getElementById('userEmailDisplay');
    
    if (nameEl) nameEl.innerText = data.name ? data.name : '이름 없음';
    if (emailEl) emailEl.innerText = data.email ? data.email : '';
    
    // 폼 인풋 (value 속성은 스크립트 실행 위험이 적음)
    const nameInput = document.getElementById('profileName');
    if(nameInput) {
        nameInput.value = data.name || '';
        document.getElementById('profilePhone').value = data.phone || '';
        document.getElementById('profileSchool').value = data.school || '';
        document.getElementById('profileEmail').value = data.email || '';
    }
}

function applyUserTier(tier) {
    currentUserTier = tier;
    const profileBox = document.querySelector('.profile-summary');
    if (profileBox) {
        profileBox.classList.remove('tier-basic', 'tier-standard', 'tier-pro', 'tier-black');
        if (tier !== 'free') profileBox.classList.add(`tier-${tier}`);
        
        let badge = document.querySelector('.premium-badge');
        if (tier !== 'free') {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'premium-badge';
                profileBox.appendChild(badge);
            }
            badge.innerText = `${tier.toUpperCase()} MEMBER`;
        } else if (badge) {
            badge.remove();
        }
    }
}

// [기능] 프로필 사진 관리 (업로드, 삭제)
function triggerFileUpload() { document.getElementById('profileFileInput').click(); }

async function handleProfileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return; }

    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');
    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    imgElem.style.opacity = '0.5';

    try {
        const presignRes = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                type: 'get_presigned_url',
                userId: userId,
                data: { fileName: file.name, fileType: file.type, folder: 'profile' }
            })
        });

        if (!presignRes.ok) throw new Error("Presigned URL 발급 실패");
        const { uploadUrl, fileUrl } = await presignRes.json();

        const s3Upload = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        const updateRes = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_user_profile_image', userId: userId, data: { profileImageUrl: fileUrl } })
        });
        if (!updateRes.ok) throw new Error("DB 업데이트 실패");

        imgElem.src = escapeHtml(fileUrl);
        alert("프로필 사진이 변경되었습니다.");
        checkDeleteButtonVisibility(fileUrl);

    } catch (e) {
        console.error(e); alert("사진 업로드 중 오류가 발생했습니다.");
        imgElem.src = originalSrc;
    } finally {
        imgElem.style.opacity = '1'; input.value = '';
    }
}

async function handleProfileDelete() {
    if (!confirm("프로필 사진을 삭제하시겠습니까?")) return;
    const imgElem = document.getElementById('profileImg');
    const currentUrl = imgElem.src;
    const token = localStorage.getItem('idToken');
    const userId = localStorage.getItem('userId');

    try {
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            await fetch(CONFIG.api.base, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ type: 'delete_s3_file', data: { fileUrl: currentUrl } })
            });
        }
        const dbRes = await fetch(CONFIG.api.base, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_user_profile_image', data: { profileImageUrl: "" }, userId: userId })
        });

        if (!dbRes.ok) throw new Error("DB 삭제 실패");
        imgElem.src = "https://placehold.co/150x150?text=Profile"; 
        alert("프로필 사진이 삭제되었습니다.");
        checkDeleteButtonVisibility("");

    } catch (e) { console.error(e); alert("삭제 실패"); }
}

function checkDeleteButtonVisibility(url) {
    const deleteBtn = document.getElementById('deletePicBtn');
    if (url && !url.includes('sample_profile') && !url.includes('placehold.co')) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
}

// [기능] 회원 정보 수정
async function saveProfile() {
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    const newName = document.getElementById('profileName').value;
    const newPhone = document.getElementById('profilePhone').value;
    const newSchool = document.getElementById('profileSchool').value;
    const newEmail = document.getElementById('profileEmail').value;
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('newPasswordConfirm').value;
    
    if (!newName) return alert("이름을 입력해주세요.");
    if (newPw && newPw !== confirmPw) return alert("새 비밀번호가 일치하지 않습니다.");
    
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'update_profile', userId, data: { name: newName, phone: newPhone, school: newSchool, email: newEmail } })
        });
        if(response.ok) { alert("회원 정보가 수정되었습니다."); location.reload(); } else { throw new Error("저장 실패"); }
    } catch (error) { alert("저장 중 오류가 발생했습니다."); }
}

async function handleDeleteAccount() {
    if (!confirm("정말로 탈퇴하시겠습니까?\n\n탈퇴 시 저장된 모든 데이터가 영구 삭제됩니다.")) return;
    const userId = localStorage.getItem('userId');
    const token = localStorage.getItem('idToken');
    try {
        const response = await fetch(MYPAGE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ type: 'delete_user', userId })
        });
        if (response.ok) { alert("탈퇴가 완료되었습니다."); localStorage.clear(); sessionStorage.clear(); window.location.href = '/index'; } else { throw new Error("탈퇴 실패"); }
    } catch (error) { alert("오류 발생"); }
}

function setupUI() {
    const pwConfirmInput = document.getElementById('newPasswordConfirm');
    if (pwConfirmInput) {
        pwConfirmInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') saveProfile(); });
    }
}