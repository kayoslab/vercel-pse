"use server";

import { redirect } from "next/navigation";
import { parseSearchIntent } from "@/lib/agent/capabilities";
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
    if (intent.query?.trim()) params.set("q", intent.query.trim());
    if (intent.category) params.set("category", intent.category);
  } catch (error) {
    // redirect() itself throws — never swallow it into the fallback.
    if (isFrameworkControlFlow(error)) throw error;
    console.error("Search intent parse failed, falling back to literal query", error);
  }

  if (params.size === 0) params.set("q", utterance);
  redirect(`/search?${params.toString()}`);
}
