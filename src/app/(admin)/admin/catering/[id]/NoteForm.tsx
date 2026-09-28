"use client";

/** The order detail page's private owner note — appends to `ownerNote`
 * (`addOwnerNote`, via `service.ts`'s `addNote`), never shown to the
 * customer. */
import { useActionState, useEffect, useRef } from "react";
import { addNoteAction, type CateringActionState } from "./actions";

const initial: CateringActionState = {};

export function NoteForm({
  orderId,
  existingNote,
}: {
  orderId: string;
  existingNote: string | null;
}) {
  const [state, formAction, pending] = useActionState(addNoteAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <div className="cat-note-form">
      <p className="ord-action-heading">Notes (private)</p>
      {existingNote && (
        <div className="cat-note-list">
          {existingNote.split("\n").map((line, i) => (
            <p key={i} className="cat-note-item">
              {line}
            </p>
          ))}
        </div>
      )}
      {state?.error && (
        <p className="adm-error" role="alert">
          {state.error}
        </p>
      )}
      <form ref={formRef} action={formAction}>
        <input type="hidden" name="orderId" value={orderId} />
        <textarea name="text" className="adm-textarea" rows={2} placeholder="Add a note…" />
        <button type="submit" className="rack-btn" style={{ marginTop: 8 }} disabled={pending}>
          {pending ? "Saving…" : "Add note"}
        </button>
      </form>
    </div>
  );
}
