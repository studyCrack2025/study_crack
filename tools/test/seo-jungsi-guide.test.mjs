import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('public Jungsi guide answers the target intent with current official sources', async () => {
  const [guide, css, home, sitemap, publicPolicy] = await Promise.all([
    read('jungsi-score-guide.html'),
    read('css/jungsi-score-guide.css'),
    read('index.html'),
    read('sitemap.xml'),
    readFile(new URL('../../tools/public-site-files.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);

  assert.match(guide, /<title>2027 정시 환산점수 보는 법/);
  assert.match(guide, /<meta name="description" content="[^"]+"/);
  assert.match(guide, /<link rel="canonical" href="https:\/\/studycrack\.co\.kr\/jungsi-score-guide"/);
  assert.doesNotMatch(guide, /noindex|nofollow/i, 'public guide must remain eligible for indexing');
  assert.match(guide, /<h1[^>]*>정시 환산점수 보는 법/);
  assert.match(guide, /2026년 11월 19일/);
  assert.match(guide, /2026년 12월 11일/);
  assert.match(guide, /https:\/\/www\.moe\.go\.kr\/boardCnts\/viewRenew\.do/);
  assert.match(guide, /https:\/\/www\.adiga\.kr\/cct\/stp\/guide\/novicePopup030103\.do/);
  assert.match(guide, /합격을 보장하지 않습니다/);
  assert.match(guide, /<link rel="stylesheet" href="\/css\/jungsi-score-guide\.css">/);
  assert.doesNotMatch(guide, /<script\b|<form\b|<style\b|localStorage|sessionStorage|document\.cookie/i);
  assert.match(css, /@media \(max-width:600px\)/);
  assert.match(css, /:focus-visible/);
  for (const [, attrs] of guide.matchAll(/<a\b([^>]*href="https?:\/\/[^>]+)>/gi)) {
    assert.match(attrs, /rel="noopener noreferrer"/i, 'external source links must not expose opener context');
  }

  assert.equal((home.match(/href="\/jungsi-score-guide"/g) || []).length, 1, 'homepage must provide exactly one discovery link');
  assert.equal((sitemap.match(/<loc>https:\/\/studycrack\.co\.kr\/jungsi-score-guide<\/loc>/g) || []).length, 1);
  assert.ok(publicPolicy.files.includes('jungsi-score-guide.html'));
  assert.ok(publicPolicy.files.includes('css/jungsi-score-guide.css'));
  assert.equal(publicPolicy.aliases['jungsi-score-guide'], 'jungsi-score-guide.html');
});
