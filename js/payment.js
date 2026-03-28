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
        // 2. Standard / Pro 유저인 경우 (7일 제한 로직 적용)
        else if (globalCurrentTier === 'standard' || globalCurrentTier === 'pro') {
            if (selectedLevel < currentLevel) {
                // 다운그레이드: 7일 이하 남았을 때만 허용
                if (globalDaysLeft <= 7 && globalDaysLeft > 0) {
                    msgWrap.style.display = 'block';
                    msgWrap.classList.add('warning');
                    msgText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <strong>다운그레이드 주의:</strong> 기존 만료일 이후부터는 <strong>${globalCurrentTier.toUpperCase()}</strong> 전용 혜택을 이용하실 수 없습니다. 계속 진행하시겠습니까?`;
                    btn.disabled = false;
                    btn.innerText = "하위 플랜으로 예약 결제";
                } else {
                    msgWrap.style.display = 'block';
                    msgWrap.classList.add('warning');
                    msgText.innerHTML = `<i class="fas fa-clock"></i> 기존 구독 기간이 <strong>${globalDaysLeft}일</strong> 남았습니다. 하위 플랜으로의 변경은 만료 7일 전부터 가능합니다.`;
                    btn.disabled = true;
                    btn.innerText = "플랜 변경 기간 아님";
                }
            } else if (selectedLevel === currentLevel) {
                // 동일 티어 연장 (7일 이하 남았을 때만 허용)
                if (globalDaysLeft <= 7 && globalDaysLeft > 0) {
                    msgWrap.style.display = 'block';
                    msgText.innerHTML = `<i class="fas fa-info-circle" style="color:#3b82f6;"></i> 기존 구독 기간이 <strong>${globalDaysLeft}일</strong> 남았습니다.<br>지금 결제하시면 기존 만료일 이후로 4주가 연장됩니다.`;
                    btn.innerText = "연장 결제하기";
                } else {
                    msgWrap.style.display = 'block';
                    msgWrap.classList.add('warning');
                    msgText.innerHTML = `<i class="fas fa-clock"></i> 기존 구독 기간이 <strong>${globalDaysLeft}일</strong> 남았습니다. 연장 결제는 만료 7일 전부터 가능합니다.`;
                    btn.disabled = true;
                    btn.innerText = "연장 결제 기간 아님";
                }
            } else if (selectedLevel > currentLevel) {
                // 상위 티어로 업그레이드 (Standard -> Pro)
                if (globalDaysLeft <= 7 && globalDaysLeft > 0) {
                    msgWrap.style.display = 'block';
                    msgText.innerHTML = `<i class="fas fa-info-circle" style="color:#3b82f6;"></i> 기존 구독 기간이 <strong>${globalDaysLeft}일</strong> 남았습니다.<br>지금 결제하시면 기존 만료일 이후로 <strong>PRO</strong> 혜택이 적용됩니다.`;
                    btn.innerText = "예약 업그레이드 결제";
                } else {
                    msgWrap.style.display = 'block';
                    msgText.innerHTML = `<i class="fas fa-info-circle" style="color:#3b82f6;"></i> 구독 기간이 <strong>${globalDaysLeft}일</strong> 남았습니다.<br>즉시 업그레이드를 원하시면 <strong>[1:1 문의]</strong>에 남겨주세요. 차액 결제를 도와드립니다.`;
                    btn.disabled = true;
                    btn.innerText = "업그레이드 불가 (문의 요망)";
                }
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

// 결제 데이터 세팅 및 페이지 이동 (시작일 계산 포함)
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

    // 결제 시작일(effectiveStartDate) 설정 로직
    let startDate = new Date();
    // Standard/Pro 연장 또는 예약 업그레이드 시, 시작일을 만료일로 지정
    if ((globalCurrentTier === 'standard' || globalCurrentTier === 'pro') && globalDaysLeft <= 7 && globalDaysLeft > 0 && globalExpireDate) {
        startDate = globalExpireDate;
    }

    const checkoutData = {
        name: name,
        phone: formattedPhone,
        email: email,
        tier: selectedTier,
        productName: selectedProductName,
        effectiveStartDate: startDate.toISOString(),
        userId: localStorage.getItem('userId') 
    };

    localStorage.setItem('checkoutData', JSON.stringify(checkoutData));
    window.location.href = '/checkout'; 
}