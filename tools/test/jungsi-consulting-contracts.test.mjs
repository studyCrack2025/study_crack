import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHomeResponse } from '../../studycrack-mobile-app/src/features/consulting-v2/contracts.js';
import { actionPathForState } from '../../studycrack-mobile-app/src/features/consulting-v2/progress-model.js';

const progress = ['onboarding', 'survey', 'materials', 'written_consultation', 'report', 'final_call'].map((step, index) => ({ step, status: index < 2 ? 'completed' : index === 2 ? 'current' : 'upcoming' }));

test('home parser matches v2 state and progress names while keeping nested payloads closed', () => {
    const home = parseHomeResponse({ success: true, data: { available: true, workflowState: 'MATERIAL_REVIEW', nextAction: 'WAIT_FOR_MATERIAL_REVIEW', nextDueAt: '2026-10-10T00:00:00.000Z', progress, session: null, report: null, alerts: [] } });
    assert.equal(home.progress[2].step, 'materials');
    assert.equal(actionPathForState(home.workflowState), '/2027-jungsi-consulting/materials');
    assert.equal(parseHomeResponse({ success: true, data: { ...home, session: { private: true } } }), null);
});

test('completed home permits the backend null next action', () => {
    const completed = progress.map(item => ({ ...item, status: 'completed' }));
    const home = parseHomeResponse({ success: true, data: { available: true, workflowState: 'SERVICE_COMPLETED', nextAction: null, nextDueAt: null, progress: completed, session: null, report: null, alerts: [] } });
    assert.equal(home.nextAction, null);
    assert.equal(actionPathForState(home.workflowState), '');
});

test('supplement action returns directly to the editable survey', () => {
    assert.equal(actionPathForState('SUPPLEMENT_REQUIRED'), '/2027-jungsi-consulting/survey');
});

test('서비스 보류 안내는 홈 parser에서 유지하고 자유 사유를 추가로 반환하지 않는다', () => {
    const home = parseHomeResponse({ success: true, data: { available: true, workflowState: 'SURVEY_DRAFT', nextAction: null, nextDueAt: null, serviceHold: true, privateReason: 'MUST_NOT_RETURN', progress, session: null, report: null, alerts: [] } });
    assert.equal(home.serviceHold, true); assert.equal(home.nextAction, null); assert.equal(Object.hasOwn(home, 'privateReason'), false);
});
