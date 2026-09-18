"use client";

import { useEffect, useState } from "react";

export type Breakpoint = "desktop" | "tablet" | "mobile";

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("desktop");

  useEffect(() => {
    const md = window.matchMedia("(min-width: 768px)");
    const lg = window.matchMedia("(min-width: 1024px)");

    const update = () => {
      if (lg.matches) setBreakpoint("desktop");
      else if (md.matches) setBreakpoint("tablet");
      else setBreakpoint("mobile");
    };

    update();
    md.addEventListener("change", update);
    lg.addEventListener("change", update);

    return () => {
      md.removeEventListener("change", update);
      lg.removeEventListener("change", update);
    };
  }, []);

  return breakpoint;
}
