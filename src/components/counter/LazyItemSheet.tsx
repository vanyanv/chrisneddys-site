"use client";

import { useEffect, useState, type ComponentProps } from "react";
import dynamic from "next/dynamic";

type SheetProps = ComponentProps<typeof import("./ItemSheet").ItemSheet>;

/**
 * The item sheet is the biggest client module on the menu and the home page,
 * and it does nothing until somebody taps an item. Importing it statically put
 * it in a chunk that Next's link prefetching then pulled onto every page, which
 * is what tipped /careers/ and /catering/ over their script budget. So it is a
 * separate chunk that is fetched on the first tap and never prefetched.
 *
 * It mounts closed and opens a frame later, so the slide-in still has a closed
 * state to animate from even though the chunk arrived after the tap.
 */
const ItemSheet = dynamic(
  () =>
    import("./ItemSheet").then(
      ({ ItemSheet: Sheet }) =>
        function ArmedItemSheet(props: SheetProps) {
          const [armed, setArmed] = useState(false);
          useEffect(() => {
            const id = requestAnimationFrame(() => setArmed(true));
            return () => cancelAnimationFrame(id);
          }, []);
          return <Sheet {...props} open={props.open && armed} />;
        },
    ),
  { ssr: false },
);

export function LazyItemSheet(props: SheetProps) {
  // Nothing to fetch until the first open; after that the item stays mounted,
  // as before, so the sheet keeps its height while it slides out.
  const [wanted, setWanted] = useState(false);
  if (props.open && !wanted) setWanted(true);
  return wanted ? <ItemSheet {...props} /> : null;
}
