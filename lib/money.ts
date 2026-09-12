/**
 * Money is carried as integer minor units (cents) end to end, exactly as the
 * commerce API supplies it. It is never converted to a float — binary floating
 * point cannot represent most decimal prices exactly, and rounding drift in a
 * cart subtotal is the kind of bug that surfaces as a one-cent discrepancy at
 * checkout. Conversion to a human-readable string happens once, at render.
 */
export type Money = {
  /** Amount in minor units, e.g. 3000 for $30.00 */
  readonly amount: number;
  /** ISO 4217 code, e.g. "USD" */
  readonly currency: string;
};

export function money(amount: number, currency: string): Money {
  return { amount, currency };
}

export function multiply(value: Money, factor: number): Money {
  return { amount: value.amount * factor, currency: value.currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} to ${b.currency}`);
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

/**
 * Formats for display. `locale` is left undefined by default so the runtime
 * default applies; pass one explicitly where output must be deterministic
 * (for example in tests, or to keep server and client renders identical).
 */
export function formatMoney(value: Money, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
  }).format(value.amount / 100);
}
