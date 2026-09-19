import assert from 'node:assert/strict';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCUMENT_PATHS = ['/', '/studycrack-mobile', '/studycrack-mobile.html', '/login', '/payment', '/checkout', '/social-callback'];
const ASSETS = [
  ['/studycrack-mobile.webmanifest', /^application\/manifest\+json(?:;|$)/i],
  ['/js/config.js', /^(?:text|application)\/javascript(?:;|$)/i],
  ['/studycrack-mobile-app/dist/studycrack-mobile.bundle.js', /^(?:text|application)\/javascript(?:;|$)/i],
  ['/assets/pwa/studycrack-apple-touch-icon-v1-180.png', /^image\/png(?:;|$)/i]
];
const HEADER_NAMES = ['strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'content-security-policy', 'content-security-policy-report-only'];

function checkCsp(value, findings) {
  if (value.includes(',')) { findings.add('csp_multiple_or_malformed_policies'); return; }
  const directives = new Map();
  for (const part of value.split(';').map((item) => item.trim()).filter(Boolean)) {
    const [rawName, ...sources] = part.split(/\s+/);
    const name = rawName.toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(name) || directives.has(name)) findings.add('csp_duplicate_or_malformed_directive');
    directives.set(name, sources);
  }
  const exact = (name, allowed) => {
    const sources = directives.get(name);
    return sources?.length === 1 && allowed.includes(sources[0]);
  };
  if (!exact('default-src', ["'self'", "'none'"])) findings.add('csp_default_source_not_restricted');
  if (!exact('object-src', ["'none'"])) findings.add('csp_object_source_not_disabled');
  if (!exact('base-uri', ["'self'", "'none'"])) findings.add('csp_base_uri_not_restricted');
  if (!exact('frame-ancestors', ["'self'", "'none'"])) findings.add('csp_frame_ancestors_not_restricted');
  if (!directives.get('form-action')?.length) findings.add('csp_form_action_missing');
  if (!directives.get('script-src')?.length) findings.add('csp_script_source_missing');

  for (const [name, sources] of directives) {
    if (!/(?:-src(?:-elem|-attr)?$|^form-action$)/.test(name)) continue;
    const script = name.startsWith('script-src');
    for (const source of sources) {
      if (["'self'", "'none'"].includes(source)) continue;
      if (name.startsWith('style-src') && source === "'unsafe-inline'") continue;
      if (['img-src', 'font-src', 'media-src'].includes(name) && ['data:', 'blob:'].includes(source)) continue;
      if (script && /^'(?:sha(?:256|384|512)-[A-Za-z0-9+/]+={0,2}|nonce-[A-Za-z0-9+/_-]{22,}={0,2})'$/.test(source)) continue;
      if (script && source === "'strict-dynamic'") continue;
      if (/^https:\/\/[a-z0-9.-]+(?::[0-9]+)?(?:\/[^\s*?#]*)?$/i.test(source)) continue;
      findings.add(script ? 'csp_unsafe_or_unreviewed_script_source' : 'csp_broad_or_unreviewed_source');
    }
  }
}

export function inspectSecurityHeaders(headers, { document = true, https = true } = {}) {
  const findings = new Set();
  const read = (name) => {
    const value = (headers.get(name) || '').trim();
    if (value.length > 8192) { findings.add('header_value_too_large'); return ''; }
    return value;
  };
  const values = Object.fromEntries(HEADER_NAMES.map((name) => [name, read(name)]));
  if (https) {
    const hsts = values['strict-transport-security'];
    if (!hsts) findings.add('hsts_missing');
    else {
      const ages = hsts.split(';').map((item) => item.trim()).filter((item) => /^max-age\b/i.test(item));
      const match = ages.length === 1 && /^max-age\s*=\s*("?)([0-9]+)\1$/i.exec(ages[0]);
      if (hsts.includes(',') || !match || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) < 31536000) findings.add('hsts_invalid_or_short');
    }
  }
  if (values['x-content-type-options'].toLowerCase() !== 'nosniff') findings.add('nosniff_missing_or_invalid');
  let cspMode = 'not-applicable';
  if (document) {
    if (!['no-referrer', 'strict-origin', 'strict-origin-when-cross-origin'].includes(values['referrer-policy'].toLowerCase())) findings.add('referrer_policy_missing_or_weak');
    const permissions = values['permissions-policy'];
    if (!permissions) findings.add('permissions_policy_missing');
    else {
      const parts = permissions.split(',').map((part) => part.trim());
      for (const feature of ['camera', 'microphone', 'geolocation']) {
        const entries = parts.filter((part) => new RegExp(`^${feature}\\b`, 'i').test(part));
        if (entries.length !== 1 || !new RegExp(`^${feature}\\s*=\\s*\\(\\s*\\)$`).test(entries[0])) findings.add('permissions_policy_missing_or_unsafe_directive');
      }
    }
    const enforced = values['content-security-policy'];
    const reportOnly = values['content-security-policy-report-only'];
    cspMode = enforced ? 'enforced' : reportOnly ? 'report-only' : 'missing';
    if (enforced) checkCsp(enforced, findings);
    else findings.add(reportOnly ? 'csp_report_only_not_enforced' : 'csp_missing');
    if ([enforced, reportOnly].some((value) => /(?:^|;)\s*report-(?:uri|to)\b|\breport-sample\b/i.test(value))) findings.add('csp_reporting_requires_privacy_review');
  }
  return { findings: [...findings], cspMode };
}

export async function auditSecurityHeaders({ origin, fetchImpl = fetch }) {
  const base = new URL(origin);
  assert.equal(base.origin, origin, 'Use a bare approved origin');
  assert.ok(['https://dev.studycrack.co.kr', 'https://studycrack.co.kr'].includes(origin)
    || (base.protocol === 'http:' && base.hostname === '127.0.0.1'), 'Use an approved origin');
  const targets = [...DOCUMENT_PATHS.map((target) => [target, /^text\/html(?:;|$)/i, true]), ...ASSETS.map(([target, mime]) => [target, mime, false])];
  const results = [];
  for (const [target, mime, document] of targets) {
    let response;
    try {
      response = await fetchImpl(`${origin}${target}`, {
        method: 'GET', credentials: 'omit', redirect: 'manual', referrerPolicy: 'no-referrer',
        signal: AbortSignal.timeout(8000)
      });
      if (response.status !== 200) results.push({ path: target, status: response.status, findings: ['unexpected_status'], cspMode: 'not-assessed' });
      else {
        const result = inspectSecurityHeaders(response.headers, { document, https: base.protocol === 'https:' });
        if (!mime.test(response.headers.get('content-type') || '')) result.findings.push('content_type_mismatch');
        results.push({ path: target, status: response.status, ...result });
      }
    } catch {
      results.push({ path: target, status: 0, findings: ['request_unavailable'], cspMode: 'not-assessed' });
    } finally {
      // Never read response bodies or retain raw headers, redirects or exception text.
      try { await response?.body?.cancel(); } catch {}
    }
  }
  return {
    schema: 1, origin, scope: 'public-response-baseline', enforcementChanged: false,
    ok: results.every(({ findings }) => !findings.length), checked: results.length,
    serviceWorker: 'not-configured', manualReview: ['exact_csp_origin_inventory', 'authentication_payment_upload_compatibility', 'all_edge_behaviors_and_error_responses'], results
  };
}

export function auditExitCode(result, { reportOnly = false } = {}) {
  return result.ok || reportOnly ? 0 : 1;
}

async function main() {
  const [origin, mode, ...extra] = process.argv.slice(2);
  assert.ok(origin && !extra.length && (!mode || mode === '--report-only'), 'Expected an approved origin and optional --report-only');
  const result = await auditSecurityHeaders({ origin });
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const count = result.results.filter(({ findings }) => findings.length).length;
    const rows = result.results.map(({ path: target, status, findings }) => `| ${target} | ${status || 'unavailable'} | ${findings.join(', ') || 'baseline passed'} |`);
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Security header audit — ${mode ? 'report only' : 'strict check'}\n\n${count}/${result.checked} responses need review. No policies were changed. CSP origin and real-account/device validation remain required. Service worker is not configured.\n\n| Public path | HTTP | Findings |\n|---|---|---|\n${rows.join('\n')}\n`);
  }
  if (!result.ok && mode === '--report-only') console.error('Security header findings recorded; this report is not security acceptance.');
  process.exitCode = auditExitCode(result, { reportOnly: mode === '--report-only' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Security header audit could not complete.'); process.exitCode = 1; });
}
