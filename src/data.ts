import type { Facility, GameState, Resource, Role } from "./model";
export const RESOURCE_NAMES: Record<Resource, string> = {
  food: "식량",
  water: "식수",
  power: "전력",
  materials: "자재",
};
export const ROLE_NAMES: Record<Role, string> = {
  farmer: "재배",
  engineer: "기술",
  scavenger: "수색",
  guard: "경비",
};
export const FACILITIES: Record<
  Facility,
  {
    name: string;
    description: string;
    role: Role;
    resource?: Resource;
    amount: number;
  }
> = {
  farm: {
    name: "수경 농장",
    description: "재배 주민이 식량 생산 · 전력 0.3/h",
    role: "farmer",
    resource: "food",
    amount: 2.8,
  },
  pump: {
    name: "정수 시설",
    description: "기술 주민이 식수 생산 · 전력 0.3/h",
    role: "engineer",
    resource: "water",
    amount: 3.5,
  },
  generator: {
    name: "발전 시설",
    description: "기술 주민이 전력 생산",
    role: "engineer",
    resource: "power",
    amount: 2.5,
  },
  workshop: {
    name: "재활용 작업장",
    description: "수색 주민이 자재 생산",
    role: "scavenger",
    resource: "materials",
    amount: 1.8,
  },
  housing: {
    name: "주거 구역",
    description: "수용 인원 +5 · 여유와 물자가 있으면 12시간마다 이주",
    role: "engineer",
    amount: 5,
  },
  barracks: {
    name: "방위 초소",
    description: "전투력 +15% · 군사 지원 의무 대응",
    role: "guard",
    amount: 0.15,
  },
};
export const STATUS_NAMES = {
  unknown: "미발견",
  discovered: "발견",
  secured: "확보",
  restoring: "복구 중",
  operating: "운영 중",
};
export function newGame(seed = 727): GameState {
  const names = [
    "윤서",
    "도윤",
    "하린",
    "서진",
    "지호",
    "수아",
    "이준",
    "나래",
    "민재",
    "해솔",
  ];
  const roles: Role[] = [
    "guard",
    "farmer",
    "farmer",
    "engineer",
    "engineer",
    "scavenger",
    "scavenger",
    "guard",
    "engineer",
    "farmer",
  ];
  const labels = [
    "하부 환승 쉘터",
    "옛 식료품점",
    "빗물 집수장",
    "서부 공동 주택",
    "폐쇄 배전소",
    "골목 정비소",
    "철골 주차장",
    "교각 시장",
    "검문 초소",
    "온실 연구동",
    "수몰 도서관",
    "동부 아파트",
    "철도 창고",
    "흰탑 전초지",
    "고가 쉼터",
    "폐병원",
    "태양광 옥상",
    "중앙 물류국",
    "기계 보관소",
    "관측 타워",
  ];
  return {
    version: 1,
    seed: seed >>> 0,
    hour: 0,
    resources: { food: 75, water: 85, power: 45, materials: 65 },
    people: names.map((name, i) => ({
      id: `p${i}`,
      name,
      role: roles[i],
      skill: 1 + (i % 3) * 0.2,
      morale: 78,
      health: 100,
      hunger: 0,
      thirst: 0,
      injury: 0,
      alive: true,
      task: "대기",
    })),
    buildings: labels.map((name, i) => ({
      id: i,
      name,
      x: i % 5,
      y: Math.floor(i / 5),
      status:
        i === 0 ? "operating" : i === 1 || i === 5 ? "discovered" : "unknown",
      owner:
        i === 0
          ? "player"
          : i === 8 || i === 13
            ? "tower"
            : i === 7 || i === 12
              ? "bridge"
              : i === 17 || i === 18
                ? "iron"
                : null,
      danger: i === 0 ? 0 : 12 + i * 3,
      terrain: i % 4 === 0 ? 1.25 : 1,
      cost: 16 + (i % 5) * 4,
      progress: 0,
      facility: i === 0 ? "housing" : null,
      loot: 8 + (i % 4) * 4,
    })),
    factions: [
      {
        id: "bridge",
        name: "교각 연맹",
        leader: "류하",
        title: "남작",
        color: "#c3a46c",
        relation: 25,
        interest: "식량과 안전한 교역로",
        resource: "food",
        recognized: [],
      },
      {
        id: "tower",
        name: "흰탑 자치령",
        leader: "백서린",
        title: "백작",
        color: "#8caebb",
        relation: 10,
        interest: "식수와 공동체의 안정",
        resource: "water",
        recognized: [],
      },
      {
        id: "iron",
        name: "철의 조합",
        leader: "강무진",
        title: "남작",
        color: "#bf7c6b",
        relation: -5,
        interest: "자재와 군사 협력",
        resource: "materials",
        recognized: [],
      },
    ],
    leader: "p0",
    successor: "p1",
    expeditionLeader: false,
    partySize: 3,
    equipment: 1,
    policy: "balanced",
    title: "commoner",
    contract: null,
    pendingSuccession: false,
    ended: false,
    logs: [
      {
        id: 0,
        hour: 0,
        category: "system",
        text: "하부 환승역에 10명의 생존자가 모였습니다. 식량과 식수를 확보하고, 이곳을 우리의 도시로 만드세요.",
      },
    ],
    nextLog: 1,
    battles: [],
    lastSavedAt: Date.now(),
    offlineSummary: null,
  };
}
