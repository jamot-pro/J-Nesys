import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-xl border border-border/60 bg-card/80 px-3 py-1.5 text-xs shadow-2xs transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-space-accent/40 focus-visible:ring-2 focus-visible:ring-space-accent/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
