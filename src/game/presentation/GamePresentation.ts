// 저장/경제를 쓰지 않는 읽기 전용 투영. 렌더러에는 게임 명령이나 가변 GameState를 주지 않는다.
import type {
  BuildingStatus,
  Facility,
  GameState,
  Role,
  Stock,
  WorkArea,
} from "../../model";
import { ECONOMY } from "../../config";
import { economy, workerEfficiency } from "../../economy";
import { FACILITIES, STATUS_NAMES } from "../../data";
import {
  createBuildingLayout,
  type BuildingLayout,
  type RoomKind,
} from "../building/BuildingLayout";

export interface CityBuildingPresentation {
  id: number;
  name: string;
  type: string;
  position: [number, number, number];
  status: BuildingStatus;
  statusName: string;
  owner: string;
  owned: boolean;
  known: boolean;
  reachable: boolean;
  facility: Facility | null;
  progress: number;
  condition: number;
  active: boolean;
  powered: boolean;
  powerSupply: number;
  activity: number;
  workerCount: number;
  warning: string;
  accent: string;
}
export type AnimationState =
  | "idle"
  | "walking"
  | "working"
  | "resting"
  | "injured"
  | "repairing";
export interface ResidentPresentation {
  id: string;
  name: string;
  role: Role;
  health: number;
  injury: number;
  hunger: number;
  thirst: number;
  warning: string;
  task: string;
  area: WorkArea | null;
  roomId: string;
  state: AnimationState;
  present: boolean;
  speed: number;
  equipment: number;
}
export interface RoomPresentation {
  id: string;
  kind: RoomKind;
  label: string;
  active: boolean;
  workers: string[];
  output: string;
  warning: string;
  progress: number | null;
  powerSupply: number;
  activity: number;
  restored: boolean;
}
export interface BuildingPresentation {
  campaignId: string;
  id: number;
  name: string;
  status: BuildingStatus;
  statusName: string;
  facility: string;
  accessible: boolean;
  representative: boolean;
  layout: BuildingLayout;
  rooms: RoomPresentation[];
  residents: ResidentPresentation[];
  offsite: number;
  paused: boolean;
  progress: number;
  warning: string;
}
export interface GamePresentation {
  paused: boolean;
  city: CityBuildingPresentation[];
  interior: BuildingPresentation;
  warnings: string[];
  feedback: Record<
    keyof Stock,
    { production: number; demand: number; unmet: number }
  >;
}
const kindForArea: Record<WorkArea, RoomKind> = {
  food: "hydro",
  water: "pump",
  power: "generator",
  materials: "workshop",
  repair: "repair",
  guard: "security",
};
const kindForFacility: Record<Facility, RoomKind> = {
  farm: "hydro",
  pump: "pump",
  generator: "generator",
  workshop: "workshop",
  housing: "housing",
  barracks: "security",
};
const areaForKind: Partial<Record<RoomKind, WorkArea>> = {
  hydro: "food",
  pump: "water",
  generator: "power",
  workshop: "materials",
  repair: "repair",
  security: "guard",
};
const resourceNames: Record<keyof Stock, string> = {
  food: "식량",
  water: "식수",
  power: "전력",
  materials: "자재",
};
export const cityPosition = (
  x: number,
  y: number,
): [number, number, number] => [(x - 2) * 20, 0, (y - 1.5) * 20];
export function presentGame(s: GameState, selected = 0): GamePresentation {
  const flow = economy(s),
    paused = !s.clock.speed || s.ended || s.pendingSuccession;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const centralPower = clamp(
    flow.livingConsumption.power / ECONOMY.consumption.power,
  );
  const supply = (id: number) => {
    const f = flow.facilities[id];
    return f?.powerDemand ? clamp(f.powerUsed / f.powerDemand) : centralPower;
  };
  const facilityActivity = (id: number) => {
    const building = s.buildings[id],
      f = flow.facilities[id];
    return f && building.facility
      ? clamp(
          f.efficiency /
            Math.max(0.01, building.suitability[building.facility]),
        )
      : 0;
  };
  const city = s.buildings.map((b) => {
    const info = flow.facilities[b.id],
      owned = b.owner === "player";
    return {
      id: b.id,
      name: b.status === "unknown" ? "미탐사 구조물" : b.name,
      type: b.type,
      position: cityPosition(b.x, b.y),
      status: b.status,
      statusName:
        b.project?.kind === "convert" ? "시설 전환 중" : STATUS_NAMES[b.status],
      owner: owned
        ? "새벽 공동체"
        : (s.factions.find((f) => f.id === b.owner)?.name ?? "무주지"),
      owned,
      known: b.status !== "unknown",
      reachable: s.buildings.some(
        (a) =>
          a.owner === "player" &&
          Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1,
      ),
      facility: b.facility,
      progress: b.progress,
      condition: b.structure,
      active: b.status === "operating",
      powered: owned && supply(b.id) > 0,
      powerSupply: owned ? supply(b.id) : 0,
      activity:
        b.status === "restoring"
          ? flow.builders.length
            ? 1
            : 0
          : b.id === 0
            ? 1
            : facilityActivity(b.id),
      workerCount: Object.values(flow.assignments).filter(
        (a) => a && a.building === (b.id === 0 ? null : b.id),
      ).length,
      warning:
        b.status === "restoring" && !flow.builders.length
          ? "복구 인력 대기"
          : (info?.reason ?? ""),
      accent: owned
        ? "#98c1a1"
        : (s.factions.find((f) => f.id === b.owner)?.color ?? "#a2a08d"),
    };
  });
  const b = s.buildings[selected] ?? s.buildings[0],
    layout = createBuildingLayout(b.id, b.type),
    accessible = b.owner === "player",
    home = b.id === 0;
  const allOutput = Object.values(flow.facilities).reduce(
    (sum, f) => {
      for (const k of Object.keys(sum) as (keyof Stock)[])
        sum[k] += f.output[k];
      return sum;
    },
    { food: 0, water: 0, power: 0, materials: 0 },
  );
  const toRoom = (kind: RoomKind) =>
    layout.floors.flatMap((f) => f.rooms).find((r) => r.kind === kind) ??
    layout.floors[0].rooms[0];
  const residents = s.people
    .filter((p) => p.alive)
    .map((p) => {
      const assignment = flow.assignments[p.id] ?? null,
        here = assignment
          ? assignment.building === b.id ||
            (home && assignment.building === null)
          : home;
      const injured = workerEfficiency(p) === 0;
      const kind = injured
        ? "infirmary"
        : assignment
          ? kindForArea[assignment.area]
          : p.morale < 50
            ? "housing"
            : "entry";
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        health: p.health,
        injury: p.injury,
        hunger: p.hunger,
        thirst: p.thirst,
        warning: [
          p.hunger > 20 ? `허기 ${Math.round(p.hunger)}` : "",
          p.thirst > 20 ? `갈증 ${Math.round(p.thirst)}` : "",
        ]
          .filter(Boolean)
          .join(" · "),
        task: flow.jobs[p.id] ?? p.task,
        area: assignment?.area ?? null,
        roomId: toRoom(kind).id,
        state: injured
          ? "injured"
          : assignment?.area === "repair"
            ? "repairing"
            : assignment
              ? "working"
              : p.morale < 50
                ? "resting"
                : "idle",
        present: accessible && here,
        speed: p.injury > 0 ? 0.6 : 1,
        equipment: s.equipment,
      } as ResidentPresentation;
    });
  const rooms = layout.floors
    .flatMap((f) => f.rooms)
    .map((room) => {
      const area = areaForKind[room.kind],
        workers = residents
          .filter(
            (p) =>
              p.present &&
              p.roomId === room.id &&
              (p.state === "working" || p.state === "repairing"),
          )
          .map((p) => p.id);
      let output = "",
        active = false,
        warning = "",
        progress: number | null = null;
      if (home && area && area !== "repair" && area !== "guard") {
        const value = flow.production[area] - allOutput[area];
        active = workers.length > 0;
        output = `기초 ${resourceNames[area]} ${Math.max(0, value).toFixed(1)}/h`;
      } else if (home && area === "guard") {
        active = workers.length > 0;
        output = "실제 쉘터 경계";
      } else if (room.kind === "repair") {
        active = b.status === "restoring";
        progress = active ? b.progress : null;
        warning = active && !workers.length ? "복구 인력 대기" : "";
        output = active
          ? `${b.project?.kind === "convert" ? "전환" : "복구"} ${Math.round(b.progress)}%`
          : b.structure >= 99
            ? "예비 구획 · 독립 시설/생산 없음"
            : "미복구 공간 · 실제 작업 미진행";
      } else if (
        !home &&
        b.facility &&
        room.id === toRoom(kindForFacility[b.facility]).id
      ) {
        active =
          b.status === "operating" &&
          (b.facility === "housing" ||
            (!!flow.facilities[b.id]?.workers.length &&
              flow.facilities[b.id].efficiency > 0));
        const info = flow.facilities[b.id];
        output = info
          ? Object.entries(info.output)
              .filter(([, v]) => v > 0)
              .map(
                ([k, v]) =>
                  `${resourceNames[k as keyof Stock]} ${v.toFixed(1)}/h`,
              )
              .join(" · ")
          : "";
        warning = info?.reason ?? "";
      }
      if (room.kind === "housing") {
        active = home || (b.facility === "housing" && b.status === "operating");
        output = home
          ? "공동 생활 공간"
          : active
            ? "실제 주거 시설 · 공동체 수용력 반영"
            : "미가동 생활 공간";
      }
      if (room.kind === "infirmary") {
        active = residents.some((p) => p.present && p.state === "injured");
        output = "회복 공간 · 의료 생산 없음";
      }
      if (room.kind === "stores") output = "공용 보관 공간 · 추가 생산 없음";
      return {
        id: room.id,
        kind: room.kind,
        label:
          room.kind === "repair" &&
          b.structure >= 99 &&
          b.status !== "restoring"
            ? "예비 구획"
            : room.label,
        active: accessible && active,
        workers,
        output,
        warning,
        progress,
        powerSupply: accessible ? supply(b.id) : 0,
        activity: !active
          ? 0
          : home
            ? workers.reduce(
                (n, id) =>
                  n + workerEfficiency(s.people.find((p) => p.id === id)!),
                0,
              ) / Math.max(1, workers.length)
            : room.kind === "repair"
              ? workers.length
                ? 1
                : 0
              : facilityActivity(b.id),
        restored: b.structure >= 99 && b.status !== "restoring",
      };
    });
  return {
    paused,
    city,
    interior: {
      campaignId: s.campaignId,
      id: b.id,
      name: b.status === "unknown" ? "미탐사 구조물" : b.name,
      status: b.status,
      statusName:
        b.project?.kind === "convert" ? "시설 전환 중" : STATUS_NAMES[b.status],
      facility: b.facility ? FACILITIES[b.facility].name : "미지정",
      accessible,
      representative: home,
      layout,
      rooms,
      residents,
      offsite: home ? residents.filter((p) => !p.present).length : 0,
      paused,
      progress: b.progress,
      warning:
        b.status === "restoring" && !flow.builders.length
          ? "복구 인력 대기"
          : (flow.facilities[b.id]?.reason ?? ""),
    },
    warnings: flow.warnings,
    feedback: Object.fromEntries(
      (Object.keys(flow.unmet) as (keyof Stock)[]).map((k) => [
        k,
        {
          production: flow.production[k],
          demand: flow.demand[k],
          unmet: flow.unmet[k],
        },
      ]),
    ) as GamePresentation["feedback"],
  };
}
