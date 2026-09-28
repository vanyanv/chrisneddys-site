"use client";

/** Settings → Catering (A6): ordering on/off, hours per store per weekday,
 * days off, and the delivery/reply/lead-time rules — `catering_settings`,
 * via `saveCateringSettingsAction`. Its own form and its own sticky save
 * bar, independent of the store settings form above it on the page (same
 * "separate form, separate save" pattern `ChangePasswordCard`/`OwnersCard`
 * already use there) — a different table, so a different save. */
import { useActionState, useCallback, useMemo, useRef, useState } from "react";
import type { CateringDayOff, CateringHours } from "@/db/schema";
import type { CateringSettings } from "@/lib/catering/settings";
import { CATERING_STORES, type CateringStoreId } from "@/lib/catering";
import { saveCateringSettingsAction, type SaveCateringSettingsState } from "./settingsActions";

const initial: SaveCateringSettingsState = {};

/** Monday-first display order — the wireframe's MON…SUN row order — mapped
 * onto the `Weekday` 0=Sunday…6=Saturday keys `CateringHours` actually uses. */
const WEEKDAY_DISPLAY: { key: string; label: string }[] = [
  { key: "1", label: "MON" },
  { key: "2", label: "TUE" },
  { key: "3", label: "WED" },
  { key: "4", label: "THU" },
  { key: "5", label: "FRI" },
  { key: "6", label: "SAT" },
  { key: "0", label: "SUN" },
];

const STORE_OPTIONS: { id: "all" | CateringStoreId; label: string }[] = [
  { id: "all", label: "Both locations" },
  ...CATERING_STORES.map((s) => ({ id: s.id, label: s.name })),
];

function cloneHours(hours: CateringHours): CateringHours {
  return JSON.parse(JSON.stringify(hours)) as CateringHours;
}

type FormValues = {
  orderingOn: boolean;
  hours: CateringHours;
  daysOff: CateringDayOff[];
  rangeMiles: string;
  deliveryFeeDollars: string;
  replyHours: string;
  leadHours: string;
  bigLeadHours: string;
  bigHeadcount: string;
  ownerEmail: string;
};

function valuesFromSettings(settings: CateringSettings): FormValues {
  return {
    orderingOn: settings.orderingOn,
    hours: cloneHours(settings.hours),
    daysOff: settings.daysOff,
    rangeMiles: String(settings.rangeMiles),
    deliveryFeeDollars: (settings.deliveryFeeCents / 100).toFixed(2),
    replyHours: String(settings.replyHours),
    leadHours: String(settings.leadHours),
    bigLeadHours: String(settings.bigLeadHours),
    bigHeadcount: String(settings.bigHeadcount),
    ownerEmail: settings.ownerEmail,
  };
}

function to12Hour(hhmm: string): string {
  const [hStr, m] = hhmm.split(":");
  const h = Number(hStr ?? 0);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m ?? "00"} ${period}`;
}

export function CateringSettingsSection({ settings }: { settings: CateringSettings }) {
  const [state, formAction, pending] = useActionState(saveCateringSettingsAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  const baselineRef = useRef<FormValues>(valuesFromSettings(settings));
  const [values, setValues] = useState<FormValues>(baselineRef.current);
  const [store, setStore] = useState<CateringStoreId>(CATERING_STORES[0].id);
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);

  const dirty = JSON.stringify(values) !== JSON.stringify(baselineRef.current);

  const setField = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const discard = useCallback(() => {
    setValues(baselineRef.current);
  }, []);

  const lastSavedAtRef = useRef<string | undefined>(undefined);
  if (state?.ok && state.savedAt && state.savedAt !== lastSavedAtRef.current) {
    lastSavedAtRef.current = state.savedAt;
    baselineRef.current = values;
    if (savedAt !== state.savedAt) setSavedAt(state.savedAt);
  }

  const week = values.hours[store] ?? {};

  function setDay(dayKey: string, closed: boolean, windows: { open: string; close: string }[]) {
    setField("hours", {
      ...values.hours,
      [store]: { ...week, [dayKey]: closed ? [] : windows },
    });
  }

  function addWindow(dayKey: string) {
    const windows = week[dayKey] ?? [];
    setDay(dayKey, false, [...windows, { open: "10:00", close: "20:00" }]);
  }

  function removeWindow(dayKey: string, index: number) {
    const windows = (week[dayKey] ?? []).filter((_, i) => i !== index);
    setDay(dayKey, windows.length === 0, windows);
  }

  function updateWindow(
    dayKey: string,
    index: number,
    patch: Partial<{ open: string; close: string }>,
  ) {
    const windows = (week[dayKey] ?? []).map((w, i) => (i === index ? { ...w, ...patch } : w));
    setDay(dayKey, false, windows);
  }

  function copyToOtherStore() {
    const other = CATERING_STORES.find((s) => s.id !== store);
    if (!other) return;
    const copied: CateringHours = { ...values.hours, [other.id]: JSON.parse(JSON.stringify(week)) };
    setField("hours", copied);
  }

  const otherStoreName = CATERING_STORES.find((s) => s.id !== store)?.name ?? "";

  const [newDayOffDate, setNewDayOffDate] = useState("");
  const [newDayOffStore, setNewDayOffStore] = useState<"all" | CateringStoreId>("all");

  function addDayOff() {
    if (!newDayOffDate) return;
    setField("daysOff", [...values.daysOff, { date: newDayOffDate, store: newDayOffStore }]);
    setNewDayOffDate("");
    setNewDayOffStore("all");
  }

  function removeDayOff(index: number) {
    setField(
      "daysOff",
      values.daysOff.filter((_, i) => i !== index),
    );
  }

  const hoursJson = useMemo(() => JSON.stringify(values.hours), [values.hours]);
  // `values.daysOff` keeps a single `{ store: "all" }` row per date so the
  // list above can show one combined "Both locations" line instead of one
  // per store — but `toScheduleDaysOff` (`@/lib/catering/hours`), which
  // turns the saved list back into what the calendar actually checks, has
  // no such sentinel: per its own module comment, "all stores" is
  // represented in the database as the same date repeated for every
  // catering store, and a `store` value it doesn't recognize as a real
  // store id is silently dropped. Expanding "all" into one row per store
  // only here, at the boundary serialized into the hidden `daysOff` field,
  // keeps that nice single-row display while saving a form the backend
  // actually understands.
  const daysOffJson = useMemo(
    () =>
      JSON.stringify(
        values.daysOff.flatMap((d): CateringDayOff[] =>
          d.store === "all" ? CATERING_STORES.map((s) => ({ date: d.date, store: s.id })) : [d],
        ),
      ),
    [values.daysOff],
  );

  return (
    <>
      <h2 className="adm-group-label" style={{ fontSize: 22, fontFamily: "inherit" }}>
        Catering
      </h2>
      <p className="adm-settings-lede" style={{ margin: "4px 0 18px" }}>
        What catering customers can pick online.
      </p>

      {state?.error && (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      )}

      <form
        id="catering-settings-form"
        ref={formRef}
        action={formAction}
        className="adm-settings-grid"
      >
        <input type="hidden" name="hours" value={hoursJson} />
        <input type="hidden" name="daysOff" value={daysOffJson} />

        <div className="adm-settings-section is-full">
          <div className="cat-store-tabs">
            {CATERING_STORES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`adm-filter-chip${store === s.id ? " is-on" : ""}`}
                onClick={() => setStore(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>

          <h3 className="adm-group-label">
            Catering hours · {CATERING_STORES.find((s) => s.id === store)?.name}
          </h3>

          {WEEKDAY_DISPLAY.map(({ key, label }) => {
            const windows = week[key] ?? [];
            const closed = windows.length === 0;
            return (
              <div key={key} className="cat-hours-row">
                <span className="cat-hours-day">{label}</span>
                <label className="adm-toggle">
                  {/* `key` keyed to the last successful save (see the same
                   * `key` on `#orderingOn` below for the full explanation):
                   * without it, this checkbox's native DOM state can get
                   * silently desynced from React's own `checked={!closed}`
                   * after a save. */}
                  <input
                    key={`${key}-${state?.savedAt ?? "unsaved"}`}
                    type="checkbox"
                    className="adm-toggle-input"
                    checked={!closed}
                    onChange={(e) =>
                      setDay(
                        key,
                        !e.target.checked,
                        closed ? [{ open: "10:00", close: "20:00" }] : windows,
                      )
                    }
                  />
                  <span className="adm-toggle-track" aria-hidden="true">
                    <span className="adm-toggle-thumb" />
                  </span>
                </label>

                {closed ? (
                  <span className="cat-hours-closed-label" style={{ gridColumn: "3 / span 3" }}>
                    Closed
                  </span>
                ) : (
                  <div className="cat-windows-list" style={{ gridColumn: "3 / span 3" }}>
                    {windows.map((w, i) => (
                      <div key={i} className="cat-window-row">
                        <input
                          type="time"
                          className="adm-input"
                          value={w.open}
                          onChange={(e) => updateWindow(key, i, { open: e.target.value })}
                          title={to12Hour(w.open)}
                        />
                        <span>to</span>
                        <input
                          type="time"
                          className="adm-input"
                          value={w.close}
                          onChange={(e) => updateWindow(key, i, { close: e.target.value })}
                          title={to12Hour(w.close)}
                        />
                        {windows.length > 1 && (
                          <button
                            type="button"
                            className="cat-window-remove"
                            aria-label="Remove this window"
                            onClick={() => removeWindow(key, i)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" className="cat-add-window" onClick={() => addWindow(key)}>
                      + Add a window
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="adm-view-link"
            style={{
              marginTop: 10,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            onClick={copyToOtherStore}
          >
            Copy to {otherStoreName}
          </button>
        </div>

        <div className="adm-settings-section">
          <h3 className="adm-group-label">Days off (both locations unless set)</h3>
          <div className="cat-days-off-list">
            {values.daysOff.map((d, i) => (
              <div key={`${d.date}-${d.store}-${i}`} className="cat-day-off-row">
                <span>
                  {d.date} ·{" "}
                  {d.store === "all"
                    ? "Both locations"
                    : (CATERING_STORES.find((s) => s.id === d.store)?.name ?? d.store)}
                </span>
                <button type="button" onClick={() => removeDayOff(i)} aria-label="Remove day off">
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="cat-add-day-off">
            <input
              type="date"
              className="adm-input"
              value={newDayOffDate}
              onChange={(e) => setNewDayOffDate(e.target.value)}
              style={{ maxWidth: 170 }}
            />
            <select
              className="adm-input"
              value={newDayOffStore}
              onChange={(e) => setNewDayOffStore(e.target.value as "all" | CateringStoreId)}
              style={{ maxWidth: 170 }}
            >
              {STORE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <button type="button" className="cat-add-window" onClick={addDayOff}>
              + Add a day off
            </button>
          </div>
        </div>

        <div className="adm-settings-section">
          <h3 className="adm-group-label">Rules</h3>
          <div className="adm-grid-2">
            <div className="adm-field">
              <label htmlFor="leadHours" className="adm-label">
                Notice (hours)
              </label>
              <input
                id="leadHours"
                name="leadHours"
                type="number"
                min={1}
                className="adm-input"
                value={values.leadHours}
                onChange={(e) => setField("leadHours", e.target.value)}
              />
            </div>
            <div className="adm-field">
              <label htmlFor="bigLeadHours" className="adm-label">
                Notice for {values.bigHeadcount}+ people
              </label>
              <input
                id="bigLeadHours"
                name="bigLeadHours"
                type="number"
                min={1}
                className="adm-input"
                value={values.bigLeadHours}
                onChange={(e) => setField("bigLeadHours", e.target.value)}
              />
            </div>
            <div className="adm-field">
              <label htmlFor="bigHeadcount" className="adm-label">
                Big-order headcount
              </label>
              <input
                id="bigHeadcount"
                name="bigHeadcount"
                type="number"
                min={1}
                className="adm-input"
                value={values.bigHeadcount}
                onChange={(e) => setField("bigHeadcount", e.target.value)}
              />
            </div>
            <div className="adm-field">
              <label htmlFor="replyHours" className="adm-label">
                Reply within (hours)
              </label>
              <input
                id="replyHours"
                name="replyHours"
                type="number"
                min={1}
                className="adm-input"
                value={values.replyHours}
                onChange={(e) => setField("replyHours", e.target.value)}
              />
            </div>
            <div className="adm-field">
              <label htmlFor="rangeMiles" className="adm-label">
                Delivery radius (miles)
              </label>
              <input
                id="rangeMiles"
                name="rangeMiles"
                type="number"
                min={1}
                max={50}
                className="adm-input"
                value={values.rangeMiles}
                onChange={(e) => setField("rangeMiles", e.target.value)}
              />
            </div>
            <div className="adm-field">
              <label htmlFor="deliveryFeeDollars" className="adm-label">
                Delivery fee (USD)
              </label>
              <div className="adm-dollar-field">
                <input
                  id="deliveryFeeDollars"
                  name="deliveryFeeDollars"
                  type="number"
                  step="0.01"
                  min="0"
                  className="adm-input"
                  value={values.deliveryFeeDollars}
                  onChange={(e) => setField("deliveryFeeDollars", e.target.value)}
                />
              </div>
            </div>
            <div className="adm-field is-full">
              <label htmlFor="ownerEmail" className="adm-label">
                Owner email (gets every request)
              </label>
              <input
                id="ownerEmail"
                name="ownerEmail"
                type="email"
                className="adm-input"
                value={values.ownerEmail}
                onChange={(e) => setField("ownerEmail", e.target.value)}
              />
            </div>
          </div>

          <label className="adm-toggle-row" style={{ marginTop: 16 }}>
            <span className="adm-toggle">
              {/* `key` keyed to the last successful save: React 19's
               * `<form action={fn}>` calls `requestFormReset` on *every*
               * submit, before the action even runs (`startHostTransition`
               * in react-dom) — a native `form.reset()`-style call meant
               * for uncontrolled fields. For a genuinely controlled
               * checkbox like this one, that native reset silently flips
               * the DOM's own `checked` property back to whatever it was
               * before the click, without React knowing — and because
               * React's own bookkeeping still says `checked` is exactly
               * what it was ("true", unchanged since the click that
               * triggered this submit), its diffing bails out and never
               * rewrites the DOM property on the next render, leaving the
               * native reset in place. The failure is silent and timing-
               * dependent (it doesn't happen on every save), which is what
               * made the owner's "Take catering requests online" toggle
               * occasionally look like it reverted itself right after
               * saving. Changing `key` on a successful save forces React
               * to throw the old DOM node away and mount a fresh one with
               * the correct `checked` value baked in, which a diff can't
               * bail out of. */}
              <input
                key={state?.savedAt ?? "unsaved"}
                id="orderingOn"
                name="orderingOn"
                type="checkbox"
                checked={values.orderingOn}
                onChange={(e) => setField("orderingOn", e.target.checked)}
                className="adm-toggle-input"
              />
              <span className="adm-toggle-track" aria-hidden="true">
                <span className="adm-toggle-thumb" />
              </span>
            </span>
            Take catering requests online
          </label>
          <p className="adm-help">
            Off: the catering page and every catering button send people to the contact page
            instead.
          </p>
        </div>
      </form>

      <div className={`adm-savebar${dirty ? " is-visible" : ""}`}>
        <span className="adm-savebar-count">Catering: Unsaved changes</span>
        <button type="button" className="adm-savebar-discard" onClick={discard}>
          Discard
        </button>
        <button
          type="submit"
          form="catering-settings-form"
          className="adm-savebar-save"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
