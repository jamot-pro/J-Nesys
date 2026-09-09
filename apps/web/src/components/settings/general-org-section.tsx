"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getOrganization,
  updateOrganizationDream,
  type Organization,
} from "@/lib/api-client";
import { Card, Field, SectionHeading } from "./section-primitives";
import { useActiveOrg } from "./use-active-org";

export function GeneralOrgSection() {
  const { isOrg, organizationId, space, isAdmin } = useActiveOrg();
  const [, setOrg] = useState<Organization | null>(null);
  const [dreamDraft, setDreamDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    getOrganization(organizationId)
      .then((data) => {
        if (cancelled) return;
        setOrg(data);
        setDreamDraft(data.dream ?? "");
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load organization");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const saveDream = async () => {
    if (!organizationId || !isAdmin) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const updated = await updateOrganizationDream(organizationId, dreamDraft);
      setOrg(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save dream");
    } finally {
      setSaving(false);
    }
  };

  if (!isOrg || !organizationId) {
    return (
      <div>
        <SectionHeading title="General" description="Organization-wide settings." />
        <Card className="max-w-xl">
          <div className="flex items-center gap-3">
            <Building2 className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Open an organization space to manage its settings.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading title="General" description="Organization-wide settings." />
      <Card className="flex max-w-xl flex-col gap-4">
        <Field label="Name">
          <Input value={space.name} readOnly disabled />
        </Field>

        <Field label="Dream" hint="The long-term vision this organization is working toward.">
          <textarea
            rows={4}
            value={dreamDraft}
            disabled={!isAdmin || loading}
            onChange={(event) => {
              setDreamDraft(event.target.value);
              setSaved(false);
            }}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </Field>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {saved ? (
          <p className="text-sm text-emerald-600">Dream saved.</p>
        ) : null}

        {isAdmin ? (
          <div className="flex justify-end">
            <Button onClick={() => void saveDream()} disabled={saving || loading}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only admins and owners can edit the organization dream.
          </p>
        )}
      </Card>
    </div>
  );
}