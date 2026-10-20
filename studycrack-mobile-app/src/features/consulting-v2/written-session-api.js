import { postJson } from '../../shared/api/client.js';

async function request(binding, type, data = {}, fallbackError, signal) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, fallbackError, signal, payload: { type, data } });
  if (!result.ok || result.data?.success !== true || !result.data.data) return { ok: false, error: result.error || fallbackError, code: result.data?.code || result.code, status: result.status };
  return { ok: true, data: result.data.data };
}

export const getStudentWrittenSession = (binding, signal) => request(binding, 'student_get_written_session', {}, '서면상담 정보를 불러오지 못했습니다.', signal);
export const listStudentWrittenMessages = (binding, data, signal) => request(binding, 'student_list_written_messages', data, '상담 메시지를 불러오지 못했습니다.', signal);
export const sendStudentWrittenMessage = (binding, data) => request(binding, 'student_send_written_message', data, '메시지를 보내지 못했습니다.');
export const listCounselorWrittenSessions = (binding, signal) => request(binding, 'counselor_list_written_sessions', {}, '배정된 상담을 불러오지 못했습니다.', signal);
export const getCounselorWrittenSession = (binding, caseId, signal) => request(binding, 'counselor_get_written_session', { caseId }, '서면상담 정보를 불러오지 못했습니다.', signal);
export const listCounselorWrittenMessages = (binding, data, signal) => request(binding, 'counselor_list_written_messages', data, '상담 메시지를 불러오지 못했습니다.', signal);
export const sendCounselorWrittenMessage = (binding, data) => request(binding, 'counselor_send_written_message', data, '메시지를 보내지 못했습니다.');
export const saveCounselorSessionNote = (binding, data) => request(binding, 'counselor_save_session_note', data, '내부 메모를 저장하지 못했습니다.');
export const completeCounselorWrittenSession = (binding, data) => request(binding, 'counselor_complete_written_session', data, '상담을 완료하지 못했습니다.');
