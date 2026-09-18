"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getOrganizationTelegramConfig,
  updateOrganizationTelegramConfig,
} from "@/lib/api-client";
import { Card, Field, SectionHeading } from "./section-primitives";

/**
 * Super-admin-only Telegram Mini App config for one organization: bot token
 * (write-only — never re-displayed once saved, only "configured" or not),
 * bot username, and the Mini App's display name/URL.
 */
export function OrgTelegramSection({
  organizationId,
  onChanged,
}: {
  organizationId: string;
  onChanged?: () => void;
}) {
  const [hasBotToken, setHasBotToken] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [miniAppName, setMiniAppName] = useState("");
  const [miniAppUrl, setMiniAppUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    getOrganizationTelegramConfig(organizationId)
      .then((data) => {
        if (cancelled) return;
        setHasBotToken(data.hasBotToken);
        setBotToken("");
        setBotUsername(data.botUsername ?? "");
        setMiniAppName(data.miniAppName ?? "");
        setMiniAppUrl(data.miniAppUrl ?? "");
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load Telegram config");
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
      const data = await updateOrganizationTelegramConfig(organizationId, {
        // Blank input means "leave the stored token alone" unless the org has
        // none yet, in which case there is nothing to leave alone.
        botToken: botToken.trim() ? botToken.trim() : undefined,
        botUsername: botUsername.trim() || null,
        miniAppName: miniAppName.trim() || null,
        miniAppUrl: miniAppUrl.trim() || null,
      });
      setHasBotToken(data.hasBotToken);
      setBotToken("");
      setSaved(true);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save Telegram config");
    } finally {
      setSaving(false);
    }
  };

  const clearToken = async () => {
    if (!organizationId || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const data = await updateOrganizationTelegramConfig(organizationId, { botToken: null });
      setHasBotToken(data.hasBotToken);
      setBotToken("");
      setSaved(true);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear bot token");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Telegram Mini App"
        description="This organization's own Telegram bot and Mini App, separate from the platform's global bot."
      />
      <Card className="flex max-w-xl flex-col gap-4">
        <Field
          label="Bot token"
          hint={
            hasBotToken
              ? "A token is already saved — leave blank to keep it, or enter a new one to replace it."
              : "From @BotFather. Stored, never shown again once saved."
          }
        >
          <div className="flex items-center gap-1.5">
            <Input
              type="password"
              placeholder={hasBotToken ? "•••••••••••••• (unchanged)" : "123456:AAExampleTokenHere"}
              value={botToken}
              disabled={loading}
              onChange={(e) => {
                setBotToken(e.target.value);
                setSaved(false);
              }}
            />
            {hasBotToken ? (
              <Button variant="ghost" size="sm" onClick={() => void clearToken()} disabled={saving}>
                Clear
              </Button>
            ) : null}
          </div>
        </Field>

        <Field label="Bot username" hint="Without the @, e.g. acme_org_bot">
          <Input
            placeholder="acme_org_bot"
            value={botUsername}
            disabled={loading}
            onChange={(e) => {
              setBotUsername(e.target.value);
              setSaved(false);
            }}
          />
        </Field>

        <Field label="Mini App name">
          <Input
            placeholder="Acme"
            value={miniAppName}
            disabled={loading}
            onChange={(e) => {
              setMiniAppName(e.target.value);
              setSaved(false);
            }}
          />
        </Field>

        <Field label="Mini App URL" hint="The web app URL registered with BotFather (/newapp).">
          <Input
            placeholder="https://sales.jamot.pro"
            value={miniAppUrl}
            disabled={loading}
            onChange={(e) => {
              setMiniAppUrl(e.target.value);
              setSaved(false);
            }}
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
