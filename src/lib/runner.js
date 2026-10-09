function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/**
 * Sends `batchSize` requests in parallel, then waits so each batch starts
 * `intervalMs` after the previous one started (default: one batch every 3 s).
 * `worker` must not throw; it returns a result object.
 */
export async function runInBatches({ items, batchSize, intervalMs, worker, onResult, onWait, signal }) {
  const size = Math.max(1, batchSize);
  for (let i = 0; i < items.length; i += size) {
    if (signal.aborted) return;
    const startedAt = Date.now();
    await Promise.all(
      items.slice(i, i + size).map(async (item) => {
        const result = await worker(item);
        if (!signal.aborted) onResult(result);
      })
    );
    if (i + size < items.length && !signal.aborted) {
      const wait = Math.max(0, intervalMs - (Date.now() - startedAt));
      onWait?.(Date.now() + wait);
      await sleep(wait, signal);
      onWait?.(null);
    }
  }
}
