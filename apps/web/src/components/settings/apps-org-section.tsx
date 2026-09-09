"use client";

import { AppWindow } from "lucide-react";

import { Card, SectionHeading } from "./section-primitives";
import { useActiveOrg } from "./use-active-org";
import { OrgAppsList } from "./org-apps-list";

export function AppsOrgSection() {
  const { isOrg, organizationId, isAdmin } = useActiveOrg();

  if (!isOrg || !organizationId) {
    return (
      <div>
        <SectionHeading title="Apps" description="Apps connected to the organization." />
        <Card className="max-w-xl">
          <div className="flex items-center gap-3">
            <AppWindow className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Open an organization space to manage its apps.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading title="Apps" description="Apps connected to the organization." />
      <OrgAppsList organizationId={organizationId} canEdit={isAdmin} />
    </div>
  );
}