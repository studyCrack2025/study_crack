import assert from 'node:assert/strict';
import test from 'node:test';
import { installWrittenChatViewport, shouldSendWrittenEnter } from '../../studycrack-mobile-app/src/features/consulting-v2/written-chat-layout.js';
import { mergeWrittenMessages } from '../../studycrack-mobile-app/src/features/consulting-v2/message-model.js';

function viewportFixture(withViewport = true) {
  const root = new Map(), attrs = new Map(), styles = new Map(), frames = new Map(), scrolls = [];
  const browser = Object.assign(new EventTarget(), { innerHeight: 844, innerWidth: 390, scrollX: 0, scrollY: 122,
    document: { documentElement: { getAttribute: key => root.get(key) ?? null, setAttribute: (key, value) => root.set(key, value), removeAttribute: key => root.delete(key) } },
    requestAnimationFrame: fn => { const id = Symbol(); frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id), scrollTo: value => scrolls.push(value) });
  if (withViewport) browser.visualViewport = Object.assign(new EventTarget(), { height: 844, width: 390, offsetTop: 0, offsetLeft: 0 });
  const element = { style: { setProperty: (key, value) => styles.set(key, value) }, setAttribute: (key, value) => attrs.set(key, value) };
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  return { browser, element, root, attrs, styles, frames, scrolls, flush };
}

test('a keyboard changes only the visual viewport; chat follows its height and pan without changing the layout viewport', () => {
  const f = viewportFixture(); let updates = 0;
  const dispose = installWrittenChatViewport(f.browser, f.element, () => updates++);
  Object.assign(f.browser.visualViewport, { height: 310, offsetTop: 92 });
  f.browser.visualViewport.dispatchEvent(new Event('resize'));
  f.browser.visualViewport.dispatchEvent(new Event('scroll'));
  assert.equal(f.frames.size, 1);
  f.flush();
  assert.equal(f.browser.innerHeight, 844);
  assert.equal(f.styles.get('--consulting-chat-height'), '310px');
  assert.equal(f.styles.get('--consulting-chat-top'), '92px');
  assert.equal(f.attrs.get('data-compact'), 'true');
  f.browser.visualViewport.dispatchEvent(new Event('scroll')); f.flush();
  assert.equal(updates, 2, 'identical frames must not reset the conversation scroll');
  Object.assign(f.browser.visualViewport, { height: 844, offsetTop: 0 });
  f.browser.visualViewport.dispatchEvent(new Event('resize')); f.flush();
  assert.equal(f.attrs.get('data-compact'), 'false');
  dispose();
  assert.equal(f.root.has('data-written-chat'), false);
  assert.deepEqual(f.scrolls, [{ left: 0, top: 122 }]);
});

test('fallback resize and disposal restore the document and cannot run a queued frame after leaving chat', () => {
  const f = viewportFixture(false);
  f.root.set('data-written-chat', 'previous');
  const dispose = installWrittenChatViewport(f.browser, f.element);
  f.browser.innerHeight = 400; f.browser.dispatchEvent(new Event('resize')); f.flush();
  assert.equal(f.styles.get('--consulting-chat-height'), '400px');
  f.browser.innerHeight = 350; f.browser.dispatchEvent(new Event('orientationchange'));
  dispose(); f.flush();
  assert.equal(f.root.get('data-written-chat'), 'previous');
  assert.equal(f.styles.get('--consulting-chat-height'), '400px');
  f.browser.dispatchEvent(new Event('resize'));
  assert.equal(f.frames.size, 0);
});

test('manager Enter sends, while student Enter and modified Enter remain text editing', () => {
  assert.equal(shouldSendWrittenEnter({ key: 'Enter' }, { manager: true }), true);
  assert.equal(shouldSendWrittenEnter({ key: 'Enter' }, { manager: false }), false);
  for (const key of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey', 'repeat']) assert.equal(shouldSendWrittenEnter({ key: 'Enter', [key]: true }, { manager: true }), false);
  assert.equal(shouldSendWrittenEnter({ key: 'a' }, { manager: true }), false);
});

test('Korean composition, Safari key229 and its final Enter never submit the draft', () => {
  for (const event of [{ key: 'Enter', isComposing: true }, { key: 'Enter', keyCode: 229 }, { key: 'Enter', nativeEvent: { isComposing: true } }, { key: 'Enter', nativeEvent: { keyCode: 229 } }]) assert.equal(shouldSendWrittenEnter(event, { manager: true }), false);
  assert.equal(shouldSendWrittenEnter({ key: 'Enter' }, { manager: true, composing: true }), false);
  assert.equal(shouldSendWrittenEnter({ key: 'Enter' }, { manager: true, now: 1000, compositionEndedAt: 990 }), false);
  assert.equal(shouldSendWrittenEnter({ key: 'Enter' }, { manager: true, now: 1100, compositionEndedAt: 990 }), true);
});

test('empty or duplicate polling preserves message identity, while changed text and attachments update it', () => {
  const current = [{ messageId: 'message-1', senderRole: 'student', body: '질문', createdAt: '2026-11-17T01:00:00Z' }];
  assert.equal(mergeWrittenMessages(current, []), current);
  assert.equal(mergeWrittenMessages(current, [{ ...current[0] }]), current);
  for (const patch of [{ body: '수정된 질문' }, { attachments: [{ fileId: 'file-1' }] }]) assert.notEqual(mergeWrittenMessages(current, [{ ...current[0], ...patch }]), current);
});
