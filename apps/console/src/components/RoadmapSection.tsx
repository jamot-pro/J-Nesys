"use client";

/**
 * What the design export contains that this console does not implement yet,
 * and what each screen is waiting on.
 *
 * This exists so the gap is visible and specific instead of silent. Every
 * entry names the blocker, so picking one up starts from a known position
 * rather than a rediscovery.
 */
interface Pending {
  screen: string;
  template: string;
  blocker: string;
  state: "backend-ready" | "needs-backend" | "deferred" | "shipped-elsewhere";
}

const PENDING: Pending[] = [
  {
    screen: "AgentConfigurator, Ronbot",
    template: "sales-game",
    blocker: "Backed by /api/agents — buildable now, not yet started.",
    state: "backend-ready",
  },
  {
    screen: "Memory",
    template: "sales-game",
    blocker: "Backed by /api/memory and /api/knowledge — buildable now.",
    state: "backend-ready",
  },
  {
    screen: "DreamChart",
    template: "sales-game",
    blocker: "Backed by /api/dream and updateDreamConfig — buildable now.",
    state: "backend-ready",
  },
  {
    screen: "Commission, deal size, seller pools",
    template: "sales-game / Discovery",
    blocker: "No commission field and no missions entity in the domain model.",
    state: "needs-backend",
  },
  {
    screen: "MissionCenter, MissionTasks, MissionMap, MissionNotes, MissionProfile",
    template: "mission-app",
    blocker:
      "No missions entity, and no aura/level. Tasks and reputation exist, but the mission concept the screens are built on does not.",
    state: "needs-backend",
  },
  {
    screen: "MissionWallet",
    template: "mission-app",
    blocker:
      "On-chain send/deposit. Settlement rails are deferred by JAMOT_SPEC §76; only the internal ledger provider exists.",
    state: "deferred",
  },
  {
    screen: "OrgConsole (desktop, tablet, mobile)",
    template: "org-console*",
    blocker: "Already implemented as the cockpit at mvp.jamot.pro, not in this console.",
    state: "shipped-elsewhere",
  },
  {
    screen: "Deck, Landing",
    template: "deck / landing",
    blocker: "Marketing pages. Nothing to wire to.",
    state: "shipped-elsewhere",
  },
];

const LABEL: Record<Pending["state"], string> = {
  "backend-ready": "ready to build",
  "needs-backend": "needs backend",
  deferred: "deferred",
  "shipped-elsewhere": "elsewhere",
};

export function RoadmapSection() {
  return (
    <>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Not wired yet</h1>
        <p style={{ margin: "var(--space-2) 0 0", maxWidth: "64ch", opacity: 0.75, fontSize: 14 }}>
          The design export has more screens than this console implements. Rather than ship them
          against invented data, each is listed here with what it is actually waiting on.
        </p>
      </header>

      <table className="table">
        <thead>
          <tr>
            <th>Screen</th>
            <th>Template</th>
            <th>State</th>
            <th>Waiting on</th>
          </tr>
        </thead>
        <tbody>
          {PENDING.map((p) => (
            <tr key={p.screen}>
              <td>{p.screen}</td>
              <td style={{ whiteSpace: "nowrap", opacity: 0.7 }}>{p.template}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <span className={p.state === "backend-ready" ? "tag tag-accent" : "tag tag-neutral"}>
                  {LABEL[p.state]}
                </span>
              </td>
              <td>{p.blocker}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
