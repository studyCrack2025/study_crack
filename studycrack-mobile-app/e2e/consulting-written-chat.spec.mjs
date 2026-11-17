import { expect, test } from '@playwright/test';

const caseId = 'CASE_123e4567-e89b-42d3-a456-426614174000';
const fileId = 'FILE_123e4567-e89b-42d3-a456-426614174002';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD9sAAAAASUVORK5CYII=', 'base64');
function fixture() { return { messages: [], calls: [], files: {}, sequence: 0, phase: 'open', failSend: false, denied: false, sentRead: {}, photoState: 'ready' }; }
function session(s, role, selectedCase = caseId) {
  return { caseId: selectedCase, sessionId: 'SESSION_123e4567-e89b-42d3-a456-426614174001', counselorId: 'operator', status: s.phase === 'completed' ? 'completed' : 'open',
    serverTime: new Date().toISOString(), startAt: new Date(Date.now() - 3600000).toISOString(), endAt: new Date(Date.now() - 60000).toISOString(),
    entryAllowed: s.phase !== 'before', writable: s.phase === 'open' && role !== 'observer', serviceHold: s.phase === 'held', readOnly: ['completed', 'held'].includes(s.phase) || role === 'observer', observer: role === 'observer', canManage: role === 'manager',
    otherReadThroughId: s.sentRead[role === 'student' ? 'manager' : 'student'] || null, ...s.sessionTimes };
}
async function install(page, role, s) {
  const cssResponse = await page.request.get('/studycrack-mobile-app/dist/studycrack-mobile.css');
  expect(cssResponse.ok()).toBe(true);
  const rules = (await cssResponse.text()).match(/@font-face\s*\{[^}]*\}/g) || [];
  expect(rules.length).toBeGreaterThan(0);
  const fonts = rules.join('\n').replace(/url\((["']?)(\/[^)]+?)\1\)/g, (_, quote, asset) => `url("${new URL(asset, cssResponse.url())}")`);
  await page.route('https://cdn.jsdelivr.net/gh/fonts-archive/Paperlogy/subsets/Paperlogy-dynamic-subset.css', route => route.fulfill({ contentType: 'text/css', body: fonts }));
  await page.route('**/js/shared/api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    localStorage.setItem('userRole', '${role === 'student' ? 'student' : 'admin'}');localStorage.setItem('userId','${role === 'student' ? 'student' : 'operator'}');
    window.hasClientSession=()=>true;window.apiFetch=(_url,options)=>fetch('/__written-fixture',options);
  ` }));
  await page.route('**/__written-fixture', async route => {
    const request = route.request().postDataJSON(), { type, data = {} } = request; s.calls.push({ role, type, data });
    let result = {}, status = 200;
    if (s.denied && type.endsWith('list_written_messages')) return route.fulfill({ status: 403, json: { success: false, code: 'FORBIDDEN' } });
    if (type === 'counselor_list_written_sessions') result = { sessions: [session(s, role), ...(s.secondCase ? [session(s, role, s.secondCase)] : [])] };
    else if (type.endsWith('get_written_session')) result = { session: session(s, role, data.caseId || caseId), note: { body: '학생에게 보이지 않는 메모', revision: 0 } };
    else if (type.endsWith('list_written_messages')) { if (s.holdCase && s.holdCase === data.caseId) await new Promise(resolve => { s.releaseReply = resolve; }); const messages = s.messages.filter(item => (!item.caseId || item.caseId === (data.caseId || caseId)) && (!data.afterMessageId || item.messageId > data.afterMessageId)); result = { messages, nextCursor: messages.at(-1)?.messageId || data.afterMessageId || null, hasMore: false, session: session(s, role, data.caseId || caseId) }; }
    else if (type.endsWith('send_written_message')) {
      let message = s.messages.find(item => item.clientMessageId === data.clientMessageId);
      if (!message) { message = { messageId: '01K00000000000000000' + String(++s.sequence).padStart(7, '0'), sessionId: session(s, role).sessionId, senderRole: role === 'student' ? 'student' : 'counselor', body: data.body, createdAt: new Date().toISOString(), clientMessageId: data.clientMessageId, ...(data.attachmentIds?.length ? { attachments: data.attachmentIds.map(id => s.files[id]) } : {}) }; s.messages.push(message); }
      if (s.failSend) { s.failSend = false; status = 500; } result = { message };
    } else if (type.endsWith('mark_written_read')) { s.sentRead[role] = data.throughMessageId; result = { marked: true }; }
    else if (type === 'counselor_get_written_preparation') result = { preparation: { scores: { records: [{ subject: '영어', grade: 2 }] }, conditions: { repeatStudyAllowed: true }, qualitative: { consultationQuestions: ['가군 지원 조합을 비교해주세요.'] } } };
    else if (type === 'counselor_save_session_note') result = { revision: 1 };
    else if (type === 'counselor_complete_written_session') { s.phase = 'completed'; result = { transcriptHash: 'sha256:synthetic' }; }
    else if (type === 'consulting_create_written_photo_upload') {
      s.files[fileId] = { fileId, displayName: data.fileName, contentType: 'image/jpeg', status: 'upload_pending', width: 1, height: 1, size: png.length };
      result = { ...s.files[fileId], uploadUrl: 'https://study-crack-uploads.s3.ap-northeast-2.amazonaws.com/', fields: { key: `consulting/${caseId}/written/${session(s, role).sessionId}/${fileId}.jpg` } };
    } else if (type === 'consulting_complete_written_photo_upload' || type === 'consulting_get_written_photo') { s.files[fileId].status = s.photoState; result = s.files[fileId]; }
    else if (type === 'consulting_get_written_photo_url') result = { fileId, url: `https://study-crack-uploads.s3.ap-northeast-2.amazonaws.com/consulting/${caseId}/written/${session(s, role).sessionId}/${fileId}.prepared.jpg?signature=synthetic` };
    else if (type === 'consulting_delete_written_photo') result = { fileId, status: 'deleting' };
    else throw new Error('Unexpected fixture request: ' + type);
    await route.fulfill({ status, json: status === 200 ? { success: true, data: result } : { success: false, code: 'INTERNAL_SERVER_ERROR' } }).catch(() => {});
  });
  await page.route('https://study-crack-uploads.s3.ap-northeast-2.amazonaws.com/**', route => route.request().method() === 'POST' ? route.fulfill({ status: 204 }) : route.fulfill({ contentType: 'image/png', body: png }));
}
async function enter(page, role, state) { await install(page, role, state); await page.goto(`/2027-jungsi-consulting/written-session${role === 'student' ? '' : '?caseId=' + caseId}`); await expect(page.getByRole('heading', { name: '서면상담', exact: true })).toBeVisible(); }
async function send(page, body) { await page.getByLabel('상담 메시지', { exact: true }).fill(body); await page.getByRole('button', { name: '전송', exact: true }).click(); }
async function fits(page) { expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true); }

test('학생 상담 시간과 입장 대기 시각을 한국시간 24시간제로 통일한다', async ({ page }, testInfo) => {
  const s = fixture(); s.phase = 'before';
  s.sessionTimes = { startAt: '2026-11-17T08:00:00.000Z', endAt: '2026-11-17T08:30:00.000Z', entryAt: '2026-11-17T07:50:00.000Z' };
  await page.setViewportSize({ width: 320, height: 900 }); await enter(page, 'student', s);
  await expect(page.locator('.consulting-written-meta p')).toHaveText('11월 17일 17:00 ~ 17:30 · 한국시간');
  await expect(page.getByText('11월 17일 16:50부터 입장할 수 있어요.')).toBeVisible();
  await expect(page.locator('.consulting-written-meta')).not.toContainText(/오전|오후/);
  await fits(page); await page.screenshot({ path: testInfo.outputPath('written-waiting-24-hour-320.png'), fullPage: true });
});

test('학생과 담당자 대화·실제 읽음·비공개 메모·완료가 연결되고 모바일 탭이 분리된다', async ({ page, browser }, testInfo) => {
  const s = fixture(), managerContext = await browser.newContext({ viewport: page.viewportSize() }), manager = await managerContext.newPage();
  await enter(page, 'student', s); await enter(manager, 'manager', s);
  await page.bringToFront(); await send(page, '<script>실행되지 않는 질문</script>'); await manager.bringToFront();
  await expect(manager.getByRole('log')).toContainText('실행되지 않는 질문', { timeout: 12000 });
  await send(manager, '가·나·다군 조합을 같이 살펴볼게요.'); await page.bringToFront();
  await expect(page.getByRole('log')).toContainText('가·나·다군 조합', { timeout: 12000 });
  await expect(page.getByRole('log')).toContainText('읽음', { timeout: 12000 });
  await expect(page.getByText('학생에게 보이지 않는 메모')).toHaveCount(0);
  await manager.bringToFront(); await manager.getByRole('button', { name: '자료', exact: true }).click();
  await expect(manager.getByRole('heading', { name: '상담 자료' })).toBeVisible();
  await expect(manager.getByText('가군 지원 조합을 비교해주세요.')).toBeVisible();
  await manager.getByRole('button', { name: '메모', exact: true }).click();
  await expect(manager.getByLabel('내부 메모')).toHaveValue('학생에게 보이지 않는 메모');
  for (const label of ['추가 질문에 답변함', '성적·지원 조건을 확인함', '보고서 반영 사항을 정리함']) await manager.getByLabel(label).check();
  await manager.getByRole('button', { name: '상담 완료 및 기록 고정' }).click();
  await expect(manager.getByRole('link', { name: '보고서 반영 내용 정리하기 →' })).toBeVisible();
  await page.bringToFront(); await expect(page.getByText('상담을 마쳤어요', { exact: true })).toBeVisible({ timeout: 12000 });
  await expect(page.getByLabel('상담 메시지', { exact: true })).toBeDisabled();
  await fits(page); await fits(manager); await manager.screenshot({ path: testInfo.outputPath('written-manager-completed.png'), fullPage: true }); await managerContext.close();
});

test('입장 대기가 새로고침 없이 열리고 중복 전송 응답 손실도 같은 요청으로 복구된다', async ({ page }) => {
  const s = fixture(); s.phase = 'before'; await enter(page, 'student', s);
  await expect(page.getByText('상담을 준비하고 있어요')).toBeVisible(); s.phase = 'open';
  await expect(page.getByLabel('상담 메시지', { exact: true })).toBeEnabled({ timeout: 12000 });
  s.failSend = true; await send(page, '응답 유실 실험');
  await expect(page.getByRole('button', { name: '다시 보내기', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다시 보내기', exact: true }).click();
  await expect(page.getByRole('button', { name: '다시 보내기', exact: true })).toHaveCount(0);
  expect(s.messages.filter(item => item.body === '응답 유실 실험')).toHaveLength(1);
  const attempts = s.calls.filter(item => item.type === 'student_send_written_message'); expect(attempts).toHaveLength(2); expect(attempts[0].data).toEqual(attempts[1].data);
});

test('사진은 자동 검사 후 파일명이 표시되고 사진만 전송·확대할 수 있다', async ({ page }, testInfo) => {
  const s = fixture(); await page.setViewportSize({ width: 320, height: 650 }); await enter(page, 'student', s);
  await page.getByLabel('상담 사진 선택').setInputFiles({ name: '확인할 성적 사진.jpeg', mimeType: 'image/jpeg', buffer: png });
  await expect(page.locator('.consulting-chat-uploads')).toContainText('확인할 성적 사진.jpeg');
  await expect(page.locator('.consulting-chat-uploads')).toContainText('전송 가능');
  await page.getByRole('button', { name: '전송', exact: true }).click();
  const photo = page.getByRole('button', { name: '확인할 성적 사진.jpeg 크게 보기' }); await expect(photo).toBeVisible(); await photo.click();
  await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button', { name: '사진 닫기' }).click();
  expect(s.messages[0].body).toBe(''); expect(s.messages[0].attachments[0].fileId).toBe(fileId);
  await fits(page); await page.screenshot({ path: testInfo.outputPath('written-student-photo-320.png'), fullPage: true });
});

test('검사 대기·거절 사진은 전송을 막고 취소 후 글만 보낼 수 있다', async ({ page }) => {
  const s = fixture(); s.photoState = 'quarantined'; await enter(page, 'student', s);
  await page.getByLabel('상담 사진 선택').setInputFiles({ name: '사진.jpg', mimeType: 'image/jpeg', buffer: png });
  await expect(page.locator('.consulting-chat-uploads')).toContainText('보안 확인 중');
  await page.getByLabel('상담 메시지', { exact: true }).fill('글은 작성 가능'); await expect(page.getByRole('button', { name: '전송', exact: true })).toBeDisabled();
  s.photoState = 'rejected'; await expect(page.locator('.consulting-chat-uploads')).toContainText('안전하게 열 수 없는 사진', { timeout: 8000 });
  await page.getByRole('button', { name: '첨부 취소' }).click(); await page.getByRole('button', { name: '전송', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('글은 작성 가능'); expect(s.calls.some(call => call.type === 'consulting_delete_written_photo')).toBe(true);
});

test('다른 운영진은 읽기 전용이고 영구 권한 오류는 반복 호출하지 않는다', async ({ page }) => {
  const s = fixture(); await enter(page, 'observer', s);
  await expect(page.getByText('운영진 검수 · 읽기 전용')).toBeVisible(); await expect(page.getByLabel('상담 메시지', { exact: true })).toBeDisabled();
  s.denied = true; await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await expect(page.getByText('접근 권한 확인 필요', { exact: true })).toBeVisible({ timeout: 12000 });
  const count = s.calls.filter(call => call.type === 'counselor_list_written_messages').length;
  await page.waitForTimeout(5500); expect(s.calls.filter(call => call.type === 'counselor_list_written_messages')).toHaveLength(count);
  expect(s.calls.some(call => call.type === 'counselor_mark_written_read')).toBe(false);
});

test('이전 대화를 읽을 때 스크롤을 유지하고 새 메시지 버튼으로 이동한다', async ({ page }, testInfo) => {
  const s = fixture();
  for (let index = 0; index < 35; index++) s.messages.push({ messageId: '01K00000000000000000' + String(++s.sequence).padStart(7, '0'), senderRole: 'counselor', body: '상담 기록 ' + index + '\n대화 기록을 위로 올려서 읽고 있습니다.', createdAt: new Date().toISOString(), clientMessageId: 'old-' + index });
  await page.setViewportSize({ width: 1200, height: 820 }); await enter(page, 'student', s); await expect(page.getByRole('log')).toContainText('상담 기록 34');
  await page.getByRole('log').evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });
  s.messages.push({ messageId: '01K00000000000000000' + String(++s.sequence).padStart(7, '0'), senderRole: 'counselor', body: '새로 도착한 답변', createdAt: new Date().toISOString(), clientMessageId: 'latest' });
  await expect(page.getByRole('button', { name: '새 메시지 1개 ↓' })).toBeVisible({ timeout: 12000 });
  expect(await page.getByRole('log').evaluate(node => node.scrollTop)).toBeLessThan(20);
  await page.getByRole('button', { name: '새 메시지 1개 ↓' }).click();
  await expect.poll(() => page.getByRole('log').evaluate(node => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThan(75);
  await fits(page); await page.screenshot({ path: testInfo.outputPath('written-desktop-history.png'), fullPage: true });
});

test('키보드에 가까운 낮은 화면에서도 입력과 전송이 가려지지 않는다', async ({ page }, testInfo) => {
  const s = fixture(); await page.setViewportSize({ width: 375, height: 430 }); await enter(page, 'student', s);
  const input = page.getByLabel('상담 메시지', { exact: true }); await input.fill('낮은 화면에서 전송');
  const sendButton = page.getByRole('button', { name: '전송', exact: true });
  const box = await sendButton.boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(430); await sendButton.click();
  await expect(page.getByRole('log')).toContainText('낮은 화면에서 전송'); await fits(page); await page.screenshot({ path: testInfo.outputPath('written-low-viewport.png'), fullPage: true });
});

test('학생을 바꾸면 초안과 늦게 도착한 이전 대화가 새 상담에 섞이지 않는다', async ({ page }) => {
  const s = fixture(); s.secondCase = 'CASE_123e4567-e89b-42d3-a456-426614174099'; s.holdCase = caseId;
  s.messages.push({ caseId, messageId: '01K00000000000000000000001', senderRole: 'student', body: '이전 학생의 늦은 답변', createdAt: new Date().toISOString() });
  await enter(page, 'manager', s);
  await expect.poll(() => Boolean(s.releaseReply)).toBe(true);
  await page.getByLabel('상담 메시지', { exact: true }).fill('이전 학생용 초안');
  page.once('dialog', dialog => dialog.accept()); await page.getByLabel('상담 선택').selectOption(s.secondCase);
  await expect(page.getByLabel('상담 메시지', { exact: true })).toHaveValue('');
  s.releaseReply();
  await expect(page.getByRole('log')).not.toContainText('이전 학생의 늦은 답변');
  expect(s.calls.some(call => call.type === 'counselor_send_written_message')).toBe(false);
});


test('서비스 보류 중에는 대화와 내부 메모·완료 모두 읽기 전용이다', async ({ page }) => {
  const s = fixture(); s.phase = 'held'; await enter(page, 'manager', s);
  await expect(page.getByLabel('상담 메시지', { exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '메모', exact: true }).click();
  await expect(page.getByLabel('내부 메모')).toBeDisabled();
  await expect(page.getByRole('button', { name: '상담 완료 및 기록 고정' })).toBeDisabled();
});
