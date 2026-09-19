import { useEffect, useRef, useState } from 'react';
import { plannerSlice } from '../features/planner/state.js';

export function usePlannerStorage(rootState, setState, createController) {
  const [, render] = useState(0);
  const controllerRef = useRef(null);
  if (!controllerRef.current && createController) {
    controllerRef.current = createController({
      items: plannerSlice.selectors.localDraft(rootState).plannerItems,
      commit: plannerItems => setState({ plannerItems }),
      notify: () => render(version => version + 1)
    });
  }
  const controller = controllerRef.current;
  useEffect(() => {
    if (!controller) return;
    setState({ plannerItems: controller.getItems() });
    return controller.watchUnload();
  }, [controller, setState]);
  return controller;
}
