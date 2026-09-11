import type { CSSProperties } from "react";

/**
 * Builds the per-organization accent override.
 *
 * The design system's accent role is not one colour but a 100–900 OKLCH ramp:
 * .btn-primary:hover uses -600, :active -700, .tag-accent -100/-800, and
 * --accent-ink is -700. Overriding only --color-accent therefore produces a
 * half-branded console — a teal button with red tags — so every ramp step the
 * component layer actually references is derived here too.
 *
 * Steps are mixed toward --color-bg and --color-text rather than white/black
 * so they follow the dark theme (which redefines both) for free.
 *
 * This is an approximation: the shipped ramp is generated in OKLCH on a shared
 * perceptual lightness scale, which a per-request color-mix cannot reproduce.
 * An org that sets NO accent gets no override at all and keeps the real ramp —
 * which is why this returns undefined rather than always emitting variables.
 */
export function brandStyle(accent: string | undefined): CSSProperties | undefined {
  if (!accent) return undefined;

  const toBg = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, var(--color-bg))`;
  const toInk = (pct: number) => `color-mix(in srgb, ${accent} ${pct}%, var(--color-text))`;

  return {
    "--org-accent": accent,
    "--color-accent-100": toBg(12),
    "--color-accent-300": toBg(34),
    "--color-accent-400": toBg(58),
    "--color-accent-600": toInk(85),
    "--color-accent-700": toInk(70),
    "--color-accent-800": toInk(55),
  } as CSSProperties;
}
