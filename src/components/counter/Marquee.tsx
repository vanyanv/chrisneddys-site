/* We sell sliders, not burgers, and the reel says "fries" rather than the
   prototype's "chris-cut fries" — the long form crowded the loop. */
const PHONE = [
  "sliders ★",
  "shakes ★",
  "fries ★",
  "smashed daily ★",
  "martin’s rolls ★",
  "since 2020 ★",
];

/** Desktop runs a shorter reel that ends on the three locations. */
const DESK = [
  "sliders ★",
  "shakes ★",
  "fries ★",
  "secret menu ★",
  "hollywood · glendale · van nuys ★",
];

/** Each list is duplicated once so the -50% translate loops seamlessly. */
export function Marquee() {
  return (
    <div className="cne-mq" aria-hidden="true">
      <div className="cne-mq-track cne-mq-phone">
        {[...PHONE, ...PHONE].map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="cne-mq-track cne-mq-desk">
        {[...DESK, ...DESK].map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
    </div>
  );
}
