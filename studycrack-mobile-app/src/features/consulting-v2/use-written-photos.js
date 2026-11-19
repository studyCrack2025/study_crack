import React from 'react';
import { writtenPhotoCompleteRequest, writtenPhotoRequest, writtenPhotoUploadRequest } from './written-photo-api.js';

const sleep = (ms, signal) => new Promise(resolve => {
  const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
  const timer = setTimeout(done, ms); signal.addEventListener('abort', done, { once: true });
  if (signal.aborted) done();
});
const fileMessage = file => file.reasonCode === 'PHOTO_SCAN_ACCESS_DENIED' ? '사진 보안 확인을 준비하지 못했어요. 운영팀에 문의해주세요.' : '안전하게 열 수 없는 사진이에요. 다른 JPEG·PNG 사진을 선택해주세요.';

export function useWrittenPhotos(binding, caseId) {
  const [items, setItems] = React.useState([]), [notice, setNotice] = React.useState('');
  const current = React.useRef([]), jobs = React.useRef(new Map()), mounted = React.useRef(true);
  const update = change => { const next = change(current.current); current.current = next; setItems(next); };
  const patch = (key, change) => { if (mounted.current) update(value => value.map(item => item.key === key ? { ...item, ...change } : item)); };
  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; jobs.current.forEach(job => job.abort()); current.current.forEach(item => URL.revokeObjectURL(item.preview)); };
  }, []);
  async function run(item, resume = false) {
    jobs.current.get(item.key)?.abort();
    const controller = new AbortController(); jobs.current.set(item.key, controller);
    const { signal } = controller;
    let fileId = resume ? item.fileId : null;
    const apply = value => { if (!signal.aborted) patch(item.key, value); };
    const fail = error => { throw new Error(error || '사진을 올리지 못했어요. 다시 시도해주세요.'); };
    try {
      let file;
      if (!resume) {
        if (item.fileId) await writtenPhotoRequest(binding, 'delete', { caseId, fileId: item.fileId }, signal);
        apply({ phase: 'uploading', error: '', paused: false });
        const created = await writtenPhotoUploadRequest(binding, { caseId, fileName: item.file.name, contentType: item.file.type, size: item.file.size }, signal);
        if (signal.aborted) return;
        if (!created.ok) fail(created.error);
        fileId = created.data.fileId; apply({ fileId });
        const upload = new URL(created.data.uploadUrl);
        if (upload.protocol !== 'https:' || upload.hostname !== 'study-crack-uploads.s3.ap-northeast-2.amazonaws.com' || !String(created.data.fields?.key || '').startsWith(`consulting/${caseId}/written/`)) fail('사진 업로드 주소를 확인하지 못했어요.');
        const body = new FormData();
        Object.entries(created.data.fields || {}).forEach(([key, value]) => body.append(key, String(value))); body.append('file', item.file);
        let uploaded;
        const timeout = setTimeout(() => { apply({ phase: 'failed', error: '사진 업로드 시간이 지났어요. 연결을 확인하고 다시 시도해주세요.' }); controller.abort(); }, 60000);
        try { uploaded = await binding.fetchImpl(upload.href, { method: 'POST', body, credentials: 'omit', referrerPolicy: 'no-referrer', signal }); }
        finally { clearTimeout(timeout); }
        if (signal.aborted) return;
        if (!uploaded.ok) fail('사진을 올리지 못했어요. 연결을 확인하고 다시 시도해주세요.');
        const complete = await writtenPhotoCompleteRequest(binding, { caseId, fileId }, signal);
        if (!complete.ok) fail(complete.error);
        file = complete.data;
      }
      apply({ phase: 'checking', error: '' });
      const deadline = Date.now() + 120000;
      while (!signal.aborted) {
        if (!file) {
          if (document.visibilityState === 'hidden') { await sleep(2000, signal); continue; }
          const result = await writtenPhotoRequest(binding, 'get', { caseId, fileId }, signal);
          if (!result.ok) fail(result.error);
          file = result.data;
        }
        if (file.status === 'ready' || file.status === 'linked') { apply({ phase: 'ready', metadata: file, paused: false }); return; }
        if (file.status === 'rejected' || file.status === 'deleting') fail(fileMessage(file));
        if (Date.now() >= deadline) { apply({ phase: 'failed', error: '보안 확인이 더 걸리고 있어요. 계속 확인하거나 첨부를 취소할 수 있어요.', paused: true }); return; }
        file = null; await sleep(2000, signal);
      }
    } catch (error) {
      if (!signal.aborted) apply({ phase: 'failed', error: error.message || '사진을 처리하지 못했어요.' });
    }
  }
  const add = files => {
    const values = [...files];
    if (current.current.length + values.length > 3) return setNotice('한 메시지에는 사진을 최대 세 장까지 첨부할 수 있어요.');
    if (values.some(file => !['image/jpeg', 'image/png'].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024)) return setNotice('10MB 이하의 JPEG·PNG 사진을 선택해주세요. HEIC는 JPEG로 저장한 뒤 첨부해주세요.');
    setNotice('');
    const entries = values.map(file => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), phase: 'uploading' }));
    update(value => [...value, ...entries]); entries.forEach(item => run(item));
  };
  const remove = item => {
    jobs.current.get(item.key)?.abort(); jobs.current.delete(item.key); URL.revokeObjectURL(item.preview);
    update(value => value.filter(value => value.key !== item.key));
    if (item.fileId) void writtenPhotoRequest(binding, 'delete', { caseId, fileId: item.fileId });
  };
  const take = () => {
    const values = current.current;
    values.forEach(item => URL.revokeObjectURL(item.preview)); update(() => []); jobs.current.clear();
    return values.map(item => ({ ...item.metadata, fileId: item.fileId }));
  };
  return { items, notice, add, remove, take, retry: item => run(item, Boolean(item.paused)), busy: items.some(item => item.phase !== 'ready') };
}
