export type Resource = "food" | "water" | "power" | "materials";
export type Stock = Record<Resource, number>;
export type WorkArea = Resource | "repair" | "guard";
export type Priority = 0 | 1 | 2;
export type Speed = 0 | 1 | 2 | 4;
export interface Assignment {
  area: WorkArea;
  building: number | null;
}
export interface Project {
  kind: "restore" | "convert";
  target: Facility;
  workRequired: number;
  paidMaterials: number;
}
export type Role = "farmer" | "engineer" | "scavenger" | "guard";
export type Facility =
  | "farm"
  | "pump"
  | "generator"
  | "workshop"
  | "housing"
  | "barracks";
export type BuildingStatus =
  | "unknown"
  | "discovered"
  | "secured"
  | "restoring"
  | "operating";
export interface Person {
  id: string;
  name: string;
  role: Role;
  skill: number;
  morale: number;
  health: number;
  hunger: number;
  thirst: number;
  injury: number;
  alive: boolean;
  task: string;
  assignment: Assignment | null;
}
export interface Building {
  id: number;
  name: string;
  x: number;
  y: number;
  status: BuildingStatus;
  owner: string | null;
  danger: number;
  terrain: number;
  cost: number;
  progress: number;
  facility: Facility | null;
  loot: number;
  type: string;
  structure: number;
  repairDifficulty: number;
  allowedFacilities: Facility[];
  suitability: Record<Facility, number>;
  effects: { storage: number; housing: number; healing: number };
  project: Project | null;
}
export interface Faction {
  id: string;
  name: string;
  leader: string;
  title: string;
  color: string;
  relation: number;
  interest: string;
  resource: Resource;
  recognized: number[];
}
export interface Contract {
  allegiance: boolean;
  tax: boolean;
  military: boolean;
  patron: string;
}
export interface LogEntry {
  id: number;
  hour: number;
  category: "system" | "work" | "combat" | "diplomacy";
  text: string;
  important?: boolean;
}
export interface Battle {
  hour: number;
  building: string;
  strength: number;
  defense: number;
  roll: number;
  won: boolean;
  casualties: string[];
}
export interface GameState {
  version: 2;
  campaignId: string;
  revision: number;
  clock: {
    speed: Speed;
    onlineRemainderMs: number;
    offlineRemainderMs: number;
  };
  priorities: Record<WorkArea, Priority>;
  processedCommands: string[];
  warnings: string[];
  seed: number;
  hour: number;
  resources: Stock;
  people: Person[];
  buildings: Building[];
  factions: Faction[];
  leader: string;
  successor: string | null;
  expeditionLeader: boolean;
  partySize: number;
  equipment: number;
  policy: "balanced" | "ration" | "salvage";
  title: "commoner" | "baron";
  contract: Contract | null;
  pendingSuccession: boolean;
  ended: boolean;
  logs: LogEntry[];
  nextLog: number;
  battles: Battle[];
  lastSavedAt: number;
  offlineSummary: string | null;
}
export type Command = (
  | { type: "explore" | "secure" | "negotiate" | "restore"; building: number }
  | { type: "facility"; building: number; facility: Facility }
  | { type: "role"; person: string; role: Role }
  | { type: "party"; size: number }
  | { type: "expeditionLeader"; value: boolean }
  | { type: "policy"; policy: GameState["policy"] }
  | { type: "equipment" }
  | { type: "gift" | "recognition" | "trade"; faction: string }
  | {
      type: "claim";
      faction: string;
      allegiance: boolean;
      tax: boolean;
      military: boolean;
    }
  | { type: "successor"; person: string }
  | { type: "priority"; area: WorkArea; priority: Priority }
  | { type: "speed"; speed: Speed }
  | { type: "succeed" | "end" }
) & { id?: string };
export interface Result {
  state: GameState;
  error?: string;
}
