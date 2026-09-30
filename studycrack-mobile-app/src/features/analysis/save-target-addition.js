import { targetSlotsToList, upsertTargetSlot } from './target-model.js';
import { uniqueTargetList } from './resource-model.js';
import { buildTargetPolicy } from './target-policy.js';
import { getMobileBrowserServices } from '../../shared/browser/mobile-runtime.js';

export async function saveTargetAddition({ api, isCurrentProfile, setState, stateRef }, major) {
  if (!major || !isCurrentProfile()) return false;
  const current = stateRef.current;
  const fail = (message, patch = {}) => {
    setState({ addingUniversity: false, targetSaveError: message, ...patch });
    if (stateRef.current.screen !== 'addUniversity') getMobileBrowserServices().alert(message);
    return false;
  };
  const policy = buildTargetPolicy(current);
  if (targetSlotsToList(current.targetUnivSlots).includes(major)) return false;
  if (!policy.canAdd) {
    return fail(policy.reason);
  }
  setState({ addingUniversity: true, targetSaveError: '' });
  const nextSlots = upsertTargetSlot(current.targetUnivSlots, major);
  const nextHome = targetSlotsToList(nextSlots);
  const nextAnalysis = uniqueTargetList(nextHome);
  let result;
  try { result = await api.persistTargetUnivs(nextHome, nextSlots); }
  catch { result = { ok: false }; }
  if (!isCurrentProfile()) return false;
  if (result?.ok !== true) {
    return fail(result?.error || '목표 대학을 저장하지 못했어요. 선택을 유지했으니 다시 시도해주세요.', result?.code === 'TARGET_CHANGE_LIMIT' ? { user: { ...current.user, univChangeRemaining: result.data.remainCount } } : {});
  }
  setState({
    user: { ...current.user, targetUniversity: nextHome[0] || '', ...(Number.isFinite(result.data?.remainCount) ? { univChangeRemaining: result.data.remainCount } : {}) },
    addingUniversity: false,
    targetSaveError: '',
    analysisSearchOpen: false,
    universityModalOpen: false,
    analysisSearchTerm: '',
    targetUnivSlots: nextSlots,
    analysisTargetList: nextAnalysis,
    homeTargetList: nextHome,
    targetMajor: current.targetMajor || major,
    analysisCalculationRequested: false,
    analysisApiStatus: 'idle',
    analysisApiError: '',
    scoreFetchStatus: 'idle',
    scoreFetchSignature: ''
  });
  return true;
}
