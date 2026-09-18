import Image from "next/image";
import Link from "next/link";

/**
 * Shape returned by the `search_products` / `get_product_details` tools.
 * Declared here rather than imported from the capability layer to keep that
 * server module (and its commerce-client graph) out of the client bundle —
 * the contract is duplicated deliberately and narrowly, and the renderer
 * validates structurally anyway because tool output crosses the wire.
 */
export type ProductSuggestion = {
  id: string;
  slug: string;
  name: string;
  price: string;
  image?: string;
  description?: string;
};

/**
 * A product as rendered inside the conversation.
 *
 * This is what makes the assistant more than a chat log: the model retrieves real
 * catalogue data and the interface renders it as something clickable, priced, and
 * linked to the real product page. The agent's instructions tell the model not
 * to repeat names and prices in prose precisely because they appear here.
 *
 * Horizontal and compact rather than reusing `ProductCard` — a 320px panel is a
 * different layout problem from a three-column grid, and forcing one component to
 * serve both would make each worse.
 */
export function ProductSuggestionCard({ product }: { product: ProductSuggestion }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-background p-2 transition-colors hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface">
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="56px"
            className="object-cover"
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{product.name}</span>
        <span className="text-xs text-muted">{product.price}</span>
      </div>
    </Link>
  );
}
