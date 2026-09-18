"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Briefcase,
  Building2,
  CalendarDays,
  FileText,
  House,
  Landmark,
  LayoutGrid,
  ListTodo,
  Megaphone,
  MemoryStick,
  MessageCircle,
  MessageSquare,
  Network,
  Radar,
  Search,
  Settings,
  Truck,
  User,
  UserPlus,
  Users,
  Vault,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAppShell, type SectionId } from "@/components/app-shell/app-shell-context";
import { requestAddPerson } from "@/components/people/add-person-signal";

type PaletteAction =
  | { type: "navigate"; href: string }
  | { type: "run" }
  | { type: "section"; section: SectionId }
  | { type: "add-person" };

interface PaletteItem {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
  action: PaletteAction;
}

interface PaletteGroup {
  name: string;
  items: PaletteItem[];
}

const GROUPS: PaletteGroup[] = [
  {
    name: "Apps & Context",
    items: [
      { id: "sec-tasks", label: "Tasks", icon: ListTodo, keywords: "todo work backlog", action: { type: "section", section: "tasks" } },
      { id: "sec-people", label: "People & Directory", icon: Users, keywords: "team members human employees", action: { type: "section", section: "people" } },
      { id: "sec-agents", label: "Agents & Bots", icon: Bot, keywords: "ai assistants subagents", action: { type: "section", section: "agents" } },
      { id: "sec-org", label: "Organization & Org Chart", icon: Building2, keywords: "structure hierarchy organic chart", action: { type: "section", section: "organization" } },
      { id: "sec-dashboard", label: "Dashboard & Workspace", icon: LayoutGrid, keywords: "whiteboard visual blocks dashboard metrics", action: { type: "section", section: "dashboard" } },
      { id: "sec-whatsapp", label: "WhatsApp Chat", icon: MessageCircle, keywords: "messaging channels chat", action: { type: "section", section: "whatsapp" } },
      { id: "sec-calendar", label: "Calendar & Schedule", icon: CalendarDays, keywords: "events meetings", action: { type: "section", section: "calendar" } },
      { id: "sec-suppliers", label: "Suppliers & Vendors", icon: Truck, keywords: "procurement inventory", action: { type: "section", section: "suppliers" } },
      { id: "sec-crm", label: "CRM & Customers", icon: Briefcase, keywords: "deals clients accounts", action: { type: "section", section: "crm" } },
      { id: "sec-leads", label: "Leads & Prospects", icon: Radar, keywords: "pipeline sales discovery", action: { type: "section", section: "leads" } },
      { id: "sec-outreach", label: "Outreach & Campaigns", icon: Megaphone, keywords: "marketing broadcasts emails", action: { type: "section", section: "outreach" } },
      { id: "sec-finance", label: "Finance & Treasury", icon: Landmark, keywords: "money budget payments crypto", action: { type: "section", section: "finance" } },
    ],
  },
  {
    name: "Quick Actions",
    items: [
      { id: "go-maria", label: "Go to Maria", icon: User, action: { type: "run" } },
      { id: "open-q4", label: "Open Q4 Sales", icon: FileText, action: { type: "run" } },
      { id: "create-task", label: "Create task", icon: ListTodo, action: { type: "section", section: "tasks" } },
      { id: "add-whatsapp", label: "Add WhatsApp channel", icon: MessageSquare, action: { type: "section", section: "whatsapp" } },
      { id: "invite-person", label: "Invite person", icon: UserPlus, keywords: "add human member team", action: { type: "add-person" } },
      {
        id: "create-agent",
        label: "Create agent",
        icon: Bot,
        keywords: "assistant bot builder",
        action: { type: "section", section: "agents" },
      },
      {
        id: "open-vault",
        label: "Open Vault",
        icon: Vault,
        keywords: "secrets credentials keys",
        action: { type: "navigate", href: "/settings" },
      },
      { id: "search-memory", label: "Search memory", icon: MemoryStick, action: { type: "run" } },
    ],
  },
  {
    name: "Navigation",
    items: [
      { id: "go-home", label: "Home / Chat", icon: House, action: { type: "navigate", href: "/" } },
      {
        id: "open-settings",
        label: "Settings",
        icon: Settings,
        action: { type: "navigate", href: "/settings" },
      },
      {
        id: "open-organization",
        label: "Organization full page",
        icon: Network,
        action: { type: "navigate", href: "/organization" },
      },
    ],
  },
];

export function CommandPalette() {
  const router = useRouter();
  const { setActiveSection } = useAppShell();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const close = () => {
    setOpen(false);
    setSearch("");
  };

  const visibleGroups = useMemo(() => {
    const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (terms.length === 0) return true;
        const haystack = `${item.label} ${item.keywords ?? ""}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      }),
    })).filter((group) => group.items.length > 0);
  }, [search]);

  const runAction = (action: PaletteAction) => {
    if (action.type === "navigate") {
      router.push(action.href);
    } else if (action.type === "section") {
      setActiveSection(action.section);
    } else if (action.type === "add-person") {
      setActiveSection("people");
      requestAddPerson();
    }
    close();
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <div
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            className="glass-card glass-border relative w-full max-w-xl overflow-hidden rounded-3xl shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -12 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <Command
              shouldFilter={false}
              loop
              label="Jamot command menu"
              className="[&_[cmdk-group-heading]]:px-3.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted-foreground/80"
            >
              <div className="flex items-center gap-2.5 border-b border-border/40 px-4">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <Command.Input
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Type a command, search apps, or ask..."
                  className="h-13 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Command.List className="max-h-84 overflow-y-auto p-2">
                {visibleGroups.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No results found.
                  </div>
                ) : (
                  visibleGroups.map((group) => (
                    <Command.Group key={group.name} heading={group.name}>
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <Command.Item
                            key={item.id}
                            value={item.id}
                            onSelect={() => runAction(item.action)}
                            className="flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium data-[selected=true]:bg-space-accent/10 data-[selected=true]:text-space-accent transition-colors"
                          >
                            <Icon className="size-4 text-muted-foreground transition-colors group-hover:text-space-accent" />
                            <span>{item.label}</span>
                          </Command.Item>
                        );
                      })}
                    </Command.Group>
                  ))
                )}
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
