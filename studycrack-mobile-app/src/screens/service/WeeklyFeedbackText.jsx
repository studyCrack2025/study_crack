import { useId, useLayoutEffect, useRef, useState } from 'react';

export function WeeklyFeedbackText({ label, text }) {
  const id = useId();
  const paragraph = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const node = paragraph.current;
    const measure = () => {
      if (!node?.getClientRects().length) return;
      setLong(node.scrollHeight > parseFloat(getComputedStyle(node).lineHeight) * 6 + 2);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);
  return <section className="feedback-item" aria-label={label}>
    <h4>{label}</h4>
    <p ref={paragraph} id={id} data-expanded={expanded}>{text}</p>
    {long ? <button type="button" aria-label={`${label} ${expanded ? '접기' : '전체 보기'}`} aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(value => !value)}>{expanded ? '접기' : '전체 보기'}</button> : null}
  </section>;
}
