import { expect } from '@playwright/test';

// A stationary child can still move during the parent's expansion and auto-scroll.
export async function setDisclosureOpen(details, open = true) {
  const summary = details.locator(':scope > summary');
  await expect(details).toHaveAttribute('data-disclosure', 'animated');
  if ((await summary.getAttribute('aria-expanded')) !== String(open)) await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', String(open));
  await expect.poll(() => details.evaluate(element => {
    const body = element.querySelector(':scope > .sc-disclosure-body');
    return [element, body].filter(Boolean).every(node => node.getAnimations().every(animation =>
      animation.playState === 'finished' || animation.playState === 'idle'));
  })).toBe(true);
  await expect(details).toHaveJSProperty('open', open);
  await expect(details.locator(':scope > .sc-disclosure-body')).toHaveJSProperty('inert', !open);
}
