export async function deliverCalculatorPortfolioPng({ blob, copy = false, current = () => true, browser = globalThis }) {
  const check = () => { if (!current()) throw Object.assign(new Error('현재 포트폴리오를 다시 확인해주세요.'), { code: 'EXPORT_CANCELLED' }); };
  check();
  if (!blob || blob.type !== 'image/png' || !blob.size) throw Error('내보낼 이미지를 먼저 준비해주세요.');
  if (copy && browser.isSecureContext && typeof browser.ClipboardItem === 'function' && typeof browser.navigator?.clipboard?.write === 'function') {
    try {
      if (typeof browser.ClipboardItem.supports !== 'function' || browser.ClipboardItem.supports('image/png')) {
        await browser.navigator.clipboard.write([new browser.ClipboardItem({ 'image/png': blob })]);
        check(); return 'copied';
      }
    } catch (_) { check(); }
  }
  check();
  const doc = browser.document;
  if (!doc?.body || typeof browser.URL?.createObjectURL !== 'function') throw Error('이 브라우저에서 PNG를 저장할 수 없습니다. 다른 브라우저에서 시도해주세요.');
  const url = browser.URL.createObjectURL(blob); let requested = false, link;
  try { link = doc.createElement('a'); link.href = url; link.download = 'StudyCrack_2027_정시_포트폴리오.png'; link.rel = 'noopener'; doc.body.append(link); check(); link.click(); requested = true; }
  finally { link?.remove(); if (requested) browser.setTimeout(() => browser.URL.revokeObjectURL(url), 30000); else browser.URL.revokeObjectURL(url); }
  return copy ? 'downloaded-fallback' : 'downloaded';
}
