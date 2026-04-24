"use client";

import { useEffect, useState } from "react";

const posterStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
  filter: "saturate(1.05) contrast(1.03)",
};

export function HeroMedia() {
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const poster = new Image();
    poster.src = "/hero-poster.jpg";
    const attach = () => setShowVideo(true);
    if (poster.complete) attach();
    else poster.addEventListener("load", attach, { once: true });
  }, []);

  if (!showVideo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/hero-poster.jpg"
        alt="Chris N Eddy's smashed sliders"
        fetchPriority="high"
        decoding="async"
        style={posterStyle}
      />
    );
  }

  return (
    <video
      aria-label="Chris N Eddy's sliders"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster="/hero-poster.jpg"
      style={posterStyle}
    >
      <source src="/hero.webm" type="video/webm" />
      <source src="/hero.mp4" type="video/mp4" />
    </video>
  );
}
