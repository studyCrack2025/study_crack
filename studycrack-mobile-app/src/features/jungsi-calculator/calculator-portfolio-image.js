import { CALCULATOR_RISK_BANDS } from './calculator-indicators.js';

const WIDTH = 1080, MARGIN = 48, FONT = '"Paperlogy", sans-serif';
const cancelled = () => Object.assign(new Error('이미지 준비를 취소했습니다.'), { code: 'EXPORT_CANCELLED' });
const check = signal => { if (signal?.aborted) throw cancelled(); };
const font = (size, weight) => `${weight} ${size}px ${FONT}`;
const graphemes = value => typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(value)].map(item => item.segment) : Array.from(value);

export function layoutCalculatorPortfolio(model, context) {
  const commands = [], width = WIDTH - MARGIN * 2;
  function rect(y, height, fill, stroke = null) { return { type: 'rect', x: MARGIN, y, width, height, fill, stroke }; }
  function text(value, y, { size = 24, weight = 400, color = 'muted', x = MARGIN, available = width, align = 'left' } = {}) {
    const lineHeight = Math.ceil(size * 1.4);
    context.font = font(size, weight);
    let line = '';
    const draw = () => {
      commands.push({ type: 'text', text: line, x, y, size, weight, color, width: available, align });
      y += lineHeight;
    };
    for (const glyph of graphemes(String(value))) {
      if (context.measureText(glyph).width > available) throw Error('이미지에 표시할 수 없는 글자가 있습니다. 조합 이름을 확인해주세요.');
      if (line && context.measureText(line + glyph).width > available) { draw(); line = ''; }
      line += glyph;
    }
    draw();
    return y;
  }
  const group = { x: 72, available: 64 };
  const identity = { x: 154, available: 360 };
  const score = { x: 532, available: 138, align: 'right' };
  const cutoff = { x: 690, available: 140, align: 'right' };
  const stage = { x: 850, available: 154, align: 'right' };
  let y = text('STUDYCRACK · 2027학년도', 36, { size: 22, weight: 700, color: 'onBrand' });
  y = text(model.title, y + 6, { size: 44, weight: 800, color: 'onBrand' });
  y = text(`${model.name}  ·  ${model.basisLabel}`, y + 4, { size: 26, weight: 700, color: 'onBrand' }) + 28;
  commands.unshift({ ...rect(0, y, 'navy'), x: 0, width: WIDTH });
  y += 26;
  commands.push(rect(y, 54, 'subtle'));
  for (const [label, column] of [['군', group], ['지원 후보', identity], ['내 환산점수', score], ['예상 합격 컷', cutoff], ['지원 단계', stage]]) {
    text(label, y + 12, { ...column, size: 22, weight: 700 });
  }
  y += 54;
  for (const [index, card] of model.cards.entries()) {
    const top = y, at = commands.length;
    const contentY = y + 20;
    text(card.label, contentY, { ...group, size: 26, weight: 800, color: 'navy' });
    let identityEnd = text(card.identity?.unit ?? '미선택', contentY, { ...identity, size: 29, weight: 800, color: 'ink' });
    if (card.identity) {
      identityEnd = text(card.identity.university, identityEnd + 3, { ...identity, size: 22 });
    }
    let scoreEnd = text(card.score?.value ?? '—', contentY, { ...score, size: 27, weight: 800, color: 'navy' });
    if (card.score?.label === '기존 산식 환산점수') scoreEnd = text('기존 산식', scoreEnd + 4, { ...score, size: 19 });
    const cutoffEnd = text(card.cutoff ?? '—', contentY, { ...cutoff, size: 27, weight: 700, color: 'ink' });
    const band = card.indicator?.band;
    const stageEnd = text(card.indicator?.label ?? '—', contentY, { ...stage, size: 24, weight: 800,
      color: CALCULATOR_RISK_BANDS.some(([key]) => key === band) ? band : 'muted' });
    y = Math.max(identityEnd, scoreEnd, cutoffEnd, stageEnd, top + 68) + 18;
    commands.splice(at, 0, rect(top, y - top, index % 2 ? 'subtle' : 'paper'));
    commands.push(rect(y, 2, 'line'));
    y += 2;
  }
  y = text('예상 합격 컷과 지원 단계는 참고용입니다.', y + 22, { size: 22 }) + 28;
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
  const sample = [model.name, model.title, model.basisLabel, ...model.cards.flatMap(card => [card.identity?.university, card.identity?.unit, card.indicator?.label])].join(' ') + ' 가나다ABC0123456789';
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
      if (command.type === 'text') { context.font = font(command.size, command.weight); context.fillStyle = palette[command.color]; context.textAlign = command.align; context.fillText(command.text, command.x + (command.align === 'right' ? command.width : 0), command.y); }
      else { context.fillStyle = palette[command.fill]; context.fillRect(command.x, command.y, command.width, command.height); if (command.stroke) { context.strokeStyle = palette[command.stroke]; context.lineWidth = 2; context.strokeRect(command.x, command.y, command.width, command.height); } }
    }
    check(signal);
    const blob = await bounded(new Promise(resolve => canvas.toBlob(resolve, 'image/png')), signal); check(signal);
    if (!blob || blob.type !== 'image/png' || !blob.size) throw Error('PNG를 만들지 못했습니다. 다시 시도해주세요.');
    return blob;
  } finally { canvas.width = 1; canvas.height = 1; }
}
