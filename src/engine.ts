import { FACILITIES, newGame, ROLE_NAMES } from "./data";
import type {
  Building,
  Command,
  GameState,
  Person,
  Result,
  Stock,
} from "./model";

export const HOUR_MS = 3000;
export const OFFLINE_LIMIT = 12;
export const living = (s: GameState) => s.people.filter((p) => p.alive);
export const owned = (s: GameState) =>
  s.buildings.filter((b) => b.owner === "player");
export const operating = (s: GameState) =>
  owned(s).filter((b) => b.status === "operating");
export const stability = (s: GameState) =>
  Math.round(
    living(s).reduce((n, p) => n + p.morale, 0) / Math.max(1, living(s).length),
  );
export const capacity = (s: GameState) =>
  10 +
  operating(s).filter((b) => b.id !== 0 && b.facility === "housing").length * 5;
export const storage = (s: GameState) => 150 + operating(s).length * 25;
const adjacent = (a: Building, b: Building) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
export const reachable = (s: GameState, b: Building) =>
  owned(s).some((a) => adjacent(a, b));
const clone = (s: GameState): GameState => structuredClone(s);
function log(
  s: GameState,
  text: string,
  category: GameState["logs"][number]["category"] = "system",
) {
  s.logs.unshift({ id: s.nextLog++, hour: s.hour, category, text });
  s.logs = s.logs.slice(0, 100);
}
function random(s: GameState) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
export function party(s: GameState): Person[] {
  return living(s)
    .filter(
      (p) =>
        p.health >= 40 &&
        p.injury < 50 &&
        (p.id !== s.leader || s.expeditionLeader),
    )
    .sort(
      (a, b) =>
        Number(b.role === "guard") * 10 +
        b.skill -
        (Number(a.role === "guard") * 10 + a.skill),
    )
    .slice(0, s.partySize);
}
export function combatPower(s: GameState) {
  const bonus =
    1 + operating(s).filter((b) => b.facility === "barracks").length * 0.15;
  return Math.round(
    party(s).reduce(
      (n, p) =>
        n +
        (p.role === "guard" ? 15 : 9) *
          p.skill *
          (0.5 + p.morale / 200) *
          (p.health / 100),
      0,
    ) *
      (1 + (s.equipment - 1) * 0.3) *
      bonus,
  );
}
export const defense = (b: Building) =>
  Math.round((b.danger + (b.owner ? 12 : 0)) * b.terrain);
export function titleRequirements(s: GameState) {
  return [
    { label: "운영 건물 4곳", current: operating(s).length, target: 4 },
    { label: "생존 주민 12명", current: living(s).length, target: 12 },
    { label: "안정도 60", current: stability(s), target: 60 },
  ];
}
export function requiredRelation(
  allegiance: boolean,
  tax: boolean,
  military: boolean,
) {
  return 65 - (allegiance ? 15 : 0) - (tax ? 10 : 0) - (military ? 10 : 0);
}

/** Pure economy projection. Each healthy resident gets exactly one autonomous job. */
export function economy(s: GameState): {
  delta: Stock;
  jobs: Record<string, string>;
  builders: Person[];
} {
  const delta: Stock = { food: 0, water: 0, power: 0, materials: 0 };
  const jobs: Record<string, string> = {};
  const ready = living(s).filter((p) => p.health >= 25 && p.injury < 60);
  const builders: Person[] = [];
  if (owned(s).some((b) => b.status === "restoring")) {
    builders.push(
      ...ready
        .filter((p) => p.role !== "guard")
        .sort((a, b) => b.skill - a.skill)
        .slice(0, 2),
    );
    builders.forEach((p) => (jobs[p.id] = "건물 복구"));
  }
  for (const b of operating(s).filter((b) => b.id !== 0 && b.facility)) {
    const f = FACILITIES[b.facility!];
    if (!f.resource) continue;
    const workers = ready
      .filter((p) => !jobs[p.id] && p.role === f.role)
      .slice(0, 2);
    for (const p of workers) {
      const powered = b.facility === "farm" || b.facility === "pump";
      const efficiency = powered && s.resources.power <= 0 ? 0.35 : 1;
      delta[f.resource] += f.amount * p.skill * efficiency;
      if (powered) delta.power -= 0.3;
      jobs[p.id] =
        `${b.name} · ${f.name}${efficiency < 1 ? " (전력 부족)" : ""}`;
    }
  }
  for (const p of ready.filter((p) => !jobs[p.id])) {
    const skill =
      p.skill * (s.policy === "salvage" && p.role === "scavenger" ? 1.5 : 1);
    if (p.role === "farmer") {
      delta.food += 0.75 * skill;
      jobs[p.id] = "쉘터 버섯 재배";
    }
    if (p.role === "engineer") {
      delta.water += 0.7 * skill;
      delta.power += 0.35 * skill;
      jobs[p.id] = "쉘터 정수·수동 발전";
    }
    if (p.role === "scavenger") {
      delta.materials += 0.65 * skill;
      jobs[p.id] = "주변 잔해 회수";
    }
    if (p.role === "guard") jobs[p.id] = "쉘터 경계·탐사 대기";
  }
  living(s)
    .filter((p) => !jobs[p.id])
    .forEach((p) => (jobs[p.id] = "의무실 회복"));
  delta.food -= living(s).length * 0.18 * (s.policy === "ration" ? 0.65 : 1);
  delta.water -= living(s).length * 0.22;
  delta.power -= 0.25;
  return { delta, jobs, builders };
}
function deaths(s: GameState) {
  for (const p of living(s).filter((p) => p.health <= 0)) {
    p.alive = false;
    p.task = "사망";
    log(s, `${p.name} 사망. 공동체가 동료를 잃었습니다.`, "combat");
    living(s).forEach((q) => (q.morale = Math.max(0, q.morale - 8)));
  }
  if (!s.people.find((p) => p.id === s.leader)?.alive && !s.pendingSuccession) {
    s.pendingSuccession = true;
    log(
      s,
      "지도자가 사망했습니다. 시간 진행이 중단됩니다. 계승 또는 공동체의 여정 종료를 결정하세요.",
    );
  }
}
export function advance(
  source: GameState,
  hours = 1,
  offline = false,
): GameState {
  const s = clone(source);
  const limit = Math.max(
    0,
    Math.min(offline ? OFFLINE_LIMIT : 240, Math.floor(hours)),
  );
  for (let i = 0; i < limit; i++) {
    if (s.ended || s.pendingSuccession) break;
    s.hour++;
    const { delta, jobs, builders } = economy(s);
    for (const key of Object.keys(delta) as (keyof Stock)[])
      s.resources[key] = Math.min(
        storage(s),
        Math.max(0, s.resources[key] + delta[key]),
      );
    const shortage = s.resources.food < 0.01 || s.resources.water < 0.01;
    for (const p of living(s)) {
      p.task = jobs[p.id];
      p.hunger = Math.max(
        0,
        Math.min(100, p.hunger + (s.resources.food <= 0 ? 12 : -10)),
      );
      p.thirst = Math.max(
        0,
        Math.min(100, p.thirst + (s.resources.water <= 0 ? 15 : -12)),
      );
      p.morale = Math.min(
        100,
        Math.max(
          offline ? 40 : 0,
          p.morale +
            (shortage
              ? -3
              : s.policy === "ration"
                ? -0.35
                : s.policy === "salvage"
                  ? -0.15
                  : 0.3),
        ),
      );
      p.injury = Math.max(0, p.injury - (shortage ? 0.3 : 2));
      p.health = Math.min(
        100,
        Math.max(
          offline ? 25 : 0,
          p.health +
            (p.hunger >= 60 || p.thirst >= 60 ? -8 : p.injury > 0 ? 0.5 : 2),
        ),
      );
    }
    // A single building project uses the available construction crew each hour.
    const project = owned(s).find((b) => b.status === "restoring");
    if (project) {
      project.progress = Math.min(
        100,
        project.progress + builders.reduce((n, p) => n + p.skill * 12, 0),
      );
      if (project.progress >= 100) {
        project.status = "operating";
        log(
          s,
          `${project.name} 복구 완료. ${FACILITIES[project.facility!].name} 운영을 시작합니다.`,
          "work",
        );
      }
    }
    if (s.hour % 6 === 0) {
      const worker =
        living(s).find((p) => p.role === "scavenger") ?? living(s)[0];
      if (worker)
        log(
          s,
          `${worker.name}: ${jobs[worker.id]}. 시간당 식량 ${delta.food >= 0 ? "+" : ""}${delta.food.toFixed(1)}, 식수 ${delta.water >= 0 ? "+" : ""}${delta.water.toFixed(1)}, 자재 ${delta.materials >= 0 ? "+" : ""}${delta.materials.toFixed(1)}.`,
          "work",
        );
      if (shortage)
        log(
          s,
          "식량 또는 식수 고갈. 욕구와 사기가 악화되며 장기 부족 시 주민이 사망합니다.",
        );
    }
    if (
      s.hour % 12 === 0 &&
      living(s).length < capacity(s) &&
      s.resources.food >= 20 &&
      s.resources.water >= 20 &&
      stability(s) >= 55
    ) {
      const id = `m${s.hour}`;
      const name = `이주민 ${s.people.filter((p) => p.id.startsWith("m")).length + 1}`;
      s.people.push({
        id,
        name,
        role: living(s).length % 2 ? "engineer" : "farmer",
        skill: 1.2,
        morale: 70,
        health: 100,
        hunger: 0,
        thirst: 0,
        injury: 0,
        alive: true,
        task: "정착",
      });
      s.resources.food -= 5;
      s.resources.water -= 5;
      log(
        s,
        `${name} 합류. 주거 공간과 안정된 배급 소식이 사람들을 불러옵니다.`,
        "work",
      );
    }
    if (s.contract && s.hour % 24 === 0) {
      if (offline)
        log(
          s,
          "부재 중 계약 의무를 유예했습니다. 다음 정산은 접속 중 24시간 주기에 진행됩니다.",
          "diplomacy",
        );
      else {
        const patron = s.factions.find((f) => f.id === s.contract!.patron)!;
        if (s.contract.tax) {
          if (s.resources.food >= 8) {
            s.resources.food -= 8;
            log(s, "계약 세금으로 식량 8을 납부했습니다.", "diplomacy");
          } else {
            patron.relation = Math.max(-100, patron.relation - 10);
            log(s, "식량 부족으로 세금 체납. 후원 세력 관계 -10.", "diplomacy");
          }
        }
        if (s.contract.military) {
          if (
            living(s).filter((p) => p.role === "guard" && p.health >= 40)
              .length >= 2
          )
            log(s, "경비 2명이 군사 협력 의무를 이행했습니다.", "diplomacy");
          else {
            patron.relation = Math.max(-100, patron.relation - 8);
            log(s, "경비 2명 부족으로 군사 의무 불이행. 관계 -8.", "diplomacy");
          }
        }
      }
    }
    deaths(s);
  }
  return s;
}

export function dispatch(source: GameState, command: Command): Result {
  const s = clone(source);
  const fail = (error: string): Result => ({ state: source, error });
  if (s.ended) return fail("종료된 공동체입니다. 새 게임을 시작하세요.");
  if (
    s.pendingSuccession &&
    command.type !== "succeed" &&
    command.type !== "end"
  )
    return fail("먼저 지도자 계승을 결정하세요.");
  if (command.type === "succeed") {
    const heir =
      living(s).find((p) => p.id === s.successor) ??
      living(s).sort((a, b) => b.morale - a.morale)[0];
    if (!heir) return fail("살아 있는 계승 후보가 없습니다.");
    if (!s.pendingSuccession) return fail("현재 계승이 필요하지 않습니다.");
    s.leader = heir.id;
    s.successor = living(s).find((p) => p.id !== heir.id)?.id ?? null;
    s.pendingSuccession = false;
    log(
      s,
      `${heir.name} 지도자 계승. 공동체의 영토와 작위, 계약을 이어받습니다.`,
    );
    return { state: s };
  }
  if (command.type === "end") {
    if (!s.pendingSuccession)
      return fail("계승 결정 중에만 종료할 수 있습니다.");
    s.ended = true;
    s.pendingSuccession = false;
    log(s, "공동체의 여정을 종료했습니다.");
    return { state: s };
  }
  if (command.type === "party") {
    s.partySize = Math.max(1, Math.min(6, Math.floor(command.size)));
    return { state: s };
  }
  if (command.type === "expeditionLeader") {
    s.expeditionLeader = command.value;
    return { state: s };
  }
  if (command.type === "policy") {
    s.policy = command.policy;
    log(
      s,
      `운영 정책 변경: ${command.policy === "ration" ? "절약 배급" : command.policy === "salvage" ? "잔해 회수 집중" : "균형 배급"}.`,
    );
    return { state: s };
  }
  if (command.type === "successor") {
    if (!living(s).some((p) => p.id === command.person && p.id !== s.leader))
      return fail("살아 있는 다른 주민을 지정하세요.");
    s.successor = command.person;
    return { state: s };
  }
  if (command.type === "role") {
    const p = living(s).find((p) => p.id === command.person);
    if (!p) return fail("주민을 찾을 수 없습니다.");
    p.role = command.role;
    log(s, `${p.name} 역할 변경: ${ROLE_NAMES[p.role]}.`, "work");
    return { state: s };
  }
  if (command.type === "equipment") {
    if (s.equipment >= 4) return fail("장비가 최대 단계입니다.");
    const cost = s.equipment * 18;
    if (s.resources.materials < cost) return fail(`자재 ${cost} 필요`);
    s.resources.materials -= cost;
    s.equipment++;
    log(
      s,
      `공용 장비 ${s.equipment}단계. 탐사대 전체에 전투력 보너스를 적용합니다.`,
      "work",
    );
    return { state: s };
  }
  if ("faction" in command) {
    const f = s.factions.find((f) => f.id === command.faction);
    if (!f) return fail("세력을 찾을 수 없습니다.");
    if (command.type === "gift") {
      if (s.resources[f.resource] < 15)
        return fail("선호 자원 15가 필요합니다.");
      s.resources[f.resource] -= 15;
      f.relation = Math.min(100, f.relation + 12);
      log(s, `${f.name}에 보급품 전달. 관계 +12.`, "diplomacy");
    }
    if (command.type === "trade") {
      if (f.relation < 0) return fail("관계 0 이상에서 교역할 수 있습니다.");
      if (s.resources[f.resource] < 12)
        return fail("선호 자원 12가 필요합니다.");
      s.resources[f.resource] -= 12;
      const received = f.resource === "materials" ? "food" : "materials";
      s.resources[received] = Math.min(storage(s), s.resources[received] + 10);
      log(
        s,
        `${f.name}와 교역: ${f.resource === "food" ? "식량" : f.resource === "water" ? "식수" : "자재"} 12 제공, ${received === "food" ? "식량" : "자재"} 10 획득.`,
        "diplomacy",
      );
    }
    if (command.type === "recognition") {
      if (f.relation < 20) return fail("관계 20 이상 필요");
      if (owned(s).every((b) => f.recognized.includes(b.id)))
        return fail(
          "이미 현재 영토를 인정받았습니다. 새로운 건물을 확보하세요.",
        );
      if (s.resources.materials < 10) return fail("자재 10 필요");
      s.resources.materials -= 10;
      f.recognized = owned(s).map((b) => b.id);
      f.relation = Math.min(100, f.relation + 8);
      log(
        s,
        `${f.name}가 현재 ${owned(s).length}곳의 실효 지배를 인정했습니다. 관계 +8. 작위와 봉신 계약은 별도입니다.`,
        "diplomacy",
      );
    }
    if (command.type === "claim") {
      if (s.title === "baron") return fail("이미 남작으로 인정받았습니다.");
      if (titleRequirements(s).some((r) => r.current < r.target))
        return fail("운영 건물 4곳·주민 12명·안정도 60이 필요합니다.");
      const required = requiredRelation(
        command.allegiance,
        command.tax,
        command.military,
      );
      if (f.relation < required)
        return fail(`이 계약의 인정에는 관계 ${required} 이상이 필요합니다.`);
      s.title = "baron";
      s.contract = {
        patron: f.id,
        allegiance: command.allegiance,
        tax: command.tax,
        military: command.military,
      };
      log(
        s,
        `${f.leader} ${f.title}이 당신을 남작으로 인정했습니다! ${command.allegiance ? "충성 서약을 체결했습니다." : "독립 지위를 유지합니다."} 도시는 이제 당신의 이름을 기억합니다.`,
        "diplomacy",
      );
    }
    return { state: s };
  }
  if ("building" in command) {
    const b = s.buildings.find((b) => b.id === command.building);
    if (!b) return fail("건물을 찾을 수 없습니다.");
    if (command.type === "explore") {
      if (b.status !== "unknown" || !reachable(s, b))
        return fail("지배 건물에 인접한 미발견 건물만 탐색할 수 있습니다.");
      if (s.resources.power < 2) return fail("탐색 전력 2 필요");
      s.resources.power -= 2;
      b.status = "discovered";
      log(
        s,
        `${b.name} 탐색. 위험 ${defense(b)}, ${b.owner ? s.factions.find((f) => f.id === b.owner)?.name : "무주지"} 확인.`,
        "work",
      );
    }
    if (command.type === "secure" || command.type === "negotiate") {
      if (b.status !== "discovered" || !reachable(s, b))
        return fail("지배 건물과 인접한 발견 건물만 확보할 수 있습니다.");
      if (command.type === "negotiate") {
        const f = s.factions.find((f) => f.id === b.owner);
        const cost = b.owner ? 30 : 12;
        if (f && f.relation < 25)
          return fail("영토 양도 협상에는 관계 25 이상 필요");
        if (s.resources.food < cost || s.resources.water < cost)
          return fail(`식량·식수 각각 ${cost} 필요`);
        s.resources.food -= cost;
        s.resources.water -= cost;
        if (f) f.relation = Math.min(100, f.relation + 5);
        log(
          s,
          `${b.name} ${f ? "영토 양도 계약" : "잔류민과 보급 협약"} 체결. 식량·식수 각각 ${cost} 지출.`,
          "diplomacy",
        );
      } else {
        const team = party(s);
        if (team.length === 0) return fail("건강한 탐사대원이 없습니다.");
        if (s.resources.food < 3) return fail("탐사 보급 식량 3 필요");
        s.resources.food -= 3;
        const strength = combatPower(s),
          enemy = defense(b),
          roll = 0.8 + random(s) * 0.4,
          won = strength * roll >= enemy;
        const casualties: string[] = [];
        for (const p of team) {
          const damage = Math.round(
            (won ? 5 : 22) +
              random(s) * (won ? 12 : 28) +
              Math.max(0, enemy - strength) * 0.45,
          );
          p.health = Math.max(0, p.health - damage);
          p.injury = Math.min(100, p.injury + damage);
          p.morale = Math.max(0, p.morale + (won ? 4 : -10));
          casualties.push(
            `${p.name} ${p.health <= 0 ? "사망" : `부상 ${damage}`}`,
          );
        }
        const faction = s.factions.find((f) => f.id === b.owner);
        if (faction) faction.relation = Math.max(-100, faction.relation - 20);
        s.battles.unshift({
          hour: s.hour,
          building: b.name,
          strength,
          defense: enemy,
          roll,
          won,
          casualties,
        });
        s.battles = s.battles.slice(0, 10);
        log(
          s,
          `${b.name} ${won ? "확보 성공" : "전투 패배"} · 아군 ${strength} × 변수 ${roll.toFixed(2)} / 방어 ${enemy}. ${casualties.join(", ")}${faction ? `. ${faction.name} 관계 -20` : ""}`,
          "combat",
        );
        deaths(s);
        if (!won) return { state: s };
      }
      b.owner = "player";
      b.status = "secured";
      s.resources.materials = Math.min(
        storage(s),
        s.resources.materials + b.loot,
      );
      log(
        s,
        `${b.name} 확보. 회수 자재 +${b.loot}. 시설 용도를 지정한 후 복구하세요.`,
        "work",
      );
    }
    if (command.type === "facility") {
      if (b.owner !== "player" || b.id === 0 || b.status === "restoring")
        return fail("쉘터 또는 복구 중인 건물의 용도는 변경할 수 없습니다.");
      b.facility = command.facility;
      log(s, `${b.name} 용도: ${FACILITIES[command.facility].name}.`, "work");
    }
    if (command.type === "restore") {
      if (b.owner !== "player" || b.status !== "secured" || !b.facility)
        return fail("확보한 건물의 용도를 먼저 지정하세요.");
      if (s.resources.materials < b.cost)
        return fail(`복구 자재 ${b.cost} 필요`);
      if (
        !living(s).some(
          (p) => p.role !== "guard" && p.health >= 25 && p.injury < 60,
        )
      )
        return fail("복구 가능한 주민이 없습니다.");
      s.resources.materials -= b.cost;
      b.status = "restoring";
      log(
        s,
        `${b.name} 복구 착수. 자재 -${b.cost}. 건강한 비경비 주민 최대 2명이 자동 배정됩니다.`,
        "work",
      );
    }
    return { state: s };
  }
  return fail("알 수 없는 명령입니다.");
}

/** Explicit save envelope and validation; no actions are replayed on load. */
export function serialize(s: GameState, now = Date.now()) {
  return JSON.stringify({ ...s, lastSavedAt: now });
}
export function deserialize(raw: string, now = Date.now()): GameState {
  const candidate: unknown = JSON.parse(raw);
  if (!candidate || typeof candidate !== "object")
    throw new Error("올바르지 않은 저장 파일");
  const s = candidate as GameState;
  if (
    s.version !== 1 ||
    !Array.isArray(s.people) ||
    !s.people.length ||
    !Array.isArray(s.buildings) ||
    s.buildings.length !== 20 ||
    !Array.isArray(s.factions) ||
    s.factions.length !== 3 ||
    !s.resources ||
    !Number.isFinite(s.hour) ||
    s.hour < 0 ||
    !Number.isFinite(s.seed) ||
    !Number.isFinite(s.lastSavedAt) ||
    !Array.isArray(s.logs) ||
    !Array.isArray(s.battles)
  )
    throw new Error("저장 형식 또는 버전이 올바르지 않습니다.");
  const roles = ["farmer", "engineer", "scavenger", "guard"],
    facilities = Object.keys(FACILITIES),
    statuses = ["unknown", "discovered", "secured", "restoring", "operating"];
  const finite = (x: unknown) => typeof x === "number" && Number.isFinite(x);
  if (
    !["pendingSuccession", "ended", "expeditionLeader"].every(
      (k) => typeof s[k as "ended"] === "boolean",
    ) ||
    s.partySize < 1 ||
    s.partySize > 6 ||
    !Number.isInteger(s.partySize) ||
    s.equipment < 1 ||
    s.equipment > 4 ||
    !Number.isInteger(s.equipment) ||
    new Set(s.people.map((p) => p.id)).size !== s.people.length ||
    !s.factions.every(
      (f) =>
        Array.isArray(f.recognized) &&
        f.recognized.every((id) => Number.isInteger(id) && id >= 0 && id < 20),
    )
  )
    throw new Error("게임 설정 또는 영토 인정 기록이 손상되었습니다.");
  if (
    !["food", "water", "power", "materials"].every(
      (k) =>
        finite(s.resources[k as keyof Stock]) &&
        s.resources[k as keyof Stock] >= 0,
    ) ||
    !s.people.every(
      (p) =>
        typeof p.id === "string" &&
        typeof p.name === "string" &&
        roles.includes(p.role) &&
        [p.skill, p.morale, p.health, p.hunger, p.thirst, p.injury].every(
          finite,
        ) &&
        typeof p.alive === "boolean",
    ) ||
    !s.buildings.every(
      (b, i) =>
        b.id === i &&
        statuses.includes(b.status) &&
        (b.facility === null || facilities.includes(b.facility)) &&
        [b.x, b.y, b.danger, b.terrain, b.cost, b.progress, b.loot].every(
          finite,
        ),
    ) ||
    !s.factions.every(
      (f) =>
        typeof f.id === "string" &&
        typeof f.name === "string" &&
        finite(f.relation) &&
        ["food", "water", "power", "materials"].includes(f.resource),
    ) ||
    !s.people.some((p) => p.id === s.leader) ||
    !["balanced", "ration", "salvage"].includes(s.policy) ||
    !["commoner", "baron"].includes(s.title) ||
    ![s.partySize, s.equipment, s.nextLog].every(finite)
  )
    throw new Error("저장 데이터가 손상되었습니다.");
  if (
    s.contract &&
    (!s.factions.some((f) => f.id === s.contract!.patron) ||
      !["allegiance", "tax", "military"].every(
        (k) => typeof s.contract![k as "tax"] === "boolean",
      ))
  )
    throw new Error("계약 데이터가 손상되었습니다.");
  const elapsed = Math.min(
    OFFLINE_LIMIT,
    Math.max(0, Math.floor((now - s.lastSavedAt) / HOUR_MS)),
  );
  const result = advance(s, elapsed, true);
  result.lastSavedAt = now;
  result.offlineSummary = elapsed
    ? `부재 중 ${result.hour - s.hour}시간 진행 (최대 ${OFFLINE_LIMIT}시간). 주민 사망 방지·계약 정산 유예. 정치·계승 결정은 자동 처리하지 않았습니다.`
    : null;
  if (result.offlineSummary) log(result, result.offlineSummary);
  return result;
}
export { newGame };
