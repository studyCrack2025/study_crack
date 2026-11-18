import { expect, test } from '@playwright/test';

const caseId = 'CASE_123e4567-e89b-42d3-a456-426614174000', otherCase = 'CASE_123e4567-e89b-42d3-a456-426614174009';
const sessionId = 'SESSION_123e4567-e89b-42d3-a456-426614174001';
const otherSessionId = 'SESSION_123e4567-e89b-42d3-a456-426614174009';
const message = (index, senderRole, body) => ({ messageId: `01K${String(index).padStart(23, '0')}`, sessionId, senderRole, body, createdAt: new Date().toISOString() });
const bodies = ['희망 대학의 반영 기준과 확인된 성적을 함께 살펴보고, 현재 자료로 판단하기 어려운 부분부터 정리해보겠습니다.', '지원 방향이 고민되셨겠어요. 원하는 조건과 성적을 차근차근 비교하면서, 먼저 확인해야 할 자료를 함께 정리해볼게요.'];
function fixture() { return { calls: [], messages: [message(1, 'student', '원점수를 기준으로 지원 방향을 어떻게 정하면 좋을까요?'), message(2, 'counselor', '어떤 기준을 가장 중요하게 생각하나요?'), message(3, 'student', '지역과 전공을 함께 고려하고 싶어요.')], enabled: true, complete: true, jobs: new Map(), polls: 0, sequence: 3 }; }
function session(s, selectedCase = caseId) {
  return { caseId: selectedCase, sessionId: selectedCase === otherCase ? otherSessionId : sessionId, counselorId: 'operator', status: s.preparing ? 'booked' : 'open', startAt: s.startAt || new Date(Date.now() - 60000).toISOString(), endAt: s.endAt || new Date(Date.now() + 1800000).toISOString(), serverTime: s.serverTime || new Date().toISOString(), entryAllowed: true, canCompose: !s.readOnly && !s.observer, writable: !s.readOnly && !s.observer && !s.preparing, readOnly: Boolean(s.readOnly || s.observer), observer: Boolean(s.observer), canManage: !s.observer, ...(s.omitCapability ? {} : { canSuggestReplies: s.enabled && !s.observer }), replyContextVersion: s.version || 'v1' };
}
async function enter(page, s, { desktop = false } = {}) {
  for (const row of s.messages) expect(row.messageId, '추천 fixture는 실제 26자리 메시지 ID를 사용한다').toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  if (desktop) await page.setViewportSize({ width: 1200, height: 900 });
  const css = await page.request.get('/studycrack-mobile-app/dist/studycrack-mobile.css'); expect(css.ok()).toBe(true);
  const faces = (await css.text()).match(/@font-face\s*\{[^}]*\}/g) || []; expect(faces.length).toBeGreaterThan(0);
  const fonts = faces.join('\n').replace(/url\((["']?)(\/[^)]+?)\1\)/g, (_, quote, asset) => `url("${new URL(asset, css.url())}")`);
  await page.route('https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css', route => route.fulfill({ contentType: 'text/css', body: fonts }));
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `localStorage.setItem('userRole','admin');localStorage.setItem('userId','operator');window.hasClientSession=()=>true;window.apiFetch=(_url,options)=>fetch('/__written-replies',options);` }));
  await page.route('**/__written-replies', async route => {
    const { type, data = {} } = route.request().postDataJSON(); s.calls.push({ type, data });
    let result;
    if (type === 'counselor_list_written_sessions') result = { sessions: [session(s), ...(s.twoCases ? [session(s, otherCase)] : [])] };
    else if (type === 'counselor_get_written_session') result = { session: session(s, data.caseId), note: { body: '', revision: 0 } };
    else if (type === 'counselor_list_written_messages') result = { session: session(s, data.caseId), messages: data.caseId === otherCase ? [] : s.messages.filter(row => !data.afterMessageId || row.messageId > data.afterMessageId), hasMore: false };
    else if (type === 'counselor_mark_written_read') result = { marked: true };
    else if (type === 'counselor_get_written_preparation') result = { preparation: null };
    else if (type === 'counselor_get_active_written_reply') {
      let job = [...s.jobs.values()].findLast(row => row.caseId === data.caseId && row.expectedSessionId === data.expectedSessionId && ['queued', 'running'].includes(row.status));
      if (job && job.contextVersion !== (s.version || 'v1')) { job.status = 'stale'; job = null; }
      result = { reply: job || null, retryAfterMs: job ? 110000 : s.cooldownMs || 0, reason: job ? 'running' : s.cooldownMs ? 'cooldown' : 'ready' };
    }
    else if (type === 'counselor_create_written_reply') {
      if (s.busyOnce) { s.busyOnce = false; s.cooldownMs = 3000; return route.fulfill({ status: 429, json: { success: false, code: 'REPLY_BUSY' } }); }
      const jobId = `REPLY_${String(s.jobs.size + 1).padStart(64, 'a')}`;
      const job = { jobId, status: 'queued', caseId: data.caseId, expectedSessionId: data.expectedSessionId, contextVersion: s.version || 'v1', startMessageId: data.startMessageId, endMessageId: data.endMessageId, messageCount: s.messages.filter(row => row.messageId >= data.startMessageId && row.messageId <= data.endMessageId).length };
      s.jobs.set(jobId, job); result = { reply: job };
    } else if (type === 'counselor_get_written_reply') {
      s.polls++;
      if (s.denied) return route.fulfill({ status: 403, json: { success: false, code: 'FORBIDDEN' } });
      const job = s.jobs.get(data.jobId);
      const status = ['cancelled', 'stale', 'failed'].includes(job.status) ? job.status : s.terminal || (s.complete ? 'succeeded' : 'running');
      Object.assign(job, { status, ...(status === 'succeeded' ? { drafts: bodies.map((body, i) => ({ style: i ? 'empathic' : 'core', body, sourceRefs: ['M01', 'S1'] })), checks: ['공식 모집요강에서 반영 기준을 확인해주세요.'] } : {}), ...(status === 'failed' && s.failureCode ? { resultCode: s.failureCode } : {}) });
      result = { reply: job };
    } else if (type === 'counselor_cancel_written_reply') { const job = s.jobs.get(data.jobId); job.status = 'cancelled'; result = { reply: job }; }
    else if (type === 'counselor_send_written_message') {
      const row = { ...message(++s.sequence, 'counselor', data.body), clientMessageId: data.clientMessageId }; s.messages.push(row); result = { message: row };
    } else throw new Error(`Unexpected written reply fixture request: ${type}`);
    await route.fulfill({ json: { success: true, data: result } }).catch(() => {});
  });
  await page.goto(`/2027-jungsi-consulting/written-session?caseId=${caseId}`);
  await expect(page.getByRole('heading', { name: '서면상담', exact: true })).toBeVisible();
  await expect(page.getByRole('log')).toContainText('원점수를 기준');
}
const panel = page => page.getByRole('region', { name: '답변 추천', exact: true });
const sent = s => s.calls.filter(call => call.type === 'counselor_send_written_message');
async function recent(page) { await page.getByRole('button', { name: '답변 추천', exact: true }).click(); await panel(page).getByRole('button', { name: '최근 학생 질문 선택' }).click(); }
async function generate(page) { await panel(page).getByRole('button', { name: '추천답변 생성', exact: true }).click(); }

test('모바일에서 연속 범위를 선택해 두 초안을 검토하고, 명시적으로 가져온 뒤에만 전송한다', async ({ page }, testInfo) => {
  const s = fixture(); await page.setViewportSize({ width: 320, height: 740 }); await enter(page, s);
  await page.getByRole('button', { name: '대화를 선택해 답변 추천' }).click();
  await page.getByRole('button', { name: '1번째 메시지를 범위 시작으로 선택' }).click();
  await page.getByRole('button', { name: '2번째 메시지를 범위 끝으로 선택' }).click();
  expect(s.calls.filter(call => call.type === 'counselor_create_written_reply')).toHaveLength(0);
  await page.getByRole('button', { name: '선택 범위로 추천' }).click();
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: '공감·설명형' })).toBeVisible();
  expect(s.calls.find(call => call.type === 'counselor_create_written_reply').data).toMatchObject({ startMessageId: s.messages[0].messageId, endMessageId: s.messages[1].messageId, expectedSessionId: sessionId });
  expect(sent(s)).toHaveLength(0);
  await panel(page).getByRole('button', { name: '이 답변을 입력창으로' }).first().click();
  const composer = page.getByLabel('상담 메시지', { exact: true }); await expect(composer).toHaveValue(bodies[0]);
  expect(sent(s)).toHaveLength(0);
  await composer.fill(bodies[0] + ' 제가 확인한 내용도 함께 안내할게요.');
  await page.getByRole('button', { name: '전송', exact: true }).click(); await expect(composer).toHaveValue('');
  await expect.poll(() => sent(s).length).toBe(1); expect(sent(s)[0].data.body).toContain('제가 확인한 내용');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('reply-mobile-320.png'), fullPage: true });
});
test('대기 중 수동 작성은 유지되고 기존 글에 이어 붙이기와 바꾸기는 따로 선택한다', async ({ page }) => {
  const s = fixture(); s.complete = false; await enter(page, s, { desktop: true });
  const composer = page.getByLabel('상담 메시지', { exact: true }); await composer.fill('작성하던 답변');
  await panel(page).getByRole('button', { name: '최근 학생 질문 선택' }).click(); await generate(page);
  await expect(panel(page)).toContainText('두 가지 답변을 준비');
  await composer.fill('대기 중에도 수정한 최신 답변'); s.complete = true;
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toBeVisible();
  await expect(composer).toHaveValue('대기 중에도 수정한 최신 답변');
  await panel(page).getByRole('button', { name: '이 답변을 입력창으로' }).first().click();
  await expect(composer).toHaveValue('대기 중에도 수정한 최신 답변');
  await panel(page).getByRole('button', { name: '그대로 두기' }).click();
  await panel(page).getByRole('button', { name: '이 답변을 입력창으로' }).first().click();
  await panel(page).getByRole('button', { name: '뒤에 이어 붙이기' }).click();
  await expect(composer).toHaveValue('대기 중에도 수정한 최신 답변\n\n' + bodies[0]);
  await panel(page).getByRole('button', { name: '이 답변을 입력창으로' }).last().click();
  await panel(page).getByRole('button', { name: '작성 내용 바꾸기' }).click();
  await expect(composer).toHaveValue(bodies[1]); expect(sent(s)).toHaveLength(0);
});
test('새 메시지는 범위를 바꾸지 않고 알림만 표시하며 최신 조사서 변경은 추천을 지운다', async ({ page }) => {
  const s = fixture(); await enter(page, s, { desktop: true });
  await panel(page).getByRole('button', { name: '최근 학생 질문 선택' }).click(); await generate(page);
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toBeVisible();
  const chosen = s.calls.find(call => call.type === 'counselor_create_written_reply').data.endMessageId;
  s.messages.push(message(++s.sequence, 'student', '추가로 통학 조건도 확인해주세요.'));
  await expect(panel(page)).toContainText('선택 이후 새 대화 있음', { timeout: 12000 });
  expect(s.calls.filter(call => call.type === 'counselor_create_written_reply')).toHaveLength(1);
  expect(s.calls.find(call => call.type === 'counselor_create_written_reply').data.endMessageId).toBe(chosen);
  s.version = 'v2';
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toHaveCount(0, { timeout: 12000 });
  expect(sent(s)).toHaveLength(0);
});
test('취소와 권한 거절은 추천을 끝내며 초안은 전송하지 않는다', async ({ page }) => {
  const s = fixture(); s.complete = false; await enter(page, s); await recent(page); await generate(page);
  await panel(page).getByRole('button', { name: '추천 생성 취소' }).click();
  await expect(panel(page)).toContainText('추천 생성을 취소했습니다.');
  await expect.poll(() => s.calls.filter(call => call.type === 'counselor_cancel_written_reply').length).toBe(1);
  s.denied = true; await generate(page);
  await expect(panel(page).getByRole('button', { name: '추천 생성 취소' })).toHaveCount(0);
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toHaveCount(0);
  expect(sent(s)).toHaveLength(0);
});
test('상담 전환 중 이전 학생의 진행 작업과 결과를 정리한다', async ({ page }) => {
  const s = fixture(); s.complete = false; s.twoCases = true; await enter(page, s); await recent(page); await generate(page);
  const chooseSession = page.getByRole('combobox', { name: '상담 선택', exact: true });
  await expect(chooseSession).toBeVisible();
  await expect(chooseSession.locator('option')).toHaveCount(2);
  await expect(chooseSession).toHaveValue(caseId);
  await chooseSession.selectOption(otherCase);
  await expect(chooseSession).toHaveValue(otherCase);
  await expect.poll(() => new URL(page.url()).searchParams.get('caseId')).toBe(otherCase);
  s.complete = true;
  await expect(page.getByRole('heading', { name: '서면상담', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '답변 추천', exact: true }).click();
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toHaveCount(0);
  await expect.poll(() => s.calls.filter(call => call.type === 'counselor_cancel_written_reply').length).toBe(1);
  expect(s.calls.find(call => call.type === 'counselor_cancel_written_reply').data).toMatchObject({ caseId, expectedSessionId: sessionId });
  expect(sent(s)).toHaveLength(0);
});
test('2분 종료 이후 대기를 계속하지 않고 작성과 수동 전송은 가능하다', async ({ page }) => {
  await page.clock.install(); const s = fixture(); s.complete = false; await enter(page, s); await recent(page); await generate(page);
  await expect.poll(() => s.calls.filter(call => call.type === 'counselor_create_written_reply').length).toBe(1);
  await page.clock.fastForward(120001);
  await expect(panel(page)).toContainText('대기 시간이 끝났습니다.');
  await expect(panel(page).getByRole('button', { name: '추천 생성 취소' })).toHaveCount(0);
  await page.getByRole('button', { name: '대화', exact: true }).click();
  await page.getByLabel('상담 메시지', { exact: true }).fill('추천 없이 직접 작성한 답변');
  await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect.poll(() => sent(s).length).toBe(1);
});
test('추천 연결이 준비되지 않아도 진입점과 패널은 유지하고 생성은 제한한다', async ({ page }) => {
  const s = fixture(); s.enabled = false; await enter(page, s);
  await expect(page.getByRole('button', { name: '답변 추천', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '대화를 선택해 답변 추천' })).toBeDisabled();
  await page.getByRole('button', { name: '답변 추천', exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toContainText('AI 추천 연결이 활성화되지 않았습니다.');
  await expect(panel(page).getByRole('button', { name: '추천답변 생성', exact: true })).toBeDisabled();
  await expect(panel(page).getByRole('button', { name: '최근 학생 질문 선택' })).toBeDisabled();
  expect(s.calls.filter(call => call.type.includes('written_reply'))).toHaveLength(0);
  s.enabled = true;
  await panel(page).getByRole('button', { name: '추천 연결 다시 확인' }).click();
  await expect(panel(page).getByRole('button', { name: '최근 학생 질문 선택' })).toBeEnabled();
  await panel(page).getByRole('button', { name: '최근 학생 질문 선택' }).click(); await generate(page);
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: '공감·설명형' })).toBeVisible();
  expect(s.calls.filter(call => call.type === 'counselor_create_written_reply')).toHaveLength(1);
  expect(sent(s)).toHaveLength(0);
});

test('서버 활성화 응답이 누락되어도 추천 탭을 지우지 않고 확인 경로를 제공한다', async ({ page }) => {
  const s = fixture(); s.omitCapability = true; await enter(page, s);
  await page.getByRole('button', { name: '답변 추천', exact: true }).click();
  await expect(panel(page)).toContainText('AI 추천 연결이 활성화되지 않았습니다.');
  await expect(panel(page).getByRole('button', { name: '추천 연결 다시 확인' })).toBeVisible();
  await expect(panel(page).getByRole('button', { name: '추천답변 생성', exact: true })).toBeDisabled();
  expect(s.calls.filter(call => call.type.includes('written_reply'))).toHaveLength(0);
  expect(sent(s)).toHaveLength(0);
});

test('읽기 전용이나 검수 상담도 추천 불가 사유를 표시하고 생성·전송하지 않는다', async ({ page }) => {
  const s = fixture(); s.readOnly = true; await enter(page, s);
  await expect(page.getByLabel('상담 메시지', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '답변 추천', exact: true }).click();
  await expect(panel(page)).toContainText('상담 시작 10분 전부터');
  await expect(panel(page).getByRole('button', { name: '추천답변 생성', exact: true })).toBeDisabled();
  s.readOnly = false; s.observer = true; await page.reload();
  await page.getByRole('button', { name: '답변 추천', exact: true }).click();
  await expect(panel(page)).toContainText('배정된 상담 담당자만');
  await expect(panel(page).getByRole('button', { name: '추천답변 생성', exact: true })).toBeDisabled();
  expect(s.calls.filter(call => call.type.includes('written_reply'))).toHaveLength(0);
  expect(sent(s)).toHaveLength(0);
});

test('새로고침 뒤 진행 중인 같은 상담 추천을 이어 확인하고 작업을 중복 생성하지 않는다', async ({ page }) => {
  const s = fixture(); s.complete = false; await enter(page, s); await recent(page); await generate(page);
  await expect(panel(page).getByRole('button', { name: '추천 생성 취소' })).toBeVisible();
  const created = s.calls.find(call => call.type === 'counselor_create_written_reply').data;
  await page.reload(); await page.getByRole('button', { name: '답변 추천', exact: true }).click();
  await expect(panel(page).getByRole('button', { name: '추천 생성 취소' })).toBeVisible();
  expect(s.calls.filter(call => call.type === 'counselor_get_active_written_reply')).toHaveLength(2);
  expect(s.calls.filter(call => call.type === 'counselor_cancel_written_reply')).toHaveLength(0);
  await expect(panel(page)).toContainText('지역과 전공을 함께 고려하고 싶어요.');
  expect(s.calls.filter(call => call.type === 'counselor_create_written_reply')).toHaveLength(1);
  expect(s.jobs.size).toBe(1);
  s.complete = true;
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toBeVisible();
  expect(s.calls.filter(call => call.type === 'counselor_get_written_reply').every(call => call.data.jobId === [...s.jobs.keys()][0])).toBe(true);
  expect(s.calls.filter(call => call.type === 'counselor_get_written_reply').every(call => call.data.expectedSessionId === created.expectedSessionId)).toBe(true);
  expect(sent(s)).toHaveLength(0);
});

test('재요청 간격 제한은 남은 시간을 표시하고 연타를 막으며 시간이 지나면 직접 재시도한다', async ({ page }) => {
  await page.clock.install(); const s = fixture(); s.busyOnce = true; await enter(page, s, { desktop: true });
  await panel(page).getByRole('button', { name: '최근 학생 질문 선택' }).click(); await generate(page);
  await expect(panel(page).getByRole('button', { name: /초 뒤 추천 가능/ })).toBeDisabled();
  expect(s.calls.filter(call => call.type === 'counselor_create_written_reply')).toHaveLength(1);
  await page.clock.fastForward(3001); s.cooldownMs = 0;
  await expect(panel(page).getByRole('button', { name: '추천답변 생성', exact: true })).toBeEnabled();
  await generate(page); await page.clock.fastForward(1001);
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toBeVisible();
  expect(s.jobs.size).toBe(1); expect(sent(s)).toHaveLength(0);
});

test('추천 실패는 작업 잠금 안내 대신 서버가 확인한 원인을 표시한다', async ({ page }) => {
  const s = fixture(); s.terminal = 'failed'; s.failureCode = 'REPLY_SECRET_INVALID';
  await enter(page, s, { desktop: true }); await panel(page).getByRole('button', { name: '최근 학생 질문 선택' }).click(); await generate(page);
  await expect(panel(page)).toContainText('AI 연결 설정 형식을 확인해야 합니다.');
  await expect(panel(page)).not.toContainText('진행 중인 추천을 기다리거나');
  expect(sent(s)).toHaveLength(0);
});

test('관리자는 사전 질문으로 추천을 받아 초안을 준비하지만 예약 시각 이후 명시적으로만 전송한다', async ({ page }) => {
  await page.clock.install();
  const s = fixture(); s.preparing = true; s.startAt = new Date(Date.now() + 600000).toISOString(); s.endAt = new Date(Date.parse(s.startAt) + 1800000).toISOString();
  s.messages = s.messages.filter(row => row.senderRole === 'student');
  await enter(page, s, { desktop: true });
  await expect(page.locator('.consulting-written-meta')).toContainText('상담 준비 중');
  const input = page.getByLabel('상담 메시지', { exact: true }), send = page.getByRole('button', { name: '전송', exact: true });
  await expect(input).toBeEnabled(); await expect(send).toBeDisabled();
  await input.fill('미리 작성하는 답변'); await input.press('Enter');
  await expect(input).toHaveValue('미리 작성하는 답변'); expect(sent(s)).toHaveLength(0);
  await input.fill('');
  await panel(page).getByRole('button', { name: '최근 학생 질문 선택' }).click(); await generate(page);
  await expect(panel(page).getByRole('heading', { name: '핵심 전달형' })).toBeVisible();
  await expect(panel(page).getByRole('heading', { name: '공감·설명형' })).toBeVisible();
  await panel(page).getByRole('button', { name: '이 답변을 입력창으로' }).first().click();
  await expect(input).toHaveValue(bodies[0]); await input.press('Enter');
  await expect(input).toHaveValue(bodies[0]); await expect(send).toBeDisabled(); expect(sent(s)).toHaveLength(0);
  s.preparing = false; s.serverTime = s.startAt;
  await page.clock.fastForward(1001); await expect(send).toBeEnabled();
  await expect(input).toHaveValue(bodies[0]); expect(sent(s)).toHaveLength(0);
  await input.press('Enter'); await expect(input).toHaveValue('');
  await expect.poll(() => sent(s).length).toBe(1); expect(sent(s)[0].data.body).toBe(bodies[0]);
  expect(s.calls.filter(call => call.type === 'counselor_create_written_reply')).toHaveLength(1);
});
