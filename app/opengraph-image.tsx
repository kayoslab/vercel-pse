import { ImageResponse } from "next/og";

/**
 * Default Open Graph image for every route that does not supply its own.
 *
 * Without this, sharing the homepage, search, or cart produced a card with no
 * image at all — only product pages set one (the product shot, in their
 * `generateMetadata`, which takes precedence over this file as the closer
 * segment). Rendered at build time: everything here is deterministic, so it
 * costs nothing per request and cannot fail at share time.
 *
 * Deliberately built from code rather than a static PNG so the mark, wordmark
 * and colours stay in one place — and so there is no binary asset to forget
 * when they change.
 */
export const alt = "Vercel Swag Store — official merchandise";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 40,
          backgroundColor: "#000",
          color: "#fff",
        }}
      >
        <svg width="140" height="122" viewBox="0 0 24 21">
          <path d="M12 0 24 21H0z" fill="#fff" />
        </svg>
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 600,
            letterSpacing: "-2px",
          }}
        >
          Vercel Swag Store
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#888" }}>
          Official merchandise — gear worth shipping
        </div>
      </div>
    ),
    size,
  );
}
