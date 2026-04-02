// 1. 가격 및 설명 매핑 데이터
const TIER_DATA = {
    'test': { price: 100, desc: '시스템 연동 테스트용 결제' },
    'basic': { price: 25000, desc: '현재 위치 진단 및 전략 수립' },
    'standard': { price: 149000, desc: '월간 학습 코칭 (플래닝) 정기구독' },
    'pro': { price: 299000, desc: '최소 노력 최대 효율, 맞춤 전략 재설계 정기구독' },
    'trial': { price: 30000, desc: 'PRO 등급 한 달 완벽 체험' }
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

    // 4. 시작일(effective) 및 다음 결제일 계산
    const effectiveStart = new Date(checkoutData.effectiveStartDate || new Date());
    const nextDate = new Date(effectiveStart);
    nextDate.setDate(nextDate.getDate() + 28); // 4주(28일) 뒤

    const startM = effectiveStart.getMonth() + 1;
    const startD = effectiveStart.getDate();
    const nextM = nextDate.getMonth() + 1;
    const nextD = nextDate.getDate();
    
    const noticeBox = document.querySelector('.billing-notice');

    // BASIC, TRIAL은 1회성이므로 안내문구 숨김 처리
    if (checkoutData.tier === 'basic' || checkoutData.tier === 'trial') {
        noticeBox.style.display = 'none';
    } else {
        const now = new Date();
        // effectiveStart가 현재보다 미래라면 (연장 결제)
        if (effectiveStart > now) {
            noticeBox.innerHTML = `
                <i class="fas fa-info-circle" style="color:#3b82f6;"></i> 예약 결제 안내<br>
                새로운 구독은 기존 만료일인 <strong>${startM}월 ${startD}일</strong>부터 적용되며,<br>
                다음 정기 결제일은 <strong>${nextM}월 ${nextD}일</strong>입니다.
            `;
        } else {
            // 즉시 시작하는 경우
            noticeBox.innerHTML = `
                <i class="fas fa-info-circle"></i> 다음 결제일은 4주 뒤인 <strong>${nextM}월 ${nextD}일</strong>입니다. 언제든 해지 가능합니다.
            `;
        }
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

// 6. 최종 결제(빌링키 발급) 실제 API 요청 함수
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

    if (cNum.length < 15 || cExp.length !== 4 || cPwd.length !== 2 || cDob.length !== 6) {
        alert("신용카드 정보를 정확하게 입력해주세요.\n생년월일은 6자리(YYMMDD)로 입력해주세요. 예) 1999년 1월 1일 → 990101");
        return;
    }

    const btn = document.getElementById('btnFinalPay');
    const originalBtnText = btn.innerHTML;
    
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 결제 승인 중...`;
    btn.disabled = true;

    try {
        const checkoutData = JSON.parse(localStorage.getItem('checkoutData'));
        const token = localStorage.getItem('accessToken');

        if (!token) {
            alert("로그인이 만료되었습니다. 다시 로그인해 주세요.");
            window.location.href = '/login';
            return;
        }

        const response = await fetch(CONFIG.api.payment, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                type: "create_nicepay_billing",
                user: checkoutData,
                card: { 
                    num: cNum, 
                    exp: cExp, 
                    pwd: cPwd, 
                    dob: cDob 
                }
            })
        });

        const result = await response.json();

        if (response.ok && result.success) {
            // 결제(빌링키 발급) 완벽 성공
            localStorage.removeItem('checkoutData'); // 보안 및 정리 차원에서 로컬스토리지 삭제
            alert("결제가 성공적으로 완료되었습니다!");
            window.location.href = '/success';
        } else {
            // 승인 거절 (잔액 부족, 카드 번호 오류 등)
            alert("결제 실패: " + (result.message || "카드 정보를 다시 확인해주세요."));
            btn.disabled = false;
            btn.innerHTML = originalBtnText;
        }

    } catch (error) {
        console.error("Payment Request Error:", error);
        alert("서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
}