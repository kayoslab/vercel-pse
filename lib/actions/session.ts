"use server";

import { updateTag } from "next/cache";
import { cookies } from "next/headers";
import { cacheTags } from "@/lib/cache-tags";
import { commerce } from "@/lib/commerce";
import { CART_COOKIE } from "@/lib/data/cart";

/**
 * Guarantees the visitor has a cart cookie before the assistant needs one.
 *
 * This exists because of a constraint in streaming Route Handlers: response
 * headers are flushed before tool execution begins, so a `cookies().set()` from
 * inside a streamed chat response arrives too late and is silently dropped. An
 * agent that created a cart mid-stream would add items to a cart whose token the
 * browser never received — the shopper would be told it worked and see an empty
 * cart.
 *
 * A Server Action has no such problem. The assistant calls this when it opens,
 * so by the time any message is sent the session exists and the chat route only
 * ever has to *read* the cookie. The ~3s cart creation happens while the shopper
 * is still typing, and visitors who never open the assistant never pay for it.
 */
export async function ensureCartSession(): Promise<void> {
  const store = await cookies();
  if (store.get(CART_COOKIE)?.value) return;

  const created = await commerce.createCart();
  store.set(CART_COOKIE, created.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Expires the cached cart after the assistant has changed it.
 *
 * The chat route cannot do this itself. `updateTag` is Server-Action-only, and
 * the `revalidateTag` a Route Handler *can* call is stale-while-revalidate — it
 * marks the entry stale and still serves the old value to the next reader. The
 * header badge therefore kept showing the pre-add count while the cart page
 * showed the item, which reads as the agent having lied about what it did.
 *
 * Calling this from the client once the stream finishes fixes both halves: a
 * Server Action may expire the entry immediately, and its response re-renders
 * the tree, so the badge updates without a navigation.
 */
export async function refreshCartCache(): Promise<void> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  if (!token) return;
  updateTag(cacheTags.cart(token));
}
