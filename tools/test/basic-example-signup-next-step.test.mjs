import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../../basic-preview-example.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../css/basic-preview-example.css', import.meta.url), 'utf8');
const unlock = html.match(/<section class="basic-example-unlock"[\s\S]*?<\/section>/)?.[0];

test('the sample results offer a signup next step without replacing purchase', () => {
  assert.ok(unlock, 'BASIC unlock section exists');
  assert.match(unlock, /<a href="\/signup"[^>]*>회원가입 후 시작하기<\/a>/);
  assert.match(unlock, /<a class="basic-example-purchase" href="\/payment\?plan=basic">전체 분석 열기 · 25,000원<\/a>/);
  assert.match(css, /\.basic-example-signup-next-step\s*\{[^}]*text-align:\s*center/s);
});
