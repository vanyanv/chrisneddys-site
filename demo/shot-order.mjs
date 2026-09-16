import { chromium } from "@playwright/test";
const BASE = "http://127.0.0.1:3222";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const p = await ctx.newPage();

async function look() {
  await p.goto(`${BASE}/shop/order`);
  await p.getByLabel("Order number", { exact: true }).fill("CNE-1001");
  await p.getByLabel("Email used at checkout", { exact: true }).fill("sam.buyer@example.com");
  await p.getByRole("button", { name: /look up order/i }).click();
  await p.locator(".cne-ord-result").waitFor({ timeout: 20000 });
  await p.waitForTimeout(700);
}

await p.goto(`${BASE}/shop/order`);
await p.waitForTimeout(600);
await p.screenshot({ path: "demo/shots/A-order-status-empty.png", fullPage: true });

await look();
await p.screenshot({ path: "demo/shots/B-order-status-result.png", fullPage: true });

await p.setViewportSize({ width: 390, height: 844 });
await look();
await p.screenshot({ path: "demo/shots/C-order-status-phone.png", fullPage: true });

await b.close();
console.log("order shots done");
