export function createProductGuideHandlers({ productGuideActionsRef } = {}) {
  return {
    openProductGuide: () => productGuideActionsRef?.current?.open(),
    closeProductGuide: () => productGuideActionsRef?.current?.close(),
    nextProductGuide: () => productGuideActionsRef?.current?.next(),
    previousProductGuide: () => productGuideActionsRef?.current?.previous(),
    retryProductGuide: () => productGuideActionsRef?.current?.retry(),
    dismissProductGuideError: () => productGuideActionsRef?.current?.dismissError()
  };
}
