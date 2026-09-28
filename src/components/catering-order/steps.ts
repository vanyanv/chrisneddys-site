/** The five numbered steps (C2-C9's "STEP X OF 5"). The landing screen (C1)
 * and the food step's sheets (C5-C7) aren't separate numbered steps. */
export const STEPS = ["where", "when", "food", "details", "review"] as const;
export type Step = (typeof STEPS)[number];

export const STEP_LABEL: Record<Step, string> = {
  where: "How and where",
  when: "When",
  food: "Food",
  details: "Details",
  review: "Review",
};

export function stepIndex(step: Step): number {
  return STEPS.indexOf(step);
}

export function isStep(value: string | null): value is Step {
  return !!value && (STEPS as readonly string[]).includes(value);
}
