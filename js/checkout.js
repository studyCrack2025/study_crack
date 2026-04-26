// 1. 티어별 설명 매핑
const TIER_DATA = {
    'test':     { desc: '시스템 연동 테스트용 결제' },
    'basic':    { desc: '현재 위치 진단 및 전략 수립' },
    'standard': { desc: '월간 학습 코칭 (플래닝) 28일 이용권' },
    'pro':      { desc: '최소 노력 최대 효율, 맞춤 전략 재설계 28일 이용권' },
    'trial':    { desc: 'PRO 등급 한 달 완벽 체험' }
};

let checkoutData = null;

document.addEventListener('DOMContentLoaded', () => {
    // 2. payment.js에서 넘어온 데이터 불러오기
    const dataStr = localStorage.getItem('checkoutData');
    if (!dataStr) {
        alert("결제 정보가 유효하지 않습니다. 다시 선택해주세요.");
        window.location.href = '/payment';
        return;
    }

    checkoutData = JSON.parse(dataStr);

    // orderId 또는 amount 누락 시 (구버전 데이터) 재진입 유도
    if (!checkoutData.orderId || !checkoutData.amount) {
        alert("결제 정보가 만료되었습니다. 다시 선택해주세요.");
        window.location.href = '/payment';
        return;
    }

    const tierInfo = TIER_DATA[checkoutData.tier];
    if (!tierInfo) {
        window.location.href = '/payment';
        return;
    }

    // 3. 좌측 주문자 정보 채우기
    document.getElementById('buyerName').textContent  = checkoutData.name  || '-';
    document.getElementById('buyerPhone').textContent = checkoutData.phone || '-';
    document.getElementById('buyerEmail').textContent = checkoutData.email || '-';

    // 4. 우측 주문 내역 채우기
    document.getElementById('chkProductName').textContent = checkoutData.productName;
    document.getElementById('chkProductDesc').textContent = tierInfo.desc;

    const formattedPrice = Number(checkoutData.amount).toLocaleString() + '원';
    document.getElementById('chkPrice').textContent    = formattedPrice;
    document.getElementById('btnPayAmount').textContent = formattedPrice;

    // 5. 결제 안내 문구
    const noticeBox = document.getElementById('billingNotice');
    if (checkoutData.tier === 'basic' || checkoutData.tier === 'trial') {
        noticeBox.style.display = 'none';
    } else {
        const effectiveStart = new Date(checkoutData.effectiveStartDate || new Date());
        const nextDate = new Date(effectiveStart);
        nextDate.setDate(nextDate.getDate() + 28);
        const startM = effectiveStart.getMonth() + 1;
        const startD = effectiveStart.getDate();
        const nextM  = nextDate.getMonth() + 1;
        const nextD  = nextDate.getDate();

        if (effectiveStart > new Date()) {
            noticeBox.innerHTML = `<i class="fas fa-info-circle" style="color:#0284c7;"></i> 예약 적용 안내: 기존 이용권 만료일인 <strong>${startM}월 ${startD}일</strong>부터 적용되며, <strong>${nextM}월 ${nextD}일</strong>까지 이용 가능합니다.`;
        } else {
            noticeBox.innerHTML = `<i class="fas fa-info-circle" style="color:#0284c7;"></i> 결제 완료 시 28일간 이용 가능하며, 만료일은 <strong>${nextM}월 ${nextD}일</strong>입니다.`;
        }
    }

    // 6. 결제 수단 카드 선택 시 시각적 표시
    document.querySelectorAll('.payment-method-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
});

// 7. 결제창 호출
function submitCheckout() {
    const agree = document.getElementById('agreeTerms').checked;
    if (!agree) {
        alert("이용약관에 동의해주세요.");
        return;
    }

    const selectedMethod = document.querySelector('input[name="payMethod"]:checked');
    if (!selectedMethod) {
        alert("결제 수단을 선택해주세요.");
        return;
    }

    const token = localStorage.getItem('accessToken');
    if (!token) {
        alert("로그인이 만료되었습니다. 다시 로그인해 주세요.");
        window.location.href = '/login';
        return;
    }

    AUTHNICE.requestPay({
        clientId:   CONFIG.nicepay.clientId,
        method:     selectedMethod.value,
        orderId:    checkoutData.orderId,
        amount:     checkoutData.amount,
        goodsName:  `스터디크랙 ${checkoutData.productName} 멤버십`,
        buyerName:  checkoutData.name,
        buyerEmail: checkoutData.email,
        buyerTel:   checkoutData.phone,
        returnUrl:  CONFIG.api.payment_return,
        mallReserved: JSON.stringify({
            userId:             checkoutData.userId,
            tier:               checkoutData.tier,
            productName:        checkoutData.productName,
            effectiveStartDate: checkoutData.effectiveStartDate,
            siteOrigin:         window.location.origin
        }),
        fnError: function(result) {
            console.error('[NicePay Error]', result);
            alert('결제 창 오류: ' + (result.errorMsg || '알 수 없는 오류'));
        }
    });
}
