import { CartBadgeLink, CartIcon } from "@/components/layout/cart-badge";
import { getCartItemCount } from "@/lib/data/cart";

/**
 * Reads a cookie, so it is dynamic and must stream. Kept as its own component
 * precisely so that the dynamic boundary is this small: the rest of the header
 * stays in the static shell and arrives with the document.
 *
 * The count is handed to a client component that adds the shared pending
 * delta from in-flight cart mutations — see cart-badge-context.tsx for why
 * the badge cannot rely on the server count alone while a mutation runs.
 */
export async function CartIndicator() {
  const count = await getCartItemCount();
  return <CartBadgeLink count={count} />;
}

/**
 * The fallback renders the icon at full size with no badge, so the header is
 * complete and correctly sized from the first paint — only the number streams
 * in. A spinner here would be worse than the real thing.
 */
export function CartIndicatorSkeleton() {
  return (
    <div className="inline-flex size-10 items-center justify-center text-muted" aria-hidden>
      <CartIcon />
    </div>
  );
}
