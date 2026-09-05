import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

test.skip(!process.env.STUDYCRACK_PREVIEW_ROOT, 'Only run against the sealed public artifact.');

test('공개 산출물은 등록한 웹 페이지와 모바일 파일을 검증한 바이트 그대로 제공한다', async ({ request }) => {
  const site = path.resolve(process.env.STUDYCRACK_PREVIEW_ROOT);
  const manifest = JSON.parse(await readFile(path.join(site, '../manifest.json'), 'utf8'));
  const samples = manifest.files.filter((entry) => entry.path.endsWith('.html') || ['js/config.js', 'js/shared/api.js', 'studycrack-mobile.webmanifest', 'studycrack-mobile-app/dist/studycrack-mobile.bundle.js', 'promotion/kcc01'].includes(entry.path));
  for (const entry of samples) {
    const response = await request.get(`/${entry.path}`);
    expect(response.status(), entry.path).toBe(200);
    const digest = createHash('sha256').update(await response.body()).digest('hex');
    expect(digest, entry.path).toBe(entry.sha256);
  }
  const manifestResponse = await request.get('/studycrack-mobile.webmanifest');
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  const promotion = await request.get('/promotion/kcc01');
  expect(promotion.headers()['content-type']).toContain('text/html');
  expect((await request.get('/studycrack-mobile')).status()).toBe(200);
});

test('내부 문서·소스·도구·개발 데이터는 공개 산출물에서 읽을 수 없다', async ({ request }) => {
  for (const file of ['docs/exec-plans/current.md', 'AGENTS.md', 'backend-backup/StudyCrack_Auth/index.mjs', 'studycrack-mobile-app/src/runtime/main.js', 'studycrack-mobile-app/package.json', 'studycrack-mobile-app/e2e/core-flows.spec.mjs', 'tools/site-release.mjs', 'manifest.json', '.env', '.git/config', 'css/style.css.bak', 'js/dev-mock.local.example.js', 'js/dev-mock.local.js']) {
    const response = await request.get(`/${file}`);
    expect([403, 404], file).toContain(response.status());
  }
});
