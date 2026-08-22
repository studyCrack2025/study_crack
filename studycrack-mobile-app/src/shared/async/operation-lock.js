export async function withOperationLock(lockRef, key, task) {
  const locks = lockRef?.current;
  if (!(locks instanceof Set)) return task();
  if (locks.has(key)) return false;
  locks.add(key);
  try {
    return await task();
  } finally {
    locks.delete(key);
  }
}
