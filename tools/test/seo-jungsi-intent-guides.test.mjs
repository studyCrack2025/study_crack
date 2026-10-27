import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relative) => readFile(new URL(`../../${relative}`, import.meta.url), 'utf8');
const count = (source, pattern) => (source.match(pattern) || []).length;

const pages = [
  {
    file: 'jungsi-admission-prediction-guide.html',
    slug: 'jungsi-admission-prediction-guide',
    title: /<title>정시 합격예측 결과 보는 법/,
    h1: /<h1>정시 합격예측 결과, 무엇을 확인해야 할까\?<\/h1>/,
    required: ['정시 합격예측', '적용 학년도', '모집단위', '모집군', '전년도 입시 결과', '합격을 보장하지 않습니다', '/jungsi-score-guide', '/service'],
  },
  {
    file: 'jungsi-percentile-guide.html',
    slug: 'jungsi-percentile-guide',
    title: /<title>정시 백분위 뜻/,
    h1: /<h1>정시 백분위 뜻과 대학 입결 읽는 법<\/h1>/,
    required: ['백분위', '표준점수', '평균 백분위', '70% 컷', '대학별 환산점수', '/jungsi-score-guide', '/service'],
  },
];

test('two intent-specific guides are indexable, distinct, linked, and source-grounded', async () => {
  const [home, sitemap, policy, css, scoreGuide] = await Promise.all([
    read('index.html'),
    read('sitemap.xml'),
    read('tools/public-site-files.json').then(JSON.parse),
    read('css/jungsi-score-guide.css'),
    read('jungsi-score-guide.html'),
  ]);
  const htmlByFile = new Map(await Promise.all(pages.map(async (page) => [page.file, await read(page.file)])));

  assert.equal(count(home, /href="\/jungsi-score-guide"/g), 1, 'preserve the existing homepage guide link');
  assert.match(css, /@media \(max-width:600px\)/);
  assert.match(css, /:focus-visible/);
  assert.match(scoreGuide, /https:\/\/www\.moe\.go\.kr\/boardCnts\/viewRenew\.do/);
  assert.match(scoreGuide, /\/jungsi-admission-prediction-guide/);
  assert.match(scoreGuide, /\/jungsi-percentile-guide/);

  for (const page of pages) {
    const html = htmlByFile.get(page.file);
    assert.match(html, page.title);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://studycrack\\.co\\.kr/${page.slug}">`));
    assert.doesNotMatch(html, /noindex|nofollow/i, 'new public pages must remain indexable');
    assert.match(html, page.h1);
    assert.match(html, /<main\b/);
    assert.match(html, /<link rel="stylesheet" href="\/css\/jungsi-score-guide\.css">/);
    assert.match(html, /\/jungsi-score-guide/);
    assert.match(html, /\/service/);
    for (const phrase of page.required) assert.ok(html.includes(phrase), `missing ${phrase} in ${page.file}`);
    assert.doesNotMatch(html, /<script\b|<form\b|localStorage|sessionStorage|document\.cookie/i);
    for (const [, attrs] of html.matchAll(/<a\b([^>]*href="https?:\/\/[^>]+)>/gi)) {
      assert.match(attrs, /rel="noopener noreferrer"/i, 'external sources must not expose opener context');
    }
    assert.ok(policy.files.includes(page.file), `${page.file} must be in the public allowlist`);
    assert.equal(policy.aliases[page.slug], page.file, `${page.slug} must resolve to its HTML file`);
    assert.equal(count(sitemap, new RegExp(`<loc>https://studycrack\\.co\\.kr/${page.slug}<\\/loc>`, 'g')), 1);
  }

  assert.match(htmlByFile.get('jungsi-admission-prediction-guide.html'), /대학별 산출 방식과 환산점수는 연도별로 다를 수 있습니다/);
  assert.match(htmlByFile.get('jungsi-percentile-guide.html'), /최종등록자/);
  assert.match(htmlByFile.get('jungsi-percentile-guide.html'), /한국교육과정평가원/);
  assert.match(htmlByFile.get('jungsi-percentile-guide.html'), /대입정보포털 어디가/);
});
