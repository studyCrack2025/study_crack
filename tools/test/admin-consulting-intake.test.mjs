import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile(new URL('../../admin_index.html', import.meta.url), 'utf8');
const config = await readFile(new URL('../../js/config.js', import.meta.url), 'utf8');
const helpers = await readFile(new URL('../../js/admin/consulting.js', import.meta.url), 'utf8');
const intake = await readFile(new URL('../../js/admin/consulting-intake.js', import.meta.url), 'utf8');
const policy = JSON.parse(await readFile(new URL('../public-site-files.json', import.meta.url), 'utf8'));

test('admin consulting screen and its deployment files are wired', () => {
    assert.match(html, /showSection\('consulting'\)/);
    assert.match(html, /id="section-consulting"/);
    assert.match(html, /\/js\/admin\/consulting\.js/);
    assert.match(html, /\/js\/admin\/consulting-intake\.js/);
    assert.match(html, /\/css\/admin_consulting\.css/);
    for (const file of ['js/admin/consulting.js', 'js/admin/consulting-intake.js', 'js/admin/consulting-scheduling.js', 'css/admin_consulting.css']) assert.ok(policy.files.includes(file));
    assert.match(config, /consulting:\s+`\$\{API_BASE\}\/api\/consulting`/);
});

test('payment approval sends server-validated fields and requires an explicit payer check', () => {
    for (const field of ['applicationId', 'expectedRevision', 'idempotencyKey', 'paidAmount', 'paidAt', 'payerNameConfirmed', 'reasonCode']) assert.match(intake, new RegExp(`\\b${field}\\b`));
    assert.match(intake, /MANUAL_BANK_MATCH/);
    assert.match(intake, /consultingPayerConfirmed/);
    assert.match(helpers, /window\.crypto\.randomUUID/);
});

test('PII is rendered as text and is not interpolated into HTML', () => {
    assert.match(intake, /content\.textContent = String\(value/);
    assert.doesNotMatch(intake, /innerHTML\s*=\s*`[^`]*\$\{/);
    assert.doesNotMatch(intake, /onclick\s*=/i);
});

const applicationId = 'APP_11111111-1111-4111-8111-111111111111';
const secondId = 'APP_22222222-2222-4222-8222-222222222222';
function detail(id = applicationId, state = 'PAYMENT_REVIEW') {
    return {
        application: { applicationId: id, applicationState: state, paymentReviewStatus: state === 'INVITED' ? 'verified' : 'pending', revision: 0, expectedAmount: 300000 },
        contact: { studentName: 'Synthetic student', phone: '01000000000', email: 'synthetic@example.invalid', payerName: 'Synthetic payer' },
        payerRelationship: 'other', payerRelationshipDetail: '<img src=x onerror=alert(1)>',
        contactMethod: 'email', studentStatus: 'senior', activeInviteId: state === 'INVITED' ? 'synthetic-invite' : null
    };
}
function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}
function setup() {
    const nodes = new Map();
    const events = new Map();
    function element() {
        return { value: '', checked: false, hidden: true, disabled: false, dataset: {}, children: [], ownText: '', listeners: {},
            get textContent() { return this.ownText + this.children.map(child => child.textContent).join(' '); },
            set textContent(value) { this.ownText = value; this.children = []; },
            appendChild(child) { this.children.push(child); },
            append(...children) { this.children.push(...children); },
            replaceChildren(...children) { this.ownText = ''; this.children = children; },
            setAttribute(name, value) { this[name] = value; },
            addEventListener(type, handler) { this.listeners[type] = handler; },
            querySelectorAll() { return [...nodes.values()]; }
        };
    }
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    for (const id of html.matchAll(/id="(consulting[^"]+)"/g)) get(id[1]);
    const calls = [];
    const context = vm.createContext({
        document: { getElementById: get, createElement: element },
        CONFIG: { api: { consulting: '/synthetic/consulting' } },
        Intl, Date, console,
        confirm: () => true, prompt: () => '',
        apiFetch: async (url, options) => {
            const request = JSON.parse(options.body);
            calls.push({ url, ...request });
            const data = await context.respond(request);
            return { json: async () => ({ success: true, data }) };
        }
    });
    context.respond = request => request.type === 'admin_get_application_detail' ? detail(request.data.applicationId) : { items: [] };
    context.window = { crypto: { randomUUID: () => '11111111-1111-4111-8111-111111111111' }, addEventListener: (name, handler) => events.set(name, handler) };
    vm.runInContext(helpers + '\n' + intake, context);
    const run = code => vm.runInContext(code, context);
    const open = id => run(`openConsultingApplication(${JSON.stringify(id || applicationId)})`);
    function fillPayment() {
        get('consultingPaidAmount').value = '300000';
        get('consultingPaidAt').value = '2026-10-20T10:00';
        get('consultingPayerConfirmed').checked = true;
    }
    return { context, calls, get, run, open, events, fillPayment };
}

test('detail renders localized values and other text without assuming payment facts', async () => {
    const { open, get } = setup();
    await open();
    assert.equal(get('consultingApplicationDetail').hidden, false);
    assert.match(get('consultingDetailSummary').textContent, /이메일/);
    assert.match(get('consultingDetailSummary').textContent, /고3/);
    assert.match(get('consultingDetailSummary').textContent, /<img src=x onerror=alert\(1\)>/);
    assert.equal(get('consultingPaidAmount').value, '');
    assert.equal(get('consultingPaidAt').value, '');
    assert.equal(get('consultingPayerConfirmed').checked, false);
    assert.equal(get('consultingInviteActions').hidden, true);
});

test('close removes PII and ignores an outstanding detail response', async () => {
    const { context, open, run, get } = setup();
    await open();
    run('closeConsultingDetail()');
    assert.equal(get('consultingDetailSummary').textContent, '');
    assert.equal(run('currentConsultingApplication'), null);
    const pending = deferred();
    context.respond = () => pending.promise;
    const request = open();
    run('closeConsultingDetail()');
    pending.resolve(detail());
    await request;
    assert.equal(get('consultingApplicationDetail').hidden, true);
    assert.equal(get('consultingDetailSummary').textContent, '');
});

test('a late response cannot overwrite a newer detail', async () => {
    const { context, open, get, run } = setup();
    const old = deferred();
    context.respond = request => request.data.applicationId === applicationId ? old.promise : detail(secondId);
    const first = open();
    await open(secondId);
    old.resolve(detail());
    await first;
    assert.equal(run('currentConsultingApplication.application.applicationId'), secondId);
    assert.equal(get('consultingApplicationLookup').value, secondId);
});

test('invalid or failed new detail cannot leave the old application actionable', async () => {
    const { context, calls, open, get, run } = setup();
    await open();
    await open('invalid');
    assert.equal(calls.length, 1);
    assert.equal(run('currentConsultingApplication'), null);
    assert.equal(get('consultingDetailSummary').textContent, '');
    await open();
    context.respond = () => { throw new Error('detail failure'); };
    await open(secondId);
    assert.equal(get('consultingApplicationDetail').hidden, true);
    assert.equal(get('consultingDetailSummary').textContent, '');
});

test('list error is distinct from zero results and an older failure is ignored', async () => {
    const { context, run, get } = setup();
    const old = deferred();
    context.respond = () => old.promise;
    const first = run('loadConsultingPaymentReview()');
    context.respond = () => ({ items: [] });
    await run('loadConsultingPaymentReview()');
    old.reject(new Error('late failure'));
    await first;
    assert.equal(get('consultingStatus').dataset.state, 'success');
    context.respond = () => { throw new Error('failure'); };
    await run('loadConsultingPaymentReview()');
    assert.match(get('consultingPaymentReviewBody').textContent, /불러오지 못/);
    assert.doesNotMatch(get('consultingPaymentReviewBody').textContent, /대기·보류 건이 없습니다/);
});

test('held applications remain visible with their real review state and masked fields', async () => {
    const { context, run, get } = setup();
    context.respond = () => ({ items: [{ applicationId, paymentReviewStatus: 'hold', duplicateSuspected: true, studentNameMask: 'S***', phoneMask: '010****0000', payerNameMask: 'P***', expectedAmount: 300000 }] });
    await run('loadConsultingPaymentReview()');
    const text = get('consultingPaymentReviewBody').textContent;
    assert.match(text, /보류 · 중복 가능성/);
    assert.match(text, /S\*\*\*/);
    assert.doesNotMatch(text, /synthetic@example/);
});

test('approval needs explicit payment input and can be cancelled without a write', async () => {
    const { context, run, calls, open, fillPayment } = setup();
    await open();
    await run('approveConsultingPayment()');
    assert.equal(calls.length, 1);
    fillPayment();
    context.confirm = () => false;
    await run('approveConsultingPayment()');
    assert.equal(calls.length, 1);
});

test('all intake actions lock together and success survives a failed list refresh', async () => {
    const { context, run, calls, open, fillPayment, get } = setup();
    await open();
    fillPayment();
    const pending = deferred();
    context.respond = request => {
        if (request.type === 'admin_verify_manual_payment') return pending.promise;
        throw new Error('list refresh failed');
    };
    const approve = run('approveConsultingPayment()');
    assert.equal(get('consultingApproveBtn').disabled, true);
    assert.equal(get('consultingPaidAmount').disabled, true);
    await run('approveConsultingPayment()');
    await run('holdConsultingPayment()');
    await run('rejectConsultingApplication()');
    await run('reissueConsultingInvite()');
    await open(secondId);
    run('closeConsultingDetail()');
    assert.equal(get('consultingApplicationDetail').hidden, false);
    assert.equal(calls.filter(call => call.type === 'admin_verify_manual_payment').length, 1);
    assert.equal(calls.length, 2);
    const data = calls[1].data;
    assert.equal(data.expectedRevision, 0);
    assert.equal(data.paidAmount, 300000);
    assert.equal(data.payerNameConfirmed, true);
    assert.match(data.idempotencyKey, /^payment:/);
    assert.equal(new Date(data.paidAt).toISOString(), data.paidAt);
    pending.resolve({ applicationState: 'INVITED', revision: 2 });
    await approve;
    assert.equal(get('consultingApproveBtn').disabled, false);
    assert.equal(get('consultingDetailSummary').textContent, '');
    assert.match(get('consultingActionStatus').textContent, /발송 예약 완료/);
    assert.match(get('consultingActionStatus').textContent, /별도 확인/);
    assert.equal(get('consultingActionStatus').dataset.state, 'success');
    assert.equal(get('consultingStatus').dataset.state, 'error');
});

for (const status of [409, 500]) test(`mutation ${status} closes stale detail and never automatically resends`, async () => {
    const { context, run, calls, open, get, fillPayment } = setup();
    await open();
    fillPayment();
    context.respond = () => { throw Object.assign(new Error('failure'), { status }); };
    await run('approveConsultingPayment()');
    await run('approveConsultingPayment()');
    assert.equal(calls.length, 2);
    assert.equal(get('consultingDetailSummary').textContent, '');
    assert.match(get('consultingActionStatus').textContent, /다시 조회/);
    assert.equal(get('consultingActionStatus').dataset.state, 'error');
});

test('hold requires other reason and sends a revision-bound request', async () => {
    const { context, run, calls, open, get } = setup();
    await open();
    get('consultingHoldReason').value = 'OTHER';
    await run('holdConsultingPayment()');
    assert.equal(calls.length, 1);
    context.prompt = () => 'Synthetic review reason';
    await run('holdConsultingPayment()');
    const hold = calls.find(call => call.type === 'admin_hold_payment_review');
    assert.equal(hold.data.expectedRevision, 0);
    assert.equal(hold.data.reasonText, 'Synthetic review reason');
});

test('invite reissue is available only on an invited application and needs confirmation', async () => {
    const { context, run, calls, open, get } = setup();
    await open();
    await run('reissueConsultingInvite()');
    assert.equal(calls.length, 1);
    context.respond = request => request.type === 'admin_get_application_detail' ? detail(applicationId, 'INVITED') : { items: [] };
    await open();
    assert.equal(get('consultingInviteActions').hidden, false);
    assert.equal(get('consultingPaymentActions').hidden, true);
    context.confirm = () => false;
    await run('reissueConsultingInvite()');
    assert.equal(calls.length, 2);
    context.confirm = () => true;
    await run('reissueConsultingInvite()');
    assert.equal(calls.filter(call => call.type === 'admin_reissue_invite').length, 1);
});

for (const event of ['studycrack:session-ended', 'pagehide']) test(`${event} clears PII and invalidates late responses`, async () => {
    const { context, events, open, get } = setup();
    await open();
    const pending = deferred();
    context.respond = () => pending.promise;
    const request = open();
    events.get(event)();
    pending.resolve(detail());
    await request;
    assert.equal(get('consultingDetailSummary').textContent, '');
    assert.equal(get('consultingApplicationDetail').hidden, true);
});

test('navigation resets intake and hidden action groups cannot be forced visible by flex', async () => {
    const navigation = await readFile(new URL('../../js/admin_ui.js', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../css/admin_consulting.css', import.meta.url), 'utf8');
    assert.match(navigation, /sectionName !== 'consulting'.*resetConsultingIntake/);
    assert.match(css, /\.consulting-actions\[hidden\] \{ display:none; \}/);
    assert.match(html, /onsubmit="event.preventDefault\(\); lookupConsultingApplication\(\);"/);
});
