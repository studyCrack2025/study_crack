import assert from 'node:assert/strict';
import { isValidEmailAddress, sanitizeEmailInput } from '../src/utils/email-input.js';

assert.equal(sanitizeEmailInput('테스트abc@studycrack.co.kr'), 'abc@studycrack.co.kr');
assert.equal(sanitizeEmailInput(' user @example.com '), 'user@example.com');
assert.equal(sanitizeEmailInput('ＡＢＣabc@example.com'), 'abc@example.com');
assert.equal(sanitizeEmailInput("student+mobile.o'k@example.co.kr"), "student+mobile.o'k@example.co.kr");
assert.equal(isValidEmailAddress('student@example.com'), true);
assert.equal(isValidEmailAddress('학생@example.com'), false);
assert.equal(isValidEmailAddress('student@@example.com'), false);
assert.equal(isValidEmailAddress('student@example'), false);

console.log('email-input contracts passed');
