import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { Command, GameState } from "../model";
import GameNavigation, { type GameView } from "./GameNavigation";
import GameHUD from "./hud/GameHUD";
import ManagementView from "../management/ManagementView";
import { presentGame } from "./presentation/GamePresentation";
import VisualLifecycle from "./VisualLifecycle";
import { createViewSession, type ViewSession } from "./ViewSession";
import OverlayHost from "./OverlayHost";
import OverlayHeader from "./OverlayHeader";
import { useOverlayNavigation } from "./useOverlayNavigation";
import "./world.css";
const CityView = lazy(() => import("./city/CityView"));
const BuildingView = lazy(() => import("./building/BuildingView"));
export interface WorldProps {
  game: GameState;
  act: (c: Command) => void;
  selected: number;
  onSelect: (id: number) => void;
  onView: (view: GameView) => void;
  onManageBuilding?: () => void;
  session?: ViewSession;
  active?: boolean;
}
export default function GameShell({
  game,
  act,
  step,
  selected,
  onSelect,
  onManageBuilding,
  onOpenGuide,
  onDismissDialog,
  notice,
  saveError,
  children,
}: {
  game: GameState;
  act: (c: Command) => void;
  step: () => void;
  selected: number;
  onSelect: (id: number) => void;
  onManageBuilding?: () => void;
  onOpenGuide?: () => void;
  onDismissDialog?: () => boolean;
  notice: string;
  saveError: boolean;
  children: ReactNode;
}) {
  const { overlay, previousOverlay, go } = useOverlayNavigation();
  const view: GameView = overlay === "none" ? "city" : overlay,
    active = overlay === "none";
  const safeSelected = game.buildings.some((b) => b.id === selected)
    ? selected
    : game.buildings[0].id;
  const presentation = useMemo(
    () => presentGame(game, safeSelected),
    [game, safeSelected],
  );
  const ui = useRef({
    campaign: game.campaignId,
    session: createViewSession(),
  });
  if (ui.current.campaign !== game.campaignId)
    ui.current = { campaign: game.campaignId, session: createViewSession() };
  useEffect(() => {
    go("none");
  }, [game.campaignId, go]);
  const onView = useCallback(
    (next: GameView) => go(next === "city" ? "none" : next),
    [go],
  );
  const close = useCallback(() => go("none"), [go]);
  const selectBuilding = useCallback(
    (id: number) =>
      onSelect(
        game.buildings.some((b) => b.id === id) ? id : game.buildings[0].id,
      ),
    [game.buildings, onSelect],
  );
  const world = {
    game,
    act,
    selected: safeSelected,
    onSelect: selectBuilding,
    onView,
    onManageBuilding,
    session: ui.current.session,
    presentation,
  };
  const b = presentation.interior;
  return (
    <div
      className={`world-shell ${view}-mode`}
      data-game-view={view}
      data-overlay={overlay}
    >
      <VisualLifecycle />
      <div
        className="city-foundation"
        data-covered={!active}
        inert={!active}
        aria-hidden={!active}
      >
        <Suspense
          fallback={
            <div className="world-loading" role="status">
              도시를 불러오는 중…
            </div>
          }
        >
          <CityView {...world} active={active} />
        </Suspense>
      </div>
      <OverlayHost
        type={overlay}
        onClose={close}
        onDismissDialog={onDismissDialog}
      >
        <GameHUD game={game} act={act} step={step} />
        <div className="global-nav-slot" hidden={!active}>
          <GameNavigation view={view} onView={onView} />
        </div>
        {!active && (
          <OverlayHeader
            type={overlay}
            previous={previousOverlay}
            title={overlay === "building" ? b.name : "공동체 운영실"}
            detail={
              overlay === "building"
                ? `${b.statusName} · ${b.facility} · 현장 ${b.residents.filter((r) => r.present).length}명`
                : "정책과 작업을 결정하고 도시에서 변화를 확인하세요."
            }
            onClose={close}
            onOther={() => {
              if (overlay === "building") {
                onManageBuilding?.();
                go("management");
              } else go("building");
            }}
            onGuide={onOpenGuide}
          />
        )}
        {presentation.warnings.length > 0 && (
          <details className="world-alerts">
            <summary>운영 경고 {presentation.warnings.length}건</summary>
            {presentation.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </details>
        )}
        <div className="overlay-content" hidden={active}>
          <ManagementView
            key={game.campaignId}
            embedded
            active={overlay === "management"}
          >
            {children}
          </ManagementView>
          {overlay === "building" && (
            <Suspense
              fallback={
                <div className="world-loading" role="status">
                  건물 내부를 불러오는 중…
                </div>
              }
            >
              <BuildingView {...world} />
            </Suspense>
          )}
        </div>
        {view !== "management" && (notice || saveError) && (
          <div className="world-notice" role="status">
            {saveError ? "저장 오류 · 관리에서 진행을 내보내세요." : notice}
          </div>
        )}
        {view !== "management" && game.offlineSummary && (
          <details className="world-offline">
            <summary>부재 중 공동체 기록</summary>
            <p>{game.offlineSummary}</p>
          </details>
        )}
        {active && (game.ended || game.pendingSuccession) && (
          <div className="world-decision">
            <h2>
              {game.pendingSuccession
                ? "지도자 계승 결정 대기"
                : "공동체 여정 종료"}
            </h2>
            <p>시간이 중단되었습니다. 운영실에서 다음 결정을 확인하세요.</p>
            <button onClick={() => go("management")}>관리에서 확인</button>
          </div>
        )}
      </OverlayHost>
    </div>
  );
}
