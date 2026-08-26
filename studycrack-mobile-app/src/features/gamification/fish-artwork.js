import manifest from '../../assets/fishdex/v2/manifest.generated.json';

const gridAssets = import.meta.glob('../../assets/fishdex/v2/grid-256/*.webp', { eager: true, query: '?url', import: 'default' });
const detailAssets = import.meta.glob('../../assets/fishdex/v2/detail-512/*.webp', { eager: true, query: '?url', import: 'default' });
const habitatAssets = import.meta.glob('../../assets/fishdex/v2/habitat-768/*.webp', { eager: true, query: '?url', import: 'default' });
const habitatPixelAssets = import.meta.glob('../../assets/fishdex/v2/habitat-pixel-160/*.webp', { eager: true, query: '?url', import: 'default' });

const LEGACY_SPECIES_ASSET_KEYS = Object.freeze({
  butterflyfish: 'fishdex-060-butterflyfish',
  clownfish: 'fishdex-045-percula-clownfish',
  lionfish: 'fishdex-076-lionfish',
  mandarinfish: 'fishdex-057-mandarin-fish',
  manta_ray: 'fishdex-148-aurora-manta',
  pufferfish: 'fishdex-061-pufferfish',
  seahorse: 'fishdex-066-seahorse'
});

function indexAssetUrls(modules) {
  return new Map(Object.entries(modules).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -5), url]));
}

const urlsByVariant = Object.freeze({
  detail: indexAssetUrls(detailAssets),
  grid: indexAssetUrls(gridAssets),
  habitat: indexAssetUrls(habitatAssets),
  pixel: indexAssetUrls(habitatPixelAssets)
});
const entriesByAssetKey = new Map(manifest.entries.map((entry) => [entry.assetKey, entry]));
const assetKeyByAlias = new Map();

for (const entry of manifest.entries) {
  assetKeyByAlias.set(entry.assetKey, entry.assetKey);
  assetKeyByAlias.set(entry.dexId, entry.assetKey);
  assetKeyByAlias.set(entry.slug, entry.assetKey);
}

export function resolveFishArtwork({ assetKey = '', speciesId = '' } = {}) {
  const requestedKey = String(assetKey || '').trim();
  const speciesKey = String(speciesId || '').trim();
  const resolvedKey = assetKeyByAlias.get(requestedKey)
    || assetKeyByAlias.get(speciesKey)
    || LEGACY_SPECIES_ASSET_KEYS[speciesKey]
    || '';
  const entry = entriesByAssetKey.get(resolvedKey);
  if (!entry) return null;
  const grid = urlsByVariant.grid.get(resolvedKey);
  const detail = urlsByVariant.detail.get(resolvedKey);
  const habitat = urlsByVariant.habitat.get(resolvedKey);
  const pixel = urlsByVariant.pixel.get(resolvedKey);
  if (!grid || !detail || !habitat || !pixel) return null;
  return Object.freeze({ assetKey: resolvedKey, detail, dexId: entry.dexId, grid, habitat, pixel, slug: entry.slug });
}
