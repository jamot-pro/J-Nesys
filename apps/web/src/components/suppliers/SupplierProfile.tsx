"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, Loader2, Package, Star } from "lucide-react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  listCatalogOffers,
  listProducts,
  type ApiCatalogOffer,
  type ApiProduct,
} from "@/lib/api-client";

import { reputationScore } from "./SuppliersTable";
import type { SupplierView } from "./types";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "accent"> = {
  active: "default",
  invited: "accent",
  suspended: "secondary",
};

function entryPrice(offer: ApiCatalogOffer): string {
  if (offer.priceTiers.length === 0) return "—";
  const lowest = offer.priceTiers.reduce((min, tier) =>
    tier.amount < min.amount ? tier : min,
  );
  return `${lowest.currency} ${lowest.amount}`;
}

export function SupplierProfile({ view }: { view: SupplierView }) {
  const { supplier, actorName, orgName } = view;
  const [offers, setOffers] = useState<ApiCatalogOffer[] | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!supplier.organizationId) return;
    Promise.all([
      listCatalogOffers({ sellerOrganizationId: supplier.organizationId }),
      listProducts(),
    ])
      .then(([offers, products]) => {
        if (cancelled) return;
        setOffers(offers);
        setProducts(products);
      })
      .catch(() => {
        if (!cancelled) setOffers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [supplier.organizationId]);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const productLines = useMemo(() => {
    if (!offers) return [];
    return offers
      .map((offer) => ({
        offer,
        product: productById.get(offer.productId),
      }))
      .filter((line) => line.product !== undefined)
      .sort((a, b) =>
        (a.product?.name ?? "").localeCompare(b.product?.name ?? ""),
      );
  }, [offers, productById]);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={actorName} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate font-display text-lg font-semibold">
            {actorName}
          </h2>
          <p className="truncate text-sm text-muted-foreground">
            {orgName ?? "Solo supplier"}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant={STATUS_VARIANT[supplier.onboardingStatus] ?? "outline"}>
          {supplier.onboardingStatus}
        </Badge>
        <Badge variant="secondary">{supplier.defaultCurrency || "USD"}</Badge>
        <Badge variant="outline">
          <Star className="size-3 fill-amber-400 text-amber-400" />
          {reputationScore(supplier.reputation)} reputation
        </Badge>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Onboarding
          </dt>
          <dd className="mt-1 text-sm capitalize">{supplier.onboardingStatus}</dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Default currency
          </dt>
          <dd className="mt-1 text-sm">{supplier.defaultCurrency || "USD"}</dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Procurement outcomes
          </dt>
          <dd className="mt-1 text-sm tabular-nums">
            {supplier.reputation["procurement.outcomes"] ?? 0}
          </dd>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Registered
          </dt>
          <dd className="mt-1 text-sm">
            {new Date(supplier.createdAt).toLocaleDateString()}
          </dd>
        </div>
      </dl>

      {supplier.terms ? (
        <div>
          <h3 className="mb-1.5 text-sm font-medium">Terms</h3>
          <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
            {supplier.terms}
          </p>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Boxes className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Products they sell</h3>
        </div>

        {!supplier.organizationId ? (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            This supplier has no organization attached, so it has no catalog
            offers yet.
          </p>
        ) : offers === null ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading catalog…
          </div>
        ) : productLines.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            <Package className="size-6" />
            No published catalog offers for this supplier yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {productLines.map(({ offer, product }) => (
              <div
                key={offer.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {product?.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[product?.sku, product?.gtin].filter(Boolean).join(" · ") ||
                      product?.unitOfMeasure}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="block text-sm font-medium tabular-nums">
                    {entryPrice(offer)}
                  </span>
                  <span
                    className={cn(
                      "block text-xs",
                      offer.leadTime
                        ? "text-muted-foreground"
                        : "text-transparent",
                    )}
                  >
                    {offer.leadTime || "·"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
