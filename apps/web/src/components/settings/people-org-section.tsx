"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserMinus, UserPlus, Users } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addOrganizationMember,
  getOrganizationMembers,
  removeOrganizationMember,
  updateOrganizationMember,
  type MemberRole,
  type OrganizationMember,
} from "@/lib/api-client";
import { Card, SectionHeading } from "./section-primitives";
import { useActiveOrg } from "./use-active-org";

const ROLE_VARIANT: Record<
  MemberRole,
  "default" | "secondary" | "outline" | "accent"
> = {
  owner: "default",
  admin: "accent",
  member: "secondary",
};

function formatJoined(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function PeopleOrgSection() {
  const { isOrg, organizationId, isAdmin } = useActiveOrg();

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;
    getOrganizationMembers(organizationId)
      .then((items) => {
        if (cancelled) return;
        setMembers(items);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load members");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    try {
      setMembers(await getOrganizationMembers(organizationId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load members");
    }
  }, [organizationId]);

  if (!isOrg || !organizationId) {
    return (
      <div>
        <SectionHeading title="People" description="Manage people in your organization." />
        <Card className="max-w-xl">
          <div className="flex items-center gap-3">
            <Users className="size-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Open an organization space to manage members.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const addMember = async () => {
    const trimmed = email.trim();
    if (!trimmed || adding) return;
    setAddError(null);
    setAdding(true);
    try {
      await addOrganizationMember(organizationId, { email: trimmed, role });
      setEmail("");
      setRole("member");
      await refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Could not add member");
    } finally {
      setAdding(false);
    }
  };

  const changeRole = async (member: OrganizationMember, next: "admin" | "member") => {
    if (!organizationId || busyId) return;
    setBusyId(member.personId);
    setError(null);
    try {
      await updateOrganizationMember(organizationId, member.personId, next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (member: OrganizationMember) => {
    if (!organizationId || busyId) return;
    setBusyId(member.personId);
    setError(null);
    try {
      await removeOrganizationMember(organizationId, member.personId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <SectionHeading title="People" description="Manage people in your organization." />

      {isAdmin ? (
        <Card className="mb-4 flex max-w-xl flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <Input
              type="email"
              placeholder="teammate@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addMember();
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Role</label>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as "admin" | "member")}
              className="h-9 rounded-lg border border-border bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <Button onClick={() => void addMember()} disabled={adding}>
            {adding ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Add
          </Button>
        </Card>
      ) : null}

      {addError ? <p className="mb-2 text-sm text-red-600">{addError}</p> : null}
      {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : (
        <Card className="max-w-xl overflow-hidden p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Member</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Joined</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                    No members yet.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const isOwner = member.kind === "owner";
                  return (
                    <tr key={member.personId} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.displayName} size="sm" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">
                              {member.displayName || "Unknown"}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {member.email ?? "no email"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {isOwner || !isAdmin ? (
                          <Badge variant={ROLE_VARIANT[member.kind]}>{member.kind}</Badge>
                        ) : (
                          <select
                            value={member.kind}
                            disabled={busyId === member.personId}
                            onChange={(event) =>
                              void changeRole(
                                member,
                                event.target.value as "admin" | "member",
                              )
                            }
                            className="h-8 rounded-lg border border-border bg-card px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatJoined(member.membershipSince)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {!isOwner && isAdmin ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-red-600"
                            aria-label={`Remove ${member.displayName}`}
                            disabled={busyId === member.personId}
                            onClick={() => void removeMember(member)}
                          >
                            <UserMinus className="size-4" />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}