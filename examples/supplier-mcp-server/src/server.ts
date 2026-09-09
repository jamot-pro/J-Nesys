import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3001);

interface SampleOffer {
  offerId: string;
  productId: string;
  productName: string;
  gtin: string;
  sku: string;
  unitOfMeasure: string;
  orderableUnit: string;
  priceQuantity: number;
  priceTiers: Array<{ minQty: number; amount: number; currency: string }>;
  minQty: number;
  maxQty: number;
  orderIncrement: number;
  availability: string;
  leadTime: string;
  validityTo?: string;
  taxIncluded: boolean;
}

interface SampleCatalog {
  organizationId: string;
  name: string;
  catalogId: string;
  catalogVersion: string;
  visibility: string;
  status: string;
  defaultCurrency: string;
  offers: SampleOffer[];
}

function loadCatalog(): SampleCatalog {
  return JSON.parse(
    readFileSync(join(__dirname, "..", "data", "catalog.json"), "utf8"),
  ) as SampleCatalog;
}

function manifest(): unknown {
  return JSON.parse(
    readFileSync(join(__dirname, "..", "data", "manifest.json"), "utf8"),
  );
}

function unitPrice(offer: SampleOffer, quantity: number): number {
  let best = offer.priceTiers[0]!;
  for (const tier of offer.priceTiers) {
    if (tier.minQty <= quantity && tier.minQty >= best.minQty) best = tier;
  }
  return best.amount;
}

function offersToTools(catalog: SampleCatalog): string[] {
  return catalog.offers.map((offer) => offer.offerId);
}

async function main(): Promise<void> {
  const catalog = loadCatalog();

  // Fastify-free: node:http server supporting the MCP streamable HTTP transport
  // and a spec §22.3 well-known manifest endpoint.
  const server = new McpServer(
    {
      name: "jamot-supplier-catalog",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
    },
  );

  const filesOf = offersToTools(catalog);

  server.tool("list_all_offers", {}, () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          {
            catalog: {
              catalogId: catalog.catalogId,
              version: catalog.catalogVersion,
              name: catalog.name,
              organizationId: catalog.organizationId,
              defaultCurrency: catalog.defaultCurrency,
            },
            offers: catalog.offers.map((offer) => ({
              offerId: offer.offerId,
              productId: offer.productId,
              productName: offer.productName,
              sku: offer.sku,
              unitOfMeasure: offer.unitOfMeasure,
              minQty: offer.minQty,
              availability: offer.availability,
              leadTime: offer.leadTime,
            })),
          },
          null,
          2,
        ),
      },
    ],
  }));

  server.tool("get_offer", { offerId: z.string().describe("Catalog offer id") }, ({ offerId }) => {
    const offer = catalog.offers.find((candidate) => candidate.offerId === offerId);
    if (!offer) {
      return { isError: true, content: [{ type: "text" as const, text: `unknown offer: ${offerId}` }] };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(offer, null, 2),
        },
      ],
    };
  });

  server.tool(
    "price_offer",
    { offerId: z.string(), quantity: z.number().int().positive() },
    ({ offerId, quantity }) => {
      const offer = catalog.offers.find((candidate) => candidate.offerId === offerId);
      if (!offer) {
        return { isError: true, content: [{ type: "text" as const, text: `unknown offer: ${offerId}` }] };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                offerId: offer.offerId,
                productName: offer.productName,
                quantity,
                currency: offer.priceTiers[0]?.currency ?? catalog.defaultCurrency,
                unitPrice: unitPrice(offer, quantity),
                priceQuantity: offer.priceQuantity,
                taxIncluded: offer.taxIncluded,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "check_quantity",
    { offerId: z.string(), quantity: z.number().int().positive() },
    ({ offerId, quantity }) => {
      const offer = catalog.offers.find((candidate) => candidate.offerId === offerId);
      if (!offer) {
        return { isError: true, content: [{ type: "text" as const, text: `unknown offer: ${offerId}` }] };
      }
      const minOk = quantity >= offer.minQty;
      const maxOk = offer.maxQty === 0 || quantity <= offer.maxQty;
      const incrementOk =
        offer.orderIncrement <= 1 || (quantity - offer.minQty) % offer.orderIncrement === 0;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { offerId, quantity, constraints: { minQty: offer.minQty, maxQty: offer.maxQty, orderIncrement: offer.orderIncrement }, ok: minOk && maxOk && incrementOk },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool("legal_dimensions", {}, () => ({
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({
          organizationId: catalog.organizationId,
          catalogId: catalog.catalogId,
          version: catalog.catalogVersion,
          sourceOfTruth: "server",
          entities: filesOf,
        }),
      },
    ],
  }));

  const transport = new StreamableHTTPServerTransport({
    enableJsonResponse: true,
    sessionIdGenerator: () => "mcp-" + Math.random().toString(36).slice(2),
  });
  await server.connect(transport);

  // Minimal HTTP wiring: routes POST /api/mcp to the MCP transport and serves
  // GET /api/.well-known/jamot (spec §22.3).
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

    if (url.pathname === "/api/.well-known/jamot" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(manifest(), null, 2));
      return;
    }

    if (url.pathname === "/api/mcp") {
      try {
        await transport.handleRequest(req, res);
        return;
      } catch (err) {
        console.error("[supplier-mcp] transport error", err);
        res.writeHead(500);
        res.end(JSON.stringify({ error: "mcp transport error" }));
        return;
      }
    }

    res.writeHead(404);
    res.end("not found");
  });

  httpServer.listen(PORT, () => {
    console.log(`[supplier-mcp] listening on :${PORT}`);
    console.log(`[supplier-mcp] MCP streamable HTTP  -> POST http://localhost:${PORT}/api/mcp`);
    console.log(`[supplier-mcp] well-known manifest  -> GET  http://localhost:${PORT}/api/.well-known/jamot`);
  });
}

export function startSupplierMcpServer() {
  return main();
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}