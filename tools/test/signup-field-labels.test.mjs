import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../signup.html', import.meta.url), 'utf8');
const labels = [...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"[^>]*>([\s\S]*?)<\/label>/g)];
const controls = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/g)];

test('signup labels are programmatically associated with their controls', () => {
  for (const [id, text] of [
    ['email', '이메일 (아이디)'],
    ['password', '비밀번호'],
    ['passwordConfirm', '비밀번호 확인'],
    ['name', '이름 (실명)'],
    ['gender', '성별'],
    ['birthdate', '생년월일'],
    ['phone', '전화번호']
  ]) {
    const matchingLabels = labels.filter(([, labelId]) => labelId === id);
    const matchingControls = controls.filter(([, controlId]) => controlId === id);
    assert.equal(matchingLabels.length, 1, `#${id} has exactly one label`);
    assert.equal(matchingLabels[0][2].trim(), text, `${text} label points to #${id}`);
    assert.equal(matchingControls.length, 1, `#${id} control exists exactly once`);
  }
});
