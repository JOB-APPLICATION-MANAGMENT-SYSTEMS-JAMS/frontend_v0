"use client";

/**
 * Provider stack (§4.2 adapted): React Query → theme → density → Prism shutter → toasts.
 * The branded transition sits outside theme so it survives theme swaps; the shutter
 * only fires on route-GROUP changes (never same-group routes) per §15.1.
 */
import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { getQueryClient } from "@/lib/queries";
import { routeGroup } from "@/lib/route-config";
import { ToastHost } from "@/components/ui/feedback";
import { PrismShutter } from "@/components/motion/prism-shutter";

export type Density = "compact" | "comfortable" | "spacious";
const DensityCtx = React.createContext<{ density: Density; setDensity: (d: Density) => void }>({
  density: "comfortable",
  setDensity: () => {},
});
export const useDensity = () => React.useContext(DensityCtx);

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(getQueryClient);
  const [density, setDensityState] = React.useState<Density>("comfortable");
  const [shutter, setShutter] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const groupRef = React.useRef(routeGroup(pathname));

  React.useEffect(() => {
    const stored = (localStorage.getItem("jams:density") as Density) || "comfortable";
    setDensityState(stored);
  }, []);

  const setDensity = React.useCallback((d: Density) => {
    setDensityState(d);
    localStorage.setItem("jams:density", d);
  }, []);

  // Prism Shutter: fire when the route GROUP changes (§15.1), fast-forward on input (3s rule)
  React.useEffect(() => {
    const next = routeGroup(pathname);
    if (next === groupRef.current) return;
    groupRef.current = next;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setShutter(true);
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
  }, [pathname]);

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        <DensityCtx.Provider value={{ density, setDensity }}>
          {children}
          <PrismShutter active={shutter} />
          <ToastHost />
        </DensityCtx.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
