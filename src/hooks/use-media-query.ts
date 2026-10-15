"use client";

/**
 * A media query as state, read through `useSyncExternalStore`.
 *
 * Used to render a layout for the breakpoint instead of hiding it with CSS.
 * Hiding is not enough for anything expensive: a `display: none` iframe still
 * loads and lays out its document, so the editor was rendering the A4 sheet
 * twice on phones — once hidden, once in the modal — for no reason.
 *
 * The server snapshot is always `false`, so the markup the server sends matches
 * the first client render and the real answer arrives in the same paint.
 */
import * as React from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  const getSnapshot = React.useCallback(
    () => (typeof window === "undefined" || !window.matchMedia ? false : window.matchMedia(query).matches),
    [query]
  );

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false);
}
