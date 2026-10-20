import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const assetRoot = fileURLToPath(new URL('../src/assets/aquarium-backgrounds/', import.meta.url));
const sources = [
  [1, '01_day-01_first-record.png', 377, 'f532d7fb19a1001ff0f3c6480b003ec5c833079463ed2c8d06cbe4d07744f663'],
  [7, '02_day-07_first-ecosystem.png', 377, '7de0eabe25d7fa322fb0280407bbf2895425477cb6d1f873feb3301fa991dede'],
  [15, '03_day-15_seafloor-valley.png', 377, 'dc0fb7938b6a22a9a53ba332373eb943008e0e46c0607057b328dadf1fa8bbb7'],
  [30, '04_day-30_coral-arch.png', 377, '087c7d70cd7e6e90db7eb0bae3545ad76b8888b14c8c1e2c816d38cb25b2a1f7'],
  [50, '05_day-50_wreck-and-treasure.png', 377, '865cf7a9fa0631c80a5fb8f0b9d21afae277ea2aa6d94198a872cf3f39a1a3ef'],
  [100, '06_day-100_deep-blue-ruins.png', 376, '095215f7f8e9eabb320460514e048af087a500a9679f80830967aed729493b5a']
];

function inspect(bytes, [day, , width, sha256]) {
  assert.ok(bytes.length > 33 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), `day${day}: PNG required`);
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  assert.equal(bytes.readUInt32BE(16), width, `day${day}: width`);
  assert.equal(bytes.readUInt32BE(20), 502, `day${day}: height`);
  assert.equal(bytes[24], 8);
  assert.equal(bytes[25], 6);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256, `day${day}: original bytes changed`);
  return { key: `day${day}`, file: `day-${String(day).padStart(2, '0')}.png`, width, height: 502, bytes: bytes.length, sha256 };
}

async function preserveFile(path, bytes) {
  try { assert.ok((await readFile(path)).equals(bytes), `Refusing to replace different asset: ${path}`); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(path, bytes, { flag: 'wx' });
  }
}

async function intake(sourceDirectory) {
  assert.ok(sourceDirectory, 'Pass the supplied source directory explicitly.');
  const sourceRoot = resolve(sourceDirectory);
  // Validate the entire delivery before creating any output.
  const files = await Promise.all(sources.map(async source => {
    const path = resolve(sourceRoot, source[1]);
    const bytes = await readFile(path);
    return { path, bytes, entry: inspect(bytes, source) };
  }));
  await mkdir(assetRoot, { recursive: true });
  for (const { path, bytes, entry } of files) {
    const target = resolve(assetRoot, entry.file);
    try { await copyFile(path, target, constants.COPYFILE_EXCL); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      assert.ok((await readFile(target)).equals(bytes), `Refusing to replace different asset: ${entry.file}`);
    }
  }
  await preserveFile(resolve(assetRoot, 'manifest.json'), Buffer.from(`${JSON.stringify({ version: 1, format: 'png', preservation: 'original-bytes', entries: files.map(({ entry }) => entry) }, null, 2)}\n`));
}

async function check() {
  const manifest = JSON.parse(await readFile(resolve(assetRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, 1);
  assert.equal(manifest.format, 'png');
  assert.equal(manifest.preservation, 'original-bytes');
  assert.deepEqual(manifest.entries.map(entry => entry.key), sources.map(([day]) => `day${day}`));
  const expected = ['manifest.json'];
  for (const [index, source] of sources.entries()) {
    const file = `day-${String(source[0]).padStart(2, '0')}.png`;
    const bytes = await readFile(resolve(assetRoot, file));
    assert.deepEqual(manifest.entries[index], inspect(bytes, source));
    expected.push(file);
  }
  assert.deepEqual((await readdir(assetRoot)).sort(), expected.sort(), 'Unexpected or missing background files');
  console.log(`Aquarium background assets passed: 6 original PNGs, exact SHA256/dimensions/bytes, day15 included, no day200; ${manifest.entries.reduce((sum, entry) => sum + entry.bytes, 0)} bytes. Asset integrity only; rollout is checked separately.`);
}

const [command = 'check', sourceDirectory] = process.argv.slice(2);
assert.ok(['check', 'intake'].includes(command), 'Usage: aquarium-background-assets.mjs check | intake <source-directory>');
if (command === 'intake') await intake(sourceDirectory);
await check();
