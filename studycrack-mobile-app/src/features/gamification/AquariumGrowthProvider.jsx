import { useContext, useEffect, useRef, useState } from 'react';
import { getMobileBrowserServices } from '../../shared/browser/mobile-runtime.js';
import { PlannerStorageContext } from '../planner/PlannerStorageContext.js';
import { AquariumGrowthContext } from './AquariumGrowthContext.js';
import { createAquariumGrowthResource } from './growth-resource.js';

export function AquariumGrowthProvider({ enabled, screen, refreshTick, children }) {
  const resource = useRef(null), lastTick = useRef(refreshTick);
  const [, render] = useState(0);
  const planner = useContext(PlannerStorageContext)?.controller?.account?.getView();
  const environment = getMobileBrowserServices();
  let owner = '';
  try { owner = environment.browser?.localStorage?.getItem('userId') || ''; } catch { /* Storage may be unavailable. */ }
  useEffect(() => {
    if (!enabled || !owner) return;
    const current = createAquariumGrowthResource(environment, () => render(value => value + 1));
    resource.current = current; current.start(); render(value => value + 1);
    return () => { current.dispose(); if (resource.current === current) resource.current = null; };
  }, [enabled, owner]);
  useEffect(() => {
    if (enabled && ['timer', 'aquarium', 'my'].includes(screen) && resource.current?.getView().status === 'idle') resource.current.refresh();
  }, [enabled, owner, screen]);
  useEffect(() => {
    if (refreshTick !== lastTick.current) { lastTick.current = refreshTick; resource.current?.refresh(); }
  }, [refreshTick]);
  useEffect(() => {
    if (planner?.verified && planner.result?.confirmedGrowth) resource.current?.accept(planner.result.confirmedGrowth, planner.snapshot?.owner);
  }, [planner?.verified, planner?.result?.confirmedGrowth, enabled, owner]);
  const value = enabled && owner && resource.current ? { ...resource.current.getView(), claimUnlock: resource.current.claimUnlock, refresh: () => resource.current?.refresh() } : { status: 'idle', growth: null, backgroundKey: 'day1' };
  return <AquariumGrowthContext.Provider value={value}>{children}</AquariumGrowthContext.Provider>;
}
