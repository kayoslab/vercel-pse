"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  href: string;
  children: ReactNode;
};

/**
 * The only client component in the header, and the smallest it can be.
 *
 * Knowing which section you are in is basic orientation, and `aria-current`
 * gives that to assistive technology rather than conveying it through colour
 * alone. Scoped to the link itself so the surrounding header stays a Server
 * Component and stays in the static shell.
 */
export function NavLink({ href, children }: NavLinkProps) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        active
          ? "font-medium text-foreground"
          : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
