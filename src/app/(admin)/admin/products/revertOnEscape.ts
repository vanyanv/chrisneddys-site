/**
 * Escape reverts a field to its last-committed value without saving —
 * the plain always-editable fields the rack's fields use have no separate
 * "editing mode" to escape out of the way the old Sheet's click-to-edit
 * cells did, so this restores the same one-key undo-in-progress-edit by
 * resetting the input's value and blurring, which lets the ordinary
 * onBlur commit see the unchanged value and clear (or no-op) the pending
 * edit exactly like typing the original value back in and tabbing away.
 */
export function revertOnEscape(
  e: React.KeyboardEvent<HTMLInputElement>,
  committedValue: string,
): void {
  if (e.key !== "Escape") return;
  e.currentTarget.value = committedValue;
  e.currentTarget.blur();
}
