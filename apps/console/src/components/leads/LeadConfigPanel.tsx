"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { LeadArea, LeadPersona, LeadProviderView } from "@/lib/api-client";

function comma(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function LeadConfigPanel({
  area,
  providers,
  providerId,
  onProviderChange,
  persona,
  onPersonaChange,
  name,
  onNameChange,
  onSave,
  saving,
}: {
  area: LeadArea | null;
  providers: LeadProviderView[];
  providerId: string;
  onProviderChange: (id: string) => void;
  persona: LeadPersona;
  onPersonaChange: (persona: LeadPersona) => void;
  name: string;
  onNameChange: (name: string) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const [titlesText, setTitlesText] = useState(persona.titles.join(", "));
  const [industriesText, setIndustriesText] = useState(persona.industries.join(", "));
  const [companySizesText, setCompanySizesText] = useState(persona.companySizes.join(", "));
  const [keywordsText, setKeywordsText] = useState(persona.keywords.join(", "));

  const selectedProvider = providers.find((p) => p.id === providerId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Research name</label>
        <Input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="e.g. Paris fintech CTOs"
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Target persona</label>
        <p className="text-xs text-muted-foreground">
          Tip: describe this in natural language in chat (e.g. “find CTOs of fintechs under 200 employees”) and the agent will fill this in.
        </p>
        <Input
          value={titlesText}
          onChange={(event) => {
            setTitlesText(event.target.value);
            onPersonaChange({ ...persona, titles: comma(event.target.value) });
          }}
          placeholder="Titles (e.g. CTO, VP Engineering)"
          className="h-9"
        />
        <Input
          value={industriesText}
          onChange={(event) => {
            setIndustriesText(event.target.value);
            onPersonaChange({ ...persona, industries: comma(event.target.value) });
          }}
          placeholder="Industries (e.g. fintech, saas)"
          className="h-9"
        />
        <Input
          value={companySizesText}
          onChange={(event) => {
            setCompanySizesText(event.target.value);
            onPersonaChange({ ...persona, companySizes: comma(event.target.value) });
          }}
          placeholder="Company sizes (e.g. 11-50, 51-200)"
          className="h-9"
        />
        <Input
          value={keywordsText}
          onChange={(event) => {
            setKeywordsText(event.target.value);
            onPersonaChange({ ...persona, keywords: comma(event.target.value) });
          }}
          placeholder="Keywords (comma separated)"
          className="h-9"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Provider</label>
        <select
          value={providerId}
          onChange={(event) => onProviderChange(event.target.value)}
          className="h-9 rounded-md border border-border bg-transparent px-2 text-sm"
        >
          <option value="" disabled>
            Select a provider…
          </option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.label}
              {provider.configured ? "" : " (not configured)"}
            </option>
          ))}
        </select>
        {selectedProvider ? (
          <p className="text-xs text-muted-foreground">
            {selectedProvider.configured
              ? selectedProvider.detail || "Ready to use."
              : "This provider is not configured. Configure its API key or connection in Settings → Vault."}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={onSave} disabled={saving || !area || !name.trim()}>
          {saving ? "Creating…" : "Create Lead List"}
        </Button>
      </div>
    </div>
  );
}