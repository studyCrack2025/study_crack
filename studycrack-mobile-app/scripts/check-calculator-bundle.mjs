import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { cacheControlFor, createPublishCommands, NO_CACHE } from '../../tools/site-release.mjs';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const startupLimitKiB = 275;
const deferredLimitKiB = 22;

export const formatKiB = (size) => `${(size / 1024).toFixed(1)} KiB`;

export function collectStaticImports(fileName, graph, visited) {
  if (visited.has(fileName)) return;
  visited.add(fileName);
  const chunk = graph.find((candidate) => candidate.fileName === fileName);
  for (const importedFile of chunk?.imports || []) collectStaticImports(importedFile, graph, visited);
}

export async function checkCalculatorBundle() {
  const calculatorBuild = await build({ root: appRoot, mode: 'jungsi-calculator', logLevel: 'silent', build: { write: false } });
  const calculatorChunks = (calculatorBuild.output || calculatorBuild[0]?.output || []).filter(item => item.type === 'chunk');
  assert.ok(calculatorChunks.every(chunk => !Object.keys(chunk.modules).some(id => /\/src\/(?:app\/MobileApp\.js|features\/consulting-v2\/ConsultingApp\.jsx)$/.test(id))), 'calculator must not boot the main app or consulting journey');
  const calculatorEntry = calculatorChunks.find(chunk => chunk.isEntry);
  assert.equal(calculatorEntry?.fileName, 'jungsi-calculator.bundle.js', 'calculator needs its own entry');
  const calculatorApp = calculatorChunks.find(chunk => Object.keys(chunk.modules).some(id => id.endsWith('/JungsiCalculatorApp.jsx')));
  assert.ok(calculatorEntry.dynamicImports.includes(calculatorApp?.fileName), 'calculator entry must open the independent calculator app');

  const calculatorStartup = new Set();
  collectStaticImports(calculatorEntry.fileName, calculatorChunks, calculatorStartup);
  collectStaticImports(calculatorApp.fileName, calculatorChunks, calculatorStartup);
  const calculatorBytes = calculatorChunks.filter(chunk => calculatorStartup.has(chunk.fileName)).reduce((sum, chunk) => sum + chunk.code.length, 0);
  const calculatorDeferred = calculatorChunks.filter(chunk => !calculatorStartup.has(chunk.fileName));
  for (const view of ['CalculatorRecommendationPanel.jsx', 'CalculatorRecommendationPreferences.jsx', 'CalculatorPortfolio.jsx']) {
    assert.ok(calculatorDeferred.some(chunk => Object.keys(chunk.modules).some(id => id.endsWith('/' + view))),
      `${view} must stay outside the calculator startup graph`);
  }
  const calculatorDeferredBytes = calculatorDeferred.reduce((sum, chunk) => sum + chunk.code.length, 0);
  assert.ok(calculatorBytes < startupLimitKiB * 1024, `calculator startup JS must remain below ${startupLimitKiB} KiB: ${formatKiB(calculatorBytes)}`);
  assert.ok(calculatorDeferredBytes < deferredLimitKiB * 1024, `calculator deferred views must remain below ${deferredLimitKiB} KiB: ${formatKiB(calculatorDeferredBytes)}`);

  assert.equal(cacheControlFor('studycrack-mobile-app/dist/jungsi-calculator.bundle.js'), NO_CACHE);
  const calculatorPublication = createPublishCommands('/artifact/site', 'static.example', {}, ['studycrack-mobile-app/dist/jungsi-calculator.bundle.js']);
  assert.ok(calculatorPublication.some(args => args[1] === 'cp' && args[2].endsWith('/jungsi-calculator.bundle.js') && args.includes(NO_CACHE)), 'calculator entry must be published with entry caching');
  return `calculator startup JS ${formatKiB(calculatorBytes)} / ${startupLimitKiB} KiB, deferred views ${formatKiB(calculatorDeferredBytes)} / ${deferredLimitKiB} KiB`;
}

if (process.argv[1] && process.argv[1] !== '-' && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`bundle boundary ok: ${await checkCalculatorBundle()}`);
}
