import { createPlannerSyncModel } from '../planner/sync-model.js';

export const AQUARIUM_GUIDE_STAGES = Object.freeze([1, 7, 15, 30, 50, 100]);
export const GUIDE_RARITIES = Object.freeze(['common', 'rare', 'epic', 'legendary']);

const positive = value => Number.isSafeInteger(value) && value > 0;

export function buildRulesGuidePresentation(rules, status = 'ready') {
  const ticket = rules?.ticketPolicy;
  const plan = ticket?.version === 'planner-ticket-v1';
  const ready = status === 'ready' && positive(ticket?.drawCost) && (plan ? ticket.minimumPlanMinutes === 30 && ticket.grantPerPlan === 1
    && ticket.completionMode === 'server_check' && JSON.stringify(ticket.boostPlanMinutes) === '[120,240]' : ticket?.version === 'study-ticket-v1' && positive(ticket.intervalSeconds));
  if (!ready) return { ready: false, starter: null, draw: null };
  const starter = rules.starterPolicy?.version === 'starter-study-v1'
    && positive(rules.starterPolicy.minimumSessionSeconds) && positive(rules.starterPolicy.choiceCount)
    ? rules.starterPolicy : null;
  const draw = rules.drawPolicy;
  const drawReady = draw?.version === (plan ? 'draw-plan-v1' : 'draw-ticket-v1') && draw.randomSelection === true
    && draw.duplicateEffect === (plan ? 'none' : 'growth');
  return { ready: true, plan, ticket, starter, draw: drawReady ? draw : null };
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
