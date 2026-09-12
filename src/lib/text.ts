/**
 * Truncates `text` to at most `max` characters, cutting at the last word
 * boundary before the limit rather than mid-word, and appending an ellipsis.
 * Trailing punctuation left dangling by the cut is trimmed first, so the
 * result never reads as `"...thing,…"`. Strings already within `max` are
 * returned untouched — no ellipsis is added.
 */
export function clampToWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[\s,;:—-]+$/, "")}…`;
}
