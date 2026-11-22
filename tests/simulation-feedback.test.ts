import { describe, it, expect } from "vitest";
import { newGame, dispatch, advance, serialize } from "../src/engine";
import { economy } from "../src/economy";
import { presentGame } from "../src/game/presentation/GamePresentation";
function farm() {
  const s = newGame(727, 1000);
  Object.assign(s.buildings[1], {
    owner: "player",
    status: "operating",
    facility: "farm",
    structure: 100,
    progress: 100,
  });
  return s;
}
describe("실제 원장 기반 시각 피드백", () => {
  it("무전력 시설도 실제 잔여 생산과 작업을 유지하고 조명 공급만 0으로 표시한다", () => {
    const s = farm();
    s.resources.power = 0;
    for (const p of s.people) if (p.role === "engineer") p.role = "farmer";
    const p = presentGame(s, 1),
      f = economy(s).facilities[1],
      room = p.interior.rooms.find((r) => r.kind === "hydro")!;
    expect(f.output.food).toBeGreaterThan(0);
    expect(room.active).toBe(true);
    expect(room.powerSupply).toBe(0);
    expect(room.activity).toBeGreaterThan(0);
    expect(room.activity).toBeLessThan(1);
    expect(room.output).toContain(f.output.food.toFixed(1));
    expect(p.city[1].powerSupply).toBe(0);
    expect(p.city[1].warning).toContain("전력 부족");
  });
  it("재고 0만으로 부족을 꾸미지 않고 실제 미공급량과 허기·갈증을 읽는다", () => {
    const s = newGame(727, 1000);
    s.resources.food = 0;
    let p = presentGame(s);
    expect(p.feedback.food.unmet).toBe(0);
    for (const person of s.people) {
      person.role = "guard";
      person.hunger = 70;
      person.thirst = 65;
    }
    s.resources.water = 0;
    const before = structuredClone(s);
    p = presentGame(s);
    expect(p.feedback.food.unmet).toBeGreaterThan(0);
    expect(p.feedback.water.unmet).toBeGreaterThan(0);
    expect(p.interior.residents[0].warning).toContain("허기 70");
    expect(p.interior.residents[0].thirst).toBe(65);
    expect(p.interior.residents.every((r) => r.state !== "injured")).toBe(true);
    expect(s).toEqual(before);
  });
  it("실제 복구 완료 후 구조와 예비 구획을 개선하고 공사 효과를 종료한다", () => {
    let s = newGame(727, 1000);
    for (const command of [
      { type: "negotiate", building: 1 },
      { type: "facility", building: 1, facility: "farm" },
      { type: "restore", building: 1 },
    ] as const)
      s = dispatch(s, command).state;
    expect(
      presentGame(s, 1).interior.rooms.find((r) => r.kind === "repair")?.active,
    ).toBe(true);
    s = advance(s, 5);
    const p = presentGame(s, 1),
      room = p.interior.rooms.find((r) => r.kind === "repair")!;
    expect(p.city[1].condition).toBe(100);
    expect(p.city[1].status).toBe("operating");
    expect(room.restored).toBe(true);
    expect(room.active).toBe(false);
    expect(room.label).toBe("예비 구획");
    expect(room.activity).toBe(0);
  });
  it("무인 시설·부상자·미점령 건물을 가동 노동으로 꾸미지 않는다", () => {
    const s = farm();
    for (const person of s.people) person.role = "guard";
    s.people[0].injury = 90;
    let p = presentGame(s, 1);
    expect(p.interior.rooms.find((r) => r.kind === "hydro")?.active).toBe(
      false,
    );
    expect(p.city[1].activity).toBe(0);
    expect(p.interior.residents.find((r) => r.id === "p0")?.state).toBe(
      "injured",
    );
    s.buildings[1].owner = null;
    s.buildings[1].status = "discovered";
    p = presentGame(s, 1);
    expect(p.interior.residents.every((r) => !r.present)).toBe(true);
    expect(p.interior.rooms.every((r) => !r.active)).toBe(true);
  });
});
