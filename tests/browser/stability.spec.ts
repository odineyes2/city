import { test, expect, type Page, type CDPSession } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { camera, drag } from "./helpers";
async function go(page: Page, type: "none" | "building" | "management") {
  const current = await page
    .locator("[data-overlay]")
    .getAttribute("data-overlay");
  if (current !== type) {
    if (type === "none")
      await page
        .getByRole("button", { name: "오버레이 닫기", exact: true })
        .click();
    else if (current === "none")
      await page
        .getByRole("navigation", { name: "게임 화면" })
        .getByRole("button", {
          name: type === "building" ? "건물 내부" : "관리",
          exact: true,
        })
        .click();
    else
      await page
        .locator(".overlay-header")
        .getByRole("button", { name: type === "building" ? /건물/ : "관리" })
        .click();
  }
  await expect(page.locator("[data-overlay]")).toHaveAttribute(
    "data-overlay",
    type,
  );
  if (type === "building")
    await expect(
      page.locator('[data-testid="building-view"][data-ready="true"]'),
    ).toBeVisible();
  await expect(page.getByTestId("visual-lifecycle")).toHaveAttribute(
    "data-city-active",
    "1",
  );
  await expect(page.getByTestId("visual-lifecycle")).toHaveAttribute(
    "data-building-active",
    type === "building" ? "1" : "0",
  );
  expect(await page.locator("canvas").count()).toBe(
    type === "building" ? 2 : 1,
  );
}
async function listeners(cdp: CDPSession, expression: string) {
  const { result } = await cdp.send("Runtime.evaluate", { expression });
  const data = await cdp.send("DOMDebugger.getEventListeners", {
    objectId: result.objectId!,
  });
  await cdp.send("Runtime.releaseObject", { objectId: result.objectId! });
  const counts: Record<string, number> = {};
  for (const l of data.listeners) counts[l.type] = (counts[l.type] ?? 0) + 1;
  return counts;
}
const diagnostics = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __ASHEN_VISUALS__: {
            cityFrames: number;
            cityDisposed: number;
            buildingDisposed: number;
            last: {
              renderer: string;
              fps: number;
              p95Ms: number;
              geometries: number;
              textures: number;
            };
          };
        }
      ).__ASHEN_VISUALS__,
  );
test("세 오버레이 경로를 각각 20회: 고정 도시·프레임 정지·리스너·힙·입력 복구", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Too many active WebGL contexts/.test(m.text())) errors.push(m.text());
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".city-canvas canvas[data-camera]").waitFor();
  const original = await page.locator(".city-canvas canvas").elementHandle();
  await go(page, "building");
  await go(page, "management");
  await go(page, "none");
  const uiBefore = await page.locator(".app-shell").textContent();
  const cameraBefore = await camera(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.enable");
  await cdp.send("HeapProfiler.collectGarbage");
  const baseline = await cdp.send("Runtime.getHeapUsage");
  const beforeListeners = {
    canvas: await listeners(
      cdp,
      'document.querySelector(".city-canvas canvas")',
    ),
    document: await listeners(cdp, "document"),
    window: await listeners(cdp, "window"),
  };
  const sequenceBefore = Number(
    await page
      .locator(".city-view .renderer-stats")
      .getAttribute("data-sample"),
  );
  await expect
    .poll(async () =>
      Number(
        await page
          .locator(".city-view .renderer-stats")
          .getAttribute("data-sample"),
      ),
    )
    .toBeGreaterThan(sequenceBefore);
  const gpuBefore = (await diagnostics(page)).last;
  const heaps = [];
  for (const route of [
    ["building", "none"],
    ["management", "none"],
    ["building", "management", "building", "none"],
  ] as const) {
    for (let i = 0; i < 20; i++) for (const view of route) await go(page, view);
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = await cdp.send("Runtime.getHeapUsage");
    heaps.push({ route: route.join("→"), used: heap.usedSize });
    console.log(JSON.stringify(heaps.at(-1)));
  }
  expect(
    await page
      .locator(".city-canvas canvas")
      .evaluate((el, old) => el === old, original),
  ).toBe(true);
  expect(await page.locator(".app-shell").textContent()).toBe(uiBefore);
  const preserved = await camera(page);
  for (const k of ["position", "target"] as const)
    for (let i = 0; i < 3; i++)
      expect(preserved[k][i]).toBeCloseTo(cameraBefore[k][i], 4);
  expect(preserved.zoom).toBeCloseTo(cameraBefore.zoom, 6);
  expect((await diagnostics(page)).cityDisposed).toBe(0);
  const afterListeners = {
    canvas: await listeners(
      cdp,
      'document.querySelector(".city-canvas canvas")',
    ),
    document: await listeners(cdp, "document"),
    window: await listeners(cdp, "window"),
  };
  expect(afterListeners).toEqual(beforeListeners);
  expect(heaps.at(-1)!.used - baseline.usedSize).toBeLessThan(8 * 1024 * 1024);
  await go(page, "management");
  await page.waitForTimeout(150);
  const frozen = (await diagnostics(page)).cityFrames;
  await page.waitForTimeout(500);
  expect((await diagnostics(page)).cityFrames).toBe(frozen);
  expect(await camera(page)).toEqual(cameraBefore);
  await go(page, "none");
  await drag(page, "left", -80, 20);
  const moved = await camera(page);
  expect(moved.target).not.toEqual(cameraBefore.target);
  await drag(page, "right", 80, 0);
  const rotated = await camera(page);
  expect(rotated.position).not.toEqual(moved.position);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(250);
  expect((await camera(page)).zoom).toBeGreaterThan(rotated.zoom);
  const seq = Number(
    await page
      .locator(".city-view .renderer-stats")
      .getAttribute("data-sample"),
  );
  await expect
    .poll(async () =>
      Number(
        await page
          .locator(".city-view .renderer-stats")
          .getAttribute("data-sample"),
      ),
    )
    .toBeGreaterThan(seq);
  const city = (await diagnostics(page)).last;
  expect(city.geometries).toBe(gpuBefore.geometries);
  expect(city.textures).toBe(gpuBefore.textures);
  await go(page, "building");
  await page.getByLabel("1배속", { exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        await page
          .locator(".building-view .renderer-stats")
          .getAttribute("data-sample"),
      ),
    )
    .toBeGreaterThan(0);
  const building = (await diagnostics(page)).last;
  await page.getByLabel("일시정지", { exact: true }).click();
  await go(page, "none");
  const report = {
    baselineHeap: baseline.usedSize,
    heaps,
    beforeListeners,
    afterListeners,
    city,
    building,
    buildingDisposed: (await diagnostics(page)).buildingDisposed,
    errors,
  };
  await writeFile(
    ".dev-checks/stability-measurements.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  expect(errors).toEqual([]);
});
test("모바일 라이트박스·내부 스크롤과 X 닫기", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".city-canvas canvas[data-camera]").waitFor();
  await go(page, "management");
  const box = await page.locator(".overlay-surface").boundingBox();
  expect(box!.width).toBe(390);
  expect(box!.height).toBe(844);
  await page.getByRole("region", { name: "운영실 내용" }).press("End");
  await expect
    .poll(() => page.locator(".management-scroll").evaluate((e) => e.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.screenshot({
    path: ".dev-checks/mobile-overlay-header.png",
    clip: { x: 0, y: 0, width: 390, height: 230 },
  });
  await go(page, "building");
  await expect(
    page.getByRole("button", { name: "오버레이 닫기", exact: true }),
  ).toBeInViewport();
  await go(page, "none");
  await expect(
    page.getByRole("navigation", { name: "게임 화면" }),
  ).toBeVisible();
});
test("WebGL 없이도 실제 관리·저장 UI에 접근한다", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "관리 화면에서 계속", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "공동체 운영실", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "저장", exact: true }),
  ).toBeAttached();
  await page
    .getByRole("button", { name: "도시로 돌아가기", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "3D 화면을 사용할 수 없습니다",
  );
});
