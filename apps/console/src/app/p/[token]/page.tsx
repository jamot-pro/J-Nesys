import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { OnboardForm } from "./OnboardForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface PublicProfile {
  displayName: string;
  firstName: string | null;
  company: string;
  avatarUrl: string | null;
  hasProfile: boolean;
  profile: {
    narrative?: string;
    markdown?: string;
  } | null;
}

async function fetchProfile(token: string): Promise<PublicProfile | null> {
  const res = await fetch(`${API_URL}/api/people/public/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Public, unauthenticated profile page — no AuthGate, no org chrome. A
 * person's own Human Design / Gene Keys report, self-generated once they
 * fill in their birth data (see OnboardForm), read from
 * profile.selfDescribed.archetypeProfile (packages/api/src/routes/people.ts).
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchProfile(token);

  if (!data) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-6)",
          color: "var(--color-text)",
        }}
      >
        <p style={{ color: "color-mix(in srgb, var(--color-text) 76%, transparent)" }}>
          This link doesn&rsquo;t point to anyone. Ask for a fresh one.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--color-surface)",
        color: "var(--color-text)",
        padding: "var(--space-8) var(--space-4)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 720 }}>
        <div style={{ marginBottom: "var(--space-6)" }}>
          {data.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.avatarUrl}
              alt=""
              style={{ width: 56, height: 56, borderRadius: "999px", objectFit: "cover", marginBottom: "var(--space-3)" }}
            />
          ) : null}
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            {data.displayName}
          </h1>
          {data.company ? (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 14,
                color: "color-mix(in srgb, var(--color-text) 76%, transparent)",
              }}
            >
              {data.company}
            </p>
          ) : null}
        </div>

        {data.hasProfile && data.profile ? (
          <div
            style={{
              border: "1px solid var(--color-divider)",
              borderRadius: "var(--radius-md)",
              background: "var(--color-bg)",
              boxShadow: "var(--shadow-sm)",
              padding: "var(--space-6)",
            }}
          >
            {data.profile.narrative ? (
              <p
                style={{
                  margin: "0 0 var(--space-5)",
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: "color-mix(in srgb, var(--color-text) 85%, transparent)",
                }}
              >
                {data.profile.narrative}
              </p>
            ) : null}
            <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {data.profile.markdown ?? ""}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <OnboardForm token={token} />
        )}
      </div>
    </main>
  );
}
