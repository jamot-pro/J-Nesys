"use client";

import { Network } from "lucide-react";

import { EmptyList } from "@/components/directory/EmptyList";
import { OrgChart } from "@/components/org-chart/OrgChart";
import { useAppShell } from "@/components/app-shell/app-shell-context";

export function OrganizationWorkspace() {
  const { space } = useAppShell();
  const orgId = space.kind === "organization" ? space.organizationId : undefined;

  if (!orgId) {
    return (
      <div className="h-full w-full">
        <EmptyList
          icon={Network}
          title="No organization structure here"
          description="This is your personal space. Switch to one of your organizations to view its canvas."
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <OrgChart key={orgId} orgId={orgId} />
    </div>
  );
}