"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";

type GalleryView = "original" | "generated";
type GalleryStatus = "idle" | "generating" | "failed";

type GalleryState = {
  view: GalleryView;
  setView: (view: GalleryView) => void;
  shotUrl: string | null;
  publishShot: (url: string) => void;
  status: GalleryStatus;
  setStatus: (status: GalleryStatus) => void;
};

const GalleryContext = createContext<GalleryState | null>(null);

export function useGallery(): GalleryState {
  const ctx = useContext(GalleryContext);
  if (!ctx) throw new Error("useGallery must be used inside <ProductGallery>");
  return ctx;
}

type ProductGalleryProps = {
  image: string;
  productName: string;
  /**
   * The rail's streamed slot: the flag gate resolves here (ghost tile →
   * sparkle tile → nothing when the flag is off). Server content composed
   * into a client component — the gate stays a server component and the
   * tile talks to the gallery through context.
   */
  children: ReactNode;
};

/**
 * The PDP image gallery: hero plus thumbnail rail.
 *
 * The generated lifestyle shot REPLACES the hero rather than appending a
 * second image below it — but the original photo stays one thumbnail tap
 * away, because the product photo is the ground truth of what is being
 * bought and the styled shot is an interpretation. The rail is the standard
 * retail affordance for that: once generated, the AI shot joins the gallery
 * like any photographer's shot would.
 *
 * Layout invariants:
 * - The original hero is a `next/image` in the prerendered shell with
 *   fetchPriority="high" — it is the LCP element and never depends on
 *   client state to appear.
 * - The generated image renders as an overlay inside the hero's reserved
 *   box (crossfaded via opacity), so swapping views moves nothing.
 * - Generation progress reports in an overlay pill on the hero — status
 *   never changes the page's layout.
 */
export function ProductGallery({ image, productName, children }: ProductGalleryProps) {
  const [view, setView] = useState<GalleryView>("original");
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<GalleryStatus>("idle");

  // The blob URL lives exactly as long as the gallery does.
  useEffect(
    () => () => {
      if (shotUrl) URL.revokeObjectURL(shotUrl);
    },
    [shotUrl],
  );

  const publishShot = (url: string) => {
    setShotUrl(url);
    // Mount the overlay at opacity 0 first, then select it a frame later so
    // the first reveal crossfades instead of popping.
    requestAnimationFrame(() => setView("generated"));
  };

  const showGenerated = view === "generated" && shotUrl !== null;

  return (
    <GalleryContext.Provider
      value={{ view, setView, shotUrl, publishShot, status, setStatus }}
    >
      <div className="flex flex-col gap-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-surface">
          <Image
            src={image}
            alt={productName}
            fill
            // The page's wide container caps at 1280px, so past that the
            // image column is ~580px regardless of viewport — a bare 50vw
            // would have a 1920px viewport downloading near-double the
            // pixels the layout can show.
            sizes="(min-width: 1280px) 580px, (min-width: 1024px) 50vw, 100vw"
            loading="eager"
            fetchPriority="high"
            className="object-cover"
          />
          {shotUrl && (
            <div
              className={`absolute inset-0 transition-opacity duration-300 ${
                showGenerated ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {/* Generated on demand and served as a blob URL — next/image has
                  nothing to optimise here, and the box already owns the layout. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shotUrl}
                alt={`AI-generated lifestyle photo of ${productName}`}
                className="h-full w-full object-cover"
              />
              <span className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
                AI-generated
              </span>
            </div>
          )}
          {status !== "idle" && !showGenerated && (
            <p
              aria-live="polite"
              className="absolute bottom-3 left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-center text-xs text-white"
            >
              {status === "generating"
                ? `Styling ${productName}… the first time takes a moment.`
                : "Couldn’t style this one right now — tap the sparkle to retry."}
            </p>
          )}
        </div>

        <div className="flex items-start gap-3">
          <GalleryThumb
            active={view === "original"}
            onClick={() => setView("original")}
            label={`Show the product photo of ${productName}`}
          >
            <Image src={image} alt="" fill sizes="80px" className="object-cover" />
          </GalleryThumb>
          {shotUrl && (
            <GalleryThumb
              active={view === "generated"}
              onClick={() => setView("generated")}
              label={`Show the AI-generated lifestyle photo of ${productName}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shotUrl} alt="" className="h-full w-full object-cover" />
              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5 text-white">
                <SparkleIcon className="size-2.5" />
              </span>
            </GalleryThumb>
          )}
          {children}
        </div>
      </div>
    </GalleryContext.Provider>
  );
}

function GalleryThumb({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`relative size-16 shrink-0 overflow-hidden rounded-lg border bg-surface transition-colors sm:size-20 ${
        active ? "border-foreground" : "border-border hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function SparkleIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden>
      <path d="M12 2l1.8 5.6L19.5 9.4 13.8 11.2 12 16.8 10.2 11.2 4.5 9.4l5.7-1.8z" />
      <path d="M18.5 15l.9 2.7 2.6.9-2.6.9-.9 2.6-.9-2.6-2.7-.9 2.7-.9z" />
    </svg>
  );
}
