"use client";

import { SparkleIcon, useGallery } from "@/components/commerce/product-gallery";

type LifestyleTileProps = {
  /** Product id or slug — becomes the /api/lifestyle URL. */
  productParam: string;
  /** Wearable categories get "See it worn"; everything else "See it styled". */
  worn: boolean;
};

/**
 * The sparkle tile in the gallery rail: the entry point for generated
 * merchandising. It occupies a thumbnail slot from the start — no reserved
 * hero-sized box paying rent for a feature most visits don't use — and once
 * the shot exists it retires, because the generated thumbnail (owned by the
 * gallery) takes its place in the rail.
 *
 * First generation takes ~10s (the model); everyone after gets the
 * CDN-cached copy in milliseconds. Progress and failure copy render in the
 * gallery's hero overlay pill, driven through gallery status — the rail
 * itself never changes size.
 */
export function LifestyleTile({ productParam, worn }: LifestyleTileProps) {
  const { shotUrl, publishShot, status, setStatus } = useGallery();

  // The generated thumbnail has taken over this rail slot.
  if (shotUrl) return null;

  const label = worn ? "See it worn" : "See it styled";

  const generate = async () => {
    setStatus("generating");
    try {
      const response = await fetch(`/api/lifestyle/${encodeURIComponent(productParam)}`);
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      publishShot(URL.createObjectURL(blob));
      setStatus("idle");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <button
      type="button"
      onClick={() => void generate()}
      disabled={status === "generating"}
      aria-label={`${label} — generate an AI lifestyle photo`}
      title={label}
      className="flex size-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-surface text-muted transition-colors hover:border-muted hover:text-foreground disabled:cursor-wait sm:size-20"
    >
      {status === "generating" ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-muted border-t-foreground"
        />
      ) : (
        <SparkleIcon className="size-4" />
      )}
      <span className="px-1 text-center text-[10px] leading-tight">
        {status === "failed" ? "Try again" : label}
      </span>
    </button>
  );
}

/**
 * Dimension ghost for the flag gate's Suspense fallback: an invisible tile
 * of the exact rail-slot size, so the streamed flag decision cannot shift
 * the rail in the common flag-on case. (Flag-off collapses the slot — one
 * shift, only in the administrative state, which is the documented trade of
 * choosing a streamed hole over the precompute pattern.)
 */
export function LifestyleTileGhost() {
  return (
    <div aria-hidden className="invisible size-16 shrink-0 rounded-lg sm:size-20" />
  );
}
