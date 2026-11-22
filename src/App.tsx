import GameShell from "./game/GameShell";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BatteryCharging,
  BookOpen,
  Box,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Crown,
  Droplets,
  Flag,
  Hammer,
  Heart,
  Map,
  Pause,
  Play,
  Radio,
  Save,
  Settings2,
  Shield,
  SkipForward,
  Sprout,
  Swords,
  Tent,
  Users,
  Wheat,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FACILITIES, RESOURCE_NAMES, ROLE_NAMES, STATUS_NAMES } from "./data";
import {
  advance,
  capacity,
  combatPower,
  defense,
  dispatch,
  economy,
  living,
  newGame,
  operating,
  owned,
  party,
  reachable,
  requiredRelation,
  serialize,
  stability,
  storage,
  titleRequirements,
} from "./engine";
import type {
  Building,
  Command,
  Facility,
  GameState,
  Resource,
  Role,
  Speed,
} from "./model";
import { TIME } from "./config";
import { onlineElapsed } from "./time";
import { AUTO, MANUAL, resumeGame, saveGame } from "./storage";
import {
  ActionButton,
  BuildingReport,
  FacilityControls,
  Priorities,
  ResourceLedger,
  Warnings,
} from "./Management";

const resourceIcons: Record<Resource, LucideIcon> = {
  food: Wheat,
  water: Droplets,
  power: Zap,
  materials: Box,
};
const facilityIcons: Record<Facility, LucideIcon> = {
  farm: Sprout,
  pump: Droplets,
  generator: Zap,
  workshop: Hammer,
  housing: Building2,
  barracks: Shield,
};
const time = (hour: number) =>
  `D${String(Math.floor(hour / 24) + 1).padStart(2, "0")} · ${String(hour % 24).padStart(2, "0")}:00`;
const freshGame = () => newGame(727, Date.now(), `city-${crypto.randomUUID()}`);
function initial(): { game: GameState; notice: string; recovery: boolean } {
  let failed = false;
  try {
    for (const slot of [AUTO, MANUAL]) {
      const raw = localStorage.getItem(slot);
      if (!raw) continue;
      try {
        return {
          game: resumeGame(raw, localStorage),
          notice: failed
            ? "자동 저장을 읽지 못해 수동 저장으로 복구했습니다. 원본은 복구 슬롯에 보관했습니다."
            : "",
          recovery: false,
        };
      } catch {
        failed = true;
        const backup = slot + "-recovery";
        if (!localStorage.getItem(backup)) localStorage.setItem(backup, raw);
      }
    }
  } catch {
    failed = true;
  }
  return {
    game: freshGame(),
    notice: failed
      ? "저장을 읽거나 보존하지 못했습니다. 원본을 덮어쓰지 않도록 자동 저장을 중단했습니다. 파일 가져오기 또는 새 게임을 선택하세요."
      : "",
    recovery: failed,
  };
}
function Meter({
  value,
  max = 100,
  color = "teal",
}: {
  value: number;
  max?: number;
  color?: string;
}) {
  return (
    <div className={`meter ${color}`}>
      <span
        style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}
      />
    </div>
  );
}
function Icon({ icon: I, size = 18 }: { icon: LucideIcon; size?: number }) {
  return <I size={size} strokeWidth={1.6} aria-hidden="true" />;
}
function CityMap({
  game,
  selected,
  onSelect,
}: {
  game: GameState;
  selected: number;
  onSelect: (id: number) => void;
}) {
  return (
    <svg
      className="city-svg"
      viewBox="0 0 1000 690"
      role="group"
      aria-label="도시 구역 건물 지도"
    >
      <defs>
        <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
          <path d="M25 0H0V25" fill="none" stroke="#273330" strokeWidth=".5" />
        </pattern>
        <pattern id="grain" width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".5" fill="#839187" opacity=".16" />
        </pattern>
      </defs>
      <rect width="1000" height="690" fill="#151e1c" />
      <rect width="1000" height="690" fill="url(#grid)" />
      <path
        d="M-40 620Q170 500 180 290T440-80"
        fill="none"
        stroke="#203b3d"
        strokeWidth="92"
      />
      <path
        d="M-40 620Q170 500 180 290T440-80"
        fill="none"
        stroke="#3c6869"
        strokeWidth="1"
        strokeDasharray="5 9"
      />
      {[0, 1, 2, 3].map((i) => (
        <path
          key={`h${i}`}
          d={`M25 ${115 + i * 150}H975`}
          stroke="#303935"
          strokeWidth="26"
        />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={`v${i}`}
          d={`M${110 + i * 190} 25V655`}
          stroke="#303935"
          strokeWidth="22"
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <path
          key={`hl${i}`}
          d={`M25 ${115 + i * 150}H975`}
          stroke="#697264"
          opacity=".4"
          strokeWidth="1"
          strokeDasharray="12 14"
        />
      ))}
      <path
        d="M15 42L970 648M15 52L960 658"
        stroke="#656b52"
        strokeWidth="3"
        opacity=".35"
      />
      {Array.from({ length: 65 }, (_, i) => (
        <rect
          key={`r${i}`}
          x={30 + ((i * 137) % 940)}
          y={25 + ((i * 83) % 625)}
          width={6 + (i % 9)}
          height={4 + (i % 7)}
          fill="#6c7563"
          opacity=".16"
          transform={`rotate(${i * 31} ${30 + ((i * 137) % 940)} ${25 + ((i * 83) % 625)})`}
        />
      ))}
      {game.buildings.map((b) => {
        const x = 48 + b.x * 190,
          y = 32 + b.y * 150,
          selectedNode = b.id === selected,
          unknown = b.status === "unknown",
          control = b.owner === "player";
        const faction = game.factions.find((f) => f.id === b.owner);
        const color = control ? "#78c6ad" : (faction?.color ?? "#9a9b88");
        const w = 78 + (b.id % 3) * 13,
          h = 48 + (b.id % 4) * 6;
        return (
          <g
            key={b.id}
            className={`map-node ${unknown ? "fog" : ""}`}
            role="button"
            tabIndex={0}
            aria-label={`${b.name} · ${STATUS_NAMES[b.status]}`}
            aria-pressed={selectedNode}
            onClick={() => onSelect(b.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(b.id);
              }
            }}
          >
            <rect
              x={x - 13}
              y={y - 7}
              width="158"
              height="134"
              rx="5"
              fill={selectedNode ? "#74bfa51b" : "#101714aa"}
              stroke={
                selectedNode ? "#8ad7b9" : control ? "#57816b" : "#445046"
              }
              strokeWidth={selectedNode ? 2 : 1}
              strokeDasharray={unknown ? "4 5" : undefined}
            />
            <rect x={x + 8} y={y + 17} width={w} height={h} fill="#080e0c" />
            <path
              d={`M${x + 4} ${y + 12}h${w}v${h}h-${w}z`}
              fill={unknown ? "#27302b" : control ? "#3f5144" : "#41463a"}
              stroke={unknown ? "#3b463e" : color}
              strokeWidth="1.5"
            />
            <path
              d={`M${x + 4} ${y + 12}l9 -8h${w}l-9 8M${x + 4 + w} ${y + 12}l9 -8v${h}l-9 8`}
              fill={unknown ? "#343e34" : "#56604c"}
              stroke="#6c7460"
              opacity=".65"
            />
            {Array.from({ length: 3 }, (_, j) => (
              <g key={j}>
                <rect
                  x={x + 14 + j * 23}
                  y={y + 24}
                  width="13"
                  height="8"
                  fill={control ? "#91b58a" : "#18241d"}
                  opacity={unknown ? 0.2 : 0.8}
                />
                <path
                  d={`M${x + 14 + j * 23} ${y + 43}v12`}
                  stroke={color}
                  opacity=".35"
                />
              </g>
            ))}
            <rect x={x + 14} y={y + 6} width="19" height="5" fill="#777d64" />
            <rect x={x + 69} y={y + 1} width="14" height="8" fill="#515c49" />
            {control && (
              <>
                <circle cx={x + 130} cy={y + 14} r="5" fill="#8ad7b9" />
                <path
                  d={`M${x + 127} ${y + 14}l2 2 4-4`}
                  fill="none"
                  stroke="#18231d"
                  strokeWidth="1.5"
                />
              </>
            )}
            <text
              x={x + 65}
              y={y + 93}
              textAnchor="middle"
              fill={unknown ? "#8b9588" : "#e3e5d8"}
              fontSize="13"
              fontFamily="inherit"
            >
              {unknown ? "미확인 구조물" : b.name}
            </text>
            <text
              x={x + 65}
              y={y + 112}
              textAnchor="middle"
              fill={unknown ? "#6d7b6d" : color}
              fontSize="11"
              fontFamily="inherit"
            >
              {unknown
                ? reachable(game, b)
                  ? "탐색 가능"
                  : "접근 불가"
                : b.status === "operating" && b.facility
                  ? FACILITIES[b.facility].name
                  : STATUS_NAMES[b.status]}
            </text>
            {b.status === "restoring" && (
              <rect
                x={x + 10}
                y={y + 119}
                width={b.progress * 1.1}
                height="2"
                fill="#c8ae79"
              />
            )}
          </g>
        );
      })}
      <rect width="1000" height="690" fill="url(#grain)" pointerEvents="none" />
      <text
        x="958"
        y="658"
        textAnchor="end"
        fill="#869788"
        fontSize="12"
        letterSpacing="3"
      >
        N ↑
      </text>
    </svg>
  );
}

export default function App() {
  const [boot] = useState(initial);
  const [game, setGame] = useState(boot.game);
  const [notice, setNotice] = useState(boot.notice);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"map" | "shelter" | "people" | "diplomacy">(
    "map",
  );
  const speed = game.clock.speed;
  const [suspendAuto, setSuspendAuto] = useState(boot.recovery);
  const [help, setHelp] = useState(false);
  const [reset, setReset] = useState(false);
  const [terms, setTerms] = useState({
    allegiance: false,
    tax: false,
    military: false,
  });
  const [logFilter, setLogFilter] = useState("all");
  const [saveError, setSaveError] = useState(boot.recovery);
  const [lastSave, setLastSave] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const gameRef = useRef(game);
  gameRef.current = game;
  const publish = (next: GameState) => {
    gameRef.current = next;
    setGame(next);
  };
  const gesture = useRef({ key: "", at: -Infinity });
  useEffect(() => {
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now(),
        elapsed = now - previous;
      previous = now;
      const source = gameRef.current,
        next = onlineElapsed(source, elapsed);
      if (next !== source) publish(next);
    }, TIME.pollMs);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const saveAuto = () => {
      if (suspendAuto) return;
      try {
        saveGame(AUTO, gameRef.current, localStorage);
        setSaveError(false);
      } catch {
        setSaveError(true);
      }
    };
    saveAuto();
    const timer = window.setInterval(saveAuto, TIME.autoSaveMs);
    const visibility = () => {
      if (document.visibilityState === "hidden") saveAuto();
    };
    window.addEventListener("pagehide", saveAuto);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", saveAuto);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [suspendAuto]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const act = (command: Command) => {
    const key = JSON.stringify(command),
      now = performance.now();
    if (gesture.current.key === key && now - gesture.current.at < 300) {
      setNotice("같은 행동의 연속 입력을 차단했습니다.");
      return;
    }
    gesture.current = { key, at: now };
    const result = dispatch(gameRef.current, {
      ...command,
      id: crypto.randomUUID(),
    });
    if (result.error) setNotice(result.error);
    else {
      publish(result.state);
      if (!suspendAuto)
        try {
          saveGame(AUTO, result.state, localStorage);
          setSaveError(false);
        } catch {
          setSaveError(true);
        }
    }
  };
  const setSpeed = (speed: Speed) => act({ type: "speed", speed });
  const people = living(game),
    leader = game.people.find((p) => p.id === game.leader)!;
  const b = game.buildings[selected];
  const flow = economy(game);
  const faction = game.factions.find((f) => f.id === b.owner);
  const req = titleRequirements(game);
  const stage = req.every((r) => r.current >= r.target)
    ? "교섭할 준비가 되었습니다"
    : "첫 작위까지, 한 걸음씩";
  const save = () => {
    try {
      saveGame(MANUAL, gameRef.current, localStorage);
      setSuspendAuto(false);
      setSaveError(false);
      setLastSave(time(game.hour));
      setNotice("수동 저장을 완료했습니다.");
    } catch {
      setSaveError(true);
      setNotice("브라우저 저장 공간에 접근할 수 없습니다. 파일로 내보내세요.");
    }
  };
  const load = () => {
    try {
      const raw = localStorage.getItem(MANUAL) || localStorage.getItem(AUTO);
      if (!raw) {
        setNotice("저장된 게임이 없습니다.");
        return;
      }
      publish(resumeGame(raw, localStorage));
      setSuspendAuto(false);
      setNotice("저장한 공동체를 불러왔습니다.");
    } catch {
      setNotice(
        "저장을 불러오지 못했습니다. 지원되는 v1/v2 저장 파일을 확인하세요.",
      );
    }
  };
  const exportSave = () => {
    const url = URL.createObjectURL(
      new Blob([serialize(gameRef.current)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ashen-city-save.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <GameShell
      game={game}
      act={act}
      step={() => publish(advance(gameRef.current))}
      selected={selected}
      onSelect={setSelected}
      onManageBuilding={() => setTab("map")}
      notice={notice}
      saveError={saveError}
    >
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <Icon icon={Building2} size={25} />
          </div>
          <div>
            ASHEN<span>CITY</span>
            <small>잔해의 도시</small>
          </div>
        </div>
        <div className="district-title">
          <span className="eyebrow">SECTOR 07 / NEW BEGINNINGS</span>
          <strong>
            새벽 지구 <span>· 하부 환승역</span>
          </strong>
        </div>
        <div className="time-controls">
          <div className="clock">
            <Radio size={14} />
            <span>{time(game.hour)}</span>
          </div>
          <div className="speed-buttons">
            <button
              aria-label="일시정지"
              title="일시정지"
              className={speed === 0 ? "active" : ""}
              onClick={() => setSpeed(0)}
            >
              <Pause size={15} />
            </button>
            {[1, 2, 4].map((n) => (
              <button
                key={n}
                disabled={game.ended || game.pendingSuccession}
                className={speed === n ? "active" : ""}
                aria-label={`${n}배속`}
                onClick={() => setSpeed(n as Speed)}
              >
                {n === 1 ? <Play size={14} /> : <>{n}×</>}
              </button>
            ))}
          </div>
          <button
            className="step-button"
            title="게임 1시간 진행"
            disabled={game.ended || game.pendingSuccession}
            onClick={() => publish(advance(gameRef.current))}
          >
            <SkipForward size={16} />
            <span>1시간</span>
          </button>
        </div>
        <button
          className="icon-button"
          aria-label="플레이 가이드"
          onClick={() => setHelp(true)}
        >
          <CircleHelp size={21} />
        </button>
      </header>
      <aside className="sidebar">
        <div className="community">
          <span className="eyebrow">OUR SETTLEMENT</span>
          <h2>새벽 공동체</h2>
          <span className="settlement-status">
            <span />{" "}
            {game.ended
              ? "여정 종료"
              : game.pendingSuccession
                ? "계승 대기"
                : stability(game) >= 60
                  ? "정착지 운영 중"
                  : "공동체 불안정"}
          </span>
        </div>
        <nav>
          {(
            [
              {
                id: "map",
                icon: Map,
                name: "도시 구역",
                caption: "탐색과 개척",
              },
              {
                id: "shelter",
                icon: Tent,
                name: "쉘터 운영",
                caption: "시설과 정책",
              },
              {
                id: "people",
                icon: Users,
                name: "주민",
                caption: `${people.length}명의 생존자`,
              },
              {
                id: "diplomacy",
                icon: Flag,
                name: "외교",
                caption: "세력과 작위",
              },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "selected" : ""}
              onClick={() => setTab(t.id)}
            >
              <Icon icon={t.icon} size={21} />
              <span>
                {t.name}
                <small>{t.caption}</small>
              </span>
              {tab === t.id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="leader-card">
          <div className="avatar">
            <Icon icon={game.title === "baron" ? Crown : Shield} size={28} />
          </div>
          <span className="eyebrow">COMMUNITY LEADER</span>
          <h3>
            {leader.name}{" "}
            <small>{game.title === "baron" ? "남작" : "평민 지도자"}</small>
          </h3>
          <div className="mini-stat">
            <span>건강</span>
            <strong>{Math.round(leader.health)} / 100</strong>
          </div>
          <Meter value={leader.health} />
          <p>
            {game.expeditionLeader
              ? "탐사대 동행 허용 · 전사 위험"
              : "쉘터에서 공동체 지휘"}
          </p>
        </div>
        <div className="milestone">
          <div className="section-kicker">
            <Crown size={17} />
            {game.title === "baron" ? "첫 이정표 달성" : "목표 · 남작의 인정"}
          </div>
          <p>{game.title === "baron" ? "폐허 위에 세운 당신의 이름" : stage}</p>
          {req.map((r) => (
            <div className="goal" key={r.label}>
              <span>
                {r.current >= r.target ? (
                  <Check size={13} />
                ) : (
                  <span className="goal-dot" />
                )}
                {r.label}
              </span>
              <strong>
                {r.current} / {r.target}
              </strong>
            </div>
          ))}
          <button className="text-button" onClick={() => setTab("diplomacy")}>
            인정 조건과 계약 <ChevronRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button onClick={save}>
            <Save size={15} /> 저장
          </button>
          <button onClick={load}>
            <BookOpen size={15} /> 불러오기
          </button>
          <span>
            {saveError
              ? "저장 불가 · 파일 내보내기 권장"
              : lastSave
                ? `수동 저장 ${lastSave}`
                : "변경 사항 자동 저장"}
          </span>
        </div>
      </aside>
      <main className="main-content">
        <section className="resource-strip" aria-label="공동체 자원">
          {(Object.keys(RESOURCE_NAMES) as Resource[]).map((key) => {
            const I = resourceIcons[key];
            return (
              <div className={`resource ${key}`} key={key}>
                <div className="resource-icon">
                  <I size={22} strokeWidth={1.7} />
                </div>
                <div>
                  <span>{RESOURCE_NAMES[key]}</span>
                  <strong>
                    {game.resources[key].toFixed(0)}
                    <small>/ {storage(game)}</small>
                  </strong>
                </div>
                <em className={flow.delta[key] < 0 ? "negative" : ""}>
                  {flow.delta[key] >= 0 ? "+" : ""}
                  {flow.delta[key].toFixed(1)}
                  <small>/h</small>
                </em>
                <small className="resource-flow">
                  생산 {flow.production[key].toFixed(1)} · 필요{" "}
                  {flow.demand[key].toFixed(1)} /h{" "}
                  {flow.overflow[key] > 0
                    ? `· 초과 ${flow.overflow[key].toFixed(1)}`
                    : ""}
                  {flow.shortageHours[key] !== null
                    ? ` · 부족 약 ${flow.shortageHours[key]!.toFixed(1)}h`
                    : ""}
                </small>
              </div>
            );
          })}
          <div className="resource population">
            <div className="resource-icon">
              <Users size={22} />
            </div>
            <div>
              <span>인구 / 수용</span>
              <strong>
                {people.length}
                <small>/ {capacity(game)}</small>
              </strong>
            </div>
          </div>
        </section>
        <ResourceLedger game={game} />
        <Warnings game={game} />
        {saveError && (
          <div className="banner negative">
            저장 실패 또는 복구 대기 · 파일 내보내기로 진행을 보존하세요.
          </div>
        )}
        {game.offlineSummary && (
          <div className="banner">
            <Radio size={17} />
            {game.offlineSummary}
            <button
              aria-label="알림 닫기"
              onClick={() => setGame((s) => ({ ...s, offlineSummary: null }))}
            >
              <X size={15} />
            </button>
          </div>
        )}
        {game.title === "baron" && (
          <div className="victory-banner">
            <Crown size={23} />
            <div>
              <strong>남작으로 인정받았습니다.</strong>
              <span>
                {
                  game.factions.find((f) => f.id === game.contract?.patron)
                    ?.name
                }
                의 인정 ·{" "}
                {game.contract?.allegiance
                  ? "충성 서약 체결"
                  : "독립 지위 유지"}{" "}
                · 공동체의 이야기는 계속됩니다.
              </span>
            </div>
          </div>
        )}
        <div className="workspace">
          <section className="primary-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">
                  {tab === "map"
                    ? "DISTRICT OVERVIEW"
                    : tab === "shelter"
                      ? "SETTLEMENT MANAGEMENT"
                      : tab === "people"
                        ? "PEOPLE OF THE DAWN"
                        : "DIPLOMACY & LEGITIMACY"}
                </span>
                <h1>
                  {tab === "map"
                    ? "폐허에서, 영토로."
                    : tab === "shelter"
                      ? "살아남는 것을 넘어."
                      : tab === "people"
                        ? "도시는 사람으로부터."
                        : "이름에 무게를 더하다."}
                </h1>
              </div>
              <span className="panel-badge">
                {tab === "map"
                  ? `${owned(game).length} / 20 지배`
                  : tab === "shelter"
                    ? `안정도 ${stability(game)}%`
                    : tab === "people"
                      ? `${people.length}명 생존`
                      : "3개 독립 세력"}
              </span>
            </div>
            {tab === "map" && (
              <>
                <div className="map-toolbar">
                  <span>
                    <span className="legend-dot player" />
                    우리 영토
                  </span>
                  <span>
                    <span className="legend-dot neutral" />
                    발견 구역
                  </span>
                  <span>
                    <span className="legend-dot other" />
                    다른 세력
                  </span>
                  <span className="toolbar-note">건물을 선택해 개척하세요</span>
                </div>
                <div className="map-container">
                  <div className="map-label">
                    <span>DAWN DISTRICT</span>
                    <small>기후 붕괴 이후 · 도시 외곽</small>
                  </div>
                  <CityMap
                    game={game}
                    selected={selected}
                    onSelect={setSelected}
                  />
                  <div className="map-bottom">
                    <span>구역 07</span>
                    <span>5 × 4 BLOCKS / LOCAL SURVEY</span>
                  </div>
                </div>
                <div className="map-hint">
                  <Icon icon={Radio} size={16} />
                  <span>
                    우리 영토에 인접한 건물부터 탐색할 수 있습니다.{" "}
                    <b>탐색 · 확보 · 용도 지정 · 복구</b>
                  </span>
                </div>
              </>
            )}
            {tab === "shelter" && (
              <div className="tab-body">
                <div className="summary-grid">
                  <div>
                    <Icon icon={Heart} />
                    <span>공동체 안정도</span>
                    <strong>
                      {stability(game)}
                      <small>%</small>
                    </strong>
                    <Meter value={stability(game)} />
                  </div>
                  <div>
                    <Icon icon={Building2} />
                    <span>가동 중인 건물</span>
                    <strong>
                      {operating(game).length}
                      <small> / {owned(game).length}</small>
                    </strong>
                    <p>시설과 복구 작업은 주민 인력을 공유합니다.</p>
                  </div>
                </div>
                <h3 className="subheading">운영 정책</h3>
                <div className="policies">
                  {(
                    [
                      {
                        id: "balanced",
                        name: "균형 배급",
                        desc: "표준 소비 · 부족이 없으면 사기 회복",
                      },
                      {
                        id: "ration",
                        name: "절약 배급",
                        desc: "식량 소비 35% 감소 · 사기 -0.35/h",
                      },
                      {
                        id: "salvage",
                        name: "잔해 회수 집중",
                        desc: "수색 자재 +50% · 사기 -0.15/h",
                      },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      className={game.policy === p.id ? "chosen" : ""}
                      onClick={() => act({ type: "policy", policy: p.id })}
                    >
                      <Settings2 size={18} />
                      <strong>{p.name}</strong>
                      <small>{p.desc}</small>
                      {game.policy === p.id && <Check size={16} />}
                    </button>
                  ))}
                </div>
                <h3 className="subheading">
                  우리 시설 <span>{owned(game).length}</span>
                </h3>
                <div className="facility-list">
                  {owned(game).map((building) => (
                    <button
                      key={building.id}
                      onClick={() => {
                        setSelected(building.id);
                        setTab("map");
                      }}
                    >
                      <div className="facility-icon">
                        <Icon
                          icon={
                            building.facility
                              ? facilityIcons[building.facility]
                              : Building2
                          }
                        />
                      </div>
                      <div>
                        <strong>{building.name}</strong>
                        <small>
                          {building.facility
                            ? FACILITIES[building.facility].name
                            : "용도 미지정"}
                        </small>
                      </div>
                      <span className={`status-tag ${building.status}`}>
                        {STATUS_NAMES[building.status]}
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
                <div className="note">
                  <BatteryCharging size={18} />
                  <p>
                    농장·정수 시설은 근무자당 전력 0.3/h를 사용합니다. 재고와
                    시간당 발전량을 합쳐 우선순위로 공급하며 부족분에 비례해
                    효율이 떨어집니다. 식량과 식수 부족이 지속되면 사기·건강이
                    떨어집니다.
                  </p>
                </div>
                <div className="save-tools">
                  <button onClick={exportSave}>
                    <ArrowDownToLine size={16} /> 저장 파일 내보내기
                  </button>
                  <button onClick={() => fileRef.current?.click()}>
                    <ArrowUpFromLine size={16} /> 파일 가져오기
                  </button>
                  <button
                    className="danger-text"
                    onClick={() => setReset(true)}
                  >
                    새 게임
                  </button>
                </div>
              </div>
            )}
            {tab === "people" && (
              <div className="tab-body">
                <div className="note">
                  <Users size={18} />
                  <p>
                    역할을 정하면 주민이 기술과 건강 상태에 따라 자동으로
                    일합니다. 복구 인력은 생산에서 빠집니다. 부상은 매시간
                    회복하며, 건강 40 미만 또는 부상 50 이상은 탐사에서
                    제외됩니다.
                  </p>
                </div>
                <Priorities game={game} act={act} />
                <div className="people-list">
                  {game.people.map((p) => (
                    <article
                      className={`person ${!p.alive ? "deceased" : ""}`}
                      key={p.id}
                    >
                      <div className="person-avatar">{p.name.slice(0, 1)}</div>
                      <div className="person-info">
                        <strong>
                          {p.name}{" "}
                          {p.id === game.leader && (
                            <span className="tiny-tag">지도자</span>
                          )}
                          {p.id === game.successor && (
                            <span className="tiny-tag">후계자</span>
                          )}
                        </strong>
                        <small>
                          {p.alive ? (flow.jobs[p.id] ?? p.task) : "사망"} ·
                          숙련 {p.skill.toFixed(1)}
                        </small>
                        <div className="needs">
                          건강 {Math.round(p.health)} · 사기{" "}
                          {Math.round(p.morale)} · 부상 {Math.round(p.injury)}
                          <br />
                          허기 {p.hunger} · 갈증 {p.thirst}
                        </div>
                      </div>
                      <select
                        aria-label={`${p.name} 역할`}
                        value={p.role}
                        disabled={!p.alive}
                        onChange={(e) =>
                          act({
                            type: "role",
                            person: p.id,
                            role: e.target.value as Role,
                          })
                        }
                      >
                        {Object.entries(ROLE_NAMES).map(([key, name]) => (
                          <option key={key} value={key}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </article>
                  ))}
                </div>
                <h3 className="subheading">후계 후보</h3>
                <p className="muted">
                  지도자 사망 시 시간이 멈추고 계승 여부를 선택합니다. 후보도
                  사망하면 생존자 중 사기가 높은 주민이 대신합니다.
                </p>
                <select
                  className="full-select"
                  aria-label="후계 후보"
                  value={game.successor ?? ""}
                  onChange={(e) =>
                    act({ type: "successor", person: e.target.value })
                  }
                >
                  {people
                    .filter((p) => p.id !== game.leader)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · 사기 {Math.round(p.morale)}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {tab === "diplomacy" && (
              <div className="tab-body">
                <div className="note">
                  <Crown size={20} />
                  <p>
                    작위는 건물 수만으로 주어지지 않습니다. 공동체의 기반을
                    갖추고 귀족의 인정을 얻으세요.{" "}
                    <b>남작 인정과 충성 서약은 별개의 선택입니다.</b>
                  </p>
                </div>
                <div className="contract-box">
                  <h3>남작 인정 · 제안할 계약</h3>
                  <div className="requirements">
                    {req.map((r) => (
                      <span
                        className={r.current >= r.target ? "met" : ""}
                        key={r.label}
                      >
                        <Check size={14} />
                        {r.label} ({r.current})
                      </span>
                    ))}
                  </div>
                  <p className="muted">
                    독립·무의무 계약은 관계 65 필요. 의무를 제안하면 인정에
                    필요한 관계가 낮아집니다.
                  </p>
                  {(
                    [
                      {
                        key: "allegiance",
                        name: "충성 서약",
                        desc: "후원 귀족의 봉신으로 기록 · 필요 관계 -15",
                      },
                      {
                        key: "tax",
                        name: "정기 세금",
                        desc: "접속 중 24시간마다 식량 8 · 체납 시 관계 -10 · 필요 관계 -10",
                      },
                      {
                        key: "military",
                        name: "군사 지원",
                        desc: "건강한 경비 2명 유지 · 미충족 시 관계 -8 · 필요 관계 -10",
                      },
                    ] as const
                  ).map((t) => (
                    <label className="contract-term" key={t.key}>
                      <input
                        type="checkbox"
                        checked={terms[t.key]}
                        disabled={game.title === "baron"}
                        onChange={(e) =>
                          setTerms({ ...terms, [t.key]: e.target.checked })
                        }
                      />
                      <span>
                        <strong>{t.name}</strong>
                        <small>{t.desc}</small>
                      </span>
                    </label>
                  ))}
                  <div className="contract-total">
                    이 제안의 필요 관계{" "}
                    <strong>
                      {requiredRelation(
                        terms.allegiance,
                        terms.tax,
                        terms.military,
                      )}
                    </strong>
                  </div>
                  {game.contract && (
                    <p className="muted">
                      체결 계약:{" "}
                      {game.contract.allegiance ? "충성 서약" : "독립"} /{" "}
                      {game.contract.tax ? "식량 세금 8/24h" : "세금 없음"} /{" "}
                      {game.contract.military
                        ? "경비 2명 의무"
                        : "군사 의무 없음"}
                    </p>
                  )}
                </div>
                <div className="faction-list">
                  {game.factions.map((f) => (
                    <article
                      key={f.id}
                      className="faction-card"
                      style={
                        { "--faction-color": f.color } as React.CSSProperties
                      }
                    >
                      <div className="faction-top">
                        <div className="faction-crest">
                          <Flag size={23} />
                        </div>
                        <div>
                          <span className="eyebrow">
                            {f.leader} {f.title}
                          </span>
                          <h3>{f.name}</h3>
                        </div>
                        <strong
                          className={f.relation < 0 ? "negative" : "relation"}
                        >
                          {f.relation > 0 ? "+" : ""}
                          {f.relation}
                          <small>관계</small>
                        </strong>
                      </div>
                      <p>
                        {f.interest} · 선호 자원: {RESOURCE_NAMES[f.resource]}
                      </p>
                      <div className="territory-line">
                        실효 지배{" "}
                        {game.buildings.filter((b) => b.owner === f.id).length}
                        곳 · 우리 영토 {f.recognized.length}곳 인정 ·{" "}
                        {f.relation < 0
                          ? "교역 중단"
                          : f.relation >= 25
                            ? "영토 양도 협상 가능"
                            : "관계 개선 필요"}
                      </div>
                      <div className="faction-actions">
                        <ActionButton
                          compact
                          game={game}
                          command={{ type: "gift", faction: f.id }}
                          act={act}
                        >
                          보급 전달{" "}
                          <small>
                            {RESOURCE_NAMES[f.resource]} 15 · 관계 +12
                          </small>
                        </ActionButton>
                        <ActionButton
                          compact
                          game={game}
                          command={{ type: "trade", faction: f.id }}
                          act={act}
                        >
                          교역{" "}
                          <small>
                            {RESOURCE_NAMES[f.resource]} 12 / 교역품 10
                          </small>
                        </ActionButton>
                        <ActionButton
                          compact
                          game={game}
                          command={{ type: "recognition", faction: f.id }}
                          act={act}
                        >
                          영토 인정 <small>자재 10 · 관계 +8</small>
                        </ActionButton>
                      </div>
                      <ActionButton
                        game={game}
                        command={{ type: "claim", faction: f.id, ...terms }}
                        act={act}
                        primary
                      >
                        <Crown size={17} />
                        {game.title === "baron"
                          ? "남작 작위 보유"
                          : "이 계약으로 남작 인정 요청"}
                      </ActionButton>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>
          <aside className="detail-panel">
            <div className="detail-header">
              <span className="eyebrow">
                {tab === "map" ? "BUILDING INTELLIGENCE" : "EXPEDITION CONTROL"}
              </span>
              <Icon icon={tab === "map" ? Building2 : Swords} size={18} />
            </div>
            {tab === "map" ? (
              <>
                <div className="building-illustration">
                  <div className="building-orbit" />
                  <div className="building-art">
                    <Building2 size={78} strokeWidth={0.8} />
                  </div>
                  <span>
                    {b.status === "unknown"
                      ? "UNIDENTIFIED"
                      : b.id === 0
                        ? "SHELTER 01"
                        : `BLOCK ${String(b.id + 1).padStart(2, "0")}`}
                  </span>
                </div>
                <div className="detail-content">
                  <span className={`status-tag ${b.status}`}>
                    {STATUS_NAMES[b.status]}
                  </span>
                  <h2>{b.status === "unknown" ? "미확인 구조물" : b.name}</h2>
                  <p className="building-description">
                    {b.id === 0
                      ? "옛 지하 환승역을 고쳐 만든 우리의 첫 거점. 작은 재배실과 수동 정수·발전 설비가 가동 중입니다."
                      : b.status === "unknown"
                        ? "폐허 너머에 남은 구조물. 탐색으로 위험과 소유권을 확인할 수 있습니다."
                        : b.owner === "player"
                          ? "우리 공동체가 확보한 공간. 시설과 주민의 손길로 도시가 다시 살아납니다."
                          : faction
                            ? `${faction.name}의 실효 지배 구역. 무력 확보는 관계를 악화시킵니다. 우호 관계라면 양도 협상이 가능합니다.`
                            : "잔류민과 위험 요소가 남아 있는 무주지. 보급 협상 또는 탐사대 투입으로 확보하세요."}
                  </p>
                  <dl className="building-stats">
                    <div>
                      <dt>소유권</dt>
                      <dd>
                        {b.status === "unknown"
                          ? "미확인"
                          : b.owner === "player"
                            ? "새벽 공동체"
                            : (faction?.name ?? "무주지")}
                      </dd>
                    </div>
                    <div>
                      <dt>지형</dt>
                      <dd>
                        {b.terrain > 1
                          ? "방어에 유리 · ×1.25"
                          : "일반 도심 · ×1.0"}
                      </dd>
                    </div>
                    <div>
                      <dt>예상 방어력</dt>
                      <dd className={b.owner !== "player" ? "warning" : ""}>
                        {b.status === "unknown" ? "미확인" : defense(b)}
                      </dd>
                    </div>
                    <div>
                      <dt>회수 자재 / 복구 비용</dt>
                      <dd>
                        {b.status === "unknown"
                          ? "미확인"
                          : `${b.loot} / 시설 선택 후 견적`}
                      </dd>
                    </div>
                  </dl>
                  <BuildingReport game={game} building={b} />
                  {b.status === "unknown" && (
                    <ActionButton
                      game={game}
                      command={{ type: "explore", building: b.id }}
                      act={act}
                      primary
                    >
                      구역 탐색
                    </ActionButton>
                  )}
                  {b.status === "discovered" && (
                    <div className="building-actions">
                      <ActionButton
                        game={game}
                        command={{ type: "secure", building: b.id }}
                        act={act}
                        primary
                      >
                        자동 전투로 확보
                      </ActionButton>
                      <ActionButton
                        game={game}
                        command={{ type: "negotiate", building: b.id }}
                        act={act}
                      >
                        보급·양도 협상
                      </ActionButton>
                      <p className="action-help">
                        전투력 {combatPower(game)} × 0.8~1.2 / 방어 {defense(b)}
                        . 승패와 무관하게 보급을 쓰고 부상을 입습니다.
                      </p>
                    </div>
                  )}
                  <FacilityControls
                    key={`${b.id}-${b.facility}-${b.status}`}
                    game={game}
                    building={b}
                    act={act}
                  />
                  {b.status === "restoring" && (
                    <div className="restoration">
                      <div>
                        <span>
                          {b.project?.kind === "convert" ? "시설 전환" : "복구"}{" "}
                          진행
                        </span>
                        <strong>{Math.round(b.progress)}%</strong>
                      </div>
                      <Meter value={b.progress} color="gold" />
                      <p className="action-help">
                        복구 우선순위에 따라 인력을 배정합니다. 인력이 없으면
                        자재 추가 차감 없이 대기합니다.
                      </p>
                    </div>
                  )}
                  {b.status === "operating" && (
                    <div className="operation-note">
                      <Check size={18} />
                      {b.id === 0
                        ? "주민 자율 생산 가동 중"
                        : `${b.facility ? FACILITIES[b.facility].name : ""} 운영 중`}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="detail-content">
                <h2>도시로 나설 준비</h2>
                <p className="muted">
                  장비·사기·건강·경비 숙련이 전투력을 결정합니다. 방위 초소는
                  배정 인원·건강·건물 적합성에 따라 전투력을 보강합니다.
                </p>
              </div>
            )}
            <div className="expedition-box">
              <div className="subheading">
                <span>
                  <Swords size={16} /> 탐사대
                </span>
                <strong>
                  {combatPower(game)}
                  <small> 전투력</small>
                </strong>
              </div>
              <div className="party-setting">
                <label htmlFor="party">최대 인원</label>
                <select
                  id="party"
                  value={game.partySize}
                  onChange={(e) =>
                    act({ type: "party", size: Number(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n}명
                    </option>
                  ))}
                </select>
              </div>
              <p className="party-members">
                {party(game)
                  .map((p) => p.name)
                  .join(" · ") || "출정 가능한 주민 없음"}{" "}
                <span>({party(game).length}명)</span>
              </p>
              <label className="leader-toggle">
                <input
                  type="checkbox"
                  checked={game.expeditionLeader}
                  onChange={(e) =>
                    act({ type: "expeditionLeader", value: e.target.checked })
                  }
                />
                지도자 현장 참가 허용
              </label>
              {game.expeditionLeader && (
                <p className="action-help warning">
                  지도자도 같은 전투 규칙으로 부상·사망할 수 있습니다.
                </p>
              )}
              <button
                className="secondary-button equipment"
                disabled={
                  game.equipment >= 4 ||
                  game.resources.materials < game.equipment * 18 ||
                  game.ended
                }
                onClick={() => act({ type: "equipment" })}
              >
                <Shield size={15} />
                {game.equipment >= 4
                  ? "장비 최대 단계"
                  : `공용 장비 개선 · 자재 ${game.equipment * 18}`}
                <span>Lv.{game.equipment}</span>
              </button>
            </div>
            {game.battles[0] && (
              <div className="last-battle">
                <span className="eyebrow">LAST ENGAGEMENT</span>
                <h4>
                  {game.battles[0].building} ·{" "}
                  {game.battles[0].won ? "승리" : "패배"}
                </h4>
                <p>
                  아군 {game.battles[0].strength} ×{" "}
                  {game.battles[0].roll.toFixed(2)} / 방어{" "}
                  {game.battles[0].defense}
                </p>
                <p>{game.battles[0].casualties.join(" · ")}</p>
              </div>
            )}
          </aside>
        </div>
        <section className="event-panel">
          <div className="event-header">
            <h2>
              <Activity size={17} /> 공동체 기록 <span>LIVE LOG</span>
            </h2>
            <div className="log-tabs">
              {[
                { id: "all", label: "전체" },
                { id: "important", label: "중요" },
                { id: "work", label: "생산·개척" },
                { id: "combat", label: "전투" },
                { id: "diplomacy", label: "외교" },
              ].map((f) => (
                <button
                  className={logFilter === f.id ? "active" : ""}
                  key={f.id}
                  onClick={() => setLogFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div
            className="event-list"
            aria-live="polite"
            aria-relevant="additions"
          >
            {game.logs
              .filter(
                (l) =>
                  logFilter === "all" ||
                  (logFilter === "important"
                    ? l.important ||
                      l.category === "combat" ||
                      l.category === "diplomacy"
                    : l.category === logFilter),
              )
              .slice(0, 12)
              .map((l) => (
                <div
                  className={`event ${l.category} ${l.important ? "important" : ""}`}
                  key={l.id}
                >
                  <time>{time(l.hour)}</time>
                  <span className="event-marker" />
                  <p>{l.text}</p>
                </div>
              ))}
          </div>
        </section>
        <footer>
          <span>
            ASHEN CITY <b>PROTOTYPE 0.3</b>
          </span>
          <span>
            {speed ? `${speed}× 시뮬레이션 진행 중` : "일시정지"} · 시드{" "}
            {game.seed}
          </span>
        </footer>
      </main>
      <input
        type="file"
        accept="application/json,.json"
        hidden
        ref={fileRef}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 2_000_000) throw new Error();
            publish(resumeGame(await file.text(), localStorage));
            setSuspendAuto(false);
            setNotice("저장 파일을 가져왔습니다.");
          } catch {
            setNotice(
              "유효한 v1/v2 저장 파일이 아니거나 복구 기록을 저장하지 못했습니다. 현재 게임은 유지됩니다.",
            );
          }
          e.target.value = "";
        }}
      />
      {notice && (
        <div className="toast" role="status">
          <Radio size={18} />
          {notice}
          <button onClick={() => setNotice("")} aria-label="메시지 닫기">
            <X size={16} />
          </button>
        </div>
      )}
      {(help || reset || game.pendingSuccession || game.ended) && (
        <div className="modal-overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              help ? "플레이 가이드" : reset ? "새 게임" : "공동체의 미래"
            }
          >
            {help ? (
              <>
                <button
                  className="modal-close"
                  onClick={() => setHelp(false)}
                  aria-label="가이드 닫기"
                >
                  <X size={20} />
                </button>
                <span className="eyebrow">A FIELD GUIDE TO REBUILDING</span>
                <h2>폐허 위에 첫 깃발을.</h2>
                <p>
                  당신은 10명의 생존자를 이끄는 평민 지도자입니다. 새로운 땅을
                  운영하고 귀족의 인정을 받아 남작이 되세요.
                </p>
                <ol>
                  <li>
                    <b>인접 건물을 확보하세요.</b> 옛 식료품점과 골목 정비소부터
                    시작합니다. 협상은 식량·식수, 전투는 보급과 건강을
                    소비합니다.
                  </li>
                  <li>
                    <b>용도를 정하고 복구하세요.</b> 농장·정수 시설로 배급을
                    안정시키고 주거 구역을 확보하세요. 주민 역할은 필요한 생산에
                    맞춰 바꿀 수 있습니다.
                  </li>
                  <li>
                    <b>시간을 진행하세요.</b> 상단 1시간 버튼이나 1~4배속으로
                    진행합니다. 주거 여유·안정도 55·식량과 식수 20 이상이면
                    12시간마다 새 주민이 옵니다.
                  </li>
                  <li>
                    <b>귀족에게 인정을 요청하세요.</b> 운영 건물 4곳·주민
                    12명·안정도 60을 갖추고, 보급 전달과 영토 인정으로 관계를
                    높입니다. 의무 없는 독립 남작도 가능합니다.
                  </li>
                </ol>
                <p className="muted">
                  자동 저장과 수동 저장은 별도입니다. 일시정지 종료 시에는 부재
                  진행이 없습니다. 진행 중 종료 시 현실 5분당 게임 1시간, 최대
                  12시간 진행하며 사망과 계약 정산을 유예합니다. 자동 전투에는
                  부상과 사망 위험이 있습니다.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setHelp(false)}
                >
                  공동체로 돌아가기
                </button>
              </>
            ) : reset ? (
              <>
                <h2>새로운 공동체를 시작할까요?</h2>
                <p>
                  자동 저장을 새 게임으로 대체합니다. 수동 저장은 유지됩니다.
                  현재 진행은 먼저 파일로 내보낼 수 있습니다.
                </p>
                <div className="modal-actions">
                  <button onClick={exportSave}>파일 내보내기</button>
                  <button onClick={() => setReset(false)}>취소</button>
                  <button
                    className="primary-button"
                    onClick={() => {
                      publish(freshGame());
                      setSuspendAuto(false);
                      setSelected(0);

                      setTab("map");
                      setTerms({
                        allegiance: false,
                        tax: false,
                        military: false,
                      });
                      setReset(false);
                    }}
                  >
                    새 게임 시작
                  </button>
                </div>
              </>
            ) : game.ended ? (
              <>
                <Flag size={40} />
                <h2>이 공동체의 기록을 마칩니다.</h2>
                <p>
                  {time(game.hour)} · 생존 주민 {people.length}명 · 지배 건물{" "}
                  {owned(game).length}곳
                </p>
                <div className="modal-actions">
                  <button onClick={exportSave}>기록 내보내기</button>
                  <button onClick={load}>저장 불러오기</button>
                  <button
                    className="primary-button"
                    onClick={() => {
                      publish(freshGame());
                      setSuspendAuto(false);
                      setSelected(0);
                      setTab("map");
                    }}
                  >
                    새로운 여정
                  </button>
                </div>
              </>
            ) : (
              <>
                <Crown size={38} />
                <span className="eyebrow">THE COMMUNITY MUST DECIDE</span>
                <h2>{leader.name}의 뒤를 이어.</h2>
                <p>
                  지도자가 사망했습니다. 시간은 멈췄습니다.{" "}
                  {people.find((p) => p.id === game.successor)?.name ??
                    "사기가 가장 높은 생존자"}
                  에게 공동체를 맡기거나 이 여정을 끝낼 수 있습니다.
                </p>
                <div className="modal-actions">
                  <button onClick={() => act({ type: "end" })}>
                    여정 종료
                  </button>
                  <button
                    className="primary-button"
                    disabled={!people.length}
                    onClick={() => act({ type: "succeed" })}
                  >
                    후계자로 계속
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
    </GameShell>
  );
}
