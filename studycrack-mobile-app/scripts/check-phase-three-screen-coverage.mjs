import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:js|jsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

const [coverageSource, registrySource, packageSource, files] = await Promise.all([
  readFile(path.join(appRoot, 'fixtures/phase-three-screen-coverage.json'), 'utf8'),
  readFile(path.join(appRoot, 'src/app/screen-registry.js'), 'utf8'),
  readFile(path.join(appRoot, 'package.json'), 'utf8'),
  sourceFiles(path.join(appRoot, 'src'))
]);
const coverage = JSON.parse(coverageSource);
const listSource = registrySource.match(/const MOBILE_SCREEN_NAMES = \[([\s\S]*?)\];/)?.[1] || '';
const registeredScreens = [...listSource.matchAll(/'([^']+)'/g)].map((match) => match[1]);

assert.deepEqual(coverage.viewports, [
  { width: 320, height: 700 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 }
]);
assert.deepEqual(Object.keys(coverage.screens).sort(), [...registeredScreens].sort(), '모든 registry screen은 Phase 3 viewport 증거를 가져야 합니다.');
for (const [screen, evidence] of Object.entries(coverage.screens)) {
  const evidenceSource = await readFile(path.join(appRoot, evidence), 'utf8');
  assert.match(evidenceSource, new RegExp(`['\"]${screen}['\"]`), `${screen} viewport 증거가 ${evidence}에 없습니다.`);
}

const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');
assert.doesNotMatch(source, /manus-storage|manus\.space/i);
assert.doesNotMatch(source, /[\u{1F300}-\u{1FAFF}]/u, '제품 source에 emoji placeholder를 둘 수 없습니다.');
for (const mockMetric of ['총 6시간 30분', '6월 2주차 PRO 리포트', '환산 +18.0점', '평균 3개월', '최근 3개년', '높은 정확도']) {
  assert.doesNotMatch(source, new RegExp(mockMetric));
}
assert.match(packageSource, /check-phase-three-operation-tracer\.mjs && node scripts\/check-phase-three-screen-coverage\.mjs && node scripts\/check-ui-contracts\.mjs/);

console.log(`phase 3 coverage contract ok: ${registeredScreens.length} registry screens, four viewport evidence, no mock metric, Manus URL or emoji placeholder`);
