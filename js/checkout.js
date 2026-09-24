// 1. 티어별 설명 매핑
const TIER_DATA = {
    'test':     { desc: '시스템 연동 테스트용 결제' },
    'basic':    { desc: 'BASIC AI 기반 합격 예측 분석 이용권' },
    'starter':  { desc: 'STARTER 1주 플래너 진단 이용권' },
    'standard': { desc: 'STANDARD 4주 합격 플래너 설계 이용권' },
    'pro':      { desc: 'PRO 4주 프리미엄 전략 관리 이용권' }
};

let checkoutData = null;

function initCheckoutExitGuard() {
    if (!window.PaymentExitGuard) return;
    window.PaymentExitGuard.init({
        contactUrl: '/qna?source=payment_exit&stage=checkout',
        backUrl: '/payment',
        historyTrap: true,
        shouldGuard: () => !!checkoutData,
        isPaymentInProgress: () => isPaymentInProgress
    });
}

function allowCheckoutNavigationOnce() {
    if (window.PaymentExitGuard) window.PaymentExitGuard.allowNavigationOnce();
}

function toYyyyMmDd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

function getVbankExpDate(daysAhead = 7) {
    const dt = new Date();
    dt.setDate(dt.getDate() + daysAhead);
    return toYyyyMmDd(dt);
}

document.addEventListener('DOMContentLoaded', () => {
    // 2. payment.js에서 넘어온 데이터 불러오기
    const dataStr = localStorage.getItem('checkoutData');
    if (!dataStr) {
        alert("결제 정보가 유효하지 않습니다. 다시 선택해주세요.");
        window.location.href = '/payment';
        return;
    }

    checkoutData = JSON.parse(dataStr);

    if (!checkoutData.paymentIntentId || checkoutData.orderId !== checkoutData.paymentIntentId || !checkoutData.amount) {
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

    // 5. 결제 안내 문구 (단건 결제 기준)
    const noticeBox = document.getElementById('billingNotice');
    if (noticeBox) {
        if (checkoutData.tier === 'free' || checkoutData.tier === 'test') {
            noticeBox.style.display = 'none';
        } else {
            const effectiveStart = new Date(checkoutData.effectiveStartDate || new Date());
            const startM = effectiveStart.getMonth() + 1;
            const startD = effectiveStart.getDate();

            if (effectiveStart > new Date()) {
                noticeBox.innerHTML = `<i class="fas fa-info-circle" style="color:#0284c7;"></i> 예약 결제 안내<br>선택한 4주 이용권은 <strong>${startM}월 ${startD}일</strong>부터 적용됩니다.`;
            } else {
                noticeBox.innerHTML = `<i class="fas fa-info-circle" style="color:#0284c7;"></i> 본 결제는 단건 결제이며, 결제 후 <strong>4주 이용권</strong>이 제공됩니다.`;
            }
        }
    }

    // 6. 결제 수단 카드 선택 시 시각적 표시
    document.querySelectorAll('.payment-method-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.payment-method-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    initCheckoutExitGuard();
});

// 7. 결제창 호출
let isPaymentInProgress = false;
function submitCheckout() {
    if (isPaymentInProgress) return;
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

    if (!checkoutData || !checkoutData.paymentIntentId || checkoutData.orderId !== checkoutData.paymentIntentId) {
        alert("결제 정보가 만료되었습니다. 다시 결제를 진행해주세요.");
        allowCheckoutNavigationOnce();
        window.location.href = '/payment';
        return;
    }
    const amount = Number(checkoutData.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
        alert("결제 금액 정보가 올바르지 않습니다. 다시 결제를 진행해주세요.");
        allowCheckoutNavigationOnce();
        window.location.href = '/payment';
        return;
    }

    isPaymentInProgress = true;
    const payBtn = document.getElementById('btnFinalPay') || document.querySelector('.btn-checkout');
    if (payBtn) { payBtn.disabled = true; payBtn.style.opacity = '0.6'; }

    try {
        const mallReserved = { paymentIntentId: checkoutData.paymentIntentId };

        const requestPayload = {
            clientId:   CONFIG.nicepay.clientId,
            method:     selectedMethod.value,
            orderId:    checkoutData.orderId,
            amount:     amount,
            goodsName:  `스터디크랙 ${checkoutData.productName} 이용권`,
            buyerName:  checkoutData.name,
            buyerEmail: checkoutData.email,
            buyerTel:   checkoutData.phone,
            returnUrl:  CONFIG.api.payment_return,
            notifyUrl:  CONFIG.api.payment_notify,
            mallReserved: JSON.stringify(mallReserved),
            fnError: function(result) {
                console.error('[NicePay Error]', result);
                isPaymentInProgress = false;
                if (payBtn) { payBtn.disabled = false; payBtn.style.opacity = '1'; }
                alert('결제 창 오류: ' + (result.errorMsg || '알 수 없는 오류'));
            }
        };

        if (selectedMethod.value === 'vbank') {
            requestPayload.vbankHolder = checkoutData.name;
            requestPayload.vbankExpDate = getVbankExpDate(7);
            requestPayload.vbankValidHours = 168;
        }

        AUTHNICE.requestPay(requestPayload);
    } catch (error) {
        isPaymentInProgress = false;
        if (payBtn) { payBtn.disabled = false; payBtn.style.opacity = '1'; }
        console.error('[NicePay Exception]', error);
        alert('결제 요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
}
