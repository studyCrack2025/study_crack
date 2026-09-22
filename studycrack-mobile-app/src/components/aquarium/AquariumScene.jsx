import { useSceneActivity } from './use-scene-activity.js';
import { FishArtwork } from '../../screens/aquarium/FishArtwork.jsx';
import { AQUARIUM_SLOTS, normalizeAquariumSlots } from '../../features/gamification/aquarium-presentation.js';
import { AquariumBackground } from './AquariumBackground.jsx';
import { aquariumBackground } from './aquarium-backgrounds.js';
import { useContext } from 'react';
import { AquariumGrowthContext } from '../../features/gamification/AquariumGrowthContext.js';
import { AquariumGrowthCaption } from './AquariumGrowthCaption.jsx';

const AQUARIUM_MOTION_PROFILES = new Set(['bottom-drift', 'bottom-pulse', 'dart-loop', 'deep-glide', 'dive-arc', 'fin-drift', 'giant-glide', 'mascot-float', 'ocean-glide', 'pulse-drift', 'reef-loop', 'ribbon-glide', 'round-loop', 'school-loop', 'short-loop', 'vertical-bob', 'vertical-pulse', 'wide-glide']);

function aquariumMotionProfile(meta) {
  const profile = String(meta?.motionProfile || meta?.motion || 'short-loop');
  return AQUARIUM_MOTION_PROFILES.has(profile) ? profile : 'short-loop';
}

function defaultRenderFish(props) {
  return <FishArtwork {...props} variant="pixel" />;
}

function MiniPlants() {
  return <div className="aquarium-mini-plants" aria-hidden="true">{[0, 1, 2].map(index => <svg key={index} viewBox="0 0 32 36"><path className="aquarium-mini-stem" d="M10 35Q12 20 26 2" />{index === 1 ? <path className="aquarium-mini-coral" d="M15 35V14m0 12L6 19V10m9 12l11-8V6m-11 9l-6-5V3m6 28l13-6v-6" /> : <g className="aquarium-mini-leaves"><path d="M12 28Q0 27 2 16q12 1 10 12M16 22Q5 19 8 8q11 5 8 14M21 14Q15 6 20 0q8 6 1 14M13 28q5-13 16-11-3 12-16 11M19 20q3-12 13-12-1 11-13 12M24 11q0-10 8-11 1 8-8 11" /></g>}</svg>)}</div>;
}

export function AquariumScene({ slots = [], catalog = [], selectedFishId = '', stats = null, variant = 'full', backgroundKey = 'day1', careEffect = null, controlsDisabled = false, renderFish = defaultRenderFish }) {
  const { ref, active } = useSceneActivity();
  const growthView = useContext(AquariumGrowthContext);
  const safeVariant = ['full', 'home', 'guide', 'share'].includes(variant) ? variant : 'home';
  const interactive = safeVariant === 'full';
  const mini = safeVariant === 'home';
  const showHud = interactive || safeVariant === 'share';
  const fishSlots = normalizeAquariumSlots(slots);
  const planner = stats?.planner;
  const background = aquariumBackground(growthView ? growthView.backgroundKey : backgroundKey);
  const stageTitle = { day1: '첫 번째 수조', day7: '첫 생태계', day15: '성장하는 수조', day30: '자라는 해저', day50: '나만의 바다', day100: '깊어진 바다' }[background.key];
  return (<>
    <section ref={ref} data-motion-paused={!active} className="aquarium-scene" data-scene-variant={safeVariant} data-background-key={background.key} style={{ '--scene-aspect': `${background.width} / ${background.height}` }} aria-label={safeVariant === 'guide' ? '사용법 수조 미리보기' : '나의 공부 수조'}>
      {mini ? <MiniPlants /> : <AquariumBackground key={background.key} asset={background} interactive={interactive} />}
      {interactive ? <div className="aquarium-scene-depth" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(index => <i className="aquarium-scene-bubble" style={{ '--bubble-index': index }} key={index} />)}</div> : null}
      {showHud ? <div className="aquarium-scene-hud"><span>{interactive ? <b>{growthView?.growth?.highestUnlockedStage ? `DAY ${growthView.growth.highestUnlockedStage.slice(3).padStart(2, '0')} · ${growthView.status === 'ready' ? stageTitle : '최신 확인 필요'}` : '성장 기록 확인 필요'}</b> : <><small>연속 학습</small><b>{stats?.streakDays == null ? '확인 필요' : `${stats.streakDays}일`}</b></>}</span><span><small>{interactive ? '플래너' : '오늘 계획'}</small><b>{planner?.status === 'ready' ? `${planner.completed}/${planner.total}` : '확인 필요'}</b></span></div> : null}
      {AQUARIUM_SLOTS.map((slot, index) => {
        const fish = fishSlots[index];
        if (!fish) return mini || interactive ? null : <span className={`aquarium-empty-slot ${slot.className}`} key={slot.id} />;
        const meta = (Array.isArray(catalog) ? catalog : []).find(item => item?.speciesId === fish.speciesId) || {};
        const colors = Array.isArray(meta.colors) && meta.colors.length >= 2 && meta.colors.every(color => typeof color === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(color)) ? meta.colors : undefined;
        const motionProfile = aquariumMotionProfile(meta);
        const seed = [...fish.fishId].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
        const phase = ((Math.imul(seed, 2654435761) >>> 0) % 997) / 997;
        const Fish = interactive ? 'button' : 'span';
        return (
          <Fish style={{ '--fish-phase': phase, '--fish-bob-phase': `${-(seed % 31) / 10}s` }} type={interactive ? 'button' : undefined} disabled={interactive ? controlsDisabled : undefined} aria-pressed={interactive ? selectedFishId === fish.fishId : undefined} role={interactive ? undefined : 'img'} className={`aquarium-fish ${slot.className} ${interactive && selectedFishId === fish.fishId ? 'is-selected' : ''}`} data-action={interactive ? 'selectAquariumFish' : undefined} data-fish-id={fish.fishId} data-large={['epic', 'legendary', 'mythic'].includes(String(fish.rarity || meta.rarity).toLowerCase())} data-motion={motionProfile} data-care-effect={interactive && careEffect?.fishId === fish.fishId ? careEffect.type : undefined} aria-label={interactive ? `${fish.name} 선택` : fish.name} key={fish.fishId}>
            <span className="aquarium-fish-path">
              <span className="aquarium-fish-bob"><span className="aquarium-fish-depth"><span className="aquarium-fish-turn"><span className="aquarium-fish-body">{renderFish({ assetKey: fish.assetKey || meta.assetKey, colors, fishId: fish.fishId, growthStage: fish.growthStage, priority: interactive, speciesId: fish.speciesId })}</span></span></span></span>
              {interactive ? <span className="aquarium-fish-name">{fish.name}</span> : null}
              {interactive && careEffect?.fishId === fish.fishId ? <span className="aquarium-fish-reaction" aria-hidden="true">{careEffect.type === 'feed' ? '잘 먹었어!' : '반가워!'}</span> : null}
            </span>
          </Fish>
        );
      })}
    </section>
    {!mini ? <AquariumGrowthCaption view={growthView} interactive={interactive} /> : null}
    </>
  );
}
