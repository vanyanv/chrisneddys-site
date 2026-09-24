"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { brand } from "@/data/brand";
import { track } from "@/lib/track";
import { sendContactMessage } from "@/lib/siteForms";
import {
  CONTACT_TOPICS as TOPICS,
  EMAIL_MAX,
  MESSAGE_MAX as MAX,
  NAME_MAX,
  PHONE_MAX,
  emailLooksSendable,
  type ContactTopic as Topic,
} from "@/lib/siteFormFields";

/**
 * The contact form, drawn as a diner guest check.
 *
 * Submissions go to the `sendContactMessage` server action, which emails them
 * through Resend to the address the site shows (`brand.email`) with the
 * sender's address as reply-to. The fields, caps and topics live in
 * `siteFormFields.ts` so the server checks exactly what this form offers.
 *
 * Every failure path ends somewhere the sender can still reach us: email not
 * set up, a rejected send and a dead network all fall through to the same
 * mailto.
 */

/** The message box's hint follows the chosen topic, so "Order issue" asks for
 * the one thing that lets us find the order. */
const HINTS: Record<Topic, string> = {
  "Catering & events":
    "Tell us what you need. Dates, headcount and a neighbourhood help us answer in one go.",
  "Press & media": "Tell us what you need.",
  Partnerships: "Tell us what you need.",
  "Order issue": "Your order number and what went wrong.",
  "Something else": "Tell us what you need.",
};

type Sent = { ticket: string; stamp: string; name: string; email: string; topic: Topic };
type Status = "idle" | "sending" | "sent" | "error";

/** Field-level messages, keyed by input name. */
type Errors = Partial<Record<"name" | "email" | "message", string>>;

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function stampNow(d: Date): string {
  const hh = d.getHours();
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${DAYS[d.getDay()]} ${mo}/${dd} · ${h12}:${mm} ${hh >= 12 ? "PM" : "AM"}`;
}

export function GuestCheck(): ReactElement {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;

  const [topic, setTopic] = useState<Topic>(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);

  /**
   * The number and the time are the two things that make a check read as a
   * check, and both would differ between the prerendered HTML and the first
   * client render. They are filled after mount so the exported page and the
   * hydrated one agree; until then the header renders its dashes.
   */
  const [ticket, setTicket] = useState("————");
  const [stamp, setStamp] = useState("————");
  useEffect(() => {
    setTicket(String(4000 + Math.floor(Math.random() * 900)));
    setStamp(stampNow(new Date()));
  }, []);

  const formRef = useRef<HTMLFormElement>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  /* Moving focus to the receipt is what tells a screen reader — and a keyboard
     user, whose focus would otherwise land on <body> — that the form is gone
     and something replaced it. */
  useEffect(() => {
    if (status === "sent") receiptRef.current?.focus();
  }, [status]);

  function validate(data: FormData): Errors {
    const next: Errors = {};
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const msg = String(data.get("message") ?? "").trim();

    if (!name) next.name = "We need a name to answer to.";
    if (!email) next.email = "We need somewhere to send the answer.";
    else if (!emailLooksSendable(email)) next.email = "That address is missing an @ or a domain.";
    if (!msg) next.message = "Tell us what you need and we'll take it from there.";
    return next;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    const form = e.currentTarget;
    const data = new FormData(form);

    const found = validate(data);
    setErrors(found);

    /* Focus the first field that failed, by name. Querying for the
       `aria-invalid` attribute instead would find nothing: the state that
       sets it has not been rendered yet at this point in the handler, so
       focus would silently stay on the submit button. */
    const firstBad = (["name", "email", "message"] as const).find((k) => found[k]);
    if (firstBad) {
      form.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
      return;
    }

    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();

    setStatus("sending");
    setFailure("");

    // The topic comes from state, not the radio group, so the server sees
    // exactly what the chips show.
    data.set("topic", topic);

    try {
      const result = await sendContactMessage(data);
      if (!result.ok) {
        setStatus("error");
        setFailure(
          result.reason === "not_configured"
            ? "The form isn't wired up yet."
            : result.reason === "throttled"
              ? "That's a lot of messages in a row."
              : "That didn't go through.",
        );
        // A fixed token, never the message, the name, the email or the phone.
        track("contact_error", { topic, reason: result.reason });
        return;
      }

      setSent({ ticket, stamp, name, email, topic });
      setStatus("sent");
      // Fired only once the form is genuinely delivered, not on submit — a
      // conversion that counts attempts counts its own failures as successes.
      track("contact_submit", { topic });
    } catch {
      setStatus("error");
      setFailure("That didn't go through.");
      track("contact_error", { topic, reason: "network" });
    }
  }

  function reset() {
    setSent(null);
    setStatus("idle");
    setErrors({});
    setFailure("");
    setMessage("");
    setTopic(TOPICS[0]);
    formRef.current?.reset();
    setTicket(String(4000 + Math.floor(Math.random() * 900)));
    setStamp(stampNow(new Date()));
  }

  /* ---------------------------------------------------------------- sent -- */
  if (status === "sent" && sent) {
    return (
      <div
        className="cne-ck cne-ck-receipt"
        ref={receiptRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
      >
        <div className="cne-ck-perf" aria-hidden="true" />
        <div className="cne-ck-mark" aria-hidden="true">
          ✓
        </div>
        <h2 className="cne-ck-up">Order up</h2>
        <p className="cne-ck-lede">
          It&rsquo;s in. We&rsquo;ll get back to you at <strong>{sent.email}</strong> — a real
          person reads every one of these.
        </p>

        <dl className="cne-ck-sum">
          {(
            [
              ["Ticket", `No. ${sent.ticket}`],
              ["From", sent.name],
              ["Subject", sent.topic],
              ["Sent", sent.stamp],
            ] as const
          ).map(([k, v]) => (
            <div className="cne-ck-row" key={k}>
              <dt>{k}</dt>
              <span className="cne-ck-dots" aria-hidden="true" />
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <button type="button" className="cne-ck-again" onClick={reset}>
          Send another
        </button>
      </div>
    );
  }

  /* ---------------------------------------------------------------- form -- */
  const sending = status === "sending";
  const left = MAX - message.length;

  return (
    <form
      className={`cne-ck${sending ? " is-sending" : ""}`}
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
    >
      <div className="cne-ck-perf" aria-hidden="true" />

      <div className="cne-ck-head">
        <h2 className="cne-ck-title">Guest check</h2>
        <p className="cne-ck-meta">
          No.&nbsp;{ticket}
          <br />
          {stamp}
        </p>
      </div>

      <div className="cne-ck-body">
        <Field
          id={id("name")}
          name="name"
          label="Name"
          type="text"
          autoComplete="name"
          maxLength={NAME_MAX}
          placeholder="Who's asking?"
          error={errors.name}
        />
        <Field
          id={id("email")}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={EMAIL_MAX}
          placeholder="you@example.com"
          error={errors.email}
        />
        <Field
          id={id("phone")}
          name="phone"
          label="Phone"
          optional
          type="tel"
          autoComplete="tel"
          maxLength={PHONE_MAX}
          inputMode="tel"
          placeholder="(323) 000-0000"
        />

        <fieldset className="cne-ck-fs">
          <legend className="cne-ck-label">What&rsquo;s this about?</legend>
          <div className="cne-ck-chips">
            {TOPICS.map((t) => (
              <label className="cne-ck-chip" key={t}>
                <input
                  type="radio"
                  name="topic"
                  value={t}
                  checked={topic === t}
                  onChange={() => setTopic(t)}
                />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className={`cne-ck-field${errors.message ? " is-bad" : ""}`}>
          <label className="cne-ck-label" htmlFor={id("message")}>
            Message
          </label>
          <span className="cne-ck-line">
            <textarea
              id={id("message")}
              name="message"
              className="cne-ck-input cne-ck-area"
              maxLength={MAX}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={HINTS[topic]}
              aria-invalid={errors.message ? true : undefined}
              aria-describedby={errors.message ? id("message-err") : id("message-count")}
            />
            <span className="cne-ck-underline" aria-hidden="true" />
          </span>
          {errors.message && (
            <p className="cne-ck-err" id={id("message-err")}>
              {errors.message}
            </p>
          )}
          <p
            className={`cne-ck-count${left < 120 ? " is-warn" : ""}`}
            id={id("message-count")}
            aria-live="off"
          >
            {message.length} / {MAX}
          </p>
        </div>

        {/* The server drops any submission that arrives with this filled in.
            Hidden from sight and from the accessibility tree, and skipped by
            the tab order, so only something reading the DOM will fill it. */}
        <input
          type="checkbox"
          name="botcheck"
          className="cne-ck-pot"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        {status === "error" && (
          <p className="cne-ck-fail" role="alert" data-surface="contact">
            <strong>{failure}</strong> Email us straight at{" "}
            <a href={`mailto:${brand.email}`}>{brand.email}</a> or call{" "}
            <a href={`tel:${brand.phoneTel}`}>{brand.phone}</a> — we&rsquo;ll pick up.
          </p>
        )}

        <div className="cne-ck-total">
          <button type="submit" className="cne-ck-send" disabled={sending}>
            <span>{sending ? "Sending" : "Send it"}</span>
            {sending ? (
              <span className="cne-ck-spin" aria-hidden="true" />
            ) : (
              <span className="cne-ck-arrow" aria-hidden="true">
                →
              </span>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

/** One ruled line on the check: label, input, the underline that wipes in. */
function Field({
  id,
  name,
  label,
  optional,
  error,
  ...input
}: {
  id: string;
  name: string;
  label: string;
  optional?: boolean;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return (
    <div className={`cne-ck-field${error ? " is-bad" : ""}`}>
      <label className="cne-ck-label" htmlFor={id}>
        {label}
        {optional && <span className="cne-ck-opt"> — optional</span>}
      </label>
      <span className="cne-ck-line">
        <input
          {...input}
          id={id}
          name={name}
          className="cne-ck-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        <span className="cne-ck-underline" aria-hidden="true" />
      </span>
      {error && (
        <p className="cne-ck-err" id={`${id}-err`}>
          {error}
        </p>
      )}
    </div>
  );
}
