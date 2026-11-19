import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../../js/admin/consulting-workspace.js', import.meta.url), 'utf8');
const id = 'APP_11111111-1111-4111-8111-111111111111';
function setup() {
    const element = () => ({
        children: [], dataset: {}, textContent: '', attributes: {},
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); },
        setAttribute(name, value) { this.attributes[name] = value; },
        replaceChildren(...children) { this.children = children; }
    });
    const context = vm.createContext({
        window: { addEventListener() {} }, document: { createElement: element },
        createConsultingCell: text => Object.assign(element(), { textContent: text }),
        createConsultingFacts: entries => entries,
        updateConsultingExportSelection() {},
        formatConsultingDate: value => value, clearTimeout() {}
    });
    vm.runInContext(source, context);
    return { context, element, run: code => vm.runInContext(code, context) };
}
const issue = { applicationId: id, sourceResponseId: 'synthetic_response', issueCode: 'DIRECTORY_CASE_MISSING',
    studentNameMask: '합*생', phoneMask: '010-****-0000', productType: 'calculator' };

test('legacy responses remain usable while issue payloads are bounded and strictly identified', () => {
    const h = setup();
    h.context.response = { items: [] };
    assert.equal(h.run('consultingDirectoryIssueRows(response)').length, 0);
    h.context.response = { items: [], unavailableCount: 1, issueRows: [issue] };
    assert.equal(h.run('consultingDirectoryIssueRows(response)').length, 1);
    for (const patch of [{ applicationId: 'private@example.invalid' }, { sourceResponseId: '../wrong' },
        { issueCode: '__proto__' }, { studentNameMask: {} }, { productType: 'other' }]) {
        h.context.response = { items: [], unavailableCount: 1, issueRows: [{ ...issue, ...patch }] };
        assert.throws(() => h.run('consultingDirectoryIssueRows(response)'));
    }
    h.context.response = { items: [], unavailableCount: 0, issueRows: [issue] };
    assert.throws(() => h.run('consultingDirectoryIssueRows(response)'));
    h.context.response = { items: Array(20).fill({}), unavailableCount: 1, issueRows: [issue] };
    assert.throws(() => h.run('consultingDirectoryIssueRows(response)'));
});

test('issue display uses literal text, offers inspection only and never selects an export row', () => {
    const h = setup(), body = h.element();
    h.context.body = body;
    h.context.issues = [{ ...issue, studentNameMask: '<img src=x onerror=bad>' }];
    h.run('appendConsultingDirectoryIssues(body, issues)');
    const row = body.children[0];
    assert.equal(row.children[0].children[0].textContent, '<img src=x onerror=bad>');
    assert.equal(row.children[1].textContent, '연결 확인 필요');
    assert.equal(row.children[4].children[0].children[0].textContent, '점검 정보');
    assert.equal(JSON.stringify(body).includes('innerHTML'), false);
    assert.equal(h.run('consultingExportPage.length'), 0);
    assert.equal(row.children.some(cell => cell.children.some(child => child.type === 'checkbox' || child.type === 'button')), false);
});
