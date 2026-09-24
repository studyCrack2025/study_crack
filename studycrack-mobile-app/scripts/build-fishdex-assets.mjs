import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { rmSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '..');
const sourceRoot = join(repoRoot, 'docs/design-docs/StudyCrack_FishDex_Approved_V2/01_Approved_PNG');
const outputRoot = join(appRoot, 'src/assets/fishdex/v2');
const manifestPath = join(outputRoot, 'manifest.generated.json');
const variants = Object.freeze([
  { key: 'habitatPixel160', directory: 'habitat-pixel-160', size: 160 },
  { key: 'grid256', directory: 'grid-256', size: 256 },
  { key: 'detail512', directory: 'detail-512', size: 512 },
  { key: 'habitat768', directory: 'habitat-768', size: 768 }
]);
const cleanupThresholdById = Object.freeze({ '051': 110, '053': 110, '054': 110 });
const pendingIds = new Set(['100', '133', '134', '135']);
const retiredSlugs = new Set(['wolffish', 'viperfish', 'dragonfish', 'barreleye']);
const filePattern = /^studycrack-fishdex-(\d{3})-([a-z0-9-]+)\.png$/;
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function readPngHeader(buffer, filename) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(pngSignature) || buffer.toString('ascii', 12, 16) !== 'IHDR') {
    throw new Error(`${filename}: valid PNG IHDR not found`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer[24],
    colorType: buffer[25]
  };
}

function ffmpeg(args, options = {}) {
  try {
    return execFileSync('ffmpeg', ['-hide_banner', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
  } catch (error) {
    const detail = String(error?.stderr || error?.message || '').trim();
    throw new Error(`ffmpeg failed: ${detail}`);
  }
}

function detectArtworkBounds(sourcePath, cleanupThreshold) {
  const alphaFilter = cleanupThreshold
    ? `format=rgba,lut=a='if(lte(val,${cleanupThreshold}),0,val)',alphaextract,bbox=min_val=1`
    : 'alphaextract,bbox=min_val=1';
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'info', '-i', sourcePath, '-vf', alphaFilter, '-frames:v', '1', '-f', 'null', '-'], {
    encoding: 'utf8'
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.error) throw result.error;
  const match = output.match(/crop=(\d+):(\d+):(\d+):(\d+)/);
  if (!match) throw new Error(`${basename(sourcePath)}: visible alpha bounds not detected`);
  return { width: Number(match[1]), height: Number(match[2]), x: Number(match[3]), y: Number(match[4]) };
}

function normalizedSize(bounds, target) {
  const inner = Math.max(1, Math.floor(target * 0.84));
  if (bounds.width >= bounds.height) {
    return { width: inner, height: Math.max(1, Math.round((inner * bounds.height) / bounds.width)) };
  }
  return { width: Math.max(1, Math.round((inner * bounds.width) / bounds.height)), height: inner };
}

function buildVariant(sourcePath, outputPath, bounds, target, cleanupThreshold) {
  const intermediatePath = `${outputPath}.png`;
  const scaled = normalizedSize(bounds, target);
  const filters = ['format=rgba'];
  if (cleanupThreshold) filters.push(`lut=a='if(lte(val,${cleanupThreshold}),0,val)'`);
  filters.push(`crop=${bounds.width}:${bounds.height}:${bounds.x}:${bounds.y}`);
  filters.push(`scale=${scaled.width}:${scaled.height}:flags=neighbor`);
  filters.push(`pad=${target}:${target}:(ow-iw)/2:(oh-ih)/2:color=0x00000000`);
  filters.push('format=rgba');
  try {
    ffmpeg([
      '-loglevel', 'error', '-y', '-i', sourcePath, '-vf', filters.join(','), '-frames:v', '1', intermediatePath
    ]);
    execFileSync('cwebp', ['-quiet', '-q', '92', '-m', '4', '-alpha_q', '100', '-exact', intermediatePath, '-o', outputPath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } finally {
    rmSync(intermediatePath, { force: true });
  }
}

async function main() {
  const sourceNames = (await readdir(sourceRoot)).filter((name) => name.endsWith('.png')).sort();
  if (sourceNames.length !== 85) throw new Error(`expected 85 approved PNGs, found ${sourceNames.length}`);

  const seenIds = new Set();
  const entries = [];
  await rm(outputRoot, { recursive: true, force: true });
  await Promise.all(variants.map((variant) => mkdir(join(outputRoot, variant.directory), { recursive: true })));

  for (const filename of sourceNames) {
    const match = filename.match(filePattern);
    if (!match) throw new Error(`${filename}: invalid approved filename`);
    const [, dexId, slug] = match;
    if (seenIds.has(dexId)) throw new Error(`${filename}: duplicate Fish Dex ID ${dexId}`);
    if (pendingIds.has(dexId) || retiredSlugs.has(slug)) throw new Error(`${filename}: pending or retired species cannot enter active assets`);
    seenIds.add(dexId);

    const sourcePath = join(sourceRoot, filename);
    const sourceBuffer = await readFile(sourcePath);
    const header = readPngHeader(sourceBuffer, filename);
    if (header.width !== 1920 || header.height !== 1920 || header.colorType !== 6) {
      throw new Error(`${filename}: expected 1920x1920 RGBA PNG, received ${header.width}x${header.height} colorType=${header.colorType}`);
    }

    const cleanupThreshold = cleanupThresholdById[dexId] || 0;
    const bounds = detectArtworkBounds(sourcePath, cleanupThreshold);
    const assetKey = `fishdex-${dexId}-${slug}`;
    const outputs = {};

    for (const variant of variants) {
      const outputFilename = `${assetKey}.webp`;
      const outputPath = join(outputRoot, variant.directory, outputFilename);
      buildVariant(sourcePath, outputPath, bounds, variant.size, cleanupThreshold);
      const outputBuffer = await readFile(outputPath);
      const outputStats = await stat(outputPath);
      outputs[variant.key] = {
        path: `${variant.directory}/${outputFilename}`,
        bytes: outputStats.size,
        sha256: sha256(outputBuffer)
      };
    }

    entries.push({
      dexId,
      slug,
      assetKey,
      source: filename,
      sourceSha256: sha256(sourceBuffer),
      cleanupApplied: cleanupThreshold > 0,
      bounds,
      outputs
    });
  }

  const manifest = {
    version: 'fishdex-assets-v2',
    sourceCollection: 'StudyCrack_FishDex_Approved_V2',
    activeCount: entries.length,
    pendingIds: [...pendingIds],
    variants: Object.fromEntries(variants.map((variant) => [variant.key, variant.size])),
    entries
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`generated ${entries.length * variants.length} WebP assets for ${entries.length} approved Fish Dex entries`);
}

await main();
