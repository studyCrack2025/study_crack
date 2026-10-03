import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

function sources(origins) {
  assert.ok(Array.isArray(origins) && origins.length <= 12, 'Provide a bounded exact-origin inventory');
  for (const origin of origins) {
    assert.equal(typeof origin, 'string');
    const url = new URL(origin);
    assert.ok(url.protocol === 'https:' && !url.username && !url.password && url.origin === origin && /^[a-z0-9.-]+$/i.test(url.hostname), 'Use exact HTTPS origins without credentials or wildcards');
  }
  return [...new Set(origins)].sort().join(' ');
}

// A candidate only: response-byte hashes do not prove live dependency compatibility.
export function prepareMobileResponsePolicy({ html, connectOrigins = [], imageOrigins = [], formOrigins = [] }) {
  assert.ok(typeof html === 'string' && html.length < 256_000, 'Use a bounded verified mobile shell');
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i, 'Move HTML event handlers out of the shell');
  const hashes = [];
  let scriptCount = 0;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    scriptCount += 1;
    const attributes = match[1];
    assert.doesNotMatch(attributes, /\bnonce\s*=/i, 'Do not reuse a static nonce');
    const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attributes);
    if (/\bsrc\s*=/i.test(attributes)) {
      assert.ok(src, 'Use an explicit quoted script source');
      assert.ok(!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(src[1]), 'External script dependencies require separate review');
    }
    else hashes.push(`'sha256-${createHash('sha256').update(match[2], 'utf8').digest('base64')}'`);
  }
  assert.ok(scriptCount > 0 && hashes.length <= 6, 'Expected a small mobile script inventory');
  const policy = [
    "default-src 'self'", `script-src 'self' ${[...new Set(hashes)].join(' ')}`.trim(), "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'", `img-src 'self' data: blob: ${sources(imageOrigins)}`.trim(),
    "font-src 'self' data:", `connect-src 'self' ${sources(connectOrigins)}`.trim(),
    "frame-src 'none'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'self'",
    `form-action 'self' ${sources(formOrigins)}`.trim(), "manifest-src 'self'", "worker-src 'none'"
  ].join('; ');
  assert.ok(policy.length <= 1783, 'Policy exceeds the CDN CSP limit');
  return {
    scope: 'mobile-shell-candidate', applied: false, compatibilityVerified: false,
    responseHeadersPolicyConfig: {
      Name: 'mobile-shell-security-candidate',
      Comment: 'Candidate only; verify browser dependencies and rollback compatibility before attachment.',
      SecurityHeadersConfig: {
        StrictTransportSecurity: { AccessControlMaxAgeSec: 31536000, IncludeSubdomains: false, Preload: false, Override: true },
        ContentTypeOptions: { Override: true },
        ReferrerPolicy: { ReferrerPolicy: 'no-referrer', Override: true },
        ContentSecurityPolicy: { ContentSecurityPolicy: policy, Override: true }
      },
      CustomHeadersConfig: { Quantity: 1, Items: [{ Header: 'Permissions-Policy', Value: 'camera=(), microphone=(), geolocation=()', Override: true }] }
    }
  };
}
