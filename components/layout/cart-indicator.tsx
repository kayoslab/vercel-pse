import Link from "next/link";
import { getCartItemCount } from "@/lib/data/cart";

/**
 * Reads a cookie, so it is dynamic and must stream. Kept as its own component
 * precisely so that the dynamic boundary is this small: the rest of the header
 * stays in the static shell and arrives with the document.
 */
export async function CartIndicator() {
  const count = await getCartItemCount();

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart, empty"}
      className="relative inline-flex size-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <CartIcon />
      {count > 0 && (
        /*
          Absolutely positioned so the badge appearing cannot resize the button
          and reflow the header row.
        */
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
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

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d="M2.5 3h2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.8a1.6 1.6 0 0 0 1.6-1.3L20.5 7H5" />
      <circle cx="9.5" cy="20" r="1.4" />
      <circle cx="17.5" cy="20" r="1.4" />
    </svg>
  );
}
