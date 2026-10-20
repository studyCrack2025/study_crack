export const smokeSpecs = ['fish-artwork-lifecycle.spec.mjs', 'payment-account-switch.spec.mjs', 'public-artifact.spec.mjs'];
export const webCssSpecs = ['desktop-css.spec.mjs', 'payment-history.spec.mjs', 'public-artifact.spec.mjs'];

export function e2eSuiteSelection(suite = 'all') {
  if (!['all', 'smoke', 'regression', 'web-css'].includes(suite)) throw new Error('Invalid Playwright suite');
  if (suite === 'web-css') return { testMatch: webCssSpecs.map(file => `**/${file}`), testIgnore: [] };
  const smoke = smokeSpecs.map(file => `**/${file}`);
  return { testMatch: suite === 'smoke' ? smoke : '**/*.spec.mjs', testIgnore: suite === 'regression' ? smoke : [] };
}
