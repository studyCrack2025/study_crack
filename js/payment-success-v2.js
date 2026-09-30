(function (root) {
  'use strict';
  var plans = { basic: 'BASIC', starter: 'STARTER', standard: 'STANDARD', pro: 'PRO' };
  var intentPattern = /^PI_(?:[0-9a-f]{32}|[0-9a-f-]{36})$/i;
  function validPayment(data, expectedId) {
    return data && data.paymentIntentId === expectedId && intentPattern.test(expectedId)
      && data.purchaseKind === 'subscription' && Object.hasOwn(plans, String(data.tier || '').toLowerCase())
      && Number.isSafeInteger(data.amount) && data.amount >= 0
      && ['paid','vbank_ready','intent_created','failed','expired','cancelled'].includes(data.status);
  }
  function text(id, value) { root.document.getElementById(id).textContent = value; }
  function message(title, description, action, href) {
    text('successTitle', title); text('successDesc', description); text('actionBtn', action);
    root.document.getElementById('actionBtn').href = href;
  }
  async function start() {
    var params = new URL(root.location.href).searchParams;
    var id = params.get('paymentIntentId');
    var isRetiredKccPromo = params.get('status') === 'promo' && (params.get('source') || '').toLowerCase() === 'kcc01';
    if (isRetiredKccPromo) {
      text('tierBadge', '종료된 프로모션');
      message('종료된 프로모션입니다', '현재 신청할 수 없는 프로모션입니다. 다른 서비스를 확인해 주세요.', '홈으로 돌아가기', '/');
      root.history.replaceState({}, root.document.title, root.location.pathname);
      return;
    }
    text('tierBadge', '결제 확인');
    message('결제 내역을 확인하고 있습니다', '잠시만 기다려 주세요.', '마이페이지로 이동', '/mypage');
    // URL parameters are lookup hints only; payment facts must come from the authenticated API.
    if (!id || !intentPattern.test(id)) {
      message('결제 내역 확인이 필요합니다', '이 주소만으로는 결제 완료 여부를 확인할 수 없습니다. 마이페이지에서 결제 내역을 확인해 주세요.', '마이페이지로 이동', '/mypage');
      root.history.replaceState({}, root.document.title, root.location.pathname);
      return;
    }
    root.history.replaceState({}, root.document.title, root.location.pathname + '?paymentIntentId=' + encodeURIComponent(id));
    try {
      if (!await root.resolveUserIdentity('none')) {
        message('로그인 후 확인해 주세요', '결제한 계정으로 로그인하면 결제 내역을 확인할 수 있습니다.', '로그인하기', '/login?returnUrl=' + encodeURIComponent('/success?paymentIntentId=' + id));
        return;
      }
      var response = await root.apiFetch(root.CONFIG.api.payment, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({type:'get_payment_status',data:{paymentIntentId:id}})
      });
      if (!response.ok) throw new Error('Payment status unavailable');
      var result = await response.json(), payment = result && result.data;
      if (result.success !== true || !validPayment(payment, id)) throw new Error('Invalid payment status');
      var plan = payment.tier.toLowerCase();
      text('tierBadge', plans[plan] + ' PLAN');
      if (payment.status === 'paid') {
        message('결제가 완료되었습니다!', plans[plan] + ' 결제 금액 ' + payment.amount.toLocaleString('ko-KR') + '원' + (payment.fulfillmentStatus === 'fulfilled' ? ' · 서비스를 이용하실 수 있습니다.' : ' · 서비스 반영 중입니다. 잠시 후 마이페이지를 확인해 주세요.'), '마이페이지로 이동', '/mypage');
        root.localStorage.removeItem('checkoutData');
        // Measurement failures must not turn a confirmed payment into an error screen.
        try {
          await root.SCMeasurementV2.purchase({status:'paid',transaction_id:payment.paymentIntentId,value:payment.amount,currency:'KRW',plan_type:plan});
        } catch (_) {}
      } else if (payment.status === 'vbank_ready') {
        message('입금을 기다리고 있습니다', '가상계좌 발급은 결제 완료가 아닙니다. 입금 후 결제 내역을 확인해 주세요.', '마이페이지로 이동', '/mypage');
        var vbank = payment.vbank || {};
        text('vbankBank', vbank.bankName || '-'); text('vbankAccount', vbank.accountNo || '-');
        text('vbankHolder', vbank.holder || '-'); text('vbankExpire', vbank.expireDate || '-');
        text('vbankAmount', payment.amount.toLocaleString('ko-KR') + '원');
        root.document.getElementById('vbankBox').style.display = 'block';
      } else {
        var titles = {intent_created:'결제가 아직 완료되지 않았습니다',failed:'결제가 완료되지 않았습니다',expired:'결제 요청이 만료되었습니다',cancelled:'취소된 결제입니다'};
        message(titles[payment.status], '결제 내역을 확인한 뒤 다시 진행해 주세요.', '마이페이지로 이동', '/mypage');
      }
    } catch (_) {
      message('결제 내역을 확인하지 못했습니다', '잠시 후 새로고침하거나 마이페이지에서 결제 내역을 확인해 주세요.', '마이페이지로 이동', '/mypage');
    }
  }
  root.document.addEventListener('DOMContentLoaded', start);
})(window);
