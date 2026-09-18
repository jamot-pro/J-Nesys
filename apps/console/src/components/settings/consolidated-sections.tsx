"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import {
  changePassword,
  updateOwnActor,
  updateOwnProfile,
} from "@/lib/api-client";
import { updatePerson } from "@/components/people/people-api";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ComposioConnectors } from "./composio-connectors";
import { GoogleConnectorCard } from "./google-connector-card";
import { Vault } from "./Vault";
import { ChannelsSection } from "./channels-section";
import { WorkspacesSection } from "./workspaces-section";
import { PeopleOrgSection } from "./people-org-section";
import { AppsOrgSection } from "./apps-org-section";
import {
  CapabilitiesSection,
  KnowledgeSection,
  OrgMemorySection,
} from "./org-data-sections";
import { WorkspaceSettingsSection } from "./org-sections";
import { MemorySection } from "./personal-sections";
import { SkillsManager } from "./skills-manager";
import { useActiveOrg } from "./use-active-org";
import {
  Card,
  Field,
  SectionHeading,
  TextInput,
  Toggle,
} from "./section-primitives";

/* ------------------------- Account & Profile ------------------------- */

export function AccountProfileSection() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.actor?.displayName ?? "");
  const [email, setEmail] = useState(user?.person?.email ?? "");
  const [role, setRole] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!user?.person) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      if (user.actor && name.trim() && name.trim() !== user.actor.displayName) {
        await updateOwnActor(user.actor.id, { displayName: name.trim() });
      }
      await updateOwnProfile(user.person.id, {
        email: email.trim() || null,
        profile: {
          selfDescribed: {
            role: { value: role.trim(), source: "self_declared" },
            bio: { value: bio.trim(), source: "self_declared" },
          },
        },
      });
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <SectionHeading
        title="Account & Profile"
        description="Your identity across Jamot — name, contact, and how you appear."
      />
      <Card className="flex max-w-xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} size="lg" />
          <div>
            <p className="text-sm font-medium">{name || "Unnamed"}</p>
            <p className="text-xs text-muted-foreground">
              Your profile picture follows your connected sources.
            </p>
          </div>
        </div>
        <Field label="Full name">
          <TextInput value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field label="Role" hint="Shown next to your name in people lists.">
          <TextInput
            value={role}
            placeholder="e.g. Founder"
            onChange={(event) => setRole(event.target.value)}
          />
        </Field>
        <Field label="Bio">
          <textarea
            rows={3}
            value={bio}
            placeholder="A sentence about you."
            onChange={(event) => setBio(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {saved ? <p className="text-sm text-emerald-600">Saved.</p> : null}
        <div className="flex justify-end">
          <Button size="sm" disabled={!user?.person || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------- Privacy & Security ------------------------- */

export function PrivacySecuritySection() {
  const { user } = useAuth();
  const person = user?.person;
  const consent = person?.consent ?? null;

  const [allowInference, setAllowInference] = useState(consent?.allowInference ?? true);
  const [shareAcrossSpaces, setShareAcrossSpaces] = useState(
    consent?.visibility === "org" || consent?.visibility === "public",
  );
  const [exportEnabled, setExportEnabled] = useState(consent?.exportEnabled ?? true);
  const [savingConsent, setSavingConsent] = useState(false);
  const [consentSaved, setConsentSaved] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const saveConsent = async () => {
    if (!person) return;
    setSavingConsent(true);
    setConsentSaved(false);
    setConsentError(null);
    try {
      await updatePerson(person.id, {
        consent: {
          allowInference,
          visibility: shareAcrossSpaces ? "org" : "private",
          exportEnabled,
        },
      });
      setConsentSaved(true);
    } catch (cause) {
      setConsentError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setSavingConsent(false);
    }
  };

  const savePassword = async () => {
    setPasswordSaved(false);
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : "Could not change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <SectionHeading
          title="Privacy & Security"
          description="Privacy: what data Jamot can use and remember. Security: who can access it and how it is protected."
        />
        <Card className="max-w-xl">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Privacy
          </p>
          <Toggle
            checked={allowInference}
            onChange={setAllowInference}
            label="Learn from my activity"
            description="Allow Jamot to form new memories as you work."
          />
          <Toggle
            checked={shareAcrossSpaces}
            onChange={setShareAcrossSpaces}
            label="Share personal memory across spaces"
            description="Make personal memories available to organization spaces."
          />
          <Toggle
            checked={exportEnabled}
            onChange={setExportEnabled}
            label="Allow data export"
            description="Permit exports of your data."
          />
          {consentError ? (
            <p className="mt-2 text-sm text-destructive">{consentError}</p>
          ) : null}
          {consentSaved ? <p className="mt-2 text-sm text-emerald-600">Saved.</p> : null}
          <div className="mt-3 flex justify-end">
            <Button size="sm" disabled={!person || savingConsent} onClick={() => void saveConsent()}>
              {savingConsent ? <Loader2 className="size-4 animate-spin" /> : null}
              Save privacy
            </Button>
          </div>
        </Card>
      </div>

      <Card className="max-w-xl">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Security
        </p>
        <div className="flex flex-col gap-3">
          <Field label="Current password" hint="Leave empty if you signed in with Google.">
            <TextInput
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <TextInput
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </Field>
          <Field label="Confirm new password">
            <TextInput
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Field>
        </div>
        {passwordError ? (
          <p className="mt-2 text-sm text-destructive">{passwordError}</p>
        ) : null}
        {passwordSaved ? (
          <p className="mt-2 text-sm text-emerald-600">Password updated.</p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <Button
            size="sm"
            disabled={savingPassword || !newPassword}
            onClick={() => void savePassword()}
          >
            {savingPassword ? <Loader2 className="size-4 animate-spin" /> : null}
            Change password
          </Button>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------- Memory ------------------------------- */

export function UnifiedMemorySection() {
  const { isOrg, isAdmin } = useActiveOrg();
  return (
    <div className="flex flex-col gap-6">
      <MemorySection />
      {isOrg ? <OrgMemorySection /> : null}
      {isOrg && isAdmin ? <KnowledgeSection /> : null}
    </div>
  );
}

/* ----------------------------- Connectors ----------------------------- */

export function UnifiedConnectorsSection() {
  const { isOrg } = useActiveOrg();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Connectors"
        description="Every integration in one place — channels, Google, tools and MCP. How each one connects is an implementation detail."
      />
      <GoogleConnectorCard />
      {isOrg ? <ChannelsSection /> : null}
      <ComposioConnectors mode={isOrg ? "org" : "personal"} />
      <Vault />
    </div>
  );
}

/* ------------------------------- Skills ------------------------------- */

export function UnifiedSkillsSection() {
  const { isOrg, isAdmin } = useActiveOrg();
  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title="Skills"
        description="Reusable capabilities, authored in Markdown. The AI assistant can suggest improvements — you always approve before anything changes."
      />
      <div className="max-w-2xl">
        <SkillsManager />
      </div>
      {isOrg && isAdmin ? <CapabilitiesSection /> : null}
    </div>
  );
}

/* ------------------------------ Workspace ------------------------------ */

export function UnifiedWorkspaceSection() {
  return (
    <div className="flex flex-col gap-6">
      <WorkspaceSettingsSection />
      <WorkspacesSection />
      <PeopleOrgSection />
      <AppsOrgSection />
    </div>
  );
}
