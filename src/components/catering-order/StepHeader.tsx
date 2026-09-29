"use client";

import { STEPS, STEP_LABEL, stepIndex, type Step } from "./steps";

/**
 * The red bar every builder screen (C2-C9) carries: "STEP X OF 5", the logo,
 * the ✕ that asks to leave (C11), and the five-dash progress bar underneath.
 */
export function StepHeader({ step, onLeave }: { step: Step; onLeave: () => void }) {
  const idx = stepIndex(step);
  return (
    <div className="cor-head">
      <div className="cor-headbar">
        <p className="cor-headstep">
          Step {idx + 1} of {STEPS.length}
        </p>
        <p className="cor-headlogo" aria-hidden="true">
          Chris N Eddy&rsquo;s
        </p>
        <button type="button" className="cor-headx" onClick={onLeave} aria-label="Leave order">
          ✕
        </button>
      </div>
      <div
        className="cor-progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={idx + 1}
        aria-valuetext={STEP_LABEL[step]}
      >
        {STEPS.map((s, i) => (
          <span key={s} className={i < idx ? "is-done" : i === idx ? "is-current" : ""} />
        ))}
      </div>
    </div>
  );
}
