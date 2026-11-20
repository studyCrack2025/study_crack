import { expect, test } from '@playwright/test';
const path = '/2027-jungsi-consulting/calculator', appId = 'APP_11111111-1111-4111-8111-111111111111', consent = 'CALCULATOR_INPUT_STORAGE_20261120_V1';
const panel = page => page.getByRole('region', { name: '계산기 자료 서버 저장', exact: true });
const save = page => page.getByRole('button', { name: '성적·지원 후보 서버에 저장', exact: true });
const record = (revision = 0, input = null) => ({ contractVersion: 'calculator-input-v1', applicationId: appId, status: input ? 'saved' : 'empty', revision, input, updatedAt: revision ? '2026-11-20T00:00:00.000Z' : null, candidateCount: input?.targets.length || 0, basis: input?.scores.basis || null, source: 'self_reported', reviewed: false, canSave: true, consentRevision: consent });
async function setup(page, options = {}) {
  const state = { saved: record(), calls: [], deferRead: false, deferSave: false, release: null, fail: false, conflict: false, lostReply: false, owner: 'student-A', ...options };
  const context = page.context();
  await context.addInitScript(() => { if (!localStorage.getItem('userId')) { localStorage.setItem('userId', 'student-A'); localStorage.setItem('userRole', 'student'); } });
  await context.route('https://www.googletagmanager.com/**', route => route.abort());
  await context.route('**/js/config.js*', route => route.fulfill({ contentType: 'application/javascript', body: `window.IS_LOCAL=false;window.CONFIG={api:{analysis:'/__input-analysis',consulting:'/__input-core',auth:'/__input-auth',consultingPublic:'/__input-public'}};` }));
  await context.route('**/__input-auth', route => route.fulfill({ json: { success: true } }));
  await context.route('**/__input-public', route => route.fulfill({ json: { success: true, data: {} } }));
  await context.route('**/__input-analysis', route => {
    const body = route.request().postDataJSON();
    if (body.type === 'get_univ_list_only') return route.fulfill({ json: [{ univName: '가상대학교', majors: ['예시학과'] }] });
    expect(body.type).toBe('get_calculator_access');
    return route.fulfill({ json: { success: true, contractVersion: 'jungsi-calculator-access-v1', admissionYear: 2027, access: { allowed: true, source: 'purchase' }, service: { state: 'preparing', purchaseAvailable: false } } });
  });
  await context.route('**/__input-core', async route => {
    const body = route.request().postDataJSON(); state.calls.push(body); let data;
    if (body.type === 'student_get_calculator_applications') data = { contractVersion: 'calculator-applications-v1', items: state.owner === 'student-A' ? [{ applicationId: appId, productType: 'calculator', revision: 1, applicationState: 'CLAIMED', paymentStatus: 'verified', state: 'active', accountLinked: true, accessActive: true, amount: 25000, submittedAt: '2026-11-20T00:00:00.000Z', accessEndsAt: '2027-01-07T14:59:59.999Z', paymentDueAt: null, openingAt: '2026-11-28T00:00:00+09:00' }] : [], hasMore: false, needsReview: false, accountEmailMask: null };
    else if (body.type === 'student_get_calculator_input') {
      if (state.failRead) return route.fulfill({ status: 503, json: { success: false } });
      data = structuredClone(state.saved); if (state.deferRead) await new Promise(resolve => { state.release = resolve; });
    }
    else if (body.type === 'student_save_calculator_input' || body.type === 'student_delete_calculator_input') {
      expect(body.data.applicationId).toBe(appId); expect(body.data.userId).toBeUndefined(); expect(body.data.requestId).toMatch(/^input_[0-9a-f-]{36}$/i);
      if (state.conflict || body.data.expectedRevision !== state.saved.revision) return route.fulfill({ status: 409, json: { success: false, code: 'REVISION_CONFLICT' } });
      if (state.fail) return route.fulfill({ status: 500, json: { success: false } });
      if (body.type === 'student_save_calculator_input') { expect(body.data.consented).toBe(true); expect(body.data.consentRevision).toBe(consent); state.saved = record(state.saved.revision + 1, structuredClone(body.data.input)); }
      else { expect(body.data.confirmed).toBe(true); state.saved = record(state.saved.revision + 1); }
      data = { ...structuredClone(state.saved), idempotent: false };
      if (state.deferSave) await new Promise(resolve => { state.release = resolve; });
      if (state.lostReply) return route.fulfill({ status: 500, json: { success: false } });
    } else throw new Error('Unexpected storage request ' + body.type);
    try { await route.fulfill({ json: { success: true, data } }); } catch (_) {}
  });
  await page.goto(path); return state;
}
async function scores(page) {
  for (const [title, choice] of [['국어', '화법과작문'], ['수학', '미적분'], ['탐구 1', '물리학Ⅰ'], ['탐구 2', '화학Ⅰ']]) {
    await page.getByRole('combobox', { name: `${title} 선택과목`, exact: true }).selectOption(choice);
    await page.getByRole('textbox', { name: `${title} 표준점수`, exact: true }).fill(title.startsWith('탐구') ? '65' : '130');
    await page.getByRole('textbox', { name: `${title} 백분위`, exact: true }).fill('95');
    await page.getByRole('combobox', { name: `${title} 등급`, exact: true }).selectOption('2');
  }
  await page.getByRole('combobox', { name: '영어 등급', exact: true }).selectOption('2'); await page.getByRole('combobox', { name: '한국사 등급', exact: true }).selectOption('1');
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click();
}
async function candidate(page) {
  await page.getByRole('searchbox', { name: '대학명 검색', exact: true }).fill('가상대학교'); await page.getByRole('button', { name: /가상대학교/ }).click();
  await page.getByRole('button', { name: '예시학과 후보에 추가', exact: true }).click();
}
const writes = state => state.calls.filter(x => ['student_save_calculator_input', 'student_delete_calculator_input'].includes(x.type));

test('동의와 명시 저장으로만 서버에 쓰고 재접속·새 탭에서 최신본을 직접 복원한다', async ({ page }, testInfo) => {
  const state = await setup(page); await scores(page); await candidate(page);
  await expect(save(page)).toBeDisabled(); expect(writes(state)).toHaveLength(0);
  await panel(page).getByRole('checkbox').check(); await save(page).click();
  await expect(panel(page)).toContainText('서버 저장을 완료했습니다'); expect(writes(state)).toHaveLength(1); expect(state.saved.input.targets).toEqual([{ university: '가상대학교', major: '예시학과' }]);
  await expect(panel(page)).toContainText('현재 입력과 저장본이 같습니다');
  const other = await page.context().newPage(); await other.goto(path); await expect(panel(other)).toContainText('서버 저장 1판');
  await expect(other.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('');
  other.once('dialog', dialog => dialog.accept()); await other.getByRole('button', { name: '서버 저장본 불러오기', exact: true }).click();
  await expect(other.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('130'); await expect(other.getByRole('heading', { name: /지원 후보 1/ })).toBeVisible(); await other.close();
  await page.setViewportSize({ width: 320, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('calculator-input-storage-320.png'), fullPage: true });
});
test('늦은 조회는 편집을 덮지 않고 저장 응답 중 수정은 미저장으로 남긴다', async ({ page }) => {
  const state = await setup(page, { deferRead: true }); await expect.poll(() => typeof state.release).toBe('function');
  await scores(page); await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('131'); state.deferRead = false; state.release();
  await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('131');
  await page.getByRole('button', { name: '입력 성적 확인', exact: true }).click(); await panel(page).getByRole('checkbox').check(); state.deferSave = true; state.release = null;
  await save(page).click(); await expect.poll(() => typeof state.release).toBe('function');
  await page.getByRole('textbox', { name: '국어 표준점수', exact: true }).fill('132'); state.release();
  await expect(panel(page)).toContainText('현재 입력은 수정 후 미저장'); expect(state.saved.input.scores.exam.kor.std).toBe(131);
});
test('저장 응답을 잃어도 자동 재전송하지 않고 재조회로 실제 저장 여부를 확인한다', async ({ page }) => {
  const state = await setup(page, { lostReply: true }); await scores(page); await panel(page).getByRole('checkbox').check(); await save(page).click();
  await expect(panel(page)).toContainText('자동 재전송하지 않습니다'); await expect(save(page)).toBeDisabled(); expect(writes(state)).toHaveLength(1);
  await page.getByRole('button', { name: '서버 저장 상태 다시 확인', exact: true }).click(); await expect(panel(page)).toContainText('서버 저장 1판');
  await expect(panel(page)).toContainText('현재 입력과 저장본이 같습니다'); expect(writes(state)).toHaveLength(1);
});
test('다른 기기 수정 충돌을 덮어쓰지 않고 직접 삭제는 현재 탭 초안을 유지한다', async ({ page }) => {
  const state = await setup(page); await scores(page); await panel(page).getByRole('checkbox').check(); state.conflict = true; await save(page).click();
  await expect(panel(page)).toContainText('다른 화면에서 저장 내용이 변경'); expect(state.saved.status).toBe('empty');
  state.conflict = false; await page.getByRole('button', { name: '서버 저장 상태 다시 확인', exact: true }).click(); await panel(page).getByRole('checkbox').check(); await save(page).click();
  await expect(panel(page)).toContainText('서버 저장을 완료했습니다');
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: '서버 저장 자료 삭제', exact: true }).click(); expect(state.saved.status).toBe('saved');
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '서버 저장 자료 삭제', exact: true }).click();
  await expect(panel(page)).toContainText('서버 저장 자료를 삭제했습니다'); await expect(page.getByRole('textbox', { name: '국어 표준점수', exact: true })).toHaveValue('130'); expect(state.saved.input).toBeNull();
});
test('계정 전환 후 이전 학생의 지연 저장본을 표시하지 않는다', async ({ page }) => {
  const state = await setup(page, { deferRead: true }); await expect.poll(() => typeof state.release).toBe('function'); const release = state.release;
  state.owner = 'student-B'; state.deferRead = false;
  await page.evaluate(() => { localStorage.setItem('userId', 'student-B'); window.dispatchEvent(new Event('studycrack:session-ended')); }); release();
  await expect(panel(page)).toContainText('서버 저장은 입금 승인과 계산기 이용 인증을 완료한 신청에서'); await expect(save(page)).toHaveCount(0); expect(writes(state)).toHaveLength(0);
});
test('조회 실패는 저장으로 오인하지 않고 기간 종료 후 기존 자료만 확인·삭제한다', async ({ page }) => {
  const state = await setup(page, { failRead: true }); await scores(page);
  await expect(panel(page)).toContainText('서버 저장 상태를 불러오지 못했습니다'); await expect(save(page)).toHaveCount(0); expect(writes(state)).toHaveLength(0);
  state.failRead = false; await page.getByRole('button', { name: '서버 저장 상태 다시 확인', exact: true }).click();
  await panel(page).getByRole('checkbox').check(); await save(page).click(); await expect(panel(page)).toContainText('서버 저장을 완료했습니다');
  state.saved.canSave = false; await page.getByRole('button', { name: '서버 저장 상태 다시 확인', exact: true }).click();
  await expect(panel(page)).toContainText('현재 신청 상태나 이용 기간에는 새로 저장할 수 없습니다');
  await panel(page).getByRole('checkbox').check(); await expect(save(page)).toBeDisabled();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: '서버 저장 자료 삭제', exact: true }).click();
  await expect(panel(page)).toContainText('서버 저장 자료를 삭제했습니다'); expect(writes(state).map(x => x.type)).toEqual(['student_save_calculator_input', 'student_delete_calculator_input']);
});
