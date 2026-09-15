"use server";

import { redirect } from "next/navigation";
import { parseSearchIntent } from "@/lib/agent/capabilities";
import { listCatalogue } from "@/lib/data/catalogue";
import { isFrameworkControlFlow } from "@/lib/framework";

/** Bounds cost on a public, unauthenticated endpoint. */
const MAX_UTTERANCE_LENGTH = 200;

/**
 * Natural-language search, as a Server Action ending in a redirect.
 *
 * The shape matters more than the model call: the parse produces nothing but
 * a `/search` URL, so the result is ordinary search state — shareable,
 * refreshable, visible in the address bar, exactly like a hand-typed query.
 * The agentic layer enhances the conventional page instead of sitting beside
 * it, and because this is a plain form action it works with JavaScript
 * disabled: POST, parse, 303, results.
 *
 * If the parse fails — model unavailable, gateway hiccup — the utterance is
 * used verbatim as the search term. Degraded is a worse search, never a dead
 * one.
 */
export async function searchByDescription(formData: FormData): Promise<void> {
  const utterance = String(formData.get("describe") ?? "")
    .trim()
    .slice(0, MAX_UTTERANCE_LENGTH);
  if (!utterance) redirect("/search");

  const params = new URLSearchParams();
  try {
    const intent = await parseSearchIntent(utterance);
    const resolved = await resolveAgainstCatalogue(intent);
    if (resolved.query) params.set("q", resolved.query);
    if (resolved.category) params.set("category", resolved.category);
  } catch (error) {
    // redirect() itself throws — never swallow it into the fallback.
    if (isFrameworkControlFlow(error)) throw error;
    console.error("Search intent parse failed, falling back to literal query", error);
  }

  if (params.size === 0) params.set("q", utterance);
  redirect(`/search?${params.toString()}`);
}

/**
 * Validates the model's parse against reality before committing to it.
 *
 * The parse can produce a query and a category that are each defensible but
 * jointly empty — "insulated" and "mugs", say, when the insulated products
 * live in drinkware. A prompt rule reduces this; it cannot eliminate it,
 * because it is asking a model to know the catalogue's shape. So the parse is
 * checked deterministically instead: if the combination finds nothing, degrade
 * to whichever half has results — category first, since browsing a relevant
 * category beats a one-word text match. Redirecting a shopper to a knowably
 * empty page when a populated interpretation exists would waste the parse.
 *
 * `listCatalogue` is cached per parameter set, so these probes are cheap and
 * repeat utterances get faster.
 */
async function resolveAgainstCatalogue(intent: {
  query?: string;
  category?: string;
}): Promise<{ query?: string; category?: string }> {
  const query = intent.query?.trim() || undefined;
  const category = intent.category || undefined;

  if (!query || !category) return { query, category };

  const combined = await listCatalogue({ query, category, limit: 1 });
  if (combined.pagination.total > 0) return { query, category };

  const categoryOnly = await listCatalogue({ category, limit: 1 });
  if (categoryOnly.pagination.total > 0) return { category };

  return { query };
}
