import { test, expect } from "@playwright/test";
import { newGame, serialize } from "../../src/engine";
import { economy } from "../../src/economy";
test("실제 개척 명령: 복구 외형과 작업자, 완료 후 가동/예비 구획", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".city-canvas canvas[data-camera]").waitFor();
  await page.getByText("구역 건물 · 20동", { exact: true }).click();
  await page.getByLabel("옛 식료품점 선택", { exact: true }).click();
  await page.getByText("구역 건물 · 20동", { exact: true }).click();
  await page.getByRole("button", { name: "보급 협상", exact: true }).click();
  await page.getByRole("button", { name: "건물 관리", exact: true }).click();
  await page
    .getByRole("button", { name: "용도 지정 (즉시·무료)", exact: true })
    .click();
  await page
    .getByRole("button", { name: "도시로 돌아가기", exact: true })
    .click();
  await page.getByRole("button", { name: "복구 시작", exact: true }).click();
  await page
    .getByRole("button", { name: "선택 건물 중심", exact: true })
    .click();
  await page.waitForTimeout(1100);
  await expect(page.locator(".city-selection")).toContainText("복구 중");
  await page.screenshot({
    path: ".dev-checks/restoring-city.png",
    clip: { x: 440, y: 210, width: 450, height: 350 },
  });
  await page.getByRole("button", { name: "내부 보기", exact: true }).click();
  await expect(
    page.locator('[data-testid="building-view"][data-ready="true"]'),
  ).toBeVisible();
  await expect(page.locator(".overlay-header")).toContainText("현장 2명");
  await page.getByText("층과 방", { exact: true }).click();
  await page.getByRole("button", { name: /미복구 구획/ }).click();
  await expect(page.getByLabel("내부 선택 정보")).toContainText("복구 0%");
  const frozen = await page.evaluate(
    () =>
      (window as unknown as { __ASHEN_VISUALS__: { cityFrames: number } })
        .__ASHEN_VISUALS__.cityFrames,
  );
  for (let i = 0; i < 5; i++)
    await page.getByLabel("1시간 진행", { exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __ASHEN_VISUALS__: { cityFrames: number } })
          .__ASHEN_VISUALS__.cityFrames,
    ),
  ).toBe(frozen);
  await page
    .getByRole("button", { name: "도시로 돌아가기", exact: true })
    .click();
  await expect(page.locator(".city-selection")).toContainText("운영 중");
  await page.screenshot({
    path: ".dev-checks/restored-city.png",
    clip: { x: 440, y: 210, width: 450, height: 350 },
  });
  await page.getByRole("button", { name: "내부 보기", exact: true }).click();
  await expect(
    page.locator('[data-testid="building-view"][data-ready="true"]'),
  ).toBeVisible();
  await page.getByText("층과 방", { exact: true }).click();
  await page.getByRole("button", { name: /예비 구획/ }).click();
  await expect(page.getByLabel("내부 선택 정보")).toContainText(
    "독립 시설/생산 없음",
  );
});
test("v2 JSON 가져오기: 무전력 잔여 생산과 허기/갈증, 미공급 경고", async ({
  page,
}) => {
  const state = newGame(727, Date.now());
  Object.assign(state.buildings[1], {
    owner: "player",
    status: "operating",
    facility: "farm",
    structure: 100,
    progress: 100,
  });
  state.resources = { food: 0, water: 0, power: 0, materials: 100 };
  state.people.forEach((p, i) => {
    p.role = i === 1 || i === 2 ? "farmer" : "guard";
    p.health = i === 1 || i === 2 ? 30 : 100;
    p.hunger = 80;
    p.thirst = 70;
  });
  const food = economy(state).facilities[1].output.food;
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator(".city-canvas canvas[data-camera]").waitFor();
  await page
    .getByRole("navigation", { name: "게임 화면" })
    .getByRole("button", { name: "관리", exact: true })
    .click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "v2-shortage.json",
    mimeType: "application/json",
    buffer: Buffer.from(serialize(state)),
  });
  await expect(page.locator("[data-overlay]")).toHaveAttribute(
    "data-overlay",
    "none",
  );
  await expect(
    page.getByLabel("식량 공급 부족", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("식수 공급 부족", { exact: true }),
  ).toBeVisible();
  await page.getByText("구역 건물 · 20동", { exact: true }).click();
  await page.getByLabel("옛 식료품점 선택", { exact: true }).click();
  await page.getByRole("button", { name: "내부 보기", exact: true }).click();
  await expect(
    page.locator('[data-testid="building-view"][data-ready="true"]'),
  ).toBeVisible();
  await page.getByText("층과 방", { exact: true }).click();
  await page.getByRole("button", { name: /수경 재배실/ }).click();
  await expect(page.getByLabel("내부 선택 정보")).toContainText(
    `${food.toFixed(1)}/h`,
  );
  await expect(page.getByLabel("내부 선택 정보")).toContainText("운영 중");
  await expect(page.getByLabel("내부 선택 정보")).toContainText("전력 부족");
  await page.getByText("현장 주민 · 2명", { exact: true }).click();
  await page.getByRole("button", { name: /도윤.*식량/ }).click();
  await expect(page.getByLabel("내부 선택 정보")).toContainText(
    "허기 80 · 갈증 70",
  );
  await page.screenshot({
    path: ".dev-checks/shortage-building.png",
    clip: { x: 260, y: 230, width: 700, height: 400 },
  });
});
