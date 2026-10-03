import { chromium } from "@playwright/test";
const out = "/mnt/project-files/menu-page/triple-quad";
const b = await chromium
  .launch({ executablePath: "/opt/pw-browsers/chromium" })
  .catch(() => chromium.launch());
for (const [name, vp, dpr] of [
  ["desk", { width: 1440, height: 900 }, 1],
  ["phone", { width: 393, height: 852 }, 3],
]) {
  for (const way of ["chris", "eddy"]) {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: dpr });
    await p.goto(`http://localhost:3000/menu/?way=${way}`, { waitUntil: "networkidle" });
    for (const sec of ["sliders", "combos", "secret"]) {
      const el = p.locator(`#menu-${sec}`);
      await el.scrollIntoViewIfNeeded();
      await p.waitForTimeout(800);
      await p.evaluate(() =>
        Promise.all(
          [...document.images].map(
            (i) => i.complete || new Promise((r) => (i.onload = i.onerror = r)),
          ),
        ),
      );
      await el.screenshot({ path: `${out}/${name}-${sec}-${way}.jpg`, quality: 80, type: "jpeg" });
    }
    await p.close();
  }
}
await b.close();
