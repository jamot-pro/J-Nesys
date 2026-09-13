import type { FastifyInstance } from "fastify";
import { createHmac } from "node:crypto";
import type { JamotRepository } from "../repository.js";
import type { ReputationService } from "@jamot/core/reputation";
import type { TreasuryService } from "@jamot/core/treasury";
import { fail } from "../util.js";

interface TelegramUserPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

/**
 * Validates Telegram WebApp initData query string against the bot token.
 * Reference: https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
export function validateTelegramInitData(
  initData: string,
  botToken: string,
): { valid: boolean; user?: TelegramUserPayload } {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false };

    params.delete("hash");

    // Sort parameters alphabetically
    const dataCheckArr: string[] = [];
    Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, val]) => {
        dataCheckArr.push(`${key}=${val}`);
      });
    const dataCheckString = dataCheckArr.join("\n");

    // Secret key = HMAC-SHA-256("WebAppData", botToken)
    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();

    // Calculated hash = HMAC-SHA-256(secretKey, dataCheckString)
    const calculatedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    const userStr = params.get("user");
    const user = userStr ? (JSON.parse(userStr) as TelegramUserPayload) : undefined;
    return { valid: true, user };
  } catch {
    return { valid: false };
  }
}

export function telegramRoutes(
  repo: JamotRepository,
  reputation?: ReputationService,
  _treasury?: TreasuryService,
) {
  return async function (app: FastifyInstance): Promise<void> {
    /**
     * Authenticate or get user profile via Telegram Mini App initData.
     * Auto-provisions a Jamot Person & Actor if not already registered.
     */
    app.post("/telegram/auth", async (request, reply) => {
      const initDataHeader = (request.headers["x-telegram-init-data"] as string) || "";
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      let tgUser: TelegramUserPayload | undefined;

      if (botToken && initDataHeader) {
        const validation = validateTelegramInitData(initDataHeader, botToken);
        if (!validation.valid) {
          return fail(reply, 401, "invalid telegram signature");
        }
        tgUser = validation.user;
      } else if (process.env.NODE_ENV !== "production" || !botToken) {
        // Fallback for preview / development
        const body = (request.body as any) || {};
        tgUser = body.mockUser ?? {
          id: 999999,
          first_name: "Mara",
          last_name: "Jansen",
          username: "marajansen",
        };
      }

      if (!tgUser) {
        return fail(reply, 400, "telegram user data missing");
      }

      const telegramUserId = String(tgUser.id);

      // Check if identity already exists
      const existingIdentity = await repo.findIdentity("telegram", telegramUserId);
      let person = existingIdentity?.personId ? await repo.getPerson(existingIdentity.personId) : null;
      let actor = person ? await repo.getActor(person.actorId) : null;

      // Auto-provision if first time opening Mini App
      if (!person) {
        const displayName =
          [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") ||
          tgUser.username ||
          `Operator ${tgUser.id}`;

        actor = await repo.createActor({
          type: "human",
          source: "external",
          displayName,
          externalIdentities: [
            {
              provider: "telegram",
              value: telegramUserId,
              verified: true,
            },
          ],
        });

        person = await repo.createPerson({
          actorId: actor.id,
          firstName: tgUser.first_name,
          lastName: tgUser.last_name ?? null,
          membershipSpaceIds: [],
        });

        await repo.addIdentity({
          actorId: actor.id,
          personId: person.id,
          provider: "telegram",
          value: telegramUserId,
          verified: true,
        });
      }

      // Fetch dynamic aura and reputation if available
      let reputationStars = 742;
      let tierLevel = 6;
      if (reputation && actor) {
        try {
          const scores = await reputation.scores(actor.id);
          const total = Object.values(scores).reduce((a, b) => a + b, 0);
          if (total > 0) {
            reputationStars = Math.round(total * 100);
            tierLevel = Math.min(10, Math.max(1, Math.floor(reputationStars / 100)));
          }
        } catch {
          // fallback to defaults
        }
      }

      // Set session actorId so standard authenticated endpoints work
      if (request.session && actor) {
        request.session.actorId = actor.id;
        if (person) request.session.personId = person.id;
      }

      return {
        success: true,
        person,
        actor,
        telegramUser: tgUser,
        reputation: {
          reputationStars,
          tierLevel,
        },
      };
    });

    /**
     * Get nearby missions and dreams for the Discover feed
     */
    app.get("/telegram/missions", async () => {
      const organizations = await repo.listOrganizations();
      const published = organizations.filter((org) => org.dream.trim().length > 0);

      const missions = await Promise.all(
        published.map(async (org) => {
          const space = await repo.getSpace(org.spaceId);
          return {
            id: org.id,
            name: space?.name ?? org.slug ?? "Missions",
            statement: org.dream,
            category: "onsite",
          };
        }),
      );

      return { missions };
    });
  };
}
