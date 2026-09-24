import { useEffect, useRef, useState } from 'react';

export function useCareEffect(result, enabled) {
  const seen = useRef(result?.eventId);
  const [effect, setEffect] = useState(null);
  useEffect(() => {
    setEffect(null);
    if (!result?.eventId || seen.current === result.eventId) return undefined;
    seen.current = result.eventId;
    if (!enabled || document.hidden) return undefined;
    const type = result.type === 'feed' ? 'feed' : result.type === 'slot' && result.arriving ? 'arrival' : '';
    if (!type) return undefined;
    setEffect({ type, fishId: result.fish?.fishId || result.fishId, eventId: result.eventId });
    const stop = () => setEffect(null);
    const timer = setTimeout(stop, 1500);
    const visibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', visibility);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [result?.eventId, enabled]);
  return effect;
}
