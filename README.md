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

Both are **server-only** — every API call happens in a Server Component, Server Action, or Route Handler, so the token never reaches the browser. The in-app assistant authenticates to Vercel AI Gateway via OIDC (`VERCEL_OIDC_TOKEN`, provisioned by `vercel env pull` and refreshed automatically in deployments), so there is no AI provider key anywhere in the project.

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

Cart mutations call `updateTag('cart:{token}')`, which expires the cached cart *immediately* — the next read blocks for fresh data instead of serving stale-while-revalidate. A shopper who just added an item must never see the old count; anything less reads as the action having failed. The chat route (a Route Handler, where `updateTag` is not available) uses `revalidateTag(tag, 'max')` instead, and the assistant states the new count in its reply so the badge's brief staleness is never user-visible.

The cookie is read *outside* every cached scope and the token passed in as an argument — the documented pattern for combining request data with `'use cache'`, and what makes the cache entry per-session.

---

## The cart

The cart is server-side and Redis-backed, owned by the commerce API. The app owns only an anonymous UUID token, held in an **httpOnly, secure, sameSite=lax cookie** — the token is the only credential protecting the cart, so an XSS bug must not be able to read it. The cart is created lazily on first add; visitors who never buy never cost an upstream write.

- **All mutations are Server Actions** (`lib/actions/cart.ts`) — no client fetches, no route handlers.
- **Quantity and removal are optimistic** (`useOptimistic`): lines and the subtotal live in one optimistic state so they always agree — a quantity that moves instantly while the total lags reads as broken. The header badge joins the same moment through a shared pending-delta context (the pattern behind Next.js Commerce's cart store): the server-streamed count stays the source of truth, and in-flight mutations add their delta to it, so the badge and the page cannot show different counts while a slow mutation runs. Failures need no rollback; the Server Action's re-render supplies the truth, plus a message explaining why nothing changed.
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

What differs between consumers is only the **session**. An MCP client has no cookies, so it calls `create_cart` once and carries the token explicitly. The browser's cart lives in an httpOnly cookie that client JavaScript can never read — so it crosses into the agent service at the one seam where a server sees the request: the eve channel's auth walk lifts it into the session's auth attributes, and tools read it from there. The capability functions never know which caller they serve.

### What eve adds that a chat route couldn't

The previous iteration of this assistant was a standalone AI SDK route — same capability layer, same cards — and its limits were structural, not cosmetic. A request/response chat holds the conversation in browser memory and cannot outlive its connection. The eve agent's sessions are **durable**: reload mid-answer and the transcript replays and the in-flight reply keeps streaming (`useEveAgent` with `resume`).

Durability makes two commerce behaviours possible that a chat route cannot express:

- **`watch_stock`** — this API randomises stock per request and genuinely hits zero, so "tell me when it's back" is a real request the storefront could never answer. The tool is a background **workflow**: it returns a task receipt immediately, then alternates a stock check with a durable sleep that holds no compute. Close the panel, navigate away — the run persists, and when stock appears, the completed task wakes the agent, which reports back into the same conversation.
- **Approval-gated writes** — `add_to_cart` above $50 pauses on a confirmation card (`ctx.ask`) and parks, without compute, until the shopper answers — minutes or days later. The confirmation gates *intent*; the shared stock guard still gates *feasibility* at add time, in that order. Agents that write to carts showing their work before larger writes is the enterprise shape of agentic commerce.

The model is configured as an AI Gateway slug (`anthropic/claude-opus-5`), so the ops story is unchanged: **no AI provider API key exists anywhere in this project** — Gateway auth is Vercel OIDC, provisioned and rotated by the platform.

### The chips are tests

Every suggestion chip in the panel is a commitment — it is the one input a reviewer is guaranteed to try — so each lives in `evals/` as a deterministic regression test (`eve eval`): the under-$25 chip asserts the price constraint travels **in the tool call** (the fix for a real bug where the model fetched unfiltered results and the cards contradicted its prose), the cartless add asserts failure is relayed as data rather than papered over, and two more pin the boundary (payment requests decline without touching tools) and the first rule (unknown products are searched, not guessed at). Five evals, thirteen gates, no judge model — a failure means a broken contract, not a grader's opinion.

The design earned its keep concretely, twice: driving the MCP endpoint in a loop surfaced the oversell bug described above, and the under-$25 bug was fixed once in the capability layer for every consumer simultaneously. That is the argument for the shared layer in two sentences.

The agent and MCP endpoints are deliberately unauthenticated (eve fails closed by default; admitting anonymous shoppers is an explicit, documented opt-in in the channel's auth walk): everything readable is already public on the storefront, cart writes require possession of an unguessable token, and a bearer requirement would make both undemonstrable. A production store would put brokered identity in front (`withMcpAuth` / Vercel Connect) so carts belong to authenticated shoppers and per-client rate limits exist.

*Considered and not built:* natural-language → structured search filters feeding `/search` (the same zod schemas that type the tools could type a `generateObject` parser); Slack as a second eve channel; scheduled agent digests. Left out to keep the layer's surface exactly as large as what is demonstrably consumed.

## The hero

The hero's triangle is a plain white SVG in the prerendered shell — and on capable desktops it upgrades itself into a live **WebGPU rendering of the same mark** (LED edge lighting, raycast floor radiance, pointer-tracked glow), using the *Triangle LED Hero* example from [vgpu](https://vgpu.sh), Vercel Labs' WebGPU library, released days before this build.

The integration is strictly additive and gated: `navigator.gpu`, `prefers-reduced-motion: no-preference`, `lg` viewport, and first idle — the 19KB (gzip) renderer chunk is dynamically imported and never enters the critical path. The canvas fades in over the SVG inside the same box (zero layout shift), pauses when hidden or scrolled away, and tears down below `lg`. Every gate failure leaves the SVG exactly as prerendered. Measured with the canvas actively rendering: desktop Lighthouse **100**, TBT **0ms**.

The example was pulled through vgpu's tokenless examples API at an immutable revision with every file's SHA-256 verified against its manifest (`components/home/triangle-led/`, local changes named in the file headers). vgpu distributes examples the way this store distributes commerce: documented for agents, exposed over MCP, integrity-verified — the hero is the store's own thesis, rendered.

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
  api/mcp/              MCP server (Streamable HTTP, 7 tools)
  products/[param]/     PDP — prerendered per product, stock streams
agent/                  the eve agent, as files
  instructions.md       the agent's behaviour contract
  agent.ts              model config (an AI Gateway slug — no API key)
  channels/eve.ts       route auth; lifts the cart cookie into the session
  tools/                thin wrappers over the capability layer; add_to_cart
                        and watch_stock are durable workflow tools
evals/                  the suggestion chips as deterministic regression
                        tests (eve eval)
components/
  agent/                assistant panel (useEveAgent), product cards,
                        the workflow confirmation card
  cart/, commerce/      storefront components + their skeleton twins
  home/triangle-led/    vendored vgpu example (SHA-verified, changes named)
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
  cache-tags.ts         the invalidation vocabulary
  money.ts              integer cents end to end; formatting at the edge
```

Conventions throughout: Server Components by default, `'use client'` only where interactivity demands it; prices stay integer cents until render (`Intl.NumberFormat`, one shared helper); one API client owns the envelope, the bypass header, and error mapping.

## Deliberately out of scope

- **Checkout and payment** — the cart's checkout button is disabled and labelled as such; a silent dead button would be worse than a stated boundary.
- **Authentication** — the brief's cart is anonymous by specification; cross-device persistence is explicitly not required.
- **NL → structured search filters** — designed (the tool schemas already type it), not shipped; see the agentic section.
- **Rate limiting on the public agent endpoints** — documented above with the production-shaped answer (WAF rules, brokered identity) rather than a token gesture in code.
