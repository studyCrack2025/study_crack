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
    const newApplication = document.getElementById('jungsiEnrollmentNew');
    const newSection = document.getElementById('jungsiEnrollmentNewSection');
    const copyAccount = document.getElementById('jungsiReceiptCopyAccount');
    const copyNumber = document.getElementById('jungsiReceiptCopyNumber');
    const copyStatus = document.getElementById('jungsiEnrollmentCopyStatus');
    const names = { consulting: '2027 정시 컨설팅', calculator: '2027 정시 합격 계산기' };
    const key = 'sc_jungsi_application_v1';
    let productType = 'consulting', requestedProduct = 'consulting', offer = null, controller = null, trigger = null, busy = false, renderedReceipt = null;
    const amountText = value => value.amount.toLocaleString('ko-KR') + '원';
    const timeText = value => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    function showPeriod(id, value) {
        const node = document.getElementById(id);
        node.hidden = value.productType !== 'calculator';
        node.textContent = node.hidden ? '' : '이용 기한 · ' + timeText(value.accessEndsAt) + '까지 (한국시간)';
    }
    function showPaymentDeadline(id, value) {
        const node = document.getElementById(id);
        node.hidden = value.productType !== 'calculator' || !Number.isFinite(Date.parse(value.paymentDueAt));
        node.textContent = node.hidden ? '' : '결제 마감 · ' + timeText(value.paymentDueAt) + '까지 (한국시간)';
    }
    function formView() {
        renderedReceipt = null; form.hidden = false; receipt.hidden = true; newSection.hidden = true; copyStatus.textContent = '';
        document.getElementById('jungsiEnrollmentEyebrow').textContent = '서비스 신청';
        document.getElementById('jungsiEnrollmentTitle').textContent = names[productType] + ' 신청';
        document.getElementById('jungsiEnrollmentPrice').hidden = true;
        dialog.scrollTop = 0;
    }
    function syncRelationshipFields() {
        for (const name of ['contactRelationship', 'payerRelationship']) {
            const choice = form.elements.namedItem(name);
            const detail = form.elements.namedItem(name + 'Detail');
            const consulting = productType === 'consulting';
            choice.disabled = !consulting; choice.required = consulting;
            const hasDetail = consulting && choice.value === 'other';
            detail.disabled = !hasDetail; detail.required = hasDetail;
            detail.closest('label').hidden = !hasDetail;
        }
    }
    function syncProduct() {
        dialog.dataset.productType = productType;
        const consulting = productType === 'consulting';
        document.getElementById('jungsiEnrollmentDescription').textContent = consulting ? '컨설팅을 받을 학생의 정보와 입금자명을 확인해주세요.' : '계산기를 이용할 학생의 정보와 입금자명을 확인해주세요.';
        document.getElementById('jungsiEnrollmentNameLabel').textContent = consulting ? '학생 이름' : '이용자 이름';
        document.getElementById('jungsiEnrollmentNameHint').textContent = consulting ? '컨설팅을 받을 학생의 이름을 입력해주세요.' : '계산기를 이용할 학생의 이름을 입력해주세요.';
        document.getElementById('jungsiEnrollmentPayerHint').textContent = `${consulting ? '학생' : '이용자'} 이름과 달라도 실제 이체 내역에 표시될 입금자명을 입력해주세요.`;
        document.getElementById('jungsiEnrollmentCollection').textContent = consulting
            ? '학생 이름, 연락처, 연락처의 본인·대리인 구분, 이메일, 입금자명, 입금자와의 관계, 기타 관계 입력 내용 및 동의 여부'
            : '이용자 이름, 연락처, 이메일, 입금자명 및 동의 여부';
        for (const field of dialog.querySelectorAll('[data-enrollment-consulting]')) field.hidden = !consulting;
        syncRelationshipFields();
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
    function lock(value) { busy = value; fields.disabled = value || !offer; dialog.setAttribute('aria-busy', String(value)); submit.disabled = value || !offer; retry.disabled = value; recover.disabled = value; newApplication.disabled = value; copyAccount.disabled = value; copyNumber.disabled = value; }
    function newRequest() { controller?.abort(); controller = new AbortController(); return controller; }
    function renderReceipt(value) {
        if (!valid(value, true)) throw new Error();
        renderedReceipt = value; form.hidden = true; receipt.hidden = false; retry.hidden = true; recover.hidden = false; newSection.hidden = false; copyStatus.textContent = '';
        receipt.querySelector('details').open = false;
        document.getElementById('jungsiReceiptProduct').textContent = value.productName;
        document.getElementById('jungsiReceiptNumber').textContent = value.applicationId;
        document.getElementById('jungsiReceiptAmount').textContent = amountText(value);
        showPeriod('jungsiReceiptPeriod', value);
        showPaymentDeadline('jungsiReceiptDeadline', value);
        document.getElementById('jungsiReceiptBankName').textContent = value.bankTransfer.bankName;
        document.getElementById('jungsiReceiptAccountNumber').textContent = value.bankTransfer.accountNumber;
        document.getElementById('jungsiReceiptAccountHolder').textContent = value.bankTransfer.accountHolder;
        document.getElementById('jungsiReceiptPaymentInstruction').textContent = '아래 계좌로 ' + amountText(value) + '을 입금해주세요.';
        const expired = value.paymentDueAt && Date.parse(value.paymentDueAt) < Date.now();
        const accessExpired = productType === 'calculator' && Date.parse(value.accessEndsAt) <= Date.now();
        const waiting = value.applicationState === 'PAYMENT_REVIEW' && !expired && !accessExpired;
        document.getElementById('jungsiReceiptPayment').hidden = !waiting;
        const promo = document.getElementById('jungsiReceiptPromo');
        promo.hidden = productType !== 'consulting' || !waiting || !Number.isFinite(Date.parse(value.paymentDueAt));
        promo.textContent = promo.hidden ? '' : '얼리버드는 ' + timeText(value.paymentDueAt) + ' (한국시간) 또는 입금 완료 순 70명 중 먼저 마감됩니다.';
        const claimed = value.applicationState === 'CLAIMED';
        const needsHelp = value.applicationState === 'REJECTED' || waiting === false && value.applicationState === 'PAYMENT_REVIEW' || accessExpired;
        const badge = document.getElementById('jungsiReceiptState');
        badge.textContent = accessExpired ? '이용 기간 종료' : value.applicationState === 'PAYMENT_REVIEW' ? expired ? '입금 기한 종료' : '입금 확인 대기' : value.applicationState === 'INVITED' ? '입금 확인 완료' : claimed ? '이용 인증 완료' : '운영팀 확인 필요';
        badge.dataset.tone = needsHelp ? 'attention' : waiting ? 'pending' : 'complete';
        document.getElementById('jungsiReceiptAmountLabel').textContent = waiting ? '입금할 금액' : '신청 금액';
        document.getElementById('jungsiEnrollmentEyebrow').textContent = '신청 접수 내역';
        document.getElementById('jungsiEnrollmentTitle').textContent = waiting ? '신청 완료 · 입금 안내' : needsHelp ? '신청 상태 안내' : claimed ? '이용 준비가 완료됐습니다' : '입금이 확인됐습니다';
        document.getElementById('jungsiReceiptAccess').hidden = value.applicationState !== 'CLAIMED' || accessExpired;
        document.getElementById('jungsiReceiptAccess').href = productType === 'calculator' ? '/2027-jungsi-consulting/calculator' : '/2027-jungsi-consulting/home';
        document.getElementById('jungsiReceiptAccess').textContent = productType === 'calculator' ? '합격 계산기로 이동' : '나의 컨설팅으로 이동';
        document.getElementById('jungsiReceiptNextTitle').textContent = needsHelp ? '운영팀에 확인해주세요' : claimed ? '서비스를 시작해보세요' : value.applicationState === 'INVITED' ? '이용 인증을 완료해주세요' : '입금 후 이용 안내';
        document.getElementById('jungsiReceiptNextDescription').textContent = needsHelp ? '추가 입금 전에 070-8128-1126으로 신청 내역을 문의해주세요.' : claimed ? '처음 인증한 학생 계정으로 서비스를 이용할 수 있습니다.' : value.applicationState === 'INVITED' ? '문자로 받은 링크를 열고 이메일의 10자리 인증코드를 입력해주세요.' : '운영팀이 입금을 확인하면 문자로 이용 링크, 이메일로 인증코드를 보내드립니다.';
        for (const id of ['jungsiReceiptSignup', 'jungsiReceiptLogin', 'jungsiReceiptAccountHint']) document.getElementById(id).hidden = claimed || needsHelp;
        const states = { PAYMENT_REVIEW: '신청이 저장됐습니다. 입금 후 운영팀 확인을 기다려주세요.', INVITED: '입금이 확인됐습니다. 문자로 받은 링크와 이메일 인증코드로 이용 인증을 완료해주세요.', CLAIMED: '계정 연결이 완료됐습니다. 처음 인증한 학생 계정으로 이용해주세요.', REJECTED: '신청 처리 내역을 운영팀에 확인해주세요. 추가로 입금하지 마세요.' };
        message(accessExpired ? '계산기 이용 기간이 종료됐습니다. 이용 내역은 운영팀에 문의해주세요.' : value.applicationState === 'PAYMENT_REVIEW' && expired ? productType === 'calculator' ? '계산기 결제 기한이 종료됐습니다. 추가로 입금하지 말고 운영팀에 문의해주세요.' : '얼리버드 입금 기한이 지났습니다. 이체 전에 운영팀에 신청 금액을 확인해주세요.' : states[value.applicationState]);
        document.getElementById('jungsiSavedApplication').hidden = false;
        dialog.scrollTop = 0;
    }
    async function copyReceipt(kind) {
        const value = renderedReceipt;
        if (!value || busy || !dialog.open || kind === 'account' && document.getElementById('jungsiReceiptPayment').hidden) return;
        const text = kind === 'account' ? value.bankTransfer.accountNumber : value.applicationId;
        copyStatus.textContent = '';
        try {
            if (!navigator.clipboard?.writeText) throw new Error();
            await navigator.clipboard.writeText(text);
            if (renderedReceipt !== value || !dialog.open) return;
            copyStatus.textContent = kind === 'account' ? '계좌번호를 복사했습니다.' : '신청번호를 복사했습니다.';
        } catch {
            if (renderedReceipt !== value || !dialog.open) return;
            const target = document.getElementById(kind === 'account' ? 'jungsiReceiptAccountNumber' : 'jungsiReceiptNumber');
            target.focus({ preventScroll: true });
            const range = document.createRange(); range.selectNodeContents(target);
            const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
            copyStatus.textContent = '자동 복사가 지원되지 않습니다. 표시된 번호를 선택해 직접 복사해주세요.';
        }
    }
    async function loadOffer() {
        const own = newRequest(); offer = null; formView(); syncProduct(); lock(true); retry.hidden = true;
        for (const name of ['privacyConsent', 'termsConsent']) form.elements.namedItem(name).checked = false;
        message('신청 금액과 안내를 확인하고 있습니다.');
        try {
            const value = await request('get_site_enrollment', { productType, formVersion: 2 });
            if (controller !== own || !dialog.open) return;
            if (!valid(value) || value.formVersion !== 2 || value.consentRevision !== 'JUNGSI_SITE_2027_V2') throw new Error();
            offer = value;
            document.getElementById('jungsiEnrollmentProduct').textContent = offer.productName;
            document.getElementById('jungsiEnrollmentAmount').textContent = amountText(offer);
            document.getElementById('jungsiEnrollmentOfferBadge').hidden = productType !== 'consulting' || !offer.earlybird;
            showPeriod('jungsiEnrollmentPeriod', offer);
            showPaymentDeadline('jungsiEnrollmentPaymentDeadline', offer);
            document.getElementById('jungsiEnrollmentPrice').hidden = false;
            message('신청 내용을 저장한 다음 입금 안내를 확인할 수 있습니다.');
        } catch (error) {
            if (controller !== own || !dialog.open) return;
            message(error.code === 'CALCULATOR_SALES_CLOSED' ? '계산기 결제 기한이 종료됐습니다. 기존 신청은 저장된 신청 확인에서 조회해주세요.' : error.code === 'CALCULATOR_DATA_NOT_READY' ? '계산기 제공 자료를 확인하고 있습니다. 준비가 끝나면 신청할 수 있습니다.' : '신청 안내를 불러오지 못했습니다. 잠시 후 다시 확인하거나 070-8128-1126으로 문의해주세요.', true);
            retry.hidden = error.code === 'CALCULATOR_SALES_CLOSED';
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
                sessionStorage.removeItem(key); recover.hidden = true;
                await loadOffer();
            } else message('저장 결과를 아직 확인하지 못했습니다. 중복 신청·추가 입금 없이 신청 상태를 다시 확인해주세요.', true);
        } finally { if (controller === own) lock(false); }
    }
    async function open(type, source) {
        if (busy) return;
        trigger = source || trigger;
        const nextProduct = Object.hasOwn(names, type) ? type : 'consulting';
        if (nextProduct !== productType) form.reset();
        productType = nextProduct; requestedProduct = productType;
        offer = null; formView();
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
            const value = await request('public_submit_site_application', { ...values, productType, formVersion: offer.formVersion, requestKey: application.requestKey, token: application.token, consentRevision: offer.consentRevision,
                acceptedAmount: offer.amount, ...(productType === 'calculator' ? { acceptedAccessEndsAt: offer.accessEndsAt } : {}), privacyConsent: values.privacyConsent === 'on', termsConsent: values.termsConsent === 'on' });
            if (controller !== own || !dialog.open) return;
            renderReceipt(value); form.reset();
        } catch (error) {
            if (controller !== own || !dialog.open) return;
            if (error.code === 'CALCULATOR_SALES_CLOSED') {
                sessionStorage.removeItem(key); offer = null; form.hidden = true; recover.hidden = true;
                message('계산기 결제 기한이 종료됐습니다. 추가로 입금하지 말고 운영팀에 문의해주세요.', true);
            } else if (error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status)) {
                sessionStorage.removeItem(key);
                message('신청 정보를 확인해주세요. 저장되지 않았습니다.', true);
            } else {
                form.hidden = true; recover.hidden = false;
                message(error.code === 'PRICE_CHANGED' ? '신청 금액이 변경됐습니다. 신청 상태 확인을 누른 뒤 금액을 다시 확인해주세요.' : '신청 결과를 확인하지 못했습니다. 중복 제출 없이 신청 상태 확인을 눌러주세요.', true);
            }
        } finally { if (controller === own) lock(false); }
    });
    for (const name of ['contactRelationship', 'payerRelationship']) form.elements.namedItem(name).addEventListener('change', syncRelationshipFields);
    document.addEventListener('click', event => {
        const target = event.target.closest('[data-jungsi-product], #jungsiSavedApplication');
        if (!target || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault(); void open(target.dataset.jungsiProduct || saved()?.productType, target);
    });
    dialog.querySelector('[data-enrollment-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { controller?.abort(); controller = null; busy = false; document.body.classList.remove('jungsi-enrollment-open'); trigger?.focus({ preventScroll: true }); });
    retry.addEventListener('click', () => { void loadOffer(); });
    recover.addEventListener('click', () => { void restore(); });
    copyAccount.addEventListener('click', () => { void copyReceipt('account'); });
    copyNumber.addEventListener('click', () => { void copyReceipt('number'); });
    newApplication.addEventListener('click', () => {
        if (busy) return;
        sessionStorage.removeItem(key); productType = requestedProduct; form.reset(); recover.hidden = true; void loadOffer();
    });
    document.getElementById('jungsiSavedApplication').hidden = !saved();
    if (location.hash === '#application') void open(saved()?.productType);
})();
