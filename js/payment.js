// js/payment.js

const USER_API_URL = CONFIG.api.user;
const FORCE_TEST_PAYMENT_100 = new URLSearchParams(window.location.search).get('testpay') === '1'; // /payment?testpay=1

let selectedProductName = "";
let selectedTier = null; 
const TIER_DISPLAY = { free: 'FREE', basic: 'BASIC', starter: 'STARTER', standard: 'STANDARD', pro: 'PRO', trial: 'TRIAL', test: 'TEST' };

// 티어 비교를 위한 전역 변수
const TIER_LEVELS = { 'free': 0, 'trial': 1, 'basic': 2, 'starter': 2.5, 'standard': 3, 'pro': 4 };
let globalCurrentTier = 'free';
let globalDaysLeft = 0;
let globalExpireDate = null; // 기존 만료일(새로운 시작일) 저장용
let userPhoneMissing = false;

function getTierDisplayName(tier) { return TIER_DISPLAY[(tier || '').toLowerCase()] || String(tier || '').toUpperCase(); }

// 💡 토큰 자동 갱신 — HttpOnly 쿠키 기반
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
        return res.ok;
    } catch (e) {
        return false;
    } finally {
        _isRefreshing = false;
    }
}

// 💡 공통 apiFetch 함수 — HttpOnly 쿠키 기반 인증
async function apiFetch(url, options = {}) {
    const defaultHeaders = { 'Content-Type': 'application/json' };
    options.headers = { ...defaultHeaders, ...(options.headers || {}) };
    options.credentials = 'include';

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            if (response.status === 401) {
                const refreshed = await tryRefreshToken();
                if (refreshed) {
                    const retryRes = await fetch(url, options);
                    if (retryRes.ok) return retryRes;
                }
                alert("보안을 위해 로그인이 만료되었습니다. 다시 로그인해 주세요.");
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/login';
                return Promise.reject(new Error("Auth expired"));
            }
            if (response.status === 403) {
                const errBody = await response.json().catch(() => ({}));
                throw new Error(errBody.error || errBody.message || '접근 권한이 없습니다.');
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
    if (FORCE_TEST_PAYMENT_100) {
        const priceList = document.querySelector('.price-list');
        if (priceList) {
            const testCard = document.createElement('article');
            testCard.className = 'price-row';
            testCard.setAttribute('data-tier', 'test');
            testCard.innerHTML = `<div class="price-name"><h2 class="c-primary">TEST</h2><p>시스템 연동 테스트</p></div><div class="price-amount"><strong>100</strong><span>원</span></div><ul><li>결제 시스템 연동 확인용</li><li>실 결제 100원 처리</li></ul><a class="price-btn price-btn--primary" href="javascript:void(0)" onclick="selectPlan('test', this.closest('.price-row'))">테스트 결제 선택</a>`;
            priceList.insertBefore(testCard, priceList.firstChild);
        }
    }

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
    initMobileSwipeUX();
});

function centerCardInScroller(scrollerEl, cardEl, behavior = 'auto') {
    if (!scrollerEl || !cardEl) return;
    const targetLeft = cardEl.offsetLeft - (scrollerEl.clientWidth - cardEl.clientWidth) / 2;
    scrollerEl.scrollTo({ left: Math.max(0, targetLeft), behavior });
}

function initPriceSwipeDeck() {
    const priceList = document.querySelector('.price-list');
    if (!priceList) return;

    const centerStandardCard = (behavior = 'auto') => {
        if (!window.matchMedia('(max-width: 900px)').matches) return;
        const standardCard = priceList.querySelector('.price-row[data-tier="standard"]');
        if (standardCard) centerCardInScroller(priceList, standardCard, behavior);
    };

    setTimeout(() => centerStandardCard('auto'), 60);

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => centerStandardCard('auto'), 160);
    });

    const hint = document.getElementById('priceSwipeHint');
    const hintKey = 'payment_price_swipe_hint_v1';
    if (!hint || sessionStorage.getItem(hintKey) === '1') return;
    if (!window.matchMedia('(max-width: 900px)').matches) return;

    requestAnimationFrame(() => {
        hint.classList.add('show');
        setTimeout(() => {
            hint.classList.remove('show');
            sessionStorage.setItem(hintKey, '1');
        }, 2200);
    });
}

function initRoadmapSwipeDeck() {
    const roadmapGrid = document.querySelector('.roadmap-grid');
    const indicator = document.getElementById('roadmapIndicator');
    if (!roadmapGrid || !indicator) return;

    const cards = Array.from(roadmapGrid.querySelectorAll('.road-card'));
    if (cards.length === 0) return;

    indicator.innerHTML = cards.map(() => '<span class="dot"></span>').join('');
    const dots = Array.from(indicator.querySelectorAll('.dot'));

    const updateIndicator = () => {
        if (!window.matchMedia('(max-width: 640px)').matches) {
            dots.forEach(dot => dot.classList.remove('active'));
            return;
        }

        const centerX = roadmapGrid.scrollLeft + (roadmapGrid.clientWidth / 2);
        let activeIdx = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        cards.forEach((card, idx) => {
            const cardCenter = card.offsetLeft + (card.clientWidth / 2);
            const dist = Math.abs(cardCenter - centerX);
            if (dist < bestDist) {
                bestDist = dist;
                activeIdx = idx;
            }
        });
        dots.forEach((dot, idx) => dot.classList.toggle('active', idx === activeIdx));
    };

    roadmapGrid.addEventListener('scroll', updateIndicator, { passive: true });
    window.addEventListener('resize', updateIndicator);
    setTimeout(updateIndicator, 60);
}

function initMobileSwipeUX() {
    initPriceSwipeDeck();
    initRoadmapSwipeDeck();
}

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
        
        if (selectedTier) _applyPhoneRequiredMessage(document.getElementById('submitBtn'));
    } catch (error) {
        if (error.message !== "Auth expired") console.error("유저 정보 로드 실패:", error);
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
            document.getElementById('activeSubName').innerText = getTierDisplayName(globalCurrentTier);
            document.getElementById('activeSubDate').innerText = `${expireDate.getFullYear()}년 ${expireDate.getMonth()+1}월 ${expireDate.getDate()}일까지 유효`;
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
            const pendingTier = getTierDisplayName(pending.tier);
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
    selectedProductName = h2 ? h2.textContent.trim() : getTierDisplayName(tier);

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

// 특수 옵션(TEST) 선택
function selectSpecialPlan(tier, el) {
    document.querySelectorAll('.special-option-btn').forEach(b => b.classList.remove('selected'));
    if (el) el.classList.add('selected');
    document.querySelectorAll('.price-row').forEach(r => r.classList.remove('selected'));

    selectedTier = tier;
    selectedProductName = getTierDisplayName(tier);

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
        const expireDateStr = globalExpireDate
            ? `${globalExpireDate.getFullYear()}년 ${globalExpireDate.getMonth()+1}월 ${globalExpireDate.getDate()}일`
            : '확인 중';
        const selectedTierName = getTierDisplayName(tier);

        if (selectedLevel < currentLevel) {
            msgWrap.style.display = 'block'; msgWrap.classList.add('warning');
            msgText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>하위 플랜 예약:</strong> 현재 이용권 종료일(${expireDateStr}) 이후부터 <strong>${selectedTierName}</strong> 4주 이용권이 적용됩니다.`;
            if (btn) btn.innerText = '하위 플랜 예약 결제';
        } else if (selectedLevel === currentLevel) {
            msgWrap.style.display = 'block';
            msgText.innerHTML = `<i class="fas fa-info-circle" style="color:#3b82f6;"></i> 현재 이용권이 <strong>${globalDaysLeft}일</strong> 남아 있습니다.<br>지금 결제하면 종료일(${expireDateStr}) 이후 4주 이용권이 연장됩니다.`;
            if (btn) btn.innerText = '4주 이용권 연장 결제';
        } else {
            msgWrap.style.display = 'block';
            msgText.innerHTML = `<i class="fas fa-arrow-up" style="color:#3b82f6;"></i> <strong>상위 플랜 예약:</strong> 현재 이용권 종료일(${expireDateStr}) 이후부터 <strong>${selectedTierName}</strong> 4주 이용권이 적용됩니다.`;
            if (btn) btn.innerText = '상위 플랜 예약 결제';
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
    const btn = document.getElementById('submitBtn');
    _applyTierMessage(selectedTier, btn);
    _applyPhoneRequiredMessage(btn);
}

function formatPhoneNumber(rawPhone) {
    let cleaned = rawPhone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('10') && cleaned.length === 10) {
        cleaned = '0' + cleaned;
    }
    return cleaned.replace(/(^02.{0}|^01.{1}|[0-9]{3})([0-9]+)([0-9]{4})/, "$1-$2-$3");
}

// 티어별 결제 금액 (서버 사이드 TIER_PRICES 와 동일하게 유지)
const BASE_TIER_PRICES_KRW = { 'test': 100, 'basic': 25000, 'starter': 39000, 'standard': 49000, 'pro': 149000 };
const TIER_PRICES_KRW = BASE_TIER_PRICES_KRW;

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
    if (globalCurrentTier !== 'free' && globalDaysLeft > 0 && globalExpireDate) {
        startDate = globalExpireDate;
    }

    const checkoutTier = selectedTier;
    const amount = TIER_PRICES_KRW[selectedTier];
    if (!amount) { alert("유효하지 않은 상품입니다."); return; }

    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const isTestPayment = selectedTier === 'test';
    const checkoutData = {
        tier: checkoutTier,
        productName: isTestPayment ? `${selectedProductName} (테스트 결제)` : selectedProductName,
        requestedTier: selectedTier,
        isTestPayment,
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
