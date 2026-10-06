"use client";

import * as React from "react";

const subscribe = () => () => {};

/**
 * true on the client, false during SSR — the hydration-safe replacement for
 * `const [m, setM] = useState(false); useEffect(() => setM(true), [])`,
 * which React flags as a synchronous setState inside an effect (cascading render).
 * useSyncExternalStore re-renders with the client snapshot right after hydration.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(subscribe, () => true, () => false);
}
