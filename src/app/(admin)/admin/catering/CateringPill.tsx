/** The top-bar pill on every catering admin page: "CATERING: ON" / "CATERING:
 * OFF", from `catering_settings.orderingOn`. It replaces the shop's "STORE:
 * OPEN/CLOSED" pill there — catering and the shop are switched on
 * separately, so this page family never reads shop state. Same markup and
 * classes as the shop pill (`.rack-store-pill`, `.is-closed` for the off
 * colour). */
export function CateringPill({ on }: { on: boolean }) {
  return (
    <span className={`rack-store-pill rack-mono ${on ? "" : "is-closed"}`}>
      <i></i>Catering: {on ? "On" : "Off"}
    </span>
  );
}
