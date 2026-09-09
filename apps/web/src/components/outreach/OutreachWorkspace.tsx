"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Megaphone, Plus } from "lucide-react";

import { EmptyList } from "@/components/directory/EmptyList";
import { DirectoryToolbar } from "@/components/directory/DirectoryToolbar";
import { useAppShell } from "@/components/app-shell/app-shell-context";
import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import {
  listOutreachCampaigns,
  type OutreachCampaign,
} from "@/lib/api-client";

import { CreateCampaign } from "./CreateCampaign";
import { CampaignDetail } from "./CampaignDetail";

const STATUS_LABEL: Record<OutreachCampaign["status"], string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
};

function CampaignCard({
  campaign,
  onOpen,
}: {
  campaign: OutreachCampaign;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{campaign.name}</span>
        <Badge
          variant={campaign.status === "active" ? "accent" : "secondary"}
          className="px-1.5 text-[10px]"
        >
          {STATUS_LABEL[campaign.status]}
        </Badge>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{campaign.goal}</p>
    </button>
  );
}

export function OutreachWorkspace() {
  const { space } = useAppShell();
  const { user } = useAuth();
  const orgId = space.kind === "organization" ? space.organizationId : undefined;
  return (
    <OutreachDirectory
      key={space.id}
      orgId={orgId}
      spaceId={space.spaceId ?? user?.person?.membershipSpaceIds[0] ?? null}
      isOrganization={space.kind === "organization"}
    />
  );
}

function OutreachDirectory({
  orgId,
  spaceId,
  isOrganization,
}: {
  orgId: string | undefined;
  spaceId: string | null;
  isOrganization: boolean;
}) {
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      if (spaceId) setCampaigns(await listOutreachCampaigns(spaceId));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!spaceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no space to load campaigns for
      setLoading(false);
      setCampaigns([]);
      return;
    }
    listOutreachCampaigns(spaceId)
      .then((items) => {
        if (!cancelled) setCampaigns(items);
      })
      .catch(() => {
        if (!cancelled) setCampaigns([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  const visible = useMemo(() => campaigns, [campaigns]);

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {selectedId ? (
        <CampaignDetail
          key={selectedId}
          campaignId={selectedId}
          onBack={() => setSelectedId(null)}
          onDeleted={() => {
            setSelectedId(null);
            void reload();
          }}
        />
      ) : (
        <>
          <DirectoryToolbar
            placeholder="Search campaigns…"
            query=""
            loading={false}
            onQueryChange={() => undefined}
            onSubmit={() => undefined}
            onClear={() => undefined}
            actionLabel="New campaign"
            actionIcon={<Plus className="size-3.5" />}
            onAction={() => {
              if (spaceId) setCreating(true);
            }}
          />

          <section className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="flex min-h-0 flex-1">
                <EmptyList
                  icon={Loader2}
                  title="Loading campaigns…"
                  description="Fetching outreach campaigns."
                />
              </div>
            ) : visible.length === 0 ? (
              <div className="flex min-h-0 flex-1">
                <EmptyList
                  icon={Megaphone}
                  title="No outreach campaigns yet"
                  description={
                    isOrganization
                      ? "Create a campaign to reach out to a People list with an assigned agent."
                      : "Open an organization space to run outreach campaigns."
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
                {visible.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onOpen={() => setSelectedId(campaign.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <AnimatePresence>
        {creating && spaceId ? (
          <>
            <motion.div
              className="absolute inset-0 z-20 bg-black/20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreating(false)}
            />
            <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto p-4">
              <motion.div
                className="my-auto w-full max-w-lg"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ type: "tween", duration: 0.15 }}
              >
                <CreateCampaign
                  spaceId={spaceId}
                  orgId={orgId}
                  onCreated={(id) => {
                    setCreating(false);
                    setSelectedId(id);
                  }}
                  onDone={() => setCreating(false)}
                />
              </motion.div>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}