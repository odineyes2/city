// 1시간의 작업·전력 배분과 경제 원장. 예측 화면과 실제 틱이 이 결과를 공유한다.
import { FACILITIES } from "./data";
import { ECONOMY, RESOURCES, WORK, WORK_NAMES, WORK_ROLES } from "./config";
import { isOperating, storageCapacity } from "./buildings";
import type {
  Assignment,
  Building,
  GameState,
  Person,
  Resource,
  Stock,
  WorkArea,
} from "./model";
export const emptyStock = (): Stock => ({
  food: 0,
  water: 0,
  power: 0,
  materials: 0,
});
export function workerEfficiency(p: Person) {
  if (!p.alive || p.health < WORK.minHealth || p.injury >= WORK.maxInjury)
    return 0;
  return (
    Math.min(1, Math.max(WORK.minEfficiency, p.health / WORK.fullHealth)) *
    Math.min(
      1,
      Math.max(WORK.minEfficiency, 1 - (p.injury - WORK.fullInjury) / 100),
    )
  );
}
interface Task {
  area: WorkArea;
  building: number | null;
  slots: number;
  rank: number;
  role: Person["role"];
}
export interface FacilityFlow {
  workers: string[];
  output: Stock;
  efficiency: number;
  powerDemand: number;
  powerUsed: number;
  materialUsed: number;
  reason: string;
}
export interface EconomyFlow {
  production: Stock;
  consumption: Stock;
  livingConsumption: Stock;
  facilityConsumption: Stock;
  demand: Stock;
  net: Stock;
  delta: Stock;
  overflow: Stock;
  unmet: Stock;
  jobs: Record<string, string>;
  assignments: Record<string, Assignment | null>;
  builders: Person[];
  facilities: Record<number, FacilityFlow>;
  warnings: string[];
  powerDemand: number;
  powerUsed: number;
  repairWork: number;
  shortageHours: Record<Resource, number | null>;
}
export function economy(s: GameState): EconomyFlow {
  const alive = s.people.filter((p) => p.alive),
    ready = alive.filter((p) => workerEfficiency(p) > 0),
    jobs: Record<string, string> = {},
    assignments: EconomyFlow["assignments"] = {};
  const production = emptyStock(),
    livingConsumption = emptyStock(),
    facilityConsumption = emptyStock(),
    demand = emptyStock(),
    facilities: EconomyFlow["facilities"] = {},
    warnings: string[] = [];
  const operating = s.buildings.filter(isOperating),
    tasks: Task[] = [];
  const project = s.buildings.find(
    (b) => b.owner === "player" && b.status === "restoring",
  );
  if (project)
    tasks.push({
      area: "repair",
      building: project.id,
      slots: WORK.repairWorkers,
      rank: 0,
      role: "engineer",
    });
  for (const b of operating.filter((b) => b.id !== 0 && b.facility)) {
    const f = FACILITIES[b.facility!];
    facilities[b.id] = {
      workers: [],
      output: emptyStock(),
      efficiency: 0,
      powerDemand: 0,
      powerUsed: 0,
      materialUsed: 0,
      reason: "",
    };
    if (f.resource || b.facility === "barracks")
      tasks.push({
        area: f.resource ?? "guard",
        building: b.id,
        slots: ECONOMY.facilityWorkers,
        rank: 1,
        role: f.role,
      });
  }
  for (const area of ["power", "food", "water", "materials", "guard"] as const)
    tasks.push({
      area,
      building: null,
      slots: ECONOMY.baseSlots[area],
      rank: 2,
      role: WORK_ROLES[area],
    });
  const same = (p: Person, t: Task) =>
    p.assignment?.area === t.area && p.assignment.building === t.building;
  tasks.sort(
    (a, b) =>
      s.priorities[b.area] - s.priorities[a.area] ||
      a.rank - b.rank ||
      Number(ready.some((p) => same(p, b))) -
        Number(ready.some((p) => same(p, a))) ||
      (a.building ?? 100) - (b.building ?? 100),
  );
  const builders: Person[] = [];
  for (const task of tasks) {
    const candidates = ready
      .filter(
        (p) =>
          !(p.id in assignments) &&
          (task.area === "repair"
            ? p.role !== "guard" || s.priorities.repair > s.priorities.guard
            : task.area === "guard"
              ? p.role === "guard" || s.priorities.guard === 2
              : p.role === task.role),
      )
      .sort(
        (a, b) =>
          Number(same(b, task)) - Number(same(a, task)) ||
          Number(b.role === task.role) - Number(a.role === task.role) ||
          b.skill * workerEfficiency(b) - a.skill * workerEfficiency(a) ||
          a.id.localeCompare(b.id),
      );
    const chosen = candidates.slice(0, task.slots);
    for (const p of chosen) {
      assignments[p.id] = { area: task.area, building: task.building };
      if (task.area === "repair") {
        builders.push(p);
        jobs[p.id] =
          `${project!.name} · ${project!.project?.kind === "convert" ? "시설 전환" : "건물 복구"}`;
      } else if (task.building !== null) {
        facilities[task.building].workers.push(p.id);
        jobs[p.id] =
          `${s.buildings[task.building].name} · ${WORK_NAMES[task.area]}`;
      } else {
        jobs[p.id] = `쉘터 · ${WORK_NAMES[task.area]}`;
        if (task.area !== "guard")
          production[task.area] +=
            ECONOMY.baseProduction[task.area] *
            p.skill *
            workerEfficiency(p) *
            (task.area === "materials" && s.policy === "salvage"
              ? ECONOMY.salvageMultiplier
              : 1);
      }
    }
    if (task.building !== null && !chosen.length)
      warnings.push(
        `${s.buildings[task.building].name}: ${task.area === "repair" ? "복구 인력 대기" : "적합한 인력 부족"}`,
      );
  }
  for (const p of alive.filter((p) => !(p.id in assignments))) {
    assignments[p.id] = null;
    jobs[p.id] = workerEfficiency(p) > 0 ? "수요 없음 · 대기" : "의무실 회복";
  }
  demand.food =
    alive.length *
    ECONOMY.consumption.food *
    (s.policy === "ration" ? ECONOMY.rationMultiplier : 1);
  demand.water = alive.length * ECONOMY.consumption.water;
  demand.power = ECONOMY.consumption.power;
  const ordered = operating
    .filter((b) => b.id !== 0 && b.facility)
    .sort(
      (a, b) =>
        s.priorities[FACILITIES[b.facility!].resource ?? "guard"] -
          s.priorities[FACILITIES[a.facility!].resource ?? "guard"] ||
        a.id - b.id,
    );
  let materialBudget = s.resources.materials + production.materials;
  const funded: Record<number, number> = {};
  for (const b of ordered) {
    const info = facilities[b.id],
      cost =
        info.workers.length || b.facility === "housing"
          ? ECONOMY.maintenance[b.facility!]
          : 0;
    demand.materials += cost;
    info.materialUsed = Math.min(materialBudget, cost);
    materialBudget -= info.materialUsed;
    facilityConsumption.materials += info.materialUsed;
    funded[b.id] = cost
      ? ECONOMY.unfundedEfficiency +
        ((1 - ECONOMY.unfundedEfficiency) * info.materialUsed) / cost
      : 1;
  }
  function produce(b: Building, powerFactor: number) {
    const f = FACILITIES[b.facility!],
      info = facilities[b.id];
    const fit = b.suitability[b.facility!],
      health =
        info.workers.reduce(
          (n, id) => n + workerEfficiency(s.people.find((p) => p.id === id)!),
          0,
        ) / Math.max(1, info.workers.length);
    info.efficiency =
      fit *
      funded[b.id] *
      powerFactor *
      (b.facility === "housing" ? 1 : health);
    if (f.resource) {
      const output =
        info.workers.reduce((n, id) => {
          const p = s.people.find((p) => p.id === id)!;
          return n + f.amount * p.skill * workerEfficiency(p);
        }, 0) *
        fit *
        funded[b.id] *
        powerFactor *
        (b.facility === "workshop" && s.policy === "salvage"
          ? ECONOMY.salvageMultiplier
          : 1);
      production[f.resource] += output;
      info.output[f.resource] = output;
    }
    if (!info.workers.length && f.resource)
      info.reason = "인력 부족 · 생산 중단";
    else if (funded[b.id] < 1) info.reason = "유지 자재 부족 · 효율 저하";
  }
  for (const b of ordered.filter((b) => b.facility === "generator"))
    produce(b, 1);
  let powerBudget = s.resources.power + production.power;
  livingConsumption.power = Math.min(powerBudget, ECONOMY.consumption.power);
  powerBudget -= livingConsumption.power;
  for (const b of ordered.filter((b) => b.facility !== "generator")) {
    const info = facilities[b.id];
    info.powerDemand = info.workers.length * ECONOMY.facilityPower[b.facility!];
    demand.power += info.powerDemand;
    info.powerUsed = Math.min(powerBudget, info.powerDemand);
    powerBudget -= info.powerUsed;
    facilityConsumption.power += info.powerUsed;
    const factor = info.powerDemand
      ? ECONOMY.unpoweredEfficiency +
        ((1 - ECONOMY.unpoweredEfficiency) * info.powerUsed) / info.powerDemand
      : 1;
    produce(b, factor);
    if (info.powerUsed + 1e-8 < info.powerDemand)
      info.reason = `전력 부족 · 공급 ${Math.round((info.powerUsed / info.powerDemand) * 100)}%`;
  }
  for (const b of ordered)
    if (facilities[b.id].reason)
      warnings.push(`${b.name}: ${facilities[b.id].reason}`);
  for (const key of ["food", "water"] as const)
    livingConsumption[key] = Math.min(
      s.resources[key] + production[key],
      demand[key],
    );
  const consumption = emptyStock(),
    net = emptyStock(),
    delta = emptyStock(),
    overflow = emptyStock(),
    unmet = emptyStock();
  const shortageHours: EconomyFlow["shortageHours"] = {
    food: null,
    water: null,
    power: null,
    materials: null,
  };
  for (const key of RESOURCES) {
    consumption[key] = livingConsumption[key] + facilityConsumption[key];
    net[key] = production[key] - demand[key]; // Required full-demand balance, not artificially positive after rationing.
    unmet[key] = Math.max(0, demand[key] - consumption[key]);
    const next = s.resources[key] + production[key] - consumption[key];
    overflow[key] = Math.max(0, next - storageCapacity(s));
    delta[key] =
      Math.max(0, Math.min(storageCapacity(s), next)) - s.resources[key];
    shortageHours[key] = net[key] < 0 ? s.resources[key] / -net[key] : null;
    if (unmet[key] > 1e-8)
      warnings.push(
        `${key === "food" ? "식량" : key === "water" ? "식수" : key === "power" ? "전력" : "유지 자재"} 공급 부족 ${unmet[key].toFixed(2)}/h`,
      );
  }
  return {
    production,
    consumption,
    livingConsumption,
    facilityConsumption,
    demand,
    net,
    delta,
    overflow,
    unmet,
    jobs,
    assignments,
    builders,
    facilities,
    warnings,
    powerDemand: demand.power,
    powerUsed: consumption.power,
    repairWork: builders.reduce(
      (n, p) => n + p.skill * workerEfficiency(p) * WORK.repairPerSkill,
      0,
    ),
    shortageHours,
  };
}
