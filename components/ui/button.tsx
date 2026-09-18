import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "inverse";
type Size = "md" | "lg";

const VARIANTS = {
  primary:
    "bg-accent text-accent-foreground hover:opacity-90 disabled:hover:opacity-100",
  secondary:
    "border border-border bg-surface-raised text-foreground hover:bg-surface disabled:hover:bg-surface-raised",
  /**
   * For deliberately dark surfaces (the hero) that keep one look in both
   * themes. The theme-aware `primary` maps to black-on-black there in light
   * mode; this stays white-on-black always.
   */
  inverse:
    "bg-white text-black hover:opacity-90 disabled:hover:opacity-100 focus-visible:outline-white",
} as const satisfies Record<Variant, string>;

const SIZES = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
} as const satisfies Record<Size, string>;

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-opacity " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50";

type ButtonStyleProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
};

/** Shared so `Button` and `ButtonLink` cannot visually drift apart. */
export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleProps = {}): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className ?? ""}`;
}

type ButtonProps = ComponentProps<"button"> & ButtonStyleProps;

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return <button {...props} className={buttonStyles({ variant, size, className })} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> &
  ButtonStyleProps & { children: ReactNode };

/**
 * A link that looks like a button. Separate from `Button` on purpose: a
 * navigation is an anchor and must stay keyboard- and middle-click-friendly,
 * which a `<button onClick={router.push}>` quietly breaks.
 */
export function ButtonLink({ variant, size, className, ...props }: ButtonLinkProps) {
  return <Link {...props} className={buttonStyles({ variant, size, className })} />;
}
