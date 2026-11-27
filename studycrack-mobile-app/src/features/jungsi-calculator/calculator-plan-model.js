import { normalizeStoredCalculatorInput } from './calculator-storage-api.js';
import { calculatorDigest, calculatorLabel, calculatorRecordId, calculatorSelectionKey } from './calculator-validation.js';
import { MAX_CANDIDATES } from './calculator-model.js';

export const CALCULATOR_GROUPS = [['ga', '가군'], ['na', '나군'], ['da', '다군']];
export const emptyRepresentatives = () => ({ ga: null, na: null, da: null });
export const planTargetKey = target => target.selection?.key || JSON.stringify([target.university, target.major]);
export function normalizePlanSelection(value) {
  if (!value || !calculatorSelectionKey(value.key) || !calculatorRecordId(value.recordId)
    || !/^TRACK_[A-Z0-9_-]{1,100}$/.test(value.trackId || '') || !CALCULATOR_GROUPS.some(([group]) => group === value.admissionGroup) || !calculatorDigest(value.catalogDigest)
    || !['universityName', 'campusName', 'unitName', 'trackName'].every(key => calculatorLabel(value[key]) && value[key].trim())) return null;
  return Object.fromEntries(['key', 'recordId', 'trackId', 'admissionGroup', 'universityName', 'campusName', 'unitName', 'trackName', 'catalogDigest'].map(key => [key, value[key]]));
}
export function normalizePlanTargets(scores, value) {
  if (!Array.isArray(value) || value.length > 6) return null;
  const targets = [], seen = new Set(), selections = new Set();
  for (const row of value) {
    const prepared = normalizeStoredCalculatorInput({ scores, targets: [row] });
    if (!prepared) return null;
    const target = prepared.targets[0];
    if (row.selection !== undefined) {
      const selection = normalizePlanSelection(row.selection);
      if (!selection || !target.admissionUnitId || selections.has(selection.key)) return null;
      selections.add(selection.key);
      target.selection = selection;
    }
    const key = JSON.stringify(target.selection ? [target.admissionUnitId, target.selection.trackId, target.selection.admissionGroup] : [target.university, target.major]);
    if (seen.has(key)) return null;
    seen.add(key); targets.push(target);
  }
  return targets;
}
export function validRepresentatives(value, targets) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 3
    && CALCULATOR_GROUPS.every(([group]) => value[group] === null || calculatorSelectionKey(value[group]) && targets.some(target => target.selection?.key === value[group] && target.selection?.admissionGroup === group));
}
export function samePlanTargetIdentity(a, b) {
  return a && b && ['university', 'major', 'admissionUnitId'].every(key => a[key] === b[key])
    && (a.selection || b.selection ? a.selection && b.selection && ['key', 'recordId', 'trackId', 'admissionGroup'].every(key => a.selection[key] === b.selection[key]) : true);
}
export function groupPlanTargets(targets, representatives) {
  return CALCULATOR_GROUPS.flatMap(([group]) => {
    const rows = targets.filter(target => target.selection?.admissionGroup === group);
    const selected = rows.find(row => row.selection.key === representatives?.[group]) || rows[0];
    return selected ? [selected] : [];
  });
}

export function setPlanTarget(targets, target) {
  return groupPlanTargets([...targets.filter(row => row.selection.admissionGroup !== target.selection.admissionGroup), target]);
}

export function calculatorPlanDraft(plan, grouped, multiCandidate) {
  const saved = plan?.targets || [];
  const targets = !grouped ? saved : multiCandidate ? saved.filter(target => target.selection) : groupPlanTargets(saved, plan?.representatives);
  const representatives = multiCandidate && plan?.representatives
    ? plan.representatives : Object.assign(emptyRepresentatives(), Object.fromEntries(groupPlanTargets(targets).map(target => [target.selection.admissionGroup, target.selection.key])));
  return { targets, representatives };
}

export function samePlanSelection(a, b) {
  return a.selection.key === b.selection.key || a.admissionUnitId === b.admissionUnitId
    && a.selection.trackId === b.selection.trackId && a.selection.admissionGroup === b.selection.admissionGroup;
}

export function addCalculatorPlanCandidate(draft, target) {
  if (draft.targets.length >= MAX_CANDIDATES || draft.targets.some(row => samePlanSelection(row, target))) return draft;
  const group = target.selection.admissionGroup;
  const representatives = draft.targets.some(row => row.selection.admissionGroup === group)
    ? draft.representatives : { ...draft.representatives, [group]: target.selection.key };
  return { targets: [...draft.targets, target], representatives };
}

export function removeCalculatorPlanCandidate(draft, key) {
  const target = draft.targets.find(row => planTargetKey(row) === key);
  if (!target) return draft;
  const group = target.selection?.admissionGroup;
  const representatives = group && draft.representatives[group] === key ? { ...draft.representatives, [group]: null } : draft.representatives;
  return { targets: draft.targets.filter(row => row !== target), representatives };
}
