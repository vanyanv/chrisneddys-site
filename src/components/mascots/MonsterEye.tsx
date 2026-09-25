import type { Ref } from "react";
import { MONSTER_INK, MONSTER_WHITE, monsterDrawing } from "./monsterColors";

/**
 * A movable iris for a monster drawn with `<use href="#cne-classic...">`:
 * painted inside the same `<svg>`, after the `<use>`, it paints over the
 * symbol's own eye with the body colour and redraws the whole eye (ring, white,
 * iris, pupil), with the iris and pupil in a group the caller can move (the
 * hero's pointer-tracking `Watcher`, the last-call banner's darting eye). The
 * redrawn eye carries `cne-eye`, so it blinks like every other monster's: the
 * symbol's own eye blinks underneath too, but on its own clock, so it's hidden
 * rather than kept in step. The iris is clipped to the eye white, so however
 * far it moves it never crosses the ring. The shapes are the ones `MascotDefs`
 * already put on the page, on the art's 1000-unit grid (scaled into the usual
 * 200-unit `<svg>`), so the group moves in those units.
 */
export function MonsterEye({
  body,
  iris,
  irisRef,
  className,
}: {
  body: string;
  iris: string;
  irisRef?: Ref<SVGGElement>;
  className?: string;
}) {
  const id = monsterDrawing(body) === "red" ? "cne-classic-red" : "cne-classic";
  return (
    <g transform="scale(0.2)">
      <use href={`#${id}-ring`} fill={body} stroke={body} strokeWidth={15} />
      <g className="cne-eye">
        <use href={`#${id}-ring`} fill={MONSTER_INK} />
        <use href={`#${id}-white`} fill={MONSTER_WHITE} />
        <g clipPath={`url(#${id}-eye)`}>
          <g ref={irisRef} className={className}>
            <use href={`#${id}-iris`} fill={iris} />
            <use href={`#${id}-pupil`} fill={MONSTER_INK} />
          </g>
        </g>
      </g>
    </g>
  );
}
