"use client";

import { useCallback, useMemo, useState } from "react";

import { useCopilotChatHeadless_c } from "@copilotkit/react-core";
import { useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";

import type { AgentProfile } from "@/components/agents/agents-data";
import type { PersonProfile } from "@/components/people/people-data";
import { searchDirectory, type DirectoryKind, type DirectoryMatch } from "./search";

export interface DirectorySearch {
  query: string;
  results: DirectoryMatch[];
  searching: boolean;
  interpretation: string | null;
  hasSearched: boolean;
  updateQuery: (value: string) => void;
  submit: () => void;
  clear: () => void;
}

export function useDirectorySearch({
  kind,
  people,
  agents,
}: {
  kind: DirectoryKind;
  people: PersonProfile[];
  agents: AgentProfile[];
}): DirectorySearch {
  const chat = useCopilotChatHeadless_c({
    id: kind === "people" ? "directory-people" : "directory-agents",
  });

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirectoryMatch[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const runLocal = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      setQuery(value);
      setResults(trimmed ? searchDirectory(kind, trimmed, people, agents) : []);
      return trimmed;
    },
    [kind, people, agents],
  );

  const toolName = kind === "people" ? "searchPeople" : "searchAgents";
  const toolDescription =
    kind === "people"
      ? "Search the people directory across every profile field (role, skills, experience, location, goals, preferences, contributions, memory notes, reputation). Returns ranked matches with snippets. Use it whenever the user wants to find or research people."
      : "Search the agents directory across every profile field (role, skills, channels, autonomy, reports to, memory notes, reputation). Returns ranked matches with snippets. Use it whenever the user wants to find or research agents.";

  useFrontendTool(
    {
      name: toolName,
      description: toolDescription,
      parameters: z.object({ query: z.string() }),
      handler: async ({ query: rawQuery }) => {
        const trimmed = rawQuery.trim();
        if (!trimmed) return [];
        return searchDirectory(kind, trimmed, people, agents);
      },
    },
    [kind, people, agents],
  );

  const submit = useCallback(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setHasSearched(true);
    chat.reset();
    void chat
      .sendMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: `Research the ${kind === "people" ? "people" : "agents"} directory for: "${trimmed}". If a directory search tool is available, call it, then give a concise two to three line interpretation of the top matches and why they fit.`,
      })
      .catch(() => undefined);
  }, [query, kind, chat]);

  const updateQuery = useCallback(
    (value: string) => {
      const trimmed = runLocal(value);
      setHasSearched(true);
      if (!trimmed) {
        chat.reset();
      }
    },
    [runLocal, chat],
  );

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setHasSearched(false);
    chat.reset();
  }, [chat]);

  const interpretation = useMemo(() => {
    for (let index = chat.messages.length - 1; index >= 0; index--) {
      const message = chat.messages[index];
      if (message.role !== "assistant") continue;
      const content = (message as { content?: string }).content?.trim();
      if (content) return content;
    }
    return null;
  }, [chat.messages]);

  return {
    query,
    results,
    searching: chat.isLoading,
    interpretation,
    hasSearched,
    updateQuery,
    submit,
    clear,
  };
}