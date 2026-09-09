"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getOrganization,
  updateOrganization,
  uploadOrganizationLogo,
  type Organization,
} from "@/lib/api-client";
import { Card, Field, SectionHeading } from "./section-primitives";
import { resolveLogoUrl } from "./use-org-branding";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN;

/** Super-admin-only org-level settings: name, subdomain slug, logo, dream. */
export function OrgSettingsSection({
  organizationId,
  onChanged,
}: {
  organizationId: string;
  onChanged?: () => void;
}) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [dream, setDream] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    getOrganization(organizationId)
      .then((data) => {
        if (cancelled) return;
        setOrg(data);
        setName("");
        setSlug(data.slug ?? "");
        setDream(data.dream ?? "");
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

  const save = async () => {
    if (!organizationId || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await updateOrganization(organizationId, {
        name: name.trim() || undefined,
        slug: slug.trim() || null,
        dream: dream ?? undefined,
      });
      setSaved(true);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !organizationId || uploading) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const { logoUrl } = await uploadOrganizationLogo(organizationId, dataUri);
      setOrg((prev) => (prev ? { ...prev, logoUrl } : prev));
      setSaved(true);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload logo");
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    if (!organizationId || !org?.logoUrl) return;
    setSaving(true);
    setError(null);
    try {
      await updateOrganization(organizationId, { logoUrl: null });
      setOrg((prev) => (prev ? { ...prev, logoUrl: null } : prev));
      setSaved(true);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove logo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Organization settings"
        description="Only super admins can change these. Name, subdomain, logo and vision."
      />
      <Card className="flex max-w-xl flex-col gap-4">
        <Field label="Name">
          <Input
            placeholder="Organization name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
        </Field>

        <Field
          label="Subdomain"
          hint={ROOT_DOMAIN ? `Visitors reach this org at ${slug || "…"}.${ROOT_DOMAIN}` : undefined}
        >
          <div className="flex items-center gap-1.5">
            <Input
              placeholder="organization"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setSaved(false);
              }}
            />
            {ROOT_DOMAIN ? <span className="text-sm text-muted-foreground">.{ROOT_DOMAIN}</span> : null}
          </div>
        </Field>

        <div>
          <span className="mb-1.5 block text-sm font-medium">Logo</span>
          {org?.logoUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveLogoUrl(org.logoUrl) ?? ""}
                alt="Organization logo"
                className="size-12 rounded-md border border-border object-contain"
              />
              <Button variant="ghost" size="sm" onClick={() => void removeLogo()} disabled={saving}>
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            </div>
          ) : (
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="size-3.5" />
                )}
                {uploading ? "Uploading…" : "Upload logo"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
            </div>
          )}
        </div>

        <Field label="Dream" hint="The long-term vision this organization is working toward.">
          <textarea
            rows={3}
            value={dream}
            disabled={loading}
            onChange={(event) => {
              setDream(event.target.value);
              setSaved(false);
            }}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </Field>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-600">Saved.</p> : null}

        <div className="flex justify-end">
          <Button onClick={() => void save()} disabled={saving || loading}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
