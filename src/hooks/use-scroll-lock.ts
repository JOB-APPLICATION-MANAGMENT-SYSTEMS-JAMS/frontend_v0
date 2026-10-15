"use client";

/**
 * Lock the page behind a modal or overlay.
 *
 * Reference-counted, because overlays nest (an (i) tooltip inside a confirm, the
 * A4 preview over the studio). Each caller asks for the lock for as long as it is
 * open and the page is released only when the last one closes — a naive
 * `overflow: hidden` / restore pair from two components re-enables scrolling for
 * whichever one closed second.
 *
 * The lock is applied to <html>, not <body>. `html { scrollbar-gutter: stable }`
 * (globals.css) reserves the scrollbar's width whether or not a scrollbar is
 * showing, so locking cannot reflow the page by 15px — which matters here because
 * that reflow would resize the A4 preview's well and change its zoom.
 */
import * as React from "react";

let locks = 0;

export function useScrollLock(active: boolean) {
  React.useEffect(() => {
    if (!active) return;
    locks += 1;
    if (locks === 1) document.documentElement.style.overflow = "hidden";
    return () => {
      locks -= 1;
      if (locks === 0) document.documentElement.style.overflow = "";
    };
  }, [active]);
}
