import { navigationSlice } from './navigation-state.js';
import { overlaySlice } from './overlay-state.js';
import { sessionSlice } from '../features/session/state.js';
import { analysisSlice } from '../features/analysis/state.js';
import { plannerSlice } from '../features/planner/state.js';
import { studySlice } from '../features/study/state.js';
import { gamificationSlice } from '../features/gamification/state.js';
import { coachingSlice } from '../features/coaching/state.js';
import { accountSlice } from '../features/account/state.js';
import { notificationsSlice } from '../features/notifications/state.js';
import { reportsSlice } from '../features/reports/state.js';
import { supportSlice } from '../features/support/state.js';

export const APP_STATE_SLICES = Object.freeze([
  navigationSlice,
  sessionSlice,
  analysisSlice,
  studySlice,
  plannerSlice,
  gamificationSlice,
  coachingSlice,
  accountSlice,
  notificationsSlice,
  reportsSlice,
  supportSlice,
  overlaySlice
]);

function buildFieldOwnership() {
  const ownership = {};
  for (const slice of APP_STATE_SLICES) {
    for (const field of Object.keys(slice.fieldKinds)) {
      if (ownership[field]) throw new Error(`state field 소유권 중복: ${field}`);
      ownership[field] = slice.name;
    }
  }
  return Object.freeze(ownership);
}

export const APP_STATE_FIELD_OWNERS = buildFieldOwnership();

export const APP_STATE_FIELD_KINDS = Object.freeze(Object.assign({}, ...APP_STATE_SLICES.map((slice) => slice.fieldKinds)));

export function createInitialAppState() {
  return Object.fromEntries(APP_STATE_SLICES.map((slice) => [slice.name, slice.createInitialState()]));
}

export function selectFlatAppState(rootState = {}) {
  return Object.assign({}, ...APP_STATE_SLICES.map((slice) => slice.selectors.flatSlice(rootState)));
}

export function selectAppStateField(rootState, field) {
  const owner = APP_STATE_FIELD_OWNERS[field];
  if (!owner) throw new Error(`알 수 없는 app state field: ${field}`);
  return APP_STATE_SLICES.find((slice) => slice.name === owner).selectors.field(rootState, field);
}

export function appStateReducer(state = createInitialAppState(), action = {}) {
  if (action.type === 'app/patch') {
    const grouped = {};
    for (const [field, value] of Object.entries(action.payload || {})) {
      const owner = APP_STATE_FIELD_OWNERS[field];
      if (!owner) throw new Error(`알 수 없는 app state field: ${field}`);
      (grouped[owner] ||= {})[field] = value;
    }
    let next = state;
    for (const slice of APP_STATE_SLICES) {
      if (!grouped[slice.name]) continue;
      next = { ...next, [slice.name]: slice.reducer(next[slice.name], slice.actions.patch(grouped[slice.name])) };
    }
    return next;
  }

  const owner = APP_STATE_SLICES.find((slice) => action.type?.startsWith(`${slice.name}/`));
  if (!owner) return state;
  return { ...state, [owner.name]: owner.reducer(state[owner.name], action) };
}
