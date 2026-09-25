"use client";

import { MONSTER_DRAWINGS, type MonsterDrawing } from "./monsterArt";
import { MONSTER_INK, MONSTER_WHITE } from "./monsterColors";

/**
 * The shared `<symbol>`/`<clipPath>` defs every monster and mascot instance
 * references via `<use href="#cne-...">`. Rendered once, sitewide, in the
 * root layout — never inline per-instance, since `<symbol>` markup this size
 * repeated 19 times over would bloat every page for no visual difference.
 *
 * The monsters are the artist's own drawings (`monsterArt.ts`): `cne-classic`
 * for every colour but red, `cne-classic-red` for red. Each keeps the classes
 * `mascots.css` animates (`cne-eye` blinks, the teeth chomp) and reads its
 * colours from `--m-body`, `--m-iris` and `--m-pupil`. The `-mouth` clip keeps
 * chomping teeth inside the mouth (the symbols draw on the art's 1000-unit
 * grid, so the chomp in `mascots.css` moves 20 units, 4 of the 200-unit
 * grid every monster `<svg>` uses); the `-eye` clip is the eye white, for the
 * monsters that move their own iris (`MonsterEye`), which also reuses the
 * `-ring`, `-white`, `-iris` and `-pupil` shapes rather than carrying its own
 * copy.
 *
 * A client component on purpose: a server component's markup is sent twice
 * (the HTML and the page data that hydrates it), and these paths are most of
 * this file's weight. As a client component the HTML carries them once and the
 * script that hydrates them is shared and cached across pages.
 */
function MonsterSymbol({ id, d }: { id: string; d: MonsterDrawing }) {
  return (
    <>
      <path id={`${id}-mouth-shape`} d={d.mouth} />
      <path id={`${id}-ring`} d={d.eye} />
      <path id={`${id}-white`} d={d.eyeWhite} />
      <path id={`${id}-iris`} d={d.iris} />
      <path id={`${id}-pupil`} d={d.pupil} />
      <clipPath id={`${id}-mouth`}>
        <use href={`#${id}-mouth-shape`} />
      </clipPath>
      <clipPath id={`${id}-eye`}>
        <use href={`#${id}-white`} />
      </clipPath>
      <symbol id={id} viewBox="0 0 1000 1000">
        <path d={d.outline} fill={MONSTER_INK} />
        <path d={d.body} style={{ fill: "var(--m-body,#ed1c24)" }} />
        <g clipPath={`url(#${id}-mouth)`}>
          <use href={`#${id}-mouth-shape`} fill={MONSTER_INK} />
          <path className="cne-teeth-top" d={d.teethTop} fill={MONSTER_WHITE} />
          <path className="cne-teeth-bottom" d={d.teethBottom} fill={MONSTER_WHITE} />
        </g>
        <g className="cne-eye">
          <use href={`#${id}-ring`} fill={MONSTER_INK} />
          <use href={`#${id}-white`} fill={MONSTER_WHITE} />
          <use href={`#${id}-iris`} style={{ fill: "var(--m-iris,#20b1ed)" }} />
          <use href={`#${id}-pupil`} style={{ fill: `var(--m-pupil,${MONSTER_INK})` }} />
        </g>
      </symbol>
    </>
  );
}

export function MascotDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <MonsterSymbol id="cne-classic" d={MONSTER_DRAWINGS.classic} />
        <MonsterSymbol id="cne-classic-red" d={MONSTER_DRAWINGS.red} />

        {/* The classic monster, asleep: the eye is covered by a body-colored
            patch with a closed-eye curve and three lashes drawn over it —
            for sold-out merch and "soon" map pins, so "gone for now" reads as
            resting rather than a plain grey label. */}
        <symbol id="cne-classic-sleep" viewBox="0 0 200 200">
          <use href="#cne-classic" />
          <path
            d={MONSTER_DRAWINGS.classic.eye}
            transform="scale(0.2)"
            style={{ fill: "var(--m-body,#ed1c24)", stroke: "var(--m-body,#ed1c24)" }}
            strokeWidth={15}
          />
          <path
            d="M68,60 Q98,86 128,60"
            fill="none"
            stroke={MONSTER_INK}
            strokeWidth={8}
            strokeLinecap="round"
          />
          <path
            d="M78,72 l-6,10 M98,78 v11 M118,72 l6,10"
            fill="none"
            stroke={MONSTER_INK}
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
