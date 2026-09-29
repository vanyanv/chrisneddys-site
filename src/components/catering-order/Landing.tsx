"use client";

import Image from "next/image";
import { allItems, type MenuItem } from "@/data/menu";
import { FEATURED_OTTER_IDS } from "@/data/featured";
import { CATERING_HREF } from "@/data/catering";
import { itemPhotoAlt, formatPrice } from "@/lib/otter";

const TILES = (leadHours: number) => [
  { k: `${leadHours} h`, v: "notice" },
  { k: "10 mi", v: "delivery, $25" },
  { k: "24 h", v: "we confirm" },
  { k: "$0", v: "charged until we confirm" },
];

const STEPS = [
  { title: "Pick a time", text: "Pickup or delivery from Hollywood or Van Nuys." },
  { title: "Pick the food", text: "Every item, every topping, like ordering online." },
  { title: "We confirm", text: "Your card is only charged once we say yes." },
];

/** C1: the order page's own landing, before the wizard starts. */
export function Landing({ onStart, leadHours }: { onStart: () => void; leadHours: number }) {
  const food = FEATURED_OTTER_IDS.map((id) => allItems.find((i) => i.otterId === id))
    .filter((i): i is MenuItem => Boolean(i))
    .slice(0, 3);

  return (
    <div className="cor-landing">
      <section className="cor-hero" data-surface="catering-order-hero">
        <p className="cor-hero-k">Offices &middot; Shoots &middot; Parties</p>
        <h1>
          Sliders for
          <br /> <span className="y">the whole room.</span>
        </h1>
        <p className="cor-hero-lede">
          Order catering online from Hollywood or Van Nuys. Pick a time and we confirm within 24
          hours.
        </p>
        <button
          type="button"
          className="cor-btn is-primary cor-hero-cta"
          onClick={onStart}
          data-catering-order="start"
        >
          Start a catering order &rarr;
        </button>
        <a className="cor-hero-msg" href={CATERING_HREF} data-catering="">
          Questions? Message us
        </a>
      </section>

      <ul className="cor-tiles">
        {TILES(leadHours).map((t) => (
          <li key={t.k}>
            <span className="k">{t.k}</span>
            <span className="v">{t.v}</span>
          </li>
        ))}
      </ul>

      <section className="cor-food">
        <p className="cor-food-eyebrow">What the room orders</p>
        <h2>Same menu. Same prices.</h2>
        <ul>
          {food.map((it) => (
            <li key={it.id}>
              <span className="cor-food-img">
                {it.photo && (
                  <Image
                    src={`/menu/${it.photo}-thumb.webp`}
                    alt={itemPhotoAlt(it)}
                    width={56}
                    height={56}
                  />
                )}
              </span>
              <span className="cor-food-name">{it.name}</span>
              <span className="cor-food-price">{formatPrice(it.price)}</span>
              <span aria-hidden="true" className="cor-food-arrow">
                &rarr;
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="cor-how">
        <h2>How it works</h2>
        <ol>
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="n" aria-hidden="true">
                {i + 1}
              </span>
              <span>
                <b>{s.title}</b>
                <span>{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
