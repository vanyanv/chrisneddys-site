import Link from "next/link";
import { getDb } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { sectionLabel } from "@/lib/closing/crewText";
import { listItems } from "@/lib/closing/items";
import { CLOSING_STORE, itemStatus, tempTag } from "@/lib/closing/ownerText";
import { getOrCreateStore } from "@/lib/closing/store";
import { restoreItemAction } from "../actions";
import { ClosingShell } from "../ClosingShell";
import { ItemSheet } from "./ItemSheet";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ClosingItemsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireOwner();
  const sp = await searchParams;
  const db = await getDb();
  await getOrCreateStore(db, CLOSING_STORE);
  const all = await listItems(db, CLOSING_STORE, { includeRetired: true });
  const live = all.filter((i) => !i.retiredAt);
  const retired = all.filter((i) => i.retiredAt);
  const areas = [...new Set(live.map((i) => i.section))];
  // A section whose items are all retired can still be picked again.
  for (const i of all) if (!areas.includes(i.section)) areas.push(i.section);

  const edit = one(sp.edit);
  const editing = edit && edit !== "new" ? (live.find((i) => i.id === edit) ?? null) : null;
  const sheetOpen = edit === "new" || editing !== null;
  const status = itemStatus(one(sp.done));

  return (
    <ClosingShell session={session} active="items">
      <p className="clo-muted">
        Tap an item to change it. Changes show on the crew page right away. The starter list was
        written by Claude, Spanish included. Replace it with your own wording.
      </p>
      {status ? (
        <p className="clo-status" role="status">
          {status}
        </p>
      ) : null}
      <Link href="/admin/closing/items/?edit=new" className="clo-btn is-primary is-wide">
        + Add item
      </Link>

      {areas
        .filter((a) => live.some((i) => i.section === a))
        .map((area) => {
          const es = sectionLabel(area, "es");
          return (
            <section key={area} className="clo-area">
              <h2 className="clo-h2">
                {area}
                {es !== area ? <span className="clo-muted"> · {es}</span> : null}
              </h2>
              <ul className="clo-rows">
                {live
                  .filter((i) => i.section === area)
                  .map((i) => {
                    const tag = tempTag(i);
                    return (
                      <li key={i.id}>
                        <Link href={`/admin/closing/items/?edit=${i.id}`} className="clo-row">
                          <span className="clo-row-text">
                            <span className="clo-row-en">
                              {i.label}
                              {tag ? <span className="clo-tag">{tag}</span> : null}
                            </span>
                            <span className="clo-row-es" lang="es">
                              {i.labelEs ?? <i>No Spanish yet, shows in English</i>}
                            </span>
                          </span>
                          <span className="clo-chev" aria-hidden="true">
                            ›
                          </span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>
          );
        })}
      {live.length === 0 ? <p className="clo-muted">No items. Add one to start the list.</p> : null}

      {retired.length > 0 ? (
        <section className="clo-area">
          <h2 className="clo-h2">Retired</h2>
          <p className="clo-muted">Hidden from the crew. Still shown on old nights.</p>
          <ul className="clo-rows">
            {retired.map((i) => (
              <li key={i.id} className="clo-row is-static">
                <span className="clo-row-text">
                  <span className="clo-row-en clo-muted">{i.label}</span>
                </span>
                <form action={restoreItemAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <button type="submit" className="clo-btn">
                    Restore
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheetOpen ? (
        <ItemSheet
          key={editing?.id ?? "new"}
          item={
            editing && {
              id: editing.id,
              section: editing.section,
              label: editing.label,
              detail: editing.detail,
              labelEs: editing.labelEs,
              detailEs: editing.detailEs,
              kind: editing.kind,
              maxValue: editing.maxValue,
            }
          }
          areas={areas}
        />
      ) : null}
    </ClosingShell>
  );
}
