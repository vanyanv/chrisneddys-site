"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE, type Lang } from "@/lib/closing/crewText";

/** Switches English/Español: a plain (non-httpOnly) cookie, then a refresh. */
export function LangButton({ lang }: { lang: Lang }) {
  const router = useRouter();
  const next: Lang = lang === "es" ? "en" : "es";
  return (
    <button
      type="button"
      className="cl-chip"
      lang={next}
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${next}; path=/close; max-age=${365 * 24 * 60 * 60}; samesite=lax`;
        router.refresh();
      }}
    >
      {next === "es" ? "Español" : "English"}
    </button>
  );
}
