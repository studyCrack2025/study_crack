// js/payment.js

// ★ 1. 유저 정보를 가져올 API URL
const USER_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";

// ★ 2. 결제 요청용 API URL
const PAYMENT_API_URL = "https://dh6pn3wcxl5dp2dsi4kubqiuau0qnblq.lambda-url.ap-northeast-2.on.aws/"; 

let selectedProductUrl = null;
let selectedProductName = "";
let selectedTier = null; // 'basic', 'standard', 'pro', 'black'

// 페이지 로드 후 실행
document.addEventListener('DOMContentLoaded', () => {
    // 1. 로그인 체크 및 유저 정보 로드
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }
    
    // 유저 정보 가져오기 실행 (userId가 있을 때만)
    if (userId) {
        fetchUserInfo(userId);
    }

    // 전화번호 포맷팅 리스너
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            if (val.length >= 4) {
                e.target.value = val.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, `$1-$2-$3`);
            }
        });
    }
});

// 유저 정보 가져와서 채우기
async function fetchUserInfo(userId) {
    try {
        const response = await fetch(USER_API_URL, {
            method: 'POST',
            body: JSON.stringify({ type: 'get_user', userId: userId })
        });
        
        if (response.ok) {
            const data = await response.json();
            // 데이터 채우기
            if (data.name) document.getElementById('name').value = data.name;
            if (data.phone) document.getElementById('phone').value = data.phone;
            
            // 이메일은 로컬스토리지 우선
            const email = localStorage.getItem('userEmail');
            if (email) document.getElementById('email').value = email;
        }
    } catch (error) {
        console.error("유저 정보 로드 실패:", error);
    }
}

// ★ [수정됨] 상품 선택 함수
function selectProduct(element, url, tier) {
    // 1. 스타일 초기화 및 선택
    document.querySelectorAll('.product-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');

    // 2. 데이터 저장
    selectedProductUrl = url;
    selectedTier = tier;
    
    // 3. 상품명 추출 (HTML 구조 변경에 맞게 수정)
    // <span class="p-name">BASIC</span> 형태에서 텍스트 추출
    const nameSpan = element.querySelector('.p-name');
    if (nameSpan) {
        selectedProductName = nameSpan.innerText;
    }

    // 4. 버튼 텍스트 변경 (Black은 결제 없음)
    const btn = document.getElementById('submitBtn');
    if (tier === 'black') {
        btn.innerText = "상담 신청하기 (결제 없음)";
    } else {
        btn.innerText = "결제하기";
    }
}

// 전화번호 포맷팅 함수
function formatPhoneNumber(rawPhone) {
    let cleaned = rawPhone.replace(/[^0-9]/g, '');
    // 010 등으로 시작하게 보정
    if (cleaned.startsWith('10') && cleaned.length === 10) {
        cleaned = '0' + cleaned;
    }
    return cleaned.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, `$1-$2-$3`);
}

// ★ [수정됨] 결제 및 신청 처리 함수
async function processPayment() {
    const name = document.getElementById('name').value;
    const rawPhone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const userId = localStorage.getItem('userId') || 'guest'; // 비로그인 시 guest 처리

    // 유효성 검사
    if (!name || !rawPhone || !email) {
        alert("모든 정보를 입력해주세요.");
        return;
    }
    if (!selectedTier) {
        alert("신청할 프로그램을 선택해주세요.");
        return;
    }

    const formattedPhone = formatPhoneNumber(rawPhone);
    const btn = document.getElementById('submitBtn');
    const originalBtnText = btn.innerText;
    
    btn.innerText = "처리 중...";
    btn.disabled = true;

    // 주문 번호 생성
    const uniqueId = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    try {
        // 1. DB에 신청 내역 저장 (모든 티어 공통)
        const response = await fetch(PAYMENT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'submit_form',
                uniqueId: uniqueId,
                name: name,
                phone: formattedPhone,
                email: email,
                product: selectedProductName,
                tier: selectedTier, // 티어 정보 추가 전송
                userId: userId 
            })
        });

        if (response.ok) {
            // ★ 분기 처리: BLACK 티어는 결제 없이 성공 페이지로
            if (selectedTier === 'black') {
                window.location.href = `success.html?tier=black`;
            } 
            // 나머지 티어는 Stripe 결제 페이지로 이동
            else if (selectedProductUrl) {
                window.location.href = `${selectedProductUrl}?client_reference_id=${uniqueId}&prefilled_email=${email}`;
            }
        } else {
            throw new Error('Server response not ok');
        }
    } catch (error) {
        console.error("Error:", error);
        alert("오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        btn.disabled = false;
        btn.innerText = originalBtnText;
    }
}