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
