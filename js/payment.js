// js/payment.js

let selectedProductUrl = "";
let selectedProductName = "";

// 페이지 로드 후 실행
document.addEventListener('DOMContentLoaded', () => {
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

    // ★ [수정 1] 로그인된 사용자 ID 가져오기
    const userId = localStorage.getItem('userId');

    // 유효성 검사
    if (!name || !rawPhone || !email || !selectedProductUrl) {
        alert("모든 정보를 입력하고 상품을 선택해주세요.");
        return;
    }

    // 비로그인 결제를 막고 싶다면 주석 해제하세요
    
    if (!userId) {
        alert("로그인이 필요한 서비스입니다.");
        window.location.href = 'login.html';
        return;
    }

    const formattedPhone = formatPhoneNumber(rawPhone);

    const btn = document.getElementById('submitBtn');
    const originalBtnText = btn.innerText;
    btn.innerText = "처리 중...";
    btn.disabled = true;

    const uniqueId = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    // 'StudyCrack_Payment' Lambda 함수의 URL
    const LAMBDA_URL = "https://dh6pn3wcxl5dp2dsi4kubqiuau0qnblq.lambda-url.ap-northeast-2.on.aws/"; 

    try {
        const response = await fetch(LAMBDA_URL, {
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
            // Stripe 결제 페이지로 이동
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