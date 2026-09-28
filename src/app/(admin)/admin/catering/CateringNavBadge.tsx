/** The small red count on the "Catering" tab in every admin page's top bar
 * — `.cat-nav-badge`, `src/styles/admin-catering.css`. A no-op (renders
 * nothing) at zero, same as the sidebar's own "0" avatar badge convention
 * elsewhere in the admin: nothing waiting means nothing to point at. */
export function CateringNavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="cat-nav-badge"
      aria-label={`${count} catering ${count === 1 ? "request" : "requests"} need you`}
    >
      {count}
    </span>
  );
}
