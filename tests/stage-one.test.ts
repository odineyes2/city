import { describe, it, expect } from "vitest";
import {
  advance,
  dispatch,
  newGame,
  economy,
  serialize,
  deserialize,
  storage,
  actionInfo,
} from "../src/engine";
import { decodeSave } from "../src/save";
import { onlineElapsed } from "../src/time";
import { TIME, ECONOMY, WORK } from "../src/config";
import { projectQuote } from "../src/buildings";
import { workerEfficiency } from "../src/economy";
import { resumeGame, saveGame, AUTO } from "../src/storage";
import type { Command, Facility, GameState } from "../src/model";
const apply = (s: GameState, c: Command) => {
  const result = dispatch(s, c);
  expect(result.error).toBeUndefined();
  return result.state;
};
const fixture = () => newGame(727, 1000);
function operating(s: GameState, id: number, facility: Facility) {
  Object.assign(s.buildings[id], {
    owner: "player",
    status: "operating",
    facility,
    progress: 100,
  });
  return s;
}
function project(s: GameState, id = 5) {
  const b = s.buildings[id];
  Object.assign(b, {
    owner: "player",
    status: "restoring",
    facility: "workshop",
    project: {
      kind: "restore",
      target: "workshop",
      paidMaterials: 20,
      workRequired: 100,
    },
    progress: 0,
  });
  return s;
}
class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}

describe("시간과 재개", () => {
  it("온라인 실경과와 속도를 누적하고 일시정지·종료·계승은 중단한다", () => {
    let s = apply(fixture(), { type: "speed", speed: 1 });
    s = onlineElapsed(s, 1500);
    expect(s.hour).toBe(0);
    expect(s.clock.onlineRemainderMs).toBe(1500);
    s = onlineElapsed(s, 1500);
    expect(s.hour).toBe(1);
    expect(s.clock.onlineRemainderMs).toBe(0);
    s = apply(s, { type: "speed", speed: 2 });
    s = onlineElapsed(s, 1500);
    expect(s.hour).toBe(2);
    s = apply(s, { type: "speed", speed: 4 });
    s = onlineElapsed(s, 750);
    expect(s.hour).toBe(3);
    const paused = apply(s, { type: "speed", speed: 0 });
    expect(onlineElapsed(paused, 999999)).toBe(paused);
    expect(onlineElapsed(s, NaN)).toBe(s);
    expect(onlineElapsed({ ...s, ended: true }, 999999).hour).toBe(3);
    expect(onlineElapsed({ ...s, pendingSuccession: true }, 999999).hour).toBe(
      3,
    );
    expect(onlineElapsed(s, TIME.onlineHourMs * 1e6).hour - s.hour).toBe(
      TIME.onlineCatchupLimit,
    );
  });
  it("일시정지 저장은 부재 진행하지 않고 이전 속도를 복원한다", () => {
    const paused = fixture();
    expect(
      deserialize(serialize(paused, 1000), 1000 + TIME.offlineHourMs * 100)
        .hour,
    ).toBe(0);
    const running = apply(paused, { type: "speed", speed: 4 });
    const restored = deserialize(
      serialize(running, 1000),
      1000 + TIME.offlineHourMs * 2,
    );
    expect(restored.hour).toBe(2);
    expect(restored.clock.speed).toBe(4);
    expect(TIME.offlineHourMs).toBeGreaterThan(TIME.onlineHourMs);
  });
  it("오프라인 분수 시간·12시간 상한·시계 역행을 처리한다", () => {
    const s = apply(fixture(), { type: "speed", speed: 1 });
    const half = deserialize(serialize(s, 1000), 1000 + TIME.offlineHourMs / 2);
    expect(half.hour).toBe(0);
    expect(half.clock.offlineRemainderMs).toBe(TIME.offlineHourMs / 2);
    const whole = deserialize(
      serialize(half, half.lastSavedAt),
      half.lastSavedAt + TIME.offlineHourMs / 2,
    );
    expect(whole.hour).toBe(1);
    expect(
      deserialize(serialize(s, 1000), 1000 + TIME.offlineHourMs * 100).hour,
    ).toBe(12);
    expect(deserialize(serialize(s, 1000), 0).hour).toBe(0);
  });
  it("같은 저장의 재로드는 이미 계산한 오프라인 경제와 이주를 중복 반영하지 않는다", () => {
    const store = new MemoryStorage(),
      s = apply(fixture(), { type: "speed", speed: 2 }),
      raw = serialize(s, 1000),
      now = 1000 + TIME.offlineHourMs * 6;
    const first = resumeGame(raw, store, now),
      again = resumeGame(raw, store, now);
    expect(again.hour).toBe(first.hour);
    expect(again.resources).toEqual(first.resources);
    expect(again.people).toEqual(first.people);
    expect(again.logs.filter((l) => l.text.startsWith("부재 중"))).toHaveLength(
      1,
    );
    saveGame(AUTO, advance(first, 2), store, now + TIME.offlineHourMs);
    expect(resumeGame(raw, store, now + TIME.offlineHourMs).hour).toBe(
      first.hour,
    );
  });
  it("복구 완료·자원·인구 변화를 부재 요약과 중요 기록에 남긴다", () => {
    const s = project(apply(fixture(), { type: "speed", speed: 1 }));
    const restored = deserialize(
      serialize(s, 1000),
      1000 + TIME.offlineHourMs * 6,
    );
    expect(restored.buildings[5].status).toBe("operating");
    expect(restored.offlineSummary).toContain("골목 정비소");
    expect(restored.offlineSummary).toContain("식량");
    expect(restored.offlineSummary).toContain("주민");
    expect(
      restored.logs.some((l) => l.important && l.text.includes("복구 완료")),
    ).toBe(true);
  });
  it("저장소 쓰기 실패 시 재개 상태를 적용하지 않고 명확히 실패한다", () => {
    const bad = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    const raw = serialize(apply(fixture(), { type: "speed", speed: 1 }), 1000);
    expect(() => resumeGame(raw, bad, 1000 + TIME.offlineHourMs)).toThrow(
      "quota",
    );
    expect(() => saveGame(AUTO, fixture(), bad)).toThrow("quota");
  });
  it("손상된 재개 영수증은 오프라인 보상을 재지급하지 않고 거부한다", () => {
    const store = new MemoryStorage(),
      s = apply(fixture(), { type: "speed", speed: 1 });
    store.setItem(`ashen-city-resume-v2-${s.campaignId}`, "broken");
    expect(() =>
      resumeGame(serialize(s, 1000), store, 1000 + TIME.offlineHourMs),
    ).toThrow("재개 기록");
    expect(s.hour).toBe(0);
  });
});

describe("경제 원장과 전력", () => {
  it("생산·생활/시설 소비·저장 초과와 실제 틱을 정확히 일치시킨다", () => {
    const s = operating(fixture(), 1, "farm");
    s.resources.food = storage(s);
    const f = economy(s),
      next = advance(s);
    for (const k of ["food", "water", "power", "materials"] as const) {
      expect(f.consumption[k]).toBeCloseTo(
        f.livingConsumption[k] + f.facilityConsumption[k],
      );
      expect(next.resources[k] - s.resources[k]).toBeCloseTo(f.delta[k]);
      expect(next.resources[k]).toBeGreaterThanOrEqual(0);
      expect(next.resources[k]).toBeLessThanOrEqual(storage(s));
    }
    expect(f.overflow.food).toBeGreaterThan(0);
    expect(f.delta.food).toBe(0);
  });
  it("재고 0에서도 그 시간의 발전량을 시설에 공급한다", () => {
    const s = operating(fixture(), 1, "farm");
    s.resources.power = 0;
    s.priorities.power = 2;
    const f = economy(s);
    expect(f.production.power).toBeGreaterThan(f.powerDemand);
    expect(f.facilities[1].powerUsed).toBeCloseTo(f.facilities[1].powerDemand);
    expect(f.facilities[1].reason).not.toContain("전력 부족");
  });
  it("부족한 전력은 분야 우선순위로 배분하고 부분 효율을 예측과 일치시킨다", () => {
    const s = operating(operating(fixture(), 1, "farm"), 2, "pump");
    s.resources.power = 0.55;
    s.people.forEach(
      (p, i) => (p.role = i < 2 ? "farmer" : i < 4 ? "engineer" : "guard"),
    );
    s.priorities.food = 2;
    const foodFirst = economy(s);
    expect(foodFirst.facilities[1].powerUsed).toBeCloseTo(0.3);
    expect(foodFirst.facilities[2].powerUsed).toBe(0);
    s.priorities.food = 1;
    s.priorities.water = 2;
    const waterFirst = economy(s);
    expect(waterFirst.facilities[2].powerUsed).toBeCloseTo(0.3);
    expect(waterFirst.facilities[1].powerUsed).toBe(0);
    expect(waterFirst.facilities[1].output.food).toBeLessThan(
      foodFirst.facilities[1].output.food,
    );
    const next = advance(s);
    expect(next.resources.food - s.resources.food).toBeCloseTo(
      waterFirst.delta.food,
    );
    expect(next.resources.power).toBeCloseTo(0);
  });
  it("인구 소비와 부족 예상, 유지 자재 부족을 분리해 계산한다", () => {
    const s = operating(fixture(), 4, "generator");
    s.resources.materials = 0;
    s.people.forEach((p) => (p.role = "engineer"));
    const f = economy(s);
    expect(f.unmet.materials).toBeGreaterThan(0);
    expect(f.facilities[4].reason).toContain("유지 자재 부족");
    const before = f.demand.food;
    s.people.push({ ...s.people[0], id: "extra", assignment: null });
    expect(economy(s).demand.food - before).toBeCloseTo(
      ECONOMY.consumption.food,
    );
    expect(f.shortageHours.food).not.toBeNull();
  });
});

describe("구조물과 시설 전환", () => {
  it("건물 적합성은 생산량과 복구 비용을 바꾸며 설치 제한을 적용한다", () => {
    const a = operating(fixture(), 1, "farm");
    a.people.forEach((p, i) => (p.role = i < 2 ? "farmer" : "guard"));
    a.resources.power = 100;
    const b = operating(fixture(), 9, "farm");
    b.people = a.people;
    b.resources.power = 100;
    expect(
      economy(b).facilities[9].output.food /
        economy(a).facilities[1].output.food,
    ).toBeCloseTo(
      b.buildings[9].suitability.farm / a.buildings[1].suitability.farm,
    );
    const quote = projectQuote(a.buildings[4], "generator", false),
      neutral = structuredClone(a.buildings[4]);
    neutral.suitability.generator = 1;
    expect(quote.materials).toBeLessThan(
      projectQuote(neutral, "generator", false).materials,
    );
    const residential = a.buildings[3];
    residential.owner = "player";
    residential.status = "secured";
    expect(
      dispatch(a, { type: "facility", building: 3, facility: "generator" })
        .error,
    ).toBeDefined();
  });
  it("운영 시설의 전환은 한 번 자재를 내고 생산 중단 후 시간을 거쳐 완료된다", () => {
    let s = operating(fixture(), 1, "farm");
    const q = projectQuote(s.buildings[1], "pump");
    const stock = s.resources.materials;
    s = apply(s, {
      type: "facility",
      building: 1,
      facility: "pump",
      id: "convert-1",
    });
    expect(stock - s.resources.materials).toBe(q.materials);
    expect(s.buildings[1].status).toBe("restoring");
    expect(s.buildings[1].facility).toBe("farm");
    expect(s.buildings[1].project?.target).toBe("pump");
    expect(economy(s).facilities[1]).toBeUndefined();
    expect(
      dispatch(s, {
        type: "facility",
        building: 1,
        facility: "pump",
        id: "convert-1",
      }).state,
    ).toBe(s);
    s = advance(s);
    const restored = deserialize(serialize(s, 1000), 1000);
    expect(restored.buildings[1].project).toEqual(s.buildings[1].project);
    expect(restored.buildings[1].progress).toBe(s.buildings[1].progress);
    s = advance(restored, 8);
    expect(s.buildings[1].status).toBe("operating");
    expect(s.buildings[1].facility).toBe("pump");
    expect(s.buildings[1].project).toBeNull();
  });
  it("인력이 없으면 선납 작업은 자재 추가 차감 없이 대기하고 재배치 후 진행한다", () => {
    let s = operating(fixture(), 1, "farm");
    s.people.forEach((p) => (p.role = "guard"));
    s = apply(s, { type: "facility", building: 1, facility: "pump" });
    const stock = s.resources.materials;
    s = advance(s, 3);
    expect(s.buildings[1].progress).toBe(0);
    expect(s.resources.materials).toBe(stock);
    expect(economy(s).warnings.some((w) => w.includes("복구 인력 대기"))).toBe(
      true,
    );
    s = apply(s, { type: "role", person: "p1", role: "engineer" });
    expect(advance(s).buildings[1].progress).toBeGreaterThan(0);
  });
});

describe("자율 배정과 명령 일관성", () => {
  it("높은 생산 우선순위는 복구와 경쟁하며 실제 생산을 바꾼다", () => {
    const s = project(operating(fixture(), 1, "farm"));
    s.people.forEach((p, i) => (p.role = i < 3 ? "farmer" : "guard"));
    const before = economy(s);
    expect(before.builders).toHaveLength(2);
    const next = apply(s, { type: "priority", area: "food", priority: 2 }),
      after = economy(next);
    expect(after.builders).toHaveLength(0);
    expect(after.production.food).toBeGreaterThan(before.production.food);
    expect(next.priorities.food).toBe(2);
  });
  it("한 주민은 한 작업만 맡고 불필요한 시간별 이동을 피한다", () => {
    const s = advance(operating(fixture(), 1, "farm"));
    const a = economy(s),
      b = economy(advance(s));
    expect(a.assignments).toEqual(b.assignments);
    expect(Object.keys(a.assignments)).toHaveLength(s.people.length);
    const counts = new Map<string, number>();
    for (const f of Object.values(a.facilities))
      for (const id of f.workers) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const p of a.builders) counts.set(p.id, (counts.get(p.id) ?? 0) + 1);
    expect([...counts.values()].every((n) => n === 1)).toBe(true);
  });
  it("부상·건강은 근무 제한과 생산 효율에 반영된다", () => {
    const s = fixture();
    s.people[1].injury = WORK.maxInjury;
    s.people[2].health = 20;
    const f = economy(s);
    expect(f.assignments.p1).toBeNull();
    expect(f.assignments.p2).toBeNull();
    const hurt = { ...s.people[0], health: 45, injury: 40 };
    expect(workerEfficiency(hurt)).toBeLessThan(workerEfficiency(s.people[0]));
    const battle = apply(
      apply(fixture(), { type: "expeditionLeader", value: true }),
      { type: "secure", building: 1 },
    );
    expect(battle.people.some((p) => p.injury > 0)).toBe(true);
    expect(
      battle.people
        .filter((p) => p.health < WORK.minHealth || p.injury >= WORK.maxInjury)
        .every((p) => economy(battle).assignments[p.id] === null || !p.alive),
    ).toBe(true);
  });
  it("같은 요청 ID는 저장 후에도 비용을 이중 차감하지 않으며 실패는 원본을 보존한다", () => {
    const s = apply(fixture(), {
        type: "gift",
        faction: "bridge",
        id: "gift-1",
      }),
      same = dispatch(s, { type: "gift", faction: "bridge", id: "gift-1" });
    expect(same.state).toBe(s);
    const saved = deserialize(serialize(s, 1000), 1000);
    expect(
      dispatch(saved, { type: "gift", faction: "bridge", id: "gift-1" }).state
        .resources,
    ).toEqual(s.resources);
    const noFood = fixture();
    noFood.resources.food = 0;
    const info = actionInfo(noFood, { type: "secure", building: 1 });
    expect(info.allowed).toBe(false);
    expect(info.reason).toContain("식량");
    expect(dispatch(noFood, { type: "secure", building: 1 }).state).toBe(
      noFood,
    );
    expect(dispatch(noFood, { type: "party", size: NaN }).error).toBeDefined();
  });
  it("최고 관계의 선물과 저장 공간 없는 교역은 비용을 차감하지 않는다", () => {
    const s = fixture();
    s.factions[0].relation = 100;
    s.resources.materials = storage(s);
    expect(dispatch(s, { type: "gift", faction: "bridge" }).state).toBe(s);
    expect(dispatch(s, { type: "trade", faction: "bridge" }).state).toBe(s);
    expect(
      actionInfo(s, { type: "trade", faction: "bridge" }).reason,
    ).toContain("저장 공간");
  });
});

describe("v1 이관과 저장 경계", () => {
  function legacy() {
    const s = project(fixture());
    s.buildings[5].progress = 42;
    s.resources.food = 31;
    const raw = JSON.parse(serialize(s, 1000));
    raw.version = 1;
    for (const key of [
      "campaignId",
      "revision",
      "clock",
      "priorities",
      "processedCommands",
      "warnings",
    ])
      delete raw[key];
    for (const p of raw.people) delete p.assignment;
    for (const b of raw.buildings)
      for (const key of [
        "type",
        "structure",
        "repairDifficulty",
        "allowedFacilities",
        "suitability",
        "effects",
        "project",
      ])
        delete b[key];
    return raw;
  }
  it("v1의 주민·자원·영토·복구 진행을 보존하고 안전하게 정지한다", () => {
    const raw = legacy(),
      s = deserialize(JSON.stringify(raw), 1000 + TIME.offlineHourMs * 100);
    expect(s.version).toBe(2);
    expect(s.resources.food).toBe(31);
    expect(s.hour).toBe(0);
    expect(s.clock.speed).toBe(0);
    expect(s.buildings[5].progress).toBe(42);
    expect(s.buildings[5].project?.workRequired).toBe(100);
    expect(s.people.map((p) => p.name)).toEqual(
      raw.people.map((p: { name: string }) => p.name),
    );
    expect(advance(s, 5).buildings[5].status).toBe("operating");
  });
  it("v1에서 쓰던 비적합 시설도 강제 철거하지 않는다", () => {
    const raw = legacy();
    Object.assign(raw.buildings[3], {
      owner: "player",
      status: "operating",
      facility: "generator",
    });
    const s = decodeSave(JSON.stringify(raw));
    expect(s.buildings[3].allowedFacilities).toContain("generator");
    expect(s.buildings[3].facility).toBe("generator");
  });
  it("v1 작위·계약·귀족 관계를 보존하고 원본을 별도 백업한다", () => {
    const raw = legacy();
    raw.title = "baron";
    raw.contract = {
      patron: "bridge",
      allegiance: false,
      tax: true,
      military: false,
    };
    raw.factions[0].relation = 73;
    const store = new MemoryStorage(),
      text = JSON.stringify(raw),
      s = resumeGame(text, store, 1000 + TIME.offlineHourMs);
    expect(s.title).toBe("baron");
    expect(s.contract).toEqual(raw.contract);
    expect(s.factions[0].relation).toBe(73);
    expect(
      [...store.values.entries()].some(
        ([key, value]) =>
          key.startsWith("ashen-city-v1-backup-") && value === text,
      ),
    ).toBe(true);
  });
  it("v2 왕복은 우선순위·속도·배정·전환 작업과 잔여 시간을 보존한다", () => {
    let s = apply(
      apply(operating(fixture(), 1, "farm"), {
        type: "priority",
        area: "power",
        priority: 2,
      }),
      { type: "facility", building: 1, facility: "pump" },
    );
    s = advance(s);
    s = apply(s, { type: "speed", speed: 4 });
    s = onlineElapsed(s, 100);
    expect(deserialize(serialize(s, 1000), 1000)).toEqual({
      ...s,
      lastSavedAt: 1000,
    });
  });
  it("비정상 수치·관계 참조·불가능한 작업 조합을 거부한다", () => {
    const corruptors = [
      (s: GameState) => (s.clock.speed = 3 as never),
      (s: GameState) => (s.resources.water = -1),
      (s: GameState) => (s.buildings[1].owner = "missing"),
      (s: GameState) => (s.buildings[1].status = "restoring"),
      (s: GameState) => (s.people[0].health = Infinity),
      (s: GameState) => (s.priorities.food = 7 as never),
      (s: GameState) =>
        (s.people[0].assignment = { area: "food", building: 99 }),
      (s: GameState) =>
        (s.contract = {
          patron: "missing",
          tax: false,
          military: false,
          allegiance: false,
        }),
    ];
    for (const corrupt of corruptors) {
      const s = fixture();
      corrupt(s);
      expect(() => decodeSave(serialize(s, 1000))).toThrow();
    }
  });
});
