import { useEffect, useState } from 'react';
import { resolveFishArtwork } from '../../features/gamification/fish-artwork.js';
import { FishSprite } from './FishSprite.jsx';

const VARIANT_SIZES = Object.freeze({
  detail: '(max-width: 430px) 184px, 256px',
  grid: '(max-width: 430px) 112px, 128px',
  habitat: '(max-width: 430px) 116px, 160px',
  pixel: '(max-width: 430px) 86px, 96px'
});

export function FishArtwork({ assetKey = '', colors, fishId = '', growthStage = 'young', priority = false, speciesId = 'clownfish', variant = 'grid' }) {
  const artwork = resolveFishArtwork({ assetKey, speciesId });
  const identity = artwork?.assetKey || `${assetKey}:${speciesId}`;
  const [failedIdentity, setFailedIdentity] = useState('');
  const [loadedIdentity, setLoadedIdentity] = useState('');

  useEffect(() => {
    setFailedIdentity('');
    setLoadedIdentity('');
  }, [identity]);

  if (!artwork || failedIdentity === identity) {
    return <FishSprite colors={colors} fishId={fishId} growthStage={growthStage} speciesId={speciesId} />;
  }

  const safeVariant = Object.hasOwn(VARIANT_SIZES, variant) ? variant : 'grid';
  const primarySrc = artwork[safeVariant];
  const safeId = String(fishId || speciesId).replace(/[^A-Za-z0-9_-]/g, '') || 'unknown';
  const safeSpeciesId = String(speciesId).replace(/[^A-Za-z0-9_-]/g, '') || 'unknown';
  const scale = { young: .78, growing: .9, adult: 1, master: 1.08 }[growthStage] || .82;

  return (
    <span className={`aquarium-fish-artwork fish-artwork-${safeVariant} fish-species-${safeSpeciesId} fish-id-${safeId} ${loadedIdentity === identity ? 'is-loaded' : 'is-loading'}`} style={{ '--fish-scale': scale }} aria-hidden="true">
      <img
        className="aquarium-fish-image"
        src={primarySrc}
        srcSet={safeVariant === 'pixel' ? undefined : `${artwork.grid} 256w, ${artwork.detail} 512w, ${artwork.habitat} 768w`}
        sizes={VARIANT_SIZES[safeVariant]}
        width={safeVariant === 'pixel' ? '160' : '768'}
        height={safeVariant === 'pixel' ? '160' : '768'}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoadedIdentity(identity)}
        onError={() => setFailedIdentity(identity)}
      />
    </span>
  );
}
