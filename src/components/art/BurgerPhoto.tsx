import type { ReactElement } from "react";

type Tone = "warm" | "bright" | "studio" | "cream";
type Angle = "hero" | "card";

const palettes: Record<Tone, Record<string, string>> = {
  warm: {
    bg1: "#1f1612", bg2: "#3d2418", bun: "#D49646", crust: "#8a4e1f",
    patty: "#3d1d10", char: "#1a0a05", cheese: "#F2B340", lettuce: "#5a8a3a",
    sauce: "#C12B1E", glow: "#ff8a3a",
  },
  bright: {
    bg1: "#FFE9A0", bg2: "#F5B82E", bun: "#D49646", crust: "#8a4e1f",
    patty: "#3d1d10", char: "#1a0a05", cheese: "#F2B340", lettuce: "#5a8a3a",
    sauce: "#C12B1E", glow: "#fff",
  },
  studio: {
    bg1: "#2a1410", bg2: "#0a0504", bun: "#E0A857", crust: "#9a5a25",
    patty: "#4a2515", char: "#1a0a05", cheese: "#FFC34A", lettuce: "#7aaf48",
    sauce: "#E63027", glow: "#ffb84a",
  },
  cream: {
    bg1: "#FFF8DE", bg2: "#FFE9A0", bun: "#D49646", crust: "#8a4e1f",
    patty: "#3d1d10", char: "#1a0a05", cheese: "#F2B340", lettuce: "#5a8a3a",
    sauce: "#C12B1E", glow: "#fff",
  },
};

// Deterministic sesame-seed coordinates (16 seeds)
const SEEDS: Array<[number, number]> = [
  [-130, -145], [-95, -160], [-55, -175], [-15, -180], [35, -175], [80, -165],
  [120, -150], [155, -130], [-150, -110], [-90, -125], [-25, -135], [40, -130],
  [100, -115], [155, -95],
];

export function BurgerPhoto({
  tone = "warm",
  angle = "hero",
  label,
  idSeed,
}: {
  tone?: Tone;
  angle?: Angle;
  label?: string;
  idSeed?: string | number;
}): ReactElement {
  const id = "bp-" + (idSeed ?? `${tone}-${angle}`);
  const p = palettes[tone];
  const isHero = angle === "hero";

  return (
    <svg
      viewBox="0 0 800 800"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={id + "bg"} cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor={p.bg1} />
          <stop offset="100%" stopColor={p.bg2} />
        </radialGradient>
        <radialGradient id={id + "glow"} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={p.glow} stopOpacity="0.5" />
          <stop offset="60%" stopColor={p.glow} stopOpacity="0.1" />
          <stop offset="100%" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id + "bunTop"} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={p.bun} />
          <stop offset="100%" stopColor={p.crust} />
        </linearGradient>
        <filter id={id + "soft"}>
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
        <filter id={id + "glow2"}>
          <feGaussianBlur stdDeviation="40" />
        </filter>
      </defs>
      <rect width="800" height="800" fill={`url(#${id}bg)`} />
      <ellipse cx="400" cy="450" rx="380" ry="180" fill={`url(#${id}glow)`} filter={`url(#${id}glow2)`} />

      <g transform={`translate(400 ${isHero ? 420 : 380})`} filter={`url(#${id}soft)`}>
        <ellipse cx="20" cy="230" rx="280" ry="22" fill="#000" opacity="0.55" />
        <ellipse cx="20" cy="230" rx="240" ry="14" fill="#000" opacity="0.4" />

        <path
          d="M -240 130 Q -240 200 -190 215 L 200 215 Q 250 200 250 130 Q 230 110 0 110 Q -230 110 -240 130 Z"
          fill={p.bun}
        />
        <path d="M -240 130 Q 0 145 250 130" fill="none" stroke={p.crust} strokeWidth="3" opacity="0.6" />

        <path
          d="M -250 95 Q -200 70 -160 95 Q -120 70 -80 95 Q -40 70 0 95 Q 40 70 80 95 Q 120 70 160 95 Q 200 70 250 95 L 260 130 L -260 130 Z"
          fill={p.lettuce}
        />
        <path
          d="M -240 100 Q -180 85 -100 100 Q 0 85 100 100 Q 200 85 240 100"
          fill="none"
          stroke="#3a6020"
          strokeWidth="2"
          opacity="0.6"
        />

        <path
          d="M -245 50 L -260 105 L -180 100 L -200 130 L -120 110 L -140 140 L -50 110 L -60 145 L 40 105 L 50 140 L 130 105 L 130 145 L 200 100 L 220 135 L 250 50 Z"
          fill={p.cheese}
        />
        <path d="M -245 50 Q 0 70 250 50" fill="none" stroke="#d99232" strokeWidth="2" opacity="0.5" />

        <path
          d="M -235 -10 Q -250 0 -250 30 Q -250 55 -200 65 L 200 65 Q 250 55 250 30 Q 250 0 235 -10 Q 200 -25 0 -25 Q -200 -25 -235 -10 Z"
          fill={p.patty}
        />
        <path d="M -250 30 Q 0 45 250 30" fill="none" stroke={p.char} strokeWidth="3" opacity="0.7" />
        <ellipse cx="-100" cy="0" rx="40" ry="4" fill={p.char} opacity="0.5" />
        <ellipse cx="80" cy="-5" rx="50" ry="4" fill={p.char} opacity="0.5" />

        <path
          d="M -210 -25 L -220 -10 L -180 -15 L -185 0 L -150 -10 L -160 5 Z"
          fill={p.cheese}
          opacity="0.8"
        />

        <path
          d="M -100 -30 Q -90 -10 -80 -25 Q -60 -5 -40 -20 Q 0 -5 40 -25 Q 60 -10 80 -25 Q 100 -5 110 -20"
          fill="none"
          stroke={p.sauce}
          strokeWidth="4"
          opacity="0.95"
        />

        <path
          d="M -230 -120 Q -180 -190 0 -190 Q 180 -190 230 -120 L 240 -30 Q 235 -45 225 -45 L -225 -45 Q -235 -45 -240 -30 Z"
          fill={`url(#${id}bunTop)`}
        />
        {SEEDS.map(([x, y], i) => (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx="5"
            ry="3"
            fill="#FFF2C9"
            stroke="#a07030"
            strokeWidth="0.8"
            transform={`rotate(${i * 15} ${x} ${y})`}
          />
        ))}
        <path
          d="M -180 -175 Q -110 -195 0 -195 Q 100 -195 160 -175"
          fill="none"
          stroke="#fff"
          strokeWidth="6"
          opacity="0.35"
          strokeLinecap="round"
        />
        <ellipse cx="-100" cy="-150" rx="80" ry="20" fill="#fff" opacity="0.1" />

        <path
          d="M 50 -80 Q 60 -65 80 -75 Q 100 -55 120 -75"
          fill="none"
          stroke={p.sauce}
          strokeWidth="3"
          opacity="0.7"
        />
      </g>

      {isHero && (
        <g opacity="0.25">
          <path
            d="M 280 100 Q 290 70 280 50 Q 270 30 285 10"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M 400 80 Q 410 50 400 30 Q 390 10 405 -10"
            fill="none"
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path d="M 520 100 Q 530 70 520 50" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}

      {label && (
        <g transform="translate(28 762)">
          <text fill="#fff" fontFamily="ui-monospace, monospace" fontSize="10" letterSpacing="2" opacity="0.5">
            {String(label).toUpperCase()}
          </text>
        </g>
      )}
    </svg>
  );
}
