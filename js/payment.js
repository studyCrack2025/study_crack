// js/payment.js

const USER_API_URL = CONFIG.api.base;
const PAYMENT_API_URL = CONFIG.api.payment;

let selectedProductName = "";
let selectedTier = null; 

// 티어 비교를 위한 전역 변수
const TIER_LEVELS = { 'free': 0, 'basic': 1, 'standard': 2, 'pro': 3 };
let globalCurrentTier = 'free';
let globalDaysLeft = 0;

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
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(USER_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ type: 'get_user' }) 
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.name) document.getElementById('name').value = data.name;
            if (data.phone) document.getElementById('phone').value = data.phone;
            const email = localStorage.getItem('userEmail') || data.email;
            if (email) document.getElementById('email').value = email;

            // 프론트엔드에서 남은 기간 및 티어 계산
            calculateUserTierDisplay(data);
            
            if (data.promoCode) {
                validatePromoCode(data.promoCode);
            }
        }
    } catch (error) {
        console.error("유저 정보 로드 실패:", error);
    }
}

async function validatePromoCode(code) {
    const token = localStorage.getItem('accessToken');
    try {
        const response = await fetch(USER_API_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({ 
                type: 'validate_promo_code',
                data: { promoCode: code } 
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            
            // 백엔드에서 isValid: true를 뱉어내면 체험단 메뉴 노출
            if (result.isValid) {
                const trialOption = document.getElementById('trialOption');
                if(trialOption) trialOption.style.display = 'block'; 

                TIER_LEVELS['trial'] = 1; 
                TIER_LEVELS['basic'] = 2;
                TIER_LEVELS['standard'] = 3;
                TIER_LEVELS['pro'] = 4;
            }
        }
    } catch (error) {
        console.error("프로모션 코드 검증 API 호출 실패", error);
    }
}

// 구독 기간 계산 헬퍼
function calculateUserTierDisplay(data) {
    globalCurrentTier = data.computedTier || 'free';

    if (globalCurrentTier !== 'free' && data.payments && data.payments.length > 0) {
        // 가장 최근 결제내역 찾기
        const paid = data.payments.filter(p => p.status === 'paid').sort((a,b) => new Date(b.date) - new Date(a.date));
        
        if (paid.length > 0) {
            const payDate = new Date(paid[0].date);
            const expireDate = new Date(payDate.getTime() + (28 * 24 * 60 * 60 * 1000)); // 28일 더하기
            const now = new Date();
            
            globalDaysLeft = Math.ceil((expireDate - now) / (1000 * 60 * 60 * 24));
            
            // 상단 배너 표시
            const banner = document.getElementById('activeSubBanner');
            document.getElementById('activeSubName').innerText = globalCurrentTier.toUpperCase();
            document.getElementById('activeSubDate').innerText = `${expireDate.getFullYear()}년 ${expireDate.getMonth()+1}월 ${expireDate.getDate()}일까지 유효`;
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
    }
}

// 상품 선택 로직
function selectProduct(element, url, tier) {
    document.querySelectorAll('.product-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    selectedTier = tier;
    const nameSpan = element.querySelector('.p-name');
    if (nameSpan) selectedProductName = nameSpan.innerText;

    // 티어 등급 판별 로직
    const selectedLevel = TIER_LEVELS[selectedTier];
    const currentLevel = TIER_LEVELS[globalCurrentTier];

    const msgWrap = document.getElementById('tierMessageWrap');
    const msgText = document.getElementById('tierMessageText');
    const btn = document.getElementById('submitBtn');

    // 기본 상태로 초기화
    msgWrap.style.display = 'none';
    msgWrap.className = 'tier-message-wrap'; // warning 클래스 제거용
    btn.disabled = false;
    btn.innerText = "결제하기";

    // Free 유저는 모든 플랜 결제 가능하므로 무시
    if (currentLevel > 0) {
        
        if (selectedLevel === currentLevel) {
            // 1. 동일한 티어 선택 시
            msgWrap.style.display = 'block';
            msgText.innerHTML = `<i class="fas fa-check-circle" style="color:#10b981;"></i> 회원님이 현재 이용 중인 플랜입니다.`;
            btn.disabled = true;
            btn.innerText = "현재 이용 중인 플랜";

        } else if (selectedLevel < currentLevel) {
            // 2. 하위 티어 선택 시 (경고)
            msgWrap.style.display = 'block';
            msgWrap.classList.add('warning');
            msgText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> 이미 <strong>${globalCurrentTier.toUpperCase()}</strong> 등급 회원입니다. 아래 등급을 구독하실 경우 기존 혜택에 불이익이 발생할 수 있습니다.`;
            btn.disabled = true;
            btn.innerText = "하위 플랜 선택 불가";

        } else if (selectedLevel > currentLevel) {
            // 3. 상위 티어 선택 시 (업그레이드 안내)
            msgWrap.style.display = 'block';
            msgText.innerHTML = `<i class="fas fa-info-circle" style="color:#3b82f6;"></i> 기존 구독 기간이 <strong>${globalDaysLeft}일</strong> 남았습니다.<br><strong>${selectedTier.toUpperCase()}</strong> 등급으로 업그레이드를 원하시면 <strong>[1:1 문의]</strong>에 남겨주세요. 빠르게 차액 결제 및 전환을 도와드리겠습니다.`;
            btn.disabled = true;
            btn.innerText = "업그레이드 불가 (문의 요망)";
        }
    }
}

function formatPhoneNumber(rawPhone) {
    let cleaned = rawPhone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('10') && cleaned.length === 10) {
        cleaned = '0' + cleaned;
    }
    return cleaned.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, `$1-$2-$3`);
}

// 결제 데이터 세팅 및 페이지 이동 (Checkout 연동)
async function processPayment() {
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

    const checkoutData = {
        name: name,
        phone: formattedPhone,
        email: email,
        tier: selectedTier,
        productName: selectedProductName
    };
    
    localStorage.setItem('checkoutData', JSON.stringify(checkoutData));
    
    // 이전 스텝에서 만든 checkout.html 페이지로 이동
    if (selectedTier === 'trial') {
        window.location.href = '/checkout-transfer'; // 새로 만들 페이지
    } else {
        window.location.href = '/checkout';
    }
}