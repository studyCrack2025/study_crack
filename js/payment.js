// js/payment.js

let selectedProductUrl = "";
let selectedProductName = "";

// 페이지 로드 후 실행 (전화번호 입력 이벤트 리스너 등록)
document.addEventListener('DOMContentLoaded', () => {
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            // 입력된 숫자를 포맷팅해서 다시 입력창에 보여줌
            if (val.length >= 4) {
                e.target.value = val.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, `$1-$2-$3`);
            }
        });
    }
});

// 상품 선택 함수
function selectProduct(element, url) {
    // 1. 모든 옵션 선택 스타일 해제
    document.querySelectorAll('.product-option').forEach(el => el.classList.remove('selected'));
    
    // 2. 클릭한 옵션 선택 스타일 적용
    element.classList.add('selected');
    selectedProductUrl = url;
    
    // 3. name 속성값 가져오기
    const headerDiv = element.querySelector('.product-header');
    selectedProductName = headerDiv.getAttribute('name');
}

// 전화번호 포맷팅 함수 (제출용)
function formatPhoneNumber(rawPhone) {
    // 1. 숫자 이외의 문자는 모두 제거
    let cleaned = rawPhone.replace(/[^0-9]/g, '');

    // 2. 010 형식이 아니면(예: 1012345678) 0 붙이기
    if (cleaned.startsWith('10') && cleaned.length === 10) {
        cleaned = '0' + cleaned;
    }

    // 3. 010-1234-5678 형식으로 반환
    return cleaned.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, `$1-$2-$3`);
}

// 결제 처리 함수
async function processPayment() {
    const name = document.getElementById('name').value;
    const rawPhone = document.getElementById('phone').value;
    const email = document.getElementById('email').value;

    // 유효성 검사
    if (!name || !rawPhone || !email || !selectedProductUrl) {
        alert("모든 정보를 입력하고 상품을 선택해주세요.");
        return;
    }

    // 전화번호 포맷팅
    const formattedPhone = formatPhoneNumber(rawPhone);

    // 버튼 비활성화 (중복 클릭 방지)
    const btn = document.getElementById('submitBtn');
    const originalBtnText = btn.innerText;
    btn.innerText = "처리 중...";
    btn.disabled = true;

    // 1. 고유 주문번호 생성
    const uniqueId = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

    // 2. AWS Lambda URL (API)
    // 실제 배포 시에는 config.js 같은 곳에서 관리하는 것이 좋습니다.
    const LAMBDA_URL = "https://5ydzn4zzijnh3zhzv2npa7tseq0nbnmi.lambda-url.ap-northeast-2.on.aws/"; 

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
                product: selectedProductName
            })
        });

        if (response.ok) {
            // 3. Stripe 결제 페이지로 이동
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