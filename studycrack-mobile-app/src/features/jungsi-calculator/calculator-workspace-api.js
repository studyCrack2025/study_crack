import { apiInvalidResponse, postJson } from '../../shared/api/client.js';
import { CALCULATOR_STORAGE_CONSENT, normalizeStoredCalculatorInput } from './calculator-storage-api.js';
import { emptyRepresentatives, normalizePlanTargets, samePlanTargetIdentity, validRepresentatives } from './calculator-plan-model.js';
import { parseRecommendationPreferences } from './calculator-recommendation-preferences.js';

const revision = n => Number.isSafeInteger(n) && n >= 0;
const date = s => typeof s === 'string' && s.length <= 40 && Number.isFinite(Date.parse(s));
export function parseCalculatorWorkspace(value, applicationId) {
  if (!value || value.contractVersion !== 'calculator-workspace-v2' || value.applicationId !== applicationId || !/^WS_[a-f0-9]{32}$/.test(value.workspaceId || '')
    || !revision(value.revision) || !revision(value.legacyRevision) || !['saved', 'empty', 'restricted'].includes(value.status) || value.source !== 'self_reported' || value.reviewed !== false
    || value.consentRevision !== CALCULATOR_STORAGE_CONSENT || !['canSave', 'canDelete', 'consentAccepted'].every(key => typeof value[key] === 'boolean')
    || value.updatedAt !== null && !date(value.updatedAt) || !Array.isArray(value.plans) || value.plans.length > 10) return null;
  if (value.status !== 'saved') return value.profile === null && value.plans.length === 0 && value.lastSavedPlanId === null
    && (value.status !== 'restricted' || value.canSave === false && value.canDelete) ? value : null;
  const profile = value.profile, prepared = normalizeStoredCalculatorInput({ scores: profile?.scores, targets: [] });
  const preferences = parseRecommendationPreferences(profile?.recommendationPreferences);
  if (!profile || !prepared || !preferences || !revision(profile.revision) || profile.revision < 1 || !date(profile.updatedAt) || !value.consentAccepted || value.updatedAt === null) return null;
  if (profile.scores.basis === 'raw' && ['kor', 'math'].some(key => profile.scores.exam[key].raw !== prepared.scores.exam[key].raw)) return null;
  const seen = new Set(), plans = [];
  for (const plan of value.plans) {
    const targets = normalizePlanTargets(prepared.scores, plan?.targets);
    const previousTargets = plan?.previousTargets === undefined ? [] : normalizePlanTargets(prepared.scores, plan.previousTargets);
    if (!plan || !/^PLAN_[A-Za-z0-9_-]{6,64}$/.test(plan.planId || '') || seen.has(plan.planId) || !revision(plan.revision) || plan.revision < 1 || !date(plan.updatedAt)
      || typeof plan.name !== 'string' || !plan.name.trim() || plan.name.length > 60 || /[\u0000-\u001f\u007f]/.test(plan.name) || !targets || !previousTargets || plan.representatives !== undefined && !validRepresentatives(plan.representatives, targets)) return null;
    seen.add(plan.planId); plans.push({ planId: plan.planId, revision: plan.revision, name: plan.name, targets, ...(previousTargets.length ? { previousTargets } : {}), ...(plan.representatives === undefined ? {} : { representatives: plan.representatives }), updatedAt: plan.updatedAt });
  }
  if (value.lastSavedPlanId !== null && !seen.has(value.lastSavedPlanId)) return null;
  return { ...value, profile: { revision: profile.revision, scores: prepared.scores, updatedAt: profile.updatedAt,
    ...(profile.recommendationPreferences === undefined ? {} : { recommendationPreferences: preferences }) }, plans };
}

export async function requestCalculatorWorkspace(binding, { applicationId, type = 'student_get_calculator_workspace', data = {}, signal }) {
  const read = type === 'student_get_calculator_workspace';
  const send = () => postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, signal, payload: { type, data: { applicationId, ...data } }, fallbackError: '성적과 지원 조합을 확인하지 못했습니다. 다시 시도해주세요.' });
  let result = await send();
  if (read && result.code === 'AUTH_RETRY_REQUIRED' && !signal?.aborted) result = await send();
  if (!result.ok) return result;
  const value = result.data?.success === true ? parseCalculatorWorkspace(result.data.data, applicationId) : null;
  if (!value || !read && value.revision !== data.expectedWorkspaceRevision + 1
    || type === 'student_save_calculator_profile' && (JSON.stringify(value.profile?.scores) !== JSON.stringify(data.scores)
      || data.recommendationPreferences !== undefined && JSON.stringify(value.profile?.recommendationPreferences) !== JSON.stringify(parseRecommendationPreferences(data.recommendationPreferences)))
    || type === 'student_save_calculator_plan' && !value.plans.some(plan => plan.planId === value.lastSavedPlanId && (data.planId === null || plan.planId === data.planId) && plan.name === data.name.trim()
      && plan.targets.length === data.targets.length && plan.targets.every((target, index) => samePlanTargetIdentity(target, data.targets[index]))
      && (data.representatives === undefined || JSON.stringify(plan.representatives || emptyRepresentatives()) === JSON.stringify(data.representatives)))
    || type === 'student_delete_calculator_plan' && value.plans.some(plan => plan.planId === data.planId)
    || type === 'student_delete_calculator_workspace' && value.status !== 'empty') return apiInvalidResponse(result);
  return { ...result, data: value };
}
