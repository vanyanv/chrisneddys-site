import { Monster } from "@/components/mascots/Monster";
import { MONSTER_COLORS, MONSTER_INK } from "@/components/mascots/monsterColors";

/**
 * "The wrong door" (idea 26) — the numbered staff door from the mural room,
 * ported for the 404: an ink door, a blank lime plate where a room number
 * would go, and a scrawl of numbers on the door face. A lime monster peeks
 * over the top, its lower third hidden behind the door.
 *
 * Shared by both `not-found.tsx` pages — the standalone root one (which has
 * no shared layout, so no shared CSS file to add to) and the `(site)` one —
 * so the two read as the same page. The door's numbers are a pure function of
 * a fixed seed, so server and client render identical markup: no
 * `Math.random`, no hydration mismatch.
 *
 * Door is 120x180 on desktop, 96x144 on phones — a fixed 2:3 box either way,
 * so one `viewBox` scales cleanly to both without distorting the numbers.
 */
const DOOR_W = 120;
const DOOR_H = 180;
const NUMBER_COUNT = 12;
const DIGITS = "8952183140567236891524730";

function doorNumbers(seed: number) {
  let k = seed;
  const rnd = () => (k = (k * 9301 + 49297) % 233280) / 233280;
  const digit = () => DIGITS[Math.floor(rnd() * DIGITS.length)] ?? "0";
  const items: { key: number; d: string; x: number; y: number; r: number; size: number }[] = [];
  for (let i = 0; i < NUMBER_COUNT; i++) {
    const d = digit() + (rnd() > 0.55 ? digit() : "");
    items.push({
      key: i,
      d,
      x: Math.round(10 + rnd() * (DOOR_W - 24)),
      y: Math.round(18 + rnd() * (DOOR_H - 28)),
      r: Math.round(rnd() * 30 - 15),
      size: 10 + Math.round(rnd() * 4),
    });
  }
  return items;
}

const NUMBERS = doorNumbers(7);
const MONSTER_SIZE = 64;
// Lower third of the monster hidden behind the door: the door's top edge
// sits this far below the monster's own top.
const MONSTER_OVERLAP = Math.round(MONSTER_SIZE / 3);
const WRAP_H = DOOR_H + MONSTER_SIZE - MONSTER_OVERLAP;
const WRAP_H_PHONE = DOOR_H * 0.8 + MONSTER_SIZE - MONSTER_OVERLAP;

export function StaffDoor() {
  return (
    <div className="rnf-door-wrap" aria-hidden="true">
      <style>{`
        .rnf-door-wrap { position: relative; margin: 0 auto 22px; width: ${DOOR_W}px; height: ${WRAP_H}px; }
        .rnf-door-mon { position: absolute; left: 50%; top: 0; transform: translateX(-50%); z-index: 1; }
        .rnf-door {
          position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); z-index: 2;
          width: ${DOOR_W}px; height: ${DOOR_H}px; background: ${MONSTER_INK}; overflow: hidden;
        }
        .rnf-door-plate {
          position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
          width: 34px; height: 18px; background: ${MONSTER_COLORS.lime.body};
        }
        @media (max-width: 640px) {
          .rnf-door-wrap { width: ${Math.round(DOOR_W * 0.8)}px; height: ${WRAP_H_PHONE}px; }
          .rnf-door { width: ${Math.round(DOOR_W * 0.8)}px; height: ${Math.round(DOOR_H * 0.8)}px; }
        }
      `}</style>
      <div className="rnf-door-mon">
        <Monster
          species="classic"
          bodyColor={MONSTER_COLORS.lime.body}
          irisColor={MONSTER_COLORS.lime.iris}
          size={MONSTER_SIZE}
        />
      </div>
      <div className="rnf-door">
        <div className="rnf-door-plate" />
        <svg
          viewBox={`0 0 ${DOOR_W} ${DOOR_H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          focusable="false"
        >
          {NUMBERS.map((n) => (
            <text
              key={n.key}
              x={n.x}
              y={n.y}
              transform={`rotate(${n.r} ${n.x} ${n.y})`}
              fontFamily="var(--font-mono-jb), ui-monospace, monospace"
              fontSize={n.size}
              fill={MONSTER_COLORS.lime.body}
              opacity={0.35}
            >
              {n.d}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
