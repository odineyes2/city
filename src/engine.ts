import { FACILITIES, newGame, ROLE_NAMES } from "./data";
import type {
  Building,
  Command,
  GameState,
  Person,
  Result,
  Stock,
} from "./model";

import { TIME, ECONOMY, LIFE, WORK, ACTIONS, WORK_NAMES } from "./config";
import { projectQuote, storageCapacity } from "./buildings";
import { economy, workerEfficiency } from "./economy";
export { economy } from "./economy";
export const HOUR_MS = TIME.onlineHourMs;
export const OFFLINE_LIMIT = TIME.offlineLimit;
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
  ECONOMY.housing +
  operating(s)
    .filter((b) => b.id !== 0 && b.facility === "housing")
    .reduce(
      (n, b) => n + ECONOMY.facilityProduction.housing + b.effects.housing,
      0,
    );
export const storage = storageCapacity;
const adjacent = (a: Building, b: Building) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
export const reachable = (s: GameState, b: Building) =>
  owned(s).some((a) => adjacent(a, b));
const clone = (s: GameState): GameState => structuredClone(s);
function log(
  s: GameState,
  text: string,
  category: GameState["logs"][number]["category"] = "system",
  important = false,
) {
  s.logs.unshift({ id: s.nextLog++, hour: s.hour, category, text, important });
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
  const flow = economy(s);
  const bonus =
    1 +
    operating(s)
      .filter((b) => b.facility === "barracks")
      .reduce(
        (n, b) =>
          n +
          (ECONOMY.facilityProduction.barracks *
            (flow.facilities[b.id]?.efficiency ?? 0) *
            (flow.facilities[b.id]?.workers.length ?? 0)) /
            ECONOMY.facilityWorkers,
        0,
      );
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

function deaths(s: GameState) {
  for (const p of living(s).filter((p) => p.health <= 0)) {
    p.alive = false;
    p.assignment = null;
    p.task = "사망";
    log(s, `${p.name} 사망. 공동체가 동료를 잃었습니다.`, "combat");
    living(s).forEach((q) => (q.morale = Math.max(0, q.morale - 8)));
  }
  if (!s.people.find((p) => p.id === s.leader)?.alive && !s.pendingSuccession) {
    s.pendingSuccession = true;
    s.clock.speed = 0;
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
  if (!Number.isFinite(hours) || hours < 0) return source;
  const s = clone(source);
  const limit = Math.max(
    0,
    Math.min(offline ? OFFLINE_LIMIT : TIME.maxAdvanceHours, Math.floor(hours)),
  );
  for (let i = 0; i < limit; i++) {
    if (s.ended || s.pendingSuccession) break;
    s.hour++;
    s.revision++;
    const flow = economy(s);
    const { delta, jobs, builders } = flow;
    for (const warning of flow.warnings)
      if (!s.warnings.includes(warning)) log(s, warning, "system", true);
    if (s.warnings.length && !flow.warnings.length)
      log(s, "운영 중단 원인이 해소되었습니다.", "system", true);
    s.warnings = flow.warnings;
    for (const key of Object.keys(delta) as (keyof Stock)[])
      s.resources[key] = Math.min(
        storage(s),
        Math.max(0, s.resources[key] + delta[key]),
      );
    const shortage = flow.unmet.food > 1e-8 || flow.unmet.water > 1e-8;
    for (const p of living(s)) {
      p.task = jobs[p.id];
      p.assignment = flow.assignments[p.id];
      p.hunger = Math.max(
        0,
        Math.min(
          100,
          p.hunger +
            (flow.unmet.food > 1e-8 ? LIFE.hungerGain : -LIFE.hungerRecovery),
        ),
      );
      p.thirst = Math.max(
        0,
        Math.min(
          100,
          p.thirst +
            (flow.unmet.water > 1e-8 ? LIFE.thirstGain : -LIFE.thirstRecovery),
        ),
      );
      p.morale = Math.min(
        100,
        Math.max(
          offline ? LIFE.offlineMoraleFloor : 0,
          p.morale +
            (shortage
              ? -LIFE.shortageMorale
              : s.policy === "ration"
                ? -LIFE.rationMorale
                : s.policy === "salvage"
                  ? -LIFE.salvageMorale
                  : LIFE.moraleRecovery),
        ),
      );
      p.injury = Math.max(
        0,
        p.injury -
          (shortage
            ? LIFE.injuryRecoveryShortage
            : LIFE.injuryRecovery +
              operating(s).reduce((n, b) => n + b.effects.healing, 0)),
      );
      p.health = Math.min(
        100,
        Math.max(
          offline ? LIFE.offlineHealthFloor : 0,
          p.health +
            (p.hunger >= LIFE.criticalNeed || p.thirst >= LIFE.criticalNeed
              ? -LIFE.starvationDamage
              : p.injury > 0
                ? LIFE.injuredRecovery
                : LIFE.healthRecovery),
        ),
      );
    }
    // A single building project uses the available construction crew each hour.
    const project = owned(s).find((b) => b.status === "restoring");
    if (project) {
      project.progress = Math.min(
        100,
        project.progress +
          (flow.repairWork /
            (project.project?.workRequired ?? WORK.repairWork)) *
            100,
      );
      if (project.progress >= 100) {
        const converted = project.project?.kind === "convert";
        project.facility = project.project?.target ?? project.facility;
        project.project = null;
        project.status = "operating";
        project.structure = 100;
        log(
          s,
          `${project.name} ${converted ? "시설 전환" : "복구"} 완료. ${FACILITIES[project.facility!].name} 운영을 시작합니다.`,
          "work",
          true,
        );
      }
    }
    if (s.hour % LIFE.logEvery === 0) {
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
      s.hour % LIFE.migrationEvery === 0 &&
      living(s).length < capacity(s) &&
      s.resources.food >= LIFE.migrationStock &&
      s.resources.water >= LIFE.migrationStock &&
      stability(s) >= LIFE.migrationMorale
    ) {
      let id = `m${s.hour}`,
        suffix = 1;
      while (s.people.some((p) => p.id === id)) id = `m${s.hour}-${suffix++}`;
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
        assignment: null,
      });
      s.resources.food -= LIFE.migrationCost;
      s.resources.water -= LIFE.migrationCost;
      log(
        s,
        `${name} 합류. 주거 공간과 안정된 배급 소식이 사람들을 불러옵니다.`,
        "work",
      );
    }
    if (s.contract && s.hour % ACTIONS.obligationsEvery === 0) {
      if (offline)
        log(
          s,
          "부재 중 계약 의무를 유예했습니다. 다음 정산은 접속 중 24시간 주기에 진행됩니다.",
          "diplomacy",
        );
      else {
        const patron = s.factions.find((f) => f.id === s.contract!.patron)!;
        if (s.contract.tax) {
          if (s.resources.food >= ACTIONS.tax) {
            s.resources.food -= ACTIONS.tax;
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
  refreshAssignments(s);
  return s;
}

function refreshAssignments(s: GameState) {
  const next = economy(s);
  s.people.forEach((p) => {
    p.assignment = p.alive ? (next.assignments[p.id] ?? null) : null;
    if (p.alive) p.task = next.jobs[p.id];
  });
}

function execute(source: GameState, command: Command): Result {
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
    s.clock.speed = 0;
    s.pendingSuccession = false;
    log(s, "공동체의 여정을 종료했습니다.");
    return { state: s };
  }
  if (command.type === "speed") {
    if (![0, 1, 2, 4].includes(command.speed))
      return fail("지원하지 않는 속도입니다.");
    s.clock.speed = command.speed;
    return { state: s };
  }
  if (command.type === "priority") {
    if (
      !Object.hasOwn(s.priorities, command.area) ||
      ![0, 1, 2].includes(command.priority)
    )
      return fail("잘못된 작업 우선순위입니다.");
    s.priorities[command.area] = command.priority;
    const flow = economy(s);
    s.people.forEach((p) => {
      p.assignment = flow.assignments[p.id] ?? null;
      if (p.alive) p.task = flow.jobs[p.id];
    });
    log(
      s,
      `${WORK_NAMES[command.area]} 우선순위 변경. 생산 인력 ${Object.values(flow.assignments).filter((a) => a && a.area === command.area).length}명, 복구 인력 ${flow.builders.length}명으로 재배치했습니다.`,
      "work",
      true,
    );
    return { state: s };
  }
  if (command.type === "party") {
    if (!Number.isFinite(command.size))
      return fail("잘못된 탐사대 인원입니다.");
    s.partySize = Math.max(1, Math.min(6, Math.floor(command.size)));
    return { state: s };
  }
  if (command.type === "expeditionLeader") {
    s.expeditionLeader = command.value;
    return { state: s };
  }
  if (command.type === "policy") {
    if (!["balanced", "ration", "salvage"].includes(command.policy))
      return fail("잘못된 운영 정책입니다.");
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
    if (!Object.hasOwn(ROLE_NAMES, command.role))
      return fail("잘못된 주민 역할입니다.");
    p.role = command.role;
    p.assignment = null;
    log(s, `${p.name} 역할 변경: ${ROLE_NAMES[p.role]}.`, "work");
    return { state: s };
  }
  if (command.type === "equipment") {
    if (s.equipment >= 4) return fail("장비가 최대 단계입니다.");
    const cost = s.equipment * ACTIONS.equipmentCost;
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
      if (f.relation >= 100)
        return fail("이미 최고 관계입니다. 추가 보급은 필요하지 않습니다.");
      if (s.resources[f.resource] < ACTIONS.gift)
        return fail("선호 자원 15가 필요합니다.");
      s.resources[f.resource] -= ACTIONS.gift;
      f.relation = Math.min(100, f.relation + ACTIONS.giftRelation);
      log(s, `${f.name}에 보급품 전달. 관계 +12.`, "diplomacy");
    }
    if (command.type === "trade") {
      if (f.relation < 0) return fail("관계 0 이상에서 교역할 수 있습니다.");
      if (s.resources[f.resource] < ACTIONS.tradeCost)
        return fail("선호 자원 12가 필요합니다.");
      s.resources[f.resource] -= ACTIONS.tradeCost;
      const received = f.resource === "materials" ? "food" : "materials";
      if (storage(s) - s.resources[received] < ACTIONS.tradeReturn)
        return fail("교역품을 받을 저장 공간이 부족합니다.");
      s.resources[received] = Math.min(
        storage(s),
        s.resources[received] + ACTIONS.tradeReturn,
      );
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
      if (s.resources.materials < ACTIONS.recognitionCost)
        return fail("자재 10 필요");
      s.resources.materials -= ACTIONS.recognitionCost;
      f.recognized = owned(s).map((b) => b.id);
      f.relation = Math.min(100, f.relation + ACTIONS.recognitionRelation);
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
      if (s.resources.power < ACTIONS.explorePower)
        return fail("탐색 전력 2 필요");
      s.resources.power -= ACTIONS.explorePower;
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
        const cost = b.owner ? ACTIONS.factionSupply : ACTIONS.neutralSupply;
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
        if (s.resources.food < ACTIONS.battleFood)
          return fail("탐사 보급 식량 3 필요");
        s.resources.food -= ACTIONS.battleFood;
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
      const beforeLoot = s.resources.materials;
      s.resources.materials += Math.max(
        0,
        Math.min(b.loot, storage(s) - s.resources.materials),
      );
      log(
        s,
        `${b.name} 확보. 회수 자재 +${s.resources.materials - beforeLoot}${s.resources.materials - beforeLoot < b.loot ? ` (저장 초과 ${b.loot - (s.resources.materials - beforeLoot)} 손실)` : ""}. 시설 용도를 지정한 후 복구하세요.`,
        "work",
      );
    }
    if (command.type === "facility") {
      if (
        !(command.facility in FACILITIES) ||
        !b.allowedFacilities.includes(command.facility)
      )
        return fail("이 건물에 설치할 수 없는 시설입니다.");
      if (
        b.owner !== "player" ||
        b.id === 0 ||
        !["secured", "operating"].includes(b.status)
      )
        return fail(
          "확보 또는 운영 중인 건물에서만 용도를 지정할 수 있습니다.",
        );
      if (b.facility === command.facility)
        return fail("이미 지정된 용도입니다.");
      if (b.status === "operating") {
        const quote = projectQuote(b, command.facility, true);
        if (s.resources.materials < quote.materials)
          return fail(`전환 자재 ${quote.materials} 필요`);
        s.resources.materials -= quote.materials;
        b.progress = 0;
        b.status = "restoring";
        b.project = {
          kind: "convert",
          target: command.facility,
          workRequired: quote.work,
          paidMaterials: quote.materials,
        };
        log(
          s,
          `${b.name} 시설 전환 시작. 자재 -${quote.materials}. 기존 생산 중단, 복구 인력 배정 대기.`,
          "work",
          true,
        );
      } else {
        b.facility = command.facility;
        log(
          s,
          `${b.name} 용도 지정: ${FACILITIES[command.facility].name}.`,
          "work",
        );
      }
    }
    if (command.type === "restore") {
      if (b.owner !== "player" || b.status !== "secured" || !b.facility)
        return fail("확보한 건물의 용도를 먼저 지정하세요.");
      const quote = projectQuote(b, b.facility, false);
      if (!quote.allowed) return fail("이 건물에 설치할 수 없는 시설입니다.");
      if (s.resources.materials < quote.materials)
        return fail(`복구 자재 ${quote.materials} 필요`);
      s.resources.materials -= quote.materials;
      b.status = "restoring";
      b.progress = 0;
      b.project = {
        kind: "restore",
        target: b.facility,
        workRequired: quote.work,
        paidMaterials: quote.materials,
      };
      log(
        s,
        `${b.name} 복구 착수. 자재 -${quote.materials}. 작업 우선순위에 따라 최대 ${WORK.repairWorkers}명 자동 배정.`,
        "work",
        true,
      );
    }
    return { state: s };
  }
  return fail("알 수 없는 명령입니다.");
}

// 같은 요청 ID의 재시도는 비용·전투·외교를 다시 실행하지 않는다.
export function dispatch(source: GameState, command: Command): Result {
  if (
    command.id !== undefined &&
    (typeof command.id !== "string" || !command.id || command.id.length > 200)
  )
    return { state: source, error: "명령 ID가 올바르지 않습니다." };
  if (command.id && source.processedCommands.includes(command.id))
    return { state: source };
  const result = execute(source, command);
  if (result.error) return result;
  result.state.revision = source.revision + 1;
  refreshAssignments(result.state);
  if (command.id)
    result.state.processedCommands = [
      ...source.processedCommands,
      command.id,
    ].slice(-256);
  return result;
}
export function actionInfo(s: GameState, command: Command) {
  const result = execute(s, command);
  let cost = "즉시 · 비용 없음";
  if (command.type === "explore") cost = `즉시 · 전력 ${ACTIONS.explorePower}`;
  if (command.type === "secure")
    cost = `즉시 · 식량 ${ACTIONS.battleFood}, 패배해도 보급 소모·부상 위험`;
  if (command.type === "negotiate") {
    const b = s.buildings[command.building];
    cost = `즉시 · 식량·식수 각각 ${b?.owner ? ACTIONS.factionSupply : ACTIONS.neutralSupply}`;
  }
  if (command.type === "gift") cost = `즉시 · 선호 자원 ${ACTIONS.gift}`;
  if (command.type === "trade")
    cost = `즉시 · 선호 자원 ${ACTIONS.tradeCost}, 교역품 ${ACTIONS.tradeReturn}`;
  if (command.type === "recognition")
    cost = `즉시 · 자재 ${ACTIONS.recognitionCost}`;
  if (command.type === "equipment")
    cost = `즉시 · 자재 ${s.equipment * ACTIONS.equipmentCost}`;
  if (command.type === "restore" || command.type === "facility") {
    const b = s.buildings[command.building],
      target = command.type === "facility" ? command.facility : b.facility;
    if (target && (command.type === "restore" || b.status === "operating")) {
      const q = projectQuote(b, target);
      cost = `자재 ${q.materials} 선납 · 복구 인력 기준 약 ${q.idealHours}시간 (배정 대기 별도)`;
    }
  }
  return { allowed: !result.error, reason: result.error ?? "", cost };
}
export { serialize, deserialize } from "./save";
export { newGame };
