(() => {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const byId = id => document.getElementById(id);
        const title = byId('successTitle');
        const desc = byId('successDesc');
        const badge = byId('tierBadge');
        const retry = byId('statusRetry');
        const action = byId('actionBtn');
        const bank = byId('vbankBox');
        const id = new URLSearchParams(location.search).get('paymentIntentId') || '';
        const validId = /^PI_(?:[0-9a-f]{32}|[0-9a-f-]{36})$/i.test(id);
        const labels = { BASIC: 'BASIC', STARTER: 'STARTER', STANDARD: 'STANDARD', PRO: 'PRO', TEST: 'TEST' };
        let generation = 0;
        let inFlight = false;
        let controller = null;
        const account = () => { try { return localStorage.getItem('userId') || ''; } catch (_) { return ''; } };

        function clearDetails() {
            badge.textContent = '결제 확인';
            bank.style.display = 'none';
            for (const field of ['vbankBank', 'vbankAccount', 'vbankHolder', 'vbankAmount', 'vbankExpire']) byId(field).textContent = '-';
            action.textContent = '문의하기';
            action.href = '/qna';
            action.removeAttribute('target');
            action.removeAttribute('rel');
        }
        function show(heading, message) {
            title.textContent = heading;
            desc.textContent = message;
        }
        function invalidate() {
            generation++;
            controller?.abort();
            inFlight = false;
            clearDetails();
            retry.disabled = false;
            retry.removeAttribute('aria-busy');
            show('결제 상태를 다시 확인해주세요', '계정이나 화면이 변경되었습니다. 다시 결제하지 말고 상태를 확인해주세요.');
        }
        window.addEventListener('pagehide', invalidate);
        window.addEventListener('storage', event => {
            if (event.key === null || ['userId', 'accessToken', 'token', 'refreshToken'].includes(event.key)) invalidate();
        });

        async function refresh() {
            if (inFlight || !validId) return;
            inFlight = true;
            const ticket = ++generation;
            const startedAccount = account();
            controller = new AbortController();
            const requestController = controller;
            clearDetails();
            show('결제 상태를 확인하고 있어요', '확인되기 전에는 다시 결제하지 마세요.');
            retry.disabled = true;
            retry.setAttribute('aria-busy', 'true');
            let timeout;
            try {
                const result = await Promise.race([
                    (async () => {
                        const response = await apiFetch(CONFIG.api.payment, {
                            method: 'POST', signal: requestController.signal,
                            body: JSON.stringify({ type: 'get_payment_status', data: { paymentIntentId: id } })
                        });
                        return response.json();
                    })(),
                    new Promise((_, reject) => { timeout = setTimeout(() => { requestController.abort(); reject(new Error('timeout')); }, 10000); })
                ]);
                if (ticket !== generation) return;
                if (startedAccount !== account()) { invalidate(); return; }
                const data = result?.data;
                if (!result?.success || data?.paymentIntentId !== id || data.purchaseKind !== 'subscription'
                    || !Object.hasOwn(labels, data.tier) || !Number.isSafeInteger(data.amount) || data.amount <= 0) throw new Error('invalid response');
                if (!['intent_created', 'vbank_ready', 'paid', 'failed', 'expired', 'cancelled'].includes(data.status)) throw new Error('unknown status');
                badge.textContent = labels[data.tier];
                if (data.status === 'paid') {
                    if (data.fulfillmentStatus === 'fulfilled') {
                        show('결제와 이용권 반영이 완료되었습니다', `${labels[data.tier]} ${data.amount.toLocaleString()}원 결제가 확인되었습니다. 예약 이용권은 예정된 적용일부터 이용할 수 있습니다.`);
                        action.textContent = '마이페이지에서 확인'; action.href = '/mypage';
                        try {
                            const saved = JSON.parse(localStorage.getItem('checkoutData') || 'null');
                            if (saved?.paymentIntentId === id) localStorage.removeItem('checkoutData');
                        } catch (_) {}
                    } else if (['pending', 'processing'].includes(data.fulfillmentStatus)) {
                        show('결제 완료 · 이용권 반영 대기', '결제 승인은 확인되었습니다. 다시 결제하지 마세요. 잠시 후 상태를 다시 확인하고, 계속 지연되면 문의해주세요.');
                    } else throw new Error('unknown fulfillment');
                } else if (data.status === 'vbank_ready') {
                    show('입금을 기다리고 있어요', '서버에서 확인한 입금 계좌입니다. 이미 입금했다면 추가로 입금하지 말고 상태를 다시 확인해주세요.');
                    const details = data.vbank;
                    if (!details || ['bankName', 'accountNo', 'holder', 'expireDate'].some(key => typeof details[key] !== 'string' || !details[key] || details[key].length > 100)) throw new Error('missing bank details');
                    byId('vbankBank').textContent = details.bankName;
                    byId('vbankAccount').textContent = details.accountNo;
                    byId('vbankHolder').textContent = details.holder;
                    byId('vbankExpire').textContent = details.expireDate;
                    byId('vbankAmount').textContent = `${data.amount.toLocaleString()}원`;
                    bank.style.display = 'block';
                } else if (data.status === 'intent_created') {
                    show('아직 결제 완료가 확인되지 않았어요', '결제창에서 진행 중이거나 확인이 늦어질 수 있습니다. 이미 결제했다면 다시 결제하지 말고 상태를 재확인해주세요.');
                } else {
                    const statusLabel = { failed: '실패', expired: '만료', cancelled: '취소' }[data.status];
                    show(`결제 요청이 ${statusLabel} 상태입니다`, '실제로 출금되거나 입금한 내역이 있다면 다시 결제하지 말고 문의해주세요.');
                }
            } catch (error) {
                if (ticket !== generation) return;
                clearDetails();
                if (error?.status === 401 || error?.code === 'AUTH_EXPIRED') {
                    show('로그인 후 결제 상태를 확인해주세요', '새 탭에서 로그인한 뒤 이 화면으로 돌아와 상태를 다시 확인해주세요.');
                    action.textContent = '새 탭에서 로그인'; action.href = '/login'; action.target = '_blank'; action.rel = 'noopener noreferrer';
                } else if (error?.status === 404 || error?.status === 403) {
                    show('이 계정에서 결제 정보를 확인할 수 없어요', '결제한 계정으로 로그인했는지 확인해주세요. 이미 결제했다면 다시 결제하지 말고 문의해주세요.');
                } else {
                    show('결제 상태를 확인하지 못했어요', '연결 또는 서버 상태를 확인할 수 없습니다. 결제 실패를 뜻하지는 않습니다. 다시 결제하지 말고 아래 버튼으로 재확인해주세요.');
                }
            } finally {
                clearTimeout(timeout);
                if (ticket === generation) { inFlight = false; retry.disabled = false; retry.removeAttribute('aria-busy'); }
            }
        }
        retry.addEventListener('click', refresh);
        clearDetails();
        if (!validId) {
            show('결제 내역 확인이 필요합니다', '확인 가능한 주문 정보가 없습니다. 이전 결제 내역이나 이미 입금한 주문은 다시 결제하지 말고 문의해주세요.');
            return;
        }
        retry.style.display = 'block';
        refresh();
    });
})();
