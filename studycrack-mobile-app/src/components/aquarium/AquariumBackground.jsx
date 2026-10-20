import { useState } from 'react';
import { aquariumBackground } from './aquarium-backgrounds.js';

export function AquariumBackground({ asset, interactive = false }) {
  const [failures, setFailures] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fallback = aquariumBackground('day1');
  const current = failures === 0 ? asset : failures === 1 && asset.key !== fallback.key ? fallback : null;
  const retry = () => { setFailures(0); setLoaded(false); setAttempt(value => value + 1); };
  return <div className="aquarium-background-layer" data-background-status={!current ? 'error' : failures ? 'fallback' : loaded ? 'ready' : 'loading'}>
    {current ? <img key={`${current.key}-${attempt}`} className="aquarium-scene-background" src={current.src} width={current.width} height={current.height} alt="" draggable="false" decoding="async" onLoad={() => setLoaded(true)} onError={() => { setLoaded(false); setFailures(value => value + 1); }} /> : null}
    {failures ? <div className="aquarium-background-notice"><span role="status">{current ? '기본 배경으로 표시하고 있어요.' : '배경 이미지를 불러오지 못했어요.'}</span>{interactive ? <button type="button" onClick={retry}>배경 다시 보기</button> : null}</div> : null}
  </div>;
}
