"use client";

import { Sheet } from "./Sheet";

/** C11: the confirm-leave modal the ✕ in the header opens. */
export function LeaveModal({
  open,
  onKeepOrdering,
  onLeave,
}: {
  open: boolean;
  onKeepOrdering: () => void;
  onLeave: () => void;
}) {
  return (
    <Sheet open={open} onClose={onKeepOrdering} label="Leave your order?" className="cor-leave">
      <div className="cor-leave-card">
        <h2>Leave your order?</h2>
        <p>It&rsquo;s saved on this phone. Come back any time and pick up where you left off.</p>
        <button type="button" className="cor-btn is-primary" onClick={onKeepOrdering}>
          Keep ordering
        </button>
        <button type="button" className="cor-btn is-secondary" onClick={onLeave}>
          Leave
        </button>
      </div>
    </Sheet>
  );
}
