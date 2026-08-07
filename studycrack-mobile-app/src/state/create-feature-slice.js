/**
 * @typedef {'serverResource'|'localDraft'|'ephemeralUi'} FeatureStateKind
 * @typedef {{ serverResource: Record<string, unknown>, localDraft: Record<string, unknown>, ephemeralUi: Record<string, unknown> }} FeatureState
 * @typedef {{ type?: string, payload?: Record<string, unknown> }} FeatureAction
 * @typedef {{
 *   name: string,
 *   fieldKinds: Readonly<Record<string, FeatureStateKind>>,
 *   createInitialState: () => FeatureState,
 *   reducer: (state?: FeatureState, action?: FeatureAction) => FeatureState,
 *   actions: { patch: (payload: Record<string, unknown>) => FeatureAction, set: (key: string, value: unknown) => FeatureAction },
 *   selectors: {
 *     slice: (rootState: Record<string, FeatureState>) => FeatureState,
 *     serverResource: (rootState: Record<string, FeatureState>) => Record<string, unknown>|undefined,
 *     localDraft: (rootState: Record<string, FeatureState>) => Record<string, unknown>|undefined,
 *     ephemeralUi: (rootState: Record<string, FeatureState>) => Record<string, unknown>|undefined,
 *     flatSlice: (rootState: Record<string, FeatureState>) => Record<string, unknown>,
 *     field: (rootState: Record<string, FeatureState>, key: string) => unknown
 *   }
 * }} FeatureSlice
 */

function resolveNextValue(current, next) {
  return typeof next === 'function' ? next(current) : next;
}

export const FEATURE_STATE_KINDS = Object.freeze(['serverResource', 'localDraft', 'ephemeralUi']);

function createFieldKindMap(name, initialState) {
  const result = {};
  for (const kind of FEATURE_STATE_KINDS) {
    const fields = Object.keys(initialState[kind] || {});
    for (const field of fields) {
      if (result[field]) throw new Error(`[${name}] state field 종류 중복: ${field}`);
      result[field] = kind;
    }
  }
  return Object.freeze(result);
}

function validateInitialState(name, initialState) {
  const keys = Object.keys(initialState || {});
  if (keys.length !== FEATURE_STATE_KINDS.length || !FEATURE_STATE_KINDS.every((kind) => keys.includes(kind))) {
    throw new Error(`[${name}] initial state는 serverResource/localDraft/ephemeralUi만 가져야 합니다.`);
  }
  for (const kind of FEATURE_STATE_KINDS) {
    if (!initialState[kind] || typeof initialState[kind] !== 'object' || Array.isArray(initialState[kind])) {
      throw new Error(`[${name}] ${kind} state는 객체여야 합니다.`);
    }
  }
}

/**
 * @param {string} name
 * @param {() => FeatureState} createInitialState
 * @returns {Readonly<FeatureSlice>}
 */
export function createFeatureSlice(name, createInitialState) {
  if (!name || typeof createInitialState !== 'function') {
    throw new TypeError('feature slice는 name과 initial state factory가 필요합니다.');
  }

  const initialState = createInitialState();
  validateInitialState(name, initialState);
  const fieldKindMap = createFieldKindMap(name, initialState);

  const patchType = `${name}/patch`;
  const setType = `${name}/set`;

  function flattenState(state = createInitialState()) {
    return Object.assign({}, ...FEATURE_STATE_KINDS.map((kind) => state[kind] || {}));
  }

  function reducer(state = createInitialState(), action = {}) {
    if (action.type === patchType) {
      const grouped = {};
      for (const [field, value] of Object.entries(action.payload || {})) {
        const kind = fieldKindMap[field];
        if (!kind) throw new Error(`[${name}] 알 수 없는 state field: ${String(field)}`);
        (grouped[kind] ||= {})[field] = value;
      }
      let next = state;
      for (const [kind, patch] of Object.entries(grouped)) {
        next = { ...next, [kind]: { ...next[kind], ...patch } };
      }
      return next;
    }
    if (action.type !== setType) return state;
    const key = action.payload?.key;
    const kind = fieldKindMap[key];
    if (!kind) throw new Error(`[${name}] 알 수 없는 state field: ${String(key)}`);
    return {
      ...state,
      [kind]: { ...state[kind], [key]: resolveNextValue(state[kind][key], action.payload.value) }
    };
  }

  return Object.freeze({
    name,
    fieldKinds: fieldKindMap,
    createInitialState,
    reducer,
    actions: Object.freeze({
      patch: (payload) => ({ type: patchType, payload }),
      set: (key, value) => ({ type: setType, payload: { key, value } })
    }),
    selectors: Object.freeze({
      slice: (rootState) => rootState[name],
      serverResource: (rootState) => rootState[name]?.serverResource,
      localDraft: (rootState) => rootState[name]?.localDraft,
      ephemeralUi: (rootState) => rootState[name]?.ephemeralUi,
      flatSlice: (rootState) => flattenState(rootState[name]),
      field: (rootState, key) => rootState[name]?.[fieldKindMap[key]]?.[key]
    })
  });
}
