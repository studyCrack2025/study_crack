import { createPlannerSyncModel } from '../planner/sync-model.js';

export const AQUARIUM_GUIDE_STAGES = Object.freeze([1, 7, 15, 30, 50, 100]);
export const GUIDE_RARITIES = Object.freeze(['common', 'rare', 'epic', 'legendary']);

const positive = value => Number.isSafeInteger(value) && value > 0;

export function buildRulesGuidePresentation(rules, status = 'ready') {
  const ticket = rules?.ticketPolicy;
  const ready = status === 'ready' && ticket?.version === 'study-ticket-v1'
    && positive(ticket.intervalSeconds) && positive(ticket.drawCost);
  if (!ready) return { ready: false, starter: null, draw: null };
  const starter = rules.starterPolicy?.version === 'starter-study-v1'
    && positive(rules.starterPolicy.minimumSessionSeconds) && positive(rules.starterPolicy.choiceCount)
    ? rules.starterPolicy : null;
  const draw = rules.drawPolicy;
  const odds = draw?.oddsBasisPoints;
  const drawReady = draw?.version === 'draw-ticket-v1'
    && GUIDE_RARITIES.every(rarity => Number.isSafeInteger(odds?.[rarity]) && odds[rarity] >= 0)
    && GUIDE_RARITIES.reduce((sum, rarity) => sum + odds[rarity], 0) === 10000
    && ['rare', 'epic', 'legendary'].every(rarity => positive(draw.pityLimits?.[rarity]));
  return { ready: true, ticket, starter, draw: drawReady ? draw : null };
}

export function buildRulesGrowthPresentation(view) {
  if (view?.status !== 'ready') return null;
  try {
    const growth = createPlannerSyncModel().acceptPage({ items: [], growth: null }, { items: [], growth: view.growth, cursor: null }).growth;
    const current = growth.highestUnlockedStage ? Number(growth.highestUnlockedStage.slice(3)) : null;
    const next = AQUARIUM_GUIDE_STAGES.find(day => day > growth.validDayCount) || null;
    return { growth, current, next };
  } catch { return null; }
}

export function guideDuration(seconds) {
  return seconds % 3600 === 0 ? `${seconds / 3600}시간` : seconds % 60 === 0 ? `${seconds / 60}분` : `${seconds}초`;
}
