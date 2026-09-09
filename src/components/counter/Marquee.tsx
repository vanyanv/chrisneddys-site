const WORDS = [
  "burgers ★",
  "shakes ★",
  "chris-cut fries ★",
  "smashed daily ★",
  "martin’s rolls ★",
  "since 2020 ★",
];

/** Duplicated once so the -50% translate loops seamlessly. */
export function Marquee() {
  return (
    <div className="cne-mq" aria-hidden="true">
      <div className="cne-mq-track">
        {[...WORDS, ...WORDS].map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
    </div>
  );
}
