"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { pick, type Lang } from "@/lib/closing/crewText";
import { enterCode } from "./actions";

/** One big numeric box; the 4th digit submits on its own. */
export function CodeStep({ token, lang }: { token: string; lang: Lang }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function submit(code: string) {
    startTransition(async () => {
      let result;
      try {
        result = await enterCode(token, code);
      } catch {
        setError(
          pick(
            lang,
            "Couldn't check the code. Check your signal.",
            "No se pudo revisar el código. Revisa tu señal.",
          ),
        );
        setValue("");
        return;
      }
      if (result.status === "ok" || result.status === "gone") {
        router.refresh();
        return;
      }
      setValue("");
      setError(
        result.status === "locked"
          ? pick(
              lang,
              `Too many tries. Wait ${result.minutes} ${result.minutes === 1 ? "minute" : "minutes"}.`,
              `Demasiados intentos. Espera ${result.minutes} ${result.minutes === 1 ? "minuto" : "minutos"}.`,
            )
          : pick(
              lang,
              "That code isn't right. Try again or ask your manager.",
              "Ese código no es correcto. Intenta otra vez o pregúntale al gerente.",
            ),
      );
      input.current?.focus();
    });
  }

  return (
    <form
      className="cl-code-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.length === 4 && !pending) submit(value);
      }}
    >
      <label className="cl-label" htmlFor="cl-code">
        {pick(lang, "Your code", "Tu código")}
      </label>
      <input
        ref={input}
        id="cl-code"
        className="cl-txt cl-codeinput"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={4}
        placeholder="••••"
        autoFocus
        disabled={pending}
        value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
          setValue(v);
          setError("");
          if (v.length === 4 && !pending) submit(v);
        }}
      />
      <div className="cl-warn" role="alert">
        {error}
      </div>
      <div className="cl-muted">
        {pick(
          lang,
          "Your own 4-digit code. This phone remembers it after tonight.",
          "Tu código de 4 dígitos. Este teléfono lo recuerda después de hoy.",
        )}
      </div>
    </form>
  );
}
