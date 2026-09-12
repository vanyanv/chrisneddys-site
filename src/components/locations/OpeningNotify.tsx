"use client";

import { useState, type FormEvent } from "react";
import { brand } from "@/data/brand";
import { locations } from "@/data/locations";
import { slugFor } from "@/lib/locationSlug";
import { track } from "@/lib/track";
import { HttpError, emailLooksSendable, hasWeb3FormsKey, submitWeb3Form } from "@/lib/web3forms";

/**
 * "Tell me when this one opens", on the Glendale and Van Nuys pages.
 *
 * Those pages currently answer a real question — where the next location is —
 * and then collect nothing from the person who asked. Two neighbourhoods of
 * pre-launch demand arrive, read an address, and leave with no way for us to
 * tell them the doors are open.
 *
 * It also builds the one thing this business does not have and its nearest
 * rival does: a list of its own customers, reachable without paying a platform
 * for the privilege.
 *
 * Same Web3Forms endpoint as the contact form, because the site is a static
 * export with no server of its own to post to. Without a key the field still
 * renders and validates, and falls through to email — the same failure path
 * the guest check uses.
 */

/**
 * The reporting name for this store, which is the URL slug — `van-nuys`, not
 * "van nuys". The component is handed a neighbourhood to print, so the slug is
 * looked back up rather than derived from the display string; a display name
 * that changes must not quietly split the signup history in two.
 */
function slugForHood(hood: string): string {
  const match = locations.find((l) => l.neighbourhood === hood);
  return match ? slugFor(match) : hood.trim().toLowerCase().replace(/\s+/g, "-");
}

type Status = "idle" | "sending" | "sent" | "error";

export function OpeningNotify({ hood }: { hood: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();

    if (!emailLooksSendable(email)) {
      setError("That email doesn't look right.");
      form.querySelector<HTMLElement>('[name="email"]')?.focus();
      return;
    }

    setError("");
    setStatus("sending");

    const location = slugForHood(hood);

    if (!hasWeb3FormsKey()) {
      setStatus("error");
      setError("Not wired up yet — email us instead.");
      // A form that cannot send is indistinguishable from a form nobody used,
      // unless it says so. The reason is a fixed token — never the address, and
      // never the provider's message.
      track("notify_error", { location, reason: "no_key" });
      return;
    }

    try {
      await submitWeb3Form({
        subject: `[Opening list — ${hood}] ${email}`,
        replyto: email,
        botcheck: String(data.get("botcheck") ?? ""),
        email,
        location: hood,
      });

      setStatus("sent");
      // Its own event, not `contact_submit`: pre-launch demand for a store that
      // has not opened is a different question from "someone wrote to us", and
      // folding the two together inflated the contact key event while hiding
      // the signup as a metric of its own.
      track("notify_signup", { location });
    } catch (err) {
      setStatus("error");
      setError("That didn't go through.");
      track("notify_error", {
        location,
        reason:
          err instanceof HttpError ? (err.rejected ? "rejected" : `http_${err.status}`) : "network",
      });
    }
  }

  if (status === "sent") {
    return (
      <div className="cne-loc-note" role="status" style={{ marginTop: 14 }}>
        <strong>You&rsquo;re on the list.</strong> We&rsquo;ll email you once the {hood} location is
        serving — nothing else.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate style={{ marginTop: 14, maxWidth: "42ch" }}>
      <label
        htmlFor={`notify-${hood}`}
        style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}
      >
        Know when {hood} opens
      </label>

      {/* Honeypot. Real people never see it; bots fill everything. */}
      <input
        type="checkbox"
        name="botcheck"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", opacity: 0 }}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          id={`notify-${hood}`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `notify-err-${hood}` : undefined}
          style={{
            flex: "1 1 190px",
            minWidth: 0,
            padding: "10px 12px",
            fontSize: 14,
            fontFamily: "inherit",
            border: "2px solid var(--a-ink, #1a1612)",
            background: "var(--a-paper, #fff8e7)",
            color: "inherit",
          }}
        />
        <button
          type="submit"
          className="cne-mini is-red"
          disabled={status === "sending"}
          style={{ cursor: status === "sending" ? "wait" : "pointer" }}
        >
          {status === "sending" ? "SENDING…" : "NOTIFY ME"}
        </button>
      </div>

      {error && (
        <p
          id={`notify-err-${hood}`}
          role="alert"
          style={{ margin: "8px 0 0", fontSize: 13, color: "var(--a-red, #e63027)" }}
        >
          {error} You can always reach us at{" "}
          <a href={`mailto:${brand.email}`} style={{ color: "inherit" }}>
            {brand.email}
          </a>
          .
        </p>
      )}

      <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.7 }}>
        One email, when the doors open. No newsletter.
      </p>
    </form>
  );
}
