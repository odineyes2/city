import { describe, it, expect } from "vitest";
import {
  newGame,
  dispatch,
  advance,
  serialize,
  deserialize,
} from "../src/engine";
import { economy } from "../src/economy";
import { presentGame } from "../src/game/presentation/GamePresentation";
describe("엔진과 공간 화면 동기화", () => {
  it("우선순위 변경의 실제 배정과 방별 인원이 일치하고 중복 주민이 없다", () => {
    let s = newGame(727, 1000);
    s = dispatch(s, { type: "priority", area: "food", priority: 2 }).state;
    s = dispatch(s, { type: "priority", area: "power", priority: 0 }).state;
    const p = presentGame(s),
      flow = economy(s);
    for (const person of p.interior.residents)
      expect(person.area).toBe(flow.assignments[person.id]?.area ?? null);
    const ids = p.interior.rooms.flatMap((r) => r.workers);
    expect(new Set(ids).size).toBe(ids.length);
    expect(p.interior.rooms.find((r) => r.kind === "hydro")?.workers).toEqual(
      p.interior.residents
        .filter((r) => r.area === "food" && r.present)
        .map((r) => r.id),
    );
  });
  it("복구자는 실제 현장에만 존재하고 완료·전환 상태와 출력은 엔진을 따른다", () => {
    let s = newGame(727, 1000);
    s = dispatch(s, { type: "negotiate", building: 1 }).state;
    s = dispatch(s, { type: "facility", building: 1, facility: "farm" }).state;
    s = dispatch(s, { type: "restore", building: 1 }).state;
    const flow = economy(s),
      site = presentGame(s, 1),
      home = presentGame(s);
    expect(site.city[1].workerCount).toBe(flow.builders.length);
    for (const worker of flow.builders) {
      expect(
        site.interior.residents.find((r) => r.id === worker.id)?.present,
      ).toBe(true);
      expect(
        home.interior.residents.find((r) => r.id === worker.id)?.present,
      ).toBe(false);
    }
    expect(site.interior.rooms.find((r) => r.kind === "repair")?.active).toBe(
      true,
    );
    s = advance(s, 5);
    const p = presentGame(s, 1);
    expect(p.interior.rooms.find((r) => r.kind === "repair")?.active).toBe(
      false,
    );
    expect(p.interior.rooms.find((r) => r.kind === "hydro")?.output).toContain(
      economy(s).facilities[1].output.food.toFixed(1),
    );
    s = dispatch(s, { type: "facility", building: 1, facility: "pump" }).state;
    expect(
      presentGame(s, 1).interior.rooms.find((r) => r.kind === "hydro")?.active,
    ).toBe(false);
  });
  it("전력·인력 부족과 실제 경고를 전달한다", () => {
    const s = newGame(727, 1000);
    s.resources.power = 0;
    for (const p of s.people) {
      p.health = 5;
      p.injury = 90;
    }
    Object.assign(s.buildings[1], {
      owner: "player",
      status: "operating",
      facility: "farm",
      progress: 100,
    });
    const flow = economy(s),
      p = presentGame(s, 1);
    expect(p.city[1].powered).toBe(false);
    expect(p.city[1].warning).toBe(flow.facilities[1].reason);
    expect(p.warnings).toEqual(flow.warnings);
    expect(p.interior.residents.every((r) => r.state === "injured")).toBe(true);
  });
  it("기존 저장 왕복은 시각화·배정·복구·귀족·시간을 보존하고 렌더링 상태를 저장하지 않는다", () => {
    let s = newGame(727, 1000);
    s = dispatch(s, { type: "negotiate", building: 1 }).state;
    s = dispatch(s, { type: "facility", building: 1, facility: "farm" }).state;
    s = dispatch(s, { type: "restore", building: 1 }).state;
    s = advance(s, 1);
    const encoded = serialize(s),
      loaded = deserialize(encoded, 1000);
    expect(loaded).not.toBeNull();
    expect(presentGame(loaded!, 1)).toEqual(presentGame(s, 1));
    expect(loaded!.factions).toEqual(s.factions);
    expect(JSON.parse(encoded).version).toBe(2);
    expect(encoded).not.toContain("walking");
    expect(encoded).not.toContain("camera");
  });
});
