import {
  Component,
  useCallback,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  MapPin,
  Expand,
  RotateCcw,
  RotateCw,
  Plus,
  Minus,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Building2,
  Settings2,
} from "lucide-react";
import type { WorldProps } from "../GameShell";
import type { GamePresentation } from "../presentation/GamePresentation";
import CityScene from "./CityScene";
import type { CameraAction, CameraIntent } from "./CityCamera";
import { supportsWebGL } from "./WebGLSupport";
import { ActionButton } from "../../Management";
import { visualDiagnostics, type RenderMetrics } from "../performance";
import RendererStats from "../hud/RendererStats";
import "./city.css";
import { PointerGesture } from "./CityInteraction";
const cameraOptions = {
  position: [10, 90, 35] as [number, number, number],
  zoom: 6.1,
  near: 0.5,
  far: 400,
};
const glOptions = {
  antialias: true,
  powerPreference: "high-performance" as const,
};
class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    visualDiagnostics.errors.push(error.message);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export default function CityView({
  game,
  act,
  selected,
  onSelect,
  onView,
  onManageBuilding,
  session,
  active = true,
  presentation,
}: WorldProps & { presentation: GamePresentation }) {
  const [supported] = useState(() => supportsWebGL()),
    [metrics, setMetrics] = useState<RenderMetrics | null>(null),
    [intent, setIntent] = useState<CameraIntent>({
      action: "overview",
      serial: 0,
    });
  const gesture = useRef(new PointerGesture());
  const report = useCallback((m: RenderMetrics) => setMetrics(m), []),
    b = presentation.city[selected] ?? presentation.city[0],
    raw = game.buildings[b.id];
  const camera = (action: CameraAction) =>
    setIntent((i) => ({ action, serial: i.serial + 1 }));
  const fallback = (
    <div className="world-loading gl-fallback" role="alert">
      <Building2 size={36} />
      <h1>3D 화면을 사용할 수 없습니다.</h1>
      <p>
        WebGL2 또는 그래픽 초기화가 지원되지 않습니다. 저장과 게임 운영은 관리
        화면에서 계속할 수 있습니다.
      </p>
      <button onClick={() => onView("management")}>관리 화면에서 계속</button>
    </div>
  );
  return (
    <div className="city-view" data-testid="city-view" data-rendering={active}>
      {supported ? (
        <SceneBoundary fallback={fallback}>
          <div
            className="city-canvas"
            onContextMenu={(e) => e.preventDefault()}
            onPointerDownCapture={(e) =>
              gesture.current.down(e.clientX, e.clientY)
            }
            onPointerMoveCapture={(e) => {
              if (e.buttons) gesture.current.move(e.clientX, e.clientY);
            }}
            onPointerUpCapture={(e) =>
              gesture.current.move(e.clientX, e.clientY)
            }
            onClickCapture={(e) => {
              if (gesture.current.dragged) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            tabIndex={active ? 0 : -1}
            aria-label="3D 도시 · 왼쪽 드래그 이동, 오른쪽 드래그 회전, 휠 줌"
            onKeyDown={(e) => {
              if (
                !active ||
                (e.target as HTMLElement).closest(
                  'input,textarea,select,[contenteditable="true"]',
                )
              )
                return;
              const keys: Record<string, CameraAction> = {
                ArrowLeft: "left",
                ArrowRight: "right",
                ArrowUp: "up",
                ArrowDown: "down",
                "+": "zoom-in",
                "-": "zoom-out",
                f: "focus",
                F: "focus",
                q: "rotate-left",
                Q: "rotate-left",
                e: "rotate-right",
                E: "rotate-right",
              };
              if (keys[e.key]) {
                e.preventDefault();
                camera(keys[e.key]);
              }
            }}
          >
            <Canvas
              frameloop={active ? "always" : "never"}
              shadows="percentage"
              orthographic
              camera={cameraOptions}
              dpr={[1, 1.5]}
              gl={glOptions}
            >
              <CityScene
                presentation={presentation}
                selected={selected}
                onSelect={onSelect}
                intent={intent}
                onMetrics={report}
                session={session}
                active={active}
              />
            </Canvas>
          </div>
        </SceneBoundary>
      ) : (
        fallback
      )}
      <div className="district-caption">
        <span>THE CITY AFTER THE FALL</span>
        <h1>폐허 위에, 다시.</h1>
        <p>
          새벽 지구 / {presentation.city.filter((b) => b.owned).length}개 거점 ·
          도시 외곽
        </p>
      </div>
      <div className="city-toolbar" aria-label="도시 카메라 조작">
        {(
          [
            { id: "overview", label: "도시 전체 보기", icon: Expand },
            { id: "focus", label: "선택 건물 중심", icon: MapPin },
            { id: "rotate-left", label: "왼쪽 회전", icon: RotateCcw },
            { id: "rotate-right", label: "오른쪽 회전", icon: RotateCw },
            { id: "zoom-in", label: "도시 확대", icon: Plus },
            { id: "zoom-out", label: "도시 축소", icon: Minus },
            { id: "left", label: "도시 왼쪽 이동", icon: ArrowLeft },
            { id: "right", label: "도시 오른쪽 이동", icon: ArrowRight },
            { id: "up", label: "도시 위로 이동", icon: ArrowUp },
            { id: "down", label: "도시 아래로 이동", icon: ArrowDown },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            aria-label={item.label}
            title={item.label}
            onClick={() => camera(item.id)}
          >
            <item.icon size={17} />
          </button>
        ))}
      </div>
      <details className="city-index">
        <summary>구역 건물 · 20동</summary>
        <div>
          {presentation.city.map((item) => (
            <button
              key={item.id}
              aria-label={`${item.name} 선택`}
              aria-pressed={item.id === selected}
              onClick={() => {
                onSelect(item.id);
                camera("focus");
              }}
            >
              <span>{String(item.id + 1).padStart(2, "0")}</span>
              {item.name}
              <small>{item.statusName}</small>
            </button>
          ))}
        </div>
      </details>
      <section className="city-selection" aria-label="선택한 건물">
        <div className="selection-heading">
          <span>BLOCK {String(b.id + 1).padStart(2, "0")}</span>
          <small>{b.statusName}</small>
        </div>
        <h2>{b.name}</h2>
        <p>
          {b.known
            ? `${b.owner} · ${b.workerCount}명 배정`
            : "내부와 소유권을 아직 확인하지 못했습니다."}
        </p>
        {b.status === "restoring" && (
          <div className="world-progress">
            <span style={{ width: `${b.progress}%` }} />
          </div>
        )}
        {b.warning && <p className="warning">{b.warning}</p>}
        <div className="selection-actions">
          <button
            disabled={!b.owned}
            title={
              b.owned
                ? "건물 내부 관찰"
                : "확보한 건물만 내부를 관찰할 수 있습니다."
            }
            onClick={() => onView("building")}
          >
            <Building2 size={16} />
            내부 보기
          </button>
          <button
            onClick={() => {
              onManageBuilding?.();
              onView("management");
            }}
          >
            <Settings2 size={16} />
            건물 관리
          </button>
        </div>
        {b.status === "unknown" && (
          <ActionButton
            game={game}
            act={act}
            command={{ type: "explore", building: b.id }}
            compact
          >
            구역 탐색
          </ActionButton>
        )}
        {b.status === "discovered" && (
          <div className="city-quick-actions">
            <ActionButton
              compact
              game={game}
              act={act}
              command={{ type: "secure", building: b.id }}
            >
              자동 전투
            </ActionButton>
            <ActionButton
              compact
              game={game}
              act={act}
              command={{ type: "negotiate", building: b.id }}
            >
              보급 협상
            </ActionButton>
          </div>
        )}
        {b.status === "secured" && raw.facility && (
          <ActionButton
            compact
            game={game}
            act={act}
            command={{ type: "restore", building: b.id }}
          >
            복구 시작
          </ActionButton>
        )}
        {b.status === "secured" && !raw.facility && (
          <p className="selection-note">
            관리 화면에서 용도를 지정한 뒤 복구할 수 있습니다.
          </p>
        )}
      </section>
      <div className="city-bottom-note">
        <span>좌측 드래그 이동 · 우측 드래그 회전 · 휠 줌 · F 선택 건물</span>
        <b>
          {presentation.paused
            ? "일시정지 · 카메라 조작 가능"
            : "도시의 시간이 흐르고 있습니다"}
        </b>
      </div>
      <RendererStats metrics={metrics} />
    </div>
  );
}
