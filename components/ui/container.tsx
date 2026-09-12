import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  /** Widen for grid-heavy pages; the default suits prose and single columns. */
  size?: "default" | "wide";
  className?: string;
};

const SIZES = {
  default: "max-w-5xl",
  wide: "max-w-7xl",
} as const;

/**
 * The single source of horizontal rhythm. Page sections compose this rather
 * than repeating max-width and padding, so gutters cannot drift between
 * routes — the kind of inconsistency that reads as unfinished.
 */
export function Container({ children, size = "default", className }: ContainerProps) {
  return (
    <div className={`mx-auto w-full ${SIZES[size]} px-4 sm:px-6 lg:px-8 ${className ?? ""}`}>
      {children}
    </div>
  );
}
