import assert from 'node:assert/strict';
import { createFormHandlers } from '../src/handlers/form-handlers.js';
import { createServiceHandlers } from '../src/handlers/service-handlers.js';

const qnaDraftRef = { current: { title: '', content: '' } };
let stateWriteCount = 0;
const form = createFormHandlers({
  qnaDraftRef,
  setQnaDraftTitle: () => { stateWriteCount += 1; },
  setQnaDraftContent: () => { stateWriteCount += 1; }
});

function input(field, value) {
  return {
    value,
    hasAttribute: () => false,
    getAttribute: (name) => name === 'data-field' ? field : null,
    classList: { contains: () => false }
  };
}

form.handleInput({ target: input('qnaDraftTitle', '환산점수 문의') });
form.handleInput({ target: input('qnaDraftContent', '첫 화면에서 점수가 보이지 않습니다.') });
assert.deepEqual(qnaDraftRef.current, {
  title: '환산점수 문의',
  content: '첫 화면에서 점수가 보이지 않습니다.'
});
assert.equal(stateWriteCount, 0, '문의 입력 중에는 화면 전체를 다시 렌더하는 state setter를 호출하면 안 됩니다.');

let submitted = null;
const fields = {
  '[data-field="qnaDraftTitle"]': { value: qnaDraftRef.current.title },
  '[data-field="qnaDraftContent"]': { value: qnaDraftRef.current.content }
};
const service = createServiceHandlers({
  document: { querySelector: (selector) => fields[selector] || null },
  qnaDraftRef,
  persistMobileQna: async (draft) => {
    submitted = draft;
    return { ok: true, data: { qnaId: 'qna-test', ...draft }, error: '', status: 200, code: '' };
  },
  setQnaSubmitting: () => {},
  setQnaHistory: () => {},
  setQnaStatus: () => {},
  setQnaDraftTitle: () => {},
  setQnaDraftContent: () => {},
  setQnaComposerOpen: () => {},
  alert: () => {}
});

assert.equal(await service.submitMobileQna(), true);
assert.deepEqual(submitted, {
  title: '환산점수 문의',
  content: '첫 화면에서 점수가 보이지 않습니다.'
});
assert.deepEqual(qnaDraftRef.current, { title: '', content: '' }, '제출 성공 후에만 문의 초안을 비워야 합니다.');

console.log('qna-composer contracts passed');
