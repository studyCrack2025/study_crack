import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const repoRoot = new URL('../', import.meta.url);
const expectedSitemapUrls = [
  'https://studycrack.co.kr/',
  'https://studycrack.co.kr/service',
  'https://studycrack.co.kr/analysis',
  'https://studycrack.co.kr/payment',
  'https://studycrack.co.kr/qna',
  'https://studycrack.co.kr/promotion/kcc01'
];
const indexedPages = [
  ['index.html', 'https://studycrack.co.kr/'],
  ['service.html', 'https://studycrack.co.kr/service'],
  ['analysis.html', 'https://studycrack.co.kr/analysis'],
  ['payment.html', 'https://studycrack.co.kr/payment'],
  ['qna.html', 'https://studycrack.co.kr/qna']
];

async function read(relativePath) {
  return readFile(new URL(relativePath, repoRoot), 'utf8');
}

function findTagEnd(source, start) {
  let quote = '';
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '>') return index;
  }
  return -1;
}

function parseAttributes(rawTag) {
  const attributes = {};
  let index = rawTag.search(/\s/);
  if (index < 0) return attributes;

  while (index < rawTag.length) {
    while (/\s/.test(rawTag[index] || '')) index += 1;
    if (index >= rawTag.length || rawTag[index] === '/' || rawTag[index] === '>') break;

    const nameStart = index;
    while (index < rawTag.length && !/[\s=/>]/.test(rawTag[index])) index += 1;
    const name = rawTag.slice(nameStart, index).toLowerCase();
    while (/\s/.test(rawTag[index] || '')) index += 1;

    let value = '';
    if (rawTag[index] === '=') {
      index += 1;
      while (/\s/.test(rawTag[index] || '')) index += 1;
      const quote = rawTag[index] === '"' || rawTag[index] === "'" ? rawTag[index] : '';
      if (quote) {
        index += 1;
        const valueStart = index;
        while (index < rawTag.length && rawTag[index] !== quote) index += 1;
        value = rawTag.slice(valueStart, index);
        if (rawTag[index] === quote) index += 1;
      } else {
        const valueStart = index;
        while (index < rawTag.length && !/[\s>]/.test(rawTag[index])) index += 1;
        value = rawTag.slice(valueStart, index);
      }
    }
    if (name) attributes[name] = value;
  }
  return attributes;
}

function startTags(source, tagName) {
  const tags = [];
  const lowerSource = source.toLowerCase();
  const needle = `<${tagName.toLowerCase()}`;
  let offset = 0;
  while (offset < source.length) {
    const start = lowerSource.indexOf(needle, offset);
    if (start < 0) break;
    const boundary = lowerSource[start + needle.length] || '';
    if (boundary && !/[\s/>]/.test(boundary)) {
      offset = start + needle.length;
      continue;
    }
    const end = findTagEnd(source, start + needle.length);
    if (end < 0) break;
    tags.push(parseAttributes(source.slice(start + 1, end)));
    offset = end + 1;
  }
  return tags;
}

function headSource(html) {
  const lowerHtml = html.toLowerCase();
  const start = lowerHtml.indexOf('<head');
  if (start < 0) return '';
  const openEnd = findTagEnd(html, start + 5);
  const end = lowerHtml.indexOf('</head>', openEnd + 1);
  return openEnd >= 0 && end >= 0 ? html.slice(openEnd + 1, end) : '';
}

function elementText(source, tagName) {
  const lowerSource = source.toLowerCase();
  const start = lowerSource.indexOf(`<${tagName.toLowerCase()}`);
  if (start < 0) return '';
  const openEnd = findTagEnd(source, start + tagName.length + 1);
  const end = lowerSource.indexOf(`</${tagName.toLowerCase()}>`, openEnd + 1);
  return openEnd >= 0 && end >= 0 ? source.slice(openEnd + 1, end).trim() : '';
}

function findMeta(head, name) {
  return startTags(head, 'meta').filter((tag) => String(tag.name || '').toLowerCase() === name.toLowerCase());
}

function findPropertyMeta(head, property) {
  return startTags(head, 'meta').filter((tag) => String(tag.property || '').toLowerCase() === property.toLowerCase());
}

function findCanonical(head) {
  return startTags(head, 'link').filter((tag) => String(tag.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
}

function sitemapLocations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => match[1]);
}

const [sitemap, robots, login, signup, home, promotion, workflow] = await Promise.all([
  read('sitemap.xml'),
  read('robots.txt'),
  read('login.html'),
  read('signup.html'),
  read('index.html'),
  read('promotion_kcc01.html'),
  read('.github/workflows/deploy.yml')
]);

const sitemapUrls = sitemapLocations(sitemap);
assert.deepEqual(sitemapUrls, expectedSitemapUrls, 'sitemap.xml must contain the six public URLs in the approved order');
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length, 'sitemap.xml contains duplicate URLs');
assert.match(robots, /^Sitemap:\s*https:\/\/studycrack\.co\.kr\/sitemap\.xml\s*$/m, 'robots.txt must declare the production sitemap');
assert.doesNotMatch(robots, /^Disallow:\s*\/(?:login|signup)\/?\s*$/mi, 'login and signup must remain crawlable for noindex');

for (const [fileName, html] of [['login.html', login], ['signup.html', signup]]) {
  const tags = findMeta(headSource(html), 'robots');
  assert.equal(tags.length, 1, `${fileName} must have exactly one robots meta tag`);
  assert.equal(String(tags[0].content || '').toLowerCase().replace(/\s+/g, ''), 'noindex,follow', `${fileName} must use noindex,follow`);
}

const descriptions = [];
for (const [fileName, canonicalUrl] of indexedPages) {
  const html = fileName === 'index.html' ? home : await read(fileName);
  const head = headSource(html);
  const title = elementText(head, 'title');
  const descriptionTags = findMeta(head, 'description');
  const canonicalTags = findCanonical(head);
  assert.ok(title, `${fileName} must have a non-empty title`);
  assert.equal(descriptionTags.length, 1, `${fileName} must have exactly one meta description`);
  assert.ok(String(descriptionTags[0].content || '').trim(), `${fileName} must have a non-empty meta description`);
  assert.equal(canonicalTags.length, 1, `${fileName} must have exactly one canonical link`);
  assert.equal(canonicalTags[0].href, canonicalUrl, `${fileName} canonical URL is incorrect`);
  descriptions.push(descriptionTags[0].content.trim());
}
assert.equal(new Set(descriptions).size, descriptions.length, 'indexed pages must use unique meta descriptions');

const targetImage = startTags(home, 'img').filter((tag) => tag.src === '/assets/figma/figma-asset-08.png');
assert.equal(targetImage.length, 1, 'the target homepage image must appear exactly once as an img element');
assert.equal(targetImage[0].alt, '대학 전형별 반영 방식에 따라 달라지는 합격 전략 예시', 'the target homepage image alt text is incorrect');

const promotionHead = headSource(promotion);
const promotionCanonical = findCanonical(promotionHead);
const promotionOgUrl = findPropertyMeta(promotionHead, 'og:url');
assert.equal(promotionCanonical.length, 1, 'promotion page must have exactly one canonical link');
assert.equal(promotionCanonical[0].href, 'https://studycrack.co.kr/promotion/kcc01', 'promotion canonical must use the public clean URL');
assert.equal(promotionOgUrl.length, 1, 'promotion page must have exactly one og:url');
assert.equal(promotionOgUrl[0].content, 'https://studycrack.co.kr/promotion/kcc01', 'promotion og:url must use the public clean URL');
assert.ok(workflow.includes('aws s3 cp promotion_kcc01.html s3://${{ env.S3_BUCKET }}/promotion/kcc01'), 'deploy workflow must publish the promotion clean URL');
assert.ok(workflow.includes('--content-type "text/html; charset=utf-8"'), 'promotion clean URL must use an HTML content type');

console.log(`SEO contracts passed: ${sitemapUrls.length} sitemap URLs, ${indexedPages.length} indexed pages, 2 noindex pages.`);
