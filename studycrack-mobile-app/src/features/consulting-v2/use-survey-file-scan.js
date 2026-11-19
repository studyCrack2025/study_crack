import { useEffect, useState } from 'react';
import { getV2SurveyDraft } from './survey-api.js';

const SCAN_INTERVAL_MS = 4000;
const SCAN_WAIT_LIMIT_MS = 120000;

export function useSurveyFileScan({ binding, draft, session, files, setFiles }) {
  const [scanAttempt, setScanAttempt] = useState(0);
  const [pausedScan, setPausedScan] = useState(null);
  const scanKey = files.filter(file => file.status === 'quarantined').map(file => file.fileId).sort().join('|');

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

  return {
    scanPaused: Boolean(scanKey && pausedScan?.session === session && pausedScan.scanKey === scanKey && pausedScan.scanAttempt === scanAttempt),
    retryScan: () => setScanAttempt(value => value + 1)
  };
}
