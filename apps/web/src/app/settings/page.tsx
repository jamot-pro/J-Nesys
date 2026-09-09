"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Cpu,
  Layers,
  Lock,
  MemoryStick,
  Palette,
  Plug,
  Sparkles,
  UserRound,
} from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { useActiveOrg } from "@/components/settings/use-active-org";
import { SettingsLayout, type SettingsGroup, type SettingsSection } from "@/components/settings/settings-layout";
import {
  AppearanceSection,
  NotificationsSection,
} from "@/components/settings/personal-sections";
import {
  AccountProfileSection,
  PrivacySecuritySection,
  UnifiedConnectorsSection,
  UnifiedMemorySection,
  UnifiedSkillsSection,
  UnifiedWorkspaceSection,
} from "@/components/settings/consolidated-sections";
import { ModelsSection } from "@/components/settings/models-section";

export default function SettingsPage() {
  const { space, isOrg } = useActiveOrg();

  const groups = useMemo<SettingsGroup[]>(() => {
    const sections: SettingsSection[] = [
      {
        id: "account-profile",
        label: "Account & Profile",
        icon: UserRound,
        body: <AccountProfileSection />,
      },
      {
        id: "privacy-security",
        label: "Privacy & Security",
        icon: Lock,
        body: <PrivacySecuritySection />,
      },
      {
        id: "memory",
        label: "Memory",
        icon: MemoryStick,
        body: <UnifiedMemorySection />,
      },
      {
        id: "connectors",
        label: "Connectors",
        icon: Plug,
        body: <UnifiedConnectorsSection />,
      },
      {
        id: "models",
        label: "Models",
        icon: Cpu,
        body: <ModelsSection />,
      },
      {
        id: "skills",
        label: "Skills",
        icon: Sparkles,
        body: <UnifiedSkillsSection />,
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        body: <NotificationsSection />,
      },
      {
        id: "appearance",
        label: "Appearance",
        icon: Palette,
        body: <AppearanceSection />,
      },
    ];

    if (isOrg) {
      sections.push({
        id: "workspace",
        label: "Workspace",
        icon: Layers,
        body: <UnifiedWorkspaceSection />,
      });
    }

    return [{ title: space.name, sections }];
  }, [isOrg, space.name]);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <BrandLogo className="size-5" />
        </Link>
        <span className="font-display text-sm font-semibold">Settings</span>
      </header>
      <div className="min-h-0 flex-1">
        <SettingsLayout groups={groups} />
      </div>
    </div>
  );
}
