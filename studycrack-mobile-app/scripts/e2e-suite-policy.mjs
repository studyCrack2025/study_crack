export const smokeSpecs = ['fish-artwork-lifecycle.spec.mjs', 'payment-account-switch.spec.mjs', 'public-artifact.spec.mjs'];
export const webCssSpecs = ['desktop-css.spec.mjs', 'payment-history.spec.mjs', 'public-artifact.spec.mjs'];
const calculatorSpecs = [
  '*calculator*.spec.mjs',
  'consulting-invite-login.spec.mjs',
  'social-mobile-entry.spec.mjs'
].map(file => `**/${file}`);
const artifactSpec = '**/public-artifact.spec.mjs';
const adminSpecs = ['**/admin-*.spec.mjs'];
const preflightSpecs = new Map([
  ['preflight-admin', [...adminSpecs, artifactSpec]],
  ['preflight-calculator', [...calculatorSpecs, artifactSpec]],
  ['preflight-admin-calculator', [...adminSpecs, ...calculatorSpecs, artifactSpec]]
]);

export function browserJobs(suite) {
  if (preflightSpecs.has(suite)) {
    const shardCount = suite === 'preflight-admin-calculator' ? 2 : 1;
    return ['chromium', 'webkit'].flatMap(engine => Array.from({ length: shardCount }, (_, index) => ({
      label: `${suite}-${engine}-${index + 1}`, suite, shard: `${index + 1}/${shardCount}`, project: `mobile-${engine}`
    })));
  }
  if (suite === 'web-css') return [{ label: '1', suite, shard: '1/1' }];
  if (suite !== 'all') throw new Error('Invalid deployment browser suite');
  return [
    { label: 'calculator', suite: 'calculator', shard: '1/1' },
    ...Array.from({ length: 6 }, (_, index) => ({ label: String(index + 1), suite: 'without-calculator', shard: `${index + 1}/6` }))
  ];
}

export function e2eSuiteSelection(suite = 'all') {
  if (preflightSpecs.has(suite)) return { testMatch: preflightSpecs.get(suite), testIgnore: [] };
  if (suite === 'calculator') return { testMatch: calculatorSpecs, testIgnore: [] };
  if (suite === 'without-calculator') return { testMatch: '**/*.spec.mjs', testIgnore: calculatorSpecs };
  if (!['all', 'smoke', 'regression', 'web-css'].includes(suite)) throw new Error('Invalid Playwright suite');
  if (suite === 'web-css') return { testMatch: webCssSpecs.map(file => `**/${file}`), testIgnore: [] };
  const smoke = smokeSpecs.map(file => `**/${file}`);
  return { testMatch: suite === 'smoke' ? smoke : '**/*.spec.mjs', testIgnore: suite === 'regression' ? smoke : [] };
}
