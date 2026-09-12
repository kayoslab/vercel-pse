import { Suspense } from "react";
import type { Metadata } from "next";
import { CartContents } from "@/components/cart/cart-contents";
import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentCart } from "@/lib/data/cart";
import { pageMetadata } from "@/lib/seo";

const TITLE = "Your Cart";
const DESCRIPTION = "Review the items in your Vercel Swag Store cart.";

export async function generateMetadata(): Promise<Metadata> {
  const base = await pageMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: "/cart",
  });

  return {
    ...base,
    // A cart is per-session and has nothing to offer a search index. Left
    // indexable it would compete with real pages for crawl budget and could
    // surface an empty cart as a search result.
    robots: { index: false, follow: true },
  };
}

/**
 * The cart.
 *
 * Entirely dynamic — it reads a cookie — so the heading is the whole static
 * shell and the contents stream. There is nothing to cache at the page level:
 * this is one visitor's cart, and the underlying read is already cached per
 * token in the data layer.
 */
export default function CartPage() {
  return (
    <Container size="wide">
      <div className="flex flex-col gap-8 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{TITLE}</h1>

        <Suspense fallback={<CartSkeleton />}>
          <Contents />
        </Suspense>
      </div>
    </Container>
  );
}

async function Contents() {
  const cart = await getCurrentCart();

  // No cookie, or a cart the API has already expired. Both mean "empty" to the
  // shopper, and neither is an error worth showing them.
  if (!cart) {
    return (
      <CartContents
        cart={{
          token: "",
          lines: [],
          totalItems: 0,
          subtotal: { amount: 0, currency: "USD" },
          createdAt: "",
          updatedAt: "",
        }}
      />
    );
  }

  return <CartContents cart={cart} />;
}

/**
 * Mirrors the real layout: a list column and a summary panel at the same widths,
 * so the page does not reflow when the cart arrives. Two rows is a deliberate
 * guess at a typical cart — enough to occupy the space without pretending to
 * know the count.
 */
function CartSkeleton() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      <div className="flex flex-1 flex-col divide-y divide-border rounded-lg border border-border">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-4 p-4">
            <Skeleton className="size-20 shrink-0 sm:size-24" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="mt-1 h-9 w-32" />
            </div>
          </div>
        ))}
      </div>
      <div className="flex w-full flex-col gap-4 rounded-lg border border-border bg-surface p-5 lg:w-80 lg:shrink-0">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-6 w-full" />
        <div className="min-h-5" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
