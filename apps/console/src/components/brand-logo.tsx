"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";
import { useActiveOrgBranding } from "@/components/settings/use-org-branding";

const LOGO_DIMENSIONS = { width: 425, height: 430 };

/** Renders the active org's logo when present, otherwise the Jamot brand.
 * `forceJamot` bypasses the org logo (e.g. super-admin console header). */
export function BrandLogo({
  className,
  alt,
  forceJamot = false,
}: {
  className?: string;
  alt?: string;
  forceJamot?: boolean;
}) {
  const { resolvedLogoUrl, name } = useActiveOrgBranding();
  const src = forceJamot ? null : resolvedLogoUrl;
  const imgAlt = forceJamot ? alt ?? "Jamot" : alt ?? (name || "Jamot");

  if (src) {
    return (
      <span
        className={cn("relative inline-block shrink-0 overflow-hidden", className)}
        aria-hidden={!alt}
      >
        <Image
          src={src}
          alt={imgAlt}
          width={LOGO_DIMENSIONS.width}
          height={LOGO_DIMENSIONS.height}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className={cn("relative inline-block shrink-0 overflow-hidden", className)}
      aria-hidden={!alt}
    >
      <Image
        src="/brand/jamot-logo.png"
        alt={imgAlt}
        width={LOGO_DIMENSIONS.width}
        height={LOGO_DIMENSIONS.height}
        priority
        className="absolute inset-0 h-full w-full object-contain dark:hidden"
      />
      <Image
        src="/brand/jamot-logo-white.webp"
        alt={imgAlt}
        width={LOGO_DIMENSIONS.width}
        height={LOGO_DIMENSIONS.height}
        priority
        className="absolute inset-0 hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}
