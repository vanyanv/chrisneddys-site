import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getDb } from "@/db/client";
import { locations } from "@/data/locations";
import { getCheckForNight, type Check } from "@/lib/closing/checks";
import { closingNow } from "@/lib/closing/clock";
import { resolveCrew } from "@/lib/closing/crew";
import {
  CREW_COOKIE,
  SIGNED_OUT_COOKIE,
  LANG_COOKIE,
  formatTimeLA,
  nightLabel,
  parseLang,
  pick,
  sectionLabel,
  type Lang,
} from "@/lib/closing/crewText";
import { listItems } from "@/lib/closing/items";
import { businessDate, closingWindow, windowState } from "@/lib/closing/night";
import { getStoreByToken } from "@/lib/closing/store";
import { Checklist, type ChecklistItem } from "./Checklist";
import { CodeStep } from "./CodeStep";
import { Countdown } from "./Countdown";
import { LangButton } from "./LangButton";
import { OpenBanner } from "./OpenBanner";
import { WhoBar } from "./WhoBar";

export const dynamic = "force-dynamic";

const LOCK = (
  <svg
    width="28"
    height="28"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

function Receipt({ check, lang }: { check: Check; lang: Lang }) {
  const done = check.items.filter((i) => i.done).length;
  const missed = check.items.filter((i) => !i.done);
  const readings = check.items.filter((i) => i.kind === "temp" && i.value);
  const name = (i: Check["items"][number]) => (lang === "es" && i.labelEs ? i.labelEs : i.label);
  return (
    <>
      <div className="cl-receipt">
        <div className="cl-stamp">{pick(lang, "Sent", "Enviada")}</div>
        <div>
          {pick(
            lang,
            "Tonight's check is in. It can't be sent again or changed.",
            "La lista de hoy ya se envió. No se puede enviar otra vez ni cambiar.",
          )}
        </div>
        <dl>
          <dt>{pick(lang, "By", "Por")}</dt>
          <dd>{check.crewName}</dd>
          <dt>{pick(lang, "At", "Hora")}</dt>
          <dd>{formatTimeLA(check.submittedAt)}</dd>
          <dt>{pick(lang, "Done", "Hecho")}</dt>
          <dd>
            {done}
            {pick(lang, " of ", " de ")}
            {check.items.length}
          </dd>
        </dl>
        {readings.length > 0 ? (
          <div className="cl-missed">
            <span className="cl-label">{pick(lang, "Temperatures", "Temperaturas")}</span>
            <ul>
              {readings.map((i) => (
                <li key={i.id}>
                  {name(i)}: {i.value}°F
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {missed.length > 0 ? (
          <div className="cl-missed">
            <span className="cl-label cl-red">{pick(lang, "Not done", "No hecho")}</span>
            <ul>
              {missed.map((i) => (
                <li key={i.id}>{name(i)}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      <p className="cl-muted">
        {pick(
          lang,
          "Anyone who opens the link tonight sees this screen.",
          "Cualquiera que abra el enlace esta noche ve esta pantalla.",
        )}
      </p>
    </>
  );
}

export default async function ClosePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const db = await getDb();
  const store = await getStoreByToken(db, token);
  const loc = store ? locations.find((l) => l.id === store.store) : undefined;
  if (!store || !loc) notFound();

  const jar = await cookies();
  const lang = parseLang(jar.get(LANG_COOKIE)?.value);
  const now = closingNow(sp);
  const date = businessDate(now);
  const window = closingWindow(loc, date, {
    opensBeforeMin: store.opensBeforeMin,
    graceMin: store.graceMin,
  });
  const state = window ? windowState(now, window) : "after";
  const check = await getCheckForNight(db, store.store, date);

  const head = (
    <>
      <div className="cl-storeline">
        <h1 className="cl-h1">{loc.name}</h1>
        <LangButton lang={lang} />
      </div>
      <div className="cl-sub2">
        {pick(lang, "Closing check", "Lista de cierre")} · {nightLabel(date, lang)}
      </div>
    </>
  );

  if (window && state === "before") {
    const opens = formatTimeLA(window.opensAt);
    const closes = formatTimeLA(window.closesAt);
    return (
      <>
        {head}
        <div className="cl-lock">
          <div className="cl-icon">{LOCK}</div>
          <div className="cl-label cl-muted">{pick(lang, "Opens in", "Se abre en")}</div>
          <Countdown opensAtMs={window.opensAt.getTime()} serverNowMs={now.getTime()} />
          <div>
            {pick(
              lang,
              `Opens at ${opens}, ${store.opensBeforeMin} minutes before the ${closes} close.`,
              `Se abre a las ${opens}, ${store.opensBeforeMin} minutos antes de cerrar a las ${closes}.`,
            )}
          </div>
          <div className="cl-muted">
            {pick(
              lang,
              "Leave this page open. It unlocks on its own.",
              "Deja esta página abierta. Se desbloquea sola.",
            )}
          </div>
        </div>
      </>
    );
  }

  if (check) {
    return (
      <>
        {head}
        <Receipt check={check} lang={lang} />
      </>
    );
  }

  if (!window || state === "after") {
    return (
      <>
        {head}
        <div className="cl-lock">
          <div className="cl-icon cl-icon-red">{LOCK}</div>
          <div className="cl-big cl-big-sm">{pick(lang, "Closed", "Cerrada")}</div>
          <div>
            {window
              ? pick(
                  lang,
                  `Tonight's check closed at ${formatTimeLA(window.endsAt)}. Nothing was sent, so this night shows as missed.`,
                  `La lista de hoy cerró a las ${formatTimeLA(window.endsAt)}. No se envió, así que la noche sale como no hecha.`,
                )
              : pick(lang, "There's no closing check tonight.", "Hoy no hay lista de cierre.")}
          </div>
        </div>
      </>
    );
  }

  const banner = (
    <OpenBanner
      closesAtMs={window.closesAt.getTime()}
      endsAtMs={window.endsAt.getTime()}
      serverNowMs={now.getTime()}
      lang={lang}
    />
  );

  const crew = await resolveCrew(db, store.store, jar.get(CREW_COOKIE)?.value);
  if (!crew) {
    return (
      <>
        {head}
        {banner}
        <CodeStep token={token} lang={lang} signedOut={jar.get(SIGNED_OUT_COOKIE)?.value === "1"} />
      </>
    );
  }

  const items: ChecklistItem[] = (await listItems(db, store.store)).map((i) => {
    const es = lang === "es" && i.labelEs;
    return {
      id: i.id,
      section: sectionLabel(i.section, lang),
      kind: i.kind,
      maxValue: i.maxValue,
      label: es ? i.labelEs! : i.label,
      detail: es ? (i.detailEs ?? null) : i.detail,
    };
  });
  const at = typeof sp.at === "string" ? sp.at : undefined;

  return (
    <>
      {head}
      {banner}
      <WhoBar name={crew.name} lang={lang} />
      <Checklist token={token} date={date} at={at} lang={lang} items={items} />
    </>
  );
}
