"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  activateOutreachCampaign,
  addOutreachStep,
  completeOutreachCampaign,
  deleteOutreachCampaign,
  deleteOutreachStep,
  getOutreachCampaignDetail,
  pauseOutreachCampaign,
  type OutreachCampaignDetail as Detail,
} from "@/lib/api-client";

const SEND_LABEL: Record<Detail["sends"][number]["status"], string> = {
  queued: "Queued",
  delegated: "Delegated",
  sent: "Sent",
  replied: "Replied",
  completed: "Completed",
  failed: "Failed",
};

export function CampaignDetail({
  campaignId,
  onBack,
  onDeleted,
}: {
  campaignId: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setDetail(await getOutreachCampaignDetail(campaignId));
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    getOutreachCampaignDetail(campaignId)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Could not load campaign");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    await run(async () => {
      await deleteOutreachCampaign(campaignId);
      onDeleted();
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" /> Loading campaign…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Campaign not found"}</p>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-1.5 size-4" /> Back
        </Button>
      </div>
    );
  }

  const { campaign, steps, sends, list, agent } = detail;
  const active = campaign.status === "active";

  const addStep = async () => {
    await run(async () => {
      await addOutreachStep(campaignId, {
        position: steps.length,
        sendAfterDays: 0,
        channel: "whatsapp",
        template: "",
        instructions: "",
      });
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
        <Button variant="ghost" size="icon" className="size-7" aria-label="Back" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {campaign.name}
        </span>
        <Badge
          variant={active ? "accent" : "secondary"}
          className="px-1.5 text-[10px]"
        >
          {campaign.status}
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <section className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3">
            <h4 className="text-xs font-medium text-muted-foreground">Goal</h4>
            <p className="text-sm">{campaign.goal}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>
                List: <span className="text-foreground">{list?.name ?? "—"}</span>
                {list ? ` (${list.memberCount})` : ""}
              </span>
              <span>
                Agent: <span className="text-foreground">{agent?.displayName ?? "—"}</span>
              </span>
              {campaign.startedAt ? (
                <span>
                  Started:{" "}
                  <span className="text-foreground">
                    {new Date(campaign.startedAt).toLocaleDateString()}
                  </span>
                </span>
              ) : null}
            </div>
          </section>

          <section className="flex flex-wrap gap-2">
            {campaign.status === "draft" || campaign.status === "paused" ? (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void run(() => activateOutreachCampaign(campaignId))}
              >
                <Play className="mr-1 size-3.5" /> Activate
              </Button>
            ) : null}
            {active ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void run(() => pauseOutreachCampaign(campaignId))}
              >
                <Pause className="mr-1 size-3.5" /> Pause
              </Button>
            ) : null}
            {campaign.status === "active" || campaign.status === "paused" ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void run(() => completeOutreachCampaign(campaignId))}
              >
                <CheckCircle2 className="mr-1 size-3.5" /> Complete
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600"
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="mr-1 size-3.5" /> Delete
            </Button>
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-medium text-muted-foreground">
                Sequence ({steps.length})
              </h4>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void addStep()}>
                + Add step
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No steps yet. Add a step to define the sequence.
                </p>
              ) : (
                steps.map((step, index) => (
                  <div
                    key={step.id}
                    className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/30 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">
                        Step {index + 1} · {step.sendAfterDays}d · {step.channel}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        aria-label="Remove step"
                        onClick={() =>
                          void run(() => deleteOutreachStep(campaignId, step.id))
                        }
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                    {step.subject ? (
                      <p className="text-xs font-medium">{step.subject}</p>
                    ) : null}
                    {step.template ? (
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        {step.template}
                      </p>
                    ) : null}
                    {step.instructions ? (
                      <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Instructions: </span>
                        {step.instructions}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h4 className="text-xs font-medium text-muted-foreground">
              Send log ({sends.length})
            </h4>
            {sends.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sends yet. Activate the campaign to delegate work to the agent.
              </p>
            ) : (
              <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                {sends.map((send) => (
                  <div
                    key={send.id}
                    className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate text-muted-foreground">{send.personId}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span>{new Date(send.scheduledAt).toLocaleDateString()}</span>
                      <Badge variant="secondary" className="px-1.5 text-[10px]">
                        {SEND_LABEL[send.status]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}