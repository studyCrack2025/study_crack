import React from 'react';
import { getMobileApiBinding } from '../../shared/browser/mobile-runtime.js';
import { calculatorScoreBatch, requestCalculatorScoreConversion, scoreRecordKey } from './calculator-score-conversion.js';

export default function useCalculatorScoreConversion(scores, enabled, onAccessRequired) {
  const binding = React.useMemo(() => getMobileApiBinding('analysis', 'analysisApiUrl'), []);
  const [cache, setCache] = React.useState({}), [retry, setRetry] = React.useState(0);
  const cacheRef = React.useRef(cache), accessRequired = React.useRef(onAccessRequired);
  accessRequired.current = onAccessRequired;
  const records = calculatorScoreBatch(scores), batchKey = JSON.stringify(records);
  React.useEffect(() => {
    if (!enabled) { cacheRef.current = {}; setCache({}); return; }
    const current = JSON.parse(batchKey), missing = current.filter(row => cacheRef.current[row.key]?.inputKey !== scoreRecordKey(row) || cacheRef.current[row.key]?.status !== 'converted');
    if (!missing.length) return;
    const controller = new AbortController(); let active = true;
    const update = additions => { if (active) { cacheRef.current = { ...cacheRef.current, ...additions }; setCache(cacheRef.current); } };
    update(Object.fromEntries(missing.map(row => [row.key, { inputKey: scoreRecordKey(row), status: 'loading' }])));
    const timer = setTimeout(async () => {
      const response = await requestCalculatorScoreConversion({ ...binding, records: missing, signal: controller.signal });
      if (!active || controller.signal.aborted) return;
      if (response.code === 'CALCULATOR_ACCESS_REQUIRED') accessRequired.current?.();
      const changedBoard = response.ok && response.data.scoreboard && Object.values(cacheRef.current).some(row => row.status === 'converted' && row.scoreboard?.digest !== response.data.scoreboard.digest);
      if (changedBoard) cacheRef.current = {};
      update(Object.fromEntries(missing.map((row, index) => [row.key, response.ok ? { ...response.data.results[index], inputKey: scoreRecordKey(row), scoreboard: response.data.scoreboard }
        : { inputKey: scoreRecordKey(row), status: 'error', error: response.error }])));
      if (changedBoard) setRetry(value => value + 1);
    }, 650);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [batchKey, enabled, retry, binding]);
  const results = Object.fromEntries(records.map(row => [row.key, enabled && cache[row.key]?.inputKey === scoreRecordKey(row) ? cache[row.key] : { status: enabled ? 'loading' : 'idle' }]));
  return { results, ready: enabled && records.length === 4 && records.every(row => results[row.key]?.status === 'converted'), retry: () => setRetry(value => value + 1) };
}
