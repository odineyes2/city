import type { Command, GameState, Speed } from "../../model";
import { RESOURCE_NAMES } from "../../data";
import { RESOURCES } from "../../config";
import { Pause, Play, SkipForward } from "lucide-react";
export default function GameHUD({
  game,
  act,
  step,
}: {
  game: GameState;
  act: (c: Command) => void;
  step: () => void;
}) {
  return (
    <div className="world-hud">
      <div className="world-brand">
        ASHEN <b>CITY</b>
        <small>DAWN DISTRICT / SECTOR 07</small>
      </div>
      <div className="world-stock">
        {RESOURCES.map((key) => (
          <span key={key}>
            <small>{RESOURCE_NAMES[key]}</small>
            <b>{game.resources[key].toFixed(0)}</b>
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
