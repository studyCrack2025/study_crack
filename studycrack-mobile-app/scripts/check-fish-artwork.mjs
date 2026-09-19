import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const [manifest, resolverSource, artworkSource, aquariumSource, plannerSource, aquariumCss, plannerCss, sceneSource, sceneCss] = await Promise.all([
  read('../src/assets/fishdex/v2/manifest.generated.json').then(JSON.parse),
  read('../src/features/gamification/fish-artwork.js'),
  read('../src/screens/aquarium/FishArtwork.jsx'),
  Promise.all(['AquariumScreen', 'FishCarePanel', 'FishInventoryPanel', 'FishDexPanel', 'DiscoveryPanel', 'AquariumSharePanel'].map(name => read(`../src/screens/aquarium/${name}.jsx`))).then(sources => sources.join('\n')),
  read('../src/screens/planner/PlannerScreen.jsx'),
  read('../src/styles/screens/aquarium.css'),
  read('../src/styles/screens/planner.css'),
  read('../src/components/aquarium/AquariumScene.jsx'),
  read('../src/styles/components/aquarium-scene.css')
]);

const expectedLegacyKeys = [
  'fishdex-045-percula-clownfish',
  'fishdex-057-mandarin-fish',
  'fishdex-060-butterflyfish',
  'fishdex-061-pufferfish',
  'fishdex-066-seahorse',
  'fishdex-076-lionfish',
  'fishdex-148-aurora-manta'
];
const manifestKeys = new Set(manifest.entries.map((entry) => entry.assetKey));
for (const assetKey of expectedLegacyKeys) {
  assert.equal(manifestKeys.has(assetKey), true, `${assetKey} must exist in the approved manifest`);
  assert.match(resolverSource, new RegExp(assetKey), `${assetKey} must remain mapped for fish-v1 compatibility`);
}

for (const directory of ['grid-256', 'detail-512', 'habitat-768', 'habitat-pixel-160']) assert.match(resolverSource, new RegExp(`${directory.replaceAll('-', '\\-')}\/\\\*\\.webp`));
assert.doesNotMatch(resolverSource, /habitat-pixel-64/, 'the coarse 64px habitat variant must not remain in the runtime resolver');
assert.match(artworkSource, /onError=\{\(\) => setFailedIdentity\(identity\)\}/, 'image failure must use the legacy fallback');
assert.match(artworkSource, /<FishSprite/, 'legacy SVG fallback must remain available');
assert.match(artworkSource, /srcSet=/, 'responsive Fish Dex sources must remain enabled');
assert.match(artworkSource, /loading=\{priority \? 'eager' : 'lazy'\}/, 'priority loading contract must remain explicit');
assert.doesNotMatch(aquariumSource, /FishSprite/, 'aquarium call sites must use FishArtwork');
assert.doesNotMatch(plannerSource, /FishSprite/, 'planner decoration must use FishArtwork');
assert.match(sceneSource, /variant="pixel"/, 'shared aquarium habitat must request pixel artwork');
assert.match(artworkSource, /safeVariant === 'pixel' \? '160'/, 'pixel habitat artwork must expose the 160px intrinsic size');
assert.match(sceneSource, /data-motion=\{motionProfile\}/, 'aquarium fish must consume the catalog motion profile');
assert.match(sceneSource, /AQUARIUM_MOTION_PROFILES/, 'aquarium motion profiles must use an explicit allowlist');
assert.match(aquariumSource, /variant="detail"/, 'discovery and management must request detail artwork');
assert.match(aquariumSource, /variant="grid"/, 'catalog and inventory must request grid artwork');
assert.match(sceneCss, /\.aquarium-fish-artwork/, 'shared scene CSS must own the bitmap artwork shell');
assert.match(sceneCss, /\.aquarium-fish-path\{[^}]*animation:aquariumFishPath[^}]*ease-in-out/, 'aquarium movement must use continuous compositor interpolation');
assert.doesNotMatch(sceneCss, /\.aquarium-fish\{[^}]*steps\(/, 'aquarium fish movement must not use coarse step timing');
assert.doesNotMatch(sceneCss, /\.aquarium-(bubbles|plants|ground|rays|water-line)\b/, 'complete background artwork must not duplicate CSS scenery');
assert.match(plannerCss, /\.aquarium-fish-artwork/, 'planner CSS must size the bitmap artwork shell');

console.log('Fish artwork renderer contracts passed: 85 assets with pixel habitats, 7 fish-v1 mappings and SVG fallback.');
