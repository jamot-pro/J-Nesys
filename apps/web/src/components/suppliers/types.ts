import type {
  ApiActor,
  ApiSupplier,
  OrganizationListItem,
} from "@/lib/api-client";

export interface SupplierView {
  supplier: ApiSupplier;
  actorName: string;
  orgName: string | null;
}

export function buildSupplierViews(input: {
  suppliers: ApiSupplier[];
  actors: ApiActor[];
  organizations: OrganizationListItem[];
}): SupplierView[] {
  const actorByName = new Map(input.actors.map((actor) => [actor.id, actor]));
  const orgByName = new Map(
    input.organizations.map((org) => [org.organization.id, org.space.name]),
  );

  return input.suppliers.map((supplier) => ({
    supplier,
    actorName: actorByName.get(supplier.actorId)?.displayName ?? supplier.actorId,
    orgName: supplier.organizationId
      ? orgByName.get(supplier.organizationId) ?? supplier.organizationId
      : null,
  }));
}
