const stages = ['day1', 'day7', 'day15', 'day30', 'day50', 'day100'];

export async function claimAquariumUnlock({ browser, owner, growth, eligible }) {
  if (!/^[A-Za-z0-9_@.+:-]{1,128}$/.test(owner || '') || growth?.policyVersion !== 'planner-days-v1'
    || !/^\d{4}-\d{2}-\d{2}$/.test(growth?.countingSince || '') || !stages.includes(growth?.highestUnlockedStage)) return null;
  const key = `studycrackAquariumSeen_v1:${encodeURIComponent(owner)}:${growth.policyVersion}:${growth.countingSince}`;
  try {
    if (!browser.navigator?.locks?.request || !eligible()) return null;
    return await browser.navigator.locks.request(key, { mode: 'exclusive', ifAvailable: true }, lock => {
      if (!lock || !eligible()) return null;
      const previous = browser.localStorage.getItem(key);
      if (previous !== null && !stages.includes(previous)) return null;
      if (stages.indexOf(previous) >= stages.indexOf(growth.highestUnlockedStage)) return null;
      browser.localStorage.setItem(key, growth.highestUnlockedStage);
      return eligible() ? growth.highestUnlockedStage : null;
    });
  } catch { return null; }
}
