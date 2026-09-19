import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { Icon } from '../../components/Icon.jsx';
import { FishArtwork } from './FishArtwork.jsx';
import { AquariumModeHeader, catalogMeta, RARITY_CLASSES, RARITY_LABELS } from './aquarium-panel-shared.jsx';
const PARTICLES = { common: 12, rare: 22, epic: 34, legendary: 48, special: 10 };
function playAquariumRevealSound(rarity, onEnd) {
  let context;
  let timer;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    globalThis.clearTimeout(timer);
    try { if (context) void Promise.resolve(context.close()).catch(() => {}); } catch { /* Sound must never block result confirmation. */ }
  };
  try {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) { onEnd(); return stop; }
    context = new AudioContext();
    const notes = rarity === 'special' ? [659, 784, 988, 1318, 1568] : rarity === 'legendary' ? [392, 523, 659, 784, 1046] : rarity === 'epic' ? [523, 659, 784, 1046] : rarity === 'rare' ? [523, 659, 784] : [523, 659];
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.065, context.currentTime + 0.03);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.35);
    master.connect(context.destination);
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + index * 0.11;
      oscillator.type = index % 2 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.7, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
      oscillator.connect(gain).connect(master);
      oscillator.start(start);
      oscillator.stop(start + 0.46);
    });
    void Promise.resolve(context.resume()).catch(() => { if (!stopped) { stop(); onEnd(); } });
    timer = globalThis.setTimeout(() => { stop(); onEnd(); }, 1500);
  } catch {
    stop(); onEnd();
  }
  return stop;
}


function DrawPity({ profile }) {
  const rareIn = Math.max(0, Number(profile?.drawPity?.rareIn) || 0);
  const epicIn = Math.max(0, Number(profile?.drawPity?.epicIn) || 0);
  const legendaryIn = Math.max(0, Number(profile?.drawPity?.legendaryIn) || 0);
  return <div className="aquarium-pity"><div><span>희귀 확정</span><b>{rareIn ? `${rareIn}회 후` : '이번 뽑기'}</b></div><div><span>영웅 확정</span><b>{epicIn ? `${epicIn}회 후` : '이번 뽑기'}</b></div><div><span>전설 확정</span><b>{legendaryIn ? `${legendaryIn}회 후` : '이번 뽑기'}</b></div></div>;
}


export function DiscoveryResult({ actionError = '', actionStatus = 'idle', catalog = [], pendingDraw }) {
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(true);
  const stopSound = useRef(() => {});
  useEffect(() => {
    const onVisibility = () => {
      setVisible(document.visibilityState !== 'hidden');
      if (document.visibilityState === 'hidden') { stopSound.current(); setPlaying(false); }
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { document.removeEventListener('visibilitychange', onVisibility); stopSound.current(); };
  }, []);
  const { fish, result } = pendingDraw;
  const meta = catalogMeta(catalog, fish.speciesId);
  const duplicate = Boolean(result.duplicate);
  const rarity = Object.hasOwn(PARTICLES, result.rarity) ? result.rarity : 'common';
  const refund = Number(result.shellsRefunded) > 0;
  return (
    <Modal ariaLabel="물고기 발견 결과" dismissAction="closeAquariumMode" overlayClass="aquarium-discovery-overlay" panelClass={`aquarium-draw-result ${RARITY_CLASSES[rarity]}`}>
      <div className="aquarium-discovery-art" data-effects-active={visible}>
        <div className="aquarium-result-burst" aria-hidden="true">{Array.from({ length: PARTICLES[rarity] }, (_, index) => <i style={{ '--particle-angle': `${(index * 137.5) % 360}deg`, '--particle-radius': `${54 + index % 7 * 15}px`, '--particle-delay': `${index % 9 * 60}ms` }} key={index} />)}</div>
        {rarity === 'legendary' ? <div className="aquarium-result-rays" aria-hidden="true"><i /><i /></div> : null}
        <div className="aquarium-discovery-controls">
          <button type="button" className="aquarium-sound-toggle" aria-label={playing ? '축하 효과음 끄기' : '축하 효과음 듣기'} aria-pressed={playing} onClick={() => {
            stopSound.current();
            if (playing) { setPlaying(false); return; }
            setPlaying(true);
            stopSound.current = playAquariumRevealSound(rarity, () => setPlaying(false));
          }}><Icon name={playing ? 'volume' : 'volumeOff'} /></button>
          <button type="button" className="aquarium-discovery-close" data-action="closeAquariumMode" aria-label="나중에 보기">×</button>
        </div>
        <span className="aquarium-discovery-eyebrow">{duplicate ? '다시 만난 친구' : '새로운 발견'}</span>
        <div className="aquarium-result-halo"><i className="aquarium-result-ring" aria-hidden="true" /><i className="aquarium-result-ring" aria-hidden="true" /><FishArtwork assetKey={meta.assetKey} colors={meta.colors} fishId={fish.fishId} growthStage={fish.growthStage} priority speciesId={fish.speciesId} variant="detail" /></div>
        <span className="aquarium-discovery-rarity">{RARITY_LABELS[rarity]} · {rarity.toUpperCase()}</span>
        <h2>{meta.displayName}</h2>
        <p>{fish.name}</p>
      </div>
      <div className="aquarium-discovery-body">
        <div className="aquarium-result-reward">{duplicate ? <><span>{refund ? '최대 레벨 보상' : '중복 성장 보상'}</span><b>{refund ? `조개 ${result.shellsRefunded}개 환급` : `EXP +${Number(result.expGranted) || 0}`}</b><small>{refund ? '이미 최고 레벨인 친구를 만나 조개를 돌려받았어요.' : '새 개체가 늘어나는 대신 기존 친구의 성장에 반영됐어요.'}</small></> : <><span>도감 등록 완료</span><b>새 친구가 보관함에 등록됐어요.</b><small>수조에서 함께 헤엄치려면 내 물고기에서 위치를 선택해주세요.</small></>}</div>
        {actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}
        <button type="button" className="btn btn-primary" data-action="acknowledgeAquariumDraw" data-target="catalog" disabled={actionStatus === 'acknowledging-draw'}>{actionStatus === 'acknowledging-draw' ? '확인 처리 중...' : '도감에서 확인하기'}</button>
        <button type="button" className="btn btn-secondary" data-action="closeAquariumMode">나중에 볼게요</button>
      </div>
    </Modal>
  );
}

export function DiscoveryPanel({ actionError = '', actionStatus = 'idle', pendingDrawError = '', pendingDrawStatus = 'idle', profile }) {
  const drawing = actionStatus === 'drawing';
  return <div className="aquarium-mode-shell aquarium-draw-view">
    <AquariumModeHeader eyebrow="DISCOVERY" title="새로운 친구 만나기" description="공부로 모은 조개로 다음 친구를 발견해보세요." />
    <DrawPity profile={profile} />
    <section className="aquarium-draw-ready"><div className="aquarium-sealed-chest" aria-hidden="true"><i /><b /></div><span>DISCOVERY</span><h2>어떤 친구가 기다리고 있을까요?</h2><p>확정된 결과는 나중에 다시 볼 수 있어요. 확인하기 전에는 새 뽑기를 진행하지 않습니다.</p><div className="aquarium-draw-cost"><span>보유 조개</span><b>{Number(profile?.shellBalance) || 0}</b><i /><span>필요 조개</span><b>30</b></div>{pendingDrawError ? <p className="aquarium-action-error" role="alert">{pendingDrawError}</p> : null}{actionError ? <p className="aquarium-action-error" role="alert">{actionError}</p> : null}{pendingDrawStatus === 'error' ? <button type="button" className="btn btn-secondary" data-action="retryGameResources">결과 다시 확인</button> : null}<button type="button" className="btn btn-primary" data-action="startAquariumDraw" disabled={drawing || pendingDrawStatus !== 'ready' || Number(profile?.shellBalance) < 30}>{drawing ? '결과를 확인하는 중...' : Number(profile?.shellBalance) < 30 ? '조개가 더 필요해요' : '조개 30개로 만나기'}</button></section>
  </div>;
}
