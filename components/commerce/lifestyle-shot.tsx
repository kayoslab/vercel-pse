"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type LifestyleShotProps = {
  /** Product id or slug — becomes the /api/lifestyle URL. */
  productParam: string;
  productName: string;
  /** Wearable categories get "See it worn"; everything else "See it styled". */
  worn: boolean;
};

type Phase =
  | { name: "idle" }
  | { name: "generating" }
  | { name: "ready"; url: string }
  | { name: "failed" };

/**
 * The "see it styled" button and its result.
 *
 * Nothing is reserved while idle — an empty square on every PDP would be
 * paying rent for a feature most visits don't use. On click the reserved
 * aspect box appears at once (a user-initiated layout change) with a
 * skeleton, and the generated image later fills that exact box — so the one
 * shift is the click's own, and the 10-second swap moves nothing.
 *
 * First generation takes ~10s (the model); everyone after gets the
 * CDN-cached copy in milliseconds. The copy says "first time takes a
 * moment" rather than pretending otherwise, and the result is labelled
 * AI-generated because it is.
 */
export function LifestyleShot({ productParam, productName, worn }: LifestyleShotProps) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const objectUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const generate = async () => {
    setPhase({ name: "generating" });
    try {
      const response = await fetch(`/api/lifestyle/${encodeURIComponent(productParam)}`);
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      setPhase({ name: "ready", url });
    } catch {
      setPhase({ name: "failed" });
    }
  };

  if (phase.name === "idle") {
    return (
      <Button type="button" variant="secondary" onClick={() => void generate()}>
        <SparkleIcon />
        {worn ? "See it worn" : "See it styled"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-surface">
        {phase.name === "generating" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span
              aria-hidden
              className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground"
            />
            <p className="px-6 text-center text-sm text-muted" aria-live="polite">
              Styling {productName}… the first time takes a moment.
            </p>
          </div>
        )}
        {phase.name === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <p className="px-6 text-center text-sm text-muted">
              Couldn&rsquo;t style this one right now.
            </p>
            <Button type="button" variant="secondary" onClick={() => void generate()}>
              Try again
            </Button>
          </div>
        )}
        {phase.name === "ready" && (
          <>
            {/* Generated on demand and served as a blob URL — next/image has
                nothing to optimise here, and the box already owns the layout. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={phase.url}
              alt={`AI-generated lifestyle photo of ${productName}`}
              className="h-full w-full object-cover"
            />
            <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
              AI-generated
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Dimension ghost for the flag gate's Suspense fallback: the exact button,
 * rendered invisible, so the streamed flag decision cannot shift layout in
 * the common flag-on case. (Flag-off collapses the reserved space — one
 * shift, only in the administrative state, which is the documented trade of
 * choosing a streamed hole over the precompute pattern.)
 */
export function LifestyleShotGhost({ worn }: { worn: boolean }) {
  return (
    <div aria-hidden className="invisible self-start">
      <Button type="button" variant="secondary" tabIndex={-1}>
        <SparkleIcon />
        {worn ? "See it worn" : "See it styled"}
      </Button>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M12 2l1.8 5.6L19.5 9.4 13.8 11.2 12 16.8 10.2 11.2 4.5 9.4l5.7-1.8z" />
      <path d="M18.5 15l.9 2.7 2.6.9-2.6.9-.9 2.6-.9-2.6-2.7-.9 2.7-.9z" />
    </svg>
  );
}
