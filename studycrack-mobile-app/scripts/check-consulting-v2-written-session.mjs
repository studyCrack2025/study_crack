import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClientMessageId, mergeWrittenMessages, nextWrittenPollDelay } from '../src/features/consulting-v2/message-model.js';
import { actionPathForState } from '../src/features/consulting-v2/progress-model.js';

const a = { messageId: '01K00000000000000000000000', senderRole: 'student', createdAt: '2026-10-08T01:00:00.000Z', body: '<script>alert(1)</script>' };
const b = { messageId: '01K00000000000000000000001', senderRole: 'counselor', createdAt: '2026-10-08T01:00:01.000Z', body: '답변' };
assert.deepEqual(mergeWrittenMessages([b], [a, b]).map(item => item.messageId), [a.messageId, b.messageId]);
assert.equal(nextWrittenPollDelay({ changed: true, unchangedCount: 4 }), 3000);
assert.equal(nextWrittenPollDelay({ changed: false, unchangedCount: 1 }), 5000);
assert.equal(nextWrittenPollDelay({ changed: false, unchangedCount: 2 }), 10000);
assert.match(createClientMessageId(), /^[0-9a-f-]{36}$/i);
assert.equal(actionPathForState('WRITTEN_SESSION_BOOKED'), '/2027-jungsi-consulting/written-session');

const screen = await readFile(new URL('../src/features/consulting-v2/screens/ConsultingWrittenSessionScreen.jsx', import.meta.url), 'utf8');
assert.doesNotMatch(screen, /dangerouslySetInnerHTML|innerHTML/);
assert.match(screen, /visibilitychange/);
assert.match(screen, /pendingSend/);
assert.match(screen, /상담사 전용/);
console.log('consulting v2 written session contracts passed');
