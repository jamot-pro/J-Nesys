"use client";

import { useState } from "react";
import {
  Check,
  ChevronRight,
  FolderKanban,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  X,
  MoreHorizontal,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface ChatHistoryItem {
  id: string;
  title: string;
  date: Date;
}

interface Project {
  id: string;
  title: string;
  /** Auto-derived project memory (summaries/facts from its conversations) - confined to each project. */
  memory: string[];
  chats: ChatHistoryItem[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: Date): Date {
  const copy = new Date(value);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysAgo(days: number): Date {
  return new Date(startOfDay(new Date()).getTime() - days * DAY_MS);
}

const PROJECTS: Project[] = [
  {
    id: "p1",
    title: "Restaurant Opening",
    memory: [
      "Budget approved: $50k",
      "3 suppliers shortlisted",
      "Target open date: Sep 5",
    ],
    chats: [
      { id: "c1", title: "Customer complaint — Maria", date: daysAgo(0) },
      { id: "c2", title: "Friday sales review", date: daysAgo(1) },
      { id: "c3", title: "Supplier discussion", date: daysAgo(2) },
    ],
  },
  {
    id: "p2",
    title: "Q4 Sales",
    memory: ["Target: +15% QoQ", "4 leads in negotiation"],
    chats: [
      { id: "c4", title: "Quarterly OKR check-in", date: daysAgo(5) },
      { id: "c5", title: "Draft a reply to the printer vendor", date: daysAgo(0) },
    ],
  },
];

const LOOSE_CHATS: ChatHistoryItem[] = [
  { id: "l1", title: "Event planning", date: daysAgo(3) },
  { id: "l2", title: "Onboard new designer", date: daysAgo(9) },
  { id: "l3", title: "Website copy pass", date: daysAgo(21) },
];

type GroupKey = "Today" | "Yesterday" | "Previous 7 days" | "Older";

const GROUP_ORDER: GroupKey[] = ["Today", "Yesterday", "Previous 7 days", "Older"];

function groupFor(date: Date, today: Date): GroupKey {
  const diffDays = Math.round(
    (startOfDay(today).getTime() - startOfDay(date).getTime()) / DAY_MS,
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "Previous 7 days";
  return "Older";
}

interface ChatRowProps {
  item: ChatHistoryItem;
  editing: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onBeginEdit: () => void;
  onCommit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onMoveToProject: (chatId: string, projectId: string) => void;
  projects: Project[];
  isInProject?: boolean;
}

function ChatRow({
  item,
  editing,
  draft,
  onDraftChange,
  onBeginEdit,
  onCommit,
  onCancel,
  onDelete,
  onMoveToProject,
  projects,
  isInProject,
}: ChatRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (editing) {
    return (
      <div className="flex items-center gap-1 rounded-xl bg-muted/80 px-2 py-1">
        <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCommit();
            if (event.key === "Escape") onCancel();
          }}
          onBlur={onCommit}
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
        <button
          type="button"
          aria-label="Save title"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCommit}
          className="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
        >
          <Check className="size-3" />
        </button>
        <button
          type="button"
          aria-label="Cancel rename"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onCancel}
          className="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative group flex items-center gap-2 rounded-xl px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground">
      <MessageSquare className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
      <button
        type="button"
        onClick={onBeginEdit}
        className="min-w-0 flex-1 truncate text-left"
        title={item.title}
      >
        {item.title}
      </button>
      <button
        type="button"
        aria-label="Rename"
        onClick={onBeginEdit}
        className={cn(
          "rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100",
        )}
      >
        <Pencil className="size-3" />
      </button>
      <div className="relative">
        <button
          type="button"
          aria-label="More actions"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className={cn(
            "rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100",
          )}
        >
          <MoreHorizontal className="size-3" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-xl border border-border/40 bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onBeginEdit();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-popover-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Pencil className="size-3.5" />
                Rename
              </button>
              {projects.length > 0 && !isInProject && (
                <>
                  <div className="h-px bg-border/40 my-0.5" />
                  <span className="px-2 py-1 text-[11px] font-medium tracking-wide uppercase text-muted-foreground">
                    Move to project
                  </span>
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onMoveToProject(item.id, project.id);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      <FolderKanban className="size-3.5 text-space-accent/80" />
                      {project.title}
                    </button>
                  ))}
                </>
              )}
              <div className="h-px bg-border/40 my-0.5" />
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-destructive hover:bg-accent hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatHistory({ searchQuery = "" }: { searchQuery?: string }) {
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [looseChats, setLooseChats] = useState<ChatHistoryItem[]>(LOOSE_CHATS);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ p1: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);

  const today = startOfDay(new Date());

  const query = searchQuery.trim().toLowerCase();

  const filteredProjects = projects
    .map((p) => ({
      ...p,
      chats: p.chats.filter(
        (c) => !query || c.title.toLowerCase().includes(query) || p.title.toLowerCase().includes(query),
      ),
    }))
    .filter((p) => !query || p.chats.length > 0 || p.title.toLowerCase().includes(query));

  const filteredLoose = looseChats.filter(
    (c) => !query || c.title.toLowerCase().includes(query),
  );

  const groups = GROUP_ORDER.map((key) => ({
    key,
    items: filteredLoose.filter((item) => groupFor(item.date, today) === key),
  })).filter((group) => group.items.length > 0);

  const beginEdit = (id: string, title: string) => {
    setEditingId(id);
    setDraft(title);
  };

  const commitEdit = () => {
    const next = draft.trim();
    if (next && editingId) {
      setProjects((current) =>
        current.map((project) => ({
          ...project,
          chats: project.chats.map((chat) =>
            chat.id === editingId ? { ...chat, title: next } : chat,
          ),
        })),
      );
      setLooseChats((current) =>
        current.map((chat) => (chat.id === editingId ? { ...chat, title: next } : chat)),
      );
    }
    setEditingId(null);
    setDraft("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
  };

  const toggleProject = (id: string) => {
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
  };

  const deleteChat = (chatId: string) => {
    setProjects((current) =>
      current
        .map((project) => ({
          ...project,
          chats: project.chats.filter((chat) => chat.id !== chatId),
        }))
        .filter((project) => project.chats.length > 0 || !query), // Keep projects even if empty when searching
    );
    setLooseChats((current) => current.filter((chat) => chat.id !== chatId));
  };

  const deleteProject = (projectId: string) => {
    // Move chats to loose chats before deleting project
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setLooseChats((current) => [...project.chats, ...current]);
    }
    setProjects((current) => current.filter((p) => p.id !== projectId));
    setExpanded((current) => {
      const next = { ...current };
      delete next[projectId];
      return next;
    });
    setProjectMenuOpen(null);
  };

  const moveChatToProject = (chatId: string, targetProjectId: string) => {
    let chatToMove: ChatHistoryItem | undefined;
    
    // Find and remove from loose chats
    setLooseChats((current) => {
      chatToMove = current.find((c) => c.id === chatId);
      return current.filter((c) => c.id !== chatId);
    });

    // Find and remove from other projects
    setProjects((current) =>
      current.map((project) => ({
        ...project,
        chats: project.chats.filter((chat) => chat.id !== chatId),
      })),
    );

    // Add to target project
    if (chatToMove) {
      setProjects((current) =>
        current.map((project) =>
          project.id === targetProjectId
            ? { ...project, chats: [...project.chats, chatToMove!] }
            : project,
        ),
      );
    }
  };

  const createProject = () => {
    const title = projectDraft.trim();
    if (title) {
      const newProject: Project = {
        id: generateId("p"),
        title,
        memory: [],
        chats: [],
      };
      setProjects((current) => [...current, newProject]);
      setCreatingProject(false);
      setProjectDraft("");
    }
  };

  const cancelCreateProject = () => {
    setCreatingProject(false);
    setProjectDraft("");
  };

  const startProjectRename = (projectId: string, currentTitle: string) => {
    setProjectMenuOpen(null);
    setEditingId(projectId);
    setDraft(currentTitle);
  };

  const handleProjectCommit = () => {
    const next = draft.trim();
    if (next && editingId && projects.some((p) => p.id === editingId)) {
      setProjects((current) =>
        current.map((project) =>
          project.id === editingId ? { ...project, title: next } : project,
        ),
      );
    }
    setEditingId(null);
    setDraft("");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Projects Section */}
        <section className="mb-3">
          <div className="flex items-center justify-between px-2 pb-1">
            <h3 className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70">
              Projects
            </h3>
            <button
              type="button"
              onClick={() => setCreatingProject(true)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted/50"
              aria-label="Create new project"
            >
              <Plus className="size-3.5" />
              New
            </button>
          </div>

          {creatingProject ? (
            <div className="flex items-center gap-1 rounded-xl bg-muted/80 px-2 py-1">
              <FolderKanban className="size-3.5 shrink-0 text-space-accent/80" />
              <input
                autoFocus
                value={projectDraft}
                onChange={(e) => setProjectDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createProject();
                  if (e.key === "Escape") cancelCreateProject();
                }}
                onBlur={createProject}
                placeholder="Project name"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              />
            </div>
          ) : null}

          <ul className="flex flex-col gap-0.5">
            {filteredProjects.map((project) => {
              const open = expanded[project.id];
              const isEditingProject = editingId === project.id;
              return (
                <li key={project.id}>
                  <div className="relative">
                    {isEditingProject ? (
                      <div className="flex items-center gap-1 rounded-xl bg-muted/80 px-2 py-1">
                        <FolderKanban className="size-3.5 shrink-0 text-space-accent/80" />
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleProjectCommit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          onBlur={handleProjectCommit}
                          className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleProjectCommit}
                          className="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <Check className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleProject(project.id)}
                        className="flex w-full items-center gap-2 rounded-xl px-2 py-1 text-[13px] font-medium text-foreground transition-colors hover:bg-muted/70"
                      >
                        <ChevronRight
                          className={cn(
                            "size-3 shrink-0 text-muted-foreground transition-transform duration-200",
                            open && "rotate-90",
                          )}
                        />
                        <FolderKanban className="size-3.5 shrink-0 text-space-accent/80" />
                        <span className="min-w-0 flex-1 truncate text-left">
                          {project.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {project.chats.length}
                        </span>
                      </button>
                    )}

                    <div className="relative">
                      <button
                        type="button"
                        aria-label="Project actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectMenuOpen(projectMenuOpen === project.id ? null : project.id);
                        }}
                        className={cn(
                          "absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100",
                        )}
                      >
                        <MoreHorizontal className="size-3" />
                      </button>
                      {projectMenuOpen === project.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setProjectMenuOpen(null)}
                          />
                          <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-border/40 bg-popover p-1 shadow-xl animate-in fade-in-0 zoom-in-95">
                            <button
                              type="button"
                              onClick={() => startProjectRename(project.id, project.title)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                            >
                              <Pencil className="size-3.5" />
                              Rename
                            </button>
                            <div className="h-px bg-border/40 my-0.5" />
                            <button
                              type="button"
                              onClick={() => deleteProject(project.id)}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-destructive hover:bg-accent hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              Delete project
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {open && !isEditingProject && (
                      <div className="ml-3.5 flex flex-col gap-0.5 border-l border-border/40 pl-2.5 pb-1">
                        {/* Memory section removed from sidebar - kept internally per project */}
                        {project.chats.map((chat) => (
                          <ChatRow
                            key={chat.id}
                            item={chat}
                            editing={editingId === chat.id}
                            draft={draft}
                            onDraftChange={setDraft}
                            onBeginEdit={() => beginEdit(chat.id, chat.title)}
                            onCommit={commitEdit}
                            onCancel={cancelEdit}
                            onDelete={() => deleteChat(chat.id)}
                            onMoveToProject={moveChatToProject}
                            projects={projects.filter((p) => p.id !== project.id)}
                            isInProject={true}
                          />
                        ))}
                        {project.chats.length === 0 && (
                          <div className="text-[11px] text-muted-foreground/60 py-1">
                            No chats in this project. Use chat menu → Move to project
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}

            {filteredProjects.length === 0 && !creatingProject && (
              <div className="text-center py-4 text-[12px] text-muted-foreground/60">
                No projects yet. Click New to create one.
              </div>
            )}
          </ul>
        </section>

        {/* Loose Chats Sections */}
        {groups.map((group) => (
          <section key={group.key} className="mb-3">
            <h3 className="px-2 pb-1 text-[11px] font-medium tracking-wide uppercase text-muted-foreground/70">
              {group.key}
            </h3>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <ChatRow
                    item={item}
                    editing={editingId === item.id}
                    draft={draft}
                    onDraftChange={setDraft}
                    onBeginEdit={() => beginEdit(item.id, item.title)}
                    onCommit={commitEdit}
                    onCancel={cancelEdit}
                    onDelete={() => deleteChat(item.id)}
                    onMoveToProject={moveChatToProject}
                    projects={projects}
                    isInProject={false}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
