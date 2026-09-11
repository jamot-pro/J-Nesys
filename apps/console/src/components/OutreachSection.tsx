"use client";

import { useCallback, useEffect, useState } from "react";
import {
  activateOutreachCampaign,
  completeOutreachCampaign,
  createOutreachCampaign,
  getAgents,
  getOutreachCampaignDetail,
  listOutreachCampaigns,
  listOutreachLists,
  pauseOutreachCampaign,
  type ApiAgent,
  type OutreachCampaign,
  type OutreachCampaignDetail,
  type OutreachList,
} from "@jamot/client";

import { useOrgScope } from "./console-context";

/** ApiAgent carries no display name — role/purpose is what the API exposes. */
function agentLabel(a: ApiAgent): string {
  return a.role || a.purpose || `agent ${a.id.slice(0, 8)}`;
}

/**
 * Outreach — Outreach.dc.html.
 *
 * "A campaign is a list from People, an agent to work it, and the cascade of
 * messages it sends." Skills, latitude and tools belong to the agent and are
 * configured elsewhere, so this screen deliberately does not offer them.
 */
export function OutreachSection() {
  const { spaceId } = useOrgScope();

  const [lists, setLists] = useState<OutreachList[] | null>(null);
  const [campaigns, setCampaigns] = useState<OutreachCampaign[] | null>(null);
  const [agents, setAgents] = useState<ApiAgent[]>([]);
  const [detail, setDetail] = useState<OutreachCampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [listId, setListId] = useState("");
  const [agentId, setAgentId] = useState("");

  const refresh = useCallback(async () => {
    const items = await listOutreachCampaigns(spaceId);
    setCampaigns(items);
  }, [spaceId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [l, c, a] = await Promise.all([
          listOutreachLists(spaceId),
          listOutreachCampaigns(spaceId),
          getAgents().catch(() => [] as ApiAgent[]),
        ]);
        if (cancelled) return;
        setLists(l);
        setCampaigns(c);
        setAgents(a);
        if (l[0]) setListId(l[0].id);
        if (a[0]) setAgentId(a[0].id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load outreach.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spaceId]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      if (detail) setDetail(await getOutreachCampaignDetail(detail.campaign.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    await act(async () => {
      await createOutreachCampaign({
        spaceId,
        name: name.trim(),
        listId,
        agentId,
        goal: goal.trim(),
      });
      setName("");
      setGoal("");
    });
  }

  const canCreate = Boolean(listId && agentId && name.trim() && goal.trim());

  return (
    <>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Outreach</h1>
        <p style={{ margin: "var(--space-2) 0 0", maxWidth: "62ch", opacity: 0.75, fontSize: 14 }}>
          A campaign is a list from People, an agent to work it, and the cascade of messages it
          sends. Skills, latitude and tools belong to the agent — set those in the agent&apos;s own
          configuration.
        </p>
      </header>

      {error ? (
        <p role="alert" className="card" style={{ color: "var(--accent-ink)", marginBottom: "var(--space-4)" }}>
          {error}
        </p>
      ) : null}

      {lists && lists.length === 0 ? (
        <div className="card" style={{ marginBottom: "var(--space-4)" }}>
          <div className="card-kicker">Before you can start</div>
          <div className="card-title">No outreach list yet</div>
          <p className="card-body">A campaign works a list of people. Build one first.</p>
        </div>
      ) : null}

      {agents.length === 0 ? (
        <div className="card" style={{ marginBottom: "var(--space-4)" }}>
          <div className="card-kicker">Before you can start</div>
          <div className="card-title">No agent available</div>
          <p className="card-body">A campaign needs an agent to work it.</p>
        </div>
      ) : null}

      <form className="card" onSubmit={create} style={{ marginBottom: "var(--space-6)" }}>
        <div className="card-title">New campaign</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
          <div className="field">
            <label htmlFor="cn">Name</label>
            <input className="input" id="cn" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cg">Goal</label>
            <input className="input" id="cg" required placeholder="Book a 20-minute intro call" value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cl">List</label>
            <select className="input" id="cl" value={listId} onChange={(e) => setListId(e.target.value)}>
              {(lists ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.memberPersonIds.length})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ca">Agent</label>
            <select className="input" id="ca" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {agentLabel(a)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !canCreate} style={{ marginTop: "var(--space-4)" }}>
          {busy ? "Working…" : "Create campaign"}
        </button>
      </form>

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Campaigns {campaigns ? <span style={{ opacity: 0.5 }}>({campaigns.length})</span> : null}
        </h2>
        {campaigns === null ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>
        ) : campaigns.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>No campaigns yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Goal</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        void getOutreachCampaignDetail(c.id).then(setDetail).catch(() =>
                          setError("Could not open that campaign."),
                        )
                      }
                    >
                      {c.name}
                    </button>
                  </td>
                  <td>
                    <span className={c.status === "active" ? "tag tag-accent" : "tag tag-neutral"}>
                      {c.status}
                    </span>
                  </td>
                  <td>{c.goal || "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {c.status === "active" ? (
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void act(() => pauseOutreachCampaign(c.id))}>
                        Pause
                      </button>
                    ) : c.status === "draft" || c.status === "paused" ? (
                      <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void act(() => activateOutreachCampaign(c.id))}>
                        Activate
                      </button>
                    ) : null}
                    {c.status === "active" || c.status === "paused" ? (
                      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void act(() => completeOutreachCampaign(c.id))}>
                        Complete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {detail ? (
        <section>
          <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>{detail.campaign.name}</h2>
          <p style={{ fontSize: 14, opacity: 0.75, marginTop: 0 }}>
            {detail.list ? `${detail.list.name} · ${detail.list.memberCount} people` : "no list"} ·{" "}
            {detail.agent ? detail.agent.displayName : "no agent"} · {detail.sends.length} send
            {detail.sends.length === 1 ? "" : "s"}
          </p>
          {detail.steps.length === 0 ? (
            <p style={{ opacity: 0.7, fontSize: 14 }}>
              No steps yet — the cascade is empty, so activating sends nothing.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>After</th>
                  <th>Channel</th>
                  <th>Subject</th>
                </tr>
              </thead>
              <tbody>
                {detail.steps
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>{s.position}</td>
                      <td>{s.sendAfterDays}d</td>
                      <td>
                        <span className="tag tag-neutral">{s.channel}</span>
                      </td>
                      <td>{s.subject || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </>
  );
}
