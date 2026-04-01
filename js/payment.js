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

// 💡 공통 apiFetch 함수
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

document.addEventListener('DOMContentLoaded', () => {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = '/login';
        return;
    }
    fetchUserInfo(userId);
});

// 유저 정보 가져오기 및 티어 계산
async function fetchUserInfo(userId) {
    try {
        const response = await apiFetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user' }) 
        });
        
        const data = await response.json();
        
        if (data.name) document.getElementById('name').value = escapeHtml(data.name);
        if (data.phone) document.getElementById('phone').value = escapeHtml(data.phone);
        const email = localStorage.getItem('userEmail') || data.email;
        if (email) document.getElementById('email').value = escapeHtml(email);

        // 프론트엔드에서 남은 기간 및 티어 계산
        calculateUserTierDisplay(data);
        
        if (data.promoCode && data.promoCode.trim().length > 4) {
            validatePromoCode(data.promoCode);
        }
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
            if(trialOption) trialOption.style.display = 'block'; 
        }
    } catch (error) {
        if (error.message !== "Auth expired") console.error("프로모션 코드 검증 API 호출 실패", error);
    }
}

// 💡 [핵심 수정] 분리된 구조(currentSubscription) 기반의 구독 기간 계산 헬퍼
function calculateUserTierDisplay(data) {
    globalCurrentTier = data.computedTier || 'free';

    // 1. 활성화된 구독 객체 파싱 (배열 검색 삭제)
    if (globalCurrentTier !== 'free' && data.currentSubscription && data.currentSubscription.status === 'active') {
        const payDate = new Date(data.currentSubscription.startDate);
        
        if (!isNaN(payDate)) { // 유효한 날짜인지 검증
            const expireDate = new Date(payDate.getTime() + (28 * 24 * 60 * 60 * 1000)); // 28일 더하기
            const now = new Date();
            
            globalDaysLeft = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24));
            globalExpireDate = expireDate;
            
            // 상단 배너 표시
            const banner = document.getElementById('activeSubBanner');
            document.getElementById('activeSubName').innerText = globalCurrentTier.toUpperCase();
            
            // Basic은 무기한이므로 텍스트 다르게 처리
            if (globalCurrentTier === 'basic') {
                document.getElementById('activeSubDate').innerText = '평생 이용 가능';
            } else {
                document.getElementById('activeSubDate').innerText = `${expireDate.getFullYear()}년 ${expireDate.getMonth()+1}월 ${expireDate.getDate()}일까지 유효`;
            }
            banner.style.display = 'flex';

            // 선택 박스에 '현재 이용 중' 뱃지 달기
            const currentOptionObj = document.querySelector(`.tier-${globalCurrentTier}`);
            if (currentOptionObj) {
                currentOptionObj.classList.add('is-current-tier');
                const badge = document.createElement('div');
                badge.className = 'current-tier-badge';
                badge.innerText = '현재 이용 중';
                currentOptionObj.appendChild(badge);
            }
        }

    // 예약된 플랜(pendingSubscription)이 있으면 안내 배너 추가
    if (data.pendingSubscription && data.pendingSubscription.status === 'active') {
        const pending = data.pendingSubscription;
        const pendingTier = (pending.tier || '').toUpperCase();
        const pendingStart = pending.startDate
            ? new Date(pending.startDate)
            : null;
        const pendingStartStr = pendingStart
            ? `${pendingStart.getFullYear()}년 ${pendingStart.getMonth()+1}월 ${pendingStart.getDate()}일`
            : '만료 후';
        const pendingBanner = document.getElementById('pendingSubBanner');
        if (pendingBanner) {
            document.getElementById('pendingSubName').innerText = pendingTier;
            document.getElementById('pendingSubDate').innerText = `${pendingStartStr}부터 적용 예정`;
            pendingBanner.style.display = 'flex';
        }
        // 선택 박스에 '예약됨' 뱃지 달기
        const pendingOptionObj = document.querySelector(`.tier-${pending.tier?.toLowerCase()}`);
        if (pendingOptionObj) {
            const pendingBadge = document.createElement('div');
            pendingBadge.className = 'current-tier-badge';
            pendingBadge.style.background = '#dbeafe';
            pendingBadge.style.color = '#1d4ed8';
            pendingBadge.innerText = '예약됨';
            pendingOptionObj.appendChild(pendingBadge);
        }
    }
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
const TIER_PRICES_KRW = { 'trial': 30000, 'basic': 25000, 'standard': 149000, 'pro': 299000 };

// NicePay JS SDK 결제창 호출
function processPayment() {
    const name = document.getElementById('name').value;
    const rawPhone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;

    if (!name || !rawPhone || !email) {
        alert("필수 정보를 모두 입력해주세요."); return;
    }
    if (!selectedTier) {
        alert("신청할 프로그램을 선택해주세요."); return;
    }

    const formattedPhone = formatPhoneNumber(rawPhone);
    const userId = localStorage.getItem('userId');

    // 결제 시작일(effectiveStartDate) 설정 로직
    // 현재 구독이 유효한 경우 → 잔여 기간 보존을 위해 기존 만료일부터 새 구독 시작
    // 만료됐거나 free인 경우 → 결제 즉시(now)부터 시작
    let startDate = new Date();
    if ((globalCurrentTier === 'standard' || globalCurrentTier === 'pro') && globalDaysLeft > 0 && globalExpireDate) {
        startDate = globalExpireDate;
    }

    const amount = TIER_PRICES_KRW[selectedTier];
    if (!amount) { alert("유효하지 않은 상품입니다."); return; }

    const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    AUTHNICE.requestPay({
        clientId: CONFIG.nicepay.clientId,
        method: 'card',
        orderId: orderId,
        amount: amount,
        goodsName: `스터디크랙 ${selectedProductName} 멤버십`,
        buyerName: name,
        buyerEmail: email,
        buyerTel: formattedPhone,
        returnUrl: CONFIG.api.payment_return,
        mallReserved: JSON.stringify({
            userId: userId,
            tier: selectedTier,
            productName: selectedProductName,
            effectiveStartDate: startDate.toISOString()
        }),
        fnError: function(result) {
            console.error('[NicePay Error]', result);
            alert('결제 창 오류: ' + (result.errorMsg || '알 수 없는 오류'));
        }
    });
}