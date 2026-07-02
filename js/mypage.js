// js/mypage.js
// FILE_API_URL 은 shared/api.js 에서 글로벌 선언됨 — 여기서 재선언 X

let currentUserTier = 'free';
let cognitoUser = null;
let currentTutorData = null;
let currentUserAuthProvider = 'local';
let currentUserEmail = '';

let mypagePhoneTimerInterval = null;

// apiFetch는 shared/api.js 의 단일 구현 사용.
// 인증번호 검증 등 사용자에게 보여줘야 하는 오류 메시지는 호출처에서 try/catch로 처리 (apiFetch가 throw하는 메시지 사용).

// 💡 한층 더 강력해진 escapeHtml 적용
function escapeHtml(text) {
    if (text === null || text === undefined) return ""; 
    return String(text) 
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// [초기화] DOM 로드 및 데이터 페치
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {

    if (window.DEV_MOCK?.enabled) {
        const u = window.DEV_MOCK.user;
        renderUserInfo({ name: u.name, email: u.email, phone: u.phone, mbti: u.mbti });
        applyUserTier(u.tier);
        setupUI();
        const loader = document.getElementById('pageLoadingOverlay');
        if (loader) setTimeout(() => loader.classList.add('hidden'), 300);
        return;
    }

    // 1. 로그인 여부 확인
    if (!localStorage.getItem('userId')) {
        const refreshed = await tryRefreshToken();
        if (!refreshed) {
            clearClientSession();
            alert("로그인이 필요합니다.");
            window.location.replace('/login');
            return;
        }
        checkLoginStatus();
    }

    // 2. 세션 갱신 및 데이터 페치를 순차적으로 실행
    initCognitoAndFetchData();

    // 3. UI 이벤트 리스너 등록
    setupUI();
    
    // 💡 엔터키 바인딩 유틸리티
    const bindEnterKey = (inputId, actionFunction) => {
        const el = document.getElementById(inputId);
        if (el) {
            el.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault(); 
                    actionFunction();
                }
            });
        }
    };

    // 💡 학생 페이지 모달 인풋 엔터키 연동
    bindEnterKey('newPhoneInput', window.requestPhoneChange);
    bindEnterKey('phoneVerifyCode', window.verifyPhoneChange);
    bindEnterKey('currentPassword', changePassword);
    bindEnterKey('newChangePassword', changePassword);
    bindEnterKey('newChangePasswordConfirm', changePassword);
    bindEnterKey('deleteConfirmText', deleteStep2Submit);
    
    // 소셜 재인증 콜백 처리 (회원 탈퇴용) — DOM 즉시 열기
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reauth') === 'success' && urlParams.get('purpose') === 'delete_account') {
        history.replaceState(null, '', '/mypage');
        document.getElementById('deleteAccountModal').classList.remove('hidden');
        _proceedToDeleteStep2();
    }

    // MBTI 테스트 후 복귀 처리
    if (urlParams.get('mbti_completed') === 'true') {
        const mbtiResult = urlParams.get('mbti_result');
        if (mbtiResult && /^[CI][SM][DE][RF]$/.test(mbtiResult)) {
            saveMbti(mbtiResult).then(ok => {
                if (ok) {
                    const el = document.getElementById('profileMbtiDisplay');
                    if (el) el.textContent = mbtiResult;
                    alert(`탐구 MBTI가 ${mbtiResult}로 저장되었습니다.`);
                }
            });
        }
        // URL 정리
        history.replaceState(null, '', '/mypage');
    }

    const pendingTutorial = localStorage.getItem('pending_tutorial');
    
    if (pendingTutorial === 'true') {
        setTimeout(() => {
            const overlay = document.getElementById('tutorialOverlay');
            // 대상: '기초조사서 작성/수정하러 가기' 버튼 (class로 찾음)
            const targetBtn = document.querySelector('.btn-go-survey'); 
            const skipBtn = document.getElementById('skipTutorialBtn');
            const tooltip = document.getElementById('tutorialTooltip');

            if (targetBtn) {
                overlay.classList.remove('hidden');
                
                // 타겟 버튼 위치 계산 및 클론 생성
                const rect = targetBtn.getBoundingClientRect();
                const cloneBtn = document.createElement('a'); // 버튼이 원래 <a> 태그이므로 동일하게 생성
                cloneBtn.className = 'tutorial-clone-btn btn-go-survey'; // 기존 클래스 그대로 복사하여 스타일 유지
                cloneBtn.innerHTML = targetBtn.innerHTML; // 아이콘과 텍스트 그대로 복사
                cloneBtn.href = targetBtn.href;
                
                // 원본 버튼과 똑같은 위치, 크기로 세팅
                cloneBtn.style.top = `${rect.top}px`; 
                cloneBtn.style.left = `${rect.left}px`; 
                cloneBtn.style.width = `${rect.width}px`; 
                cloneBtn.style.height = `${rect.height}px`; 
                cloneBtn.style.margin = '0'; // 오버레이 위에서는 마진 제거
                
                overlay.appendChild(cloneBtn);

                // 말풍선 위치 지정 (복제된 버튼 바로 아래)
                tooltip.style.top = `${rect.bottom + 15}px`;
                tooltip.style.left = `${rect.left}px`; // 이번엔 왼쪽 라인을 맞춰서 띄움

                // 복제된 버튼 클릭 이벤트 -> 실제 페이지 이동 (<a> 태그이므로 href 속성으로 자연스럽게 이동)
                cloneBtn.addEventListener('click', () => {
                    // 🚨 여기서도 localStorage를 지우지 않습니다. 
                    // /survey 작성 완료 후 3단계(솔루션 보기)로 넘어가기 위함입니다.
                });

                // 건너뛰기 버튼 클릭 이벤트 -> 튜토리얼 영구 종료
                skipBtn.addEventListener('click', () => {
                    if (!confirm("정말로 그만두시겠습니까?\n튜토리얼 완료 시 제공되는 무료 대학 분석 기회를 받지 못할 수 있습니다.")) return;

                    localStorage.removeItem('pending_tutorial'); 
                    overlay.classList.add('hidden');
                    cloneBtn.remove();
                });
            }
        }, 300);
    }
});

function initCognitoAndFetchData() {
    const poolData = {
        UserPoolId: CONFIG.cognito.userPoolId,
        ClientId: CONFIG.cognito.clientId
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    cognitoUser = userPool.getCurrentUser();

    // 세션이 유효하면 데이터 조회.
    const userId = localStorage.getItem('userId');
    if (userId) {
        fetchUserData(userId);
    } else {
        alert("로그인 정보가 유효하지 않습니다.");
        handleSignOut();
    }
}

// ==========================================
// [데이터 로드] 유저 정보 가져오기
// ==========================================
async function fetchUserData(userId) {
    try {
        // 1. 내 정보 가져오기
        const response = await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user_mypage' })
        });
        
        const userData = await response.json();

        // 2. 내 정보 렌더링
        renderUserInfo(userData);
        renderSocialLinks(userData);
        renderPlanStatus(userData);
        applyUserTier(userData.computedTier || 'free');

        // 프로필 이미지 처리
        if (userData.profileImage) {
            const imgElem = document.getElementById('profileImg');
            if (imgElem) {
                imgElem.src = escapeHtml(userData.profileImage);
                checkDeleteButtonVisibility(userData.profileImage);
            }
        }

        // 튜터 정보 조회 로직 업데이트
        if (userData.tutorName) {            
            const cleanTutorName = userData.tutorName.trim();
            // 백엔드가 요구하는 정확한 파라미터명(tutorName)으로 감싸서 전달
            await fetchTutorInfo(cleanTutorName, userData.computedTier);
        }

    } catch (error) { 
        if (error.message !== "Auth expired") console.error("내 정보 로드 실패:", error);
    }
}

async function fetchTutorInfo(tutorName, userTier) {
    try {
        const response = await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'get_tutor_info', 
                // 백엔드의 NicknameIndex 검색을 위해 정확한 키워드 전달
                data: { tutorName: String(tutorName) } 
            })
        });

        // 404 등 정상적인 에러 응답 처리 (튜터가 삭제되었거나 매칭 전인 경우)
        if (!response.ok) {
            console.warn(`튜터 정보를 불러올 수 없습니다. (${response.status})`);
            currentTutorData = null;
            checkTutorButtonVisibility(userTier || 'free');
            return;
        }

        const resData = await response.json();
        currentTutorData = resData; 
        
        checkTutorButtonVisibility(userTier || 'free');
    } catch (error) {
        if (error.message !== "Auth expired") console.error("튜터 정보 로드 실패:", error);
    }
}

function renderSocialLinks(data) {
    const section = document.getElementById('socialLinksSection');
    if (!section) return;

    const primaryProvider = data.authProvider || 'local';
    currentUserAuthProvider = primaryProvider;
    const linked = data.linkedProviders || [];
    const linkedSet = new Set(linked.map(lp => lp.provider));
    if (primaryProvider !== 'local') linkedSet.add(primaryProvider);

    // 비밀번호 변경 행: 소셜 전용 계정(local provider 없음)이면 숨김
    const pwRow = document.getElementById('passwordChangeRow');
    if (pwRow) pwRow.style.display = primaryProvider !== 'local' ? 'none' : '';

    const providers = [
        { key: 'google', label: 'Google', icon: 'fab fa-google', color: '#EA4335' },
        { key: 'naver', label: 'Naver', icon: 'fas fa-n', color: '#03C75A' }
    ];

    section.innerHTML = providers.map(p => {
        const isLinked = linkedSet.has(p.key);
        const isPrimary = primaryProvider === p.key;
        return `<div class="social-link-row">
            <div class="social-link-info">
                <span class="social-icon" style="color:${p.color}"><i class="${p.icon}"></i></span>
                <span class="social-label">${p.label}</span>
            </div>
            <div class="social-link-status">
                ${isLinked
                    ? `<span class="social-badge linked">연동됨</span>
                       ${isPrimary
                           ? `<span class="social-primary-hint">기본 로그인</span>`
                           : `<button class="social-action-btn unlink-btn" onclick="unlinkSocial('${p.key}')">연동 해제</button>`
                       }`
                    : `<span class="social-badge unlinked">미연동</span>
                       <button class="social-action-btn link-btn" onclick="linkSocial('${p.key}')">연동하기</button>`
                }
            </div>
        </div>`;
    }).join('');
}

function renderUserInfo(data) {
    const nameEl = document.getElementById('userNameDisplay');
    const emailEl = document.getElementById('userEmailDisplay');

    if (nameEl) nameEl.innerText = data.name ? data.name : '이름 없음';

    // 소셜 로그인 가상 이메일(xxx@social.studycrack.co.kr) 필터링
    // socialEmail(카카오/구글/네이버 실제 이메일) 우선 표시
    const rawEmail = data.socialEmail || data.email || '';
    const displayEmail = rawEmail.includes('@social.studycrack.co.kr') ? '' : rawEmail;
    currentUserEmail = displayEmail;
    if (emailEl) emailEl.innerText = displayEmail;

    const nameInput = document.getElementById('profileName');
    if (nameInput) {
        nameInput.value = data.name || '';
    }

    const phoneDisplay = document.getElementById('currentPhoneDisplay');
    if (phoneDisplay) phoneDisplay.innerText = data.phone || '등록된 번호 없음';

    const currentEmailDisplay = document.getElementById('currentEmailDisplay');
    if (currentEmailDisplay) currentEmailDisplay.innerText = displayEmail;

    const mbtiDisplay = document.getElementById('profileMbtiDisplay');
    if (mbtiDisplay) mbtiDisplay.textContent = data.mbti || data.qualitative?.mbti || '-';

    const marketingToggle = document.getElementById('marketingConsentToggle');
    if (marketingToggle) marketingToggle.checked = data.marketingAgreed === true;
    renderMarketingConsentStatus(data.marketingAgreed === true, data.marketingAgreedAt);
}

function formatMarketingConsentDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderMarketingConsentStatus(isAgreed, agreedAt) {
    const statusEl = document.getElementById('marketingConsentStatus');
    if (!statusEl) return;

    if (!isAgreed) {
        statusEl.innerText = '미동의';
        return;
    }

    const agreedAtText = formatMarketingConsentDate(agreedAt);
    statusEl.innerText = agreedAtText ? `${agreedAtText} 동의` : '동의 중';
}

function renderPlanStatus(data) {
    const tier = data.computedTier || 'free';
    const tierEl = document.getElementById('planStatusTier');
    const expireEl = document.getElementById('planStatusExpire');
    const btnEl = document.getElementById('planStatusBtn');
    if (!tierEl || !expireEl) return;

    tierEl.innerText = tier.toUpperCase();

    if (tier === 'free') {
        expireEl.innerText = '이용권 없음';
        if (btnEl) btnEl.innerText = '이용권 구매하기';
    } else if (tier === 'basic') {
        expireEl.innerText = '평생 이용 가능';
        if (btnEl) btnEl.innerText = '업그레이드';
    } else if (data.currentSubscription && data.currentSubscription.startDate) {
        const startDate = new Date(data.currentSubscription.startDate);
        const expireDate = new Date(startDate.getTime() + 28 * 24 * 60 * 60 * 1000);
        const y = expireDate.getFullYear();
        const m = String(expireDate.getMonth() + 1).padStart(2, '0');
        const d = String(expireDate.getDate()).padStart(2, '0');
        expireEl.innerText = `이용 가능 기간: ${y}.${m}.${d} 까지`;
        if (btnEl) btnEl.innerText = '이용권 연장 / 업그레이드';
    } else {
        expireEl.innerText = '-';
    }
}

function applyUserTier(tier) {
    currentUserTier = tier;
    const tierDisplayMap = { basic: 'BASIC', starter: 'STARTER', standard: 'STANDARD', pro: 'PRO', trial: 'TRIAL', test: 'TEST' };
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
            const tierLabel = tierDisplayMap[tier] || String(tier || '').toUpperCase();
            badge.innerText = `${tierLabel} MEMBER`;
        } else if (badge) {
            badge.remove();
        }
    }
}


// ==========================================
// [기능 1] 기본 인적사항 수정 (개별 토글)
// ==========================================
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

        const success = await saveSingleField(dbField, newValue);
        
        if (success) {
            alert("수정되었습니다.");
            input.disabled = true;
            btn.innerText = "수정하기";
            btn.classList.remove('saving');
            
            if (dbField === 'name') {
                const nameEl = document.getElementById('userNameDisplay');
                if (nameEl) nameEl.innerText = newValue;
            }
        }
    }
}

async function saveSingleField(field, value) {
    try {
        await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'update_member_info', 
                data: { [field]: value } 
            })
        });
        return true;
    } catch (error) {
        if (error.message !== "Auth expired") alert("저장 중 오류가 발생했습니다.");
        return false;
    }
}

async function saveMarketingConsent(isAgreed) {
    const toggle = document.getElementById('marketingConsentToggle');
    if (toggle) toggle.disabled = true;

    try {
        await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'update_member_info',
                data: { marketingAgreed: isAgreed === true }
            })
        });
        renderMarketingConsentStatus(isAgreed === true, isAgreed ? new Date().toISOString() : null);
        alert(isAgreed ? '마케팅 정보 수신에 동의했습니다.' : '마케팅 정보 수신 동의를 철회했습니다.');
    } catch (error) {
        if (toggle) toggle.checked = !isAgreed;
        if (error.message !== "Auth expired") alert("저장 중 오류가 발생했습니다.");
    } finally {
        if (toggle) toggle.disabled = false;
    }
}

// ==========================================
// [기능 2] 계정 정보 변경 (모달 & Cognito)
// ==========================================

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    if(modalId === 'mbtiModal') {
        mypageMbtiDimSelections = [null, null, null, null];
        document.querySelectorAll('#mbtiDimListMypage .mbti-dim-btn').forEach(b => b.classList.remove('active'));
        const preview = document.getElementById('mbtiPreviewCodeMypage');
        if (preview) preview.textContent = '? ? ? ?';
        const confirmBtn = document.getElementById('mbtiConfirmBtnMypage');
        if (confirmBtn) confirmBtn.disabled = true;
    }
    if(modalId === 'phoneModal') {
        document.getElementById('step-phone-input').classList.remove('hidden');
        document.getElementById('step-phone-verify').classList.add('hidden');
        document.getElementById('newPhoneInput').value = '';
        document.getElementById('phoneVerifyCode').value = '';
        if(mypagePhoneTimerInterval) clearInterval(mypagePhoneTimerInterval);
    }
    if(modalId === 'passwordModal') {
        document.getElementById('currentPassword').value = '';
        document.getElementById('newChangePassword').value = '';
        document.getElementById('newChangePasswordConfirm').value = '';
    }
}

window.openPhoneModal = function() {
    document.getElementById('phoneModal').classList.remove('hidden');
    document.getElementById('step-phone-input').classList.remove('hidden');
    document.getElementById('step-phone-verify').classList.add('hidden');
    
    document.getElementById('newPhoneInput').value = '';
    document.getElementById('phoneVerifyCode').value = '';
    
    const sendBtn = document.getElementById('sendPhoneCodeBtn');
    if (sendBtn) { 
        sendBtn.innerText = "인증번호 전송"; 
        sendBtn.disabled = false; 
    }
    if (mypagePhoneTimerInterval) clearInterval(mypagePhoneTimerInterval);
}

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
        const response = await apiFetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'verify_code',
                phone: cleanPhone,
                code: inputCode
            })
        });

        const result = await response.json();

        if (result.success) {
            let dbFormattedPhone = phoneRaw.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/, "$1-$2-$3");

            const success = await saveSingleField('phone', dbFormattedPhone);
            
            if (success) {
                alert("전화번호가 성공적으로 변경되었습니다.");
                document.getElementById('currentPhoneDisplay').innerText = escapeHtml(dbFormattedPhone);
                closeModal('phoneModal');
            }
        } else {
            alert("인증번호가 일치하지 않거나 만료되었습니다.");
        }
    } catch (error) {
        if (error.message !== "Auth expired") alert(error.message);
    }
}

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

function openPasswordModal() {
    document.getElementById('passwordModal').classList.remove('hidden');
}

function changePassword() {
    const oldPw = document.getElementById('currentPassword').value;
    const newPw = document.getElementById('newChangePassword').value;
    const confirmPw = document.getElementById('newChangePasswordConfirm').value;

    if (!oldPw || !newPw) { alert("모든 항목을 입력해주세요."); return; }
    if (newPw !== confirmPw) { alert("새 비밀번호가 일치하지 않습니다."); return; }
    
    // 💡 강력한 비밀번호 정규식 검사 보완
    const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!pwRegex.test(newPw)) {
        alert("비밀번호 조건을 확인해주세요.\n(영문 대/소문자, 숫자, 특수문자 포함 8자 이상)");
        document.getElementById('newChangePassword').focus();
        return;
    }

    cognitoUser.changePassword(oldPw, newPw, function(err, result) {
        if (err) {
            if (err.name === 'NotAuthorizedException') alert("현재 비밀번호가 일치하지 않습니다.");
            else alert("비밀번호 변경 실패: 정책에 맞지 않거나 오류가 발생했습니다.");
            return;
        }
        alert("비밀번호가 변경되었습니다. 안전을 위해 다시 로그인해주세요.");
        handleSignOut(); 
    });
}

// ==========================================
// [기능] 탐구 MBTI 변경
// ==========================================
let mypageMbtiDimSelections = [null, null, null, null];

function openMbtiModal() {
    mypageMbtiDimSelections = [null, null, null, null];
    document.querySelectorAll('#mbtiDimListMypage .mbti-dim-btn').forEach(b => b.classList.remove('active'));
    const preview = document.getElementById('mbtiPreviewCodeMypage');
    if (preview) preview.textContent = '? ? ? ?';
    const confirmBtn = document.getElementById('mbtiConfirmBtnMypage');
    if (confirmBtn) confirmBtn.disabled = true;
    document.getElementById('mbtiModal').classList.remove('hidden');
}

function selectMbtiDimMypage(dimIdx, letter, btnEl) {
    const row = btnEl.closest('.mbti-dim-btns');
    row.querySelectorAll('.mbti-dim-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    mypageMbtiDimSelections[dimIdx] = letter;

    const allSelected = mypageMbtiDimSelections.every(s => s !== null);
    const preview = document.getElementById('mbtiPreviewCodeMypage');
    const confirmBtn = document.getElementById('mbtiConfirmBtnMypage');
    if (preview) preview.textContent = mypageMbtiDimSelections.map(s => s || '?').join('\u00a0');
    if (confirmBtn) confirmBtn.disabled = !allSelected;
}

async function confirmMbtiDimsMypage() {
    if (mypageMbtiDimSelections.some(s => s === null)) {
        alert("4가지 항목을 모두 선택해주세요."); return;
    }
    const mbtiCode = mypageMbtiDimSelections.join('');
    const ok = await saveMbti(mbtiCode);
    if (ok) {
        const el = document.getElementById('profileMbtiDisplay');
        if (el) el.textContent = mbtiCode;
        alert(`탐구 MBTI가 ${mbtiCode}로 저장되었습니다.`);
        closeModal('mbtiModal');
    }
}

function goToMbtiTestMypage() {
    window.location.href = '/mbti_survey?from_mypage=true';
}

async function saveMbti(mbtiCode) {
    try {
        await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'update_member_info', data: { mbti: mbtiCode } })
        });
        return true;
    } catch (error) {
        if (error.message !== "Auth expired") alert("저장 중 오류가 발생했습니다.");
        return false;
    }
}

// ==========================================
// [기능] 소셜 계정 연동 / 해제
// ==========================================
async function unlinkSocial(provider) {
    if (!confirm(`${provider} 계정 연동을 해제하시겠습니까?`)) return;
    try {
        await apiFetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'unlink_social', data: { provider } })
        });
        alert(`${provider} 연동이 해제되었습니다.`);
        location.reload();
    } catch (error) {
        if (error.message !== "Auth expired") alert("연동 해제 중 오류가 발생했습니다.");
    }
}

function linkSocial(provider) {
    const social = CONFIG && CONFIG.social;
    const clientId = social && social[provider] && social[provider].clientId;
    const callbackUrl = social && social.callbackUrl;

    if (!clientId || !callbackUrl) {
        alert('소셜 연동 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.');
        return;
    }

    // auth.js와 동일한 state 형식: {nonce}|{provider}
    const stateNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    const state = `${stateNonce}|${provider}`;
    sessionStorage.setItem('socialState', state);
    sessionStorage.setItem('socialLinkMode', 'true'); // 연동 모드 플래그

    let authUrl = '';
    if (provider === 'google') {
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
            client_id: clientId, redirect_uri: callbackUrl,
            response_type: 'code', scope: 'openid email profile',
            state, access_type: 'offline', prompt: 'select_account'
        });
    } else if (provider === 'naver') {
        authUrl = `https://nid.naver.com/oauth2.0/authorize?` + new URLSearchParams({
            response_type: 'code', client_id: clientId,
            redirect_uri: callbackUrl, state
        });
    }

    if (authUrl) window.location.href = authUrl;
}

function startDeleteReauth(provider) {
    const social = CONFIG && CONFIG.social;
    const clientId = social && social[provider] && social[provider].clientId;
    const callbackUrl = social && social.callbackUrl;

    if (!clientId || !callbackUrl) {
        alert('소셜 인증 설정을 불러올 수 없습니다. 관리자에게 문의해주세요.');
        return;
    }

    const stateNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    // purpose를 state에 인코딩 → OAuth 리다이렉트 후에도 sessionStorage 소실 없이 서버가 목적 확인 가능
    const state = `${stateNonce}|${provider}|delete_reauth`;
    sessionStorage.setItem('socialState', state);

    let authUrl = '';
    if (provider === 'google') {
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
            client_id: clientId, redirect_uri: callbackUrl,
            response_type: 'code', scope: 'openid email profile',
            state, access_type: 'offline', prompt: 'select_account'
        });
    } else if (provider === 'naver') {
        authUrl = `https://nid.naver.com/oauth2.0/authorize?` + new URLSearchParams({
            response_type: 'code', client_id: clientId,
            redirect_uri: callbackUrl, state
        });
    }

    if (authUrl) window.location.href = authUrl;
}

async function handleSignOut() {
    if (cognitoUser) cognitoUser.signOut();
    if (typeof performClientLogout === 'function') {
        await performClientLogout('/login');
    } else {
        clearClientSession();
        window.location.replace('/login');
    }
}

// ==========================================
// [기능 3] 프로필 사진 관리 (일반 fetch 유지 필수)
// ==========================================
function triggerFileUpload() { document.getElementById('profileFileInput').click(); }

async function handleProfileUpload(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("파일 크기는 5MB 이하여야 합니다."); return; }

    const imgElem = document.getElementById('profileImg');
    const originalSrc = imgElem.src;
    imgElem.style.opacity = '0.5';

    try {
        // 1. Presigned URL 발급 (apiFetch 사용)
        const presignRes = await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'get_presigned_url',
                data: { fileName: file.name, fileType: file.type, folder: 'profile' }
            })
        });

        const { uploadUrl, fileUrl, fields } = await presignRes.json();

        const formData = new FormData();
        Object.entries(fields).forEach(([key, value]) => formData.append(key, value));
        formData.append('file', file);
        
        // 💡 2. S3 실제 업로드 (순수 fetch 사용)
        const s3Upload = await fetch(uploadUrl, { method: 'POST', body: formData });
        if (!s3Upload.ok) throw new Error("S3 업로드 실패");

        // 3. DB 업데이트 (apiFetch 사용)
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
        if (e.message !== "Auth expired") alert("사진 업로드 중 오류가 발생했습니다.");
        imgElem.src = originalSrc;
    } finally {
        imgElem.style.opacity = '1'; 
        input.value = '';
    }
}

async function handleProfileDelete() {
    if (!confirm("프로필 사진을 삭제하시겠습니까?")) return;
    const imgElem = document.getElementById('profileImg');
    const currentUrl = imgElem.src;

    try {
        if (!currentUrl.includes('placehold.co') && !currentUrl.includes('assets/images')) {
            await apiFetch(FILE_API_URL, {
                method: 'POST',
                body: JSON.stringify({ 
                    type: 'delete_s3_file', 
                    data: { fileUrl: currentUrl } 
                })
            });
        }
        
        await apiFetch(FILE_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                type: 'update_user_profile_image', 
                data: { profileImageUrl: "" } 
            })
        });

        imgElem.src = "https://placehold.co/150x150?text=Profile"; 
        alert("프로필 사진이 삭제되었습니다.");
        checkDeleteButtonVisibility("");

    } catch (e) { 
        if (e.message !== "Auth expired") alert("삭제 실패"); 
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

// ==========================================
// [기능 4] 회원 탈퇴
// ==========================================
function handleDeleteAccount() {
    const isSocialOnly = currentUserAuthProvider !== 'local';
    const authGroup = document.getElementById('deleteAuthGroup');
    const step1Btn = document.querySelector('#deleteStep1 .primary-btn');

    // 1단계 인증 입력 폼 동적 구성
    if (isSocialOnly) {
        const providerLabel = currentUserAuthProvider === 'google' ? 'Google' : 'Naver';
        const providerIcon = currentUserAuthProvider === 'google' ? 'fab fa-google' : 'fas fa-n';
        authGroup.innerHTML = `
            <p style="margin-bottom:14px;color:#374151;">본인 확인을 위해 <strong>${escapeHtml(providerLabel)} 계정으로 재인증</strong>이 필요합니다.</p>
            <button class="modal-action-btn" style="width:100%;" onclick="startDeleteReauth('${escapeHtml(currentUserAuthProvider)}')">
                <i class="${escapeHtml(providerIcon)}"></i>&nbsp;${escapeHtml(providerLabel)}로 본인 확인
            </button>`;
        if (step1Btn) step1Btn.style.display = 'none';
    } else {
        authGroup.innerHTML = `
            <label>본인 확인을 위해 현재 <strong>비밀번호</strong>를 입력해주세요.</label>
            <input type="password" id="deleteAuthInput" placeholder="현재 비밀번호 입력">`;
        if (step1Btn) { step1Btn.style.display = ''; step1Btn.innerText = '본인 확인'; step1Btn.disabled = false; }
    }

    // 모달 초기화: 1단계 표시, 2단계 숨김
    document.getElementById('deleteStep1').classList.remove('hidden');
    document.getElementById('deleteStep2').classList.add('hidden');
    document.getElementById('deleteConfirmText').value = '';

    document.getElementById('deleteAccountModal').classList.remove('hidden');
}

function deleteStep1Submit() {
    const isSocialOnly = currentUserAuthProvider !== 'local';
    const inputVal = document.getElementById('deleteAuthInput')?.value || '';
    const btn = document.querySelector('#deleteStep1 .primary-btn');

    if (!inputVal.trim()) {
        alert(isSocialOnly ? '이메일을 입력해주세요.' : '비밀번호를 입력해주세요.');
        return;
    }

    if (isSocialOnly) {
        // 소셜 계정: 등록된 이메일과 일치 여부 확인
        if (inputVal.trim().toLowerCase() !== currentUserEmail.toLowerCase()) {
            alert('이메일이 일치하지 않습니다. 다시 확인해주세요.');
            return;
        }
        _proceedToDeleteStep2();
    } else {
        // 로컬 계정: Cognito 비밀번호 인증
        if (!cognitoUser) {
            alert('유저 세션이 만료되었습니다. 다시 로그인해주세요.');
            window.location.href = '/login';
            return;
        }

        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 확인 중...`;
        btn.disabled = true;

        const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: cognitoUser.getUsername(),
            Password: inputVal
        });

        cognitoUser.authenticateUser(authDetails, {
            onSuccess: function () {
                _proceedToDeleteStep2();
            },
            onFailure: function () {
                alert('비밀번호가 일치하지 않습니다. 다시 확인해주세요.');
                btn.innerText = '본인 확인';
                btn.disabled = false;
            }
        });
    }
}

function _proceedToDeleteStep2() {
    document.getElementById('deleteStep1').classList.add('hidden');
    document.getElementById('deleteStep2').classList.remove('hidden');
    document.getElementById('deleteConfirmText').value = '';
    document.getElementById('deleteConfirmText').focus();

    const step2Btn = document.querySelector('#deleteStep2 .danger-btn');
    if (step2Btn) { step2Btn.innerText = '탈퇴하기'; step2Btn.disabled = false; }
}

function deleteStep2Submit() {
    const confirmText = document.getElementById('deleteConfirmText').value;
    if (confirmText !== '회원 탈퇴') {
        alert("'회원 탈퇴'를 정확히 입력해주세요.");
        return;
    }

    const btn = document.querySelector('#deleteStep2 .danger-btn');
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 데이터 삭제 중...`;
    btn.disabled = true;
    processBackendDeletion();
}

async function processBackendDeletion() {
    // 소셜 계정 탈퇴 시 재인증으로 발급된 deleteConfirmToken 첨부 (5분 이내 사용)
    const deleteConfirmToken = sessionStorage.getItem('deleteConfirmToken') || null;
    sessionStorage.removeItem('deleteConfirmToken');

    try {
        await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'delete_user', ...(deleteConfirmToken && { deleteConfirmToken }) })
        });

        alert("회원 탈퇴가 정상적으로 완료되었습니다. 그동안 스터디크랙을 이용해 주셔서 감사합니다.");
        clearClientSession();
        window.location.href = '/';
    } catch (error) {
        if (error.message !== "Auth expired") alert("서버 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        const btn = document.querySelector('#deleteStep2 .danger-btn');
        if (btn) { btn.innerText = '탈퇴하기'; btn.disabled = false; }
    }
}

// ==========================================
// [기능 5] 튜터 프로필 보기 버튼 제어
// ==========================================
function checkTutorButtonVisibility(tier) {
    const btnContainer = document.getElementById('tutorBtnContainer');
    if (!btnContainer) return;

    const allowedTiers = ['standard', 'pro', 'black']; 
    
    if (allowedTiers.includes(tier) && currentTutorData) {
        btnContainer.classList.remove('hidden'); 
    } else {
        btnContainer.classList.add('hidden'); 
    }
}

function setupUI() {
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.add('hidden');
        }
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            handleSignOut();
        });
    }
}

// ==========================================
// [기능 6] 튜터 모달 열기 
// ==========================================
function openTutorModal() {
    if (!currentTutorData) {
        alert("튜터 정보가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
        return;
    }
    
    const tutor = currentTutorData;

    const setContext = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.innerText = text || '-';
    };

    setContext('tutorNickname', tutor.nickname);
    
    const schoolInfo = [tutor.school, tutor.major].filter(Boolean).join(' ');
    setContext('tutorSchoolMajor', schoolInfo || '학교 정보 없음');

    setContext('tutorStrengths', tutor.strengths);
    
    const msgEl = document.getElementById('tutorMessage');
    if (msgEl) msgEl.innerText = tutor.message ? `"${tutor.message}"` : '"함께 목표를 달성해봅시다!"';

    const imgEl = document.getElementById('tutorProfileImg');
    if (imgEl) {
        imgEl.src = tutor.profileImage ? escapeHtml(tutor.profileImage) : 'assets/images/sample_profile.png';
    }

    const modal = document.getElementById('tutorModal');
    if (modal) modal.classList.remove('hidden');
}
