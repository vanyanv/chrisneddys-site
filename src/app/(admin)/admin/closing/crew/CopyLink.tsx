"use client";

import { useRef, useState } from "react";

/** The link on screen with a Copy button. Falls back to selecting the text
 * when the clipboard isn't available, so it can be copied by hand. */
export function CopyLink({ url }: { url: string }) {
  const text = useRef<HTMLElement>(null);
  const [note, setNote] = useState("");

  function select() {
    const el = text.current;
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setNote("Copied.");
    } catch {
      select();
      setNote("Selected. Copy it from here.");
    }
  }

  return (
    <>
      <code ref={text} className="clo-url" onClick={select}>
        {url}
      </code>
      <button type="button" className="clo-btn" onClick={() => void copy()}>
        Copy link
      </button>
      <span className="clo-muted" role="status">
        {note}
      </span>
    </>
  );
}
