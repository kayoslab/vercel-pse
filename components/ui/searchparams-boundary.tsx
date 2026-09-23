"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

type SearchParamsBoundaryProps = {
  /** Which params participate in the key — others can change without a remount. */
  params: readonly string[];
  fallback: ReactNode;
  children: ReactNode;
};

/**
 * A Suspense boundary that RE-shows its fallback when the named search params
 * change.
 *
 * Why this exists: navigations are transitions, and React keeps a boundary's
 * old children on screen through a transition instead of dropping to the
 * fallback — right for most UI, wrong for paginated results, where clicking
 * "Next" then looks like nothing happened until the new page streams in.
 * Changing the boundary's `key` opts out: a new boundary instance mounts
 * suspended and shows the skeleton the moment the navigation commits.
 *
 * Why it is a client component: the pages keep their shells static by never
 * awaiting `searchParams`, so the key cannot be computed server-side without
 * dynamic-izing the whole page. `useSearchParams` reads the same values
 * client-side — at the price that this component is itself request-dependent
 * and must sit inside a server Suspense boundary (whose fallback covers
 * prerender and first paint; this one takes over for in-app navigations).
 */
export function SearchParamsBoundary({
  params,
  fallback,
  children,
}: SearchParamsBoundaryProps) {
  const searchParams = useSearchParams();
  const key = params.map((p) => `${p}=${searchParams.get(p) ?? ""}`).join("&");
  return (
    <Suspense key={key} fallback={fallback}>
      {children}
    </Suspense>
  );
}
