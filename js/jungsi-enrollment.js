(function () {
    'use strict';
    const dialog = document.getElementById('jungsiEnrollment');
    if (!dialog) return;
    const form = document.getElementById('jungsiEnrollmentForm');
    const fields = document.getElementById('jungsiEnrollmentFields');
    const status = document.getElementById('jungsiEnrollmentStatus');
    const submit = document.getElementById('jungsiEnrollmentSubmit');
    const receipt = document.getElementById('jungsiEnrollmentReceipt');
    const retry = document.getElementById('jungsiEnrollmentRetry');
    const recover = document.getElementById('jungsiEnrollmentRecover');
    const names = { consulting: '2027 정시 컨설팅', calculator: '2027 정시 합격 계산기' };
    const key = 'sc_jungsi_application_v1';
    let productType = 'consulting', requestedProduct = 'consulting', offer = null, controller = null, trigger = null, busy = false;
    function syncProduct() {
        dialog.dataset.productType = productType;
        const googleForm = document.getElementById('jungsiGoogleForm');
        googleForm.hidden = productType === 'calculator' || googleForm.dataset.available !== 'true';
    }
    function saved() { return window.readSiteEnrollmentTransient?.() || null; }
    function message(text, error = false) { status.textContent = text; status.dataset.state = error ? 'error' : ''; }
    function valid(value, isReceipt = false) {
        return value && Object.hasOwn(names, value.productType) && value.productType === productType && value.productName === names[productType]
            && (productType === 'calculator' ? value.amount === 25000 : [200000, 300000].includes(value.amount))
            && (productType !== 'calculator' || typeof value.accessEndsAt === 'string' && Number.isFinite(Date.parse(value.accessEndsAt)))
            && value.bankTransfer && ['bankName', 'accountHolder', 'accountNumber'].every(field => typeof value.bankTransfer[field] === 'string' && value.bankTransfer[field].length > 0 && value.bankTransfer[field].length <= 80)
            && (!isReceipt || /^APP_[0-9a-f-]{36}$/i.test(value.applicationId || '') && ['PAYMENT_REVIEW', 'INVITED', 'CLAIMED', 'REJECTED'].includes(value.applicationState));
    }
    async function request(type, data) {
        const own = controller;
        const timer = window.setTimeout(() => own?.abort(), 12000);
        try {
            const response = await fetch(CONFIG.api.consultingPublic, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', referrerPolicy: 'no-referrer', signal: own?.signal, body: JSON.stringify({ type, data }) });
            const body = await response.json();
            if (!response.ok || body?.success !== true) throw Object.assign(new Error(), { code: body?.code, status: response.status });
            return body.data;
        } finally { window.clearTimeout(timer); }
    }
    function lock(value) { busy = value; fields.disabled = value || !offer; dialog.setAttribute('aria-busy', String(value)); submit.disabled = value || !offer; retry.disabled = value; recover.disabled = value; }
    function newRequest() { controller?.abort(); controller = new AbortController(); return controller; }
    function renderReceipt(value) {
        if (!valid(value, true)) throw new Error();
        form.hidden = true; receipt.hidden = false; retry.hidden = true; recover.hidden = false;
        document.getElementById('jungsiReceiptProduct').textContent = value.productName;
        document.getElementById('jungsiReceiptPromo').hidden = productType !== 'consulting';
        document.getElementById('jungsiReceiptNumber').textContent = value.applicationId;
        document.getElementById('jungsiReceiptAmount').textContent = value.amount.toLocaleString('ko-KR') + '원' + (value.accessEndsAt ? ' · 이용 기한 ' + new Date(value.accessEndsAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' (한국시간)' : '');
        document.getElementById('jungsiReceiptBank').textContent = `${value.bankTransfer.bankName} ${value.bankTransfer.accountNumber} · 예금주 ${value.bankTransfer.accountHolder}`;
        const expired = value.paymentDueAt && Date.parse(value.paymentDueAt) < Date.now();
        const waiting = value.applicationState === 'PAYMENT_REVIEW' && !expired;
        document.getElementById('jungsiReceiptPayment').hidden = !waiting;
        const accessExpired = value.accessEndsAt && Date.parse(value.accessEndsAt) <= Date.now();
        document.getElementById('jungsiReceiptAccess').hidden = value.applicationState !== 'CLAIMED' || accessExpired;
        document.getElementById('jungsiReceiptAccess').href = productType === 'calculator' ? '/2027-jungsi-consulting/calculator' : '/2027-jungsi-consulting/home';
        document.getElementById('jungsiReceiptAccess').textContent = productType === 'calculator' ? '합격 계산기로 이동' : '나의 컨설팅으로 이동';
        const states = { PAYMENT_REVIEW: '신청이 저장됐습니다. 입금 후 운영팀 확인을 기다려주세요.', INVITED: '입금이 확인됐습니다. 문자로 받은 링크와 이메일 인증코드로 이용 인증을 완료해주세요.', CLAIMED: '계정 연결이 완료됐습니다. 처음 인증한 학생 계정으로 이용해주세요.', REJECTED: '신청 처리 내역을 운영팀에 확인해주세요. 추가로 입금하지 마세요.' };
        message(value.applicationState === 'CLAIMED' && accessExpired ? '계산기 이용 기간이 종료됐습니다. 이용 내역은 운영팀에 문의해주세요.' : value.applicationState === 'PAYMENT_REVIEW' && expired ? '얼리버드 입금 기한이 지났습니다. 이체 전에 운영팀에 신청 금액을 확인해주세요.' : states[value.applicationState]);
        document.getElementById('jungsiSavedApplication').hidden = false;
    }
    async function loadOffer() {
        const own = newRequest(); offer = null; syncProduct(); lock(true); retry.hidden = true;
        for (const name of ['privacyConsent', 'termsConsent']) form.elements.namedItem(name).checked = false;
        message('신청 금액과 안내를 확인하고 있습니다.');
        try {
            const value = await request('get_site_enrollment', { productType });
            if (controller !== own || !dialog.open) return;
            if (!valid(value) || value.consentRevision !== 'JUNGSI_SITE_2027_V1') throw new Error();
            offer = value;
            document.getElementById('jungsiEnrollmentPrice').textContent = `${names[productType]} · ${offer.amount.toLocaleString('ko-KR')}원${offer.earlybird ? ' (얼리버드)' : ''}${offer.accessEndsAt ? ' · 이용 기한 ' + new Date(offer.accessEndsAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' (한국시간)' : ''}`;
            message('신청 내용을 저장한 다음 입금 안내를 확인할 수 있습니다.');
        } catch (error) {
            if (controller !== own || !dialog.open) return;
            message(error.code === 'CALCULATOR_DATA_NOT_READY' ? '계산기 제공 자료를 확인하고 있습니다. 준비가 끝나면 신청할 수 있습니다.' : '신청 안내를 불러오지 못했습니다. 잠시 후 다시 확인하거나 070-8128-1126으로 문의해주세요.', true);
            retry.hidden = false;
        } finally { if (controller === own) lock(false); }
    }
    async function restore() {
        const application = saved();
        if (!application) { recover.hidden = true; await loadOffer(); return; }
        const own = newRequest(); productType = application.productType; syncProduct(); lock(true); recover.hidden = false; retry.hidden = true;
        document.getElementById('jungsiEnrollmentTitle').textContent = names[productType] + ' 신청';
        message('저장된 신청 상태를 확인하고 있습니다.');
        try {
            const value = await request('public_get_site_application', { requestKey: application.requestKey, token: application.token });
            if (controller !== own || !dialog.open) return;
            renderReceipt(value);
        } catch (error) {
            if (controller !== own || !dialog.open) return;
            if (error.status === 404) {
                sessionStorage.removeItem(key); receipt.hidden = true; form.hidden = false; recover.hidden = true;
                await loadOffer();
            } else message('저장 결과를 아직 확인하지 못했습니다. 중복 신청·추가 입금 없이 신청 상태를 다시 확인해주세요.', true);
        } finally { if (controller === own) lock(false); }
    }
    async function open(type, source) {
        if (busy) return;
        trigger = source || trigger; productType = Object.hasOwn(names, type) ? type : 'consulting'; requestedProduct = productType;
        offer = null; form.hidden = false; receipt.hidden = true;
        document.getElementById('jungsiEnrollmentTitle').textContent = names[productType] + ' 신청';
        document.getElementById('jungsiEnrollmentPrice').textContent = '';
        if (!dialog.open) dialog.showModal();
        document.body.classList.add('jungsi-enrollment-open');
        if (saved()) await restore(); else await loadOffer();
    }
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !offer || !form.reportValidity()) return;
        const values = Object.fromEntries(new FormData(form));
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        const application = { version: 1, requestKey: 'web_' + crypto.randomUUID(), token: btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), productType, capturedAt: Date.now() };
        try { sessionStorage.setItem(key, JSON.stringify(application)); } catch { message('신청을 이어가려면 이 브라우저의 저장 기능을 허용해주세요.', true); return; }
        const own = newRequest(); lock(true); message('신청 내용을 저장하고 있습니다.'); retry.hidden = true;
        try {
            const value = await request('public_submit_site_application', { ...values, productType, requestKey: application.requestKey, token: application.token, consentRevision: offer.consentRevision,
                acceptedAmount: offer.amount, ...(productType === 'calculator' ? { acceptedAccessEndsAt: offer.accessEndsAt } : {}), privacyConsent: values.privacyConsent === 'on', termsConsent: values.termsConsent === 'on' });
            if (controller !== own || !dialog.open) return;
            renderReceipt(value); form.reset();
        } catch (error) {
            if (controller !== own || !dialog.open) return;
            if (error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status)) {
                sessionStorage.removeItem(key);
                message('신청 정보를 확인해주세요. 저장되지 않았습니다.', true);
            } else {
                form.hidden = true; recover.hidden = false;
                message(error.code === 'PRICE_CHANGED' ? '신청 금액이 변경됐습니다. 신청 상태 확인을 누른 뒤 금액을 다시 확인해주세요.' : '신청 결과를 확인하지 못했습니다. 중복 제출 없이 신청 상태 확인을 눌러주세요.', true);
            }
        } finally { if (controller === own) lock(false); }
    });
    document.addEventListener('click', event => {
        const target = event.target.closest('[data-jungsi-product], #jungsiSavedApplication');
        if (!target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); void open(target.dataset.jungsiProduct || saved()?.productType, target);
    });
    dialog.querySelector('[data-enrollment-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { controller?.abort(); controller = null; busy = false; document.body.classList.remove('jungsi-enrollment-open'); trigger?.focus({ preventScroll: true }); });
    retry.addEventListener('click', () => { void loadOffer(); });
    recover.addEventListener('click', () => { void restore(); });
    document.getElementById('jungsiEnrollmentNew').addEventListener('click', () => {
        sessionStorage.removeItem(key); productType = requestedProduct; document.getElementById('jungsiEnrollmentTitle').textContent = names[productType] + ' 신청'; form.reset(); receipt.hidden = true; form.hidden = false; recover.hidden = true; void loadOffer();
    });
    document.getElementById('jungsiSavedApplication').hidden = !saved();
    if (location.hash === '#application') void open(saved()?.productType);
})();
