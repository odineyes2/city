export type Resource = "food" | "water" | "power" | "materials";
export type Stock = Record<Resource, number>;
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
  version: 1;
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
export type Command =
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
  | { type: "succeed" | "end" };
export interface Result {
  state: GameState;
  error?: string;
}
