// v1 이관과 저장 경계 검증. 브라우저 I/O는 storage.ts에만 둔다.
import { advance } from "./engine";
import { buildingTraits, BUILDING_TYPES } from "./buildings";
import { DEFAULT_PRIORITIES, RESOURCES, TIME } from "./config";
import { offlineElapsed } from "./time";
import type { Assignment, GameState, Resource, Stock } from "./model";
const roles = ["farmer", "engineer", "scavenger", "guard"],
  facilities = ["farm", "pump", "generator", "workshop", "housing", "barracks"],
  statuses = ["unknown", "discovered", "secured", "restoring", "operating"],
  categories = ["system", "work", "combat", "diplomacy"];
function valid(
  condition: unknown,
  message = "저장 데이터가 손상되었습니다.",
): asserts condition {
  if (!condition) throw new Error(message);
}
function num(n: unknown, min = 0, max = 1e9) {
  return typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
}
function integer(n: unknown, min = 0, max = 1e9) {
  return num(n, min, max) && Number.isInteger(n);
}
function text(s: unknown, max = 2000) {
  return typeof s === "string" && s.length <= max;
}
const bool = (v: unknown) => typeof v === "boolean";
export function hashText(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
export function serialize(s: GameState, now = Date.now()) {
  valid(num(now, 0, 1e15), "저장 시각이 올바르지 않습니다.");
  return JSON.stringify({ ...s, lastSavedAt: now });
}
export function decodeSave(raw: string): GameState {
  valid(
    typeof raw === "string" && raw.length <= 2_000_000,
    "저장 파일 크기 또는 형식이 올바르지 않습니다.",
  );
  const candidate: unknown = JSON.parse(raw);
  valid(candidate && typeof candidate === "object");
  // 아래 모든 필드를 검증하기 전에는 이 객체를 시뮬레이션에 전달하지 않는다.
  const s = candidate as GameState;
  const version = (candidate as { version: unknown }).version;
  valid(version === 1 || version === 2, "지원하지 않는 저장 버전입니다.");
  valid(
    Array.isArray(s.people) &&
      s.people.length > 0 &&
      s.people.length <= 5000 &&
      s.people.every((p) => p && typeof p === "object"),
  );
  valid(
    Array.isArray(s.buildings) &&
      s.buildings.length === 20 &&
      s.buildings.every((b) => b && typeof b === "object"),
  );
  valid(
    Array.isArray(s.factions) &&
      s.factions.length === 3 &&
      s.factions.every((f) => f && typeof f === "object"),
  );
  valid(
    s.resources &&
      typeof s.resources === "object" &&
      RESOURCES.every((k) => num(s.resources[k], 0, 1e6)),
  );
  valid(
    integer(s.hour) &&
      integer(s.seed, 0, 0xffffffff) &&
      num(s.lastSavedAt, 0, 1e15) &&
      integer(s.nextLog),
  );
  valid(
    [s.pendingSuccession, s.ended, s.expeditionLeader].every(bool) &&
      !(s.ended && s.pendingSuccession),
  );
  valid(
    integer(s.partySize, 1, 6) &&
      integer(s.equipment, 1, 4) &&
      ["balanced", "ration", "salvage"].includes(s.policy) &&
      ["commoner", "baron"].includes(s.title),
  );
  valid(
    s.people.every(
      (p) =>
        text(p.id, 100) &&
        p.id.length > 0 &&
        text(p.name, 100) &&
        roles.includes(p.role) &&
        num(p.skill, 0.1, 10) &&
        [p.morale, p.health, p.hunger, p.thirst, p.injury].every((v) =>
          num(v, 0, 100),
        ) &&
        bool(p.alive) &&
        text(p.task) &&
        (!p.alive ? p.health === 0 : true),
    ),
  );
  valid(new Set(s.people.map((p) => p.id)).size === s.people.length);
  const leader = s.people.find((p) => p.id === s.leader);
  valid(leader && (leader.alive || s.pendingSuccession || s.ended));
  valid(!s.pendingSuccession || !leader.alive);
  valid(
    s.successor === null ||
      s.people.some((p) => p.id === s.successor && p.id !== s.leader),
  );
  valid(
    s.factions.every(
      (f) =>
        ["bridge", "tower", "iron"].includes(f.id) &&
        text(f.name, 100) &&
        text(f.leader, 100) &&
        text(f.title, 100) &&
        /^#[a-fA-F0-9]{6}$/.test(f.color) &&
        num(f.relation, -100, 100) &&
        RESOURCES.includes(f.resource) &&
        text(f.interest),
    ),
  );
  valid(new Set(s.factions.map((f) => f.id)).size === 3);
  valid(
    s.contract === null ||
      (s.contract &&
        s.title === "baron" &&
        s.factions.some((f) => f.id === s.contract!.patron) &&
        [s.contract.allegiance, s.contract.tax, s.contract.military].every(
          bool,
        )),
  );
  valid(s.title !== "baron" || s.contract !== null);
  for (const f of s.factions) {
    if (version === 1 && f.recognized === undefined) f.recognized = [];
    valid(
      Array.isArray(f.recognized) &&
        f.recognized.every((id) => integer(id, 0, 19)),
    );
  }
  valid(
    s.buildings.every(
      (b, i) =>
        b.id === i &&
        b.x === i % 5 &&
        b.y === Math.floor(i / 5) &&
        text(b.name, 100) &&
        statuses.includes(b.status) &&
        (b.owner === null ||
          b.owner === "player" ||
          s.factions.some((f) => f.id === b.owner)) &&
        (b.facility === null || facilities.includes(b.facility)) &&
        num(b.danger, 0, 1e6) &&
        num(b.terrain, 0.1, 10) &&
        num(b.cost, 0, 1e6) &&
        num(b.loot, 0, 1e6) &&
        num(b.progress, 0, 100),
    ),
  );
  valid(
    s.buildings.every(
      (b) =>
        (!["secured", "restoring", "operating"].includes(b.status) ||
          b.owner === "player") &&
        (b.owner !== "player" ||
          !["unknown", "discovered"].includes(b.status)) &&
        (!["restoring", "operating"].includes(b.status) || b.facility !== null),
    ),
  );
  valid(
    s.buildings[0].owner === "player" &&
      s.buildings[0].status === "operating" &&
      s.buildings[0].facility === "housing",
  );
  valid(
    Array.isArray(s.logs) &&
      s.logs.length <= 100 &&
      s.logs.every(
        (l) =>
          l &&
          integer(l.id) &&
          l.id < s.nextLog &&
          integer(l.hour, 0, s.hour) &&
          categories.includes(l.category) &&
          text(l.text) &&
          (l.important === undefined || bool(l.important)),
      ),
  );
  valid(new Set(s.logs.map((l) => l.id)).size === s.logs.length);
  valid(
    Array.isArray(s.battles) &&
      s.battles.length <= 10 &&
      s.battles.every(
        (b) =>
          b &&
          integer(b.hour, 0, s.hour) &&
          text(b.building, 100) &&
          num(b.strength, 0, 1e9) &&
          num(b.defense, 0, 1e9) &&
          num(b.roll, 0, 10) &&
          bool(b.won) &&
          Array.isArray(b.casualties) &&
          b.casualties.length <= 6 &&
          b.casualties.every((c) => text(c, 200)),
      ),
  );
  valid(s.offlineSummary === null || text(s.offlineSummary, 5000));
  if (version === 1) {
    s.version = 2;
    s.campaignId = `legacy-${s.seed}-${Math.trunc(s.lastSavedAt)}`;
    s.revision = 0;
    s.clock = { speed: 0, onlineRemainderMs: 0, offlineRemainderMs: 0 };
    s.priorities = { ...DEFAULT_PRIORITIES };
    s.processedCommands = [];
    s.warnings = [];
    s.people.forEach((p) => (p.assignment = null));
    s.buildings = s.buildings.map((b) => {
      const traits = buildingTraits(b.id);
      if (b.facility && !traits.allowedFacilities.includes(b.facility))
        traits.allowedFacilities.push(b.facility);
      return {
        ...b,
        ...traits,
        project:
          b.status === "restoring"
            ? {
                kind: "restore",
                target: b.facility!,
                workRequired: 100,
                paidMaterials: b.cost,
              }
            : null,
      };
    });
    s.offlineSummary =
      "v1 저장을 v2로 이관했습니다. 기존 주민·영토·작위·복구 진행을 보존했습니다. 이전 속도 정보가 없어 안전하게 일시정지합니다.";
  }
  valid(
    text(s.campaignId, 100) &&
      s.campaignId.length > 0 &&
      /^[a-zA-Z0-9_-]+$/.test(s.campaignId) &&
      integer(s.revision),
  );
  valid(
    s.clock &&
      [0, 1, 2, 4].includes(s.clock.speed) &&
      num(s.clock.onlineRemainderMs, 0, TIME.onlineHourMs - Number.EPSILON) &&
      num(s.clock.offlineRemainderMs, 0, TIME.offlineHourMs - Number.EPSILON),
  );
  valid(
    s.clock.onlineRemainderMs < TIME.onlineHourMs &&
      s.clock.offlineRemainderMs < TIME.offlineHourMs,
  );
  valid(!(s.ended || s.pendingSuccession) || s.clock.speed === 0);
  valid(
    s.priorities &&
      Object.keys(s.priorities).length === 6 &&
      Object.keys(DEFAULT_PRIORITIES).every((k) =>
        [0, 1, 2].includes(s.priorities[k as keyof typeof s.priorities]),
      ),
  );
  valid(
    Array.isArray(s.processedCommands) &&
      s.processedCommands.length <= 256 &&
      s.processedCommands.every((id) => text(id, 200) && id.length > 0) &&
      new Set(s.processedCommands).size === s.processedCommands.length,
  );
  valid(
    Array.isArray(s.warnings) &&
      s.warnings.length <= 100 &&
      s.warnings.every((w) => text(w)),
  );
  const assignmentValid = (a: Assignment | null) =>
    a === null ||
    (a &&
      Object.hasOwn(DEFAULT_PRIORITIES, a.area) &&
      (a.building === null || integer(a.building, 1, 19)) &&
      (a.building === null
        ? a.area !== "repair"
        : a.area === "repair"
          ? s.buildings[a.building].owner === "player" &&
            s.buildings[a.building].status === "restoring"
          : s.buildings[a.building].owner === "player" &&
            s.buildings[a.building].status === "operating" &&
            (
              {
                farm: "food",
                pump: "water",
                generator: "power",
                workshop: "materials",
                barracks: "guard",
              } as Record<string, string>
            )[s.buildings[a.building].facility ?? ""] === a.area));
  valid(
    s.people.every(
      (p) => assignmentValid(p.assignment) && (!p.assignment || p.alive),
    ),
  );
  for (const b of s.buildings) {
    valid(
      Object.hasOwn(BUILDING_TYPES, b.type) &&
        num(b.structure, 0, 100) &&
        num(b.repairDifficulty, 0.1, 10),
    );
    valid(
      Array.isArray(b.allowedFacilities) &&
        b.allowedFacilities.length > 0 &&
        b.allowedFacilities.every((f) => facilities.includes(f)) &&
        new Set(b.allowedFacilities).size === b.allowedFacilities.length,
    );
    valid(
      b.suitability &&
        facilities.every((f) =>
          num(b.suitability[f as keyof typeof b.suitability], 0.25, 2.5),
        ),
    );
    valid(
      b.effects &&
        num(b.effects.storage, 0, 500) &&
        num(b.effects.housing, 0, 10) &&
        num(b.effects.healing, 0, 5),
    );
    valid(!b.facility || b.allowedFacilities.includes(b.facility));
    if (b.status === "restoring")
      valid(
        b.project &&
          ["restore", "convert"].includes(b.project.kind) &&
          (b.project.kind === "restore"
            ? b.project.target === b.facility
            : b.project.target !== b.facility) &&
          b.allowedFacilities.includes(b.project.target) &&
          num(b.project.workRequired, 1, 1e5) &&
          num(b.project.paidMaterials, 0, 1e6) &&
          b.progress < 100,
      );
    else valid(b.project === null);
  }
  return s;
}
export function deserialize(
  raw: string,
  now = Date.now(),
  options: { offline?: boolean; consumedThrough?: number } = {},
): GameState {
  valid(num(now, 0, 1e15));
  const s = decodeSave(raw);
  if ((options.consumedThrough ?? 0) > s.lastSavedAt)
    s.clock.offlineRemainderMs = 0;
  const elapsed =
    options.offline === false
      ? { hours: 0, remainder: s.clock.offlineRemainderMs }
      : offlineElapsed(s, now, options.consumedThrough);
  const result = elapsed.hours ? advance(s, elapsed.hours, true) : s;
  result.clock.offlineRemainderMs = elapsed.remainder;
  result.lastSavedAt = Math.max(s.lastSavedAt, now);
  if (elapsed.hours) {
    const change = RESOURCES.map(
      (k) =>
        `${({ food: "식량", water: "식수", power: "전력", materials: "자재" } as Record<Resource, string>)[k]} ${result.resources[k] - s.resources[k] >= 0 ? "+" : ""}${(result.resources[k] - s.resources[k]).toFixed(1)}`,
    ).join(", ");
    const complete = result.buildings
      .filter(
        (b, i) =>
          s.buildings[i].status === "restoring" && b.status === "operating",
      )
      .map((b) => b.name);
    result.offlineSummary = `부재 중 ${result.hour - s.hour}시간 진행 (상한 ${TIME.offlineLimit}시간). ${change}. 주민 ${result.people.filter((p) => p.alive).length - s.people.filter((p) => p.alive).length >= 0 ? "+" : ""}${result.people.filter((p) => p.alive).length - s.people.filter((p) => p.alive).length}명. 완료: ${complete.join(" · ") || "없음"}. 사망 방지·계약 정산 유예, 정치·계승 자동 결정 없음.`;
    result.logs.unshift({
      id: result.nextLog++,
      hour: result.hour,
      category: "system",
      text: result.offlineSummary,
      important: true,
    });
    result.logs = result.logs.slice(0, 100);
  }
  return result;
}
