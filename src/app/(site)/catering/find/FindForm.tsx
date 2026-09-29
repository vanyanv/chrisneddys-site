"use client";

import { useState } from "react";
import { findMyOrdersAction } from "./actions";

export function FindForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await findMyOrdersAction(email);
    setBusy(false);
    setSent(true);
  }

  return (
    <form className="cor-find-card" onSubmit={onSubmit}>
      <h1>Find my orders</h1>
      <p>Enter the email you ordered with. We&rsquo;ll send a link to each catering order.</p>
      <label className="cor-field">
        <span className="cor-label">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <button type="submit" className="cor-btn is-primary" disabled={busy}>
        {busy ? "Sending…" : "Email my links"}
      </button>
      {sent && (
        <p className="cor-note is-ok">
          &check; Sent. If that email has orders, the links are in your inbox.
        </p>
      )}
    </form>
  );
}
