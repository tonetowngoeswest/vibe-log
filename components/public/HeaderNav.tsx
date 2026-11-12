"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderNav() {
  const pathname = usePathname();
  return <nav aria-label="Main navigation">
    <Link href="/#main" aria-current={pathname === "/" ? "page" : undefined}>News</Link>
    <Link href="/#team">Team</Link>
    <Link href="/#photos">Photos</Link>
    <Link href="/#latest">The Latest</Link>
    <Link href="/news/" aria-current={pathname === "/news" || pathname === "/news/" ? "page" : undefined}>Archive</Link>
  </nav>;
}
