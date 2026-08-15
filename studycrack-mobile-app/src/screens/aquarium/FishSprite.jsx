const FALLBACK_COLORS = ['#3F6FD9', '#9DD9F2'];

function Eye({ x = 116, y = 39 }) {
  return <><circle cx={x} cy={y} r="7" fill="var(--sc-surface-card)" stroke="var(--sc-brand-navy-deep)" strokeWidth="3" /><circle cx={x + 2} cy={y + 1} r="3" fill="var(--sc-brand-navy-deep)" /></>;
}

function Seahorse({ accent, primary }) {
  return <><path d="M92 18c24 2 34 18 25 34-5 9-17 11-22 19-7 11 6 17 13 9 5-5 1-12-5-12" fill="none" stroke="var(--sc-brand-navy-deep)" strokeWidth="14" strokeLinecap="round" /><path d="M91 18c22 3 29 18 19 30-7 8-19 8-25 20-5 11 5 16 13 10" fill="none" stroke={primary} strokeWidth="9" strokeLinecap="round" /><path d="M84 25 65 16l9 22" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="3" strokeLinejoin="round" /><path d="M90 40c-13 2-20 9-24 20 10-5 18-4 24 1" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="3" strokeLinejoin="round" /><Eye x={108} y={28} /></>;
}

function MantaRay({ accent, primary }) {
  return <><path d="M14 47C39 13 65 20 80 34c15-14 41-21 66 13-18 2-30 13-39 25-13-7-22-9-27-9s-14 2-27 9C44 60 32 49 14 47Z" fill={primary} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" /><path d="M80 34c-9 10-13 18-13 29M80 34c9 10 13 18 13 29" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" opacity=".9" /><path d="M80 62c5 11 5 19 1 29" fill="none" stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinecap="round" /><Eye x={58} y={43} /></>;
}

function Lionfish({ accent, primary }) {
  return <><path d="M40 48 12 25l9 28-9 22 28-19" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="3" strokeLinejoin="round" /><ellipse cx="88" cy="49" rx="48" ry="28" fill={primary} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" /><path d="M49 28 33 8l29 15M67 21 62 3l21 18M87 20 94 4l11 21M54 70 40 88l29-13M78 76l4 17 16-21" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="3" strokeLinejoin="round" /><path d="M61 26c8 13 8 33 0 46M82 21c8 16 8 39 0 55M102 23c7 15 7 35 0 50" fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round" /><Eye x={119} y={39} /></>;
}

function Pufferfish({ accent, primary }) {
  return <><path d="M45 48 20 31v34Z" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinejoin="round" /><circle cx="88" cy="48" r="38" fill={primary} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" /><path d="M60 17 55 5M77 11 75 0M98 11l4-11M116 19l8-10M57 76l-7 11M78 85l-2 11M101 84l5 10M119 74l10 8" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" /><circle cx="72" cy="38" r="3" fill={accent} /><circle cx="83" cy="64" r="3" fill={accent} /><circle cx="104" cy="61" r="3" fill={accent} /><Eye x={111} y={35} /><path d="M124 54c10 1 12 7 3 11" fill="none" stroke="var(--sc-brand-navy-deep)" strokeWidth="3" strokeLinecap="round" /></>;
}

function Butterflyfish({ accent, primary }) {
  return <><path d="M43 48 15 22v52Z" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinejoin="round" /><ellipse cx="85" cy="48" rx="42" ry="38" fill={primary} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" /><path d="M65 14c13 20 13 49 0 68M94 12c13 21 13 52 0 73" fill="none" stroke={accent} strokeWidth="8" strokeLinecap="round" /><path d="M124 48h25" fill="none" stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinecap="round" /><Eye x={111} y={36} /></>;
}

function Angelfish({ accent, primary }) {
  return <><path d="M42 49 16 28v43Z" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinejoin="round" /><path d="M43 49C57 17 92 8 127 33c14 10 14 22 0 31-35 24-70 17-84-15Z" fill={primary} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" /><path d="M72 22 84 2l10 23M72 75l13 19 10-22" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinejoin="round" /><path d="M61 31c17 8 31 28 37 45M79 22c15 10 28 28 34 45" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" /><Eye x={119} y={38} /></>;
}

function StandardFish({ accent, primary, speciesId }) {
  const isLong = ['striped_sardine', 'blue_tang'].includes(speciesId);
  const tailPath = speciesId === 'blue_tang' ? 'M34 48 5 18l8 30-8 30Z' : 'M28 48 7 28v40Z';
  const pattern = speciesId === 'clownfish'
    ? <path d="M58 24c8 13 8 35 0 48M91 20c8 16 8 40 0 56" fill="none" stroke={accent} strokeWidth="9" strokeLinecap="round" />
    : speciesId === 'striped_sardine'
      ? <path d="M55 32h69M51 48h79M55 64h69" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      : speciesId === 'mandarinfish'
        ? <path d="M53 43c15-20 30 18 46-4s29 7 21 21M64 65c14-17 27 11 43-4" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" />
        : speciesId === 'blue_tang'
          ? <path d="M53 28c19 2 37 12 50 29-14 4-29 1-42-8 5-6 6-13-8-21Z" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="3" strokeLinejoin="round" />
          : <path d="M54 57c22 8 46 7 68-3" fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" />;
  return <><path d={tailPath} fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinejoin="round" /><ellipse cx={isLong ? 87 : 82} cy="48" rx={isLong ? 57 : 49} ry="29" fill={primary} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" /><path d="M70 21c7-13 18-15 27 1M70 75c7 12 18 14 27-1" fill={accent} stroke="var(--sc-brand-navy-deep)" strokeWidth="4" strokeLinejoin="round" />{pattern}<Eye x={isLong ? 125 : 116} y={39} /><path d="M126 56c6 3 10 3 14 0" fill="none" stroke="var(--sc-brand-navy-deep)" strokeWidth="3" strokeLinecap="round" /></>;
}

export function FishSprite({ colors = FALLBACK_COLORS, fishId = '', growthStage = 'young', speciesId = 'clownfish' }) {
  const [primary, accent] = colors.length >= 2 ? colors : FALLBACK_COLORS;
  const safeId = String(fishId || speciesId).replace(/[^A-Za-z0-9_-]/g, '');
  const safeSpeciesId = String(speciesId).replace(/[^A-Za-z0-9_-]/g, '') || 'unknown';
  const scale = { young: .78, growing: .9, adult: 1, master: 1.08 }[growthStage] || .82;
  let artwork = <StandardFish accent={accent} primary={primary} speciesId={speciesId} />;
  if (speciesId === 'seahorse') artwork = <Seahorse accent={accent} primary={primary} />;
  if (speciesId === 'pufferfish') artwork = <Pufferfish accent={accent} primary={primary} />;
  if (speciesId === 'butterflyfish') artwork = <Butterflyfish accent={accent} primary={primary} />;
  if (speciesId === 'emperor_angelfish') artwork = <Angelfish accent={accent} primary={primary} />;
  if (speciesId === 'lionfish') artwork = <Lionfish accent={accent} primary={primary} />;
  if (speciesId === 'manta_ray') artwork = <MantaRay accent={accent} primary={primary} />;
  return <svg className={`aquarium-fish-svg fish-species-${safeSpeciesId} fish-id-${safeId || 'unknown'}`} style={{ '--fish-scale': scale }} viewBox="0 0 160 96" aria-hidden="true">{artwork}</svg>;
}
