import { apiFailure, apiInvalidResponse, apiSuccess, postJson } from '../../shared/api/client.js';
import { SUPPORT_REQUEST_TYPES } from '../../shared/api/request-types.js';
import { isRecord, validateModelList } from '../../shared/model/contracts.js';

function validateQnaItem(value) {
  return isRecord(value) && typeof value.qnaId === 'string'
    ? { ok: true, value }
    : { ok: false, error: '문의 항목 필드가 올바르지 않습니다.' };
}

export function normalizeQnaHistory(payload) {
  const list = Array.isArray(payload?.qnaHistory) ? payload.qnaHistory : (Array.isArray(payload) ? payload : []);
  return list.filter((item) => item && item.qnaId).map((item) => ({
    qnaId: String(item.qnaId || ''),
    title: item.title || '제목 없는 질문',
    content: item.content || '',
    status: item.status || 'waiting',
    answer: item.answer || '',
    createdAt: item.createdAt || '',
    answeredAt: item.answeredAt || ''
  }));
}

export async function fetchMobileQnaHistory({ apiFetch, qnaApiUrl, signal } = {}) {
  const result = await postJson({ apiFetch, signal, url: qnaApiUrl, payload: { type: SUPPORT_REQUEST_TYPES.GET_QNA_LIST }, fallbackError: '문의 내역을 불러오지 못했습니다.' });
  if (!result.ok) return result;
  const list = Array.isArray(result.data?.qnaHistory) ? result.data.qnaHistory : (Array.isArray(result.data) ? result.data : null);
  const contract = validateModelList(list, validateQnaItem, '문의 목록');
  if (!contract.ok) return apiInvalidResponse(result, contract.error);
  return apiSuccess(normalizeQnaHistory(list), { status: result.status });
}

export async function saveMobileQna({ apiFetch, content, qnaApiUrl, title } = {}) {
  const safeTitle = String(title || '').trim();
  const safeContent = String(content || '').trim();
  if (!safeTitle || !safeContent) return apiFailure('질문 제목과 내용을 입력해주세요.');
  const result = await postJson({
    apiFetch,
    url: qnaApiUrl,
    payload: { type: SUPPORT_REQUEST_TYPES.SAVE_QNA, data: { title: safeTitle, content: safeContent } },
    fallbackError: '질문 저장에 실패했습니다.'
  });
  if (!result.ok) return result;
  return apiSuccess({
    qnaId: String(result.data?.qnaId || `local-${Date.now()}`),
    title: safeTitle,
    content: safeContent,
    status: 'waiting',
    answer: '',
    createdAt: new Date().toISOString(),
    answeredAt: ''
  }, { status: result.status });
}
