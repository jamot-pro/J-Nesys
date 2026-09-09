import type {
  Capability,
  Connector,
  ConnectorProvider,
  ConnectorType,
  Skill,
} from "@jamot/contracts";

export interface SecretRecord {
  ref: string;
  scope: "user" | "organization" | "system" | "environment";
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  ciphertext: string;
}

export interface NewConnectorInput {
  provider: ConnectorProvider;
  type?: ConnectorType;
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  capabilities?: string[];
  credentialRef: Connector["credentialRef"];
  scopes?: string[];
  configuration?: Record<string, unknown>;
  status?: Connector["status"];
}

export interface NewCapabilityInput {
  name: string;
  skillId: string;
  connectorId: string;
  policyIds?: string[];
  context?: Record<string, unknown>;
  spaceId: string;
}

export interface NewSkillInput {
  ownerActorId?: string | null;
  ownerOrganizationId?: string | null;
  name: string;
  description?: string;
  body?: string;
  version?: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  prerequisites?: string[];
  allowedCapabilityIds?: string[];
  evaluationCriteria?: string[];
  provenance: Skill["provenance"];
  status?: Skill["status"];
}

export interface VaultRepository {
  createConnector(input: NewConnectorInput): Promise<Connector>;
  getConnector(id: string): Promise<Connector | null>;
  listConnectors(filter?: {
    ownerOrganizationId?: string;
  }): Promise<Connector[]>;
  updateConnector(
    id: string,
    patch: Partial<Pick<Connector, "status" | "configuration" | "sharing">>,
  ): Promise<Connector | null>;
  deleteConnector(id: string): Promise<void>;
  createCapability(input: NewCapabilityInput): Promise<Capability>;
  getCapability(id: string): Promise<Capability | null>;
  listCapabilities(filter?: { spaceId?: string }): Promise<Capability[]>;
  createSkill(input: NewSkillInput): Promise<Skill>;
  getSkill(id: string): Promise<Skill | null>;
  listSkills(filter?: { ownerOrganizationId?: string }): Promise<Skill[]>;
  updateSkill(
    id: string,
    patch: Partial<
      Pick<
        Skill,
        | "name"
        | "description"
        | "body"
        | "version"
        | "inputs"
        | "outputs"
        | "prerequisites"
        | "allowedCapabilityIds"
        | "evaluationCriteria"
        | "status"
      >
    >,
  ): Promise<Skill | null>;
  deleteSkill(id: string): Promise<void>;
  putSecret(secret: SecretRecord): Promise<void>;
  getSecret(ref: string): Promise<SecretRecord | null>;
  deleteSecret(ref: string): Promise<void>;
  getOrganization(id: string): Promise<{ spaceId: string | null } | null>;
  listRolesForActor(actorId: string): Promise<
    { spaceId: string; kind: string }[]
  >;
  findUserByActor(actorId: string): Promise<{ isSuperAdmin: boolean } | null>;
  recordEvent(input: {
    type: string;
    spaceId?: string | null;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface SecretStore {
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

export type CredentialResolver = (ref: string) => Promise<string | null>;

export interface RoutesOptions {
  repository: VaultRepository;
  secretStore: SecretStore;
  credentialResolver: CredentialResolver;
}
