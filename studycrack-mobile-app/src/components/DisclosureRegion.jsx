import { useLayoutEffect, useRef } from 'react';

export function DisclosureRegion({ open, children, triggerRef }) {
  const region = useRef(null);
  useLayoutEffect(() => {
    const node = region.current;
    if (!open && node.contains(document.activeElement)) triggerRef?.current?.focus({ preventScroll: true });
  }, [open, triggerRef]);
  return <div ref={region} className="sc-disclosure-region" data-open={Boolean(open)} aria-hidden={!open} inert={!open ? '' : undefined}><div className="sc-disclosure-region-inner">{children}</div></div>;
}
