(() => {
    'use strict';
    document.addEventListener('DOMContentLoaded', () => {
        const list = document.getElementById('historyList');
        const message = document.getElementById('historyMessage');
        const refresh = document.getElementById('historyRefresh');
        const more = document.getElementById('historyMore');
        const login = document.getElementById('historyLogin');
        const back = document.getElementById('historyBack');
        if (new URLSearchParams(location.search).get('from') === 'app') {
            back.href = '/studycrack-mobile?screen=accountInfo';
            back.textContent = '← 계정 정보';
        }
        const validId = id => typeof id === 'string' && /^PI_(?:[0-9a-f]{32}|[0-9a-f-]{36})$/i.test(id);
        const validCursor = value => value === null || (typeof value === 'string' && /^[\x21-\x7e]{1,200}$/.test(value));
        const account = () => { try { return localStorage.getItem('userId') || ''; } catch (_) { return ''; } };
        let cursor = null, busy = false, generation = 0, controller;
        let seen = new Set();
        function invalidate() {
            generation++; controller?.abort(); busy = false; cursor = null; seen.clear();
            list.replaceChildren(); more.hidden = true; refresh.disabled = false; more.disabled = false;
            list.removeAttribute('aria-busy'); login.hidden = true;
            message.textContent = '화면이나 계정이 변경되었습니다. 결제 내역을 다시 조회해주세요.';
        }
        window.addEventListener('pagehide', invalidate);
        window.addEventListener('storage', event => {
            if (event.key === null || ['userId', 'accessToken', 'token', 'refreshToken'].includes(event.key)) invalidate();
        });
        function row(item) {
            const element = document.createElement('li');
            const text = (parent, tag, value, className = '') => {
                const child = document.createElement(tag);
                child.textContent = value; child.className = className; parent.append(child);
            };
            const heading = document.createElement('div'); heading.className = 'pay-history-item-heading';
            text(heading, 'h2', item.product);
            text(heading, 'p', item.amount === null ? '금액 확인 필요' : `${item.amount.toLocaleString('ko-KR')}원`, 'pay-history-amount');
            element.append(heading);
            const meta = document.createElement('dl'); meta.className = 'pay-history-meta';
            text(meta, 'dt', '기록일'); text(meta, 'dd', item.date || '확인 필요');
            text(meta, 'dt', '주문번호'); text(meta, 'dd', item.orderId);
            element.append(meta);
            const link = document.createElement('a'); link.className = 'pay-history-link';
            const canCheck = validId(item.paymentIntentId) && item.paymentIntentId === item.orderId;
            link.href = canCheck ? `/success?paymentIntentId=${encodeURIComponent(item.paymentIntentId)}` : '/qna';
            link.textContent = canCheck ? '결제 상세' : '문의하기';
            link.setAttribute('aria-label', `${item.product} ${item.orderId} ${link.textContent}`);
            if (!canCheck) text(element, 'p', '이 내역의 상세 정보는 고객센터에 문의해 주세요.', 'pay-history-item-note');
            element.append(link); return element;
        }
        async function load(reset) {
            if (busy) return;
            if (reset) { cursor = null; seen.clear(); list.replaceChildren(); more.hidden = true; }
            const requestedCursor = cursor;
            const ticket = ++generation, owner = account();
            busy = true; refresh.disabled = true; more.disabled = true; login.hidden = true;
            list.setAttribute('aria-busy', 'true'); message.textContent = '결제 내역을 확인하고 있어요.';
            controller = new AbortController(); const requestController = controller;
            let timeout;
            try {
                const result = await Promise.race([
                    (async () => {
                        const response = await apiFetch(CONFIG.api.payment, { method: 'POST', signal: requestController.signal,
                            body: JSON.stringify({ type: 'list_payment_history', data: { cursor: requestedCursor } }) });
                        return response.json();
                    })(),
                    new Promise((_, reject) => { timeout = setTimeout(() => { requestController.abort(); reject(new Error('timeout')); }, 10000); })
                ]);
                if (ticket !== generation) return;
                if (owner !== account()) { invalidate(); return; }
                const data = result?.data;
                if (!result?.success || !Array.isArray(data?.items) || data.items.length > 20 || !validCursor(data.cursor)
                    || (data.cursor !== null && data.cursor === requestedCursor)
                    || data.items.some(item => !item || typeof item.orderId !== 'string' || !item.orderId || item.orderId.length > 200
                        || typeof item.product !== 'string' || item.product.length > 100 || typeof item.date !== 'string' || item.date.length > 40
                        || !(item.amount === null || (Number.isSafeInteger(item.amount) && item.amount >= 0))
                        || !(item.paymentIntentId === null || validId(item.paymentIntentId)))) throw new Error('invalid response');
                const fragment = document.createDocumentFragment();
                for (const item of data.items) { if (!seen.has(item.orderId)) { fragment.append(row(item)); seen.add(item.orderId); } }
                list.append(fragment); cursor = data.cursor; more.hidden = cursor === null;
                message.textContent = seen.size ? `결제 내역 ${seen.size}건` : '표시할 결제 기록이 없습니다. 결제·입금한 내역이 있다면 문의해주세요.';
            } catch (error) {
                if (ticket !== generation) return;
                if (owner !== account()) { invalidate(); return; }
                if (error?.status === 401 || error?.status === 403 || error?.code === 'AUTH_EXPIRED') {
                    list.replaceChildren(); seen.clear(); cursor = null; more.hidden = true;
                    login.hidden = false; message.textContent = '결제한 계정으로 로그인한 뒤 이 화면에서 다시 조회해주세요.';
                } else {
                    message.textContent = reset ? '결제 내역을 불러오지 못했습니다. 결제 실패를 뜻하지 않습니다. 다시 조회해주세요.' : '다음 내역을 불러오지 못했습니다. 표시된 목록은 이전 조회 결과입니다. ‘내역 더 보기’를 다시 눌러주세요.';
                }
            } finally {
                clearTimeout(timeout);
                if (ticket === generation) { busy = false; refresh.disabled = false; more.disabled = false; list.removeAttribute('aria-busy'); }
            }
        }
        refresh.addEventListener('click', () => load(true));
        more.addEventListener('click', () => load(false));
        load(true);
    });
})();
