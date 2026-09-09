import type { DreamConfig } from "@jamot/contracts";

/**
 * Platform-owned DREAM orchestration skill. This is hardcoded in the codebase,
 * NOT stored in the skills table and NOT user-editable. Users configure THEIR
 * dream (via DreamConfig); the orchestration loop that pursues it is fixed.
 */
export const DREAM_SKILL = `# DREAM Orchestration Skill

The DREAM is the central, continuously-pursued purpose of an organization. This
skill orchestrates the org so the DREAM stays achievable over time. It is
platform-owned: users configure their DREAM (objective, outcomes, KPIs,
constraints, timeline, responsibilities), never this skill.

## Monitor - Evaluate - Act - Verify

The core loop runs on a cadence driven by heartbeats:

- **Monitor**: Watch every responsibility, team and DREAM node through incoming
  \`monitors\` edges from heartbeat nodes. Collect the signals each monitor
  declares (status, drift, blockers, metrics).
- **Evaluate**: Compare live signals against the DREAM's KPIs, outcomes and
  constraints. Compute JAMOT (Just A Matter Of Time) operational readiness from
  the actual graph configuration — never hard-coded.
- **Act**: For any gap, dispatch work to the responsible owner (human, agent or
  team). Owners are derived from \`responsible_for\` / \`owns\` edges. Prefer
  escalation actions over silent retries when a monitor fires.
- **Verify**: Confirm the act closed the gap; update memory and the graph so
  readiness reflects reality.

## Responsibility-first architecture

Every responsibility in \`requiredResponsibilities\` must have a covered owner
(a human, agent or team bound by \`responsible_for\` or \`owns\`). Uncovered
responsibilities are reported as missing and drag down readiness.

## Resilience and recovery

For an organization to be JAMOT, every owned responsibility must sit on a team
that is covered by a heartbeat monitor, so that problems are detected and can be
recovered. Heartbeats must define an \`escalate\` action so failures reach a
responsible human.

## JAMOT readiness

The org is operationally ready when all ten readiness dimensions are satisfied:
DREAM objective set, responsibilities covered, actors present, teams present,
tools present, permissions configured, dependencies resolved, heartbeat coverage,
recovery readiness, and escalation configured.`;

/** Build a DreamConfig from a free-form prompt.
 *  The objective is the prompt's first sentence (trailing period stripped);
 *  every structured list starts empty for the user to refine later. */
export async function buildDreamFromPrompt(prompt: string): Promise<DreamConfig> {
  const trimmed = prompt.trim();
  const firstSentence = trimmed.split(/[.!?]+/, 1)[0] ?? trimmed;
  const objective = firstSentence.trim().replace(/\.$/, "");

  return {
    objective,
    outcomes: [],
    kpis: [],
    constraints: [],
    timeline: [],
    requiredCapabilities: [],
    requiredResponsibilities: [],
  };
}