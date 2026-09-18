"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { z } from "zod";
import {
  Copy,
  Eye,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  CopilotChat,
  useAgentContext,
  useFrontendTool,
} from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

import { Button } from "@/components/ui/button";
import {
  createSkill,
  deleteSkill,
  listSkills,
  updateSkill,
  type ApiSkill,
} from "@/lib/api-client";
import { useActiveOrg } from "./use-active-org";
import { cn } from "@/lib/utils";

type SkillStatus = "draft" | "validated" | "deprecated";

const STATUS_LABELS: Record<SkillStatus, string> = {
  draft: "Draft",
  validated: "Validated",
  deprecated: "Deprecated",
};

const NEW_SKILL_TEMPLATE = `# Skill name

## Purpose

What this skill does and when it should run.

## Inputs

- ...

## Process

1. ...

## Constraints

- Never ...

## Output

- ...
`;

export function SkillsManager() {
  const { isOrg, organizationId, isAdmin } = useActiveOrg();
  const [personal, setPersonal] = useState<ApiSkill[]>([]);
  const [orgSkills, setOrgSkills] = useState<ApiSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ApiSkill | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, shared] = await Promise.all([
        listSkills(),
        isOrg && organizationId ? listSkills(organizationId) : Promise.resolve([]),
      ]);
      setPersonal(mine.filter((s) => !s.ownerOrganizationId));
      setOrgSkills(shared);
    } catch {
      setPersonal([]);
      setOrgSkills([]);
    } finally {
      setLoading(false);
    }
  }, [isOrg, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (s: ApiSkill) =>
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.body.toLowerCase().includes(q);
    return {
      personal: personal.filter(match),
      org: orgSkills.filter(match),
    };
  }, [personal, orgSkills, search]);

  if (selected || creating) {
    return (
      <SkillEditor
        skill={selected}
        orgId={isOrg ? organizationId : null}
        canShareToOrg={isOrg && isAdmin}
        onSaved={() => {
          setSelected(null);
          setCreating(false);
          void load();
        }}
        onDeleted={() => {
          setSelected(null);
          void load();
        }}
        onClose={() => {
          setSelected(null);
          setCreating(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search skills…"
            className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-space-accent"
          />
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> New skill
        </Button>
      </div>

      {loading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : personal.length === 0 && orgSkills.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No skills yet. A skill is reusable capability written in Markdown —
          create one to teach Jamot how to do a job.
        </p>
      ) : (
        <>
          <SkillGroup
            title="My skills"
            skills={filtered.personal}
            onOpen={setSelected}
          />
          {isOrg ? (
            <SkillGroup
              title="Shared skills"
              skills={filtered.org}
              onOpen={setSelected}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function SkillGroup({
  title,
  skills,
  onOpen,
}: {
  title: string;
  skills: ApiSkill[];
  onOpen: (skill: ApiSkill) => void;
}) {
  if (skills.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-col gap-1.5">
        {skills.map((skill) => (
          <li key={skill.id}>
            <button
              type="button"
              onClick={() => onOpen(skill)}
              className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
            >
              <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{skill.name}</span>
                {skill.description ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {skill.description}
                  </span>
                ) : null}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  skill.status === "validated"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : skill.status === "deprecated"
                      ? "bg-muted text-muted-foreground line-through"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                )}
              >
                {STATUS_LABELS[(skill.status as SkillStatus) ?? "draft"] ?? skill.status}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkillEditor({
  skill,
  orgId,
  canShareToOrg,
  onSaved,
  onDeleted,
  onClose,
}: {
  skill: ApiSkill | null;
  orgId: string | null;
  canShareToOrg: boolean;
  onSaved: () => void;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(skill?.name ?? "");
  const [description, setDescription] = useState(skill?.description ?? "");
  const [body, setBody] = useState(skill?.body ?? NEW_SKILL_TEMPLATE);
  const [status, setStatus] = useState<SkillStatus>(
    (skill?.status as SkillStatus) ?? "draft",
  );
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareWithOrg, setShareWithOrg] = useState(Boolean(skill?.ownerOrganizationId));
  const [suggestion, setSuggestion] = useState<{ body: string; summary: string } | null>(
    null,
  );

  useAgentContext({
    description: "The Jamot skill Markdown currently being edited",
    value: { name, description, body, status },
  });

  useFrontendTool({
    name: "applySkillSuggestion",
    description:
      "Stage a proposed revision of the skill Markdown for the user to preview. The suggestion is NOT applied automatically — the user reviews and accepts it.",
    parameters: z.object({
      proposedMarkdown: z
        .string()
        .describe("The FULL proposed Markdown for the skill"),
      summary: z
        .string()
        .describe("One line describing what changed and why"),
    }),
    handler: async ({ proposedMarkdown, summary }) => {
      setSuggestion({ body: proposedMarkdown, summary });
      setPreview(true);
      return "Suggestion staged for preview.";
    },
  });

  const save = async () => {
    if (!name.trim()) {
      setError("Give the skill a name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (skill) {
        await updateSkill(skill.id, {
          name: name.trim(),
          description: description.trim(),
          body,
          status,
        });
      } else {
        await createSkill({
          name: name.trim(),
          description: description.trim(),
          body,
          status,
          ownerOrganizationId:
            canShareToOrg && shareWithOrg && orgId ? orgId : undefined,
          provenance: { source: "self_declared", confidence: 1 },
        });
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save skill.");
      setSaving(false);
    }
  };

  const duplicate = async () => {
    setSaving(true);
    try {
      await createSkill({
        name: `${name.trim()} (copy)`,
        description: description.trim(),
        body,
        status: "draft",
        provenance: { source: "self_declared", confidence: 1 },
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not duplicate skill.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!skill) return;
    setSaving(true);
    try {
      await deleteSkill(skill.id);
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete skill.");
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back to skills"
        >
          <X className="size-4" />
        </button>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Skill name"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm font-medium outline-none focus:ring-1 focus:ring-space-accent"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as SkillStatus)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          <option value="draft">Draft</option>
          <option value="validated">Validated</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </div>

      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="One-line description"
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-space-accent"
      />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPreview(false)}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
            !preview ? "bg-muted text-foreground" : "text-muted-foreground",
          )}
        >
          <Pencil className="size-3" /> Edit
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
            preview ? "bg-muted text-foreground" : "text-muted-foreground",
          )}
        >
          <Eye className="size-3" /> Preview
        </button>
      </div>

      {suggestion ? (
        <div className="rounded-md border border-space-accent/40 bg-space-accent/5 p-3">
          <p className="text-xs font-medium">AI suggestion</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{suggestion.summary}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                setBody(suggestion.body);
                setSuggestion(null);
              }}
            >
              Apply to editor
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSuggestion(null)}>
              Discard
            </Button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="max-h-96 min-h-48 w-full overflow-y-auto rounded-md border border-border bg-background p-3 text-sm">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: (props) => <h1 className="mb-2 mt-3 text-base font-semibold" {...props} />,
              h2: (props) => <h2 className="mb-1.5 mt-3 text-sm font-semibold" {...props} />,
              h3: (props) => <h3 className="mb-1 mt-2 text-sm font-medium" {...props} />,
              p: (props) => <p className="mb-2 leading-relaxed" {...props} />,
              ul: (props) => <ul className="mb-2 list-disc pl-5" {...props} />,
              ol: (props) => <ol className="mb-2 list-decimal pl-5" {...props} />,
              li: (props) => <li className="mb-0.5" {...props} />,
              code: (props) => (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...props} />
              ),
              strong: (props) => <strong className="font-semibold" {...props} />,
            }}
          >
            {suggestion ? suggestion.body : body}
          </ReactMarkdown>
        </div>
      ) : (
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={16}
          spellCheck={false}
          className="w-full rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:ring-1 focus:ring-space-accent"
        />
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {skill ? "Save changes" : "Create skill"}
        </Button>
        {skill ? (
          <>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void duplicate()}>
              <Copy className="size-3.5" /> Duplicate
            </Button>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void remove()}>
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </>
        ) : canShareToOrg ? (
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={shareWithOrg}
              onChange={(event) => setShareWithOrg(event.target.checked)}
              className="size-3.5 rounded border-border"
            />
            Share with organization
          </label>
        ) : null}
      </div>

      <div className="mt-2 h-80 overflow-hidden rounded-md border border-border">
        <CopilotChat
          agentId="skills"
          labels={{ chatInputPlaceholder: "Improve this skill…" }}
          className="h-full"
        />
      </div>
    </div>
  );
}
