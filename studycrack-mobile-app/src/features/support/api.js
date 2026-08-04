import { apiFailure, apiSuccess, postJson } from '../../shared/api/client.js';

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

export async function fetchMobileQnaHistory({ apiFetch, qnaApiUrl } = {}) {
  const result = await postJson({ apiFetch, url: qnaApiUrl, payload: { type: 'get_qna_list' }, fallbackError: '문의 내역을 불러오지 못했습니다.' });
  return result.ok ? apiSuccess(normalizeQnaHistory(result.data), { status: result.status }) : result;
}

export async function saveMobileQna({ apiFetch, content, qnaApiUrl, title } = {}) {
  const safeTitle = String(title || '').trim();
  const safeContent = String(content || '').trim();
  if (!safeTitle || !safeContent) return apiFailure('질문 제목과 내용을 입력해주세요.');
  const result = await postJson({
    apiFetch,
    url: qnaApiUrl,
    payload: { type: 'save_qna', data: { title: safeTitle, content: safeContent } },
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
