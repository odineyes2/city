import type { ReactNode } from "react";
import GameNavigation, { type GameView } from "../game/GameNavigation";
export default function ManagementView({
  children,
  onView,
}: {
  children: ReactNode;
  onView: (view: GameView) => void;
}) {
  return (
    <div className="management-view" data-game-view="management">
      <div className="management-return">
        <span>공동체 운영실</span>
        <GameNavigation view="management" onView={onView} />
      </div>
      {children}
    </div>
  );
}
