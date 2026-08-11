const FALLBACK_COLORS = ['#3F6FD9', '#9DD9F2'];

export function FishSprite({ colors = FALLBACK_COLORS, fishId = '', growthStage = 'young', speciesId = 'clownfish' }) {
  const [primary, accent] = colors.length >= 2 ? colors : FALLBACK_COLORS;
  const safeId = String(fishId || speciesId).replace(/[^A-Za-z0-9_-]/g, '');
  const isLong = ['striped_sardine', 'blue_tang', 'emperor_angelfish'].includes(speciesId);
  const isRound = ['pufferfish', 'butterflyfish'].includes(speciesId);
  const isRay = speciesId === 'manta_ray';
  const scale = { young: .78, growing: .9, adult: 1, master: 1.08 }[growthStage] || .82;
  if (isRay) {
    return <svg className="aquarium-fish-svg" style={{ '--fish-scale': scale }} viewBox="0 0 160 96" aria-hidden="true"><path d="M18 45C42 17 65 22 80 35c15-13 38-18 62 10-17 3-27 14-35 25-13-6-22-8-27-8s-14 2-27 8C45 59 35 48 18 45Z" fill={primary} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" /><path d="M80 62c5 11 5 18 1 28" fill="none" stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinecap="round" /><circle cx="58" cy="43" r="4" fill="var(--sc-surface-card)" /><circle cx="59" cy="43" r="2" fill="var(--sc-brand-navy-deep)" /></svg>;
  }
  return (
    <svg className="aquarium-fish-svg" style={{ '--fish-scale': scale }} viewBox="0 0 160 96" aria-hidden="true">
      <path d="M28 48 7 28v40Z" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx={isLong ? 87 : 82} cy="48" rx={isLong ? 57 : isRound ? 43 : 49} ry={isRound ? 35 : 29} fill={primary} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" />
      <path d="M70 21c7-13 18-15 27 1M70 75c7 12 18 14 27-1" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinejoin="round" />
      <path d={speciesId === 'clownfish' ? 'M58 24c8 13 8 35 0 48M91 20c8 16 8 40 0 56' : speciesId === 'striped_sardine' ? 'M55 32h69M51 48h79M55 64h69' : 'M54 57c22 8 46 7 68-3'} fill="none" stroke={accent} strokeWidth={speciesId === 'clownfish' ? 9 : 6} strokeLinecap="round" opacity=".92" />
      <circle cx={isLong ? 125 : 116} cy="39" r="7" fill="var(--sc-surface-card)" stroke="var(--sc-brand-navy-deep)" strokeWidth="3" />
      <circle cx={isLong ? 127 : 118} cy="40" r="3" fill="var(--sc-brand-navy-deep)" />
      <path d={isRound ? 'M126 54c9 2 11 7 2 10' : 'M126 56c6 3 10 3 14 0'} fill="none" stroke="var(--sc-brand-navy-deep)" strokeWidth="3" strokeLinecap="round" />
      <title>{safeId}</title>
    </svg>
  );
}
