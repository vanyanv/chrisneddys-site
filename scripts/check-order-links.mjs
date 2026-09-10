#!/usr/bin/env node
/**
 * Checks every URL an order can leave the site through.
 *
 * The failure this exists to catch is silent: renaming an item in Otter changes
 * its UUID, and the deep link built from the old one starts 404ing. Nothing on
 * the site looks broken, no error is logged anywhere, and the only symptom is
 * that a customer who tapped a burger does not get a burger.
 *
 * Delivery platforms answer automated requests with 403 whether they are up or
 * not, so a block is reported as NEEDS-EYES rather than counted as a failure —
 * a checker that cries wolf on four rows every run is a checker nobody reads.
 *
 *   node scripts/check-order-links.mjs
 *
 * Exits non-zero if any Otter link is genuinely broken, so it can gate a
 * deploy or run on a schedule.
 */

import { readFileSync } from "node:fs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

/** Pull the values out of the TypeScript sources without a build step. */
function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const otterSrc = read("src/lib/otter.ts");
const menuSrc = read("src/data/menu.ts");
const deliverySrc = read("src/data/delivery.ts");

const pick = (src, key) => {
  const m = src.match(new RegExp(`${key}:\\s*"([^"]+)"`));
  return m ? m[1] : null;
};

const slug = pick(otterSrc, "slug");
const location = pick(otterSrc, "location");
const storeId = pick(otterSrc, "storeId");
const storeUrl = `https://order.tryotter.com/s/${slug}/${location}/${storeId}`;

/** Every item, as `name` + `otterId` pairs in source order. */
const items = [];
const itemRe = /otterId:\s*"([0-9a-f-]{36})",[\s\S]*?name:\s*"((?:[^"\\]|\\.)*)"/g;
for (const m of menuSrc.matchAll(itemRe)) {
  items.push({ otterId: m[1], name: m[2].replace(/\\"/g, '"') });
}

const deliveryUrls = [...deliverySrc.matchAll(/url:\s*"(https?:[^"]+)"/g)].map((m) => m[1]);

async function check(url) {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "user-agent": UA, accept: "text/html" },
    });
    return res.status;
  } catch (err) {
    return `ERR ${err.message}`;
  }
}

const pad = (s, n) => String(s).padEnd(n);
let broken = 0;
let blocked = 0;

console.log(`\nOtter storefront and ${items.length} item deep links\n`);

const storeStatus = await check(storeUrl);
console.log(`  ${pad(storeStatus, 6)} storefront`);
if (storeStatus !== 200) broken++;

for (const item of items) {
  const url = `${storeUrl}/${encodeURIComponent(item.name)}/${item.otterId}`;
  const status = await check(url);
  const ok = status === 200;
  if (!ok) broken++;
  console.log(`  ${pad(status, 6)} ${ok ? "" : "BROKEN  "}${item.name}`);
}

console.log(`\nDelivery and catering platforms\n`);
for (const url of deliveryUrls) {
  const status = await check(url);
  const host = new URL(url).hostname;
  if (status === 403 || status === 429) {
    blocked++;
    console.log(`  ${pad(status, 6)} NEEDS-EYES  ${host} (bot-blocked, open it in a browser)`);
  } else {
    if (status !== 200) broken++;
    console.log(`  ${pad(status, 6)} ${status === 200 ? "" : "BROKEN  "}${host}`);
  }
}

console.log(
  `\n${broken} broken, ${blocked} to check by hand.\n` +
    (broken ? "An order link is dead. Reconcile src/data/menu.ts against Otter.\n" : ""),
);

process.exit(broken ? 1 : 0);
