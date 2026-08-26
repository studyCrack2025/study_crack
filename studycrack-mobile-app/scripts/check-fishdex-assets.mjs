import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = join(appRoot, 'src/assets/fishdex/v2');
const manifest = JSON.parse(await readFile(join(assetRoot, 'manifest.generated.json'), 'utf8'));
const pendingIds = new Set(['100', '133', '134', '135']);
const cleanupIds = new Set(['051', '053', '054']);
const expectedVariants = Object.freeze({ habitatPixel160: 160, grid256: 256, detail512: 512, habitat768: 768 });

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function assertWebp(buffer, path) {
  assert.ok(buffer.length >= 16, `${path}: WebP file is too short`);
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', `${path}: RIFF signature missing`);
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', `${path}: WEBP signature missing`);
}

assert.equal(manifest.version, 'fishdex-assets-v2');
assert.equal(manifest.activeCount, 85);
assert.deepEqual(manifest.pendingIds, ['100', '133', '134', '135']);
assert.deepEqual(manifest.variants, expectedVariants);
assert.equal(manifest.entries.length, 85);

const ids = new Set();
const assetKeys = new Set();
let totalBytes = 0;

for (const entry of manifest.entries) {
  assert.match(entry.dexId, /^\d{3}$/);
  assert.match(entry.slug, /^[a-z0-9-]+$/);
  assert.equal(entry.assetKey, `fishdex-${entry.dexId}-${entry.slug}`);
  assert.equal(ids.has(entry.dexId), false, `duplicate dexId ${entry.dexId}`);
  assert.equal(assetKeys.has(entry.assetKey), false, `duplicate assetKey ${entry.assetKey}`);
  assert.equal(pendingIds.has(entry.dexId), false, `pending ID ${entry.dexId} entered active manifest`);
  assert.equal(entry.cleanupApplied, cleanupIds.has(entry.dexId), `${entry.dexId}: cleanup flag mismatch`);
  ids.add(entry.dexId);
  assetKeys.add(entry.assetKey);

  for (const variantKey of Object.keys(expectedVariants)) {
    const output = entry.outputs[variantKey];
    assert.ok(output, `${entry.assetKey}: missing ${variantKey}`);
    const outputPath = join(assetRoot, output.path);
    const buffer = await readFile(outputPath);
    const outputStats = await stat(outputPath);
    assertWebp(buffer, output.path);
    assert.equal(output.bytes, outputStats.size, `${output.path}: byte size mismatch`);
    assert.equal(output.sha256, sha256(buffer), `${output.path}: checksum mismatch`);
    totalBytes += outputStats.size;
  }
}

for (const [variantKey] of Object.entries(expectedVariants)) {
  const directory = variantKey === 'habitatPixel160' ? 'habitat-pixel-160' : variantKey === 'grid256' ? 'grid-256' : variantKey === 'detail512' ? 'detail-512' : 'habitat-768';
  const files = (await readdir(join(assetRoot, directory))).filter((name) => name.endsWith('.webp'));
  assert.equal(files.length, 85, `${directory}: expected 85 WebP files, found ${files.length}`);
}

assert.ok(totalBytes <= 8 * 1024 * 1024, `Fish Dex runtime assets exceed 8 MiB budget: ${totalBytes}`);
console.log(`Fish Dex assets passed: 85 entries, 340 WebP files, ${(totalBytes / 1024 / 1024).toFixed(2)} MiB`);
