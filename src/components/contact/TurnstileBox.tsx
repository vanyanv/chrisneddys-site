"use client";

import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

/**
 * Cloudflare Turnstile inside the contact form. Only drawn when
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` was set at build (see `src/lib/turnstile.ts`
 * for the server half). Mostly invisible: "interaction-only" keeps the box
 * hidden unless Cloudflare wants the visitor to tick it. The widget writes its
 * token into a hidden `cf-turnstile-response` input inside this div, so the
 * form's own FormData carries it to the server action.
 *
 * A token is single-use: the form remounts this (new `key`) after a failed
 * send to get a fresh one.
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject());
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export function TurnstileBox(): ReactElement {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id: string | null = null;
    let gone = false;
    loadTurnstile()
      .then((ts) => {
        if (gone || !boxRef.current) return;
        id = ts.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          appearance: "interaction-only",
          theme: "light",
          action: "contact",
        });
      })
      // Blocked or offline: the send fails "not_verified" and the error
      // points to email and phone, same as any other failure.
      .catch(() => {});
    return () => {
      gone = true;
      if (id) window.turnstile?.remove(id);
    };
  }, []);

  return <div className="cne-ck-turnstile" ref={boxRef} />;
}
