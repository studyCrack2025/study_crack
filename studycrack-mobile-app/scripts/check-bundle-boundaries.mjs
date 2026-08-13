import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const appRootUrl = new URL('../', import.meta.url);
const appRoot = fileURLToPath(appRootUrl);
const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const buildResult = await build({
  root: appRoot,
  logLevel: 'silent',
  build: { write: false }
});
const outputs = buildResult.output || buildResult[0]?.output || [];
const chunks = outputs.filter((output) => output.type === 'chunk');
const assets = outputs.filter((output) => output.type === 'asset');
const entryChunk = chunks.find((chunk) => chunk.isEntry && chunk.fileName === 'studycrack-mobile.bundle.js');
const appRegistryChunk = chunks.find((chunk) => Object.keys(chunk.modules).some((id) => id.endsWith('/src/app/screen-registry-app.js')));

assert.ok(entryChunk, 'stable mobile module entry must be emitted');
assert.ok(appRegistryChunk, 'deferred app screen registry chunk must be emitted');
assert.notEqual(appRegistryChunk.fileName, entryChunk.fileName, 'signed-in app screens must not be bundled into the entry');
assert.match(
  entryChunk.code,
  /["']\.\/chunks\//,
  'entry imports must resolve relative to the stable mobile dist entry'
);
assert.doesNotMatch(entryChunk.code, /["']\/chunks\//, 'entry must not request chunks from the site root');
assert.ok(
  entryChunk.dynamicImports.includes(appRegistryChunk.fileName),
  'entry must dynamically import the signed-in app screen chunk'
);

const initialFiles = new Set();
function collectStaticImports(fileName) {
  if (initialFiles.has(fileName)) return;
  initialFiles.add(fileName);
  const chunk = chunks.find((candidate) => candidate.fileName === fileName);
  for (const importedFile of chunk?.imports || []) collectStaticImports(importedFile);
}
collectStaticImports(entryChunk.fileName);

const initialModules = new Set(
  chunks
    .filter((chunk) => initialFiles.has(chunk.fileName))
    .flatMap((chunk) => Object.keys(chunk.modules))
);
const deferredModuleSuffixes = [
  '/src/screens/analysis/AnalysisScreen.jsx',
  '/src/screens/coaching/CoachingScreen.jsx',
  '/src/screens/home/HomeScreen.jsx',
  '/src/screens/mypage/MyPageScreen.jsx',
  '/src/screens/planner/PlannerScreen.jsx'
];
for (const suffix of deferredModuleSuffixes) {
  assert.ok(
    ![...initialModules].some((id) => id.endsWith(suffix)),
    `${suffix} must stay outside the initial module graph`
  );
}

const cssAsset = assets.find((asset) => asset.fileName === 'studycrack-mobile.css');
const deferredCssAsset = assets.find((asset) => /^chunks\/screen-registry-app-[\w-]+\.css$/.test(asset.fileName));
assert.ok(cssAsset, 'stable mobile CSS asset must be emitted');
assert.ok(deferredCssAsset, 'signed-in screen CSS must be emitted as a deferred hashed chunk');
const bootstrapCss = String(cssAsset.source);
const deferredCss = String(deferredCssAsset.source);
assert.ok(bootstrapCss.length < 90 * 1024, 'bootstrap CSS must remain below 90 KiB');
assert.ok(deferredCss.length > 100 * 1024, 'signed-in screen styles must remain in the deferred CSS chunk');
assert.doesNotMatch(bootstrapCss, /\.home-report-preview-grid\b/, 'home feature CSS must not return to the bootstrap asset');
assert.doesNotMatch(bootstrapCss, /\.app-context-header\b/, 'signed-in context header CSS must not return to the bootstrap asset');
assert.doesNotMatch(bootstrapCss, /\.my-profile-avatar\b/, 'mypage feature CSS must not return to the bootstrap asset');
assert.match(deferredCss, /\.home-report-preview-grid\b/, 'deferred CSS must include home feature styles');
assert.match(deferredCss, /\.app-context-header\b/, 'deferred CSS must include the shared signed-in context header');
assert.match(deferredCss, /\.my-profile-avatar\b/, 'deferred CSS must include mypage feature styles');
assert.ok(
  appRegistryChunk.viteMetadata?.importedCss?.has(deferredCssAsset.fileName),
  'signed-in app chunk metadata must preload its deferred CSS asset'
);
assert.match(
  entryChunk.code,
  new RegExp(deferredCssAsset.fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  'entry preload map must request the deferred screen CSS asset'
);
for (const chunk of chunks) {
  assert.ok(chunk.code.length < 500 * 1024, `${chunk.fileName} must remain below 500 KiB`);
}

const [htmlSource, workflowSource] = await Promise.all([
  read('../../studycrack-mobile.html'),
  read('../../.github/workflows/deploy.yml')
]);
assert.match(
  htmlSource,
  /<script\s+type="module"\s+src="\.\/studycrack-mobile-app\/dist\/studycrack-mobile\.bundle\.js"><\/script>/,
  'mobile HTML must load the ES module entry'
);
assert.match(
  htmlSource,
  /href="\.\/studycrack-mobile-app\/dist\/studycrack-mobile\.css"/,
  'mobile HTML must load the built CSS asset'
);
assert.match(workflowSource, /studycrack-mobile-app\/dist\/chunks\/\*/, 'deployment must upload hashed chunks');
assert.match(workflowSource, /max-age=31536000, immutable/, 'hashed chunks must use immutable caching');

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
const initialBytes = chunks
  .filter((chunk) => initialFiles.has(chunk.fileName))
  .reduce((sum, chunk) => sum + chunk.code.length, 0);
console.log(
  `bundle boundary ok: initial JS ${formatKiB(initialBytes)}, bootstrap CSS ${formatKiB(bootstrapCss.length)}, deferred app ${formatKiB(appRegistryChunk.code.length)}, deferred CSS ${formatKiB(deferredCss.length)}, ${chunks.length} JS chunks`
);
