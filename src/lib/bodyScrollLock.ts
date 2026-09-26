/** Keep the document in place while a modal is open, including on iOS Safari. */
let locks = 0;
let restore: (() => void) | null = null;

export function lockBodyScroll(): () => void {
  if (locks++ === 0) {
    const body = document.body;
    const scrollY = window.scrollY;
    const compact = window.matchMedia("(max-width: 900px)").matches;
    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    };

    body.style.overflow = "hidden";
    if (compact) {
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
    }

    restore = () => {
      body.style.overflow = previous.overflow;
      if (compact) {
        body.style.position = previous.position;
        body.style.top = previous.top;
        body.style.width = previous.width;
        window.scrollTo(0, scrollY);
      }
    };
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--locks === 0) {
      restore?.();
      restore = null;
    }
  };
}
