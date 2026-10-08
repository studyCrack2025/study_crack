import { postJson } from '../../shared/api/client.js';

async function request(binding, type, data, fallbackError) {
  const result = await postJson({ apiFetch: binding.apiFetch, url: binding.consultingApiUrl, fallbackError, payload: { type, data } });
  if (!result.ok || result.data?.success !== true || !result.data.data) return { ok: false, error: result.error || fallbackError, code: result.data?.code || result.code };
  return { ok: true, data: result.data.data };
}

export const listWrittenSlots = binding => request(binding, 'student_list_v2_written_slots', {}, '상담 가능 시간을 불러오지 못했습니다.');
export const getWrittenAvailability = binding => request(binding, 'student_get_v2_written_availability', {}, '선택한 시간을 불러오지 못했습니다.');
export const submitWrittenAvailability = (binding, data) => request(binding, 'student_submit_v2_written_availability', data, '상담 가능 시간을 저장하지 못했습니다.');
export const getWrittenBooking = binding => request(binding, 'student_get_v2_written_booking', {}, '확정된 일정을 불러오지 못했습니다.');
