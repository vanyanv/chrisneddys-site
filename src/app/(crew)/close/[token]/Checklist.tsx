"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { parseTemp, pick, tempOver, type Lang } from "@/lib/closing/crewText";
import { submitNight } from "./actions";

export type ChecklistItem = {
  id: string;
  section: string;
  kind: "check" | "temp";
  maxValue: number | null;
  label: string;
  detail: string | null;
};

type Ans = { done: boolean; value: string };
type Saved = { ans: Record<string, Ans>; note: string };

function read(key: string): Saved | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function write(key: string, saved: Saved | null) {
  try {
    if (saved) localStorage.setItem(key, JSON.stringify(saved));
    else localStorage.removeItem(key);
  } catch {
    // Private mode or blocked storage: the list still works, it just won't survive a reload.
  }
}

const TICK = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export function Checklist({
  token,
  date,
  at,
  lang,
  items,
}: {
  token: string;
  date: string;
  at?: string;
  lang: Lang;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const storageKey = `cne_close:${token}:${date}`;
  const [ans, setAns] = useState<Record<string, Ans>>({});
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [restored, setRestored] = useState(false);
  const tempInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // Restore unsent ticks after mount (localStorage is not there on the server).
  useEffect(() => {
    const saved = read(storageKey);
    if (saved) {
      const ids = new Set(items.map((i) => i.id));
      setAns(Object.fromEntries(Object.entries(saved.ans ?? {}).filter(([id]) => ids.has(id))));
      setNote(saved.note ?? "");
      setNoteOpen(Boolean(saved.note));
    }
    setRestored(true);
  }, [storageKey, items]);

  useEffect(() => {
    if (restored) write(storageKey, { ans, note });
  }, [ans, note, storageKey, restored]);

  const isDone = (id: string) => ans[id]?.done === true;
  const done = items.filter((i) => isDone(i.id)).length;
  const total = items.length;
  const left = items.filter((i) => !isDone(i.id));

  function toggle(item: ChecklistItem) {
    setConfirming(false);
    if (item.kind === "temp" && !isDone(item.id) && parseTemp(ans[item.id]?.value) === null) {
      tempInputs.current[item.id]?.focus();
      return;
    }
    setAns((a) => ({
      ...a,
      [item.id]: { value: a[item.id]?.value ?? "", done: !a[item.id]?.done },
    }));
  }

  function setTemp(item: ChecklistItem, value: string) {
    setConfirming(false);
    setAns((a) => ({ ...a, [item.id]: { value, done: parseTemp(value) !== null } }));
  }

  function send() {
    setError("");
    startTransition(async () => {
      try {
        const result = await submitNight({
          token,
          at,
          note,
          answers: items.map((i) => ({
            itemId: i.id,
            done: isDone(i.id),
            value: i.kind === "temp" ? (ans[i.id]?.value ?? "") : null,
          })),
        });
        if (result.status === "invalid") {
          setError(pick(lang, "Couldn't send. Try again.", "No se pudo enviar. Intenta otra vez."));
          return;
        }
        if (result.status === "sent" || result.status === "already") write(storageKey, null);
        router.refresh();
      } catch {
        setConfirming(false);
        setError(
          pick(
            lang,
            "Couldn't send. Check your signal and tap Send again. Your ticks are saved.",
            "No se pudo enviar. Revisa tu señal y toca Enviar otra vez. Tus marcas están guardadas.",
          ),
        );
      }
    });
  }

  let lastSection: string | null = null;
  return (
    <>
      <div className="cl-prog">
        <div className="cl-ptxt">
          <span>
            {done}
            {pick(lang, " of ", " de ")}
            {total}
            {pick(lang, " done", " hechas")}
          </span>
          <span>
            {done === total
              ? pick(lang, "All done", "Todo listo")
              : `${total - done}${pick(lang, " left", " faltan")}`}
          </span>
        </div>
        <div className="cl-track">
          <div
            className="cl-fill"
            style={{ width: `${total ? Math.round((100 * done) / total) : 0}%` }}
          />
        </div>
      </div>

      <div className="cl-items">
        {items.map((item) => {
          const heading = item.section !== lastSection ? item.section : null;
          lastSection = item.section;
          const checked = isDone(item.id);
          const value = ans[item.id]?.value ?? "";
          return (
            <div key={item.id} style={{ display: "contents" }}>
              {heading ? <div className="cl-sec">{heading}</div> : null}
              <div className={`cl-item${checked ? " cl-item-done" : ""}`}>
                <label>
                  <input type="checkbox" checked={checked} onChange={() => toggle(item)} />
                  <span className="cl-box">{checked ? TICK : null}</span>
                  <span>
                    <span className="cl-t">{item.label}</span>
                    {item.detail ? (
                      <>
                        <br />
                        <span className="cl-sub">{item.detail}</span>
                      </>
                    ) : null}
                  </span>
                </label>
                {item.kind === "temp" ? (
                  <>
                    <span />
                    <div>
                      <div className="cl-temp">
                        <input
                          ref={(el) => {
                            tempInputs.current[item.id] = el;
                          }}
                          inputMode="decimal"
                          placeholder="°F"
                          aria-label={`${item.label} °F`}
                          value={value}
                          onChange={(e) => setTemp(item, e.target.value.slice(0, 6))}
                        />
                        <span>°F</span>
                      </div>
                      <div className="cl-warn">
                        {tempOver(value, item.maxValue)
                          ? pick(
                              lang,
                              `Over ${item.maxValue}°F. Tell the manager before you leave.`,
                              `Más de ${item.maxValue}°F. Avísale al gerente antes de irte.`,
                            )
                          : ""}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {noteOpen ? (
        <textarea
          className="cl-txt"
          rows={2}
          maxLength={500}
          autoFocus
          placeholder={pick(lang, "Note for the owner (optional)", "Nota para el dueño (opcional)")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      ) : (
        <button type="button" className="cl-linkbtn cl-start" onClick={() => setNoteOpen(true)}>
          {pick(lang, "+ Add a note", "+ Agregar una nota")}
        </button>
      )}

      <div className={`cl-submitbar${confirming ? " cl-submitbar-static" : ""}`}>
        {error ? (
          <div className="cl-warn" role="alert">
            {error}
          </div>
        ) : null}
        {confirming ? (
          <div className="cl-confirm">
            <b>
              {left.length === 1
                ? pick(lang, "1 item isn't ticked", "1 cosa sin marcar")
                : pick(
                    lang,
                    `${left.length} items aren't ticked`,
                    `${left.length} cosas sin marcar`,
                  )}
            </b>
            <ul>
              {left.map((i) => (
                <li key={i.id}>{i.label}</li>
              ))}
            </ul>
            <div>{pick(lang, "They'll show as not done.", "Saldrán como no hechas.")}</div>
            <div className="cl-two">
              <button
                type="button"
                className="cl-ghost"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                {pick(lang, "Back", "Regresar")}
              </button>
              <button type="button" className="cl-bigbtn" disabled={pending} onClick={send}>
                {pending
                  ? pick(lang, "Sending…", "Enviando…")
                  : pick(lang, "Send anyway", "Enviar así")}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="cl-bigbtn"
            disabled={pending}
            onClick={() => (left.length > 0 ? setConfirming(true) : send())}
          >
            {pending
              ? pick(lang, "Sending…", "Enviando…")
              : `${pick(lang, "Send", "Enviar")} · ${done}/${total}`}
          </button>
        )}
      </div>
    </>
  );
}
