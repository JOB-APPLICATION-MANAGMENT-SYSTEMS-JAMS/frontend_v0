"use client";

/**
 * Provider stack (§4.2 adapted): React Query → theme → Prism shutter → toasts.
 * The branded transition sits outside theme so it survives theme swaps; the shutter
 * only fires on route-GROUP changes (never same-group routes) per §15.1.
 */
import * as React from "react";
import { usePathname } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { getQueryClient } from "@/lib/queries";
import { routeGroup } from "@/lib/route-config";
import { ToastHost } from "@/components/ui/feedback";
import { PrismShutter } from "@/components/motion/prism-shutter";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(getQueryClient);
  const pathname = usePathname();
  const group = routeGroup(pathname);
  const [activeGroup, setActiveGroup] = React.useState(group);
  const [shutter, setShutter] = React.useState(false);

  // route GROUP changed → flip the shutter while we render (adjust-during-render,
  // no setState-in-effect): the timer + input fast-forward live in the effect below
  if (group !== activeGroup) {
    setActiveGroup(group);
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) setShutter(true);
  }

  // Prism Shutter: hold it for 950ms, fast-forward on input (3s rule)
  React.useEffect(() => {
    if (!shutter) return;
    const timer = setTimeout(() => setShutter(false), 950);
    const fastForward = () => {
      setShutter(false);
      clearTimeout(timer);
    };
    window.addEventListener("keydown", fastForward);
    window.addEventListener("pointerdown", fastForward);
    return () => {
      window.removeEventListener("keydown", fastForward);
      window.removeEventListener("pointerdown", fastForward);
      clearTimeout(timer);
    };
  }, [shutter]);

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        {children}
        <PrismShutter active={shutter} />
        <ToastHost />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
