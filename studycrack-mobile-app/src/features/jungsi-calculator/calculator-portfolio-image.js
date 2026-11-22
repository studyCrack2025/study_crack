import { CALCULATOR_RISK_BANDS } from './calculator-indicators.js';

const WIDTH = 1080, MARGIN = 56, GAP = 20, FONT = '"Paperlogy", sans-serif';
const cancelled = () => Object.assign(new Error('이미지 준비를 취소했습니다.'), { code: 'EXPORT_CANCELLED' });
const check = signal => { if (signal?.aborted) throw cancelled(); };
const font = (size, weight) => `${weight} ${size}px ${FONT}`;
const graphemes = value => typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(value)].map(item => item.segment) : Array.from(value);

export function layoutCalculatorPortfolio(model, context) {
  const commands = [], width = WIDTH - MARGIN * 2;
  function rect(y, height, fill, stroke = null) { return { type: 'rect', x: MARGIN, y, width, height, fill, stroke }; }
  function text(value, y, size = 24, weight = 400, color = 'muted', x = MARGIN + 24, available = width - 48) {
    const lineHeight = Math.ceil(size * 1.55); context.font = font(size, weight);
    for (const paragraph of String(value ?? '').split('\n')) {
      let line = '';
      for (const glyph of graphemes(paragraph)) {
        if (context.measureText(glyph).width > available) throw Error('이미지에 표시할 수 없는 글자가 있습니다. 조합 이름을 확인해주세요.');
        if (line && context.measureText(line + glyph).width > available) { commands.push({ type: 'text', text: line, x, y, size, weight, color, width: available }); y += lineHeight; line = ''; }
        line += glyph;
      }
      commands.push({ type: 'text', text: line, x, y, size, weight, color, width: available }); y += lineHeight;
    }
    return y + 12;
  }
  let y = text('2027 · STUDYCRACK', 48, 24, 700, 'onBrand');
  y = text(model.title, y, 48, 800, 'onBrand'); y = text(model.name, y, 32, 700, 'onBrand') + 16;
  commands.unshift({ ...rect(0, y, 'navy'), x: 0, width: WIDTH });
  y = text('내 성적', y + 32, 32, 700, 'ink'); y = text(model.scoreSummary.basis, y);
  for (const item of model.scoreSummary.items) {
    y = text(`${item.label} · ${item.subject} · ${item.value}`, y, 28, 700, 'navy'); y = text(item.detail, y, 22);
  }
  y = text(model.scoreSummary.grades, y) + 16;
  for (const card of model.cards) {
    const top = y, at = commands.length; y += 24;
    y = text(`${card.label}${card.status === 'empty' ? ' · 미선택' : ''}`, y, 36, 800, 'navy');
    if (card.identity) {
      y = text(`${card.identity.university} · ${card.indicator.label}`, y, 32, 700, CALCULATOR_RISK_BANDS.some(([key]) => key === card.indicator.band) ? card.indicator.band : 'ink'); y = text(card.identity.unit, y, 32, 700, 'ink'); y = text(`${card.identity.campus} · ${card.identity.track}`, y);
      if (card.score) { y = text(`${card.score.label}  ${card.score.value}`, y, 38, 800, 'navy'); y = text(card.score.maximum, y, 22); }
      if (card.reference) { y = text(card.reference.label, y, 24, 700, 'ink'); for (const line of card.reference.lines) y = text(`${line.label}  ${line.value}`, y); y = text(card.reference.note, y, 22); }
    }
    for (const note of card.notes) y = text(note, y, 22);
    y += 16; commands.splice(at, 0, rect(top, y - top, 'paper', 'line')); y += GAP;
  }
  const footer = y, at = commands.length; y = text(model.disclaimer, y + 24, 22); y = text(model.probability, y, 22) + 16;
  commands.splice(at, 0, rect(footer, y - footer, 'subtle')); y += 32;
  if (!Number.isFinite(y) || y > 8192) throw Error('이미지가 너무 깁니다. 조합 이름이나 지원안을 정리한 뒤 다시 시도해주세요.');
  return { width: WIDTH, height: Math.ceil(y), commands };
}

function bounded(promise, signal) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); callback(value); };
    const abort = () => finish(reject, cancelled()), timer = setTimeout(() => finish(reject, Error('이미지 준비 시간이 초과되었습니다. 다시 시도해주세요.')), 10000);
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal?.aborted) abort();
  });
}

export async function renderCalculatorPortfolioPng(model, { signal, document: doc = globalThis.document } = {}) {
  check(signal);
  if (!doc?.fonts?.load || !doc.defaultView?.getComputedStyle) throw Error('이미지에 필요한 글꼴을 준비하지 못했습니다. 다시 시도해주세요.');
  const sample = [model.name, model.title, model.scoreSummary.basis, ...model.scoreSummary.items.map(row => row.subject), ...model.cards.flatMap(card => card.identity ? Object.values(card.identity) : [])].join(' ') + ' 가나다ABC0123456789';
  await bounded(Promise.all([400, 700, 800].map(async weight => { const faces = await doc.fonts.load(font(20, weight), sample); if (!faces.length) throw Error('필수 글꼴을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.'); })), signal);
  await bounded(doc.fonts.ready, signal); check(signal);
  const canvas = doc.createElement('canvas'), context = canvas.getContext('2d');
  if (!context || typeof canvas.toBlob !== 'function') throw Error('이 브라우저에서 이미지를 만들 수 없습니다.');
  try {
    const scene = layoutCalculatorPortfolio(model, context), style = doc.defaultView.getComputedStyle(doc.documentElement);
    const palette = Object.fromEntries(Object.entries({ paper: '--sc-surface-card', navy: '--sc-brand-navy', onBrand: '--sc-on-brand', ink: '--sc-ink', muted: '--sc-ink-muted', subtle: '--sc-surface-subtle', line: '--sc-line-subtle', stable: '--sc-risk-stable', appropriate: '--sc-risk-appropriate', neutral: '--sc-risk-neutral', challenge: '--sc-risk-challenge', risky: '--sc-risk-risky' }).map(([key, token]) => {
      const value = style.getPropertyValue(token).trim(); if (!value) throw Error('이미지 스타일을 준비하지 못했습니다. 다시 시도해주세요.'); return [key, value];
    }));
    canvas.width = scene.width; canvas.height = scene.height; context.textBaseline = 'top'; context.fillStyle = palette.paper; context.fillRect(0, 0, canvas.width, canvas.height);
    for (const command of scene.commands) {
      if (command.type === 'text') { context.font = font(command.size, command.weight); context.fillStyle = palette[command.color]; context.fillText(command.text, command.x, command.y); }
      else { context.fillStyle = palette[command.fill]; context.fillRect(command.x, command.y, command.width, command.height); if (command.stroke) { context.strokeStyle = palette[command.stroke]; context.lineWidth = 2; context.strokeRect(command.x, command.y, command.width, command.height); } }
    }
    check(signal);
    const blob = await bounded(new Promise(resolve => canvas.toBlob(resolve, 'image/png')), signal); check(signal);
    if (!blob || blob.type !== 'image/png' || !blob.size) throw Error('PNG를 만들지 못했습니다. 다시 시도해주세요.');
    return blob;
  } finally { canvas.width = 1; canvas.height = 1; }
}
