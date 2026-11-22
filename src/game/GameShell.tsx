import {
  lazy,
  Suspense,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Command, GameState } from "../model";
import GameNavigation, { type GameView } from "./GameNavigation";
import GameHUD from "./hud/GameHUD";
import ManagementView from "../management/ManagementView";
import { presentGame } from "./presentation/GamePresentation";
import "./world.css";
import VisualLifecycle from "./VisualLifecycle";
import { createViewSession, type ViewSession } from "./ViewSession";
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
}
export default function GameShell({
  game,
  act,
  step,
  selected,
  onSelect,
  onManageBuilding,
  onOpenGuide,
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
  notice: string;
  saveError: boolean;
  children: ReactNode;
}) {
  const [view, setView] = useState<GameView>("city");
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
  const selectBuilding = (id: number) =>
    onSelect(
      game.buildings.some((b) => b.id === id) ? id : game.buildings[0].id,
    );
  return (
    <div className={`world-shell ${view}-mode`} data-game-view={view}>
      <VisualLifecycle />
      <GameHUD game={game} act={act} step={step} />
      <GameNavigation view={view} onView={setView} />
      <div className="game-view-container">
        <ManagementView
          active={view === "management"}
          onOpenGuide={onOpenGuide}
        >
          {children}
        </ManagementView>
        {view !== "management" && (
          <div className="spatial-viewport" key={view}>
            <Suspense
              fallback={
                <div className="world-loading" role="status">
                  지구 기록을 불러오는 중…
                </div>
              }
            >
              {view === "city" ? (
                <CityView
                  game={game}
                  act={act}
                  selected={safeSelected}
                  onSelect={selectBuilding}
                  onView={setView}
                  onManageBuilding={onManageBuilding}
                  presentation={presentation}
                  session={ui.current.session}
                />
              ) : (
                <BuildingView
                  game={game}
                  act={act}
                  selected={safeSelected}
                  onSelect={selectBuilding}
                  onView={setView}
                  onManageBuilding={onManageBuilding}
                  presentation={presentation}
                  session={ui.current.session}
                />
              )}
            </Suspense>
          </div>
        )}
      </div>
      {view !== "management" && (notice || saveError) && (
        <div className="world-notice" role="status">
          {saveError ? "저장 오류 · 관리 화면에서 진행을 내보내세요." : notice}
        </div>
      )}
      {presentation.warnings.length > 0 && (
        <details className="world-alerts">
          <summary>운영 경고 {presentation.warnings.length}건</summary>
          {presentation.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </details>
      )}
      {view !== "management" && game.offlineSummary && (
        <details className="world-offline">
          <summary>부재 중 공동체 기록</summary>
          <p>{game.offlineSummary}</p>
        </details>
      )}
      {view !== "management" && (game.ended || game.pendingSuccession) && (
        <div className="world-decision">
          <h2>
            {game.pendingSuccession
              ? "지도자 계승 결정 대기"
              : "공동체 여정 종료"}
          </h2>
          <p>
            시간이 중단되었습니다. 운영실에서 기록과 다음 결정을 확인하세요.
          </p>
          <button onClick={() => setView("management")}>
            관리 화면에서 확인
          </button>
        </div>
      )}
    </div>
  );
}
