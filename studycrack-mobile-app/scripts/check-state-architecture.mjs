import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SCREEN_CONTEXT_KEYS, createScreenContext } from '../src/app/screen-context.js';
import { APP_STATE_FIELD_KINDS, APP_STATE_FIELD_OWNERS, createInitialAppState } from '../src/state/app-state-schema.js';
import { FEATURE_STATE_KINDS } from '../src/state/create-feature-slice.js';
import { createHandlerStateActions, HANDLER_STATE_FIELDS, requireHandlerStateActions } from '../src/state/handler-state-actions.js';

function extractObjectKeys(source, declaration) {
  const match = source.match(new RegExp(`export\\s+const\\s+${declaration}\\s*=\\s*\\{([\\s\\S]*?)\\};`));
  assert.ok(match, `${declaration} 선언을 찾을 수 없습니다.`);
  return [...match[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((item) => item[1]);
}

const bootstrapRegistrySource = await readFile(new URL('../src/app/screen-registry.js', import.meta.url), 'utf8');
const appRegistrySource = await readFile(new URL('../src/app/screen-registry-app.js', import.meta.url), 'utf8');
const registeredScreens = [
  ...extractObjectKeys(bootstrapRegistrySource, 'BOOTSTRAP_SCREEN_COMPONENTS'),
  ...extractObjectKeys(appRegistrySource, 'MOBILE_APP_SCREEN_COMPONENTS')
].sort();
assert.deepEqual(Object.keys(SCREEN_CONTEXT_KEYS).sort(), registeredScreens, '모든 React screen은 명시 context 계약을 가져야 합니다.');
assert.equal(Object.keys(createInitialAppState()).length, 12, 'root state는 12개 feature slice를 유지해야 합니다.');
assert.equal(Object.keys(APP_STATE_FIELD_OWNERS).length, 215, 'state field 분류 누락 또는 무단 추가를 확인하세요.');
assert.equal(Object.keys(APP_STATE_FIELD_KINDS).length, 215, 'state field 종류 분류 누락 또는 무단 추가를 확인하세요.');
for (const [slice, value] of Object.entries(createInitialAppState())) {
  assert.deepEqual(Object.keys(value), FEATURE_STATE_KINDS, `${slice} slice는 세 가지 상태 종류만 top-level에 가져야 합니다.`);
}
assert.equal(APP_STATE_FIELD_KINDS.user, 'serverResource');
assert.equal(APP_STATE_FIELD_KINDS.signupForm, 'localDraft');
assert.equal(APP_STATE_FIELD_KINDS.screen, 'ephemeralUi');

for (const [group, fields] of Object.entries(HANDLER_STATE_FIELDS)) {
  assert.equal(fields.length, new Set(fields).size, `${group} handler action field가 중복되었습니다.`);
  for (const field of fields) assert.ok(APP_STATE_FIELD_OWNERS[field], `${group} handler가 미등록 field를 참조합니다: ${field}`);
}

const handlerFiles = [
  'analysis-handlers.js', 'auth-handlers.js', 'calendar-handlers.js', 'form-handlers.js',
  'gesture-handlers.js', 'planner-handlers.js', 'profile-handlers.js', 'service-handlers.js',
  'timer-handlers.js'
];
const handlerSources = (await Promise.all(handlerFiles.map((file) => (
  readFile(new URL(`../src/handlers/${file}`, import.meta.url), 'utf8')
)))).join('\n');
for (const field of new Set(Object.values(HANDLER_STATE_FIELDS).flat())) {
  const setter = `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
  assert.doesNotMatch(handlerSources, new RegExp(`\\b${setter}\\s*=\\s*noop\\b`), `${setter} 필수 action을 noop으로 숨길 수 없습니다.`);
}

assert.throws(() => requireHandlerStateActions({}, 'analysis'), /state action group이 누락/);
assert.throws(() => createHandlerStateActions({ setState() {} }), /getRootState/);
assert.throws(
  () => createScreenContext('authSignup', {}, { auth: {} }),
  /필수 screen action 누락/
);

const appSource = await readFile(new URL('../src/app/MobileApp.js', import.meta.url), 'utf8');
const stateSource = await readFile(new URL('../src/runtime/app-state.js', import.meta.url), 'utf8');
const schemaSource = await readFile(new URL('../src/state/app-state-schema.js', import.meta.url), 'utf8');
const persistenceSource = await readFile(new URL('../src/app/use-app-state-persistence.js', import.meta.url), 'utf8');
assert.doesNotMatch(appSource, /createCompatibilityStateActions|\.\.\.setters/);
assert.match(appSource, /createScreenContext\(state\.screen, viewContext, handlerStateActions, state\)/);
assert.match(appSource, /contextRef\.current = \{ \.\.\.state, \.\.\.viewContext \}/);
assert.match(appSource, /getRootState:\s*\(\)\s*=>\s*rootStateRef\.current/);
assert.doesNotMatch(stateSource, /STORAGE_KEYS|safeStringifySet/);
assert.doesNotMatch(schemaSource, /from ['"]\.\.\/runtime\//, '순수 state schema가 runtime 계층을 참조하면 안 됩니다.');
assert.doesNotMatch(persistenceSource, /selectFlatAppState|flatSlice/, 'storage persistence는 필요한 state kind selector만 사용해야 합니다.');

console.log('state architecture contracts passed: 12 slices, 215 fields, scoped handlers and React screens.');
