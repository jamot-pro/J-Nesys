# Google Maps worker — isolated from Jamot Core's image on purpose, so a
# scraper dependency bump or Python/browser runtime change never touches
# Core's build. See README.md for the vendoring/build process.

FROM node:22-slim AS base
WORKDIR /app

# Python + browser runtime for the vendored omkarcloud scraper (Botasaurus-based).
# STUB: pin the exact apt/pip versions once vendor/google-maps-scraper is checked in.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY tsconfig.json ./
RUN corepack enable && corepack prepare pnpm@11.21.0 --activate
RUN pnpm install --prod=false

COPY src ./src
# COPY vendor ./vendor   # uncomment once the scraper is vendored (see src/provider/omkarcloud/VENDORED_COMMIT.md)
# RUN pip3 install -r vendor/google-maps-scraper/requirements.txt

RUN pnpm build

ENV NODE_ENV=production
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://localhost:8081/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
