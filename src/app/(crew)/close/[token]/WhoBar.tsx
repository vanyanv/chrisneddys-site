"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { pick, type Lang } from "@/lib/closing/crewText";
import { forgetCrew } from "./actions";

export function WhoBar({ name, lang }: { name: string; lang: Lang }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="cl-who">
      <span>
        {pick(lang, "Closing as ", "Cierra: ")}
        <b>{name}</b>
      </span>
      <button
        type="button"
        className="cl-linkbtn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await forgetCrew();
            router.refresh();
          })
        }
      >
        {pick(lang, "Not you?", "¿No eres tú?")}
      </button>
    </div>
  );
}
