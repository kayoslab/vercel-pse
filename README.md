# Vercel Swag Store

A Next.js 16 storefront built against the Vercel Swag Store API, demonstrating Cache Components, partial prerendering, Server Actions, and agent-accessible commerce.

> **Status: scaffolding.** The application is not built yet. This README will grow into the architecture brief as the build lands — see `AGENTS.md` for the requirements being tracked and the architectural decisions already made.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Requires an API bypass token in `.env.local`:

```bash
SWAG_API_BASE_URL=https://vercel-swag-store-api.vercel.app/api
SWAG_API_BYPASS_TOKEN=<token>
```

The token is server-only and must never be exposed to the client.

## Commands

| | |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |

## Notes

`pnpm-workspace.yaml` declares an `allowBuilds` map for `sharp` and `unrs-resolver`. Both ship native binaries and need their install scripts; without the declaration `pnpm install` exits non-zero.
