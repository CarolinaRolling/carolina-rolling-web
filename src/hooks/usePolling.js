import { useEffect, useRef } from 'react';

/**
 * setInterval that pauses while the browser tab is hidden.
 *
 * Every poll in this app used to run forever regardless of whether anyone was looking. A
 * forgotten background tab on the work order page was refetching the entire order — all parts,
 * all files, all documents — every 30 seconds, plus inspections every 15 and messages every 5.
 * Multiply by open tabs and idle browsers and that was most of the API load.
 *
 * This hook does three things:
 *   1. stops the timer when the tab is hidden
 *   2. fires once immediately on return, so the screen is current the moment you look at it
 *   3. keeps the callback in a ref, so a re-render does not restart the interval
 *
 * Usage:
 *   usePolling(() => loadOrder(), 30000);
 *   usePolling(() => load(false), 5000, { enabled: Boolean(workOrderId) });
 */
export default function usePolling(callback, intervalMs, options = {}) {
  const { enabled = true, runOnFocus = true } = options;
  const savedCallback = useRef(callback);
  const timerRef = useRef(null);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;

    const tick = () => {
      try {
        savedCallback.current();
      } catch (err) {
        // A throwing poll must not kill the timer or bubble into React's render path.
        console.error('[usePolling] callback threw:', err);
      }
    };

    const start = () => {
      if (timerRef.current) return;
      timerRef.current = setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (!timerRef.current) return;
      clearInterval(timerRef.current);
      timerRef.current = null;
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Catch up immediately rather than waiting out a full interval on a stale screen.
        if (runOnFocus) tick();
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [enabled, intervalMs, runOnFocus]);
}
