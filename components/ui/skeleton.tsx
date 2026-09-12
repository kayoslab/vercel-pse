type SkeletonProps = {
  /**
   * Tailwind sizing classes. Required, and required for a reason: a skeleton
   * that does not match the dimensions of what replaces it *causes* the layout
   * shift it was meant to prevent. Every caller states the size explicitly so
   * the reservation is visible at the call site rather than buried in a default.
   */
  className: string;
  /** Rounded by default; squared off for image placeholders that need corners. */
  rounded?: boolean;
};

export function Skeleton({ className, rounded = true }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-skeleton ${rounded ? "rounded-md" : ""} ${className}`}
    />
  );
}
