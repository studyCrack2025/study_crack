import { apiFailure, apiInvalidResponse, apiSuccess, postJson } from '../../shared/api/client.js';
import { REPORT_REQUEST_TYPES } from '../../shared/api/request-types.js';
import { isRecord, validateModelList, validateWeeklyReport } from '../../shared/model/contracts.js';

function validateProReport(value) {
  return isRecord(value) && typeof value.key === 'string' && Boolean(value.key.trim())
    ? { ok: true, value }
    : { ok: false, error: 'PRO 리포트 필드가 올바르지 않습니다.' };
}

function normalizeProReports(payload) {
  return (Array.isArray(payload?.reports) ? payload.reports : [])
    .filter((item) => item && item.key)
    .map((item) => ({
      key: String(item.key || ''),
      reportLink: item.reportLink || '',
      status: item.status || (item.reportLink ? 'sent' : 'pending'),
      updatedAt: item.updatedAt || '',
      request: item.request || ''
    }));
}

export async function fetchMobileProReports({ apiFetch, reportApiUrl, signal } = {}) {
  const result = await postJson({
    apiFetch,
    signal,
    url: reportApiUrl,
    payload: { type: REPORT_REQUEST_TYPES.GET_PRO_REPORTS, data: { requesterRole: 'student' } },
    fallbackError: 'PRO 리포트를 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  const list = Array.isArray(result.data?.reports) ? result.data.reports : null;
  const contract = validateModelList(list, validateProReport, 'PRO 리포트 목록');
  if (!contract.ok) return apiInvalidResponse(result, contract.error);
  return apiSuccess(normalizeProReports({ reports: list }), { status: result.status });
}

export async function requestMobileProReport({ apiFetch, reportApiUrl, requestText } = {}) {
  const safeText = String(requestText || '').trim();
  if (!safeText) return apiFailure('요청 사항을 입력해주세요.');
  const result = await postJson({
    apiFetch,
    url: reportApiUrl,
    payload: { type: REPORT_REQUEST_TYPES.REQUEST_PRO_REPORT, data: { requestText: safeText } },
    fallbackError: '리포트 요청에 실패했습니다.'
  });
  if (!result.ok) return result;
  if (typeof result.data?.targetKey !== 'string') return apiInvalidResponse(result, '리포트 요청 응답이 올바르지 않습니다.');
  return apiSuccess({
    key: String(result.data?.targetKey || ''),
    reportLink: '',
    status: 'pending',
    updatedAt: new Date().toISOString(),
    request: safeText
  }, { status: result.status });
}

function normalizeWeeklyReports(payload) {
  return (Array.isArray(payload?.weeklyReports) ? payload.weeklyReports : [])
    .filter((item) => item && item.weekId)
    .map((item) => ({
      weekId: String(item.weekId || ''),
      title: item.title || '',
      date: item.date || '',
      updatedAt: item.updatedAt || '',
      tutorName: item.tutorName || '',
      tutorFeedback: item.tutorFeedback || null,
      weeklyGoal: item.weeklyGoal || '',
      questionToTutor: item.questionToTutor || ''
    }));
}

export async function fetchMobileWeeklyReports({ apiFetch, reportApiUrl, signal } = {}) {
  const result = await postJson({
    apiFetch,
    signal,
    url: reportApiUrl,
    payload: { type: REPORT_REQUEST_TYPES.GET_WEEKLY_REPORTS },
    fallbackError: '주간 리포트를 불러오지 못했습니다.'
  });
  if (!result.ok) return result;
  const list = Array.isArray(result.data?.weeklyReports) ? result.data.weeklyReports : null;
  const contract = validateModelList(list, validateWeeklyReport, '주간 리포트 목록');
  if (!contract.ok) return apiInvalidResponse(result, contract.error);
  return apiSuccess(normalizeWeeklyReports({ weeklyReports: list }), { status: result.status });
}

function fallbackMimeType(fileName = '') {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'image/jpeg';
}

export async function uploadMobileFile({ apiFetch, fetchImpl = globalThis.fetch, file, fileApiUrl, folder } = {}) {
  if (typeof fetchImpl !== 'function' || typeof FormData === 'undefined') return apiFailure('현재 환경에서 파일 업로드를 사용할 수 없습니다.');
  if (!file) return apiSuccess('');
  const fileName = file.name || 'upload.jpg';
  const fileType = file.type || fallbackMimeType(fileName);
  const presign = await postJson({
    apiFetch,
    url: fileApiUrl,
    payload: { type: REPORT_REQUEST_TYPES.GET_PRESIGNED_URL, data: { fileName: encodeURIComponent(fileName), fileType, folder } },
    fallbackError: '파일 업로드 URL 발급에 실패했습니다.'
  });
  if (!presign.ok) return presign;
  if (!isRecord(presign.data?.fields) || typeof presign.data?.uploadUrl !== 'string' || typeof presign.data?.fileUrl !== 'string') {
    return apiInvalidResponse(presign, '파일 업로드 URL 응답이 올바르지 않습니다.');
  }
  try {
    const formData = new FormData();
    Object.entries(presign.data?.fields || {}).forEach(([key, value]) => formData.append(key, value));
    formData.append('file', file);
    const uploadResponse = await fetchImpl(presign.data?.uploadUrl, { method: 'POST', body: formData });
    if (!uploadResponse?.ok) return apiFailure('S3 파일 업로드에 실패했습니다.', { status: uploadResponse?.status || 0 });
    return apiSuccess(presign.data?.fileUrl || '', { status: uploadResponse.status || 200 });
  } catch (error) {
    return apiFailure(error?.message || '네트워크 오류로 파일을 업로드하지 못했습니다.');
  }
}

export async function uploadMobileWeeklyFiles({ apiFetch, examFiles = [], fetchImpl = globalThis.fetch, fileApiUrl, plannerFiles = [] } = {}) {
  const plannerFileUrls = [];
  const examFileUrls = [];
  for (const file of plannerFiles || []) {
    const result = await uploadMobileFile({ apiFetch, fetchImpl, file, fileApiUrl, folder: 'planner' });
    if (!result.ok) return result;
    if (result.data) plannerFileUrls.push(result.data);
  }
  for (const file of examFiles || []) {
    const result = await uploadMobileFile({ apiFetch, fetchImpl, file, fileApiUrl, folder: 'mock_exams' });
    if (!result.ok) return result;
    if (result.data) examFileUrls.push(result.data);
  }
  return apiSuccess({ plannerFileUrls, examFileUrls });
}

function generateMobileReportKey(dateObj = new Date()) {
  const kstDate = new Date((dateObj instanceof Date ? dateObj : new Date(dateObj)).getTime() + 9 * 60 * 60 * 1000);
  const yearNum = kstDate.getUTCFullYear();
  const monthIndex = kstDate.getUTCMonth();
  const dayOfMonth = kstDate.getUTCDate();
  const year = String(yearNum).slice(2);
  const month = String(monthIndex + 1).padStart(2, '0');
  const dayOfWeek = new Date(Date.UTC(yearNum, monthIndex, 1)).getUTCDay();
  const week = String(Math.floor((dayOfMonth + dayOfWeek - 1) / 7) + 1).padStart(2, '0');
  return `${year}${month}${week}`;
}

function shortText(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

export function buildMobileWeeklyCheckPayload({ answers = {}, dropReasons = [], examScores = {}, examType = '', examFileUrls = [], plannerFileUrls = [], rows = [], trend = '', now = new Date() } = {}) {
  const weekId = generateMobileReportKey(now);
  const details = (rows || [])
    .map((row) => ({
      subject: `${row.subject || '기타'}${row.detail ? `(${row.detail})` : ''}`,
      plan: Number(row.planned || 0),
      act: Number(row.actual || 0)
    }))
    .filter((row) => row.subject && (row.plan > 0 || row.act > 0));
  const totalPlan = details.reduce((sum, row) => sum + row.plan, 0);
  const totalAct = details.reduce((sum, row) => sum + row.act, 0);
  const totalRate = totalPlan > 0 ? Math.round((totalAct / totalPlan) * 100) : 0;
  const deepAnswers = [
    trend ? `최근 2주 학업 추이: ${trend}` : '',
    dropReasons.length ? `하락 원인: ${dropReasons.join(', ')}` : '',
    answers.step4Reason ? `추이 상세: ${answers.step4Reason}` : '',
    answers.step5 ? `학습 계획 점검: ${answers.step5}` : '',
    answers.step6 ? `학습 방향성: ${answers.step6}` : '',
    answers.step7 ? `튜터 질문: ${answers.step7}` : '',
    answers.step8 ? `멘탈/기타: ${answers.step8}` : ''
  ].filter(Boolean);
  const mockExam = examType && examType !== '미응시'
    ? {
        type: examType,
        proofFile: examFileUrls[0] || '',
        proofFiles: examFileUrls,
        scores: {
          koreanType: shortText(examScores.koreanType, 50),
          koreanRaw: shortText(examScores.koreanRaw, 10),
          mathType: shortText(examScores.mathType, 50),
          mathRaw: shortText(examScores.mathRaw, 10),
          englishGrade: shortText(examScores.englishGrade, 10),
          inq1Name: shortText(examScores.inq1Name, 50),
          inq1Raw: shortText(examScores.inq1Raw, 10),
          inq2Name: shortText(examScores.inq2Name, 50),
          inq2Raw: shortText(examScores.inq2Raw, 10)
        }
      }
    : { type: 'none', scores: {} };
  return {
    weekId,
    date: now.toISOString(),
    title: `20${weekId.slice(0, 2)}년 ${Number(weekId.slice(2, 4))}월 ${Number(weekId.slice(4, 6))}주차 학습점검`,
    formVersion: 1,
    studyTime: { details, totalPlan: `${Number(totalPlan.toFixed(1))}H`, totalAct: `${Number(totalAct.toFixed(1))}H`, totalRate: `${totalRate}%` },
    mockExam,
    trend: { value: trend || '', dropReasons, reason: shortText(answers.step4Reason, 200) },
    deepAnswers,
    plannerFiles: plannerFileUrls
  };
}

export async function saveMobileWeeklyCheck({ apiFetch, payload, reportApiUrl } = {}) {
  if (!payload?.title) return apiFailure('주간 점검 데이터가 올바르지 않습니다.');
  const result = await postJson({
    apiFetch,
    url: reportApiUrl,
    payload: { type: REPORT_REQUEST_TYPES.SAVE_WEEKLY_CHECK, data: payload },
    fallbackError: '주간 점검 저장에 실패했습니다.'
  });
  if (!result.ok) return result;
  return apiSuccess({
    weekId: payload.weekId,
    title: payload.title,
    date: payload.date,
    updatedAt: new Date().toISOString(),
    studyTime: payload.studyTime,
    mockExam: payload.mockExam,
    trend: payload.trend,
    deepAnswers: payload.deepAnswers
  }, { status: result.status });
}
