import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = dirname(appRoot);

async function sourceMetrics(path) {
  const source = await readFile(join(appRoot, path), 'utf8');
  return {
    path,
    lines: source.split(/\r?\n/).length,
    bytes: Buffer.byteLength(source)
  };
}

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const item = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await walk(item));
    else files.push(item);
  }
  return files;
}

const hotspotPaths = [
  'src/runtime/main.js',
  'src/app/MobileApp.js',
  'src/app/mobile-view-context.js',
  'src/app/use-mobile-resource-orchestrator.js',
  'src/shared/api/client.js',
  'src/features/analysis/api.js',
  'src/features/reports/api.js',
  'src/runtime/derived.js',
  'src/handlers/profile-handlers.js'
];
const hotspots = await Promise.all(hotspotPaths.map(sourceMetrics));
const sourceFiles = (await walk(join(appRoot, 'src'))).filter((path) => ['.js', '.jsx', '.css'].includes(extname(path)));
const sourceByExtension = sourceFiles.reduce((result, path) => {
  const extension = extname(path).slice(1);
  result[extension] = (result[extension] || 0) + 1;
  return result;
}, {});

let bundles = [];
try {
  const distFiles = (await walk(join(appRoot, 'dist'))).filter((path) => ['.js', '.css'].includes(extname(path)));
  bundles = await Promise.all(distFiles.map(async (path) => ({
    path: relative(repoRoot, path),
    bytes: (await stat(path)).size
  })));
  bundles.sort((a, b) => b.bytes - a.bytes);
} catch (_error) {
  bundles = [];
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceFiles: sourceByExtension,
  hotspots,
  bundles,
  guardrails: {
    runtimeMainMaxLines: 60,
    mobileAppMaxLines: 250,
    mobileViewContextMaxLines: 320,
    sharedApiClientMaxLines: 100,
    domainApiModuleMaxLines: 250,
    profileHandlersMaxLines: 1150,
    emittedChunkMaxBytes: 500 * 1024
  }
};

console.log(JSON.stringify(report, null, 2));
