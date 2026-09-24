"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Shows `children` from `at` (an ISO time with its offset) onwards, and
 * nothing before it — a page change that has to happen on a set day without
 * anyone deploying.
 *
 * The server decides first (`initial`, from its own clock at render): these
 * pages regenerate every minute, so the HTML itself flips within a minute of
 * `at`. The browser then checks its own clock on mount, and if the page is
 * still open when `at` arrives, flips it then too.
 */
export function FromDate({
  at,
  initial,
  children,
}: {
  at: string;
  initial: boolean;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(initial);

  useEffect(() => {
    const wait = Date.parse(at) - Date.now();
    if (wait <= 0) {
      setShown(true);
      return;
    }
    // setTimeout overflows past ~24.8 days; a page is never open that long.
    if (wait > 2 ** 31 - 1) return;
    const timer = setTimeout(() => setShown(true), wait);
    return () => clearTimeout(timer);
  }, [at]);

  return shown ? <>{children}</> : null;
}
