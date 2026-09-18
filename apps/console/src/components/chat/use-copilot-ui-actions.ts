"use client";

import { useAgentContext, useFrontendTool } from "@copilotkit/react-core/v2";
import { z } from "zod";
import { useAppShell, type SectionId } from "@/components/app-shell/app-shell-context";
import { createTask, listTaskLists, listActors } from "@/components/tasks/tasks-api";

/**
 * Registers CopilotKit frontend tools that let the AI control the Jamot workspace.
 * Mount this inside ChatContent so it has access to the app shell context.
 *
 * Examples:
 *  "Show me the People panel"  → openSection("people")
 *  "Create a task for Maria by Friday"  → createTask(...)
 *  "Add Andrea to Customers list"  → setPersonList(...)
 *  "Change Maria Assistant to supervised mode"  → setAgentAutonomy(...)
 */
export function UseCopilotUIActions() {
  const { setActiveSection, activeSection, activeAppId, space } = useAppShell();
  const spaceId = space.spaceId ?? space.id ?? "personal";

  // Expose current sidebar state as context so the AI knows what's open
  useAgentContext({
    description: "Current right sidebar panel open in Jamot workspace",
    value: {
      activeSidebarSection: activeSection ?? "none",
      activeApp: activeAppId ?? "none",
      availableSections: [
        "tasks", "people", "agents", "organization", "dashboard",
        "whatsapp", "calendar", "suppliers", "crm", "leads", "outreach", "finance",
      ] satisfies SectionId[],
    },
  });

  // Tool: Open any sidebar section
  useFrontendTool(
    {
      name: "openSection",
      description:
        "Open a panel in the right sidebar. Use this when the user asks to see tasks, people, agents, organization, dashboard, channels (whatsapp), calendar, leads, suppliers, outreach, finance, or CRM.",
      parameters: z.object({
        section: z
          .string()
          .describe(
            "The section ID to open. One of: tasks, people, agents, organization, dashboard, whatsapp, calendar, suppliers, crm, leads, outreach, finance",
          ),
      }),
      handler: async ({ section }: { section: string }) => {
        const id = (section === "canvas" ? "dashboard" : section) as SectionId;
        setActiveSection(id);
        return `Opened the ${id} panel.`;
      },
    },
    [setActiveSection],
  );

  // Tool: Create a task
  useFrontendTool(
    {
      name: "createTask",
      description:
        "Create and assign a task in the Task App. Use when the user says things like 'create a task', 'add a task', 'remind me to', 'assign X to Y'.",
      parameters: z.object({
        title: z.string().describe("Task title"),
        description: z.string().optional().describe("Optional task description or notes"),
        assigneeName: z.string().optional().describe("Name of the person or agent to assign the task to"),
        dueDate: z.string().optional().describe("Due date in ISO format or date string"),
      }),
      handler: async ({
        title,
        description,
        assigneeName,
        dueDate,
      }: {
        title: string;
        description?: string;
        assigneeName?: string;
        dueDate?: string;
      }) => {
        const [lists, actors] = await Promise.all([
          listTaskLists(spaceId).catch(() => []),
          listActors().catch(() => []),
        ]);

        const listId = lists[0]?.id ?? null;
        const assignee = assigneeName
          ? actors.find((a) =>
              a.displayName.toLowerCase().includes(assigneeName.toLowerCase()),
            )
          : null;

        let parsedDue: string | null = null;
        if (dueDate) {
          const d = new Date(dueDate);
          parsedDue = isNaN(d.getTime()) ? null : d.toISOString();
        }

        await createTask({
          spaceId,
          listId,
          title,
          description: description ?? "",
          dueDate: parsedDue,
          assigneeActorIds: assignee ? [assignee.id] : [],
        });

        setActiveSection("tasks");
        return `Task "${title}" created${assignee ? ` and assigned to ${assignee.displayName}` : ""}.`;
      },
    },
    [spaceId, setActiveSection],
  );

  // Tool: Add/move person to a list
  useFrontendTool(
    {
      name: "setPersonList",
      description:
        "Add a person to a People list (e.g. Customers, Suppliers, Team, Investors). Use when the user says 'add X to Y list' or 'move X to Y'.",
      parameters: z.object({
        personName: z.string().describe("Name of the person"),
        listName: z.string().describe("Name of the list (e.g. Customers, Suppliers, Team)"),
      }),
      handler: async ({ personName, listName }: { personName: string; listName: string }) => {
        window.dispatchEvent(
          new CustomEvent("jamot:people:addToList", {
            detail: { personName, listName },
          }),
        );
        setActiveSection("people");
        return `${personName} has been added to the ${listName} list. Opening People panel.`;
      },
    },
    [setActiveSection],
  );

  // Tool: Change agent autonomy
  useFrontendTool(
    {
      name: "setAgentAutonomy",
      description:
        "Change an agent's autonomy mode. Use when user says 'change X to supervised/autonomous/manual'.",
      parameters: z.object({
        agentName: z.string().describe("Name of the agent to modify"),
        mode: z
          .string()
          .describe("Autonomy mode: 'autonomous', 'approve' (supervised), or 'suggest' (manual)"),
      }),
      handler: async ({ agentName, mode }: { agentName: string; mode: string }) => {
        window.dispatchEvent(
          new CustomEvent("jamot:agent:setAutonomy", {
            detail: { agentName, mode },
          }),
        );
        setActiveSection("agents");
        return `${agentName}'s autonomy has been set to ${mode}. Opening Agents panel.`;
      },
    },
    [setActiveSection],
  );

  // Tool: Add a dashboard block
  useFrontendTool(
    {
      name: "addDashboardBlock",
      description:
        "Add a block to the Company Dashboard. Use when user says 'add a People block', 'show tasks on dashboard', 'add Finance block' etc.",
      parameters: z.object({
        blockType: z
          .string()
          .describe(
            "Type of block: people, tasks, agents, notifications, whatsapp, finance, activity, approvals, calendar, leads",
          ),
      }),
      handler: async ({ blockType }: { blockType: string }) => {
        window.dispatchEvent(
          new CustomEvent("jamot:dashboard:addBlock", {
            detail: { blockType },
          }),
        );
        setActiveSection("dashboard");
        return `Added a ${blockType} block to the Dashboard.`;
      },
    },
    [setActiveSection],
  );

  // Tool: Remove a dashboard block
  useFrontendTool(
    {
      name: "removeDashboardBlock",
      description: "Remove a block from the Company Dashboard by block type.",
      parameters: z.object({
        blockType: z.string().describe("Block type to remove"),
      }),
      handler: async ({ blockType }: { blockType: string }) => {
        window.dispatchEvent(
          new CustomEvent("jamot:dashboard:removeBlock", { detail: { blockType } }),
        );
        return `Removed the ${blockType} block from the Dashboard.`;
      },
    },
    [],
  );

  // Tool: Filter / find people
  useFrontendTool(
    {
      name: "filterPeople",
      description:
        "Filter or search people by query, list, or activity. Use when user says 'show me people I haven't contacted in 30 days', 'find all customers', 'show people from WhatsApp'.",
      parameters: z.object({
        query: z.string().optional().describe("Search query or filter description"),
        list: z.string().optional().describe("List name to filter by"),
      }),
      handler: async ({ query, list }: { query?: string; list?: string }) => {
        window.dispatchEvent(
          new CustomEvent("jamot:people:filter", { detail: { query, list } }),
        );
        setActiveSection("people");
        return `Filtering people${query ? ` for "${query}"` : ""}${list ? ` in ${list}` : ""}. Opening People panel.`;
      },
    },
    [setActiveSection],
  );

  // Tool: Rename a people list
  useFrontendTool(
    {
      name: "renamePeopleList",
      description: "Rename a People list. E.g. 'rename Clients to Customers'.",
      parameters: z.object({
        oldName: z.string().describe("Current list name"),
        newName: z.string().describe("New list name"),
      }),
      handler: async ({ oldName, newName }: { oldName: string; newName: string }) => {
        window.dispatchEvent(
          new CustomEvent("jamot:people:renameList", { detail: { oldName, newName } }),
        );
        setActiveSection("people");
        return `Renamed list "${oldName}" to "${newName}".`;
      },
    },
    [setActiveSection],
  );

  return null;
}
