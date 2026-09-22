/**
 * The shared `<symbol>`/`<clipPath>` defs every monster and mascot instance
 * references via `<use href="#cne-...">`. Rendered once, sitewide, in the
 * root layout — never inline per-instance, since `<symbol>` markup this size
 * repeated 19 times over would bloat every page for no visual difference.
 *
 * The mouth and teeth were redrawn to match the murals on the Hollywood
 * location's walls: a wide grin filling the bottom of the face, with a few
 * fat, rounded, staggered teeth instead of small sharp spikes. Every other
 * id, coordinate and color default here is still intentional. Don't "clean
 * up" a coordinate without checking the murals first.
 */
export function MascotDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="cne-mouth-lg">
          <path d="M34.3,112 C71.1,121 128.9,121 165.7,112 Q172.7,113 169.7,124 A72,72 0 0 1 30.3,124 Q27.3,113 34.3,112 Z" />
        </clipPath>
        <clipPath id="cne-mouth-sm">
          <path d="M40,114 C73.6,122 126.4,122 160,114 Q167,115 164,126 A66,66 0 0 1 36,126 Q33,115 40,114 Z" />
        </clipPath>
        <clipPath id="cne-mouth-bubble">
          <path d="M19.1,53 C36.4,57 63.6,57 80.9,53 Q87.9,54 84.9,59 A36,36 0 0 1 15.1,59 Q12.1,54 19.1,53 Z" />
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
            <path
              d="M34.3,112 C71.1,121 128.9,121 165.7,112 Q172.7,113 169.7,124 A72,72 0 0 1 30.3,124 Q27.3,113 34.3,112 Z"
              fill="#14110d"
            />
            <g className="cne-teeth-top">
              <path
                d="M32,106.4 C32,123.3 40.5,135.4 45,135.4 C49.5,135.4 60,123.3 60,106.4 Z"
                fill="#fff8e7"
              />
              <path
                d="M62,110.3 C62,130.6 76.6,145.3 83,145.3 C89.4,145.3 102,130.6 102,110.3 Z"
                fill="#fff8e7"
              />
              <path
                d="M99,110.3 C99,130 111.6,144.3 118,144.3 C124.4,144.3 139,130 139,110.3 Z"
                fill="#fff8e7"
              />
              <path
                d="M137,106.8 C137,123.6 149.2,135.8 154,135.8 C158.8,135.8 167,123.6 167,106.8 Z"
                fill="#fff8e7"
              />
            </g>
            <g className="cne-teeth-bottom">
              <path
                d="M45,175.2 C45,158.3 59.6,146.2 65,146.2 C70.4,146.2 79,158.3 79,175.2 Z"
                fill="#fff8e7"
              />
              <path
                d="M80,186 C80,168.6 92.9,156 99,156 C105.1,156 118,168.6 118,186 Z"
                fill="#fff8e7"
              />
              <path
                d="M119,176.4 C119,160.1 128.6,148.4 134,148.4 C139.4,148.4 153,160.1 153,176.4 Z"
                fill="#fff8e7"
              />
            </g>
          </g>
          <path
            d="M34.3,112 C71.1,121 128.9,121 165.7,112 Q172.7,113 169.7,124 A72,72 0 0 1 30.3,124 Q27.3,113 34.3,112 Z"
            fill="none"
            stroke="#14110d"
            strokeWidth={7}
            strokeLinejoin="round"
          />
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

        {/* The classic body, asleep: the eye is covered by a body-colored disc
            (no iris) with a closed-eye curve and three lashes drawn over it —
            for sold-out merch and "soon" map pins, so "gone for now" reads as
            resting rather than a plain grey label. */}
        <symbol id="cne-classic-sleep" viewBox="0 0 200 200">
          <use href="#cne-classic" />
          <circle cx={100} cy={76} r={37} style={{ fill: "var(--m-body,#e63027)" }} />
          <path
            d="M68,74 Q100,100 132,74"
            fill="none"
            stroke="#14110d"
            strokeWidth={8}
            strokeLinecap="round"
          />
          <path
            d="M78,86 l-6,10 M100,92 v11 M122,86 l6,10"
            fill="none"
            stroke="#14110d"
            strokeWidth={5}
            strokeLinecap="round"
          />
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
            <path
              d="M40,114 C73.6,122 126.4,122 160,114 Q167,115 164,126 A66,66 0 0 1 36,126 Q33,115 40,114 Z"
              fill="#14110d"
            />
            <g className="cne-teeth-top">
              <path
                d="M38,108.2 C38,123.9 45.8,135.2 50,135.2 C54.2,135.2 64,123.9 64,108.2 Z"
                fill="#fff8e7"
              />
              <path
                d="M66,111.6 C66,130.8 79.2,144.6 85,144.6 C90.8,144.6 102,130.8 102,111.6 Z"
                fill="#fff8e7"
              />
              <path
                d="M100,111.5 C100,130.1 111.2,143.5 117,143.5 C122.8,143.5 136,130.1 136,111.5 Z"
                fill="#fff8e7"
              />
              <path
                d="M134,108.4 C134,124.1 145.5,135.4 150,135.4 C154.5,135.4 162,124.1 162,108.4 Z"
                fill="#fff8e7"
              />
            </g>
            <g className="cne-teeth-bottom">
              <path
                d="M50,174.6 C50,158.9 63.9,147.6 69,147.6 C74.1,147.6 82,158.9 82,174.6 Z"
                fill="#fff8e7"
              />
              <path
                d="M83,184 C83,167.8 94.6,156 100,156 C105.4,156 117,167.8 117,184 Z"
                fill="#fff8e7"
              />
              <path
                d="M118,174.6 C118,159.5 126.9,148.6 132,148.6 C137.1,148.6 150,159.5 150,174.6 Z"
                fill="#fff8e7"
              />
            </g>
          </g>
          <path
            d="M40,114 C73.6,122 126.4,122 160,114 Q167,115 164,126 A66,66 0 0 1 36,126 Q33,115 40,114 Z"
            fill="none"
            stroke="#14110d"
            strokeWidth={6}
            strokeLinejoin="round"
          />
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
          <g clipPath="url(#cne-mouth-bubble)">
            <path
              d="M19.1,53 C36.4,57 63.6,57 80.9,53 Q87.9,54 84.9,59 A36,36 0 0 1 15.1,59 Q12.1,54 19.1,53 Z"
              fill="#14110d"
            />
            <g className="cne-teeth-top">
              <path
                d="M27,47.5 C27,58.5 33,66.5 36,66.5 C39,66.5 45,58.5 45,47.5 Z"
                fill="#fff8e7"
              />
              <path
                d="M51,47.7 C51,58.7 58,66.7 61,66.7 C64,66.7 69,58.7 69,47.7 Z"
                fill="#fff8e7"
              />
            </g>
            <g className="cne-teeth-bottom">
              <path
                d="M39,93.9 C39,84.1 45,76.9 48,76.9 C51,76.9 57,84.1 57,93.9 Z"
                fill="#fff8e7"
              />
            </g>
          </g>
          <path
            d="M19.1,53 C36.4,57 63.6,57 80.9,53 Q87.9,54 84.9,59 A36,36 0 0 1 15.1,59 Q12.1,54 19.1,53 Z"
            fill="none"
            stroke="#14110d"
            strokeWidth={3.5}
            strokeLinejoin="round"
          />
          <g className="cne-eye">
            <circle cx={50} cy={34} r={14} fill="#fff8e7" stroke="#14110d" strokeWidth={3} />
            <circle cx={50} cy={34} r={7} style={{ fill: "var(--m-iris,#2e5fd9)" }} />
            <circle cx={50} cy={34} r={3} fill="#14110d" />
          </g>
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
