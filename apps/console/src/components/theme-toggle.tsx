"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

const ORDER = ["light", "dark"] as const;
type ThemeName = (typeof ORDER)[number];

const ICONS: Record<ThemeName, typeof Sun> = {
  light: Sun,
  dark: Moon,
};

const emptySubscribe = () => () => {};

function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const current: ThemeName = theme === "dark" ? "dark" : "light";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  const Icon = mounted ? ICONS[current] : Moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label="Toggle theme"
      onClick={() => setTheme(next)}
    >
      <Icon />
    </Button>
  );
}
