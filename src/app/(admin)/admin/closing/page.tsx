import { getDb } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { ownerHistory, type Check, type HistoryNight } from "@/lib/closing/checks";
import { formatTimeLA, nightLabel } from "@/lib/closing/crewText";
import {
  CLOSING_STORE,
  checkSummary,
  dateLabel,
  dotLabel,
  latestResolved,
  nightPill,
  rankByMissed,
  sentLabel,
  streakCaption,
} from "@/lib/closing/ownerText";
import { getOrCreateStore } from "@/lib/closing/store";
import { ClosingShell } from "./ClosingShell";

export const dynamic = "force-dynamic";

function Pill({ night }: { night: HistoryNight }) {
  const p = nightPill(night);
  return <span className={`clo-pill is-${p.tone}`}>{p.text}</span>;
}

function sentLine(check: Check): string {
  return `${check.crewName} · ${formatTimeLA(check.submittedAt)}${check.lang === "es" ? " · in Spanish" : ""}`;
}

function Temp({ item }: { item: Check["items"][number] }) {
  if (item.kind !== "temp" || !item.done || !item.value) return null;
  const over = item.maxValue !== null && Number(item.value) > item.maxValue;
  return (
    <span className={over ? "clo-temp is-over" : "clo-temp"}>
      {item.value}°F{over ? ` · over ${item.maxValue}°F` : ""}
    </span>
  );
}

function LatestNight({ night, tonight }: { night: HistoryNight | null; tonight: HistoryNight }) {
  const pending = !tonight.check && !tonight.windowEnded;
  if (!night) {
    return (
      <section className="clo-card">
        <div className="clo-card-head">
          <span className="rack-eyebrow">Latest night</span>
          <Pill night={tonight} />
        </div>
        <div className="clo-big">{nightLabel(tonight.date, "en")}</div>
        <p>No check yet. Tonight&apos;s is not due.</p>
      </section>
    );
  }
  const check = night.check;
  const summary = check ? checkSummary(check) : null;
  const temps = check?.items.filter((i) => i.kind === "temp" && i.done && i.value) ?? [];
  return (
    <section className="clo-card" aria-labelledby="clo-latest">
      <div className="clo-card-head">
        <span className="rack-eyebrow" id="clo-latest">
          Latest night
        </span>
        <Pill night={night} />
      </div>
      <div className="clo-big">{nightLabel(night.date, "en")}</div>
      {check && summary ? (
        <>
          <p className="clo-line">
            {check.crewName} sent it at {formatTimeLA(check.submittedAt)}
            {check.lang === "es" ? " (in Spanish)" : ""}.
          </p>
          {summary.missed.length > 0 ? (
            <p className="clo-line">
              <span className="clo-lab is-red">Not done</span>{" "}
              {summary.missed.map((i) => sentLabel(check, i)).join(", ")}
            </p>
          ) : null}
          {temps.length > 0 ? (
            <p className="clo-line">
              <span className="clo-lab">Temperatures</span>{" "}
              {temps.map((i, at) => (
                <span key={i.id}>
                  {at > 0 ? "; " : ""}
                  {sentLabel(check, i)} <Temp item={i} />
                </span>
              ))}
            </p>
          ) : null}
          {check.note ? (
            <p className="clo-line">
              <span className="clo-lab">Crew note</span> {check.note}
            </p>
          ) : null}
        </>
      ) : (
        <p className="clo-line">Nobody sent the check that night.</p>
      )}
      {pending ? (
        <p className="clo-muted clo-line">
          Tonight ({dateLabel(tonight.date)}): <strong>Not yet</strong>
        </p>
      ) : null}
    </section>
  );
}

export default async function ClosingNightsPage() {
  const session = await requireOwner();
  const db = await getDb();
  await getOrCreateStore(db, CLOSING_STORE);
  const { nights, items } = await ownerHistory(db, CLOSING_STORE, new Date());
  const tonight = nights[0]!;
  const ranked = rankByMissed(items);
  const decided = nights.filter((n) => n.check || n.windowEnded);
  const sent = decided.filter((n) => n.check).length;
  const oldestFirst = [...nights].reverse();

  return (
    <ClosingShell session={session} active="nights">
      <LatestNight night={latestResolved(nights)} tonight={tonight} />
      <p className="clo-muted clo-count">
        {sent} of {decided.length} nights sent a check.
      </p>

      <h2 className="clo-h2">Missed most, last 2 weeks</h2>
      {ranked.length === 0 ? (
        <p className="clo-muted">No items on the list yet.</p>
      ) : (
        <ul className="clo-ranks">
          {ranked.map((s) => (
            <li key={s.item.id} className="clo-rank">
              <span className="clo-rank-name">{s.item.label}</span>
              <span className={s.missed >= 4 ? "clo-rank-count is-red" : "clo-rank-count"}>
                {s.missed} of {s.nightsSeen}
              </span>
              <span className="clo-dots">
                {[...s.sequence].reverse().map((cell, at) => {
                  const label = dotLabel(oldestFirst[at]!.date, cell);
                  return (
                    <i
                      key={at}
                      className={`clo-dot is-${cell}`}
                      role="img"
                      aria-label={label}
                      title={label}
                    />
                  );
                })}
              </span>
              <span className="clo-muted clo-rank-cap">{streakCaption(s)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="clo-legend">
        <span>
          <i className="clo-dot is-done" />
          Done
        </span>
        <span>
          <i className="clo-dot is-missed" />
          Missed
        </span>
        <span>
          <i className="clo-dot is-over" />
          Over temperature
        </span>
        <span>
          <i className="clo-dot is-none" />
          No check
        </span>
      </p>

      <h2 className="clo-h2">Every night</h2>
      <div className="clo-nights">
        {nights.map((n) => (
          <details key={n.date} className="clo-night">
            <summary>
              <span>
                <span className="clo-night-date">{dateLabel(n.date)}</span>
                <span className="clo-muted clo-night-sub">
                  {n.check ? sentLine(n.check) : n.windowEnded ? "Nothing sent" : "Not sent yet"}
                </span>
              </span>
              <Pill night={n} />
            </summary>
            <div className="clo-detail">
              {n.check ? (
                <>
                  <ul className="clo-checklist">
                    {n.check.items.map((i) => (
                      <li key={i.id}>
                        <span className={i.done ? "clo-mark is-yes" : "clo-mark is-no"}>
                          <span aria-hidden="true">{i.done ? "✓" : "✗"}</span>
                          <span className="clo-sr">{i.done ? "Done" : "Not done"}</span>
                        </span>
                        <span>
                          {sentLabel(n.check!, i)} <Temp item={i} />
                        </span>
                      </li>
                    ))}
                  </ul>
                  {n.check.note ? (
                    <p>
                      <span className="clo-lab">Crew note</span>
                      <br />
                      {n.check.note}
                    </p>
                  ) : null}
                </>
              ) : (
                <p>
                  {n.windowEnded
                    ? "No check was sent for this night."
                    : "The check hasn't been sent yet."}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </ClosingShell>
  );
}
