"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { moveItemAction, retireItemAction, saveItemAction, type ItemFormState } from "../actions";

export type SheetItem = {
  id: string;
  section: string;
  label: string;
  detail: string | null;
  labelEs: string | null;
  detailEs: string | null;
  kind: "check" | "temp";
  maxValue: number | null;
};

const LIST = "/admin/closing/items/";
const initial: ItemFormState = {};

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="adm-field-error" role="alert">
      {message}
    </p>
  ) : null;
}

/**
 * The item editor. The server renders it open (`?edit=<id>` or `?edit=new`),
 * so it works as a plain page before any script runs; once hydrated it
 * becomes a modal bottom sheet and Esc / a tap outside goes back to the list.
 * The Type and Area extras are shown by CSS (`:has(:checked)`), not state.
 */
export function ItemSheet({ item, areas }: { item: SheetItem | null; areas: string[] }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveItemAction, initial);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    try {
      d.removeAttribute("open");
      d.showModal();
    } catch {
      d.setAttribute("open", "");
    }
  }, []);

  const v = state.values;
  const err = state.fieldErrors ?? {};
  const kind = (v?.kind ?? item?.kind ?? "check") as "check" | "temp";
  const section = v?.section ?? item?.section ?? areas[0] ?? "__new";
  const hasArea = areas.length > 0;
  const idPrefix = item ? `i-${item.id}` : "i-new";

  return (
    <dialog
      ref={ref}
      open
      className="clo-sheet"
      aria-labelledby="clo-sheet-title"
      onClose={() => router.replace(LIST)}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <form
        key={v ? JSON.stringify(v) : "fresh"}
        action={action}
        className="clo-sheet-form"
        noValidate
      >
        <div className="clo-grab" aria-hidden="true" />
        <h2 id="clo-sheet-title" className="clo-sheet-title">
          {item ? "Edit item" : "Add item"}
        </h2>
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        {state.error ? (
          <p className="adm-error" role="alert">
            {state.error}
          </p>
        ) : null}

        <div className="clo-field">
          <label htmlFor={`${idPrefix}-label`}>What the crew sees</label>
          <input
            id={`${idPrefix}-label`}
            name="label"
            className="clo-input"
            required
            autoFocus
            maxLength={120}
            placeholder="e.g. Shake machine cleaned"
            defaultValue={v?.label ?? item?.label ?? ""}
          />
          <FieldError message={err.label} />
        </div>
        <div className="clo-field">
          <label htmlFor={`${idPrefix}-detail`}>Extra line (optional)</label>
          <input
            id={`${idPrefix}-detail`}
            name="detail"
            className="clo-input"
            maxLength={160}
            placeholder="e.g. Kitchen and dining room"
            defaultValue={v?.detail ?? item?.detail ?? ""}
          />
          <FieldError message={err.detail} />
        </div>
        <div className="clo-field">
          <label htmlFor={`${idPrefix}-es`}>In Spanish (optional)</label>
          <input
            id={`${idPrefix}-es`}
            name="labelEs"
            lang="es"
            className="clo-input"
            maxLength={160}
            placeholder="e.g. Máquina de malteadas limpia"
            defaultValue={v?.labelEs ?? item?.labelEs ?? ""}
          />
          <span className="clo-hint">Left blank, Spanish-speaking crew see the English.</span>
          <FieldError message={err.labelEs} />
        </div>
        <div className="clo-field">
          <label htmlFor={`${idPrefix}-esd`}>Spanish extra line (optional)</label>
          <input
            id={`${idPrefix}-esd`}
            name="detailEs"
            lang="es"
            className="clo-input"
            maxLength={160}
            placeholder="e.g. Cocina y comedor"
            defaultValue={v?.detailEs ?? item?.detailEs ?? ""}
          />
          <FieldError message={err.detailEs} />
        </div>

        <div className="clo-field clo-field-area">
          <label htmlFor={`${idPrefix}-area`}>Area</label>
          <select
            id={`${idPrefix}-area`}
            name="section"
            className="clo-input"
            defaultValue={hasArea ? section : "__new"}
          >
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value="__new">+ New area…</option>
          </select>
          <input
            name="newSection"
            className="clo-input clo-newarea"
            aria-label="New area name"
            maxLength={40}
            placeholder="New area name, e.g. Drive-thru"
            defaultValue={v?.newSection ?? ""}
          />
          <FieldError message={err.section ?? err.newSection} />
        </div>

        <fieldset className="clo-field clo-field-type">
          <legend>Type</legend>
          <div className="clo-seg">
            <label>
              <input type="radio" name="kind" value="check" defaultChecked={kind === "check"} />
              <span>Tick box</span>
            </label>
            <label>
              <input type="radio" name="kind" value="temp" defaultChecked={kind === "temp"} />
              <span>Temperature</span>
            </label>
          </div>
          <div className="clo-temprow">
            <label htmlFor={`${idPrefix}-max`}>Warn above</label>
            <input
              id={`${idPrefix}-max`}
              name="maxValue"
              className="clo-input clo-maxinput"
              defaultValue={v?.maxValue ?? String(item?.maxValue ?? 41)}
            />
            <span>°F</span>
          </div>
          <FieldError message={err.maxValue} />
        </fieldset>

        {item ? (
          <div className="clo-acts">
            <button type="submit" form="clo-move-up" className="clo-btn">
              Move up
            </button>
            <button type="submit" form="clo-move-down" className="clo-btn">
              Move down
            </button>
          </div>
        ) : null}
        <div className="clo-acts">
          <Link href={LIST} replace className="clo-btn">
            Cancel
          </Link>
          <button type="submit" className="clo-btn is-primary" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
        {item ? (
          <button type="submit" form="clo-retire" className="clo-btn-link">
            Retire this item
          </button>
        ) : null}
      </form>

      {item ? (
        <>
          <form id="clo-move-up" action={moveItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="dir" value="up" />
          </form>
          <form id="clo-move-down" action={moveItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="dir" value="down" />
          </form>
          <form id="clo-retire" action={retireItemAction}>
            <input type="hidden" name="id" value={item.id} />
          </form>
        </>
      ) : null}
    </dialog>
  );
}
