"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface DockPanelProps {
  title: string;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
}

export function DockPanel({ title, icon: Icon, children, className }: DockPanelProps) {
  return (
    <section className={cn("rounded-2xl border border-border/40 bg-card/60 p-3.5 shadow-xs backdrop-blur-xs", className)}>
      <header className="mb-2.5 flex items-center gap-2">
        {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
        <h3 className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground">{title}</h3>
      </header>
      <div className="flex min-h-12 items-center justify-center rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground/70">
        {children ?? "Nothing here yet"}
      </div>
    </section>
  );
}
