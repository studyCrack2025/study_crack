// js/checkout.js

// 1. 가격 및 설명 매핑 데이터
const TIER_DATA = {
    'basic': { price: 49000, desc: '현재 위치 진단 및 전략 수립' },
    'standard': { price: 149000, desc: '월간 학습 코칭 (플래닝) 정기구독' },
    'pro': { price: 299000, desc: '최소 노력 최대 효율, 맞춤 전략 재설계 정기구독' }
};

document.addEventListener('DOMContentLoaded', () => {
    // 2. payment.js에서 넘어온 임시 데이터 불러오기
    const dataStr = localStorage.getItem('checkoutData');
    if (!dataStr) {
        alert("결제 정보가 유효하지 않습니다. 다시 선택해주세요.");
        window.location.href = '/payment';
        return;
    }

    const checkoutData = JSON.parse(dataStr);
    const tierInfo = TIER_DATA[checkoutData.tier];

    if (!tierInfo) {
        window.location.href = '/payment';
        return;
    }

    // 3. 좌측 패널 정보 채우기
    document.getElementById('chkProductName').innerText = checkoutData.productName;
    document.getElementById('chkProductDesc').innerText = tierInfo.desc;
    
    const formattedPrice = tierInfo.price.toLocaleString() + '원';
    document.getElementById('chkPrice').innerText = formattedPrice;
    document.getElementById('btnPayAmount').innerText = formattedPrice;

    // 4. 다음 결제일 계산 (한 달 뒤)
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    const month = nextDate.getMonth() + 1;
    const date = nextDate.getDate();
    
    // BASIC은 1회성이므로 안내문구 숨김 처리
    if (checkoutData.tier === 'basic') {
        document.querySelector('.billing-notice').style.display = 'none';
    } else {
        document.getElementById('chkNextDate').innerText = `${month}월 ${date}일`;
    }

    // 5. 카드 폼 자동 포맷팅 리스너 등록
    setupCardFormatters();
});

function setupCardFormatters() {
    const cardNumInput = document.getElementById('cardNumber');
    cardNumInput.addEventListener('input', function () {
        let val = this.value.replace(/[^0-9]/g, '');
        let formatted = val.match(/.{1,4}/g)?.join(' - ') || '';
        this.value = formatted;
    });

    const cardExpiryInput = document.getElementById('cardExpiry');
    cardExpiryInput.addEventListener('input', function () {
        let val = this.value.replace(/[^0-9]/g, '');
        if (val.length > 2) {
            this.value = val.substring(0, 2) + ' / ' + val.substring(2, 4);
        } else {
            this.value = val;
        }
    });
}

// 6. 최종 결제(빌링키 발급) 요청 모의 함수
async function submitCheckout() {
    const agree = document.getElementById('agreeTerms').checked;
    if (!agree) {
        alert("이용약관에 동의해주세요.");
        return;
    }

    const cNum = document.getElementById('cardNumber').value.replace(/[^0-9]/g, '');
    const cExp = document.getElementById('cardExpiry').value.replace(/[^0-9]/g, '');
    const cPwd = document.getElementById('cardPwd').value;
    const cDob = document.getElementById('cardAuthDob').value;

    if (cNum.length < 15 || cExp.length !== 4 || cPwd.length !== 2 || cDob.length < 6) {
        alert("신용카드 정보를 정확하게 입력해주세요.");
        return;
    }

    const btn = document.getElementById('btnFinalPay');
    const originalBtnText = btn.innerHTML;
    
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 결제 승인 중...`;
    btn.disabled = true;

    try {
        const checkoutData = JSON.parse(localStorage.getItem('checkoutData'));

        /*
         TODO: 백엔드 연동 단계에서 아래 데이터를 Lambda로 전송합니다.
         {
             type: "create_nicepay_billing",
             user: checkoutData,
             card: { num: cNum, exp: cExp, pwd: cPwd, dob: cDob }
         }
        */

        console.log("나이스페이 빌링키 요청 준비 완료:", checkoutData);

        setTimeout(() => {
            alert("프론트엔드 UI 구축 완료! 백엔드 NICEPAY 연동 대기중...");
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }, 1500);

    } catch (error) {
        alert("결제 처리 중 오류가 발생했습니다.");
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
}