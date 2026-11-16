import { postJson } from '../../shared/api/client.js';

const messages = {
  INVALID_PHOTO_IMAGE: '정상적인 JPEG·PNG 사진인지 확인해주세요.', UNSUPPORTED_PHOTO_TYPE: 'JPEG 또는 PNG 사진을 선택해주세요.',
  INVALID_PHOTO_SIZE: '사진 한 장은 10MB 이하로 선택해주세요.', PHOTO_QUOTA_REACHED: '상담에 첨부할 수 있는 사진 용량이 찼어요. 전송하지 않은 사진을 정리해주세요.',
  PHOTO_CONTENT_MISMATCH: '사진이 변경되었어요. 다시 선택해주세요.', PHOTO_STATE_CHANGED: '상담 또는 사진 상태가 바뀌었어요. 다시 확인해주세요.',
  PHOTO_PROCESSOR_UNAVAILABLE: '사진 처리를 준비하지 못했어요. 잠시 후 다시 시도하거나 운영팀에 문의해주세요.', PHOTO_EXPIRED: '첨부 시간이 지났어요. 사진을 다시 선택해주세요.',
  PHOTO_NOT_READY: '사진의 보안 확인이 끝나지 않았거나 열 수 없는 상태예요.'
};
export async function writtenPhotoRequest(binding, action, data, signal) {
  const type = { get: 'consulting_get_written_photo', url: 'consulting_get_written_photo_url', delete: 'consulting_delete_written_photo' }[action];
  if (!type) return { ok: false, error: '지원하지 않는 사진 요청입니다.' };
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.fileApiUrl, payload: { type, data }, signal, fallbackError: '사진 요청을 처리하지 못했어요. 다시 시도해주세요.' });
  if (result.ok && result.data?.success && result.data.data) return { ok: true, data: result.data.data };
  const code = result.data?.code || result.code;
  return { ok: false, code, error: messages[code] || result.error || '사진 요청을 처리하지 못했어요.', status: result.status };
}
export function writtenPhotoUploadRequest(binding, data, signal) {
  return uploadRequest(binding, 'consulting_create_written_photo_upload', data, signal);
}
export function writtenPhotoCompleteRequest(binding, data, signal) {
  return uploadRequest(binding, 'consulting_complete_written_photo_upload', data, signal);
}
async function uploadRequest(binding, type, data, signal) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.fileApiUrl, payload: { type, data }, signal, fallbackError: '사진을 올리지 못했어요. 다시 시도해주세요.' });
  if (result.ok && result.data?.success && result.data.data) return { ok: true, data: result.data.data };
  const code = result.data?.code || result.code;
  return { ok: false, code, error: messages[code] || result.error || '사진을 올리지 못했어요.', status: result.status };
}
export function safeWrittenPhotoUrl(value, { caseId, fileId }) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'study-crack-uploads.s3.ap-northeast-2.amazonaws.com' && !url.username && !url.password && !url.hash
      && url.pathname.startsWith(`/consulting/${encodeURIComponent(caseId)}/written/`) && url.pathname.endsWith(`/${encodeURIComponent(fileId)}.prepared.jpg`) ? url.href : null;
  } catch { return null; }
}
