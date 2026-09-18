"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Mirrors OrgConsole.dc.html's `system-config` modal region. The mockup
 * itself only fully designs 4 of its 9 sections (Public profile,
 * Dreamspace, Apps, Models per its own readme) — this ports Public profile
 * pixel-for-pixel (the most detailed one) and leaves the rest as an honest
 * "not built yet" placeholder inside the same chrome, rather than
 * inventing content the mockup doesn't specify. Not wired to any backend.
 */

/** Copied verbatim from OrgConsole.dc.html's SECTIONS array (ids/labels;
 * `badge` is set to "Open" for whichever section is active, per its
 * `sections` binding). */
const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "dreamspace", label: "Dreamspace" },
  { id: "models", label: "Models" },
  { id: "connectors", label: "Connectors" },
  { id: "channels", label: "Channels" },
  { id: "apps", label: "Apps" },
  { id: "skills", label: "Skills" },
  { id: "memory", label: "Memory" },
  { id: "actors", label: "Actors" },
];

function ProfileSection() {
  return (
    <div className="max-w-[820px]">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-[260px] flex-1">
          <span className="text-[10px] tracking-[0.1em] text-accent-ink uppercase">Public profile</span>
          <h1 className="mt-1.5 text-[34px] leading-[1.1] tracking-[-0.02em]">Tell the web who you are.</h1>
          <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted-foreground">
            Everything you add here is what agents read when they look for someone who can do what you
            do. The fuller the profile, the better the work that finds you.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="relative flex size-32 items-center justify-center">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, oklch(0.68 0.19 111 / 0.52) 0%, oklch(0.68 0.19 111 / 0.24) 46%, transparent 72%)",
                filter: "blur(5.6px)",
              }}
            />
            <div
              className="absolute size-[67px] rounded-full"
              style={{
                background: "radial-gradient(circle at 34% 28%, oklch(0.46 0.16 111), oklch(0.30 0.13 111))",
                boxShadow: "0 0 29px oklch(0.68 0.19 111 / 0.62)",
              }}
            />
            <div className="relative flex flex-col items-center justify-center gap-px">
              <span className="font-display text-[28px] leading-none font-extrabold text-white">72</span>
              <span className="text-[9px] tracking-[0.1em] text-white/85 uppercase">Building</span>
            </div>
          </div>
          <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Aura</span>
        </div>
      </div>

      <div className="my-4 h-px bg-border" />

      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] bg-background px-4 py-3">
        <span className="text-[13px] text-muted-foreground">Your public link</span>
        <span className="font-display text-[15px] font-extrabold">jamot.pro/mara</span>
        <div className="ml-auto flex gap-2">
          <button className="flex h-10 min-w-[120px] items-center justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm hover:bg-muted">
            Copy link
          </button>
          <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90">
            View public page
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[var(--radius-md)] border border-border">
        <div
          className="flex h-[170px] items-end justify-between px-4 py-3"
          style={{
            background:
              "repeating-linear-gradient(135deg, var(--background) 0 12px, var(--card) 12px 24px)",
          }}
        >
          <span className="font-mono text-[11px] text-muted-foreground">banner image — 1500 × 500</span>
          <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border bg-card px-4 text-sm hover:bg-muted">
            Upload banner
          </button>
        </div>
        <div className="-mt-10 flex flex-wrap items-end gap-4 px-4 pb-4">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border-[3px] border-card bg-background" />
          <button className="mb-1.5 flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border bg-card px-4 text-sm hover:bg-muted">
            Upload portrait
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="relative flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Dream statement</label>
            <textarea
              rows={3}
              defaultValue="Give small operators the same leverage as large ones — agentic infrastructure that pays out in outcomes, not seats."
              className="rounded-[var(--radius-sm)] border border-border bg-background p-2.5 text-sm outline-none focus:border-space-accent"
            />
            <button
              title="Improve this statement with AI"
              className="absolute top-[-4px] right-0 flex h-[26px] items-center gap-1.5 rounded-full border border-border px-2.5 text-[11px] tracking-[0.06em] text-accent-ink uppercase hover:bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)]"
            >
              <Sparkles className="size-[13px]" />
              Improve with AI
            </button>
          </div>
        </div>
      </div>

      <h2 className="mt-6 mb-3 text-xl">Identity</h2>
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Name", value: "Mara" },
          { label: "Surname", value: "Jansen" },
          { label: "Nickname — handle", value: "mara" },
          { label: "Headline", value: "Operations lead — agentic systems" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <input
              defaultValue={f.value}
              className="h-10 rounded-[var(--radius-sm)] border border-border bg-background px-3 text-sm outline-none focus:border-space-accent"
            />
          </div>
        ))}
      </div>

      <h2 className="mt-6 mb-1.5 text-xl">Skills, ask and offer</h2>
      <p className="mb-3 max-w-[64ch] text-[13px] leading-relaxed text-muted-foreground">
        This is the part agents read first. Skills say what you master, Ask says what you want from
        them, Offer says what they get from working with you.
      </p>
      <div className="flex flex-col gap-3">
        {[
          { label: "Skills", hint: "What you master", items: ["Grid engineering", "Dutch translation"], placeholder: "Add a skill, press Enter" },
          { label: "Ask", hint: "What you want from them", items: ["Introductions to funders"], placeholder: "Add an ask, press Enter" },
          { label: "Offer", hint: "What they get from you", items: ["Fast turnaround, async-friendly"], placeholder: "Add an offer, press Enter" },
        ].map((g) => (
          <div key={g.label} className="rounded-[var(--radius-md)] bg-background px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-display text-[13px] font-extrabold tracking-[0.1em] uppercase">{g.label}</span>
              <span className="text-xs text-muted-foreground">{g.hint}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {g.items.map((it) => (
                <span key={it} className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1.5 pr-2 pl-3 text-sm">
                  {it}
                  <button title="Remove" className="flex size-[18px] items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground">
                    <X className="size-[11px]" />
                  </button>
                </span>
              ))}
              <input
                placeholder={g.placeholder}
                className="h-[33px] min-w-[200px] flex-1 rounded-[var(--radius-sm)] border border-border bg-card px-2.5 text-sm outline-none focus:border-space-accent"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="my-6 h-px bg-border" />
      <div className="flex flex-wrap gap-2 pb-6">
        <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] bg-space-accent px-4 text-sm font-medium text-space-accent-foreground hover:opacity-90">
          Save and publish
        </button>
        <button className="flex h-10 items-center justify-start rounded-[var(--radius-sm)] border border-border px-4 text-sm hover:bg-muted">
          Save as draft
        </button>
      </div>
    </div>
  );
}

function UnbuiltSection({ label }: { label: string }) {
  return (
    <div className="flex max-w-[820px] flex-col gap-2 py-10 text-center">
      <span className="font-display text-lg font-bold">{label}</span>
      <p className="text-sm text-muted-foreground">
        This section&apos;s exact layout from the mockup hasn&apos;t been ported yet.
      </p>
    </div>
  );
}

export function SystemConfigModal({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState("profile");

  return (
    <div
      className="fixed inset-0 z-40 flex p-8"
      style={{ background: "color-mix(in srgb, #201e1d 26%, transparent)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex min-w-0 max-w-[1180px] flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] bg-card shadow-[var(--shadow-lg)]"
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <BrandLogo className="size-6" />
          <span className="font-display text-[15px] font-extrabold tracking-[0.08em] uppercase">
            System configuration
          </span>
          <span className="text-[11px] tracking-[0.08em] text-muted-foreground uppercase">Northbound Collective</span>
          <button
            onClick={onClose}
            title="Close"
            className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] hover:bg-background"
          >
            <X className="size-[18px]" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="w-[232px] shrink-0 overflow-y-auto border-r border-border py-3">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className="mx-2 flex w-[calc(100%-16px)] items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-sm hover:bg-[color-mix(in_srgb,var(--foreground)_7%,transparent)]"
                style={active === s.id ? { background: "color-mix(in srgb, var(--foreground) 7%, transparent)" } : undefined}
              >
                <span className="flex-1">{s.label}</span>
                {active === s.id ? (
                  <span className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase">Open</span>
                ) : null}
              </button>
            ))}
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto px-6 pt-6 pb-8">
            {active === "profile" ? (
              <ProfileSection />
            ) : (
              <UnbuiltSection label={SECTIONS.find((s) => s.id === active)?.label ?? ""} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
