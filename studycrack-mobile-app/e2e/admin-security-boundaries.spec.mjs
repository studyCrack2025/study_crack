import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const source = async path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const payload = "');window.__unsafeNameExecuted=true;// <img src=x onerror=window.__unsafeNameExecuted=true>";

async function prepare(page, html) {
  await page.route('**/*', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('/');
  await page.setContent(html);
  await page.addStyleTag({ content: 'button { min-width: 24px; min-height: 24px; }' });
  await page.addScriptTag({ content: await source('js/shared/utils.js') });
  await page.evaluate(() => {
    window.__calls = [];
    window.__unsafeNameExecuted = false;
    window.CONFIG = { api: { admin: '/synthetic/admin', noti: '/synthetic/noti', qna: '/synthetic/qna' } };
    window.ADMIN_API_URL = '/synthetic/admin';
    window.Store = { set() {} };
    localStorage.setItem('userId', 'synthetic-user');
  });
}
async function safe(page) {
  expect(await page.evaluate(() => window.__unsafeNameExecuted)).toBe(false);
}

for (const version of [1, 2]) test(`주간 리포트 V${version} 저장값과 파일명은 HTML로 실행되지 않는다`, async ({ page }) => {
  await prepare(page, '<div id="weeklyListContainer"></div>');
  await page.evaluate(({ value, version }) => {
    window.currentWeeklyData = [{ weekId: '260901', date: '2026-09-01', formVersion: version,
      studyTime: { totalRate: value, details: [{ subject: value, plan: value, act: value }] },
      weeklyAvailableTime: { mon: value }, bestPart: value,
      deepAnswers: [value], trend: { status: 'keep" onclick="window.__unsafeNameExecuted=true' },
      mockExam: { type: 'edu" onclick="window.__unsafeNameExecuted=true', scores: { kor: value, inq1: value, inq1Name: value }, proofFile: 'javascript:window.__unsafeNameExecuted=true' },
      plannerFiles: ['javascript:window.__unsafeNameExecuted=true', `https://files.example.invalid/${encodeURIComponent(value)}.pdf`, 'https://files.example.invalid/%ZZ.pdf'],
      tutorFeedback: { tutorComment: value, tutorImage: 'data:text/html,unsafe', submitted: true } }];
    localStorage.setItem('userRole', 'admin');
  }, { value: payload, version });
  await page.addScriptTag({ content: await source('js/admin/weekly.js') });
  await page.evaluate(() => renderWeeklyTab());
  await expect(page.locator('#weeklyListContainer')).toContainText(payload);
  expect(await page.locator('#weeklyListContainer img, #weeklyListContainer [onerror], #weeklyListContainer [onclick]').count()).toBe(0);
  for (const href of await page.locator('#weeklyListContainer a').evaluateAll(nodes => nodes.map(node => node.href))) expect(href).toMatch(/^https:\/\/files\.example\.invalid\//);
  if (version === 1) await expect(page.locator('.file-chip')).toHaveCount(2);
  await safe(page);
});

test('주간 피드백의 정상 임시 저장 버튼은 유지하고 악성 필드·식별자는 편집 코드에 넣지 않는다', async ({ page }) => {
  await prepare(page, '<div id="fixture"></div>');
  await page.addScriptTag({ content: await source('js/admin/weekly.js') });
  await page.evaluate(value => {
    document.getElementById('fixture').innerHTML = createWeeklyFbInput('260901', { weeklyPlanner: value, [value]: value }, 2);
    window.tempSaveWeeklyField = (...args) => window.__calls.push(args);
  }, payload);
  await expect(page.locator('#wfb_260901_weeklyPlanner')).toHaveValue(payload);
  await page.locator('#wfb_btn_260901_weeklyPlanner').click();
  expect(await page.evaluate(() => window.__calls)).toEqual([['260901', 'weeklyPlanner']]);
  await page.evaluate(value => {
    document.getElementById('fixture').innerHTML = createWeeklyFbInput(value, { weeklyPlanner: value }, 2);
  }, payload);
  expect(await page.locator('#fixture [onclick], #fixture [oninput], #fixture img').count()).toBe(0);
  await safe(page);
});

for (const status of ['drafting', 'published', 'tutor_review', 'admin_review']) test(`PRO ${status} 본문은 입력값으로만 남고 첨부 링크를 검증한다`, async ({ page }) => {
  await prepare(page, '<div id="fixture"></div>');
  await page.addScriptTag({ content: await source('js/admin/pro-reports.js') });
  const text = '</textarea><img src=x onerror=window.__unsafeNameExecuted=true>';
  await page.evaluate(({ text, status }) => {
    window.tempSaveProItem = (...args) => window.__calls.push(args);
    const box = createProPeriodBox(text, { status, draft: JSON.stringify({ eval: text, dist: text, plan: text, qna: text }), reportLink: 'javascript:window.__unsafeNameExecuted=true' }, '260901', status === 'admin_review' ? 'admin' : 'tutor');
    document.getElementById('fixture').appendChild(box);
  }, { text, status });
  await expect(page.locator('[id="260901_item1"]')).toHaveValue(text);
  expect(await page.locator('#fixture img, #fixture a').count()).toBe(0);
  if (status === 'drafting') {
    await page.locator('[id="260901_btn1"]').click();
    expect(await page.evaluate(() => window.__calls)).toEqual([['260901', 1]]);
  }
  await page.evaluate(() => {
    document.getElementById('fixture').innerHTML = getActionHtml('published', false, false, 'https://files.example.invalid/result.pdf?signature=synthetic', '260901', false);
  });
  await expect(page.locator('#fixture a')).toHaveAttribute('href', 'https://files.example.invalid/result.pdf?signature=synthetic');
  await expect(page.locator('#fixture a')).toHaveAttribute('rel', 'noopener noreferrer');
  await safe(page);
});

test('첨부 URL 정책은 실행 URL·외부 평문·인증정보를 거절하고 정상 서명 주소를 유지한다', async ({ page }) => {
  await prepare(page, '<div id="fixture"></div>');
  expect(await page.evaluate(() => ['javascript:alert(1)', 'data:text/html,unsafe', 'https://user:pass@files.example.invalid/a.pdf', 'http://files.example.invalid/a.pdf', '//files.example.invalid/a.pdf', 'https://files.example.invalid/a\n.pdf'].map(safeAttachmentUrl))).toEqual(['', '', '', '', '', '']);
  expect(await page.evaluate(() => safeAttachmentUrl('https://files.example.invalid/a.pdf?signature=synthetic'))).toBe('https://files.example.invalid/a.pdf?signature=synthetic');
  expect(await page.evaluate(() => safeAttachmentUrl('/local/result.pdf'))).toMatch(/\/local\/result\.pdf$/);
  await page.addScriptTag({ content: await source('js/admin/pro-reports.js') });
  await page.evaluate(value => document.getElementById('fixture').appendChild(createProPeriodBox(value, {}, value, 'admin')), payload);
  expect(await page.locator('#fixture [onclick], #fixture [oninput], #fixture img').count()).toBe(0);
  await safe(page);
});

for (const name of ['김학생', payload]) test(`관리자 학생 버튼은 이름을 코드로 실행하지 않고 전달한다 ${name === payload ? '악성 문자열' : '일반 이름'}`, async ({ page }) => {
  await prepare(page, '<select id="searchType"><option value="name">name</option></select><input id="searchInput"><select id="filterTier"><option value="all">all</option></select><select id="filterTutor"><option value="all">all</option></select><button id="btnToggleSelection"></button><button id="btnSendNoticeToSelected"></button><span id="selectedStudentCount"></span><section id="section-students"><table class="student-table"><tbody id="studentListBody"></tbody></table></section>');
  await page.evaluate(studentName => {
    window.decodePromoCodeToMbti = () => '';
    window.apiFetch = async () => ({ json: async () => [{ userid: 'student-a', name: studentName, role: 'student', email: 'test@example.invalid' }] });
    window.openGrantTierModal = (...args) => window.__calls.push(['grant', ...args]);
    window.openForceDeleteModal = (...args) => window.__calls.push(['delete', ...args]);
  }, name);
  await page.addScriptTag({ content: await source('js/admin/students.js') });
  await page.evaluate(() => {
    window.goToStudentDetail = id => window.__calls.push(['detail', id]);
    return searchStudents();
  });
  await expect(page.locator('.student-name-text')).toHaveText(name);
  await page.evaluate(() => toggleStudentSelection());
  await page.locator('.student-checkbox').check();
  expect(await page.evaluate(() => Array.from(persistedSelections.entries()))).toEqual([['student-a', name]]);
  await page.locator('.btn-detail').click();
  await page.locator('.btn-up').click();
  await page.locator('.btn-del').click();
  expect(await page.evaluate(() => window.__calls)).toEqual([
    ['detail', 'student-a'], ['grant', 'student-a', name], ['delete', 'student-a', name]
  ]);
  expect(await page.locator('#studentListBody [onclick], #studentListBody [onchange]').count()).toBe(0);
  await safe(page);
});

for (const name of ['김학생', payload]) test(`튜터 학생 긴급 버튼은 이름을 문자로 전달한다 ${name === payload ? '악성 문자열' : '일반 이름'}`, async ({ page }) => {
  await prepare(page, '<table><tbody id="myStudentListBody"></tbody></table>');
  await page.evaluate(studentName => {
    window.apiFetch = async () => ({ json: async () => [{ userid: 'student-a', name: studentName, tier: 'STANDARD' }] });
  }, name);
  await page.addScriptTag({ content: await source('js/mypage_tutor.js') });
  await page.evaluate(() => {
    tutorInfoData = { nickname: 'Synthetic Tutor' };
    window.goToStudentDetail = id => window.__calls.push(['detail', id]);
    window.openUrgentModal = (...args) => window.__calls.push(['urgent', ...args]);
    return loadMyStudents();
  });
  await expect(page.locator('#myStudentListBody strong')).toHaveText(name);
  await page.locator('[data-action="detail"]').click();
  await page.locator('[data-action="urgent"]').click();
  expect(await page.evaluate(() => window.__calls)).toEqual([['detail', 'student-a'], ['urgent', 'student-a', name]]);
  expect(await page.locator('#myStudentListBody [onclick]').count()).toBe(0);
  await safe(page);
});

test('튜터 상세 긴급 사유와 정산값은 데이터로만 표시하고 버튼 기능을 유지한다', async ({ page }) => {
  await prepare(page, '<div class="tutor-card" data-tutor-id="tutor-a"><div class="tutor-details"></div></div>');
  await page.evaluate(value => {
    window.apiFetch = async (_url, options) => {
      const request = JSON.parse(options.body);
      if (request.type === 'admin_set_tutor_pay_status') { window.__calls.push(['pay', request.tutorId, request.month, request.payStatus]); return { ok: true }; }
      return { ok: true, json: async () => ({ tutorId: 'tutor-a', name: value, school: value, accountNumber: value,
        withdrawalStatus: 'pending', settlements: { [value]: { weeklyCount: 1, payStatus: '미지급' } },
        proStudents: [], stdStudents: [{ name: value, urgentStatus: { type: 'etc', text: value }, payCounts: { [value]: 1 } }], freeStudents: [] }) };
    };
  }, payload);
  await page.addScriptTag({ content: await source('js/admin/tutors.js') });
  await page.evaluate(() => {
    window.approveTutorWithdrawal = id => window.__calls.push(['approve', id]);
    return ensureTutorDetailLoaded(document.querySelector('.tutor-card'));
  });
  await page.locator('[data-action="approve-withdrawal"]').click();
  await page.locator('[data-settlement-month]').selectOption('지급완료');
  await page.locator('.urgent-etc-text').click();
  await expect(page.locator('.urgent-etc-text')).toHaveText(payload);
  expect(await page.evaluate(() => window.__calls)).toEqual([['approve', 'tutor-a'], ['pay', 'tutor-a', payload, '지급완료']]);
  await page.locator('.urgent-etc-text').click();
  await expect(page.locator('.urgent-etc-text')).toHaveText('...');
  expect(await page.locator('[data-settlement-month]').getAttribute('onchange')).toBeNull();
  expect(await page.locator('.urgent-etc-text').getAttribute('onclick')).toBeNull();
  await safe(page);
});

for (const status of ['waiting', 'read']) test(`문의 관리 ${status} 버튼은 사용자값을 실행하지 않는다`, async ({ page }) => {
  await prepare(page, '<table><tbody id="qnaListBody"></tbody></table>');
  await page.evaluate(({ value, state }) => {
    window.allQnaData = [{ userid: value, qnaId: value, userName: value, title: value, content: value, status: state, createdAt: '2026-10-03' }];
    window.currentQnaFilter = state;
  }, { value: payload, state: status });
  await page.addScriptTag({ content: await source('js/admin/qna.js') });
  await page.evaluate(() => {
    window.markAsRead = (...args) => window.__calls.push(['read', ...args]);
    window.openReplyModal = (...args) => window.__calls.push(['reply', ...args]);
    window.goToStudentDetail = id => window.__calls.push(['detail', id]);
    renderQnaList();
  });
  await page.locator('[data-qna-action]').click();
  await page.locator('[data-student-detail]').click();
  await page.locator('[data-qna-view]').click();
  expect(await page.evaluate(() => window.__calls)).toEqual([
    [status === 'waiting' ? 'read' : 'reply', payload, payload], ['detail', payload], ['reply', payload, payload, true]
  ]);
  expect(await page.locator('#qnaListBody [onclick]').count()).toBe(0);
  await safe(page);
});

test('문의 상세는 학생과 문의 ID를 함께 확인하고 새 창 보안 옵션을 유지한다', async ({ page }) => {
  await prepare(page, '<div id="reply-modal" class="hidden"><h2 id="replyModalTitle"></h2><p id="replyModalContent"></p><button id="replyModalStudentLink">학생 상세</button><textarea id="replyInput"></textarea><button id="replySubmitBtn"></button><div id="macroWrapper"></div></div>');
  await page.addScriptTag({ content: await source('js/admin/qna.js') });
  await page.evaluate(() => {
    allQnaData = [
      { userid: 'other-student', qnaId: 'same-id', title: '다른 학생', content: '다른 문의', status: 'read' },
      { userid: 'student&other=1', qnaId: 'same-id', title: '선택한 학생', content: '선택한 문의', status: 'read' }
    ];
    window.open = (...args) => window.__calls.push(args);
    openReplyModal('student&other=1', 'same-id');
  });
  await expect(page.locator('#replyModalTitle')).toHaveText('선택한 학생');
  await expect(page.locator('#replyModalContent')).toHaveText('선택한 문의');
  await page.locator('#replyModalStudentLink').click();
  expect(await page.evaluate(() => window.__calls)).toEqual([
    ['/admin/detail?uid=student%26other%3D1', '_blank', 'noopener,noreferrer']
  ]);
  await page.evaluate(() => {
    allQnaData = [{ userid: '', qnaId: 'invalid-id', title: '잘못된 ID', status: 'read' }];
    openReplyModal('', 'invalid-id');
    document.getElementById('replyModalStudentLink').click();
  });
  expect(await page.evaluate(() => window.__calls.length)).toBe(1);
  await safe(page);
});

test('튜터 배정 인원은 숫자로 표시하면서 기존 이름 배정 안내를 유지한다', async ({ page }) => {
  await prepare(page, '<div id="tutorListBody"></div>');
  await page.addScriptTag({ content: await source('js/admin/tutors.js') });
  await page.evaluate(value => {
    window.apiFetch = async () => ({ json: async () => ({ tutors: [
      { tutorId: 'tutor-a', nickname: '정상 튜터', totalStudents: '3' },
      { tutorId: 'tutor-b', nickname: value, totalStudents: value }
    ] }) });
    return loadTutorStats();
  }, payload);
  await expect(page.locator('.tutor-info-main').nth(0)).toContainText('ID 확인 배정 3명 · 기존 이름 배정은 매칭 관리에서 확인');
  await expect(page.locator('.tutor-info-main').nth(1)).toContainText('ID 확인 배정 0명 · 기존 이름 배정은 매칭 관리에서 확인');
  await expect(page.locator('.tutor-name').nth(1)).toHaveText(payload);
  expect(await page.locator('#tutorListBody img, #tutorListBody [onerror]').count()).toBe(0);
  await safe(page);
});

test('기존 이름 배정은 별도 안내와 확인 버튼을 표시하고 안전하게 ID를 전달한다', async ({ page }) => {
  await prepare(page, '<div id="newMatchList"></div>');
  await page.addScriptTag({ content: await source('js/admin/matching.js') });
  await page.evaluate(value => {
    window.getTierBadgeHTML = () => '';
    globalUnmatchedStudents = [];
    globalLegacyAssignments = [{ userid: value, name: value, tutorName: value, createdAt: '2026-10-03' }];
    globalTutorsForMatch = [{ tutorId: 'tutor-a', nickname: value, name: value }];
    window.executeMatching = (...args) => window.__calls.push(args);
    renderNewMatchingList();
  }, payload);
  await expect(page.locator('#newMatchList > p')).toContainText('미배정이 아닙니다');
  await expect(page.locator('[data-confirm-assignment]')).toHaveText('기존 배정 확인 후 연결');
  await page.locator('[data-confirm-assignment]').click();
  expect(await page.evaluate(() => window.__calls)).toEqual([[payload, false]]);
  expect(await page.locator('#newMatchList [onclick], #newMatchList img, #newMatchList [onerror]').count()).toBe(0);
  await safe(page);
});

test('배정 버튼의 식별자는 HTML과 이벤트 코드에 삽입되지 않는다', async ({ page }) => {
  await prepare(page, '<div id="newMatchList"></div>');
  await page.addScriptTag({ content: await source('js/admin/matching.js') });
  await page.evaluate(value => {
    window.getTierBadgeHTML = () => '';
    globalUnmatchedStudents = [{ userid: value, name: value, createdAt: '2026-10-03' }];
    globalTutorsForMatch = [{ tutorId: 'tutor-a', nickname: value, name: value }];
    window.executeMatching = (...args) => window.__calls.push(args);
    renderNewMatchingList();
  }, payload);
  await page.locator('.match-btn').click();
  expect(await page.evaluate(() => window.__calls)).toEqual([[payload, false]]);
  await expect(page.locator('.match-card-name')).toHaveText(payload);
  expect(await page.locator('.match-btn').getAttribute('onclick')).toBeNull();
  await safe(page);
});

test('알림 읽기와 대상 삭제는 텍스트 및 식별자를 코드로 실행하지 않는다', async ({ page }) => {
  await prepare(page, '<div id="notiListBody"></div><div id="selectedTargetTags"></div><span id="targetCountText"></span>');
  await page.evaluate(value => {
    window.NOTI_API_URL = '/synthetic/noti';
    window.apiFetch = async () => ({ json: async () => ({ notifications: [{ id: value, title: value, isRead: false, createdAt: '2026-10-03' }] }) });
  }, payload);
  await page.addScriptTag({ content: await source('js/admin/notices.js') });
  await page.evaluate(async value => {
    window.fetchUnreadNotiCount = async () => {};
    window.markAsReadNoti = id => window.__calls.push(['read', id]);
    selectedTargetMap.set(value, { name: value, tag: value });
    renderTargetTags();
    await loadNotifications();
  }, payload);
  await page.locator('.noti-btn').click();
  await expect(page.locator('.target-tag')).toContainText(payload);
  await page.locator('.remove-tag').click();
  expect(await page.evaluate(() => window.__calls)).toEqual([['read', payload]]);
  await expect(page.locator('#targetCountText')).toHaveText('0');
  await safe(page);
});
