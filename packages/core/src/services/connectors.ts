import type { Connector } from "@jamot/contracts";
import type {
  JamotRepository,
  NewConnector,
} from "../repository/repository.js";
import type { SecretStore } from "../secrets/secret-store.js";

export interface ConnectorServiceDeps {
  repo: JamotRepository;
  store: SecretStore;
}

export interface ConnectInput extends NewConnector {
  secretPlaintext: string;
}

export interface ConnectorService {
  connect(input: ConnectInput): Promise<Connector>;
  listConnectors(filter?: {
    ownerOrganizationId?: string;
  }): Promise<Connector[]>;
}

export function createConnectorService(
  deps: ConnectorServiceDeps,
): ConnectorService {
  const { repo, store } = deps;

  return {
    async connect(input) {
      const { secretPlaintext, ...connectorInput } = input;
      const { ref, scope } = connectorInput.credentialRef;
      await repo.putSecret({
        ref,
        scope,
        ownerActorId: connectorInput.ownerActorId ?? null,
        ownerOrganizationId: connectorInput.ownerOrganizationId ?? null,
        ciphertext: store.encrypt(secretPlaintext),
      });
      return repo.createConnector({ ...connectorInput, status: "connected" });
    },

    listConnectors(filter) {
      return repo.listConnectors(filter);
    },
  };
}
