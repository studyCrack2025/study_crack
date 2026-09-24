import { useEffect, useRef } from 'react';
import { fetchProductGuide, saveProductGuide } from './api.js';
import { guideAccountKey, guideCanOpen, guideMutation } from './model.js';
import { resolveScreenAccess } from '../../app/access-policy.js';

const emptyUi = () => ({ open: false, step: 1, mode: 'auto', returnTarget: '', busy: false, error: '' });

export function useProductGuide({ api, state, setState, nav, actionsRef }) {
  const latest = useRef(null);
  const session = useRef(null);
  const account = guideAccountKey(state, api.hasClientSession());
  latest.current = { state, account, api, nav };
  const active = current => session.current === current && current?.account === latest.current.account && latest.current.api.hasClientSession();
  const patchUi = (current, patch) => {
    if (!active(current)) return;
    current.ui = { ...current.ui, ...patch };
    setState({ productGuideUi: current.ui });
  };
  const record = (current, value) => {
    if (!active(current)) return;
    current.record = value;
    setState({ productGuide: value });
  };
  const load = async current => {
    const result = await fetchProductGuide(current.binding, current.controller.signal);
    if (!active(current)) return false;
    record(current, result.ok ? result.data : null);
    current.loaded = true;
    current.loadError = result.ok ? '' : result.error;
    if (current.ui.open) patchUi(current, { error: current.loadError });
    return result.ok;
  };
  const finish = current => {
    if (!active(current) || !current.ui.open) return;
    patchUi(current, { open: false, error: '' });
    const target = resolveScreenAccess(latest.current.state, 'planner').allowed ? 'planner' : 'timer';
    latest.current.nav.goto(target);
  };
  const persist = (current, status, step, onSuccess) => {
    if (!active(current)) return Promise.resolve();
    current.pending = { status, step, onSuccess };
    patchUi(current, { busy: true, error: '' });
    current.queue = current.queue.then(async () => {
      if (!active(current)) return;
      const data = guideMutation(current.record, status, step);
      if (!current.record) {
        patchUi(current, { busy: false, error: current.loadError || '기록을 확인하지 못했어요. 안내를 닫고 앱을 사용할 수 있어요.' });
        return;
      }
      let result = data ? await saveProductGuide(current.binding, data, current.controller.signal) : { ok: true, data: current.record };
      if (!active(current)) return;
      if (result.status === 409) {
        const fresh = await fetchProductGuide(current.binding, current.controller.signal);
        if (!active(current)) return;
        if (fresh.ok) {
          record(current, fresh.data);
          if (!guideMutation(fresh.data, status, step)) result = fresh;
        }
      }
      if (result.ok) {
        record(current, result.data);
        if (current.pending?.status === status && current.pending?.step === step) current.pending = null;
        patchUi(current, { busy: false, error: '' });
        onSuccess?.(current);
      } else {
        patchUi(current, { busy: false, error: result.error });
      }
    });
    return current.queue;
  };

  useEffect(() => {
    const current = { account, binding: api.getUserApiBinding(), controller: new AbortController(), ui: emptyUi(), record: null, loaded: false, suppressed: false, pending: null, queue: Promise.resolve() };
    session.current = current;
    setState({ productGuide: null, productGuideUi: current.ui });
    if (account) void load(current);
    return () => { current.controller.abort(); if (session.current === current) session.current = null; };
  }, [account, api.getUserApiBinding, setState]);

  useEffect(() => {
    const current = session.current;
    if (!active(current) || !account) return;
    if (current.ui.open && !guideCanOpen(state)) {
      patchUi(current, { open: false, returnTarget: '' });
      return;
    }
    if (!current.loaded || current.suppressed || current.ui.open || state.screen !== 'timer' || state.drawerOpen || !guideCanOpen(state)) return;
    if (!['unseen', 'in_progress'].includes(current.record?.status)) return;
    current.suppressed = true;
    const step = Math.max(1, current.record.lastStep);
    patchUi(current, { ...emptyUi(), open: true, step });
    void persist(current, 'in_progress', step);
  }, [account, state]);

  actionsRef.current = {
    open: () => {
      const current = session.current;
      if (!active(current) || !account || !guideCanOpen(latest.current.state)) return;
      current.suppressed = true;
      const returnTarget = latest.current.state.drawerOpen ? 'summary' : 'my';
      setState({ drawerOpen: false });
      patchUi(current, { ...emptyUi(), open: true, mode: 'replay', returnTarget, error: current.loadError || '' });
    },
    close: () => {
      const current = session.current;
      if (!active(current) || !current.ui.open) return;
      const { mode, returnTarget, step } = current.ui;
      current.suppressed = true;
      patchUi(current, { open: false, returnTarget: '' });
      if (returnTarget === 'summary' && latest.current.state.screen === 'timer') setState({ drawerOpen: true });
      if (mode === 'auto' || !['completed', 'skipped'].includes(current.record?.status)) void persist(current, 'skipped', step);
    },
    next: () => {
      const current = session.current;
      if (!active(current) || !current.ui.open || current.ui.busy) return;
      if (current.ui.step === 5) {
        if (!current.record) finish(current);
        else void persist(current, 'completed', 5, finish);
        return;
      }
      const step = current.ui.step + 1;
      patchUi(current, { step });
      if (current.record) void persist(current, 'in_progress', step);
    },
    previous: () => {
      const current = session.current;
      if (active(current) && current.ui.open && !current.ui.busy) patchUi(current, { step: Math.max(1, current.ui.step - 1) });
    },
    retry: async () => {
      const current = session.current;
      if (!active(current) || current.ui.busy) return;
      patchUi(current, { busy: true });
      if (!await load(current)) { patchUi(current, { busy: false, error: current.loadError }); return; }
      const pending = current.pending;
      if (pending) void persist(current, pending.status, pending.step, pending.onSuccess);
      else patchUi(current, { busy: false, error: '' });
    },
    dismissError: () => {
      const current = session.current;
      if (active(current)) { current.pending = null; patchUi(current, { error: '' }); }
    },
    suspend: () => {
      const current = session.current;
      if (active(current)) patchUi(current, { open: false, returnTarget: '' });
    }
  };
  return account && session.current?.account === account ? state.productGuideUi : emptyUi();
}
