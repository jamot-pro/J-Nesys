import * as React from "react";

import { cn } from "@/lib/utils";

const avatarSizes = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
} as const;

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: keyof typeof avatarSizes;
  name?: string;
}

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, size = "md", name, children, ...props }, ref) => {
    const initials = name
      ? name
          .split(/\s+/)
          .map((word) => word[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : undefined;

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-space-accent/10 font-semibold text-space-accent shadow-2xs",
          avatarSizes[size],
          className,
        )}
        {...props}
      >
        {children ?? (initials ? <span>{initials}</span> : null)}
      </span>
    );
  },
);
Avatar.displayName = "Avatar";

export { Avatar };
