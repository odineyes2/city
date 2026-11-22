// 도시 구조물의 적합성과 복구/용도 전환 견적. 의료·연구는 향후 확장용 특성만 둔다.
import type { Building, Facility, GameState } from "./model";
import { ECONOMY, WORK } from "./config";
const all: Facility[] = [
  "farm",
  "pump",
  "generator",
  "workshop",
  "housing",
  "barracks",
];
type Profile = {
  label: string;
  fit: Partial<Record<Facility, number>>;
  blocked?: Facility[];
  storage?: number;
  housing?: number;
  healing?: number;
  note: string;
};
export const BUILDING_TYPES: Record<string, Profile> = {
  shelter: {
    label: "지하 환승역",
    fit: { housing: 1 },
    note: "기초 생산과 공동체 본부",
  },
  store: {
    label: "식료품점",
    fit: { farm: 1.2, workshop: 1.1 },
    storage: 40,
    note: "기존 보관실을 활용 · 가동 시 저장 +40",
  },
  waterworks: {
    label: "집수 구조물",
    fit: { pump: 1.4, farm: 1.15 },
    blocked: ["generator"],
    note: "기존 배수 설비 · 정수 적합",
  },
  residential: {
    label: "공동 주택",
    fit: { housing: 1.35, farm: 1.05 },
    blocked: ["generator"],
    housing: 2,
    note: "주거 운영 시 수용 인원 추가 +2",
  },
  substation: {
    label: "배전 시설",
    fit: { generator: 1.4, barracks: 1.1 },
    blocked: ["farm"],
    note: "잔존 배선 · 발전 적합",
  },
  workshop: {
    label: "정비 시설",
    fit: { workshop: 1.4, generator: 1.15, pump: 0.85 },
    note: "공구와 작업대 · 자재 회수 적합",
  },
  parking: {
    label: "철골 주차장",
    fit: { barracks: 1.35, workshop: 1.1, housing: 0.85 },
    storage: 30,
    note: "넓은 면적 · 가동 시 저장 +30",
  },
  market: {
    label: "교역 시장",
    fit: { workshop: 1.2, farm: 1.1 },
    storage: 20,
    note: "유통 공간 · 가동 시 저장 +20",
  },
  checkpoint: {
    label: "검문 초소",
    fit: { barracks: 1.4, housing: 0.8 },
    blocked: ["farm", "pump"],
    note: "엄폐 구조 · 방위 적합",
  },
  lab: {
    label: "연구 구조물",
    fit: { farm: 1.3, pump: 1.2, generator: 1.1 },
    note: "밀폐 설비 · 연구 시스템은 후속 단계",
  },
  library: {
    label: "공공 도서관",
    fit: { housing: 1.2, farm: 0.8 },
    blocked: ["generator"],
    note: "공공 공간 · 공동 주거 적합",
  },
  warehouse: {
    label: "물류 창고",
    fit: { workshop: 1.3, barracks: 1.2 },
    storage: 50,
    note: "물류 공간 · 가동 시 저장 +50",
  },
  clinic: {
    label: "폐병원",
    fit: { housing: 1.2, pump: 1.15 },
    healing: 0.3,
    note: "위생 구획 · 가동 시 부상 회복 +0.3/h. 의료 시스템은 미구현",
  },
  rooftop: {
    label: "고층 옥상",
    fit: { generator: 1.4, farm: 1.2, housing: 0.7 },
    note: "채광과 바람 · 발전·농장 적합",
  },
  machine: {
    label: "기계 보관소",
    fit: { workshop: 1.4, generator: 1.25 },
    blocked: ["housing", "farm"],
    note: "위험한 중장비 · 공업 시설 적합",
  },
  tower: {
    label: "관측 타워",
    fit: { barracks: 1.4, generator: 1.2, housing: 0.8 },
    blocked: ["pump"],
    note: "높은 시야 · 방위 적합",
  },
};
const types = [
  "shelter",
  "store",
  "waterworks",
  "residential",
  "substation",
  "workshop",
  "parking",
  "market",
  "checkpoint",
  "lab",
  "library",
  "residential",
  "warehouse",
  "checkpoint",
  "residential",
  "clinic",
  "rooftop",
  "warehouse",
  "machine",
  "tower",
];
export function buildingTraits(
  id: number,
): Pick<
  Building,
  | "type"
  | "structure"
  | "repairDifficulty"
  | "allowedFacilities"
  | "suitability"
  | "effects"
  | "project"
> {
  const type = types[id],
    p = BUILDING_TYPES[type];
  return {
    type,
    structure: id === 0 ? 100 : 65 + (id % 4) * 6,
    repairDifficulty: id === 0 ? 1 : 1 + (id % 3) * 0.05,
    allowedFacilities: all.filter((f) => !p.blocked?.includes(f)),
    suitability: Object.fromEntries(
      all.map((f) => [f, p.fit[f] ?? 1]),
    ) as Record<Facility, number>,
    effects: {
      storage: p.storage ?? 0,
      housing: p.housing ?? 0,
      healing: p.healing ?? 0,
    },
    project: null,
  };
}
export const isOperating = (b: Building) =>
  b.owner === "player" && b.status === "operating";
export const storageCapacity = (s: GameState) =>
  ECONOMY.storage +
  s.buildings
    .filter(isOperating)
    .reduce((n, b) => n + ECONOMY.storagePerBuilding + b.effects.storage, 0);
export function projectQuote(
  b: Building,
  target: Facility,
  convert = b.status === "operating",
) {
  const fit = b.suitability[target];
  const modifier = fit >= 1.15 ? 0.85 : fit < 1 ? 1.15 : 1;
  const condition = 1 + (100 - b.structure) / 500;
  const materials = Math.ceil(
    (convert
      ? Math.max(WORK.conversionMinCost, b.cost * WORK.conversionCostFraction)
      : b.cost) *
      b.repairDifficulty *
      modifier *
      condition,
  );
  const work =
    (convert ? WORK.conversionWork : WORK.repairWork) * b.repairDifficulty;
  return {
    materials,
    work,
    idealHours: Math.ceil(
      work / (WORK.repairWorkers * 1.2 * WORK.repairPerSkill),
    ),
    fit,
    allowed: b.allowedFacilities.includes(target),
  };
}
