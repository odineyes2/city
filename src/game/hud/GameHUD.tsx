import type { Command, GameState, Speed } from "../../model";
import { RESOURCE_NAMES } from "../../data";
import { RESOURCES } from "../../config";
import { Pause, Play, SkipForward } from "lucide-react";
import type { GamePresentation } from "../presentation/GamePresentation";
export default function GameHUD({
  game,
  act,
  step,
  feedback,
}: {
  game: GameState;
  act: (c: Command) => void;
  step: () => void;
  feedback?: GamePresentation["feedback"];
}) {
  return (
    <div className="world-hud">
      <div className="world-brand">
        ASHEN <b>CITY</b>
        <small>DAWN DISTRICT / SECTOR 07</small>
      </div>
      <div className="world-stock">
        {RESOURCES.map((key) => (
          <span
            key={key}
            data-shortage={!!feedback && feedback[key].unmet > 1e-8}
            title={
              feedback
                ? `시간당 생산 ${feedback[key].production.toFixed(2)} · 필요 ${feedback[key].demand.toFixed(2)} · 미공급 ${feedback[key].unmet.toFixed(2)}`
                : undefined
            }
          >
            <small>{RESOURCE_NAMES[key]}</small>
            <b>{game.resources[key].toFixed(0)}</b>
            {!!feedback && feedback[key].unmet > 1e-8 && (
              <i aria-label={`${RESOURCE_NAMES[key]} 공급 부족`}>!</i>
            )}
          </span>
        ))}
      </div>
      <div className="world-clock">
        <time>
          D{String(Math.floor(game.hour / 24) + 1).padStart(2, "0")} ·{" "}
          {String(game.hour % 24).padStart(2, "0")}:00
        </time>
        <div className="world-speeds">
          {([0, 1, 2, 4] as Speed[]).map((speed) => (
            <button
              key={speed}
              title={speed ? `${speed}배속` : "일시정지"}
              aria-label={speed ? `${speed}배속` : "일시정지"}
              aria-pressed={game.clock.speed === speed}
              disabled={game.ended || game.pendingSuccession}
              onClick={() => act({ type: "speed", speed })}
            >
              {speed === 0 ? (
                <Pause size={14} />
              ) : speed === 1 ? (
                <Play size={14} />
              ) : (
                `${speed}×`
              )}
            </button>
          ))}
          <button
            aria-label="1시간 진행"
            title="1시간 진행"
            onClick={step}
            disabled={game.ended || game.pendingSuccession}
          >
            <SkipForward size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
