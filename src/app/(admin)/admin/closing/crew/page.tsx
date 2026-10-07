import Link from "next/link";
import { getDb } from "@/db/client";
import { requireOwner } from "@/lib/auth";
import { listCrew } from "@/lib/closing/crew";
import { CLOSING_STORE, crewStatus } from "@/lib/closing/ownerText";
import { getOrCreateStore } from "@/lib/closing/store";
import { locations } from "@/data/locations";
import { absoluteUrl } from "@/lib/siteOrigin";
import { newCodeAction, rotateLinkAction, setActiveAction } from "../actions";
import { ClosingShell } from "../ClosingShell";
import { AddPersonForm } from "./AddPersonForm";
import { CopyLink } from "./CopyLink";
import { QrSign } from "./QrSign";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ClosingCrewPage({ searchParams }: { searchParams: Promise<SP> }) {
  const session = await requireOwner();
  const sp = await searchParams;
  const db = await getDb();
  const store = await getOrCreateStore(db, CLOSING_STORE);
  const crew = await listCrew(db, CLOSING_STORE);
  const storeName = locations.find((l) => l.id === CLOSING_STORE)?.name ?? CLOSING_STORE;
  const url = absoluteUrl(`/close/${store.linkToken}/`);
  const who = crew.find((c) => c.id === one(sp.who)) ?? null;
  const status = crewStatus(one(sp.done), who);
  const asking = one(sp.replace) === "1";

  return (
    <ClosingShell session={session} active="crew">
      {status ? (
        <p className="clo-status" role="status">
          {status}
        </p>
      ) : null}

      <div className="clo-signwrap">
        <section className="clo-stack">
          <QrSign url={url} storeName={storeName} />
          <Link href="/admin/closing/sign/" className="clo-btn is-primary is-wide">
            Print the sign
          </Link>
          <p className="clo-muted">
            Sized for a letter sheet. Post it in the back, not where customers stand.
          </p>
        </section>

        <div className="clo-stack">
          <section className="clo-card clo-stack" aria-labelledby="clo-where">
            <span className="rack-eyebrow" id="clo-where">
              Where the QR goes
            </span>
            <CopyLink url={url} />
            {asking ? (
              <div className="clo-confirm" role="group" aria-label="Replace the link">
                <p>Replace it? The printed sign stops working; print a new one.</p>
                <div className="clo-acts">
                  <form action={rotateLinkAction}>
                    <button type="submit" className="clo-btn is-danger is-wide">
                      Replace
                    </button>
                  </form>
                  <Link href="/admin/closing/crew/" replace className="clo-btn">
                    Keep it
                  </Link>
                </div>
              </div>
            ) : (
              <Link href="/admin/closing/crew/?replace=1" className="clo-btn">
                Replace link
              </Link>
            )}
            <p className="clo-muted">Only needed if a photo of the sign gets out.</p>
          </section>

          <section className="clo-card clo-stack" aria-labelledby="clo-crew">
            <span className="rack-eyebrow" id="clo-crew">
              Crew codes
            </span>
            {crew.length === 0 ? (
              <p className="clo-muted">Nobody yet. Add the first person below.</p>
            ) : (
              <ul className="clo-rows">
                {crew.map((c) => (
                  <li key={c.id} className="clo-row is-static is-crew">
                    <span className="clo-row-text">
                      <span className={c.active ? "clo-row-en" : "clo-row-en clo-muted"}>
                        {c.name}
                      </span>
                      {c.active ? (
                        <span className="clo-code rack-mono">{c.code}</span>
                      ) : (
                        <span className="clo-row-es">Turned off</span>
                      )}
                    </span>
                    <span className="clo-row-acts">
                      {c.active ? (
                        <>
                          <form action={newCodeAction}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" className="clo-btn">
                              New code
                            </button>
                          </form>
                          <form action={setActiveAction}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="active" value="off" />
                            <button type="submit" className="clo-btn">
                              Turn off
                            </button>
                          </form>
                        </>
                      ) : (
                        <form action={setActiveAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="active" value="on" />
                          <button type="submit" className="clo-btn">
                            Turn on
                          </button>
                        </form>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <AddPersonForm />
            <p className="clo-muted">
              Adding someone makes their code. Turn off or New code signs them out of their phone at
              once. Codes only show here, behind your sign-in.
            </p>
          </section>
        </div>
      </div>
    </ClosingShell>
  );
}
