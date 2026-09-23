# Vercel Swag Store

A storefront for Vercel merchandise, built on **Next.js 16 with Cache Components** against a documented ecommerce API — and built to be read. Every page demonstrates a deliberate static/dynamic split, every cart mutation is a Server Action, and the store's capabilities are defined once and consumed three ways: by the human UI, by an in-app shopping assistant, and by any external agent over MCP.

**Live:** https://vercel-swag-store-lac.vercel.app
**MCP endpoint:** `https://vercel-swag-store-lac.vercel.app/api/mcp`

The intended audience is a partner or solutions team picking this up as an accelerator: the patterns here — the caching spine, the partial-prerendering boundaries, the agent-ready capability layer, and a commerce data layer built as a **port with one adapter** — are the transferable artifact. Swap the adapter, keep the storefront; the swag is just the demo data.

---

## Running it

```bash
pnpm install
pnpm dev        # development server
pnpm build      # production build — every product page prerenders here
pnpm start      # serve the production build
pnpm lint
```

Requires two variables in `.env.local` (or `vercel env pull`):

```bash
SWAG_API_BASE_URL=https://vercel-swag-store-api.vercel.app/api
SWAG_API_BYPASS_TOKEN=<token>
```

Both are **server-only** — every API call happens in a Server Component, Server Action, or Route Handler, so the token never reaches the browser. The in-app agent authenticates to Vercel AI Gateway via OIDC (`VERCEL_OIDC_TOKEN`, provisioned by `vercel env pull` and refreshed automatically in deployments), so there is no AI provider key anywhere in the project.

Optional: `SLACK_DIGEST_CHANNEL_ID` (a Slack channel id the bot is invited to) enables the daily catalogue-health digest; unset, the schedule is a silent no-op and nothing depends on Slack being installed.

> `pnpm-workspace.yaml` carries an `allowBuilds` map: `sharp` and `unrs-resolver` need their install scripts (native binaries); vgpu's Node-only Dawn prebuilds are explicitly set to `false` because the browser path never needs them. Without the map, `pnpm install` fails.

---

## Architecture: the caching spine

Cache Components (`cacheComponents: true`) inverts the old model: **nothing is cached unless it opts in with `'use cache'`, and nothing dynamic renders outside a `<Suspense>` boundary.** That constraint is the design. Each surface below is a deliberate decision, not a default:

| Surface | Bucket | Why |
|---|---|---|
| Layout shell, hero, footer | static | Never varies |
| Featured products (`/`) | `'use cache'` + `cacheTag('products')`, `hours` profile | Catalog data changes rarely; stale-while-revalidate keeps the page serving even if the API is down |
| Promo banner (`/`) | **dynamic**, in `<Suspense>` | The API randomises the promotion per request — a cached value would be wrong by design |
| Product info (PDP) | `'use cache'` + per-product tag | Stable; enables full prerender of all 28 pages |
| Stock (PDP) | **dynamic**, in `<Suspense>` | Recomputed by the API on every request (verified: three consecutive calls returned 2, 9, 19). A cached stock value is fiction |
| Search / catalogue results | dynamic on `searchParams`, backed by a cached `listCatalogue(args)` | The *page* is per-request; the *data* is cacheable per parameter set — two shoppers on page 2 of "bags" share one entry |
| Category list + facets | `'use cache'`, `days` / `hours` | 13 categories, effectively structural |
| Cart + header badge | `'use cache'` keyed on token + `cacheTag('cart:{token}')` | See [the cart](#the-cart) |
| Root metadata | `'use cache'` from `/store/config`, `days` | Title template and SEO defaults come from the commerce backend, at zero requests per page |
| Lifestyle shot (PDP) | generated on demand, then **CDN-immutable for a year** | Expensive AI work as a cache-warmed asset: the image model runs once per product (a few cents for the whole catalogue), every later shopper gets CDN bytes. The caching design doubles as the abuse control — the URL space is exactly the catalogue |

Tags live in one vocabulary module (`lib/cache-tags.ts`); readers (`cacheTag`) and writers (`updateTag`) share it so a typo cannot create a cache entry nobody can invalidate.

### Partial prerendering, concretely

The build output tells the story — every page route is `◐ (Partial Prerender)`:

- **`/products/[param]`** is the headline. With 28 products, `generateStaticParams` prerenders *every* product page at build time. Each ships as static HTML from the CDN — image, name, price, description, metadata, all in the first byte — with exactly **one** streaming hole: the `PurchasePanel` (stock indicator + quantity stepper + Add to Cart), because availability is the one thing that must be read per request. The boundary sits around all three together so the button can never be enabled for an item the indicator says is sold out.
- **`/`** prerenders the header, hero, and the entire featured grid (cached data participates in the prerender — that is the point of `'use cache'`). Two holes stream: the promo banner and the cart badge.
- **`/search`** prerenders the heading, the search input, and the layout. The results and the facet counts stream, keyed on `searchParams`. The input sits deliberately *outside* the results boundary: if it were inside, every debounced search would re-suspend the boundary, remount the input, and take the caret with it.
- **`/cart`** is dynamic top to bottom — it reads a cookie — so the static shell is just the heading, and the contents stream into a skeleton that mirrors the real layout's dimensions.
- The **cart badge** streams into every page through the smallest possible boundary: the header stays static, only the count is dynamic. Its fallback renders the real cart icon at full size with no number — the header is complete and correctly sized from first paint.

Moving any of these boundaries has a visible cost. Wrapping the whole PDP in one boundary would discard the static shell; splitting stock and button into two would let them disagree; pulling `searchParams` in the page component instead of a child would make the entire search page dynamic.

### Read-your-own-writes

Cart mutations call `updateTag('cart:{token}')`, which expires the cached cart *immediately* — the next read blocks for fresh data instead of serving stale-while-revalidate. A shopper who just added an item must never see the old count; anything less reads as the action having failed. The agent's writes happen in a separate service outside this cache entirely, so the panel closes the loop from the client: the moment a successful cart write streams in, it calls a small Server Action (`refreshCartCache`) whose `updateTag` + re-render moves the badge in the same beat as the agent's claim of success.

The cookie is read *outside* every cached scope and the token passed in as an argument — the documented pattern for combining request data with `'use cache'`, and what makes the cache entry per-session.

---

## The cart

The cart is server-side and Redis-backed, owned by the commerce API. The app owns only an anonymous UUID token, held in an **httpOnly, secure, sameSite=lax cookie** — the token is the only credential protecting the cart, so an XSS bug must not be able to read it. The cart is created lazily on first add; visitors who never buy never cost an upstream write.

- **All mutations are Server Actions** (`lib/actions/cart.ts`) — no client fetches, no route handlers.
- **Quantity and removal move instantly through an explicit pending overlay** — deliberately *not* `useOptimistic` + `startTransition`: an awaited Server Action inside a transition entangles with every later navigation, freezing the site for the mutation's whole round trip on slow connections (measured: 83ms → 4,166ms; `cart-contents.tsx` documents the model). Lines and the subtotal derive from one overlay so they always agree; a removing line stays visible, dimmed, with a spinner. An overlay entry clears when the revalidated props *confirm* it — not when the promise resolves — and a failure rolls back only its own entry, with a message explaining why nothing changed. The header badge joins the same moment through a shared pending-delta context (the pattern behind Next.js Commerce's cart store): the server-streamed count stays the source of truth, in-flight mutations add their delta, and a settled mutation bridges the settle gap with the count the action itself reported.
- **Adding is deliberately *not* optimistic.** Stock randomises per request, so an add genuinely can fail; an "Added!" that revokes itself costs more trust than a second of "Adding…".
- **The stock guard validates the *resulting* quantity, not the increment.** The upstream POST is additive, and a guard that only checks the increment passes six adds of 10 against a stock of 13. Found by driving the MCP endpoint in a loop; the UI path had the same hole. The guard reads cart and stock in parallel, so correctness costs one round trip, not two.
- Expired tokens (24h inactivity) are handled transparently: a failed add mints a new cart and retries once; a failed update tells the shopper the cart expired, because there is nothing worth recovering.

## Search

State lives in `searchParams`, never in client state alone — refresh and URL sharing reproduce the exact result set. Three triggers, per the spec: Enter, the search button, and automatically after 3+ characters (debounced 300ms; explicit triggers bypass the length rule — someone who types "DX" and presses Enter meant it).

Details that took iteration:

- A new search term **clears a lingering category filter** — otherwise a stale "mugs" filter silently empties a search for "hoodie" and the message blames the search term.
- **Facet counts are scoped to the active query.** A dropdown claiming "Mugs (2)" during a search that matches no mugs is a lie; counts are computed against the result set the shopper is looking at, and empty categories are dropped — except a *selected* category, which is re-added with its 0 so the control never lies about what filter is in force.
- During a search the previous results stay on screen (React transition) and an explicit "Searching…" indicator appears in a fixed-width slot — acknowledgement without replacing real content with grey boxes on every keystroke.

## The agentic layer

**One typed capability layer, consumed three ways.** `lib/agent/capabilities.ts` holds the store's operations as plain functions with zod schemas — search, product details, live stock, categories, cart read/write. Three consumers:

1. **The human UI** — Server Components and Server Actions calling the same underlying data layer.
2. **The in-app agent** — built on [eve](https://eve.dev), Vercel's framework for durable agents. The agent is a directory (`agent/`): instructions, tools, channel auth, each a file. `withEve()` in `next.config.ts` mounts it at `/eve/v1/*` — one dev command, one Vercel project, the agent running as its own service beside the app.
3. **The MCP server** (`/api/mcp`, Streamable HTTP) — registers the same functions for any external agent. Connect from Claude Code:

   ```bash
   claude mcp add --transport http swag-store https://vercel-swag-store-lac.vercel.app/api/mcp
   ```

What differs between consumers is only the **session** — three strategies, one per caller kind. The browser's cart lives in an httpOnly cookie that client JavaScript can never read; it crosses into the agent service at the one seam where a server sees the request, the eve channel's auth walk, which lifts it into the session's auth attributes. An MCP client has no cookies, so it calls `create_cart` once and carries the token explicitly. And a cookie-less eve session — a Slack thread, a script, an eval — gets a cart the **session itself owns**: minted lazily on first add and kept in eve's durable session state, so a Slack thread's cart survives across turns and days exactly like the conversation it belongs to. The capability functions never know which caller they serve.

### What eve adds that a chat route couldn't

The previous iteration of this assistant was a standalone AI SDK route — same capability layer, same cards — and its limits were structural, not cosmetic. A request/response chat holds the conversation in browser memory and cannot outlive its connection. The eve agent's sessions are **durable**: reload mid-answer and the transcript replays and the in-flight reply keeps streaming (`useEveAgent` with `resume`).

Durability makes two commerce behaviours possible that a chat route cannot express:

- **`watch_stock`** — this API randomises stock per request and genuinely hits zero, so "tell me when it's back" is a real request the storefront could never answer. The tool is a background **workflow**: it returns a task receipt immediately, then alternates a stock check with a durable sleep that holds no compute. Close the panel, navigate away — the run persists, and when stock appears, the completed task wakes the agent, which reports back into the same conversation.
- **Approval-gated writes** — `add_to_cart` at $50+ pauses for the shopper's sign-off and parks, without compute, until they answer — minutes or days later. The gate is eve's **approval policy**, async and priced: it looks the product up and demands approval only when the value warrants it. The confirmation gates *intent*; the shared stock guard still gates *feasibility* at add time, in that order. (The division of labour is deliberate: human sign-off is *policy*, long-lived promises are *workflows* — a distinction forced by a real boundary we verified empirically: durable session state is reachable from ordinary tool context but not from workflow steps, whose writes land in a discarded scope.) Agents that show their work before spending money is the enterprise shape of agentic commerce.

The model is configured as an AI Gateway slug (`anthropic/claude-opus-5`), so the ops story is unchanged: **no AI provider API key exists anywhere in this project** — Gateway auth is Vercel OIDC, provisioned and rotated by the platform.

### The same agent, in Slack

`agent/channels/slack.ts` is one file, and the identical agent takes swag orders in Slack — DMs, mentions, threads. Credentials live in **Vercel Connect**; no Slack token or signing secret enters this project. The $50 approval renders as native Approve/Cancel buttons, with shopper-facing copy composed by an authored `input.requested` handler ("Before I spend your money: add 1 × Black Pullover Hoodie to your cart for $60.00?") instead of the framework's developer-facing default — tool ceremony is user-visible copy, the same rule as tool output.

A schedule (`agent/schedules/catalogue-health.ts` → a Vercel Cron) posts a daily **catalogue health digest** into a merchandising channel: empty categories, out-of-stock and low-stock featured products with counts, the running promotion. It is the "ops automation that happens to converse" case — and it earned its keep immediately: the digest agent's first run correctly reported two gaps in its own tooling (no featured filter, no promotions read), and a Slack shopper found a third (no cart removal). All three were fixed once, in the capability layer, for every consumer at once.

### The chips are tests

Every suggestion chip in the panel is a commitment — it is the one input a reviewer is guaranteed to try — so the chips anchor a deterministic regression suite in `evals/` (`eve eval --url <deployment>`): the under-$25 chip runs verbatim and asserts the price constraint travels **in the tool call** (the fix for a real bug where the model fetched unfiltered results and the cards contradicted its prose); the add chip runs as a below-threshold variant asserting the stronger cookie-less contract — *an add succeeds via a session-minted cart, or fails only on stock, never on plumbing* (approval parking itself is exercised at the UI level, where the card can be answered); two more pin the boundary (payment requests decline without touching tools) and the first rule (unknown products are searched, not guessed at). Five evals, thirteen gates, no judge model — a failure means a broken contract, not a grader's opinion.

The design has now earned its keep four separate times, each through a different consumer: the MCP loop found the oversell bug, the under-$25 chip found the constraint gap, the scheduled digest found the missing reads by naming its own blind spots, and a Slack shopper found the missing writes. Every fix landed once, in the capability layer, for all consumers simultaneously. The shared layer is not just DRY — each new consumer is a free auditor of all the others.

The agent and MCP endpoints are deliberately unauthenticated (eve fails closed by default; admitting anonymous shoppers is an explicit, documented opt-in in the channel's auth walk): everything readable is already public on the storefront, cart writes require possession of an unguessable token, and a bearer requirement would make both undemonstrable. A production store would put brokered identity in front (`withMcpAuth` / Vercel Connect) so carts belong to authenticated shoppers and per-client rate limits exist.

*Considered and not built:* natural-language → structured search filters feeding `/search` (the same zod schemas that type the tools could type a `generateObject` parser); WhatsApp as a third channel (the channel ecosystem supports it; phone-number provisioning wasn't worth a demo); payment/carrier webhook workflows (the `createWebhook` pattern is production-shaped, but this API has no orders). Left out to keep the layer's surface exactly as large as what is demonstrably consumed.

## Generated merchandising

Every PDP gallery has a **"See it worn" / "See it styled"** tile in its thumbnail rail: the product's own photo goes to an image-editing model (`google/gemini-2.5-flash-image`) through the AI Gateway — **OIDC again; adding image generation added no API key** — with a per-category style: wearables on a fictional model in a studio, bags carried, desk gear in a workspace scene. The prompt pins the design ("black, white triangle, unchanged") and says *fictional* twice: generating any real person's likeness is out of bounds, by model policy and by choice.

The interesting decision is the caching row above: the route serves the generated PNG as CDN-immutable, so the ~10-second, few-cent generation happens once per product and the result behaves like a static asset forever after. Failures are `no-store` (an upstream hiccup must not become a cached "no shot" for a year), unknown products 404 before any model call, and the result carries an "AI-generated" label because it is one. In the UI the generated shot **replaces the hero** — merchandising imagery belongs where the product photo is, not appended below it — while the original photo stays one thumbnail away: the product photo is the ground truth of what is being bought, the styled shot an interpretation, and the gallery rail is the retail-native affordance for switching between them. All of it happens inside the hero's reserved box, so the ten-second generation and every later swap move nothing.

## Feature flags

Two **Vercel Flags** (Flags SDK, `vercelAdapter`) gate the optional capabilities: `lifestyle-shots` (the PDP gallery tile *and* its generation route — turning it off disables the spend, not just the UI) and `catalogue-digest` (the Slack cron). Both toggle at runtime — `vercel flags set <flag> --environment production --variant false` — with no redeploy, are overridable per-browser through the Toolbar's Flags Explorer, and fail open to "as shipped" if the flag service is unreachable.

Two placements carry the platform reasoning:

- **A flag read is request data**, so on the prerendered PDP it lives where all request data lives: a small Suspense hole beside stock, with the exact button rendered invisible as the fallback so the streamed decision moves nothing (CLS 0 verified in both states). The shell stays fully static. The alternative for flagged content that must be *in* the shell — hero variants, layout tests — is the Flags SDK's precompute pattern; for one button below the fold, the streamed hole is the cheaper correct boundary.
- **The digest cron fires in the eve service**, outside any Next request, so it evaluates the same flag key through the adapter directly (`agent/lib/flags.ts`) — one toggle governs the storefront and the cron alike, because the flag store, not the framework, is the source of truth.

## The hero

The hero's triangle is a plain white SVG in the prerendered shell — and on capable desktops it upgrades itself into a live **WebGPU rendering of the same mark** (LED edge lighting, raycast floor radiance, pointer-tracked glow), using the *Triangle LED Hero* example from [vgpu](https://vgpu.sh), Vercel Labs' WebGPU library, released days before this build.

The integration is strictly additive and gated: `navigator.gpu`, `prefers-reduced-motion: no-preference`, `lg` viewport, and first idle — the renderer (~70KB gzip across its lazily-imported chunks, shaders included) never enters the critical path. The canvas fades in over the SVG inside the same box (zero layout shift), pauses when hidden or scrolled away, and tears down below `lg`. Every gate failure leaves the SVG exactly as prerendered. Measured with the canvas actively rendering: desktop Lighthouse **100**, TBT **0ms**.

The example was pulled through vgpu's tokenless examples API at an immutable revision with every file's SHA-256 verified against its manifest (`components/brand/triangle-led/`, local changes named in the file headers). vgpu distributes examples the way this store distributes commerce: documented for agents, exposed over MCP, integrity-verified — the hero is the store's own thesis, rendered.

## Performance

Measured, not eyeballed — Lighthouse against the **deployed URL**, mobile emulation:

| Route | Perf | A11y | Best Practices | SEO | CLS |
|---|---|---|---|---|---|
| `/` | 96 | 100 | 100 | 100 | **0** |
| `/products/[param]` | 96 | 100 | 100 | 100 | **0** |
| `/search?q=…` | 96 | 100 | 100 | 100 | **0** |

Desktop `/` with the WebGPU hero active: **100**, TBT 0ms, CLS 0.

The zero CLS is engineered, and every technique is visible in the code:

- **Every Suspense fallback reserves the exact dimensions of what replaces it.** The promo banner is a fixed-height row in all three states (loading, promotion, none). The purchase panel's fallback renders a real, disabled "Add to Cart" button — a product page that briefly shows no way to buy reads as broken. The results grid reserves `min-h-[60dvh]` so filtering 12 products down to 1 cannot pull the footer up into the viewport (that collapse measured 0.20 CLS before the fix).
- **All images are sized** — aspect-ratio boxes or `fill` in sized containers — and the likely LCP image on each route is fetched eagerly with `fetchPriority="high"` (Next 16's replacement for the deprecated `priority` prop; grids use it rather than preload links because which card is the LCP depends on the viewport).
- **The LCP element is known per route:** the headline on desktop `/`, the first product card image on mobile listings, the product image on the PDP. The remaining mobile LCP cost is font-swap render delay — a known trade of keeping `font-display: swap`.

## Project structure

```
app/                    routes; every page is ◐ partial-prerendered
  api/mcp/              MCP server (Streamable HTTP, 10 tools)
  api/lifestyle/        generated merchandising route — the model runs
                        once per product, the CDN serves it forever
  products/[param]/     PDP — prerendered per product, stock streams
agent/                  the eve agent, as files
  instructions.md       the agent's behaviour contract
  agent.ts              model config (an AI Gateway slug — no API key)
  channels/eve.ts       route auth; lifts the cart cookie into the session
  channels/slack.ts     the same agent in Slack (creds in Vercel Connect);
                        renders approvals in the store's voice
  schedules/            catalogue-health digest → Vercel Cron → Slack
  lib/session-cart.ts   the session-owned cart for cookie-less callers
  tools/                thin wrappers over the capability layer;
                        watch_stock is a durable background workflow,
                        add_to_cart is gated by a priced approval policy
evals/                  the suggestion chips as deterministic regression
                        tests (eve eval)
components/
  agent/                assistant panel (useEveAgent), product cards,
                        the approval card
  cart/, commerce/      storefront components + their skeleton twins
  brand/triangle-led/   vendored vgpu example (SHA-verified, changes named)
lib/
  commerce/             the CommerceProvider port (provider.ts) with one
                        adapter (swag-store/): envelope unwrapping, bypass
                        header, error mapping, zod-validated responses.
                        Nothing in app/ imports a vendor module — pointing
                        this storefront at another backend means writing a
                        second adapter, not touching the UI.
                        Runtime-neutral: the agent service imports this
                        chain too, so the server-only guard lives in the
                        Next-facing layers above it
  data/                 cached read layer ('use cache' + tags live here)
  actions/              Server Actions (cart mutations, session)
  agent/                capabilities.ts — the shared tool layer
  cart-service.ts       cart operations + stock guard, caller-agnostic
  lifestyle.ts          image-model prompt + generation (Gateway, OIDC)
  cache-tags.ts         the invalidation vocabulary
  money.ts              integer cents end to end; formatting at the edge
```

Conventions throughout: Server Components by default, `'use client'` only where interactivity demands it; prices stay integer cents until render (`Intl.NumberFormat`, one shared helper); one API client owns the envelope, the bypass header, and error mapping.

## Deliberately out of scope

- **Checkout and payment** — the cart's checkout button is disabled and labelled as such; a silent dead button would be worse than a stated boundary.
- **Authentication** — the brief's cart is anonymous by specification; cross-device persistence is explicitly not required.
- **NL → structured search filters** — designed (the tool schemas already type it), not shipped; see the agentic section.
- **Rate limiting on the public agent endpoints** — documented above with the production-shaped answer (WAF rules, brokered identity) rather than a token gesture in code.
