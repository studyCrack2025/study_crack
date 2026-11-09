import { useEffect, useState } from 'react';
import { scoreReportResult } from './score-entry-model.js';
import { getV2SurveyDraft, readV2ScorePhoto } from './survey-api.js';

const EMPTY_RESULTS = Object.freeze({});
const SCAN_INTERVAL_MS = 4000;
const SCAN_WAIT_LIMIT_MS = 120000;
const MB = 1024 * 1024;
const readable = file => file.size > 0 && (file.contentType === 'application/pdf' ? file.size <= 10 * MB
  : ['image/jpeg', 'image/png'].includes(file.contentType) && file.size <= 8 * MB);
const note = (title, message, retryable = false) => ({ kind: 'notice', title, message, retryable });

const READ_NOTICES = {
  SCORE_PHOTO_FORMAT: note('성적표 형식을 확인하지 못했어요', '수능 성적표인지 확인하고 다른 파일을 첨부해 주세요.'),
  SCORE_PHOTO_READ_FAILED: note('성적표에서 성적을 읽지 못했어요', '글자가 선명한 성적표를 첨부하거나 성적을 직접 입력해 주세요.'),
  SCORE_PHOTO_UNSUPPORTED: note('이 파일은 자동 판독할 수 없어요', 'PDF 첫 페이지 또는 긴 변이 5,000px 이하인 JPG·PNG를 사용해 주세요.'),
  SCORE_PDF_UNREADABLE: note('PDF 첫 페이지를 열지 못했어요', '암호 없이 열리는 PDF나 선명한 성적표 사진을 첨부해 주세요.'),
  SCORE_PHOTO_SCAN_REFERENCE_MISSING: note('이 첨부의 판독을 시작하지 못했어요', '파일을 새로 첨부하거나 성적을 직접 입력해 주세요.'),
  SCORE_PHOTO_CHANGED: note('첨부한 파일을 확인할 수 없어요', '성적표를 다시 첨부해 주세요.')
};

export function useSurveyFileReading({ binding, draft, session, files, setFiles, canRead, actionBusy, updateScores }) {
  const [scanAttempt, setScanAttempt] = useState(0);
  const [pausedScan, setPausedScan] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const results = analysis?.session === session ? analysis.results : EMPTY_RESULTS;
  const scanKey = files.filter(file => file.status === 'quarantined').map(file => file.fileId).sort().join('|');
  const nextId = canRead && files.find(file => file.status === 'ready' && readable(file) && !Object.hasOwn(results, file.fileId))?.fileId;
  const receivedId = files.find(file => file.status === 'ready' && results[file.fileId]?.kind === 'received')?.fileId;
  const received = receivedId && results[receivedId];

  useEffect(() => {
    if (!session || !scanKey) return undefined;
    const controller = new AbortController();
    const pending = new Set(scanKey.split('|'));
    const deadline = Date.now() + SCAN_WAIT_LIMIT_MS;
    let timer;
    const pause = () => setPausedScan({ session, scanKey, scanAttempt });
    const poll = async () => {
      const result = await getV2SurveyDraft(binding, controller.signal);
      if (controller.signal.aborted || draft.current !== session) return;
      if (!result.ok || result.data.caseId !== session.caseId) return pause();
      const completed = (result.data.files || []).filter(file => pending.has(file.fileId) && ['ready', 'rejected', 'linked'].includes(file.status));
      if (completed.length) {
        const updates = new Map(completed.map(file => [file.fileId, file]));
        setFiles(current => current.map(file => file.status === 'quarantined' ? updates.get(file.fileId) || file : file));
        return;
      }
      if (Date.now() >= deadline) return pause();
      timer = setTimeout(poll, SCAN_INTERVAL_MS);
    };
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [binding, draft, scanAttempt, scanKey, session, setFiles]);

  useEffect(() => {
    if (!session || !nextId) return undefined;
    const controller = new AbortController();
    readV2ScorePhoto(binding, { caseId: session.caseId, fileId: nextId }, controller.signal).then(result => {
      if (controller.signal.aborted || draft.current !== session) return;
      const outcome = result.ok
        ? { kind: 'received', records: result.data.records }
        : Object.hasOwn(READ_NOTICES, result.code) ? READ_NOTICES[result.code]
          : note('성적 판독을 마치지 못했어요', '잠시 뒤 다시 시도하거나 성적을 직접 입력해 주세요.', true);
      setAnalysis(current => ({ session, results: { ...(current?.session === session ? current.results : {}), [nextId]: outcome } }));
    });
    return () => controller.abort();
  }, [binding, draft, nextId, session]);

  useEffect(() => {
    if (!session || !received || actionBusy || session.action || draft.current !== session) return;
    const { rows, records } = scoreReportResult(session.snapshot.scores.records, received.records, session.autoReadFiles.has(receivedId));
    if (records) updateScores({ records });
    const outcome = rows.length ? { kind: 'complete', rows, applied: Boolean(records) }
      : note('읽을 수 있는 성적이 없어요', '성적표에 점수가 있는지 확인하거나 더 선명한 파일을 첨부해 주세요.');
    setAnalysis(current => ({ session, results: { ...current.results, [receivedId]: outcome } }));
  }, [actionBusy, draft, received, receivedId, session, updateScores]);

  return {
    scanPaused: Boolean(scanKey && pausedScan?.session === session && pausedScan.scanKey === scanKey && pausedScan.scanAttempt === scanAttempt),
    retryScan: () => setScanAttempt(value => value + 1),
    readPending: files.some(file => file.status === 'ready' && readable(file) && session?.autoReadFiles.has(file.fileId)
      && (!results[file.fileId] || results[file.fileId].kind === 'received')),
    getReadResult: file => {
      if (!readable(file)) return note('이 파일은 자동 판독할 수 없어요', '성적을 직접 입력하거나 지원하는 크기의 성적표를 첨부해 주세요.');
      return results[file.fileId] || { kind: file.fileId === nextId ? 'reading' : 'waiting' };
    },
    retryRead: fileId => setAnalysis(current => {
      if (current?.session !== session) return current;
      const next = { ...current.results };
      delete next[fileId];
      return { session, results: next };
    })
  };
}
