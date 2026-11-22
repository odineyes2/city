// 기존 화면에 붙이는 우선순위·원장·건물 정보. 표시값은 엔진의 동일 예측을 사용한다.
import { useState } from "react";
import type { ReactNode } from "react";
import type {
  Building,
  Command,
  Facility,
  GameState,
  Priority,
  WorkArea,
} from "./model";
import { actionInfo, economy } from "./engine";
import { FACILITIES, RESOURCE_NAMES } from "./data";
import { BUILDING_TYPES, projectQuote } from "./buildings";
import { PRIORITY_NAMES, RESOURCES, WORK_NAMES } from "./config";
type Act = (command: Command) => void;
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
export function ActionButton({
  game,
  command,
  act,
  children,
  primary = false,
  compact = false,
}: {
  game: GameState;
  command: Command;
  act: Act;
  children: ReactNode;
  primary?: boolean;
  compact?: boolean;
}) {
  const info = actionInfo(game, command);
  return (
    <div className={`action-control ${compact ? "compact" : ""}`}>
      <button
        className={primary ? "primary-button" : "secondary-button"}
        title={info.reason || info.cost}
        disabled={!info.allowed}
        onClick={() => act(command)}
      >
        {children}
      </button>
      {!compact && (
        <small
          className={info.allowed ? "action-help" : "action-help negative"}
        >
          {info.allowed ? info.cost : info.reason}
        </small>
      )}
      {compact && !info.allowed && (
        <small className="action-help negative">{info.reason}</small>
      )}
    </div>
  );
}
export function Priorities({ game, act }: { game: GameState; act: Act }) {
  const flow = economy(game);
  return (
    <section className="priority-panel">
      <h3>공동체 작업 우선순위</h3>
      <p>
        높은 분야부터 배정합니다. 같은 순위는 복구 → 시설 → 쉘터 순이며, 가능한
        기존 작업을 유지합니다. 전력도 같은 분야 순위를 따릅니다.
      </p>
      <div className="priority-grid">
        {(Object.keys(WORK_NAMES) as WorkArea[]).map((area) => (
          <label key={area}>
            <span>
              {WORK_NAMES[area]}{" "}
              <small>
                {
                  Object.values(flow.assignments).filter(
                    (a) => a?.area === area,
                  ).length
                }
                명
              </small>
            </span>
            <select
              aria-label={`${WORK_NAMES[area]} 우선순위`}
              value={game.priorities[area]}
              disabled={game.ended || game.pendingSuccession}
              onChange={(e) =>
                act({
                  type: "priority",
                  area,
                  priority: Number(e.target.value) as Priority,
                })
              }
            >
              {PRIORITY_NAMES.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
export function ResourceLedger({ game }: { game: GameState }) {
  const f = economy(game);
  return (
    <details className="economy-ledger">
      <summary>시간당 자원 원장 · 생산 / 소비 / 손실</summary>
      <div className="ledger-scroll">
        <table>
          <thead>
            <tr>
              <th>자원</th>
              <th>총생산</th>
              <th>생활 소비</th>
              <th>시설 소비</th>
              <th>총 필요량</th>
              <th>수요 기준 수지</th>
              <th>실제 재고 변화</th>
              <th>저장 초과</th>
              <th>부족 예상</th>
            </tr>
          </thead>
          <tbody>
            {RESOURCES.map((k) => (
              <tr key={k}>
                <th>{RESOURCE_NAMES[k]}</th>
                <td>+{f.production[k].toFixed(2)}</td>
                <td>{f.livingConsumption[k].toFixed(2)}</td>
                <td>{f.facilityConsumption[k].toFixed(2)}</td>
                <td>{f.demand[k].toFixed(2)}</td>
                <td>{signed(f.net[k])}</td>
                <td>{signed(f.delta[k])}</td>
                <td>{f.overflow[k].toFixed(2)}</td>
                <td>
                  {f.shortageHours[k] === null
                    ? "안정"
                    : f.shortageHours[k]! < 0.01
                      ? "현재 부족"
                      : `${f.shortageHours[k]!.toFixed(1)}h`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        현재 인원·배정·재고가 유지된다는 가정의 다음 1시간 예측입니다. 소비는
        실제 지급량, 총 필요량은 미지급분 포함입니다. 복구 완료·이주·계약
        정산·다음 시간 재배정은 별도 사건입니다.
      </p>
      {game.buildings
        .filter((b) => f.facilities[b.id])
        .map((b) => (
          <div className="contribution" key={b.id}>
            <strong>{b.name}</strong>
            <span>
              {RESOURCES.filter((k) => f.facilities[b.id].output[k] > 0)
                .map(
                  (k) =>
                    `${RESOURCE_NAMES[k]} +${f.facilities[b.id].output[k].toFixed(1)}`,
                )
                .join(" · ") || "비생산/대기"}{" "}
              · 전력 {f.facilities[b.id].powerUsed.toFixed(2)}/
              {f.facilities[b.id].powerDemand.toFixed(2)} · 유지 자재{" "}
              {f.facilities[b.id].materialUsed.toFixed(2)}
            </span>
          </div>
        ))}
    </details>
  );
}
export function Warnings({ game }: { game: GameState }) {
  const warnings = economy(game).warnings;
  if (!warnings.length) return null;
  return (
    <details className="operating-warnings">
      <summary>
        운영 주의 {warnings.length}건 · {warnings[0]}
      </summary>
      <ul>
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </details>
  );
}
export function BuildingReport({
  game,
  building: b,
}: {
  game: GameState;
  building: Building;
}) {
  if (b.status === "unknown") return null;
  const flow = economy(game),
    info = flow.facilities[b.id],
    crew = flow.builders.filter(
      (p) => flow.assignments[p.id]?.building === b.id,
    );
  return (
    <section className="building-report">
      <h3>{BUILDING_TYPES[b.type].label}</h3>
      <p>{BUILDING_TYPES[b.type].note}</p>
      <dl>
        <div>
          <dt>구조 상태 / 복구 난이도</dt>
          <dd>
            {b.structure}% / ×{b.repairDifficulty.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt>적합 시설</dt>
          <dd>
            {b.allowedFacilities
              .filter((f) => b.suitability[f] > 1.1)
              .map(
                (f) => `${FACILITIES[f].name} ×${b.suitability[f].toFixed(2)}`,
              )
              .join(", ") || "표준 적합"}
          </dd>
        </div>
      </dl>
      {info && (
        <>
          <p>
            배정:{" "}
            {info.workers
              .map((id) => game.people.find((p) => p.id === id)!.name)
              .join(" · ") || "없음"}{" "}
            · 실제 효율 {Math.round(info.efficiency * 100)}%
          </p>
          <p>
            {RESOURCES.filter((k) => info.output[k] > 0)
              .map(
                (k) => `${RESOURCE_NAMES[k]} +${info.output[k].toFixed(2)}/h`,
              )
              .join(" · ") || "자원 생산 없음"}
            <br />
            전력 {info.powerUsed.toFixed(2)}/{info.powerDemand.toFixed(2)}/h ·
            유지 자재 {info.materialUsed.toFixed(2)}/h
          </p>
          {info.reason && <p className="warning">{info.reason}</p>}
        </>
      )}
      {b.project && (
        <p>
          {b.project.kind === "convert" ? "전환" : "복구"} 대상:{" "}
          {FACILITIES[b.project.target].name} · 자재 {b.project.paidMaterials}{" "}
          선납
          <br />
          작업자:{" "}
          {crew.map((p) => p.name).join(" · ") ||
            "대기 (우선순위·건강·앞선 현장 확인)"}
          <br />
          잔여 작업량{" "}
          {(b.project.workRequired * (1 - b.progress / 100)).toFixed(1)} ·
          인력이 없으면 진행하지 않습니다.
        </p>
      )}
    </section>
  );
}
export function FacilityControls({
  game,
  building: b,
  act,
}: {
  game: GameState;
  building: Building;
  act: Act;
}) {
  const [target, setTarget] = useState<Facility>(
    b.facility ?? b.allowedFacilities[0],
  );
  const quote = projectQuote(b, target),
    operating = b.status === "operating";
  if (
    b.owner !== "player" ||
    b.id === 0 ||
    !["secured", "operating"].includes(b.status)
  )
    return null;
  const command: Command = operating
    ? { type: "facility", building: b.id, facility: target }
    : b.facility === target
      ? { type: "restore", building: b.id }
      : { type: "facility", building: b.id, facility: target };
  return (
    <div className="facility-picker">
      <label htmlFor="facility">
        {operating ? "시설 전환 제안" : "시설 용도 선택"}
      </label>
      <select
        id="facility"
        value={target}
        disabled={game.ended || game.pendingSuccession}
        onChange={(e) => setTarget(e.target.value as Facility)}
      >
        {Object.entries(FACILITIES).map(([key, f]) => (
          <option
            key={key}
            value={key}
            disabled={!b.allowedFacilities.includes(key as Facility)}
          >
            {f.name}{" "}
            {b.allowedFacilities.includes(key as Facility)
              ? `· 적합 ×${b.suitability[key as Facility].toFixed(2)}`
              : "· 설치 불가"}
          </option>
        ))}
      </select>
      <p className="action-help">
        {FACILITIES[target].description}
        <br />
        건물 효율 ×{quote.fit.toFixed(2)} ·{" "}
        {FACILITIES[target].resource
          ? `숙련 1·건강한 주민 1명당 ${(FACILITIES[target].amount * quote.fit).toFixed(2)}/h (전력·유지 자재 충족 시)`
          : "비생산 시설"}
        <br />
        {operating ? "전환" : "복구"} 자재 {quote.materials} · 기준 약{" "}
        {quote.idealHours}시간 (실제 배정·숙련에 따라 변동)
      </p>
      <ActionButton game={game} command={command} act={act} primary>
        {operating
          ? "비용 지불 후 전환 시작"
          : b.facility === target
            ? "복구 시작"
            : "용도 지정 (즉시·무료)"}
      </ActionButton>
      {operating && (
        <p className="action-help">
          전환 중 기존 생산·수용·저장 효과가 중단됩니다. 지출 자재는 환불되지
          않습니다.
        </p>
      )}
    </div>
  );
}
