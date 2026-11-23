export const smokeSpecs = ['fish-artwork-lifecycle.spec.mjs', 'payment-account-switch.spec.mjs', 'public-artifact.spec.mjs'];
export const webCssSpecs = ['desktop-css.spec.mjs', 'payment-history.spec.mjs', 'public-artifact.spec.mjs'];
const calculatorSpecs = [
  '*calculator*.spec.mjs',
  'consulting-invite-login.spec.mjs',
  'social-mobile-entry.spec.mjs'
].map(file => `**/${file}`);

export function browserJobs(suite) {
  if (suite === 'web-css') return [{ label: '1', suite, shard: '1/1' }];
  if (suite !== 'all') throw new Error('Invalid deployment browser suite');
  return [
    { label: 'calculator', suite: 'calculator', shard: '1/1' },
    ...Array.from({ length: 6 }, (_, index) => ({ label: String(index + 1), suite: 'without-calculator', shard: `${index + 1}/6` }))
  ];
}

export function e2eSuiteSelection(suite = 'all') {
  if (suite === 'calculator') return { testMatch: calculatorSpecs, testIgnore: [] };
  if (suite === 'without-calculator') return { testMatch: '**/*.spec.mjs', testIgnore: calculatorSpecs };
  if (!['all', 'smoke', 'regression', 'web-css'].includes(suite)) throw new Error('Invalid Playwright suite');
  if (suite === 'web-css') return { testMatch: webCssSpecs.map(file => `**/${file}`), testIgnore: [] };
  const smoke = smokeSpecs.map(file => `**/${file}`);
  return { testMatch: suite === 'smoke' ? smoke : '**/*.spec.mjs', testIgnore: suite === 'regression' ? smoke : [] };
}
