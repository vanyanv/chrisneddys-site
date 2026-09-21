/**
 * The shared `<symbol>`/`<clipPath>` defs every monster and mascot instance
 * references via `<use href="#cne-...">`. Rendered once, sitewide, in the
 * root layout — never inline per-instance, since `<symbol>` markup this size
 * repeated 19 times over would bloat every page for no visual difference.
 *
 * Pixel-matched to the owner-approved Sitewide Monster Map design artifact:
 * every id, coordinate and color default here is intentional. Don't "clean
 * up" a coordinate without checking the artifact first.
 */
export function MascotDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="cne-mouth-lg">
          <ellipse cx={100} cy={150} rx={54} ry={32} />
        </clipPath>
        <clipPath id="cne-mouth-sm">
          <ellipse cx={100} cy={132} rx={42} ry={24} />
        </clipPath>

        <symbol id="cne-classic" viewBox="0 0 200 200">
          <circle
            cx={100}
            cy={106}
            r={86}
            style={{ fill: "var(--m-body,#e63027)" }}
            stroke="#14110d"
            strokeWidth={9}
          />
          <g clipPath="url(#cne-mouth-lg)">
            <ellipse cx={100} cy={150} rx={54} ry={32} fill="#14110d" />
            <g className="cne-teeth-top">
              <polygon points="52,123 66,123 59,148" fill="#fff8e7" />
              <polygon points="68,123 80,123 74,141" fill="#fff8e7" />
              <polygon points="82,123 99,123 90,150" fill="#fff8e7" />
              <polygon points="101,123 115,123 108,144" fill="#fff8e7" />
              <polygon points="117,123 131,123 124,149" fill="#fff8e7" />
              <polygon points="133,123 147,123 140,142" fill="#fff8e7" />
            </g>
            <g className="cne-teeth-bottom">
              <polygon points="58,177 72,177 65,157" fill="#fff8e7" />
              <polygon points="76,177 90,177 83,152" fill="#fff8e7" />
              <polygon points="94,177 111,177 102,160" fill="#fff8e7" />
              <polygon points="114,177 129,177 121,153" fill="#fff8e7" />
              <polygon points="133,177 146,177 139,158" fill="#fff8e7" />
            </g>
          </g>
          <ellipse cx={100} cy={150} rx={54} ry={32} fill="none" stroke="#14110d" strokeWidth={7} />
          <g className="cne-eye">
            <circle cx={100} cy={76} r={33} fill="#fff8e7" stroke="#14110d" strokeWidth={6} />
            <circle
              cx={100}
              cy={76}
              r={17}
              style={{ fill: "var(--m-iris,#2e5fd9)" }}
              stroke="#14110d"
              strokeWidth={4}
            />
            <circle cx={100} cy={76} r={7} style={{ fill: "var(--m-pupil,#14110d)" }} />
          </g>
        </symbol>

        <symbol id="cne-blacklight" viewBox="0 0 200 200">
          <circle
            cx={100}
            cy={110}
            r={80}
            style={{ fill: "var(--m-body,#3ee06a)" }}
            stroke="#14110d"
            strokeWidth={9}
          />
          <g clipPath="url(#cne-mouth-sm)">
            <ellipse cx={100} cy={132} rx={42} ry={24} fill="#14110d" />
            <g className="cne-teeth-top">
              <polygon points="64,112 76,112 70,130" fill="#fff8e7" />
              <polygon points="80,112 90,112 85,125" fill="#fff8e7" />
              <polygon points="94,112 108,112 101,132" fill="#fff8e7" />
              <polygon points="112,112 124,112 118,127" fill="#fff8e7" />
              <polygon points="128,112 140,112 134,131" fill="#fff8e7" />
            </g>
            <g className="cne-teeth-bottom">
              <polygon points="70,152 82,152 76,138" fill="#fff8e7" />
              <polygon points="88,152 100,152 94,134" fill="#fff8e7" />
              <polygon points="104,152 118,152 111,140" fill="#fff8e7" />
              <polygon points="122,152 134,152 128,136" fill="#fff8e7" />
            </g>
          </g>
          <ellipse cx={100} cy={132} rx={42} ry={24} fill="none" stroke="#14110d" strokeWidth={6} />
          <g className="cne-eye">
            <circle cx={100} cy={78} r={30} fill="#fff8e7" stroke="#14110d" strokeWidth={6} />
            <circle
              cx={100}
              cy={78}
              r={15}
              style={{ fill: "var(--m-iris,#2fb8ff)" }}
              stroke="#14110d"
              strokeWidth={4}
            />
            <circle cx={100} cy={78} r={6} style={{ fill: "var(--m-pupil,#14110d)" }} />
          </g>
        </symbol>

        <symbol id="cne-bubble" viewBox="0 0 100 100">
          <circle
            cx={50}
            cy={50}
            r={45}
            style={{ fill: "var(--m-body,#e63027)" }}
            stroke="#14110d"
            strokeWidth={5}
          />
          <g className="cne-eye">
            <circle cx={50} cy={40} r={15} fill="#fff8e7" stroke="#14110d" strokeWidth={3} />
            <circle cx={50} cy={40} r={7} style={{ fill: "var(--m-iris,#2e5fd9)" }} />
            <circle cx={50} cy={40} r={3} fill="#14110d" />
          </g>
          <path
            d="M33,63 Q50,78 67,63"
            fill="none"
            stroke="#14110d"
            strokeWidth={5}
            strokeLinecap="round"
          />
        </symbol>

        <symbol id="cne-bullseye" viewBox="0 0 200 200">
          <circle cx={100} cy={100} r={98} style={{ fill: "var(--op-a,#14110d)" }} />
          <circle cx={100} cy={100} r={82} style={{ fill: "var(--op-b,#fff8e7)" }} />
          <circle cx={100} cy={100} r={66} style={{ fill: "var(--op-a,#14110d)" }} />
          <circle cx={100} cy={100} r={50} style={{ fill: "var(--op-b,#fff8e7)" }} />
          <circle cx={100} cy={100} r={34} style={{ fill: "var(--op-a,#14110d)" }} />
          <circle cx={100} cy={100} r={18} style={{ fill: "var(--op-b,#fff8e7)" }} />
        </symbol>

        <symbol id="cne-diamond" viewBox="0 0 200 200">
          <g transform="rotate(45 100 100)">
            <rect x={10} y={10} width={180} height={180} style={{ fill: "var(--op-a,#14110d)" }} />
            <rect x={32} y={32} width={136} height={136} style={{ fill: "var(--op-b,#fff8e7)" }} />
            <rect x={54} y={54} width={92} height={92} style={{ fill: "var(--op-a,#14110d)" }} />
            <rect x={76} y={76} width={48} height={48} style={{ fill: "var(--op-b,#fff8e7)" }} />
          </g>
        </symbol>

        <symbol id="cne-drip" viewBox="0 0 40 60">
          <path
            d="M20,2 C28,20 34,32 34,42 A14,14 0 1 1 6,42 C6,32 12,20 20,2 Z"
            style={{ fill: "var(--drip-color,#14110d)" }}
          />
        </symbol>

        <symbol id="cne-numbers" viewBox="0 0 200 200">
          <g
            fontFamily="'JetBrains Mono',monospace"
            fontWeight={700}
            style={{ fill: "var(--num-color,#14110d)" }}
          >
            <text x={10} y={34} fontSize={26} transform="rotate(-8 10 34)">
              13
            </text>
            <text x={66} y={20} fontSize={20} transform="rotate(5 66 20)">
              89
            </text>
            <text x={118} y={42} fontSize={32} transform="rotate(-4 118 42)">
              25
            </text>
            <text x={18} y={82} fontSize={22} transform="rotate(10 18 82)">
              8
            </text>
            <text x={88} y={76} fontSize={18} transform="rotate(-12 88 76)">
              21
            </text>
            <text x={150} y={92} fontSize={24} transform="rotate(6 150 92)">
              34
            </text>
            <text x={36} y={122} fontSize={20} transform="rotate(-6 36 122)">
              55
            </text>
            <text x={108} y={132} fontSize={28} transform="rotate(3 108 132)">
              7
            </text>
          </g>
        </symbol>

        <symbol id="cne-court" viewBox="0 0 200 200">
          <circle
            cx={100}
            cy={176}
            r={26}
            fill="none"
            style={{ stroke: "var(--court-color,#fff2c9)" }}
            strokeWidth={4}
          />
          <path
            d="M14,176 A120,120 0 0 1 186,176"
            fill="none"
            style={{ stroke: "var(--court-color,#fff2c9)" }}
            strokeWidth={4}
          />
          <line
            x1={14}
            y1={176}
            x2={14}
            y2={130}
            style={{ stroke: "var(--court-color,#fff2c9)" }}
            strokeWidth={4}
          />
          <line
            x1={186}
            y1={176}
            x2={186}
            y2={130}
            style={{ stroke: "var(--court-color,#fff2c9)" }}
            strokeWidth={4}
          />
          <rect
            x={70}
            y={150}
            width={60}
            height={26}
            fill="none"
            style={{ stroke: "var(--court-color,#fff2c9)" }}
            strokeWidth={3}
          />
        </symbol>
      </defs>
    </svg>
  );
}
