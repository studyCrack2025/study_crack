import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const appRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceRoot = path.join(appRoot, 'src');

async function listModules(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listModules(target);
    return /\.(?:js|jsx)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

const parsedModules = new Set();
const result = await build({
  root: appRoot,
  logLevel: 'silent',
  plugins: [{
    name: 'studycrack-dead-code-audit',
    moduleParsed(info) {
      const cleanId = info.id.split('?')[0];
      if (cleanId.startsWith(sourceRoot) && /\.(?:js|jsx)$/.test(cleanId)) {
        parsedModules.add(path.normalize(cleanId));
      }
    }
  }],
  build: { write: false }
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output || []);
const chunks = outputs.filter((item) => item.type === 'chunk');
const removedExports = [];

for (const chunk of chunks) {
  for (const [moduleId, details] of Object.entries(chunk.modules || {})) {
    const cleanId = moduleId.split('?')[0];
    if (!cleanId.startsWith(sourceRoot) || !/\.(?:js|jsx)$/.test(cleanId)) continue;
    for (const name of details.removedExports || []) {
      removedExports.push(`${path.relative(appRoot, cleanId)}:${name}`);
    }
  }
}

const sourceModules = (await listModules(sourceRoot)).map(path.normalize).sort();
const unreachable = sourceModules
  .filter((modulePath) => !parsedModules.has(modulePath))
  .map((modulePath) => path.relative(appRoot, modulePath));

assert.deepEqual(unreachable, [], `Unreachable production modules:\n${unreachable.join('\n')}`);
assert.deepEqual(removedExports.sort(), [], `Unused production exports:\n${removedExports.sort().join('\n')}`);

console.log(`Dead-code check passed: ${sourceModules.length} source modules are reachable with no unused exports.`);
