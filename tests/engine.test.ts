import { describe, expect, it } from "vitest";
import {
  advance,
  capacity,
  combatPower,
  deserialize,
  dispatch,
  economy,
  HOUR_MS,
  living,
  newGame,
  operating,
  party,
  requiredRelation,
  serialize,
  titleRequirements,
} from "../src/engine";
import type { Command, GameState, Role } from "../src/model";

function run(s: GameState, command: Command) {
  const result = dispatch(s, command);
  expect(result.error).toBeUndefined();
  return result.state;
}

describe("정착지 시뮬레이션", () => {
  it("10명의 주민과 쉘터로 시작하고 중복 작업 없이 생산·소비한다", () => {
    const s = newGame();
    const f = economy(s);
    expect(living(s)).toHaveLength(10);
    expect(operating(s)).toHaveLength(1);
    expect(Object.keys(f.jobs)).toHaveLength(10);
    const next = advance(s);
    expect(next.resources.food).toBeCloseTo(s.resources.food + f.delta.food);
    expect(next.resources.water).toBeCloseTo(s.resources.water + f.delta.water);
    expect(next.resources.materials).toBeCloseTo(
      s.resources.materials + f.delta.materials,
    );
    expect(next.people.every((p) => p.task !== "대기")).toBe(true);
    expect(s.hour).toBe(0);
  });
  it("인접 제약과 자원 부족을 검사하고 실패 시 상태를 보존한다", () => {
    const s = newGame();
    expect(dispatch(s, { type: "explore", building: 19 }).error).toBeDefined();
    expect(dispatch(s, { type: "restore", building: 1 }).error).toBeDefined();
    s.resources.food = 0;
    const result = dispatch(s, { type: "secure", building: 1 });
    expect(result.error).toBeDefined();
    expect(result.state).toBe(s);
  });
  it("탐색·협상·복구·이주·귀족 교섭으로 새 게임부터 남작이 된다", () => {
    let s = newGame();
    for (const [id, facility] of [
      [1, "farm"],
      [5, "pump"],
      [6, "housing"],
    ] as const) {
      if (s.buildings[id].status === "unknown")
        s = run(s, { type: "explore", building: id });
      s = run(s, { type: "negotiate", building: id });
      s = run(s, { type: "facility", building: id, facility });
      s = run(s, { type: "restore", building: id });
      expect(economy(s).builders.length).toBe(2);
      s = advance(s, 5);
      expect(s.buildings[id].status).toBe("operating");
    }
    s = advance(s, 36 - s.hour);
    expect(capacity(s)).toBe(15);
    expect(living(s)).toHaveLength(12);
    expect(titleRequirements(s).every((r) => r.current >= r.target)).toBe(true);
    expect(s.title).toBe("commoner");
    expect(
      dispatch(s, {
        type: "claim",
        faction: "bridge",
        allegiance: false,
        tax: false,
        military: false,
      }).error,
    ).toBeDefined();
    // Build a relationship through actual diplomatic actions, keeping independence.
    for (let i = 0; i < 4; i++) {
      if (s.resources.food < 15) s = advance(s, 8);
      s = run(s, { type: "gift", faction: "bridge" });
    }
    s = run(s, {
      type: "claim",
      faction: "bridge",
      allegiance: false,
      tax: false,
      military: false,
    });
    expect(s.title).toBe("baron");
    expect(s.contract).toEqual({
      patron: "bridge",
      allegiance: false,
      tax: false,
      military: false,
    });
    expect(advance(s).hour).toBe(s.hour + 1);
  });
  it("복구 작업은 생산 인력을 차지하고 여러 현장을 순서대로 처리한다", () => {
    let s = newGame();
    s = run(s, { type: "negotiate", building: 1 });
    s = run(s, { type: "negotiate", building: 5 });
    s = run(s, { type: "facility", building: 1, facility: "farm" });
    s = run(s, { type: "facility", building: 5, facility: "pump" });
    const before = economy(s);
    s = run(s, { type: "restore", building: 1 });
    s = run(s, { type: "restore", building: 5 });
    const during = economy(s);
    expect(during.builders).toHaveLength(2);
    expect(during.delta.food + during.delta.water).toBeLessThan(
      before.delta.food + before.delta.water,
    );
    s = advance(s);
    expect(s.buildings[1].progress).toBeGreaterThan(0);
    expect(s.buildings[5].progress).toBe(0);
    s = advance(s, 9);
    expect(s.buildings[1].status).toBe("operating");
    expect(s.buildings[5].status).toBe("operating");
  });
  it("부족은 욕구·사기·건강에 영향을 주고 발전 부족은 시설을 감산한다", () => {
    const s = newGame();
    s.resources.food = 0;
    s.resources.water = 0;
    s.people.forEach((p) => (p.role = "guard"));
    const next = advance(s, 12);
    expect(next.people[0].morale).toBeLessThan(s.people[0].morale);
    expect(next.people[0].health).toBeLessThan(100);
    expect(next.people[0].hunger).toBeGreaterThan(0);
    const powered = newGame();
    powered.buildings[1] = {
      ...powered.buildings[1],
      owner: "player",
      facility: "farm",
      status: "operating",
    };
    const full = economy(powered).delta.food;
    powered.resources.power = 0;
    expect(economy(powered).delta.food).toBeLessThan(full);
  });
});

describe("전투와 지도자", () => {
  it("같은 시드의 전투는 재현 가능하고 부상과 영토에 반영된다", () => {
    const s = newGame(131);
    const a = run(s, { type: "secure", building: 1 });
    const b = run(s, { type: "secure", building: 1 });
    expect(a).toEqual(b);
    expect(a.battles[0].won).toBe(true);
    expect(a.buildings[1].owner).toBe("player");
    expect(a.people.some((p) => p.injury > 0)).toBe(true);
    expect(party(s).some((p) => p.id === s.leader)).toBe(false);
    expect(s.buildings[1].owner).toBeNull();
  });
  it("장비·경비·사기·지형은 전투 결과와 세력 관계를 바꾼다", () => {
    let s = newGame();
    const old = combatPower(s);
    s = run(s, { type: "equipment" });
    expect(combatPower(s)).toBeGreaterThan(old);
    s.people.forEach((p) => (p.morale = 20));
    expect(combatPower(s)).toBeLessThan(old);
    s.buildings[1].owner = "iron";
    const relation = s.factions[2].relation;
    const result = run(s, { type: "secure", building: 1 });
    expect(result.factions[2].relation).toBe(relation - 20);
    expect(result.battles[0].defense).toBe(27);
  });
  it("지도자가 전사하면 시간을 멈추고 후계자로 상태를 이어간다", () => {
    let s = newGame();
    s.buildings[1].danger = 500;
    s = run(s, { type: "expeditionLeader", value: true });
    expect(party(s).some((p) => p.id === s.leader)).toBe(true);
    s = run(s, { type: "secure", building: 1 });
    expect(s.people.find((p) => p.id === s.leader)?.alive).toBe(false);
    expect(s.pendingSuccession).toBe(true);
    expect(advance(s, 5).hour).toBe(s.hour);
    expect(
      dispatch(s, { type: "policy", policy: "ration" }).error,
    ).toBeDefined();
    const continued = run(s, { type: "succeed" });
    expect(continued.leader).toBe("p1");
    expect(continued.pendingSuccession).toBe(false);
    expect(advance(continued).hour).toBe(continued.hour + 1);
    const ended = run(s, { type: "end" });
    expect(ended.ended).toBe(true);
    expect(advance(ended, 5).hour).toBe(ended.hour);
  });
});

describe("외교와 저장", () => {
  it("NPC 영토를 협상하면 소유권과 관계가 함께 변한다", () => {
    const s = newGame();
    s.buildings[1].owner = "tower";
    expect(dispatch(s, { type: "negotiate", building: 1 }).error).toBeDefined();
    s.factions[1].relation = 25;
    const next = run(s, { type: "negotiate", building: 1 });
    expect(next.buildings[1].owner).toBe("player");
    expect(next.factions[1].relation).toBe(30);
    expect(next.resources.food).toBe(s.resources.food - 30);
  });
  it("작위와 봉신 계약을 구별하고 의무는 정기적으로 정산한다", () => {
    expect(requiredRelation(false, false, false)).toBe(65);
    expect(requiredRelation(true, true, true)).toBe(30);
    const s = newGame();
    s.hour = 23;
    s.title = "baron";
    s.contract = {
      patron: "bridge",
      allegiance: false,
      tax: true,
      military: true,
    };
    const delta = economy(s).delta.food;
    const next = advance(s);
    expect(next.resources.food).toBeCloseTo(s.resources.food + delta - 8);
    const offline = advance(s, 1, true);
    expect(offline.resources.food).toBeCloseTo(s.resources.food + delta);
  });
  it("영토 인정은 건물별로 저장되며 같은 영토의 반복 인정은 차단한다", () => {
    let s = run(newGame(), { type: "recognition", faction: "bridge" });
    expect(s.factions[0].recognized).toEqual([0]);
    expect(s.factions[0].relation).toBe(33);
    expect(
      dispatch(s, { type: "recognition", faction: "bridge" }).error,
    ).toBeDefined();
    s = run(s, { type: "negotiate", building: 1 });
    s = run(s, { type: "recognition", faction: "bridge" });
    expect(s.factions[0].recognized).toEqual([0, 1]);
    expect(deserialize(serialize(s)).factions[0].recognized).toEqual([0, 1]);
  });
  it("저장 왕복으로 상태를 보존하고 부재 진행을 12시간으로 제한한다", () => {
    const s = newGame();
    const now = 100000;
    const raw = serialize(s, now);
    const same = deserialize(raw, now);
    expect(same).toEqual({ ...s, lastSavedAt: now });
    const later = deserialize(raw, now + HOUR_MS * 1000);
    expect(later.hour).toBe(12);
    expect(later.offlineSummary).toContain("12시간");
    expect(deserialize(raw, now - 1000).hour).toBe(0);
  });
  it("오프라인에는 치명적 결핍에서도 사망을 방지하고 계승은 보류한다", () => {
    const s = newGame();
    s.resources.food = 0;
    s.resources.water = 0;
    s.people.forEach((p) => {
      p.role = "guard";
      p.health = 3;
      p.hunger = 100;
      p.thirst = 100;
    });
    const next = deserialize(serialize(s, 1000), 1000 + HOUR_MS * 200);
    expect(next.people.every((p) => p.alive && p.health >= 25)).toBe(true);
    expect(next.pendingSuccession).toBe(false);
    s.pendingSuccession = true;
    expect(deserialize(serialize(s, 1000), 1000 + HOUR_MS * 200).hour).toBe(0);
  });
  it("잘못된 버전·손상 데이터·JSON을 거부한다", () => {
    expect(() => deserialize("not json")).toThrow();
    expect(() => deserialize('{"version":99}')).toThrow();
    const s = newGame();
    s.resources.food = NaN;
    expect(() => deserialize(serialize(s))).toThrow();
    const bad = newGame();
    bad.people[0].role = "invalid" as Role;
    expect(() => deserialize(serialize(bad))).toThrow();
  });
});
