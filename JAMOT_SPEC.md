# JAMOT — Platform Specification

**Version:** 0.1
**Status:** Source of truth for the platform architecture
**Codename:** J-DH
**Principle:** Build a human-centered, AI-native operating platform for organizations and interoperable actors.

---

## 0. Executive Definition

Jamot is an open, modular platform for people and organizations to work with AI.

Jamot gives a human or organization one place to:

- communicate across channels;
- manage people, agents, tasks and projects;
- connect external tools and MCP servers;
- build and use AI agents;
- understand people through consented profiles and memory;
- route work to the best human, agent or organization;
- learn from outcomes;
- discover external actors and organizations;
- eventually participate in a federated problem-solving and economic network.

Jamot is not primarily an ERP, CRM, chatbot, agent framework, or marketplace. It is the **organizational kernel** and **actor/capability network layer** that connects those functions.

The central abstraction is:

> **Actor + Skill + Connector + Policy = Capability**

And the long-term market abstraction is:

> **Problem → Solver → Agreement → Work → Outcome → Reputation**

---

# 1. Product Philosophy

## 1.1 Human-centered

People are the center of the platform.

Every human should be able to:

- own and control their personal profile;
- complete personality and self-discovery assessments;
- understand their strengths, preferences and working style;
- control personal memory, visibility and consent;
- create personal agents;
- bring personal agents and skills into organizations;
- work across multiple organizations;
- build reputation from verified contributions;
- discover projects and opportunities aligned with their capabilities.

Jamot optimizes for **alignment, capability, learning, contribution and human agency**, not productivity alone.

## 1.2 Organizations as living systems

An organization is a network of humans, agents, tools, capabilities, projects, knowledge and relationships.

The organization should continuously learn:

```text
Experience
→ Memory
→ Knowledge
→ Reflection
→ Proposal
→ Governance
→ Capability change
→ New behavior
→ New experience
```

## 1.3 Agents are actors, not bots

Agents are first-class actors with:

- identity;
- role;
- skills;
- memory;
- capabilities;
- permissions;
- runtime/harness;
- tasks;
- reputation;
- relationships.

The agent runtime is replaceable. The agent identity and organizational history are not.

## 1.4 Sovereignty

A Jamot organization must be able to self-host.

A self-hosted organization owns:

- private data;
- private memory;
- internal agents;
- credentials;
- local governance;
- organizational state.

Federation is optional.

## 1.5 Interoperability

Jamot must be protocol-first and provider-independent.

The platform should align with established protocols rather than create unnecessary replacements:

- **Matrix** — human and organizational communication/federation;
- **A2A** — actor/agent collaboration across organizational boundaries;
- **MCP** — tools, resources, apps and capability access;
- **OAuth/OIDC** — web identity and authorization;
- future **DID / Verifiable Credentials / blockchain** — portable identity, attestations and reputation.

---

# 2. The Jamot Mental Model

```text
                           JAMOT
                             │
          ┌──────────────────┼───────────────────┐
          │                  │                   │
       PERSONAL          ORGANIZATION         NETWORK
         SPACE               SPACE              SPACE
          │                  │                   │
        Actor              Actors             Actors
        Agents             Agents             Orgs
        Memory             Memory             Capabilities
        Skills             Knowledge          Problems
        Goals              Goals              Reputation
          │                  │                   │
          └──────────────────┼───────────────────┘
                             │
                       JAMOT KERNEL
                             │
       ┌─────────────────────┼──────────────────────┐
       │                     │                      │
     Identity            Capabilities           Governance
       │                     │                      │
     Memory               Apps/MCP              Policies
       │                     │                      │
       └─────────────────────┼──────────────────────┘
                             │
                           Actors
                             │
                 ┌───────────┴───────────┐
                 │                       │
               Humans                  Agents
```

---

# 3. Core Domain Model

## 3.1 Actor

`Actor` is the universal participant abstraction.

Types:

```text
HUMAN
AGENT
ORGANIZATION
SYSTEM (optional/internal)
```

Both humans and agents can:

- hold roles;
- possess skills;
- receive tasks;
- perform tasks;
- participate in projects;
- communicate;
- contribute knowledge;
- build reputation;
- participate in multiple organizations.

Organizations are also Actors at the network level.

## 3.2 Space

A `Space` is the ownership and execution boundary.

Types:

```text
PERSONAL
ORGANIZATION
```

### Personal Space

Owned by one Person.

Contains:

- personal profile;
- personal memory;
- personal agents;
- personal skills;
- personal connectors;
- personal goals;
- personal reputation;
- personal vault.

### Organization Space

Owned by an Organization.

Contains:

- members;
- roles;
- agents;
- OrganicChart;
- goals;
- projects;
- tasks;
- apps;
- connectors;
- shared knowledge;
- policies;
- treasury;
- organization reputation.

## 3.3 Person

A Person is a persistent human identity.

A Person may belong to many organizations.

Membership is represented by a relationship, not by duplicating identity.

Example:

```text
Person Maria
 ├── Organization A → Manager
 ├── Organization B → Advisor
 └── Organization C → Event Contractor
```

## 3.4 Agent

An Agent is a persistent AI Actor.

Required concepts:

```text
Agent
├── identity
├── owner
├── space memberships
├── roles
├── skills
├── memory
├── capabilities
├── permissions
├── harness
├── availability
├── heartbeat
├── performance
└── reputation
```

## 3.5 Organization

```text
Organization
├── identity
├── dream
├── blueprint
├── reputation
├── members
├── agents
├── organic charts
├── goals
├── projects
├── tasks
├── apps
├── connectors
├── channels
├── memory
├── knowledge
├── policies
├── treasury
└── settings
```

## 3.6 Role

Relationship between an Actor and a Space/Organization.

A role may define:

- responsibilities;
- permissions;
- capabilities;
- visibility;
- compensation;
- start/end dates.

## 3.7 Position

A position exists inside an Organization's OrganicChart.

A position binds to one Human or Agent at a time, while retaining position history.

---

# 4. Dream and Blueprint

## 4.1 Dream

The Dream is the organization's constitutional purpose.

For organizations that use the perpetual-organization model:

- Dream is set at initiation;
- Dream is injected into relevant agent context;
- Dream constrains treasury purpose;
- Dream anchors long-term organizational learning;
- changes require explicit governance.

The existing Jamot master spec defines Dream as immutable seed and the Jamot pledge as the commitment to pursue it perpetually.

## 4.2 Blueprint

The Blueprint is the current model of how the organization operates.

```text
Blueprint
├── Purpose
├── Goals
├── Strategy
├── Roles
├── Capabilities
├── Processes
├── Policies
├── Agents
├── Human/Agent relationships
├── Apps
├── Knowledge
└── Current hypotheses
```

The Blueprint is versioned.

A proposed organizational change must have provenance.

## 4.3 The Vibe DREAM Configurator

The Organization Visual / organigram is the **Vibe DREAM Configurator**: a visual
operating environment, not a static org chart. The canvas represents a living
system:

```text
DREAM → TEAMS → HUMANS + AGENTS → RESPONSIBILITIES → TOOLS → HEARTBEATS
```

The **DREAM** is the central purpose and supervisory intelligence. Everything else
exists to make the DREAM achievable.

### 4.3.1 Core ontology

| Entity | Definition |
| --- | --- |
| `DREAM` | The ultimate objective and supervisory intelligence. Visually dominant root object. Selecting it opens a conversational configuration experience. |
| `TEAM` | A first-class entity: a group of Humans and Agents responsible for a specific mission, with its own purpose, responsibilities, KPIs, tools, authority, autonomy and escalation rules. Reports toward the DREAM. |
| `HUMAN` | A human actor. |
| `AGENT` | Any AI/software actor — bots, automations, autonomous workers. **There is no separate Bot entity.** |
| `RESPONSIBILITY` | A required outcome that must have an owner (human, agent, team, or human+agent). Drives responsibility-first reasoning. |
| `HEARTBEAT` | A recurring `Monitor → Evaluate → Act → Verify` mechanism. **Never "Loop".** First-class configurable visual object. |
| `TOOL` | MCP servers/tools, APIs, SaaS, internal applications, databases, workflows, integrations. **Tools are capabilities, not organizational actors.** |

`HUMAN`/`AGENT` map onto the existing `Person`/`Actor(type=human|agent)`/`Agent`
models; `TOOL` maps onto existing Skills/Connectors/Capabilities/App registry.
No duplicate actor or integration model is introduced.

### 4.3.2 Relationship types

```text
DREAM      --requires-->      RESPONSIBILITY
TEAM       --owns-->          RESPONSIBILITY
HUMAN      --member of-->     TEAM
AGENT      --member of-->     TEAM
AGENT      --responsible for--> RESPONSIBILITY
AGENT      --uses-->          TOOL
TEAM       --has access to--> TOOL
HEARTBEAT  --monitors-->      TEAM
HEARTBEAT  --monitors-->      DREAM
HEARTBEAT  --invokes-->       TOOL
DREAM      --depends on-->    TEAM
TEAM       --depends on-->    TEAM
```

### 4.3.3 Responsibility-first architecture

The system reasons **DREAM → Required Responsibilities → Responsible Actors**.
Every important responsibility must have an owner. Uncovered responsibilities
are detected and surfaced visually (e.g. `Product ✅`, `Sales ✅`,
`Marketing ⚠️ Missing Owner`), resolvable directly from the canvas.

### 4.3.4 DREAM as central entity

Users describe the DREAM naturally (e.g. "Build a €1M ARR AI consulting company")
and it is translated into structured requirements: objectives, outcomes, KPIs,
constraints, timeline, required capabilities, required responsibilities,
required teams, actors, tools and heartbeats. The underlying **DREAM skill is
platform-controlled**: users configure their DREAM but cannot modify the
orchestration skill. Only the platform creator may change that skill.

### 4.3.5 Organizational resilience

The DREAM must not permanently depend on specific humans:

```text
HEARTBEAT detects inactivity
  → DREAM identifies organizational gap
  → Agents investigate
  → Agents determine required human capability
  → Outreach / recruitment workflow initiated
  → Potential Humans identified
  → Human approval gates applied where required
  → New Human joins Team
  → Responsibility restored
  → DREAM continues
```

Humans may change. Teams may change. Agents may adapt. **The DREAM continues.**
Autonomous outreach/recruitment respects permissions, privacy, security and
approval policies.

### 4.3.6 DREAM Readiness and JAMOT

A computed **DREAM Readiness** state is derived from actual configuration —
never hard-coded — considering: DREAM configuration, responsibility coverage,
actor configuration, team configuration, tool availability, permissions,
dependencies, heartbeats, recovery mechanisms and escalation paths. Missing
requirements are exposed visually.

**JAMOT — Just A Matter Of Time** is exposed when the DREAM is sufficiently
configured and operational. It means operational readiness: the organization is
configured to continuously pursue the DREAM, detect problems, adapt and recover.
It does **not** mean guaranteed success.

```text
DREAM READY
Responsibilities: 100%
Actors: 100%
Tools: 100%
Heartbeats: 100%
Recovery: 100%
[ JAMOT — Just A Matter Of Time ]
```

### 4.3.7 Contextual AI

The CopilotKit/chat experience understands the entire organizational graph, not
only the currently selected object. Selected entities supply relevant context
(DREAM relationship, team, responsibilities, members, tools, heartbeats,
dependencies, tasks, memory, current state, history). The AI can **perform
configuration actions**, not just answer questions:

> "Create a Sales Agent for this Team."
> "Give this Team access to our CRM."
> "Why is this Team blocking the DREAM?"
> "Which responsibilities are uncovered?"
> "What changed since yesterday?"
> "Find someone to replace the inactive human responsible for this mission."

---

# 5. People and Personal Intelligence

## 5.1 Personal profile

Every Person may build a structured personal profile.

Possible dimensions:

- self-description;
- values;
- working preferences;
- skills;
- experiences;
- goals;
- personality assessments;
- Integral Profile;
- availability;
- learning objectives.

## 5.2 Integral Profile

Integral Profile is a modular app, not a hard-coded core entity.

The LLM may classify free-form answers, but deterministic functions should calculate structured outputs whenever possible.

All derived characteristics require provenance:

```text
source = self_declared | assessment | observed | feedback | inferred
confidence
createdAt
updatedAt
```

A profile is a working model, not an immutable truth.

## 5.3 Human-centered optimization

Jamot should help answer:

- What does this person do best?
- What work gives them energy?
- What work drains them?
- What environment helps them thrive?
- What skills are emerging?
- Which opportunities match their preferences and strengths?
- Which work combinations create value for both the person and organization?

Jamot must not silently convert inference into employment truth or discriminatory scoring.

---

# 6. Memory Architecture

Jamot uses scoped memory, not one universal memory table.

```text
Person Memory
Agent Memory
Relationship / Perspective Memory
Organization Memory
Network Memory
Knowledge Graph
Event History
```

## 6.1 Person Memory

Owned by the Person.

Must support:

- export;
- edit;
- delete;
- visibility;
- consent;
- provenance.

Visibility levels:

```text
PRIVATE
SHARED
ORG
```

## 6.2 Agent Memory

Persistent cognitive memory used by an Agent.

The existing design renames `ConversationMemory` to `AgentMemory`.

## 6.3 Organization Memory

Shared, organization-controlled memory used for operations and organizational learning.

## 6.4 Perspective Memory

Optional perspective layer representing what one Actor believes/knows about another Actor.

Example:

```text
Agent A → Customer B
"likely price sensitive"
```

Perspective must never be represented as an objective fact without provenance.

## 6.5 Knowledge Graph

Temporal organizational knowledge should use a graph implementation such as Graphiti + FalkorDB or a replaceable equivalent.

Implementation status: wired as a dual-write projection of memory. Postgres `memories`/`knowledge` tables remain the source of truth; a self-hosted Graphiti MCP server (`zepai/knowledge-graph-mcp:standalone` over FalkorDB, see `docker-compose.yml`) receives a parallel write from the `MemoryProvider` layer (`createDualWriteMemoryProvider` + `createGraphitiMemoryMirror` in `packages/core/src/memory/`), enabled via `GRAPHITI_ENABLED`/`GRAPHITI_MCP_URL`. Reads come from Postgres; mirror failures are soft (logged, never fail the request).

Graph should represent:

- people;
- agents;
- organizations;
- projects;
- skills;
- capabilities;
- problems;
- decisions;
- outcomes;
- relationships;
- temporal validity;
- provenance;
- organizational graph nodes (DREAM, TEAM, RESPONSIBILITY, HEARTBEAT, TOOL);
- organizational graph edges and their history.

## 6.6 Event history

Raw important experience is represented as canonical events.

Memory and knowledge are derived projections.

## 6.7 Organization Graph Memory

The Vibe DREAM organization is a dynamic graph, and important organizational
relationships must be represented consistently in the memory layer. The
organizational graph (see §4.3) is projected into memory so the DREAM can reason
over both **current organizational state** and **organizational history**.

The memory system understands relationships such as:

```text
DREAM    --requires-->      Responsibility
TEAM     --owns-->          Responsibility
HUMAN    --member of-->     Team
AGENT    --member of-->     Team
AGENT    --responsible for--> Responsibility
AGENT    --uses-->          Tool
TEAM     --uses-->          Tool
HEARTBEAT --monitors-->     Team
HEARTBEAT --monitors-->     DREAM
DREAM    --depends on-->    Team
TEAM     --depends on-->    Team
```

Ownership/association edges are stored with **temporal validity**
(`valid_from` / `valid_to`), so history is preserved rather than overwritten:

- who was responsible for something;
- which Agent replaced which Human;
- when a Human disengaged;
- why a Team was reorganized;
- which Agent performed an action;
- which Tool was used;
- which Heartbeat detected a problem;
- what decision was made;
- how the organization responded.

**Source of truth split:** Postgres `org_nodes` / `org_edges` (and the existing
actors/roles/members tables) are the live current-state source of truth. The
memory layer (`knowledge_entities`/`knowledge_edges` with `valid_from`/`valid_to`,
and the Graphiti dual-write projection) preserves history and derived knowledge.
These two layers are kept consistent: every org-graph mutation writes a scoped
organization memory event, and the dual-write mirror receives the same payload.
Reads of current state come from the live graph; reads of history come from
memory. No conflicting source of truth is created.

---

# 7. Network Memory

The global/federated network has its own memory, but it must not become a copy of every organization's private memory.

Network memory stores permissioned/derived signals such as:

- public Actors;
- public organizations;
- public capabilities;
- public problems;
- public opportunities;
- availability;
- reputation attestations;
- public project outcomes;
- successful/failed connection patterns;
- emerging capability demand;
- relationship patterns.

The network memory has two distinct functions:

### Network Index

Optimized for low-latency retrieval:

```text
Who can solve X?
Who is available?
Who is nearby?
Who has capability Y?
Who is within budget Z?
```

### Network Learning Memory

Optimized for evolution:

```text
Which connections worked?
Why did they work?
Which recommendations were rejected?
What capabilities are emerging?
Which organizations should connect?
```

The network must learn from matchmaking outcomes.

---

# 8. Skills

A Skill is reusable executable knowledge.

```text
Skill
├── id
├── version
├── name
├── description
├── inputs
├── outputs
├── prerequisites
├── allowed capabilities
├── evaluation criteria
├── provenance
└── status
```

Skills may belong to:

- People;
- Agents;
- Organizations;
- Apps.

A validated organizational Skill may be distributed to multiple Agents.

Skills evolve through outcomes and evaluation.

---

# 9. Connectors

A Connector is an authenticated bridge to an external system.

Examples:

- WhatsApp;
- Telegram;
- Discord;
- Matrix;
- Google Calendar;
- GitHub;
- Stripe;
- accounting systems;
- ERP;
- databases;
- object storage;
- MCP servers;
- IoT systems.

```text
Connector
├── id
├── provider
├── type
├── capabilities
├── owner
├── credentialRef
├── scopes
├── status
└── configuration
```

Connectors never expose raw credentials to agents or clients.

---

# 10. Capabilities

A Capability is an allowed, executable operation.

Conceptually:

```text
Capability = Skill + Connector + Policy + Context
```

Example:

```text
Skill: customer_service
Connector: WhatsApp
Policy: existing_customer_only
Context: Restaurant A

→ customer.whatsapp.reply
```

Capabilities are the unit consumed by:

- humans;
- agents;
- apps;
- the Main Manager;
- the marketplace.

---

# 11. Apps and SDK

Jamot is modular.

Each App is an independent compatible component.

```text
src/apps/<id>/
```

Each App must provide a manifest with:

```text
id
name
description
iconName
category
tools
capabilities
hooks
```

Apps may include:

- UI/canvas;
- server handlers;
- data models;
- APIs;
- tools;
- events;
- workflows;
- settings.

Apps must not access arbitrary tenant data.

The platform decides which Apps are enabled and visible.

---

# 12. Deterministic App Resolver

`AppResolver` chooses relevant Apps from:

```text
space
organization type
actor role
current context
permissions
enabled apps
required capabilities
```

The LLM may suggest an App, but the resolver determines whether it is allowed and relevant.

The UI should surface only a small set of relevant Apps.

---

# 13. Main Manager / Dispatcher

Jamot has one logical Main Manager between the user, organizational state, humans, agents, Apps, MCP and external actors.

The Main Manager is responsible for:

```text
Understand
Classify
Route
Delegate
Coordinate
Verify
Escalate
Learn
```

It should not perform specialist work if a better actor/capability exists.

## 13.1 Routing pipeline

```text
Request
→ Intent
→ Required capabilities
→ Candidate actors
→ Policy filtering
→ Routing score
→ Assignment
→ Execution
→ Verification
→ Outcome
```

Routing score should consider:

- capability fit;
- skill fit;
- historical success;
- availability;
- latency;
- cost;
- relationship continuity;
- reputation;
- risk;
- permissions.

## 13.2 Routing speed tiers

### Tier 0 — deterministic

Known intent → known capability → direct execution.

### Tier 1 — fast classification

Cheap model/classifier produces structured intent.

### Tier 2 — strategic reasoning

Powerful reasoning only for ambiguous, high-value or strategic work.

---

# 14. Humans and Agents as Workforce

Tasks may be assigned to:

```text
Human
Agent
Human + Agent
Organization
External Actor
```

Typical pattern:

```text
Agent prepares
→ Human approves
→ Agent executes
```

High-risk actions must pass through policy and approval.

---

# 15. Agent Harnesses

The Agent identity is independent from the runtime used to execute it.

Harness interface:

```text
id
name
adapterType: cli | http | mcp
defaultCommand?
argsTemplate?
configSchema
run(prompt, config, credentials)
```

Possible implementations:

- Hermes;
- OpenClaw;
- OpenManus;
- OpenCode;
- Codex;
- generic HTTP;
- generic MCP;
- future runtimes.

Changing harness must not destroy the Agent's identity, memory, organizational history or reputation.

---

# 16. Communication and Channels

Jamot communication is channel-independent.

Initial channels:

- WhatsApp;
- Telegram;
- Discord;
- Matrix;
- Web.

Channel plugin contract conceptually includes:

```text
id
name
icon
connect
disconnect
status
listChats
handleIncoming
sendMessage
authConfigSchema
```

Communication must map into a common organizational event model.

---

# 17. Matrix

Matrix is the preferred communication federation layer.

Use Matrix for:

- human communication;
- organization communication;
- channel federation;
- room/event transport.

Matrix is not the canonical business database.

---

# 18. MCP

MCP is the primary capability/tool/resource interoperability layer.

Use MCP for:

- Apps exposing tools;
- external data/resources;
- internal services;
- external Agent capabilities;
- connectors;
- Agent runtime interoperability.

Jamot remains responsible for:

- identity;
- permissions;
- capability scope;
- tenant isolation;
- policy;
- consent;
- budget.

MCP is transport/interoperability, not Jamot's business model.

---

# 19. A2A

A2A is the preferred cross-organizational Agent-to-Agent collaboration protocol.

Use A2A for:

- discovering remote Agents;
- negotiating work;
- delegated execution;
- exchange of tasks, messages and artifacts;
- cross-organization collaboration.

Do not expose an organization's internal tools or private memory merely because an external Actor connects through A2A.

---

# 20. Protocol Stack

```text
Human Web Identity
        │
      OAuth/OIDC
        │
        ▼
Jamot Identity / Policy
        │
   ┌────┼───────────────┐
   ▼    ▼               ▼
Matrix A2A             MCP
  │     │               │
Human  Actor          Tools/Data
Comm.  Collaboration  Capabilities
```

Future:

```text
DID / VC / Blockchain
        │
Identity + Attestation + Reputation
```

Blockchain is not required for MVP.

---

# 21. Actor Interoperability

External Agents may be imported as Actors.

External organizations may be represented as Actors.

Every external Actor should expose, where supported:

```text
actorId
actorType
capabilities
public profile
availability
endpoints
trust metadata
pricing (optional)
reputation references
```

The local Jamot system can interact with the external Actor through A2A/MCP without importing private data.

---

# 22. Federation

Jamot must eventually support independently hosted Jamot Networks.

A Jamot Network is a self-hosted discovery/trust/coordination domain.

Networks do not need to share:

- database;
- UI;
- memory;
- organization data;
- agents;
- codebase.

They only need to implement common protocols.

## 22.1 Network

```text
Network
├── id
├── identity
├── public manifest
├── discovery endpoint
├── federation policy
├── trust policy
└── supported protocols
```

## 22.2 Federation Peer

```text
FederationPeer
├── localNetworkId
├── remoteNetworkId
├── endpoint
├── trustLevel
├── supportedProtocols
├── status
└── lastVerifiedAt
```

Suggested trust levels:

```text
NONE
DISCOVERY
VERIFIED
TRANSACT
```

Federated does not mean trusted.

## 22.3 Network Manifest

A public manifest should be discoverable from a well-known endpoint such as:

```text
/.well-known/jamot
```

It should advertise only public metadata and protocol endpoints.

---

# 23. Public vs Private Federation Data

Public/permissioned federation data may include:

- Actor identity;
- organization identity;
- public skills;
- public capabilities;
- public problems;
- public projects;
- public availability;
- public pricing;
- public reputation attestations;
- protocol endpoints.

Never federate by default:

- private conversations;
- personal private memory;
- customer data;
- HR records;
- organization secrets;
- internal financial data;
- internal strategy;
- private Agent memory.

---

# 24. Problems and Marketplace

A `Problem` is a first-class network object.

```text
Problem
├── title
├── description
├── requester
├── requiredCapabilities
├── desiredOutcome
├── constraints
├── budget
├── deadline
├── location
└── visibility
```

The Marketplace connects Problems with Actors.

The core workflow is:

```text
Problem
→ Discover
→ Match
→ Offer
→ Select
→ Agreement
→ Task
→ Work
→ Verify
→ Pay
→ Reputation
```

---

# 25. Offers

An Actor may publish an `Offer` against a Problem.

```text
Offer
├── problemId
├── actorId
├── capabilities
├── price
├── estimatedDuration
├── terms
├── availability
├── evidence
└── status
```

Main Manager evaluates Offers by:

- fit;
- reputation;
- cost;
- availability;
- expected outcome;
- risk;
- relationship continuity.

---

# 26. Reputation

Reputation is capability-specific.

Do not use one universal score as the primary signal.

Example:

```text
Actor Maria
├── event_management: 96
├── customer_service: 91
└── accounting: 61
```

Reputation derives from evidence:

```text
Task
→ Outcome
→ Verification
→ Attestation
→ Reputation update
```

## 26.1 Attestations

```text
Attestation
├── subjectActorId
├── issuerActorId
├── capability
├── claim
├── evidenceRef
├── createdAt
├── expiresAt
└── externalProofRef?
```

External proof may eventually reference DID/VC/blockchain infrastructure.

MVP remains off-chain.

---

# 27. Network Intelligence

The Network should become an intelligence layer for discovering valuable connections.

Functions:

```text
Opportunity Detection
Capability Matching
Problem Matching
People Matching
Agent Matching
Organization Matching
Partnership Discovery
Team Formation
Emerging Capability Detection
Conflict Detection
```

## 27.1 Connection proposal

```text
ConnectionProposal
├── sourceActor
├── targetActor
├── connectionType
├── score
├── reasons
├── confidence
├── expectedValue
└── status
```

Connection types:

```text
COLLABORATE
HIRE
INTRODUCE
PARTNER
INVEST
MENTOR
LEARN
REFER
DELEGATE
JOIN_PROJECT
SHARE_CAPABILITY
```

Recommendations must be explainable.

Example:

> We recommend connecting Organization A and Organization B because they have complementary capabilities, overlapping market, compatible pricing, and available capacity.

---

# 28. Network Learning Loop

```text
Recommendation
→ Connection
→ Work
→ Outcome
→ Success / failure
→ Evidence
→ Network memory
→ Matching model update
→ Better recommendation
```

Rejected and failed recommendations are also learning signals where consent and policy permit.

---

# 29. Temporary Solver Networks

A Problem may be solved by a temporary combination of Actors.

Example:

```text
Problem: Festival production

Human Event Manager
        │
        ├── Logistics Agent
        ├── Sound Organization
        └── Catering Company
```

The temporary team can receive a project-scoped identity and permissions.

Contributions are tracked separately.

---

# 30. Treasury and Economic Layer

For perpetual organizations, Treasury represents organizational economic state.

MVP treasury is an internal ledger, not a custody system.

Core concepts:

```text
Treasury
TreasuryLedgerEntry
TreasuryProposal
ContributionCredit
DistributionRule
```

Possible contribution types:

```text
capital
bounty
referral
performance
milestone
```

The Treasury must be protected by policy and approval rules.

Actual custody, tokenization and legal structures are future integrations.

---

# 31. Future Agentic Commerce

Long-term model:

```text
Problem
→ Actor discovery
→ A2A negotiation
→ Policy authorization
→ Work
→ Verification
→ Payment
→ Reputation
```

Payment providers must be abstracted behind a `PaymentProvider` interface.

Possible future providers include:

- card/network agentic payment rails;
- bank transfer;
- stablecoin/crypto rails;
- other regulated payment providers.

Jamot must not hard-code one financial rail.

---

# 32. Frontend UX

Jamot's frontend should be minimal, elegant and contextual.

## 32.1 Three-pane layout

```text
┌──────────────┬───────────────────────────┬────────────────┐
│ LEFT         │ CENTER                    │ RIGHT          │
│ navigation   │ chat / workspace          │ context dock   │
│              │                           │                │
│ history      │                           │ people         │
│ projects     │                           │ agents         │
│ spaces       │                           │ apps           │
│              │                           │ tasks          │
│              │                           │ organigram     │
│ settings     │                           │ dashboards     │
│ profile      │                           │                │
└──────────────┴───────────────────────────┴────────────────┘
```

## 32.2 Left sidebar

Contains:

- search;
- chat history;
- projects;
- Spaces;
- primary navigation;
- bottom profile/space switcher;
- settings.

## 32.3 Center

Primary work surface.

Default:

- ChatGPT-like conversational UI;
- streaming responses;
- attachments;
- contextual actions;
- CopilotKit/AG-UI.

Settings replace the center workspace rather than opening modal dialogs.

## 32.4 Right Context Dock

Dynamic and resizable.

Contains contextually relevant:

- People;
- Agents;
- Apps;
- Tasks;
- Projects;
- Memory;
- Dashboards;
- OrganicChart;
- Marketplace results.

The right dock is an inspector, not a second navigation system.

---

# 33. Living Network UI

The organization should be visualized as a living Actor network.

Visual metaphor:

- Organization = large nucleus/network node;
- Human = Actor circle;
- Agent = Actor circle with distinct visual treatment;
- Project = contextual node;
- Task = smaller active node;
- Dream = attractor/north star;
- external Actor = outlined/dotted node;
- relationship = connection.

The visual language should evoke:

- atoms;
- biology;
- mycelium;
- living systems.

## 33.1 Important rule

Do not render the entire global network.

```text
Millions of actors
→ relevance filtering
→ semantic clustering
→ viewport subgraph
→ 20–300 visible objects
```

The network is infinite; the viewport is intelligent.

## 33.2 Semantic zoom

Zoom levels:

```text
Global Network
→ Network / Region / Industry
→ Organization
→ Project
→ Actor
→ Conversation
```

## 33.3 GPU rendering

Large graphs should use WebGL/Canvas for geometry and React/DOM overlays only for selected/high-value objects.

## 33.4 DREAM Configurator canvas

The organizational canvas (React Flow / xyflow) is the primary DREAM
configuration surface, evolving the existing drag-and-drop organigram:

- **Preserve** the existing drag-and-drop architecture.
- Users can: create entities, drag entities, connect entities, assign
  responsibilities, move Humans/Agents into Teams, connect Tools, create
  Heartbeats, inspect dependencies, view organizational health, configure
  entities, ask contextual AI questions, and execute configuration actions
  through AI.
- **Right-click contextual `+` menu:** New Agent, Add Human, Create Team,
  Create Heartbeat, Add Tool / MCP, Add Internal App, Connect Existing.
  Creation is immediate and visual; configuration happens through contextual
  panels and conversational UI.
- Node kinds map to §4.3.1 (DREAM, TEAM, HUMAN, AGENT, RESPONSIBILITY, TOOL,
  HEARTBEAT). The DREAM is the visually dominant root. Agent is drawn with a
  distinct visual treatment; Tools are capabilities (not actors).
- Node/edge mutations persist via the org-graph API and are projected to memory
  (§6.7). Drag-to-reparent (team membership) and edge creation persist server-side
  instead of being client-only.
- A **DREAM Readiness / JAMOT panel** (§4.3.6) exposes readiness dimensions and
  missing requirements, with a JAMOT badge when all dimensions are green.

---

# 34. Conversational Network

Every node is a conversational entry point.

Click a Human:

> What is this person working on?

Click an Agent:

> Why did it choose this task?

Click a Project:

> What is blocking the project?

Click an Organization:

> What are its current priorities?

The selected node becomes conversational context.

CopilotKit/AG-UI provides the interaction layer.

---

# 35. Context-Aware Memory Retrieval

The platform must not dump all memory into the context.

Retrieve based on:

```text
viewer
selected Actor/Object
current Space
current Organization
current Project/Task
permissions
consent
recent activity
question intent
relevance
```

The system should surface the smallest useful context.

---

# 36. Settings and Vault

All configuration must be centralized under Settings.

### Personal Settings

```text
Profile
Integral Profile
Memory
Privacy & Consent
Vault
Connectors
Skills
Personal Agents
Notifications
Appearance
Security
```

### Organization Settings

```text
General
People
Roles
OrganicChart
Agents
Apps
Channels
Connectors
Shared Skills
Policies
Treasury
Dream
Memory
Security
Audit
```

## Vault

One unified UI for credentials and secrets:

- AI providers;
- connectors;
- MCP;
- harnesses;
- channel credentials;
- API keys;
- organization secrets.

Personal and organization vaults remain technically separated.

---

# 37. Agent Configuration UX

Agent configuration must be minimal.

Primary screen:

```text
Name
What should it help with?
Skills
Channels
Autonomy
Save
```

Advanced technical settings are hidden under Advanced.

Users should not need to understand model parameters or infrastructure details to create an Agent.

---

# 38. Organization Graph / OrganicChart

The OrganicChart is both:

- organizational structure;
- collaboration topology.

Humans and Agents are visually equivalent actor nodes.

A node can show:

- Role;
- Skills;
- Memory;
- Reputation;
- Projects;
- Tasks;
- Agents;
- Relationships.

The Main Manager may suggest organizational changes, but governance controls execution.

---

# 39. Dashboard Philosophy

Do not create a permanent enterprise dashboard overloaded with charts.

Dashboards are contextual Apps/views.

Examples:

- Restaurant dashboard;
- Construction dashboard;
- Event dashboard;
- People dashboard;
- Agent dashboard;
- Treasury dashboard.

The Dashboard is selected based on current Space and context.

---

# 40. Security Architecture

Security is foundational.

## 40.1 Tenant isolation

Every server-side request must derive:

```text
actorId
spaceId
organizationId
permissions
```

from authenticated context.

Never trust tenant identifiers supplied by the client.

## 40.2 Vault security

Secrets must:

- remain server-side;
- be encrypted at rest;
- be scoped;
- never be included in client DTOs;
- never be blindly injected into prompts.

## 40.3 MCP security

Require:

- HTTPS for remote endpoints;
- URL validation;
- SSRF protection;
- private-range blocking;
- manifest validation;
- scoped auth;
- tenant-scoped queries;
- no forwarding of user tokens to arbitrary endpoints.

## 40.4 Harness security

CLI/command execution requires per-adapter allowlists.

No arbitrary shell execution by default.

## 40.5 Agent security

Every Agent receives only:

- authorized skills;
- authorized capabilities;
- authorized connectors;
- scoped secrets;
- scoped memory;
- scoped organizations.

## 40.6 Audit

All important mutations should create audit/event records:

- task assignment;
- permission change;
- secret access;
- policy decision;
- agent execution;
- financial operation;
- memory visibility change;
- organizational change.

---

# 41. Governance and Bounded Autonomy

Default Agent behavior:

```text
Reflect
→ Propose
→ Escalate
```

Agent actions must be classified by risk.

Example:

```text
LOW
read data
summarize
suggest

MEDIUM
create task
contact internal actor
modify workflow

HIGH
external outbound send
financial commitment
permission change
organizational structural change
```

High-risk actions require explicit policy approval.

Outbound sends require per-agent authorization and optional quiet hours.

Recruitment requires human-approved proposals, consent, cost caps and anti-spam controls.

---

# 42. Event Model

Important changes become canonical Events.

Examples:

```text
actor.created
actor.updated
role.assigned
role.removed
organization.created
member.joined
member.left
conversation.created
message.received
message.sent
goal.created
task.created
task.assigned
task.started
task.completed
decision.proposed
decision.approved
decision.rejected
skill.created
skill.updated
capability.granted
capability.revoked
memory.created
memory.updated
knowledge.created
knowledge.invalidated
reputation.updated
problem.created
offer.created
offer.accepted
connection.proposed
connection.accepted
connection.rejected
treasury.contribution
treasury.proposal
treasury.payment
blueprint.proposed
blueprint.approved
blueprint.changed
```

Events are append-oriented and must preserve provenance.

---

# 43. Data Persistence

## PostgreSQL

Source of truth for structured application state:

- actors;
- spaces;
- organizations;
- roles;
- tasks;
- goals;
- apps;
- connectors;
- policies;
- structured memory;
- treasury;
- audit metadata.

## Graph Store

Graphiti + FalkorDB or replaceable equivalent for temporal knowledge.

## Object Storage

S3/MinIO-compatible storage for:

- files;
- recordings;
- documents;
- artifacts;
- media.

## Redis

Optional and only where justified:

- queues;
- pub/sub;
- ephemeral state;
- caching;
- locks.

---

# 44. Backend Architecture

Start as a **modular monolith**.

Do not begin with distributed microservices.

Logical modules:

```text
/core
/identity
/spaces
/organizations
/actors
/people
/agents
/roles
/organic-chart
/goals
/projects
/tasks
/skills
/connectors
/capabilities
/apps
/channels
/conversations
/events
/memory
/knowledge
/reputation
/network
/marketplace
/policies
/treasury
/harnesses
/heartbeats
```

Separate workers only where runtime constraints justify them:

```text
API/Web process
Scheduler/Heartbeat worker
Memory/Graph worker
Channel workers
Agent execution workers
```

---

# 45. Scheduler and Heartbeats

Use one logical scheduler protected by PostgreSQL advisory locking for multi-instance safety.

Responsibilities:

- Agent heartbeats;
- scheduled scans;
- scheduled tasks;
- memory jobs;
- continuity loop;
- maintenance;
- network indexing.

Operations must be idempotent.

---

# 46. Performance and Scale

The platform must be designed for:

- 10,000+ organizations;
- 1,000,000+ Agents;
- large numbers of Humans;
- federated networks.

## UI rule

Never render the entire graph.

Use:

- relevance ranking;
- semantic clustering;
- pagination;
- viewport queries;
- graph traversal limits;
- caching;
- WebGL/Canvas;
- live updates only for visible context.

## Backend rule

Never query all Actors for a routing request.

Pipeline:

```text
Intent
→ indexed capability retrieval
→ candidate filtering
→ reputation filtering
→ graph/context ranking
→ top N
```

---

# 47. Marketplace Performance

The Marketplace must support fast retrieval.

Use a two-stage architecture:

```text
Stage 1: Network Index
→ fast candidate retrieval

Stage 2: Network Intelligence
→ deeper ranking and reasoning
```

The Network Index should be optimized for low latency.

The Network Intelligence layer may use richer graph/memory computation asynchronously.

---

# 48. Network Discovery

The long-term network supports multiple independently operated Jamot Networks.

```text
Network A ↔ Network B ↔ Network C
```

No network is authoritative by default.

Discovery may be:

- global;
- regional;
- industry-specific;
- private;
- enterprise;
- community-operated.

A local Jamot instance may choose which directories/Networks it trusts.

---

# 49. Network Trust Model

A federation relationship does not imply full trust.

Trust is layered:

```text
Reachable
→ Discoverable
→ Identity verified
→ Capability verified
→ Reputation trusted
→ Transaction permitted
```

Policies determine which level is required for each action.

---

# 50. Future Blockchain Layer

Blockchain is explicitly **not an MVP dependency**.

Future use cases:

- portable Actor identity;
- Organization identity;
- verifiable capability attestations;
- reputation attestations;
- portable contribution records;
- payment commitments;
- settlement.

Do not store:

- raw personal memory;
- private organization data;
- conversations;
- CRM records;
- secrets.

Use a provider-independent abstraction:

```text
BlockchainAdapter
├── registerIdentity
├── anchorAttestation
├── verifyAttestation
├── createPaymentIntent
└── settle
```

---

# 51. Source-of-Truth Rule

Jamot owns the following semantics:

```text
Actor
Organization
Space
Role
Skill
Connector
Capability
Problem
Offer
Task
Memory ownership
Policy
Reputation model
Governance
Marketplace
```

External systems are implementation providers:

```text
Letta      → agent cognition
Honcho     → perspective memory
Graphiti   → temporal graph
Paperclip  → organizational execution concepts/backend adapter
Hermes     → agent runtime
OpenClaw   → agent runtime
OpenManus  → agent runtime
Matrix     → communication federation
MCP        → capability interoperability
A2A        → agent collaboration
```

These providers must be replaceable.

---

# 52. Provider Abstraction Rule

Application code must depend on Jamot interfaces.

Bad:

```text
/app → imports Letta directly
```

Good:

```text
/app → JamotMemory API → Letta adapter
```

Bad:

```text
/core → depends on Paperclip tables
```

Good:

```text
/core → JamotTask API → execution adapter
```

This prevents vendor/runtime lock-in.

---

# 53. Recommended Repository Architecture

```text
/apps
  web

/packages
  core
  domain
  ui
  sdk
  protocol
  memory
  federation
  auth

/src
  actors
  organizations
  spaces
  agents
  people
  tasks
  skills
  connectors
  capabilities
  apps
  channels
  events
  memory
  knowledge
  reputation
  network
  marketplace
  policies
  treasury
  harnesses
  heartbeats

/docs
  ARCHITECTURE.md
  PROTOCOLS.md
  SECURITY.md
  SDK.md
  APPS.md
  FEDERATION.md
  CONTRIBUTING.md
```

A monorepo is optional. A modular repository is mandatory.

---

# 54. App SDK Principles

Apps must:

1. declare capabilities;
2. declare required entities;
3. declare permissions;
4. declare connector requirements;
5. expose optional UI/canvas;
6. emit standard events;
7. use Jamot APIs rather than direct infrastructure access;
8. remain independently testable;
9. be installable/enabled per Organization;
10. never bypass policy.

---

# 55. API Principles

Expose domain APIs, not vendor APIs.

Good:

```text
/api/actors
/api/organizations
/api/tasks
/api/capabilities
/api/memory
/api/knowledge
/api/problems
/api/offers
/api/network
```

Bad:

```text
/api/letta
/api/honcho
/api/paperclip
```

Provider-specific APIs belong behind adapters.

---

# 56. Example: Restaurant

A Restaurant Organization may enable:

```text
People
Reservations
WhatsApp
Staff
Inventory
Suppliers
Finance
Marketing
```

Actors:

```text
Owner — Human
Manager — Human
Customer Agent — Agent
Inventory Agent — Agent
External Supplier — Organization
```

The owner asks:

> "What should we focus on today?"

Jamot may retrieve:

- low stock;
- staff availability;
- unresolved customer issue;
- high-value reservation;
- blocked supplier task.

The interface shows those objects in context.

---

# 57. Example: Construction Company

Apps:

```text
Projects
Sites
People
Suppliers
Materials
Documents
Safety
Finance
```

The Main Manager can route:

```text
"Find someone who can review the electrical plan."
```

to:

- internal engineer;
- external engineer organization;
- specialist Agent;
- human + Agent team.

The best option is selected using capabilities, reputation, availability, cost and policy.

---

# 58. Example: Event Organization

Apps:

```text
Events
Venues
Speakers
Sponsors
Vendors
Tickets
Tasks
Finance
```

The network may discover:

```text
Event Organization A
↔
Production Company B
↔
Maria, Event Manager
↔
Logistics Agent C
```

The connection may be temporary for the project.

---

# 59. Human Opportunity Model

A Person may discover:

- projects;
- organizations;
- bounties;
- collaborations;
- learning opportunities;
- agent opportunities;
- investment opportunities.

Matches should consider:

- capabilities;
- preferences;
- personality/working profile;
- availability;
- reputation;
- compensation;
- goals.

The person decides what to accept unless explicitly delegated.

---

# 60. Agent Opportunity Model

Agents may also be discovered as service providers.

A published Agent may expose:

```text
capabilities
price
availability
reputation
A2A endpoint
MCP capabilities
```

Other organizations may hire the Agent under scoped permissions.

---

# 61. Organization-to-Organization Collaboration

Organization A may collaborate with Organization B without sharing infrastructure.

```text
Organization A Main Agent
        │
       A2A
        │
Organization B Public Agent
        │
       MCP
        │
Organization B private capabilities
```

A2A is the collaboration boundary.

MCP is the internal capability boundary.

Jamot policy governs authorization.

---

# 62. Network-to-Network Collaboration

Independent Jamot Networks may federate:

```text
Network A
   ↕
Network B
```

via:

- public manifests;
- discovery;
- identity verification;
- A2A;
- MCP;
- Matrix;
- trust policies.

The network may keep its own directory and still participate in broader federation.

---

# 63. Main UX Principles

1. **Minimal by default.**
2. **Context over navigation.**
3. **Conversation everywhere.**
4. **Network instead of static org chart.**
5. **People and Agents use the same visual grammar.**
6. **Settings live in one workspace.**
7. **Secrets live in one Vault UI.**
8. **The right sidebar is contextual.**
9. **Users see relevant subgraphs, not the entire network.**
10. **Complexity is progressively disclosed.**

---

# 64. Non-Goals for 0.1

Do not make MVP:

- a blockchain system;
- a fully autonomous economy;
- a global federation implementation;
- an ERP replacement;
- a universal social network;
- a generalized LLM platform;
- a microservice-heavy distributed system;
- an opaque employee-scoring engine.

The MVP should prove the organizational kernel and living memory loop.

---

# 65. MVP Scope

Jamot 0.1 should support:

### Identity

- Human;
- Agent;
- Organization;
- Personal Space;
- Organization Space.

### Organization

- Dream;
- roles;
- OrganicChart;
- goals;
- projects;
- tasks;
- agents.

### Communication

- WhatsApp;
- Matrix;
- one additional channel adapter where practical.

### Intelligence

- Main Manager;
- Agent Memory;
- Person Memory;
- basic knowledge retrieval;
- contextual CopilotKit interface.

### Capabilities

- Skills;
- Connectors;
- MCP;
- App SDK;
- one or more harness adapters.

### UX

- ChatGPT-like center;
- left navigation/history;
- resizable right Context Dock;
- actor network visualization;
- contextual chat everywhere;
- centralized Settings/Vault.

### Security

- tenant isolation;
- scoped credentials;
- approval flow;
- audit events;
- MCP security controls;
- harness allowlists.

---

# 66. Vertical Slice

The first end-to-end proof should be intentionally small:

```text
One Organization
+ Dream
+ One Human Owner
+ One Agent
+ One Channel
+ One Harness
+ One App
+ One Connector
+ One MCP integration
+ One Heartbeat
+ Person Memory
+ Agent Memory
+ Task routing
```

Prove:

```text
Human message
→ Main Manager
→ correct Actor
→ execution
→ outcome
→ memory
→ next better decision
```

Only after this loop is stable should broad vertical packs be built.

---

# 67. Vertical Packs

The platform must remain industry-neutral.

Industries should be implemented as Apps and App bundles, not separate codebases.

Examples:

```text
Restaurant Pack
Construction Pack
Event Pack
Hospitality Pack
Agriculture Pack
Consulting Pack
```

Every pack reuses core entities:

```text
Person
Organization
Project
Task
Event
Asset
Document
Transaction
Communication
```

---

# 68. Evolution Roadmap

## Phase 0 — Kernel

- Actors;
- Spaces;
- Organizations;
- People;
- Agents;
- Tasks;
- Memory;
- Main Manager;
- App SDK;
- Connectors;
- MCP.

## Phase 1 — Living Organization

- OrganicChart;
- Heartbeats;
- governance;
- Dream;
- Blueprint;
- organizational reflection;
- Graphiti/FalkorDB.

## Phase 2 — Network

- public Actor manifests;
- public Organization manifests;
- Discovery;
- external Actors;
- A2A;
- federated Network peers.

## Phase 3 — Marketplace

- Problems;
- Offers;
- capability-specific reputation;
- matchmaking;
- temporary solver teams;
- project opportunities.

## Phase 4 — Trust

- portable identity;
- attestations;
- DID/VC integration;
- reputation portability.

## Phase 5 — Agentic Commerce

- autonomous contracts;
- payment intents;
- payment adapters;
- escrow;
- machine-to-machine commerce;
- blockchain settlement where appropriate.

---

# 69. Architectural Invariants

These must remain true as Jamot evolves.

### Identity

An Actor's identity is independent of the organization they currently work with.

### Memory

A person's private memory belongs to the person and is not automatically shared.

### Replaceability

Agents, models, harnesses, memory providers and connectors are replaceable.

### Sovereignty

An organization can self-host and operate without Jamot Cloud.

### Interoperability

Independent implementations can communicate through shared protocols.

### Governance

Capabilities never bypass policy.

### Provenance

Important knowledge and reputation claims must be traceable to evidence.

### Explainability

Important routing and connection recommendations should explain why they were made.

### Human agency

Autonomy must remain bounded by explicit policy and consent.

### Modular economy

Payment providers and future blockchain systems must be adapters, not core dependencies.

---

# 70. Decision Principles for Contributors

When adding a feature, ask:

1. Is this a **core primitive**, or should it be an App?
2. Does this belong to the **Actor**, **Space**, **Organization**, or **Network** layer?
3. Can an external implementation provide this through an existing protocol?
4. Can this remain provider-independent?
5. Does this expose more private information than necessary?
6. Can the feature be scoped by capability and policy?
7. Does it create reusable organizational knowledge?
8. Does it help people and organizations solve problems more effectively?
9. Does it preserve self-hosting and federation compatibility?
10. Can it be implemented without turning the kernel into a vertical-specific system?

---

# 71. VibeDreamer Principle

Jamot is intentionally open to Vibe Coders, AI Integrators, founders, operators and people discovering AI for the first time.

The repository should be:

- easy to fork;
- easy to run;
- easy to customize;
- modular;
- documented through examples;
- strict about interfaces;
- welcoming to experimentation.

The goal is not for every user to understand the entire backend.

The goal is for anyone to be able to build something meaningful on top of the kernel.

> **Fork it. Build your organization. Connect your people. Add your agents. Create your capabilities. Solve real problems. Share what you learn.**

---

# 72. Final Architecture

```text
                              JAMOT ECOSYSTEM
                                      │
                        ┌─────────────┴─────────────┐
                        │                           │
                 JAMOT NETWORKS               PERSONAL SPACES
                        │                           │
                 Organizations                  Humans
                        │                           │
              ┌─────────┼─────────┐                 │
              │         │         │                 │
            Humans    Agents     Apps             Agents
              │         │         │                 │
              └─────────┼─────────┘                 │
                        │                           │
                    ORGANIZATION                   │
                        │                           │
            ┌───────────┼────────────┐              │
            │           │            │              │
          Dream       People       Agents            │
            │           │            │              │
          Goals      Memory       Skills             │
            │           │            │              │
          Tasks      Knowledge    Connectors          │
            │           │            │              │
            └───────────┼────────────┘              │
                        │                           │
                  MAIN MANAGER                      │
                        │                           │
        ┌───────────────┼────────────────┐          │
        ▼               ▼                ▼          │
      Human           Agent            Capability   │
        │               │                │          │
        └───────────────┼────────────────┘          │
                        │                           │
                      WORK                         │
                        │                           │
                     OUTCOME                        │
                        │                           │
                  MEMORY / GRAPH                    │
                        │                           │
                    LEARNING                        │
                        │                           │
                     CHANGE                         │
                        │                           │
                        └───────────────┬───────────┘
                                        │
                              NETWORK INTELLIGENCE
                                        │
                         ┌──────────────┼──────────────┐
                         ▼              ▼              ▼
                     DISCOVERY      MATCHING      REPUTATION
                         │              │              │
                         └──────────────┼──────────────┘
                                        │
                                    PROBLEMS
                                        │
                                      OFFERS
                                        │
                                     A2A WORK
                                        │
                                      MCP
                                        │
                                     SETTLE
                                        │
                                    FEEDBACK
                                        │
                                        └──────────────↺
```

---

# 73. The North Star

Jamot ultimately aims to become a network in which:

> **People, agents and organizations can discover who is good at solving a problem, understand why they are trusted, connect safely, collaborate across organizational boundaries, learn from the outcome, and reward the value created.**

A Jamot organization is therefore not only a collection of software.

It is a **living network of people, agents, capabilities, knowledge and relationships organized around a purpose**.

And the global Jamot ecosystem is not one centralized application.

It is a **federated network of sovereign organizations and actors speaking common protocols**.

---

# 74. Implementation Rule

The repository should always distinguish between:

```text
NOW
MVP / implemented behavior

NEXT
planned implementation

FUTURE
protocol-ready concepts
```

Do not implement future blockchain, federation, marketplace or autonomous commerce merely because they exist in this specification.

Design the interfaces so they can be added later without breaking the core.

**Jamot 0.1 should be small, secure, modular and real.**

The network can become enormous later because the kernel remains simple.

---

# 75. Universal Commerce Protocol (UCP) & AP2 Alignment

## 75.1 Positioning

The **Universal Commerce Protocol (UCP)** is an open industry standard (backed by
Google with Shopify, Etsy, Wayfair, Target and Walmart, January 2026) that lets AI
agents discover products and complete purchases across participating merchants.
UCP addresses *consumer checkout*: product discovery, cart, checkout, orders and
payment handlers.

JAMOT is **procurement-first and agentic-first**: it starts from an organizational
problem, negotiates supply via RFQ → Quote → Purchase Order with human/governance
approval gates (§14, §41), then settles on an internal treasury ledger through a
`PaymentProvider` abstraction (§31). Consumer-style checkout, carts and public
storefronts are **out of scope for JAMOT 0.1 and explicitly deferred below**.

UCP is therefore treated as an **optional edge protocol** in the same class as A2A
(§19) and MCP (§18): something a JAMOT deployment may *speak* at its boundary, not
something the kernel embeds. JAMOT interoperates with UCP agents/merchants via the
already-planned network and capability layers rather than importing UCP internal
semantics.

Status: **Conceptual — alignment only, no code or schema changes.**

## 75.2 Terminology mapping

| UCP / AP2 concept | JAMOT equivalent | Alignment |
| --- | --- | --- |
| Merchant / Seller agent | `Supplier` role on an `actorId` + its `organizationId` | supplier-as-actor (§67) |
| Product catalog | `Catalog` + `catalog_offers` (per-offer pricing `PriceTier`) | network catalog, `/.well-known/jamot` manifest (§22.3) |
| Product discovery | `catalog_offers` over sync-able sources (`source: "mcp" \| "erp" \| "native"`) | MCP is the primary capability layer (§18) |
| Product card | `ProductBase` / `ProductVariant` + offer | catalog_offer carries sellable config |
| Price (merchant-specified) | `PriceTier[]` with `minQty` breaks, `currency`, `amount` | negotiated per-buyer via `buyer_agreements` |
| Cart | **Deferred** | RFQ items act as the negotiation cart; no server cart entity |
| Checkout | **Deferred** | PO approval + `PaymentIntent` is the JAMOT checkout gate (§31) |
| Order | `PurchaseOrder` (items, totals, buyer/seller orgs) | PO *is* the order; UCP order would map 1:1 |
| Payment handler | `PaymentProvider` seam (`createPayment`, `confirm`, `cancel`, `refund`) | `card` provider maps onto UCP payment handlers |
| Payment instrument / AP2 | `PaymentProviderKind` (`ledger`, `card`, `bank`, `stablecoin`) | ledger remains the internal default transport |
| Session (AP2 mandate) | PO/`PaymentIntent` `approvedByActorId` + policy gates | future `mandateRef` field (see 75.4) |
| UCP agent discovery | Network search + federation (§22) + MCP resources | `searchNetwork` returns ranked hits |
| `/.well-known/ucp` | `/.well-known/jamot` manifest (§22.3) | parallel discovery conventions |

## 75.3 Out of scope — explicitly deferred

The following UCP/AP2 concepts are **deferred and will not be modeled in JAMOT**:

- server-side **cart** and **checkout** endpoints;
- **consumer profile / payment-profile** endpoints;
- **order fulfillment/shipping tracking** as UCP states;
- **AP2 mandate endpoints** and two-phase mandate registration.

Rationale: they assume a consumer storefront and a payment orchestrator that JAMOT
replaces with procurement gates (§41) and its own settlement seam (§31). Adopting
them without a merchant/checkout consumer would add surface area and schema weight
with no JAMOT actor.

## 75.4 Potential future alignment points

Kept as protocol-ready interfaces so they can be added without breaking the core:

| Area | Current JAMOT seam | Future UCP/AP2 hook |
| --- | --- | --- |
| Payment approval | `PaymentIntent.requiresApproval` + `approvedByActorId` | store AP2 `mandateId` / `mandateRef` on `metadata` or a dedicated column |
| Merchant capabilities | `supplier.onboardingStatus`, `defaultCurrency`, `terms` | advertise UCP capability descriptors in the public manifest |
| Order hand-off | `app.order.syncRef` | emit UCP `order_id` when confirming an order with an external merchant |
| Catalog sync | `catalog.sourceOfTruth: "server" \| "local" \| "merge"` | register UCP catalog sync agents via MCP |
| Settlement rails | `PaymentProviderKind` enum | map `card` provider onto UCP payment handler endpoints |

## 75.5 Transport story

The existing stack (§20) already supports every transport UCP agents may advertise:

- **REST/JSON** — JAMOT API routes for catalog, procurement and payments;
- **MCP** — supplier catalogs exposed as MCP tools/resources (`examples/supplier-mcp-server`);
- **A2A** — cross-organization agent negotiation (§19) before RFQ→PO.

UCP agents discover JAMOT catalogs exactly like any other federation peer: via the
public manifest (§22.3) and network discovery (§22.1), subject to identity,
permissions and policy (§18, §40.3). No new transport is required.

## 75.6 Relationship to NIST / payment standards (informational)

AP2 draws on EMVCo-derived concepts (payment credentials, mandates). JAMOT treats
EMVCo/AP2 as informational references only: the `PaymentProvider` interface (§31)
is the single point where an external standards-compliant rail can be attached
without touching the kernel. Standards conformance is an edge concern, not a
kernel feature, for JAMOT 0.1.
