import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("워밍업 후 도시와 내부의 연속 프레임을 실측한다", async ({ page, browser }) => {
  const cdp = await browser.newBrowserCDPSession();
  const gpu = await cdp.send("SystemInfo.getInfo");
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".city-canvas canvas[data-camera]").waitFor();
  async function sample(selector: string) {
    const stats = page.locator(selector);
    const start = Number(await stats.getAttribute("data-sample"));
    await expect.poll(async () => Number(await stats.getAttribute("data-sample")))
      .toBeGreaterThan(start + 2);
    return { fps: Number(await stats.getAttribute("data-fps")), p95Ms: Number(await stats.getAttribute("data-p95")) };
  }
  const city = await sample(".city-view .renderer-stats");
  await page.getByRole("navigation", { name: "게임 화면" }).getByRole("button", { name: "건물 내부", exact: true }).click();
  await expect(page.locator('[data-testid="building-view"][data-ready="true"]')).toBeVisible();
  await page.getByLabel("1배속", { exact: true }).click();
  const building = await sample(".building-view .renderer-stats");
  const report = { viewport: "1280x800", browser: browser.version(), gpu: gpu.gpu.devices,
    rendering: gpu.gpu.auxAttributes?.glRenderer, city, building };
  await writeFile(".dev-checks/steady-performance.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await page.getByLabel("일시정지", { exact: true }).click();
});
