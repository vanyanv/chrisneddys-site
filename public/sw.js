/*
 * Kill switch for the previous chrisneddys.com site's service worker.
 *
 * The old site (a Gatsby build, before the domain moved to Vercel on
 * 2026-09-23) installed a service worker at /sw.js that serves its own cached
 * pages. This site never registers one, but a browser that already has the old
 * worker keeps it — and keeps showing the old site — until the worker's script
 * URL answers with something new. A 404 is not enough: the browser treats a
 * failed update check as "keep what you have".
 *
 * So this file is that something new. The browser re-checks /sw.js on the next
 * visit, installs this in place of the old worker, and this clears every cache
 * the old one filled, unregisters itself, and reloads any open tab so it loads
 * the live site from the network. It never intercepts a request.
 *
 * `/service-worker.js` is rewritten here too (next.config.mjs), the other path
 * site builders commonly register. Safe to delete once old visitors have
 * cycled through — a few months after the switch.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
      const windows = await self.clients.matchAll({ type: "window" });
      await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => {})));
    })(),
  );
});
