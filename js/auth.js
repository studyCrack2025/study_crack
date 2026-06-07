// js/auth.js

// ==========================================
// [메모리 저장소] accessToken - XSS 탈취 방지
// ==========================================
let _accessToken = sessionStorage.getItem('accessToken') || null;
function getAccessToken() { return _accessToken; }
function setAccessToken(token) {
    _accessToken = token;
    if (token) sessionStorage.setItem('accessToken', token);
    else sessionStorage.removeItem('accessToken');
}
function clearAccessToken() {
    _accessToken = null;
    sessionStorage.removeItem('accessToken');
}

// ==========================================
// [메모리 저장소] idToken - XSS 탈취 방지
// ==========================================
let _idToken = sessionStorage.getItem('idToken') || null;
function getIdToken() { return _idToken; }
function setIdToken(token) {
    _idToken = token;
    if (token) sessionStorage.setItem('idToken', token);
    else sessionStorage.removeItem('idToken');
}
function clearIdToken() {
    _idToken = null;
    sessionStorage.removeItem('idToken');
}

// API URL 변경 (Gateway 사용)
const USER_API_URL = CONFIG.api.user;
const AUTH_URL = CONFIG.api.auth;

const poolData = {
    UserPoolId: CONFIG.cognito.userPoolId,
    ClientId: CONFIG.cognito.clientId
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

const POST_LOGIN_IDENTITY_SKIP_KEY = 'post_login_identity_skip_until';
const POST_LOGIN_IDENTITY_SKIP_MS = 20000;

// 전역 변수
let isPhoneVerified = false; 
let isEmailVerified = false;

function markPostLoginIdentitySkip(ttlMs = POST_LOGIN_IDENTITY_SKIP_MS) {
    const until = Date.now() + ttlMs;
    sessionStorage.setItem(POST_LOGIN_IDENTITY_SKIP_KEY, String(until));
}

function shouldSkipPostLoginIdentityResolve() {
    const raw = sessionStorage.getItem(POST_LOGIN_IDENTITY_SKIP_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) {
        sessionStorage.removeItem(POST_LOGIN_IDENTITY_SKIP_KEY);
        return false;
    }
    if (Date.now() > until) {
        sessionStorage.removeItem(POST_LOGIN_IDENTITY_SKIP_KEY);
        return false;
    }
    return true;
}

// isPublicRoute / getRoleLoginPath / tryRefreshToken / apiFetch 는 js/shared/api.js 에 정의됨.
// auth.js 는 그 위에서 동작 — 중복 정의 제거.

async function registerRefreshCookie(refreshToken) {
    // LOCAL: cross-site SameSite=Lax 쿠키가 후속 요청에 안 실리므로 쿠키 등록 의미 없음.
    // refreshToken을 localStorage에만 보관해 tryRefreshToken의 body 기반 refresh 경로로 위임. (active/260603 §Phase 1)
    if (IS_LOCAL) {
        localStorage.setItem('refreshToken', refreshToken);
        return false;
    }
    try {
        const cookieRes = await fetch(AUTH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'register_refresh_cookie', refreshToken })
        });
        if (cookieRes.ok) {
            const cookieData = await cookieRes.json().catch(() => ({}));
            if (typeof syncTokensFromAuthResponse === 'function') {
                const synced = syncTokensFromAuthResponse(cookieData);
                if (!synced && (cookieData.accessToken || cookieData.idToken || cookieData.userId)) {
                    return false;
                }
            }
            localStorage.removeItem('refreshToken');
            return true;
        }
    } catch (e) {
        // noop: fallback below
    }
    localStorage.setItem('refreshToken', refreshToken);
    return false;
}

// tryRefreshToken / apiFetch 본문은 js/shared/api.js 로 이관됨.
// auth.js 의 _accessToken/_idToken 메모리 토큰은 그대로 유지 — sessionStorage 와 동기화되므로 shared의 apiFetch도 동일한 토큰을 읽음.

// JWT 토큰을 브라우저에서 안전하게 해독하는 헬퍼 함수
function getPayloadFromToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')));
    } catch (e) {
        return {};
    }
}

// 분리된 DB 구조에 맞춘 스마트 권한 식별 함수
async function resolveUserIdentity(eventType = 'none', promoCode = '', options = {}) {
    if (!localStorage.getItem('userId')) return;

    try {
        const headers = { 'Content-Type': 'application/json' };
        const bearerToken = options.accessToken || getAccessToken();
        if (bearerToken) {
            headers.Authorization = `Bearer ${bearerToken}`;
        }

        // 401/403 시 refresh+retry. 401 즉시 sign-out 방지가 목적. 정책: docs/security/architecture-notes.md §3
        const fetchIdentity = async (requestType) => {
            const doFetch = () => fetch(USER_API_URL, {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({ type: requestType })
            });
            let res = await doFetch();
            // 401/403 처리 정책: docs/security/architecture-notes.md §3
            if (res.status === 401 || res.status === 403) {
                const refreshed = await tryRefreshToken();
                if (refreshed) {
                    const refreshedBearerToken = getAccessToken();
                    if (refreshedBearerToken) {
                        headers.Authorization = `Bearer ${refreshedBearerToken}`;
                    } else {
                        delete headers.Authorization;
                    }
                    res = await doFetch();
                }
            }
            return res;
        };

        const profileMode = sessionStorage.getItem('user_profile_api_mode');
        const shouldUseLegacy = profileMode === 'legacy';
        let userRes = shouldUseLegacy ? await fetchIdentity('get_user') : await fetchIdentity('get_login_profile');

        // 백엔드 배포 이전/호환 구간 대비: 경량 타입 미지원 시 기존 get_user 폴백
        if (!userRes.ok && !shouldUseLegacy) {
            const unsupportedLightApi = (userRes.status === 400 || userRes.status === 404);
            const fallbackRes = await fetchIdentity('get_user');
            if (fallbackRes.ok && unsupportedLightApi) {
                sessionStorage.setItem('user_profile_api_mode', 'legacy');
            }
            userRes = fallbackRes;
        } else if (userRes.ok && !shouldUseLegacy) {
            sessionStorage.setItem('user_profile_api_mode', 'light');
        }

        if (userRes.status === 401 || userRes.status === 403) {
            throw new Error("Auth expired");
        }

        if (userRes.ok) {
            const data = await userRes.json();
            const role = data.role || 'student';
            const userName = data.name || (role === 'admin' ? '관리자' : role === 'tutor' ? '선생님' : '학생');
            localStorage.setItem('userName', userName);
            if (data.computedTier) localStorage.setItem('userTier', data.computedTier);

            // 학생만 튜토리얼 체크
            if (role === 'student') {
                const tutorialDone = data.tutorialRewardClaimed === true
                    || data.computedTier === 'standard' || data.computedTier === 'pro' || data.computedTier === 'trial';
                if (tutorialDone) {
                    localStorage.setItem('tutorial_completed', 'true');
                } else {
                    localStorage.removeItem('tutorial_completed');
                    const exemptPaths = ['/tutorial', '/login', '/signup', '/welcome', '/social-callback', '/mbti_survey', '/mbti_download', '/checkout', '/success'];
                    const currentPath = window.location.pathname;
                    if (!exemptPaths.some(p => currentPath.startsWith(p))) {
                        alert('튜토리얼이 완료되지 않아 튜토리얼 페이지로 이동합니다.');
                        window.location.replace('/tutorial');
                        return;
                    }
                }
            }

            if (options.waitFor && typeof options.waitFor.then === 'function') {
                try { await options.waitFor; } catch (e) { /* noop */ }
            }
            handleRoleSuccess(role, eventType, userName, promoCode);
        } else {
            throw new Error("계정 정보를 데이터베이스에서 찾을 수 없습니다.");
        }

    } catch (error) {
        console.error("Identity Resolve Error:", error);
        if (eventType === 'none' && String(error?.message || '').includes('Auth expired')) {
            clearClientSession();
            const currentPath = window.location.pathname || '/';
            if (!isPublicRoute(currentPath)) {
                window.location.replace(getRoleLoginPath());
            } else {
                checkLoginStatus();
            }
            return;
        }
        if (eventType === 'login' || eventType === 'signup') {
            alert("회원 정보 연동에 실패했습니다. 관리자에게 문의해주세요.");
            handleSignOut(true); 
        } else {
            // 백그라운드 신원 동기화 실패(일시적 5xx/네트워크)에서는 즉시 로그아웃하지 않음
            console.warn("Session identity sync skipped:", error?.message || error);
        }
    }
}

// 식별 성공 시 라우팅을 담당하는 후처리 함수
function handleRoleSuccess(role, eventType, userName = '회원', promoCode = '') {
    const currentLocalRole = localStorage.getItem('userRole');

    // 관리자 로그인 차단
    if (eventType === 'login' && role === 'admin') {
        alert("보안 정책에 따라 관리자는 일반 로그인 페이지를 사용할 수 없습니다.\n관리자 전용 로그인 페이지를 이용해주세요.");
        handleSignOut(true);
        window.location.href = '/';
        return;
    }

    // 튜터 로그인 차단 — 공용 /login(handleSignIn)으로 들어온 튜터는 전용 페이지로 유도.
    // (튜터 전용 /tutor/login은 handleTutorSignIn을 쓰며 handleRoleSuccess를 거치지 않으므로 영향 없음)
    if (eventType === 'login' && role === 'tutor') {
        alert("튜터 회원은 튜터 전용 로그인 페이지를 이용해주세요.");
        handleSignOut(true);
        window.location.href = '/tutor/login';
        return;
    }

    // 백그라운드 새로고침 시
    if (eventType === 'none') {
        if (currentLocalRole !== role) {
            console.warn("Security Event: LocalStorage role mismatch detected. Correcting...");
            localStorage.setItem('userRole', role);
            window.location.href = window.location.pathname; 
        }
        return;
    }

    localStorage.setItem('userRole', role);

    if (eventType === 'signup') {
        if (role === 'tutor') {
            alert(`${userName} 선생님, 가입이 완료되었습니다!`);
            window.location.href = '/mypage/tutor'; // 튜터는 가입 후 튜터 전용 페이지로
        } else {
            // 학생은 웰컴 페이지로, 프로모 코드가 있다면 쿼리 파라미터 포함
            if (promoCode) {
                window.location.href = `/welcome?promo=${encodeURIComponent(promoCode)}`;
            } else {
                window.location.href = '/welcome';
            }
        }
        return;
    }

    if (eventType === 'login') {
        if (role === 'tutor') {
            alert(`${userName} 선생님, 안녕하세요.`);
            window.location.replace('/mypage/tutor');
        } else {
            alert("로그인 성공!");
            // 튜토리얼 미완료 학생은 /tutorial로 직행
            if (localStorage.getItem('tutorial_completed') !== 'true') {
                window.location.replace('/tutorial');
            } else {
                window.location.replace('/');
            }
        }
    }
}

// 💡 XSS 방지용 이스케이프 함수
function escapeHtml(text) {
    if (text == null) return ""; 
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// [Part A] 초기화 및 유틸리티
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    
    const pwInput = document.getElementById('password');
    const pwConfirmInput = document.getElementById('passwordConfirm');
    if(pwInput && pwConfirmInput) {
        pwInput.addEventListener('input', checkPasswordMatch);
        pwConfirmInput.addEventListener('input', checkPasswordMatch);
    }
    
    const emailInput = document.getElementById('email');
    if (emailInput && pwInput) {
        // 튜터 전용 로그인 페이지에서는 Enter가 handleTutorSignIn(역할 검증 포함)을 호출.
        const isTutorLogin = (document.body && document.body.dataset && document.body.dataset.authPage === 'tutor-login')
            || (window.location.pathname || '').startsWith('/tutor/login');
        const triggerSignIn = (e) => { if (e.key === 'Enter') (isTutorLogin ? handleTutorSignIn() : handleSignIn()); };
        emailInput.addEventListener('keypress', triggerSignIn);
        pwInput.addEventListener('keypress', triggerSignIn);
    }
    
    const findEmailName = document.getElementById('findEmailName');
    const findEmailPhone = document.getElementById('findEmailPhone');
    if (findEmailName && findEmailPhone) {
        const triggerFindEmail = (e) => { if (e.key === 'Enter') handleFindEmail(); };
        findEmailName.addEventListener('keypress', triggerFindEmail);
        findEmailPhone.addEventListener('keypress', triggerFindEmail);
    }

    const forgotPwEmail = document.getElementById('forgotPwEmail');
    if (forgotPwEmail) {
        forgotPwEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') requestPasswordReset();
        });
    }
    
    const forgotPwCode = document.getElementById('forgotPwCode');
    const forgotPwNew = document.getElementById('forgotPwNew');
    const forgotPwConfirm = document.getElementById('forgotPwConfirm');
    if (forgotPwCode && forgotPwNew && forgotPwConfirm) {
        const triggerConfirmReset = (e) => { if (e.key === 'Enter') confirmPasswordReset(); };
        forgotPwCode.addEventListener('keypress', triggerConfirmReset);
        forgotPwNew.addEventListener('keypress', triggerConfirmReset);
        forgotPwConfirm.addEventListener('keypress', triggerConfirmReset);
    }

    const chkAll = document.getElementById('chkAll');
    const chkRequired = document.querySelectorAll('.chk-required');
    const chkOptional = document.querySelectorAll('.chk-optional');

    if (chkAll) {
        chkAll.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            chkRequired.forEach(chk => { chk.checked = isChecked; });
            chkOptional.forEach(chk => { chk.checked = isChecked; });
            updateSubmitButton(); 
        });
    }

    const updateChkAllState = () => {
        const allRequiredChecked = Array.from(chkRequired).every(c => c.checked);
        const allOptionalChecked = Array.from(chkOptional).every(c => c.checked);
        if (chkAll) chkAll.checked = allRequiredChecked && allOptionalChecked;
        updateSubmitButton(); 
    };

    chkRequired.forEach(chk => chk.addEventListener('change', updateChkAllState));
    chkOptional.forEach(chk => chk.addEventListener('change', updateChkAllState));

    const urlParams = new URLSearchParams(window.location.search);
    const promoParam = urlParams.get('promo');
    
    if (promoParam) {
        const promoInput = document.getElementById('promoCode');
        if (promoInput) {
            promoInput.value = promoParam;
            promoInput.readOnly = true; 
            promoInput.style.backgroundColor = '#f1f5f9'; 
        }
    }

    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeAuthModal(event.target.id);
        }
    });
});

window.openTermModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
};

window.closeTermModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
};

function toggleEtc(type, isShow) {
    let inputId = type === 'major' ? 'majorEtc' : 'referralEtc';
    const etcInput = document.getElementById(inputId);
    if (isShow) {
        etcInput.classList.remove('hidden');
        etcInput.required = true;
    } else {
        etcInput.classList.add('hidden');
        etcInput.required = false;
        etcInput.value = ""; 
    }
}

function checkPasswordMatch() {
    const pw = document.getElementById('password').value;
    const confirm = document.getElementById('passwordConfirm').value;
    const msgBox = document.getElementById('pwMsg');

    if (!confirm) { msgBox.innerHTML = ""; return; }
    
    if (pw === confirm) {
        msgBox.innerHTML = "<span class='text-success'>비밀번호가 일치합니다.</span>";
    } else {
        msgBox.innerHTML = "<span class='text-error'>비밀번호가 일치하지 않습니다.</span>";
    }
}

function getErrorMessage(err) {
    switch (err.code) {
        case "NotAuthorizedException": 
        case "UserNotFoundException":  
            return "이메일 혹은 비밀번호가 정확하지 않습니다.";
        case "UsernameExistsException": return "이미 가입된 이메일입니다.";
        case "InvalidParameterException": return "입력 정보가 올바르지 않습니다.";
        case "InvalidPasswordException": 
            return "비밀번호는 영문 대/소문자, 숫자, 특수문자를 각각 최소 1개 이상 포함하여 8자 이상으로 설정해야 합니다.";
        case "CodeMismatchException": return "인증 코드가 일치하지 않습니다.";
        case "LimitExceededException": return "요청 횟수 초과. 잠시 후 시도하세요.";
        case "UserNotConfirmedException": return "이메일 인증이 완료되지 않은 계정입니다.";
        default: return "알 수 없는 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (" + (err.code || "") + ")";
    }
}

function updateSubmitButton() {
    const btn = document.getElementById('finalSubmitBtn');
    if(!btn) return; 

    const chkRequired = document.querySelectorAll('.chk-required');
    let allTermsChecked = true;
    if (chkRequired.length > 0) {
        allTermsChecked = Array.from(chkRequired).every(c => c.checked);
    }

    if (isEmailVerified && isPhoneVerified && allTermsChecked) {
        btn.disabled = false;
        btn.style.backgroundColor = "#2563EB";
        btn.innerText = "회원가입 완료";
    } else {
        btn.disabled = true;
        btn.style.backgroundColor = "#ccc";
        if (!isEmailVerified) btn.innerText = "이메일 인증을 완료해주세요";
        else if (!isPhoneVerified) btn.innerText = "전화번호 인증을 완료해주세요";
        else if (!allTermsChecked) btn.innerText = "필수 약관에 모두 동의해주세요";
    }
}

// ==========================================
// [Part B] 이메일 인증 (Cognito)
// ==========================================
let emailTimerInterval;

async function handleSendCode() {
    const email = document.getElementById('email').value;
    if (!email) { alert("이메일을 입력해주세요."); return; }

    const sendBtn = document.getElementById('sendCodeBtn');
    sendBtn.innerText = "전송 중...";
    sendBtn.disabled = true;

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'send_email_auth', email: email })
        });

        if (!response.ok) throw new Error("발송 실패");
        
        alert("이메일로 인증번호가 발송되었습니다.");
        document.getElementById('verifySection').classList.remove('hidden');
        startTimer(5 * 60, 'timer', emailTimerInterval);
    } catch (e) {
        alert("이메일 발송에 실패했습니다.");
    } finally {
        sendBtn.innerText = "재전송";
        sendBtn.disabled = false;
    }
}

async function handleVerify() {
    const email = document.getElementById('email').value;
    const code = document.getElementById('verifyCode').value;

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'verify_code', email: email, code: code })
        });
        const result = await response.json();

        if (result.success) {
            alert("이메일 인증 성공!");
            isEmailVerified = true;
            document.getElementById('verifySection').innerHTML = "<p class='text-success'>✅ 이메일 인증 완료</p>";
            document.getElementById('email').disabled = true;
            updateSubmitButton();
        } else {
            alert("인증번호가 일치하지 않습니다.");
        }
    } catch (e) { alert("확인 중 오류 발생"); }
}

// ==========================================
// [Part C] 전화번호 인증 (Lambda)
// ==========================================
let phoneTimerInterval;

async function handleSendPhoneCode() {
    let phone = document.getElementById('phone').value;
    
    if (!phone) { alert("전화번호를 입력해주세요."); return; }

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
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'send_sms_auth', phone: cleanPhone })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || "SMS 발송 실패");
        }
        
        alert(`인증번호가 발송되었습니다. 5분 이내에 입력해주세요.`);
        document.getElementById('phoneVerifySection').classList.remove('hidden');
        btn.innerText = "재전송";
        btn.disabled = false;
        document.getElementById('phone').disabled = true;

        startTimer(5 * 60, 'phoneTimer', phoneTimerInterval);

    } catch (error) {
        console.error(error);
        alert("인증번호 발송에 실패했습니다. (관리자에게 문의하세요)");
        btn.innerText = "인증번호 전송";
        btn.disabled = false;
    }
}

async function handleVerifyPhone() {
    let phone = document.getElementById('phone').value.replace(/-/g, '').trim();
    
    if (phone.startsWith('010')) {
        phone = '+82' + phone.substring(1);
    } else if (phone.startsWith('10')) {
        phone = '+82' + phone;
    }

    const inputCode = document.getElementById('phoneVerifyCode').value;
    if (!inputCode) { alert("인증코드를 입력해주세요."); return; }

    try {
        const response = await fetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'verify_code', 
                phone: phone,          
                code: inputCode
            })
        });

        const result = await response.json();

        if (result.success) {
            alert("전화번호 인증이 완료되었습니다.");
            document.getElementById('phoneVerifySection').innerHTML = "<p class='text-success'>✅ 전화번호 인증 완료</p>";
            isPhoneVerified = true;
            updateSubmitButton();
        } else {
            alert("인증번호가 일치하지 않거나 만료되었습니다.");
        }
    } catch (error) {
        alert("인증 확인 중 오류가 발생했습니다.");
    }
}

// ==========================================
// [Part D] 타이머
// ==========================================

function startTimer(duration, displayId, intervalVar) {
    let timer = duration, minutes, seconds;
    const display = document.getElementById(displayId);
    
    if (displayId === 'timer') clearInterval(emailTimerInterval);
    else clearInterval(phoneTimerInterval);

    const interval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        display.textContent = minutes + ":" + seconds;

        if (--timer < 0) {
            clearInterval(interval);
            display.textContent = "00:00";
            alert("인증 시간이 만료되었습니다. 재전송 버튼을 눌러주세요.");
        }
    }, 1000);

    if (displayId === 'timer') emailTimerInterval = interval;
    else phoneTimerInterval = interval;
}

// ==========================================
// [Part E] 최종 회원가입
// ==========================================

// ------------------------------------------
// [공유] 가입 자동 로그인 — 학생/튜터 공통
// 가입 직후 Cognito 인증 → 토큰 set → rt 쿠키 등록 → resolveUserIdentity('signup').
// 최종 역할/라우팅(/welcome vs /mypage/tutor)은 resolveUserIdentity→handleRoleSuccess가
// DB role 기준으로 결정한다. 여기서 userRole을 하드코딩하지 않는다(역할 혼선 방지).
// ------------------------------------------
function autoLoginAfterSignup(email, password, { promoCode = '', loginPathOnFail = '/login' } = {}) {
    const authData = { Username: email, Password: password };
    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);
    const cognitoUserToAuth = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });

    cognitoUserToAuth.authenticateUser(authDetails, {
        onSuccess: async function(authResult) {
            const refreshToken = authResult.getRefreshToken().getToken();
            setAccessToken(authResult.getAccessToken().getJwtToken());
            setIdToken(authResult.getIdToken().getJwtToken());
            localStorage.setItem('userId', authResult.getIdToken().payload.sub);
            localStorage.setItem('userEmail', email);

            // refreshToken 쿠키 등록과 identity 조회를 병렬화해 가입 직후 대기 시간을 줄임
            const cookiePromise = registerRefreshCookie(refreshToken);
            markPostLoginIdentitySkip();

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({ event: "login", user_id: authResult.getIdToken().payload.sub });

            resolveUserIdentity('signup', promoCode, {
                accessToken: getAccessToken(),
                waitFor: cookiePromise
            });
        },
        onFailure: function(err) {
            console.error("Auto Login Failed:", err);
            alert("가입은 완료되었으나 자동 로그인에 실패했습니다. 로그인 창으로 이동합니다.");
            window.location.href = loginPathOnFail;
        }
    });
}

// ------------------------------------------
// [공유] 회원가입 완료 — 학생/튜터 공통
// signUp → update_profile(역할은 서버가 promoCode로 결정) → 자동 로그인.
// 호출부는 attributeList/profileData/promoCode와 onError(버튼 복구 등)만 주입한다.
// onError(err, ctx): ctx.afterAccountCreated=true면 계정 생성 후 단계(update_profile/통신) 실패.
// ------------------------------------------
function completeSignUp({ email, password, attributeList, profileData, promoCode = '', loginPathOnFail = '/login', onError }) {
    userPool.signUp(email, password, attributeList, null, async function(err, result) {
        if (err) {
            if (typeof onError === 'function') onError(err, { afterAccountCreated: false });
            return;
        }

        const userSub = result.userSub;

        try {
            const response = await fetch(AUTH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'update_profile', userId: userSub, data: profileData })
            });

            if (!response.ok) throw new Error("계정 승인 및 DB 저장 실패");

            autoLoginAfterSignup(email, password, { promoCode, loginPathOnFail });
        } catch (error) {
            console.error(error);
            if (typeof onError === 'function') onError(error, { afterAccountCreated: true });
        }
    });
}

async function handleFinalSubmit() {
    if (!isEmailVerified || !isPhoneVerified) {
        alert("이메일과 전화번호 인증을 모두 완료해주세요.");
        return;
    }
    
    const chkRequired = document.querySelectorAll('.chk-required');
    const allTermsAgreed = Array.from(chkRequired).every(chk => chk.checked);

    if (!allTermsAgreed) {
        alert("모든 필수 약관에 동의하셔야 가입이 가능합니다.");
        return;
    }

    // 앞뒤 공백 제거로 불필요한 입력 오류 방지
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('passwordConfirm').value;
    const name = document.getElementById('name').value.trim();
    const gender = document.getElementById('gender').value;
    const birthdate = document.getElementById('birthdate').value;
    const phoneRaw = document.getElementById('phone').value;
    
    const chkMarketingEl = document.getElementById('chkMarketing');
    const marketingAgreed = chkMarketingEl ? chkMarketingEl.checked : false;
    const promoCode = document.getElementById('promoCode') ? document.getElementById('promoCode').value.trim() : "";

    const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!pwRegex.test(password)) {
        alert("비밀번호 조건을 확인해주세요.\n(영문 대/소문자, 숫자, 특수문자 포함 8자 이상)");
        document.getElementById('password').focus();
        return;
    }
    
    if (password !== passwordConfirm) {
        alert("비밀번호가 일치하지 않습니다.");
        return;
    }

    const referralRadio = document.querySelector('input[name="referral"]:checked');

    if (!referralRadio) {
        alert("가입 경로를 선택해주세요.");
        return;
    }

    let referral = referralRadio.value;
    if (referral === 'etc') referral = document.getElementById('referralEtc').value.trim();

    let onlyNumbers = phoneRaw.replace(/[^0-9]/g, ''); 

    let cleanPhone = onlyNumbers.startsWith('010') ? '+82' + onlyNumbers.substring(1) : '+82' + onlyNumbers;
    let dbFormattedPhone = onlyNumbers.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/, "$1-$2-$3");

    const attributeList = [
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'gender', Value: gender }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'given_name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name', Value: name }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'phone_number', Value: cleanPhone }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
        new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'birthdate', Value: birthdate })
    ];

    const submitBtn = document.getElementById('finalSubmitBtn');
    submitBtn.innerText = "가입 처리 중...";
    submitBtn.disabled = true;

    // 가입 공통 코어 사용 — signUp→update_profile→자동로그인. 역할은 서버가 promoCode로 결정.
    const profileData = {
        name: name,
        email: email,
        phone: dbFormattedPhone,
        cognitoPhone: cleanPhone,
        promoCode: promoCode,
        referral: referral,
        gender: gender,
        birthdate: birthdate,
        termsAgreed: true,
        marketingAgreed: marketingAgreed
    };

    completeSignUp({
        email, password, attributeList, profileData, promoCode,
        loginPathOnFail: '/login',
        onError: (err, ctx) => {
            if (ctx && ctx.afterAccountCreated) {
                alert("계정은 생성되었으나 서버 통신 지연으로 활성화에 실패했습니다. 관리자에게 문의하세요.");
                submitBtn.innerText = "다시 시도하기";
            } else {
                alert(getErrorMessage(err));
                submitBtn.innerText = "회원가입 완료";
            }
            submitBtn.disabled = false;
        }
    });
}

// ==========================================
// [Part F] 로그인 및 로그아웃
// ==========================================

function clearClientSession() {
    // 메모리 토큰 정리 — sessionStorage.removeItem도 같이 수행
    clearAccessToken();
    clearIdToken();
    // 추가로 auth.js 만 다루는 잔존 키
    ['tut_selectedUnivs'].forEach(key => localStorage.removeItem(key));
    // 공통 allowlist 정리는 shared 모듈 위임 — checkoutData 등 보존 정책 일관 적용
    if (typeof clearSharedClientSession === 'function') {
        clearSharedClientSession();
    } else {
        // shared/api.js 미로드 페이지를 위한 fallback (현재 모든 페이지가 로드하므로 도달 안 함)
        ['refreshToken','userId','userEmail','userRole','userName','userTier','authProvider','accessToken','token',
         'tutorialStatus','pending_tutorial','tutorial_completed','tutorNameAlias']
            .forEach(k => localStorage.removeItem(k));
        sessionStorage.clear();
    }
}

function checkLoginStatus() {
    const isLoggedIn = !!localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');

    const loginBtn = document.getElementById('loginBtn');
    const myPageBtn = document.getElementById('myPageBtn');
    const adminBtn = document.getElementById('adminBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginBtn && logoutBtn) {
        if (isLoggedIn) {
            loginBtn.classList.add('hidden');
            logoutBtn.classList.remove('hidden');
            if (userRole === 'student') {
                if(myPageBtn) myPageBtn.classList.remove('hidden');
                if(adminBtn) adminBtn.classList.add('hidden');
            } else {
                if(myPageBtn) myPageBtn.classList.add('hidden');
                if(adminBtn) adminBtn.classList.remove('hidden');
            }
        } else {
            loginBtn.classList.remove('hidden');
            if(myPageBtn) myPageBtn.classList.add('hidden');
            if(adminBtn) adminBtn.classList.add('hidden');
            logoutBtn.classList.add('hidden');
        }
    }

    // 모바일 햄버거 패널 링크 동기화
    const mobileLoginBtn  = document.getElementById('mobileLoginBtn');
    const mobileMyPageBtn = document.getElementById('mobileMyPageBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');
    const mobileNavAnalysis = document.getElementById('mobileNavAnalysis');
    const mobileNavQna      = document.getElementById('mobileNavQna');
    if (mobileLoginBtn && mobileLogoutBtn) {
        if (isLoggedIn) {
            mobileLoginBtn.classList.add('hidden');
            mobileLogoutBtn.classList.remove('hidden');
            if (mobileMyPageBtn) mobileMyPageBtn.classList.remove('hidden');
            if (mobileNavAnalysis) mobileNavAnalysis.classList.remove('hidden');
            if (mobileNavQna) mobileNavQna.classList.remove('hidden');
        } else {
            mobileLoginBtn.classList.remove('hidden');
            mobileLogoutBtn.classList.add('hidden');
            if (mobileMyPageBtn) mobileMyPageBtn.classList.add('hidden');
            if (mobileNavAnalysis) mobileNavAnalysis.classList.add('hidden');
            if (mobileNavQna) mobileNavQna.classList.add('hidden');
        }
    }

    if (isLoggedIn) {
        const currentPath = window.location.pathname || '';
        const isAdminRoute = (currentPath === '/admin' || currentPath.startsWith('/admin/'));
        if (isAdminRoute && userRole === 'admin') return;
        if (shouldSkipPostLoginIdentityResolve()) return;
        // 튜토리얼 미완료 학생 → resolveUserIdentity에서 DB 확인 후 판단
        // (tutorial_completed가 없어도 즉시 리다이렉트하지 않고, DB의 tutorialRewardClaimed을 먼저 확인)
        resolveUserIdentity('none');
    }
}

async function handleSignOut(silent = false) {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser != null) cognitoUser.signOut();
    const redirectPath = getRoleLoginPath();

    // 백엔드 쿠키 삭제 응답을 반드시 기다림 — 안 그러면 다음 로그인 시 이전 at 쿠키 잔존 위험
    if (typeof clearServerSessionCookies === 'function') {
        await clearServerSessionCookies();
    } else {
        try {
            await fetch(AUTH_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type: 'logout' })
            });
        } catch (_) { /* 네트워크 실패해도 클라이언트 정리는 진행 */ }
    }

    clearClientSession();

    if (!silent) alert("로그아웃 되었습니다.");
    window.location.replace(redirectPath);
}

function handleSignIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert("이메일과 비밀번호를 입력해주세요.");
        return;
    }

    // 계정 전환 안전 — 이전 사용자의 cognito SDK 세션 + 클라이언트 상태 사전 제거.
    // (admin_login.html과 동일 패턴. 상세: docs/security/architecture-notes.md §4)
    const prevCognitoUser = userPool.getCurrentUser();
    if (prevCognitoUser) prevCognitoUser.signOut();
    clearClientSession();

    const authData = { Username: email, Password: password };
    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails(authData);
    const userData = { Username: email, Pool: userPool };
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUser.authenticateUser(authDetails, {
        onSuccess: async function(result) {
            const accessToken = result.getAccessToken().getJwtToken();
            const idToken = result.getIdToken();
            const userId = idToken.payload.sub;
            const refreshToken = result.getRefreshToken().getToken();

            // 1. 이전 at/rt 쿠키 명시적 제거 — 새 토큰 set 직전 동기화
            if (typeof clearServerSessionCookies === 'function') {
                await clearServerSessionCookies();
            } else {
                try {
                    await fetch(AUTH_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ type: 'logout' })
                    });
                } catch (_) { /* 다음 단계가 덮어쓰므로 치명적이지 않음 */ }
            }

            // 2. 새 토큰 메모리/sessionStorage 저장
            setAccessToken(accessToken);
            setIdToken(idToken.getJwtToken());
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userId', userId);

            // 3. rt 쿠키 등록과 신원 조회(get_login_profile)를 병렬화 — 직렬 왕복 1회 제거.
            //    signup(autoLoginAfterSignup)과 동일 패턴: register는 await하지 않고 waitFor로 넘겨,
            //    get_login_profile은 Bearer로 즉시 진행하되 라우팅 직전에 쿠키 등록 완료를 보장한다.
            //    (logout은 쿠키 교차오염 방지 위해 직렬 유지 — 병렬화 금지)
            const cookiePromise = registerRefreshCookie(refreshToken);

            markPostLoginIdentitySkip();

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({ event: "login", user_id: userId });

            resolveUserIdentity('login', '', { accessToken, waitFor: cookiePromise });
        },
        onFailure: function(err) {
            alert(getErrorMessage(err));
        }
    });
}

// ==========================================
// [Part F-2] 튜터 전용 로그인
// 관리자(admin_login)는 cognito:groups로 역할을 판정하지만, 튜터 역할은 DynamoDB(TBL_TUTORS)에
// 있으므로 get_login_profile로 role을 확인해 튜터만 통과시킨다.
// 비튜터(학생/관리자/미확인)는 방금 발급한 세션을 정리하고 알맞은 로그인 페이지로 돌려보낸다.
// ==========================================
function handleTutorSignIn() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert("이메일과 비밀번호를 입력해주세요.");
        return;
    }

    // 계정 전환 안전 — 이전 사용자 cognito SDK 세션 + 클라이언트 상태 사전 제거 (handleSignIn과 동일 패턴)
    const prevCognitoUser = userPool.getCurrentUser();
    if (prevCognitoUser) prevCognitoUser.signOut();
    clearClientSession();

    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({ Username: email, Password: password });
    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });

    cognitoUser.authenticateUser(authDetails, {
        onSuccess: async function(result) {
            const accessToken = result.getAccessToken().getJwtToken();
            const idToken = result.getIdToken();
            const userId = idToken.payload.sub;
            const refreshToken = result.getRefreshToken().getToken();

            // 이전 at/rt 쿠키 제거 후 새 토큰 동기화 (handleSignIn과 동일 순서)
            if (typeof clearServerSessionCookies === 'function') {
                await clearServerSessionCookies();
            }
            setAccessToken(accessToken);
            setIdToken(idToken.getJwtToken());
            localStorage.setItem('userEmail', email);
            localStorage.setItem('userId', userId);
            // rt 쿠키 등록은 await하지 않고 get_login_profile과 병렬 진행 → 아래에서 join (직렬 왕복 1회 제거)
            const cookiePromise = registerRefreshCookie(refreshToken);

            // DB role 검증 — 튜터만 통과 (역할 근거: get_login_profile의 role)
            let role = null, userName = '선생님';
            try {
                const res = await fetch(USER_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAccessToken()}` },
                    credentials: 'include',
                    body: JSON.stringify({ type: 'get_login_profile' })
                });
                if (res.ok) {
                    const data = await res.json();
                    role = data.role || null;
                    if (data.name) userName = data.name;
                }
            } catch (e) { /* role 미확인 → 아래에서 차단 */ }

            // join: 라우팅/세션정리 전에 rt 쿠키 등록 완료 보장 (양 경로 안전)
            await cookiePromise.catch(() => {});

            if (role !== 'tutor') {
                const dest = role === 'admin' ? '/admin/login' : '/login';
                const msg = role === 'admin'
                    ? "관리자 계정입니다. 관리자 로그인 페이지를 이용해주세요."
                    : role === 'student'
                        ? "학생 회원입니다. 일반 로그인 페이지를 이용해주세요."
                        : "튜터 계정이 아니거나 정보를 확인할 수 없습니다. 계정을 확인해주세요.";
                const prev = userPool.getCurrentUser();
                if (prev) prev.signOut();
                if (typeof clearServerSessionCookies === 'function') await clearServerSessionCookies();
                clearClientSession();
                alert(msg);
                window.location.replace(dest);
                return;
            }

            localStorage.setItem('userRole', 'tutor');
            markPostLoginIdentitySkip();

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({ event: "login", user_id: userId });

            alert(`${userName} 선생님, 안녕하세요.`);
            window.location.replace('/mypage/tutor');
        },
        onFailure: function(err) {
            alert(getErrorMessage(err));
        }
    });
}

// ==========================================
// [Part G] 소셜 로그인
// ==========================================

function validateSocialConfig(provider) {
    const social = CONFIG && CONFIG.social;
    const callbackUrl = social && social.callbackUrl;
    const clientId = social && social[provider] && social[provider].clientId;

    const PLACEHOLDERS = ['GOOGLE_CLIENT_ID', 'NAVER_CLIENT_ID', 'undefined', 'null'];
    const isPlaceholder = (val) => !val || PLACEHOLDERS.some(p => String(val).includes(p));

    if (isPlaceholder(clientId)) {
        throw new Error(`[SocialLogin] ${provider} clientId가 설정되지 않았습니다.`);
    }
    if (isPlaceholder(callbackUrl)) {
        throw new Error(`[SocialLogin] callbackUrl이 설정되지 않았습니다.`);
    }
    // localhost는 개발 환경이므로 http 허용, 그 외에는 https 필수
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)/.test(callbackUrl);
    if (!isLocalhost && !/^https:\/\//.test(callbackUrl)) {
        throw new Error(`[SocialLogin] callbackUrl은 https여야 합니다: ${callbackUrl}`);
    }

    return { clientId, callbackUrl };
}

window.handleSocialLogin = function(provider) {
    const buttons = document.querySelectorAll('.social-btn');
    buttons.forEach(btn => { btn.disabled = true; });

    let clientId, callbackUrl;
    try {
        ({ clientId, callbackUrl } = validateSocialConfig(provider));
    } catch (err) {
        console.error(err);
        alert("소셜 로그인 설정이 완료되지 않았습니다. 관리자에게 문의해주세요.");
        buttons.forEach(btn => { btn.disabled = false; });
        return;
    }

    // CSRF state: randomHex|provider
    const stateNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    const state = `${stateNonce}|${provider}`;
    sessionStorage.setItem('socialState', state);
    const marketingConsentEl = document.getElementById('socialMarketingConsent');
    sessionStorage.setItem('socialMarketingAgreed', marketingConsentEl && marketingConsentEl.checked ? 'true' : 'false');

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
    } else {
        buttons.forEach(btn => { btn.disabled = false; });
        alert("지원하지 않는 로그인 방식입니다.");
        return;
    }

    window.location.href = authUrl;
};

window.openAuthModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('hidden');
};

window.closeAuthModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
    
    if(modalId === 'forgotPwModal') {
        document.getElementById('forgotPwStep1').classList.remove('hidden');
        document.getElementById('forgotPwStep2').classList.add('hidden');
        document.getElementById('forgotPwEmail').value = '';
        document.getElementById('forgotPwCode').value = '';
        document.getElementById('forgotPwNew').value = '';
        document.getElementById('forgotPwConfirm').value = '';
        const btn = document.getElementById('reqResetBtn');
        if (btn) { btn.innerText = "인증 코드 받기"; btn.disabled = false; }
    } else if (modalId === 'findEmailModal') {
        document.getElementById('findEmailName').value = '';
        document.getElementById('findEmailPhone').value = '';
        document.getElementById('foundEmailResult').classList.add('hidden');
        const findBtn = document.querySelector('#findEmailModal .auth-btn');
        if (findBtn) findBtn.classList.remove('hidden');
    }
};

async function requestPasswordReset() {
    const email = document.getElementById('forgotPwEmail').value.trim();
    if(!email) { alert("이메일을 입력해주세요."); return; }

    const btn = document.getElementById('reqResetBtn');
    btn.innerText = "발송 중...";
    btn.disabled = true;

    try {
        await apiFetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'send_pw_reset_code', email: email })
        });
        alert("비밀번호 재설정 코드가 이메일로 발송되었습니다.");
        document.getElementById('forgotPwStep1').classList.add('hidden');
        document.getElementById('forgotPwStep2').classList.remove('hidden');
    } catch (e) {
        const msg = e.message || "";
        alert(msg.includes('404') ? "가입되지 않은 이메일입니다." : "통신 중 오류가 발생했습니다.");
        btn.innerText = "인증 코드 받기";
        btn.disabled = false;
    }
}

async function confirmPasswordReset() {
    const email = document.getElementById('forgotPwEmail').value.trim();
    const code = document.getElementById('forgotPwCode').value.trim();
    const newPw = document.getElementById('forgotPwNew').value;
    const confirmPw = document.getElementById('forgotPwConfirm').value;

    if(!code || !newPw || !confirmPw) { alert("모든 항목을 입력해주세요."); return; }
    if(newPw !== confirmPw) { alert("비밀번호가 일치하지 않습니다."); return; }

    const pwRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!pwRegex.test(newPw)) {
        alert("비밀번호는 영문 대/소문자, 숫자, 특수문자를 모두 포함하여 8자 이상이어야 합니다.");
        return;
    }

    try {
        await apiFetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'reset_password', email: email, code: code, newPassword: newPw })
        });
        alert("비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.");
        closeAuthModal('forgotPwModal');
        document.getElementById('password').value = '';
    } catch (e) {
        const msg = e.message || "";
        alert(msg.includes('400') ? "인증코드가 일치하지 않거나 만료되었습니다." : "통신 중 오류가 발생했습니다.");
    }
}

async function handleFindEmail() {
    const name = document.getElementById('findEmailName').value.trim();
    const phoneRaw = document.getElementById('findEmailPhone').value.replace(/[^0-9]/g, '');

    if (!name || !phoneRaw) { alert("이름과 전화번호를 모두 입력해주세요."); return; }

    let dbFormattedPhone = phoneRaw.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/, "$1-$2-$3");

    try {
        const response = await apiFetch(AUTH_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'find_email', name: name, phone: dbFormattedPhone })
        });
        const data = await response.json();
        const resultBox = document.getElementById('foundEmailResult');

        if (data.email) {
            resultBox.innerHTML = '';
            resultBox.appendChild(document.createTextNode("회원님의 이메일은 "));

            const strongTag = document.createElement('strong');
            strongTag.textContent = escapeHtml(data.email);
            resultBox.appendChild(strongTag);

            resultBox.appendChild(document.createTextNode(" 입니다."));
            resultBox.classList.remove('hidden');
            document.querySelector('#findEmailModal .auth-btn').classList.add('hidden');
        } else {
            alert("입력하신 정보와 일치하는 계정을 찾을 수 없습니다.");
        }
    } catch (e) {
        const msg = e.message || "";
        alert(msg.includes('404') ? "입력하신 정보와 일치하는 계정을 찾을 수 없습니다." : "통신 중 오류가 발생했습니다. 잠시 후 시도해주세요.");
    }
}
