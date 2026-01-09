// js/payment.js

// ★ 1. 유저 정보를 가져올 API URL (StudyCrack_API 함수 URL)
const USER_API_URL = "https://txbtj65lvfsbprfcfg6dlgruhm0iyjjg.lambda-url.ap-northeast-2.on.aws/";

// ★ 2. 결제 요청용 API URL
const PAYMENT_API_URL = "https://dh6pn3wcxl5dp2dsi4kubqiuau0qnblq.lambda-url.ap-northeast-2.on.aws/"; 

let selectedProductUrl = "";
let selectedProductName = "";

// 페이지 로드 후 실행
document.addEventListener('DOMContentLoaded', () => {
    // 1. 로그인 체크 및 유저 정보 로드
    const userId = localStorage.getItem('userId');
    if (!userId) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html';
        return;
    }
    
    // 유저 정보 가져오기 실행
    fetchUserInfo(userId);

    // 전화번호 포맷팅 리스너 (혹시 수정할 경우 대비)
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

// ★ [신규] 유저 정보 가져와서 채우기
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
            
            // 이메일은 Cognito 로그인 시 저장한 로컬스토리지에서 가져옴
            const email = localStorage.getItem('userEmail');
            if (email) document.getElementById('email').value = email;
        }
    } catch (error) {
        console.error("유저 정보 로드 실패:", error);
    }
}

// 상품 선택 함수
function selectProduct(element, url) {
    document.querySelectorAll('.product-option').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    selectedProductUrl = url;
    
    const headerDiv = element.querySelector('.product-header');
    selectedProductName = headerDiv.getAttribute('name');
}

// 전화번호 포맷팅 함수
function formatPhoneNumber(rawPhone) {
    let cleaned = rawPhone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('10') && cleaned.length === 10) {
        cleaned = '0' + cleaned;
    }
    return cleaned.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, `$1-$2-$3`);
}

// 결제 처리 함수
async function processPayment() {
    const name = document.getElementById('name').value;
    const rawPhone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;
    const userId = localStorage.getItem('userId');

    if (!name || !rawPhone || !email || !selectedProductUrl) {
        alert("모든 정보를 입력하고 상품을 선택해주세요.");
        return;
    }

    const formattedPhone = formatPhoneNumber(rawPhone);
    const btn = document.getElementById('submitBtn');
    const originalBtnText = btn.innerText;
    
    btn.innerText = "처리 중...";
    btn.disabled = true;

    const uniqueId = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    try {
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
                userId: userId 
            })
        });

        if (response.ok) {
            // Stripe 페이지로 이동
            window.location.href = `${selectedProductUrl}?client_reference_id=${uniqueId}&prefilled_email=${email}`;
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