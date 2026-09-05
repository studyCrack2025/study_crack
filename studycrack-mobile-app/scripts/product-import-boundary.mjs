import assert from 'node:assert/strict';

export function assertProductImportBoundary({ modulePaths = [], dependencyNames = [], outputTexts = [] } = {}) {
  const archivedPath = /(?:^|\/)(?:docs|__manus__|StudyCrack_Mobile_Design_Manus|StudyCrack_App_Source_20260903)(?:\/|$)/i;
  for (const modulePath of modulePaths) {
    const normalized = modulePath.replaceAll('\\', '/').split('?')[0];
    assert.ok(!archivedPath.test(normalized) && !/vite-plugin-manus-/i.test(normalized), `Archived design entered production graph: ${modulePath}`);
  }
  for (const name of dependencyNames) assert.ok(!/manus/i.test(name), `Design-only dependency entered product manifest: ${name}`);
  for (const output of outputTexts) assert.doesNotMatch(output, /__manus__|vite-plugin-manus-|StudyCrack_Mobile_Design_Manus|StudyCrack_App_Source_20260903/, 'Archived design reference entered production output');
}
