import { useEffect, useRef, useState } from 'react';
import { observeAquariumUnlock } from '../../features/gamification/unlock-visibility.js';

export function AquariumUnlockNotice({ view }) {
  const ref = useRef(null);
  const [notice, setNotice] = useState(null), [active, setActive] = useState(false);
  const stage = view.growth?.highestUnlockedStage;
  useEffect(() => observeAquariumUnlock(ref.current, view, {
    onActive: setActive,
    onNotice: claimed => setNotice({ stage: claimed, claim: view.claimUnlock })
  }), [view.claimUnlock, view.status, view.growth, stage]);
  const shown = notice && notice.claim === view.claimUnlock && notice.stage === stage;
  return <div ref={ref} className="aquarium-unlock-slot" data-unlock-active={active}>
    {shown ? <div className="aquarium-unlock-notice">
      <div role="status"><b>DAY {stage.slice(3)} 배경을 열었어요!</b><p>꾸준히 쌓은 공부가 수조를 바꿨어요.</p><small>이 기기의 계정별 안내예요.</small></div>
      <button type="button" onClick={() => setNotice(null)}>해금 안내 닫기</button>
    </div> : null}
  </div>;
}
