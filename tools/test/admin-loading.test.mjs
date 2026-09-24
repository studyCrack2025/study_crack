import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL(`../../js/${name}`, import.meta.url), 'utf8');
function element(value = '') {
    return { value, innerHTML: '', textContent: '', dataset: {}, style: {}, options: [], children: [], listeners: {},
        addEventListener(type, handler) { this.listeners[type] = handler; },
        appendChild(child) { this.children.push(child); this.options.push(child); },
        setAttribute() {}, removeAttribute() {}, focus() {},
        querySelector(selector) { return this.parts?.[selector] || null; } };
}
function setup() {
    const nodes = new Map();
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    get('filterTier').value = get('filterTutor').value = 'all';
    get('filterTutor').options = [element('all')];
    get('searchType').value = 'name';
    const context = vm.createContext({ console, Intl, URLSearchParams, encodeURIComponent,
        CONFIG: { api: { qna: '/qna', noti: '/noti' } }, ADMIN_API_URL: '/admin',
        localStorage: { getItem: () => 'admin-owner' }, Store: { get: () => null, set() {} },
        setTimeout() {}, alert() {}, escapeHtml: value => String(value ?? '').replaceAll("'", '&#039;'),
        document: { addEventListener() {}, getElementById: get,
            createElement(tag) { const el = element(); if (tag === 'tr') el.parts = Object.fromEntries(
                ['[data-student-detail]', '[data-qna-view]', '[data-qna-action]'].map(key => [key, element()])); return el; } },
        location: { href: '' }, apiFetch: async () => ({ json: async () => [] }) });
    context.window = context;
    for (const file of ['admin_ui.js', 'admin/students.js', 'admin/qna.js']) vm.runInContext(source(file), context);
    return { context, get, run: code => vm.runInContext(code, context) };
}
test('pending tutor lookup does not block students or question badge; saved tutor survives', async () => {
    const { context, get, run } = setup();
    const calls = [];
    context.Store.get = () => ({ filterTutor: 'saved tutor' });
    context.loadAdminStats = () => calls.push('stats');
    context.populateTutorFilter = () => new Promise(() => {});
    context.searchStudents = () => calls.push('students');
    context.fetchUnreadNotiCount = () => calls.push('noti');
    context.fetchQnaBadgeCount = () => calls.push('qna');
    await run('initAdminPage("admin-owner")');
    assert.deepEqual(calls, ['stats', 'students', 'noti', 'qna']);
    assert.equal(get('filterTutor').value, 'saved tutor');
});
test('tutor options use lite lookup, preserve current selection and do not duplicate', async () => {
    const { context, get, run } = setup();
    get('filterTutor').value = 'saved tutor';
    get('filterTutor').options.push(element('saved tutor'));
    context.apiFetch = async (_, options) => {
        assert.equal(JSON.parse(options.body).type, 'admin_get_tutor_list');
        return { json: async () => ({ tutors: [{ nickname: 'saved tutor' }, { nickname: 'new tutor' }] }) };
    };
    await run('populateTutorFilter()'); await run('populateTutorFilter()');
    assert.equal(get('filterTutor').options.length, 3);
    assert.equal(get('filterTutor').value, 'saved tutor');
});
test('malformed student and question responses show retry rather than zero results or endless loading', async () => {
    const { context, get, run } = setup();
    context.apiFetch = async () => ({ json: async () => ({ unexpected: true }) });
    await run('searchStudents()'); await run('loadAllQna()');
    assert.equal(get('studentResultSummary').dataset.state, 'error');
    assert.match(get('studentListBody').innerHTML, /다시 시도/);
    assert.match(get('qnaListBody').innerHTML, /다시 시도/);
});
test('late failed search cannot replace a newer successful result', async () => {
    const { context, get, run } = setup();
    let rejectOld;
    context.apiFetch = () => new Promise((_, reject) => { rejectOld = reject; });
    const old = run('searchStudents()');
    context.apiFetch = async () => ({ json: async () => [] });
    await run('searchStudents()');
    rejectOld(new Error('late failure')); await old;
    assert.equal(get('studentResultSummary').dataset.state, 'success');
    assert.match(get('studentListBody').innerHTML, /조건에 맞는 학생이 없습니다/);
});
test('nonempty question row binds detail safely and encodes identifiers without a second call', async () => {
    const { context, get, run } = setup();
    context.apiFetch = async () => ({ json: async () => ({ qnaList: [
        { userid: 'user&other=1', qnaId: "id'quoted", status: 'waiting', title: "학생'문의", createdAt: '2026-09-24' }
    ] }) });
    await run('loadAllQna()');
    const row = get('qnaListBody').children[0];
    assert.ok(row);
    assert.doesNotMatch(row.innerHTML, /onclick=/);
    let stopped = false;
    row.parts['[data-student-detail]'].listeners.click({ stopPropagation() { stopped = true; } });
    assert.equal(stopped, true);
    assert.equal(context.location.href, '/admin/detail?uid=user%26other%3D1');
    assert.equal(run('decodePromoCodeToMbti(123)'), null);
});

test('student lookup recovers after failure and renders legacy promotion values', async () => {
    const { context, get, run } = setup();
    context.apiFetch = async () => { throw new Error('temporary failure'); };
    await run('searchStudents()');
    assert.equal(get('studentResultSummary').dataset.state, 'error');
    context.apiFetch = async () => ({ json: async () => ({ students: [
        { userid: 'student-1', name: 'Test student', promoCode: 123, createdAt: '2026-09-24' }
    ] }) });
    await run('searchStudents()');
    assert.equal(get('studentResultSummary').dataset.state, 'success');
    assert.match(get('studentResultSummary').textContent, /1명/);
    assert.equal(get('studentListBody').children.length, 1);
    assert.match(get('studentListBody').children[0].innerHTML, /Test student/);
});

test('question retry succeeds and ignores an older failed request', async () => {
    const { context, get, run } = setup();
    let rejectOld;
    context.apiFetch = () => new Promise((_, reject) => { rejectOld = reject; });
    const old = run('loadAllQna()');
    context.apiFetch = async () => ({ json: async () => ({ qnaList: [
        { userid: 'student-1', qnaId: 'q-1', status: 'waiting', title: 'Latest question' }
    ] }) });
    await run('loadAllQna()');
    rejectOld(new Error('late failure')); await old;
    assert.equal(get('qnaListBody').children.length, 1);
    assert.match(get('qnaListBody').children[0].innerHTML, /Latest question/);
    assert.doesNotMatch(get('qnaListBody').innerHTML, /다시 시도/);
    assert.equal(get('qnaBadge').innerText, 1);
});
