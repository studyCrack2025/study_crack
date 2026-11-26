import React from 'react';
import { requestCalculatorConversion } from './calculator-api.js';

const empty = new Map();
const targetKey = target => JSON.stringify(target);

function sameCalculationBasis(responses) {
  const contexts = responses.map(({ basis, scoreDigest, release, execution, publishedScoreExecution }) =>
    JSON.stringify([basis, scoreDigest, release, execution, publishedScoreExecution]));
  const rows = responses.flatMap(r => r.results);
  const referenceBundles = rows.map(row => row.referenceComparison?.bundleDigest);
  const cutPublications = rows.map(row => row.possibility?.publicationDigest ?? row.previewCutoff?.publicationDigest);
  const estimateModels = rows.map(row => row.previewCutoff?.modelDigest);
  return [contexts, referenceBundles, cutPublications, estimateModels].every(values => new Set(values.filter(Boolean)).size <= 1);
}

export default function useCalculatorGroupConversion({ active, mode, profile, targets, binding, denyAccess }) {
  const scope = active ? JSON.stringify([mode, profile?.revision, profile?.scores]) : null;
  const targetListKey = JSON.stringify(targets);
  const [resource, setResource] = React.useState({ scope: null, entries: empty });
  const cache = React.useRef(resource);
  const [attempt, retryRequest] = React.useReducer(value => value + 1, 0);

  React.useEffect(() => {
    const previous = cache.current.scope === scope ? cache.current.entries : empty;
    const entries = new Map(targets.flatMap(target => {
      const key = targetKey(target);
      return previous.has(key) ? [[key, previous.get(key)]] : [];
    }));
    const publish = next => {
      cache.current = { scope, entries: next };
      setResource(cache.current);
    };
    if (!scope || !profile || !targets.length) {
      publish(empty);
      return;
    }
    publish(entries);
    const missing = targets.filter(target => !entries.has(targetKey(target)));
    if (!missing.length) return;
    const controller = new AbortController();
    const request = selected => requestCalculatorConversion({ ...binding, scores: profile.scores, targets: selected, signal: controller.signal });
    const storeResult = (next, selected, response) => {
      for (const [index, target] of selected.entries()) {
        next.set(targetKey(target), response.ok
          ? { status: 'ready', result: response.data.results[index], response: { ...response.data, results: [response.data.results[index]] } }
          : { status: 'error', error: response.error });
      }
      publish(next);
    };
    const timer = setTimeout(async () => {
      const response = await request(missing);
      if (controller.signal.aborted) return;
      if (response.code === 'CALCULATOR_ACCESS_REQUIRED') { denyAccess(); return; }
      const ready = Array.from(entries.values()).filter(entry => entry.status === 'ready').map(entry => entry.response);
      if (response.ok && !sameCalculationBasis([...ready, response.data])) {
        publish(empty);
        const refreshed = await request(targets);
        if (controller.signal.aborted) return;
        if (refreshed.code === 'CALCULATOR_ACCESS_REQUIRED') { denyAccess(); return; }
        storeResult(new Map(), targets, refreshed);
        return;
      }
      storeResult(new Map(entries), missing, response);
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [scope, targetListKey, attempt, binding, denyAccess]);

  const entries = resource.scope === scope && scope ? resource.entries : empty;
  const byGroup = new Map(targets.map(target => [target.selection.admissionGroup,
    entries.get(targetKey(target)) ?? { status: scope ? 'loading' : 'idle' }]));
  const ordered = Array.from(byGroup.values());
  const complete = ordered.length > 0 && ordered.every(entry => entry.status === 'ready');
  const conversion = complete ? { ...ordered[0].response, results: ordered.map(entry => entry.result) } : null;
  function retry(target) {
    const entries = new Map(cache.current.entries);
    entries.delete(targetKey(target));
    cache.current = { scope, entries };
    setResource(cache.current);
    retryRequest();
  }
  return { byGroup, conversion, retry };
}
