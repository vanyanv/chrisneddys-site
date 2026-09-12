import type { ReactElement } from "react";

export type FoodVariant = "double" | "fries" | "tots" | "shake" | "parking" | "neon";
export type FoodTone = "red" | "cream" | "charcoal" | "bright" | "warm" | "studio";

const palettes: Record<FoodTone, Record<string, string>> = {
  red: {
    bg1: "#B2241A",
    bg2: "#8F1A12",
    bun: "#C98742",
    meat: "#3E1A0E",
    cheese: "#E8A84A",
    sauce: "#D83B2A",
    ink: "#F5ECD6",
  },
  cream: {
    bg1: "#E8DBB8",
    bg2: "#D4C393",
    bun: "#B87838",
    meat: "#3E1A0E",
    cheese: "#D99232",
    sauce: "#C1261C",
    ink: "#1a1713",
  },
  charcoal: {
    bg1: "#2a2623",
    bg2: "#141210",
    bun: "#A86A2E",
    meat: "#2E130A",
    cheese: "#D99232",
    sauce: "#D83B2A",
    ink: "#F5ECD6",
  },
  bright: {
    bg1: "#F7EBC8",
    bg2: "#E8D9A8",
    bun: "#C98742",
    meat: "#3E1A0E",
    cheese: "#E8A84A",
    sauce: "#D83B2A",
    ink: "#1a1713",
  },
  warm: {
    bg1: "#3d2418",
    bg2: "#1f1612",
    bun: "#C98742",
    meat: "#3E1A0E",
    cheese: "#E8A84A",
    sauce: "#D83B2A",
    ink: "#F5ECD6",
  },
  studio: {
    bg1: "#2a1410",
    bg2: "#0a0504",
    bun: "#E0A857",
    meat: "#3E1A0E",
    cheese: "#FFC34A",
    sauce: "#E63027",
    ink: "#F5ECD6",
  },
};

export function FoodShot({
  label,
  variant = "double",
  tone = "red",
  idSeed,
}: {
  label?: string;
  variant?: FoodVariant;
  tone?: FoodTone;
  idSeed?: string | number;
}): ReactElement {
  const p = palettes[tone];
  const id = "fs-" + (idSeed ?? `${variant}-${tone}`);
  return (
    <svg
      viewBox="0 0 600 480"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={id + "bg"} cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor={p.bg1} />
          <stop offset="100%" stopColor={p.bg2} />
        </radialGradient>
        <pattern id={id + "dots"} width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".6" fill="#000" opacity="0.06" />
        </pattern>
        <filter id={id + "blur"}>
          <feGaussianBlur stdDeviation="0.6" />
        </filter>
        <radialGradient id={id + "vig"} cx="50%" cy="50%" r="70%">
          <stop offset="60%" stopColor="transparent" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      <rect width="600" height="480" fill={`url(#${id}bg)`} />
      <rect width="600" height="480" fill={`url(#${id}dots)`} />
      <rect width="600" height="480" fill={`url(#${id}vig)`} />

      {variant === "double" && (
        <g transform="translate(300 260)" filter={`url(#${id}blur)`}>
          <ellipse cx="0" cy="135" rx="170" ry="14" fill="#000" opacity="0.35" />
          <path d="M -150 90 Q -150 130 -120 135 L 120 135 Q 150 130 150 90 Z" fill={p.bun} />
          <ellipse cx="0" cy="70" rx="155" ry="18" fill={p.meat} />
          <path d="M -150 50 L -160 80 L 160 80 L 150 50 Z" fill={p.cheese} />
          <ellipse cx="0" cy="30" rx="150" ry="18" fill={p.meat} />
          <path d="M -148 12 L -156 40 L 156 40 L 148 12 Z" fill={p.cheese} />
          <path
            d="M -80 10 Q -70 30 -60 10 Q -40 35 -20 15 Q 20 40 60 10 Q 80 30 95 15"
            fill="none"
            stroke={p.sauce}
            strokeWidth="3"
            opacity="0.85"
          />
          <path
            d="M -145 -40 Q -110 -95 0 -95 Q 110 -95 145 -40 L 150 10 Q 150 -5 145 -8 L -145 -8 Q -150 -5 -150 10 Z"
            fill={p.bun}
          />
          <ellipse cx="-60" cy="-50" rx="4" ry="3" fill="#5a3a1c" opacity="0.7" />
          <ellipse cx="-20" cy="-65" rx="4" ry="3" fill="#5a3a1c" opacity="0.7" />
          <ellipse cx="30" cy="-55" rx="4" ry="3" fill="#5a3a1c" opacity="0.7" />
          <ellipse cx="70" cy="-70" rx="4" ry="3" fill="#5a3a1c" opacity="0.7" />
          <ellipse cx="105" cy="-50" rx="4" ry="3" fill="#5a3a1c" opacity="0.7" />
          <path d="M -120 -85 Q -80 -92 0 -92" fill="none" stroke="#ffffff30" strokeWidth="3" />
        </g>
      )}

      {variant === "fries" && (
        <g transform="translate(300 250)">
          <ellipse cx="0" cy="155" rx="190" ry="16" fill="#000" opacity="0.3" />
          <path d="M -180 30 L -150 160 L 150 160 L 180 30 Z" fill="#8b2c1c" opacity="0.95" />
          {[-150, -110, -80, -45, -15, 20, 50, 85, 115, 155].map((x, i) => (
            <g
              key={i}
              transform={`translate(${x} ${-20 - (i % 3) * 15}) rotate(${((i % 5) - 2) * 8})`}
            >
              <rect x="-8" y="0" width="16" height="130" fill={p.cheese} rx="3" />
              <path d="M -8 10 L -8 130 M 8 10 L 8 130" stroke="#00000020" strokeWidth="1" />
              <path
                d="M -8 20 L 8 25 M -8 40 L 8 45 M -8 60 L 8 65 M -8 80 L 8 85 M -8 100 L 8 105"
                stroke="#ffffff30"
                strokeWidth="1"
              />
            </g>
          ))}
        </g>
      )}

      {variant === "shake" && (
        <g transform="translate(300 250)">
          <ellipse cx="0" cy="165" rx="100" ry="12" fill="#000" opacity="0.3" />
          <path d="M -80 -30 L -65 160 L 65 160 L 80 -30 Z" fill="#F8EBE6" />
          <path d="M -80 -30 L 80 -30 L 80 -20 L -80 -20 Z" fill="#FFFFFF" />
          <ellipse cx="0" cy="-30" rx="80" ry="14" fill={p.sauce} />
          <ellipse cx="0" cy="-36" rx="74" ry="10" fill="#E85B4B" />
          <ellipse cx="0" cy="-50" rx="40" ry="8" fill="#F8D4D0" />
          <rect x="-5" y="-90" width="10" height="60" fill={p.ink} opacity="0.9" />
          <text
            x="0"
            y="70"
            fill={p.ink}
            fontFamily="Oswald, sans-serif"
            fontWeight="700"
            fontSize="22"
            textAnchor="middle"
            letterSpacing="1"
          >
            CNE
          </text>
          <text
            x="0"
            y="95"
            fill={p.ink}
            fontFamily="Caveat, cursive"
            fontSize="18"
            textAnchor="middle"
          >
            shake co.
          </text>
        </g>
      )}

      {variant === "tots" && (
        <g transform="translate(300 260)">
          <ellipse cx="0" cy="135" rx="170" ry="14" fill="#000" opacity="0.3" />
          <path d="M -170 60 L -155 140 L 155 140 L 170 60 Z" fill="#2a2623" opacity="0.95" />
          {[0, 1, 2, 3, 4].map((row) =>
            [0, 1, 2, 3, 4, 5].map((col) => (
              <g
                key={`${row}-${col}`}
                transform={`translate(${-120 + col * 48 + (row % 2) * 20} ${80 + row * 18})`}
              >
                <rect x="-18" y="-14" width="36" height="26" rx="6" fill={p.cheese} />
                <rect x="-15" y="-11" width="30" height="6" fill="#ffffff30" />
                <circle cx="-8" cy="0" r="2" fill="#00000028" />
                <circle cx="6" cy="-3" r="2" fill="#00000028" />
                <circle cx="3" cy="6" r="2" fill="#00000028" />
              </g>
            )),
          )}
        </g>
      )}

      {variant === "parking" && (
        <g>
          <rect y="280" width="600" height="200" fill="#1a1713" opacity="0.6" />
          <rect y="275" width="600" height="5" fill={p.sauce} />
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={60 + i * 130}
              y="180"
              width="80"
              height="90"
              fill={p.cheese}
              opacity="0.3"
            />
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={50 + i * 110}
              y="360"
              width="3"
              height="60"
              fill={p.cheese}
              opacity="0.7"
            />
          ))}
          <rect x="180" y="240" width="240" height="100" fill={p.sauce} />
          <rect x="180" y="240" width="240" height="18" fill="#6a1208" />
          <text
            x="300"
            y="302"
            fill={p.ink}
            fontFamily="Oswald, sans-serif"
            fontWeight="700"
            fontSize="22"
            textAnchor="middle"
            letterSpacing="2"
          >
            CNE
          </text>
          <ellipse cx="300" cy="340" rx="220" ry="40" fill={p.sauce} opacity="0.25" />
        </g>
      )}

      {variant === "neon" && (
        <g>
          <rect x="100" y="100" width="400" height="180" fill="#0a0810" />
          <text
            x="300"
            y="180"
            fill={p.sauce}
            fontFamily="Oswald, sans-serif"
            fontWeight="700"
            fontSize="46"
            textAnchor="middle"
            letterSpacing="4"
            style={{ filter: `drop-shadow(0 0 16px ${p.sauce})` }}
          >
            CHRIS N
          </text>
          <text
            x="300"
            y="240"
            fill={p.cheese}
            fontFamily="Caveat, cursive"
            fontSize="58"
            textAnchor="middle"
            style={{ filter: `drop-shadow(0 0 12px ${p.cheese})` }}
          >
            Eddy&apos;s
          </text>
        </g>
      )}

      {label && (
        <g transform="translate(20 440)">
          <rect x="0" y="0" width="320" height="28" fill="#161411" opacity="0.7" />
          <text
            x="12"
            y="19"
            fill="#F5ECD6"
            fontFamily="ui-monospace, monospace"
            fontSize="11"
            letterSpacing="1.5"
          >
            {String(label).toUpperCase()}
          </text>
        </g>
      )}
    </svg>
  );
}
