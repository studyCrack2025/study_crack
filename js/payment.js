// js/payment.js

const USER_API_URL = CONFIG.api.user;
const PAYMENT_API_URL = CONFIG.api.payment;

let selectedProductName = "";
let selectedTier = null; 

// 티어 비교를 위한 전역 변수
const TIER_LEVELS = { 'free': 0, 'trial': 1, 'basic': 2, 'standard': 3, 'pro': 4 };
let globalCurrentTier = 'free';
let globalDaysLeft = 0;
let globalExpireDate = null; // 기존 만료일(새로운 시작일) 저장용
let paymentAccessToken = null;
let paymentIdToken = null;
let userPhoneMissing = false;

function getPaymentAccessToken() { return paymentAccessToken; }
function setPaymentAccessToken(token) { paymentAccessToken = token; }
function setPaymentIdToken(token) { paymentIdToken = token; }

// 💡 토큰 자동 갱신 (쿠키 우선, localStorage 폴백)
let _isRefreshing = false;
async function tryRefreshToken() {
    if (_isRefreshing) return false;
    _isRefreshing = true;
    try {
        const res = await fetch(CONFIG.api.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'silent_refresh' })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.accessToken && data.idToken) {
                setPaymentAccessToken(data.accessToken);
                setPaymentIdToken(data.idToken);
                return true;
            }
        }
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;
        const fallbackRes = await fetch(CONFIG.api.auth, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'refresh_token', refreshToken })
        });
        if (!fallbackRes.ok) return false;
        const fallbackData = await fallbackRes.json();
        if (fallbackData.accessToken && fallbackData.idToken) {
            setPaymentAccessToken(fallbackData.accessToken);
            setPaymentIdToken(fallbackData.idToken);
            return true;
        }
        return false;
    } catch (e) {
        return false;
    } finally {
        _isRefreshing = false;
    }
}

// 💡 공통 apiFetch 함수
async function apiFetch(url, options = {}) {
    const token = getPaymentAccessToken();
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    options.headers = { ...defaultHeaders, ...(options.headers || {}) };

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                const refreshed = await tryRefreshToken();
                if (refreshed) {
                    const newToken = getPaymentAccessToken();
                    options.headers['Authorization'] = `Bearer ${newToken}`;
                    const retryRes = await fetch(url, options);
                    if (retryRes.ok) return retryRes;
                    if (!retryRes.ok && retryRes.status !== 401 && retryRes.status !== 403) {
                        throw new Error(`서버 통신 오류 (상태 코드: ${retryRes.status})`);
                    }
                }
                alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login';
                return Promise.reject(new Error("Auth expired"));
            }
            throw new Error(`서버 통신 오류 (상태 코드: ${response.status})`);
        }
        return response;
    } catch (error) {
        console.error("API 통신 실패:", error);
        throw error;
    }
}

// 💡 [추가] XSS 방어 유틸리티 (필드 렌더링 시 안전성 확보)
function escapeHtml(text) {
    if (text == null) return ""; 
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }

    const header = document.getElementById('site-header');
    if (header) header.classList.add('scrolled');
    syncHeaderNav();

    // 스크롤 리빌 애니메이션
    const reveals = document.querySelectorAll('.road-card, .price-row, .example-card, .stat-card');
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                io.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });
    reveals.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
        io.observe(el);
    });

    const urlParams = new URLSearchParams(window.location.search);

    const errorMsg = urlParams.get('error');
    if (errorMsg) {
        alert("결제 실패: " + errorMsg);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (urlParams.get('test') === '1') {
        const testOption = document.getElementById('testOption');
        if (testOption) testOption.style.display = 'block';
        const specialOptions = document.getElementById('specialOptions');
        if (specialOptions) specialOptions.style.display = 'block';
    }

    await tryRefreshToken();
    setupPaymentLoadingInterceptor();
    fetchUserInfo(userId);
});

function syncHeaderNav() {
    const isLoggedIn = !!localStorage.getItem('userId');
    const btnAnalysis = document.getElementById('navAnalysis');
    const btnQna = document.getElementById('navQna');
    const btnLogin = document.getElementById('loginBtn');
    const btnMyPage = document.getElementById('myPageBtn');
    const btnLogout = document.getElementById('logoutBtn');

    if (isLoggedIn) {
        if (btnAnalysis) btnAnalysis.classList.remove('hidden');
        if (btnQna) btnQna.classList.remove('hidden');
        if (btnMyPage) btnMyPage.classList.remove('hidden');
        if (btnLogout) btnLogout.classList.remove('hidden');
        if (btnLogin) btnLogin.classList.add('hidden');
    }

    // 모바일 햄버거 패널 링크 동기화
    const mobileAnalysis = document.getElementById('mobileNavAnalysis');
    const mobileQna      = document.getElementById('mobileNavQna');
    const mobileLogin    = document.getElementById('mobileLoginBtn');
    const mobileMyPage   = document.getElementById('mobileMyPageBtn');
    const mobileLogout   = document.getElementById('mobileLogoutBtn');
    if (isLoggedIn) {
        if (mobileAnalysis) mobileAnalysis.classList.remove('hidden');
        if (mobileQna)      mobileQna.classList.remove('hidden');
        if (mobileMyPage)   mobileMyPage.classList.remove('hidden');
        if (mobileLogout)   mobileLogout.classList.remove('hidden');
        if (mobileLogin)    mobileLogin.classList.add('hidden');
    } else {
        if (mobileAnalysis) mobileAnalysis.classList.add('hidden');
        if (mobileQna)      mobileQna.classList.add('hidden');
        if (mobileMyPage)   mobileMyPage.classList.add('hidden');
        if (mobileLogout)   mobileLogout.classList.add('hidden');
        if (mobileLogin)    mobileLogin.classList.remove('hidden');
    }

    if (btnMyPage) {
        btnMyPage.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/mypage';
        });
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '/';
        });
    }

    if (mobileMyPage) {
        mobileMyPage.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/mypage';
        });
    }
}

// 유저 정보 가져오기 및 티어 계산
async function fetchUserInfo(userId) {
    try {
        const response = await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user' }) 
        });
        
        const data = await response.json();
        
        if (data.name) document.getElementById('name').value = escapeHtml(data.name);
        const phoneInput = document.getElementById('phone');
        if (data.phone && String(data.phone).trim()) {
            phoneInput.value = escapeHtml(data.phone);
            userPhoneMissing = false;
        } else {
            phoneInput.value = '';
            phoneInput.placeholder = '마이페이지에서 전화번호를 등록해주세요';
            userPhoneMissing = true;
        }
        const email = localStorage.getItem('userEmail') || data.email;
        if (email) document.getElementById('email').value = escapeHtml(email);

        // 프론트엔드에서 남은 기간 및 티어 계산
        calculateUserTierDisplay(data);
        
        if (data.promoCode && data.promoCode.trim().length > 4) {
            validatePromoCode(data.promoCode);
        }

        if (selectedTier) _applyPhoneRequiredMessage(document.getElementById('submitBtn'));
    } catch (error) {
        if (error.message !== "Auth expired") console.error("유저 정보 로드 실패:", error);
    }
}

async function validatePromoCode(code) {
    try {
        const response = await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({
                type: 'validate_promo_code',
                data: { promoCode: code }
            })
        });

        const result = await response.json();

        // 백엔드에서 isValid: true를 뱉어내면 체험단 메뉴 노출
        if (result.isValid) {
            const trialOption = document.getElementById('trialOption');
            if (trialOption) trialOption.style.display = 'block';
            const specialOptions = document.getElementById('specialOptions');
            if (specialOptions) specialOptions.style.display = 'block';
        }
    } catch (error) {
        if (error.message !== "Auth expired") console.error("프로모션 코드 검증 API 호출 실패", error);
    }
}

// 나이스페이 모달창은 정상적으로 띄우고, 최종 승인 시에만 로딩 오버레이 덮기
function setupPaymentLoadingInterceptor() {
    if (document.getElementById('stcPaymentLoadingOverlay')) return;
    
    // 1. 전체 화면 로딩 오버레이 DOM 생성
    const overlay = document.createElement('div');
    overlay.id = 'stcPaymentLoadingOverlay';
    overlay.innerHTML = `
        <style>
            /* 문제가 되었던 공격적인 CSS 제거! 오직 오버레이 디자인만 남깁니다. */
            #stcPaymentLoadingOverlay {
                display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(255, 255, 255, 1); /* 투명도 없는 완전한 흰색으로 뒤에 겹치는 못생긴 텍스트 완벽히 가림 */
                z-index: 2147483647; /* 화면 최상단 */
                flex-direction: column; justify-content: center; align-items: center;
            }
            .stc-spinner { 
                width: 55px; height: 55px; border: 5px solid #e2e8f0; 
                border-top: 5px solid #2563EB; border-radius: 50%; 
                animation: stc-spin 1s linear infinite; 
            }
            @keyframes stc-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
        <div class="stc-spinner"></div>
        <h2 style="color: #1e293b; margin-top: 25px; font-weight: bold; font-size: 1.4rem;">결제를 안전하게 승인 중입니다...</h2>
        <p style="color: #64748b; margin-top: 10px;">창을 닫거나 새로고침하지 마세요.</p>
    `;
    document.body.appendChild(overlay);

    // 2. [핵심] 폼 제출 가로채기 정밀 조정
    const originalSubmit = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function() {
        if (!this.target || this.target === '_self' || this.target === '') {
            document.getElementById('stcPaymentLoadingOverlay').style.display = 'flex';
        }
        originalSubmit.apply(this, arguments);
    };
}

// 💡 [핵심 수정] 분리된 구조(currentSubscription) 기반의 구독 기간 계산 헬퍼
function calculateUserTierDisplay(data) {
    globalCurrentTier = data.computedTier || 'free';

    // 1. 활성화된 구독 객체 파싱
    if (globalCurrentTier !== 'free' && data.currentSubscription && data.currentSubscription.status === 'active') {
        const payDate = new Date(data.currentSubscription.startDate);

        if (!isNaN(payDate)) {
            const expireDate = new Date(payDate.getTime() + (28 * 24 * 60 * 60 * 1000));
            const now = new Date();

            globalDaysLeft = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24));
            globalExpireDate = expireDate;

            // 상단 배너 표시 (결제 섹션이 열릴 때 보임)
            document.getElementById('activeSubName').innerText = globalCurrentTier.toUpperCase();
            if (globalCurrentTier === 'basic') {
                document.getElementById('activeSubDate').innerText = '평생 이용 가능';
            } else {
                document.getElementById('activeSubDate').innerText = `${expireDate.getFullYear()}년 ${expireDate.getMonth()+1}월 ${expireDate.getDate()}일까지 유효`;
            }
            // 배너는 checkout 섹션 안에 있으므로 display:flex 처리는 selectPlan에서 수행

            // price-row에 '현재 이용 중' 뱃지
            const currentRow = document.querySelector(`.price-row[data-tier="${globalCurrentTier}"]`);
            if (currentRow) {
                const badge = document.createElement('div');
                badge.className = 'current-tier-badge';
                badge.innerText = '현재 이용 중';
                currentRow.appendChild(badge);
            }
        }

        // 예약된 플랜(pendingSubscription) 배너
        if (data.pendingSubscription && data.pendingSubscription.status === 'active') {
            const pending = data.pendingSubscription;
            const pendingTier = (pending.tier || '').toUpperCase();
            const pendingStart = pending.startDate ? new Date(pending.startDate) : null;
            const pendingStartStr = pendingStart
                ? `${pendingStart.getFullYear()}년 ${pendingStart.getMonth()+1}월 ${pendingStart.getDate()}일`
                : '만료 후';
            document.getElementById('pendingSubName').innerText = pendingTier;
            document.getElementById('pendingSubDate').innerText = `${pendingStartStr}부터 적용 예정`;

            // price-row에 '예약됨' 뱃지
            const pendingRow = document.querySelector(`.price-row[data-tier="${(pending.tier || '').toLowerCase()}"]`);
            if (pendingRow) {
                const pendingBadge = document.createElement('div');
                pendingBadge.className = 'current-tier-badge';
                pendingBadge.style.background = '#dbeafe';
                pendingBadge.style.color = '#1d4ed8';
                pendingBadge.innerText = '예약됨';
                pendingRow.appendChild(pendingBadge);
            }
        }
    }
}

// v2 디자인 — price-row 클릭 시 plan 선택 및 결제 섹션 노출
function selectPlan(tier, priceRowEl) {
    // price-row 선택 상태 표시
    document.querySelectorAll('.price-row').forEach(r => r.classList.remove('selected'));
    if (priceRowEl) priceRowEl.classList.add('selected');

    selectedTier = tier;
    const h2 = priceRowEl ? priceRowEl.querySelector('h2') : null;
    selectedProductName = h2 ? h2.textContent.trim() : tier.toUpperCase();

    // 결제 섹션 노출 및 스크롤
    const checkoutEl = document.getElementById('checkout');
    if (checkoutEl) {
        checkoutEl.style.display = 'block';
        // 현재 구독 배너 노출 (데이터가 준비된 경우)
        if (globalCurrentTier !== 'free') {
            const activeBanner = document.getElementById('activeSubBanner');
            if (activeBanner) activeBanner.style.display = 'flex';
            const pendingBanner = document.getElementById('pendingSubBanner');
            const pendingNameEl = document.getElementById('pendingSubName');
            if (pendingBanner && pendingNameEl && pendingNameEl.innerText !== '-') {
                pendingBanner.style.display = 'flex';
            }
        }
        setTimeout(() => checkoutEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }

    // 선택 플랜 이름 표시
    const planNameEl = document.getElementById('checkoutPlanName');
    if (planNameEl) planNameEl.textContent = selectedProductName;

    // 결제 버튼 초기화
    const btn = document.getElementById('submitBtn');
    if (btn) { btn.disabled = false; btn.innerText = '결제하기'; }

    // 티어 메시지 계산 (기존 selectProduct 로직 재사용)
    _applyTierMessage(tier, btn);
    _applyPhoneRequiredMessage(btn);
}

// 특수 옵션(TEST/TRIAL) 선택
function selectSpecialPlan(tier, el) {
    document.querySelectorAll('.special-option-btn').forEach(b => b.classList.remove('selected'));
    if (el) el.classList.add('selected');
    document.querySelectorAll('.price-row').forEach(r => r.classList.remove('selected'));

    selectedTier = tier;
    selectedProductName = tier.toUpperCase();

    const planNameEl = document.getElementById('checkoutPlanName');
    if (planNameEl) planNameEl.textContent = selectedProductName;

    const btn = document.getElementById('submitBtn');
    if (btn) { btn.disabled = false; btn.innerText = '결제하기'; }

    document.getElementById('tierMessageWrap').style.display = 'none';
    _applyPhoneRequiredMessage(btn);
}

// 티어 메시지 공통 처리
function _applyTierMessage(tier, btn) {
    const msgWrap = document.getElementById('tierMessageWrap');
    const msgText = document.getElementById('tierMessageText');
    if (!msgWrap || !msgText) return;

    const selectedLevel = TIER_LEVELS[tier];
    const currentLevel = TIER_LEVELS[globalCurrentTier];

    msgWrap.style.display = 'none';
    msgWrap.className = 'tier-message-wrap';
    if (btn) { btn.disabled = false; btn.innerText = '결제하기'; }

    if (currentLevel > 0) {
        if (globalCurrentTier === 'basic') {
            if (selectedLevel === currentLevel) {
                msgWrap.style.display = 'block';
                msgText.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981;"></i> 이미 평생 이용 가능한 BASIC 플랜을 보유하고 있습니다.`;
                if (btn) { btn.disabled = true; btn.innerText = '현재 이용 중인 플랜'; }
            } else if (selectedLevel > currentLevel) {
                msgWrap.style.display = 'block'; msgWrap.classList.add('warning');
                msgText.innerHTML = `<i class="fas fa-exclamation-circle"></i> <strong>업그레이드 안내:</strong> 결제 시 기존 BASIC 등급의 잔여 목표대학 설정 횟수는 <strong>무제한으로 전환되며 소멸</strong>됩니다.`;
                if (btn) btn.innerText = '업그레이드 결제하기';
            }
        } else if (globalCurrentTier === 'standard' || globalCurrentTier === 'pro') {
            const expireDateStr = globalExpireDate
                ? `${globalExpireDate.getFullYear()}년 ${globalExpireDate.getMonth()+1}월 ${globalExpireDate.getDate()}일` : '';
            if (selectedLevel < currentLevel) {
                msgWrap.style.display = 'block'; msgWrap.classList.add('warning');
                msgText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>다운그레이드 예약:</strong> 기존 구독 만료일(${expireDateStr}) 이후부터 <strong>${tier.toUpperCase()}</strong> 플랜이 적용됩니다.`;
                if (btn) btn.innerText = '다운그레이드 예약 결제';
            } else if (selectedLevel === currentLevel) {
                msgWrap.style.display = 'block';
                msgText.innerHTML = `<i class="fas fa-info-circle" style="color:#3b82f6;"></i> 기존 구독 기간이 <strong>${globalDaysLeft}일</strong> 남았습니다.<br>지금 결제하시면 만료일(${expireDateStr}) 이후로 4주가 연장됩니다.`;
                if (btn) btn.innerText = '연장 결제하기';
            } else {
                msgWrap.style.display = 'block';
                msgText.innerHTML = `<i class="fas fa-arrow-up" style="color:#3b82f6;"></i> <strong>업그레이드 예약:</strong> 기존 구독 만료일(${expireDateStr}) 이후부터 <strong>${tier.toUpperCase()}</strong> 혜택이 적용됩니다.`;
                if (btn) btn.innerText = '업그레이드 예약 결제';
            }
        }
    }
}

function _applyPhoneRequiredMessage(btn) {
    if (!userPhoneMissing) return;

    const msgWrap = document.getElementById('tierMessageWrap');
    const msgText = document.getElementById('tierMessageText');
    if (msgWrap && msgText) {
        msgWrap.style.display = 'block';
        msgWrap.className = 'tier-message-wrap warning';
        msgText.innerHTML = `<i class="fas fa-exclamation-circle"></i> 전화번호 등록이 필요합니다. 마이페이지에서 전화번호를 입력한 뒤 결제를 진행해주세요.`;
    }
    if (btn) {
        btn.disabled = true;
        btn.innerText = '전화번호 등록 필요';
    }
}

// 상품 선택 로직 (7일 연장 및 Basic 업그레이드 조건 반영)
function selectProduct(element, url, tier) {
    document.querySelectorAll('.product-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    selectedTier = tier;
    const nameSpan = element.querySelector('.p-name');
    if (nameSpan) selectedProductName = escapeHtml(nameSpan.innerText);

    const selectedLevel = TIER_LEVELS[selectedTier];
    const currentLevel = TIER_LEVELS[globalCurrentTier];

    const msgWrap = document.getElementById('tierMessageWrap');
    const msgText = document.getElementById('tierMessageText');
    const btn = document.getElementById('submitBtn');

    // 초기화
    msgWrap.style.display = 'none';
    msgWrap.className = 'tier-message-wrap'; 
    btn.disabled = false;
    btn.innerText = "결제하기";

    if (currentLevel > 0) {
        // 1. Basic 유저인 경우 (업그레이드 무조건 허용)
        if (globalCurrentTier === 'basic') {
            if (selectedLevel === currentLevel) {
                msgWrap.style.display = 'block';
                msgText.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981;"></i> 이미 평생 이용 가능한 BASIC 플랜을 보유하고 있습니다.`;
                btn.disabled = true;
                btn.innerText = "현재 이용 중인 플랜";
            } else if (selectedLevel > currentLevel) {
                msgWrap.style.display = 'block';
                msgWrap.classList.add('warning'); // 노란색/빨간색 경고창
                msgText.innerHTML = `<i class="fas fa-exclamation-circle"></i> <strong>업그레이드 안내:</strong> 결제 시 기존 BASIC 등급의 잔여 목표대학 설정 횟수는 <strong>무제한으로 전환되며 소멸</strong>됩니다.`;
                btn.innerText = "업그레이드 결제하기";
            }
        } 
        // 2. Standard / Pro 유저인 경우
        else if (globalCurrentTier === 'standard' || globalCurrentTier === 'pro') {
            const expireDateStr = globalExpireDate
                ? `${globalExpireDate.getFullYear()}년 ${globalExpireDate.getMonth()+1}월 ${globalExpireDate.getDate()}일`
                : '';

            if (selectedLevel < currentLevel) {
                // 다운그레이드: 현재 만료 후 예약 적용
                msgWrap.style.display = 'block';
                msgWrap.classList.add('warning');
                msgText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>다운그레이드 예약:</strong> 기존 구독 만료일(${expireDateStr}) 이후부터 <strong>${selectedTier.toUpperCase()}</strong> 플랜이 적용됩니다.`;
                btn.innerText = "다운그레이드 예약 결제";
            } else if (selectedLevel === currentLevel) {
                // 동일 티어 연장: 만료일로부터 28일 추가
                msgWrap.style.display = 'block';
                msgText.innerHTML = `<i class="fas fa-info-circle" style="color:#3b82f6;"></i> 기존 구독 기간이 <strong>${globalDaysLeft}일</strong> 남았습니다.<br>지금 결제하시면 만료일(${expireDateStr}) 이후로 4주가 연장됩니다.`;
                btn.innerText = "연장 결제하기";
            } else if (selectedLevel > currentLevel) {
                // 업그레이드: 현재 만료 후 예약 적용
                msgWrap.style.display = 'block';
                msgText.innerHTML = `<i class="fas fa-arrow-up" style="color:#3b82f6;"></i> <strong>업그레이드 예약:</strong> 기존 구독 만료일(${expireDateStr}) 이후부터 <strong>${selectedTier.toUpperCase()}</strong> 혜택이 적용됩니다.`;
                btn.innerText = "업그레이드 예약 결제";
            }
        }
    }
}

function formatPhoneNumber(rawPhone) {
    let cleaned = rawPhone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('10') && cleaned.length === 10) {
        cleaned = '0' + cleaned;
    }
    return cleaned.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/, "$1-$2-$3");
}

// 티어별 결제 금액 (서버 사이드 TIER_PRICES 와 동일하게 유지)
const TIER_PRICES_KRW = { 'test': 100, 'trial': 30000, 'basic': 25000, 'standard': 149000, 'pro': 299000 };

// NicePay JS SDK 결제창 호출
function processPayment() {
    const name = document.getElementById('name').value;
    const rawPhone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;

    if (userPhoneMissing || !rawPhone) {
        alert("전화번호 등록이 필요합니다. 마이페이지에서 전화번호를 입력한 뒤 결제를 진행해주세요.");
        window.location.href = '/mypage';
        return;
    }
    if (!name || !rawPhone || !email) {
        alert("필수 정보를 모두 입력해주세요."); return;
    }
    if (!selectedTier) {
        alert("신청할 프로그램을 선택해주세요."); return;
    }

    const formattedPhone = formatPhoneNumber(rawPhone);
    const userId = localStorage.getItem('userId');

    let startDate = new Date();
    if ((globalCurrentTier === 'standard' || globalCurrentTier === 'pro') && globalDaysLeft > 0 && globalExpireDate) {
        startDate = globalExpireDate;
    }

    const amount = TIER_PRICES_KRW[selectedTier];
    if (!amount) { alert("유효하지 않은 상품입니다."); return; }

    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const checkoutData = {
        tier: selectedTier,
        productName: selectedProductName,
        name: name,
        phone: formattedPhone,
        email: email,
        userId: userId,
        orderId: orderId,
        amount: amount,
        effectiveStartDate: startDate.toISOString()
    };

    localStorage.setItem('checkoutData', JSON.stringify(checkoutData));
    window.location.href = '/checkout';
}
