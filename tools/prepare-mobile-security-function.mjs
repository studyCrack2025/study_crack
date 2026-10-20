import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareMobileResponsePolicy } from './prepare-mobile-response-policy.mjs';
import { readSafeFile, verifySiteRelease } from './site-release.mjs';

const DEPENDENCIES = {
  'https://dev.studycrack.co.kr': ['https://api.dev.studycrack.co.kr'],
  'https://studycrack.co.kr': ['https://api.studycrack.co.kr']
};
const COGNITO = 'https://cognito-idp.ap-northeast-2.amazonaws.com';
const UPLOADS = 'https://study-crack-uploads.s3.ap-northeast-2.amazonaws.com';

// Candidate generation has no network calls or deployment side effects.
export function prepareMobileSecurityFunction({ html, origin, mode = 'report-only', imageOrigins = [], connectOrigins } = {}) {
  assert.ok(Object.hasOwn(DEPENDENCIES, origin), 'Use the approved dev or production origin');
  assert.ok(['report-only', 'enforce'].includes(mode), 'Choose report-only or enforce explicitly');
  assert.ok(typeof html === 'string' && html.length < 256_000, 'Use a bounded verified mobile shell');
  assert.doesNotMatch(html, /<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy/i, 'Do not layer an unreviewed meta policy');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  assert.ok(scripts.length > 0, 'Expected a mobile script inventory');
  for (const [, attributes, body] of scripts) {
    assert.match(attributes, /\bsrc\s*=\s*["']/i, 'Externalize inline mobile scripts before using the edge function');
    assert.equal(body.trim(), '', 'External script elements must not contain inline code');
  }
  const candidate = prepareMobileResponsePolicy({
    html, connectOrigins: connectOrigins ?? [...DEPENDENCIES[origin], COGNITO, UPLOADS],
    imageOrigins: [UPLOADS, ...imageOrigins]
  });
  const csp = candidate.responseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy;
  const header = mode === 'enforce' ? 'content-security-policy' : 'content-security-policy-report-only';
  const code = `function handler(event) {
  var response = event.response;
  var request = event.request;
  var headers = response.headers;
  var host = request.headers.host && request.headers.host.value;
  var uri = request.uri;
  var type = headers['content-type'] && headers['content-type'].value;
  if (host !== ${JSON.stringify(new URL(origin).hostname)} || (request.method !== 'GET' && request.method !== 'HEAD')
      || (uri !== '/studycrack-mobile' && uri !== '/studycrack-mobile.html')
      || response.statusCode !== 200 || !/^text\\/html(?:;|$)/i.test(type || '')) return response;
  headers['permissions-policy'] = { value: 'camera=(), microphone=(), geolocation=()' };
  if (!headers['content-security-policy'] && !headers['content-security-policy-report-only']) {
    headers[${JSON.stringify(header)}] = { value: ${JSON.stringify(csp)} };
  }
  return response;
}
`;
  assert.ok(Buffer.byteLength(code) < 10_240, 'Function exceeds the CloudFront code limit');
  return {
    schema: 1, scope: 'mobile-html-only', origin, mode, applied: false, compatibilityVerified: false,
    shellSha256: createHash('sha256').update(html, 'utf8').digest('hex'),
    runtime: 'cloudfront-js-2.0', eventType: 'viewer-response', code,
    testEvent: {
      version: '1.0', context: { eventType: 'viewer-response' }, viewer: { ip: '203.0.113.10' },
      request: { uri: '/studycrack-mobile', method: 'GET', querystring: {}, headers: { host: { value: new URL(origin).hostname } }, cookies: {} },
      response: { statusCode: 200, statusDescription: 'OK', headers: { 'content-type': { value: 'text/html; charset=utf-8' } }, cookies: {} }
    },
    review: ['live_authentication_upload_social_profile_origins', 'existing_viewer_response_association', 'deploy_externalized_shell_first', 'error_responses_not_covered']
  };
}

async function main() {
  const [artifact, commit, origin, destination, option, ...extra] = process.argv.slice(2);
  assert.ok(artifact && commit && origin && destination && !extra.length && (!option || option === '--enforce'), 'Expected artifact, full commit, approved origin, new output directory and optional --enforce');
  const verified = await verifySiteRelease({ output: path.resolve(artifact), commit });
  const html = (await readSafeFile(path.join(path.resolve(artifact), 'site'), 'studycrack-mobile.html')).toString('utf8');
  const candidate = prepareMobileSecurityFunction({ html, origin, mode: option ? 'enforce' : 'report-only' });
  const output = path.resolve(destination);
  await mkdir(output); // Never overwrite an existing candidate or deployment directory.
  const { code, testEvent, ...metadata } = candidate;
  await writeFile(path.join(output, 'viewer-response.js'), code, { flag: 'wx' });
  await writeFile(path.join(output, 'test-event.json'), `${JSON.stringify(testEvent, null, 2)}\n`, { flag: 'wx' });
  await writeFile(path.join(output, 'candidate.json'), `${JSON.stringify({ ...metadata, commit, release: verified.manifest.release, artifactDigest: verified.digest }, null, 2)}\n`, { flag: 'wx' });
  console.log(`Prepared ${candidate.mode} mobile function locally. No AWS changes or deployment performed.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Mobile function preparation failed; check arguments and the verified artifact.'); process.exitCode = 1; });
}
