export const smokeSpecs = ['fish-artwork-lifecycle.spec.mjs', 'payment-account-switch.spec.mjs', 'public-artifact.spec.mjs'];

export function e2eSuiteSelection(suite = 'all') {
  if (!['all', 'smoke', 'regression'].includes(suite)) throw new Error('Invalid Playwright suite');
  const smoke = smokeSpecs.map(file => `**/${file}`);
  return { testMatch: suite === 'smoke' ? smoke : '**/*.spec.mjs', testIgnore: suite === 'regression' ? smoke : [] };
}
