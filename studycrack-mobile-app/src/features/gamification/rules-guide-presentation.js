import { createPlannerSyncModel } from '../planner/sync-model.js';

export const AQUARIUM_GUIDE_STAGES = Object.freeze([1, 7, 15, 30, 50, 100]);
export const GUIDE_RARITIES = Object.freeze(['common', 'rare', 'epic', 'legendary']);

const positive = value => Number.isSafeInteger(value) && value > 0;

export function buildRulesGuidePresentation(rules, status = 'ready') {
  const ticket = rules?.ticketPolicy;
  const plan = ticket?.version === 'planner-ticket-v1';
  const ready = status === 'ready' && positive(ticket?.drawCost) && (plan ? ticket.minimumPlanMinutes === 30 && ticket.grantPerPlan === 1
    && ticket.completionMode === 'server_check' && JSON.stringify(ticket.boostPlanMinutes) === '[120,240]' : ticket?.version === 'study-ticket-v1' && positive(ticket.intervalSeconds));
  if (!ready) return { ready: false, state: ['idle', 'loading'].includes(status) ? 'loading' : ['off', 'unavailable'].includes(status) ? 'unavailable' : status === 'error' ? 'error' : 'unsupported', starter: null, draw: null };
  const starter = rules.starterPolicy?.version === 'starter-study-v1'
    && positive(rules.starterPolicy.minimumSessionSeconds) && positive(rules.starterPolicy.choiceCount)
    ? rules.starterPolicy : null;
  const draw = rules.drawPolicy;
  const drawReady = draw?.version === (plan ? 'draw-plan-v1' : 'draw-ticket-v1') && draw.randomSelection === true
    && draw.duplicateEffect === (plan ? 'none' : 'growth');
  return { ready: true, plan, ticket, starter, draw: drawReady ? draw : null };
}

export function buildRulesGuideSteps(presentation) {
  if (!presentation.ready) return [];
  const { plan, ticket, draw } = presentation;
  return [
    { title: plan ? '30분 이상 계획을 세워요' : `확정 공부 ${guideDuration(ticket.intervalSeconds)}마다 1장`,
      body: plan ? '계정에 저장한 계획이 뽑기 대상이에요. 30분 미만 계획도 자유롭게 만들 수 있어요.' : '공부를 마치고 기록이 확인되면 뽑기권을 받아요. 남은 시간은 다음 날로 이어져요.',
      artwork: 'calendar', label: plan ? '30분 이상 계획과 뽑기권 한 장' : '확인된 공부 기록과 뽑기권 한 장' },
    { title: plan ? '계획을 완료하고 저장해요' : '완료한 공부 기록을 확인해요',
      body: plan ? '서버에서 첫 완료가 확인되면 뽑기권 1장을 받아요. 완료 취소·재완료로는 다시 지급되지 않아요.' : '타이머를 멈추는 것만으로는 지급되지 않아요. 완료 기록과 보상 확인을 마쳐주세요.',
      artwork: 'check', label: '완료 체크에서 서버 확인을 거쳐 뽑기권 받기' },
    { title: draw ? `뽑기권 ${ticket.drawCost}장으로 새 친구를 만나요` : '만남 규칙 확인이 필요해요',
      body: draw ? '무작위 친구가 보관함에 들어와요. 내 물고기에서 수조에 배치하세요.' : '최신 만남 규칙을 확인한 뒤 뽑기 방법을 안내해드릴게요.',
      artwork: 'fish', label: draw ? '뽑기권으로 무작위 물고기 만나기' : '물고기 만남 규칙 확인 필요' },
    { title: !draw ? '중복 규칙 확인이 필요해요' : plan ? '같은 친구라면 수조는 그대로예요' : '같은 친구를 만나면 성장해요',
      body: !draw ? '최신 중복 규칙을 확인해주세요.' : plan ? '중복으로 기록하며, 보유 물고기와 경험치·배치는 그대로예요.' : '새 개체 대신 기존 친구의 성장 경험치로 반영돼요.',
      artwork: 'duplicate', label: !draw ? '중복 규칙 확인 필요' : plan ? '같은 종 두 마리는 중복 기록, 수조 배치는 유지' : '같은 종을 다시 만나 기존 물고기 성장' }
  ];
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
