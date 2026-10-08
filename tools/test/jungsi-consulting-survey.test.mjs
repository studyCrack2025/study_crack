import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile(new URL('../../studycrack-mobile-app/src/features/consulting-v2/ConsultingApp.jsx', import.meta.url), 'utf8');
const api = await readFile(new URL('../../studycrack-mobile-app/src/features/consulting-v2/survey-api.js', import.meta.url), 'utf8');
const model = await readFile(new URL('../../studycrack-mobile-app/src/features/consulting-v2/survey-model.js', import.meta.url), 'utf8');
const screen = await readFile(new URL('../../studycrack-mobile-app/src/features/consulting-v2/screens/ConsultingSurveyScreen.jsx', import.meta.url), 'utf8');
const shared = await readFile(new URL('../../js/shared/api.js', import.meta.url), 'utf8');

test('the seven-step v2 survey replaces the survey and material placeholders', () => {
    for (const key of ['studentStatus', 'scores', 'conditions', 'preferences', 'strategy', 'qualitative', 'consent']) assert.match(model, new RegExp(key));
    assert.match(app, /ConsultingSurveyScreen/);
    assert.match(app, /ConsultingMaterialsScreen/);
    assert.match(screen, /expectedDraftRevision/);
});

test('survey submission only selects ready files and supports immutable supplement submission', () => {
    for (const type of ['student_get_v2_survey_schema', 'student_get_v2_survey_draft', 'student_save_v2_survey_draft', 'student_submit_v2_survey', 'student_submit_v2_supplement']) assert.match(api, new RegExp(type));
    assert.match(screen, /file\.status === 'ready'/);
    assert.match(api, /credentials: 'omit'/);
    assert.match(api, /consulting_complete_score_upload/);
    for (const type of ['student_get_v2_survey_schema', 'student_get_v2_survey_draft', 'admin_list_v2_material_review', 'admin_get_v2_material_detail']) assert.match(shared, new RegExp(type));
});
