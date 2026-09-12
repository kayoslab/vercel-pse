import { formatMoney, type Money } from "@/lib/money";

type PriceProps = {
  value: Money;
  className?: string;
};

/**
 * The only place money becomes a string.
 *
 * Locale is pinned to `en-US` deliberately. Formatting is locale-dependent, so
 * letting the runtime default decide means the server and the browser can
 * disagree and React reports a hydration mismatch. A real multi-region store
 * would thread the shopper's locale through explicitly; pinning it is the
 * honest single-locale version of that, not an oversight.
 */
export function Price({ value, className }: PriceProps) {
  return (
    <span className={className} data-testid="price">
      {formatMoney(value, "en-US")}
    </span>
  );
}
