"use client";

import { useEffect, useState } from "react";
import {
  listCatalogOffers,
  listCatalogs,
  listProducts,
  listSuppliers,
  type ApiCatalog,
  type ApiCatalogOffer,
  type ApiProduct,
  type ApiSupplier,
} from "@jamot/client";

import { useOrgScope } from "./console-context";

function money(tiers: ApiCatalogOffer["priceTiers"]): string {
  const first = tiers[0];
  if (!first) return "—";
  const amount = (first.amount / 100).toLocaleString(undefined, {
    style: "currency",
    currency: first.currency || "EUR",
  });
  return tiers.length > 1 ? `from ${amount}` : amount;
}

/**
 * Discovery — Discovery.dc.html: "Every product open to sellers."
 *
 * The mockup also shows a commission rate, an average deal size, a seller
 * count and a "join the mission to start selling it" action. None of those
 * exist in the domain model — there is no commission field and no missions
 * entity — so they are named as missing rather than invented. Everything
 * shown here comes from catalogs, offers and products.
 */
export function DiscoverySection() {
  const { organizationId } = useOrgScope();

  const [catalogs, setCatalogs] = useState<ApiCatalog[] | null>(null);
  const [offers, setOffers] = useState<ApiCatalogOffer[]>([]);
  const [products, setProducts] = useState<Map<string, ApiProduct>>(new Map());
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [c, o, p, s] = await Promise.all([
          listCatalogs(organizationId),
          listCatalogOffers({ sellerOrganizationId: organizationId }),
          // Unscoped on purpose: products do not live in the organization's
          // space (creating one through /api/products puts it elsewhere), so
          // scoping this by spaceId resolves every offer to "Unnamed product".
          // The API still returns only what this session may see.
          listProducts().catch(() => [] as ApiProduct[]),
          listSuppliers().catch(() => [] as ApiSupplier[]),
        ]);
        if (cancelled) return;
        setCatalogs(c);
        setOffers(o);
        setProducts(new Map(p.map((x) => [x.id, x])));
        setSuppliers(s);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load discovery.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  return (
    <>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ margin: 0 }}>Discovery</h1>
        <p style={{ margin: "var(--space-2) 0 0", maxWidth: "62ch", opacity: 0.75, fontSize: 14 }}>
          Every product open to sellers. Read the company and the offer, then take it to market.
        </p>
      </header>

      {error ? (
        <p role="alert" className="card" style={{ color: "var(--accent-ink)", marginBottom: "var(--space-4)" }}>
          {error}
        </p>
      ) : null}

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Offers <span style={{ opacity: 0.5 }}>({offers.length})</span>
        </h2>
        {catalogs === null ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>
        ) : offers.length === 0 ? (
          <div className="card">
            <div className="card-kicker">Nothing published</div>
            <div className="card-title">No offers yet</div>
            <p className="card-body">
              Offers appear once this organization publishes a catalog with priced products.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "var(--space-3)" }}>
            {offers.map((o) => {
              const product = products.get(o.productId);
              return (
                <div className="card" key={o.id}>
                  <div className="card-kicker">{o.availability ?? "availability unknown"}</div>
                  <div className="card-title">{product?.name ?? "Unnamed product"}</div>
                  <p className="card-body">{product?.description || "No description."}</p>
                  <div className="card-meta">
                    <span>{money(o.priceTiers)}</span>
                    <span>· min {o.minQty}</span>
                    {product?.sku ? <span>· {product.sku}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Catalogs {catalogs ? <span style={{ opacity: 0.5 }}>({catalogs.length})</span> : null}
        </h2>
        {catalogs === null ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Loading…</p>
        ) : catalogs.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>No catalogs yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Source</th>
                <th>Version</th>
              </tr>
            </thead>
            <tbody>
              {catalogs.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>
                    <span className={c.status === "published" ? "tag tag-accent" : "tag tag-neutral"}>
                      {c.status}
                    </span>
                  </td>
                  <td>{c.visibility}</td>
                  <td>{c.source}</td>
                  <td>{c.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: 15, marginBottom: "var(--space-3)" }}>
          Suppliers <span style={{ opacity: 0.5 }}>({suppliers.length})</span>
        </h2>
        {suppliers.length === 0 ? (
          <p style={{ opacity: 0.7, fontSize: 14 }}>No suppliers registered.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Onboarding</th>
                <th>Currency</th>
                <th>Terms</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td>{s.id.slice(0, 8)}</td>
                  <td>
                    <span className="tag tag-neutral">{s.onboardingStatus}</span>
                  </td>
                  <td>{s.defaultCurrency}</td>
                  <td>{s.terms || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="card">
        <div className="card-kicker">Not built yet</div>
        <div className="card-title">Commission, deal size and seller pools</div>
        <p className="card-body">
          The mockup also shows a commission rate, an average deal size, a seller count and a
          &ldquo;join the mission&rdquo; action. The domain model has no commission field and no
          missions entity, so those are left for a later change rather than shown with made-up
          numbers.
        </p>
      </div>
    </>
  );
}
