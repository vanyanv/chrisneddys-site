import type { ReactElement } from "react";

export function MapShot({
  pin = "Hollywood",
  color = "#E63027",
}: {
  pin?: string;
  color?: string;
}): ReactElement {
  const verticals = Array.from({ length: 8 }, (_, i) => i);
  const horizontals = Array.from({ length: 6 }, (_, i) => i);
  return (
    <svg
      viewBox="0 0 600 400"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      style={{ display: "block", background: "#E8DBB8" }}
      aria-hidden="true"
      focusable="false"
    >
      {verticals.map((i) => (
        <line
          key={"v" + i}
          x1={i * 80}
          y1="0"
          x2={i * 80}
          y2="400"
          stroke="#C9B789"
          strokeWidth={i % 3 === 0 ? 6 : 2}
        />
      ))}
      {horizontals.map((i) => (
        <line
          key={"h" + i}
          x1="0"
          y1={i * 70}
          x2="600"
          y2={i * 70}
          stroke="#C9B789"
          strokeWidth={i % 2 === 0 ? 6 : 2}
        />
      ))}
      <path d="M 0 50 L 600 280" stroke="#a39060" strokeWidth="14" />
      <path d="M 0 50 L 600 280" stroke="#FFF2C9" strokeWidth="2" strokeDasharray="20 12" />
      <rect x="60" y="220" width="120" height="100" fill="#a8c980" opacity="0.7" />
      <rect x="380" y="60" width="100" height="80" fill="#a8c980" opacity="0.7" />
      <g transform="translate(280 180)">
        <ellipse cx="0" cy="40" rx="14" ry="4" fill="#000" opacity="0.3" />
        <path d="M 0 30 L -18 -10 Q -18 -40 0 -40 Q 18 -40 18 -10 Z" fill={color} stroke="#1a1612" strokeWidth="3" />
        <circle cx="0" cy="-15" r="7" fill="#FFF2C9" stroke="#1a1612" strokeWidth="2" />
      </g>
      <g transform="translate(290 230)">
        <rect x="-50" y="0" width="120" height="22" fill="#1a1612" />
        <text x="10" y="15" fill="#FFF2C9" fontFamily="ui-monospace, monospace" fontSize="11" letterSpacing="1.5">
          {pin.toUpperCase()}
        </text>
      </g>
    </svg>
  );
}
