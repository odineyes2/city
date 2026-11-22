// UI는 경과 밀리초만 전달한다. 배율·잔여 시간·중단 조건은 순수 함수가 계산한다.
import { TIME } from "./config";
import { advance } from "./engine";
import type { GameState } from "./model";
export function onlineElapsed(s: GameState, elapsedMs: number): GameState {
  if (
    !s.clock.speed ||
    s.ended ||
    s.pendingSuccession ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0
  )
    return s;
  const budget = Math.min(
    s.clock.onlineRemainderMs + elapsedMs * s.clock.speed,
    TIME.onlineHourMs * (TIME.onlineCatchupLimit + 1) - 1,
  );
  const hours = Math.floor(budget / TIME.onlineHourMs);
  const result = hours ? advance(s, hours) : structuredClone(s);
  result.clock.onlineRemainderMs =
    result.ended || result.pendingSuccession
      ? 0
      : budget - hours * TIME.onlineHourMs;
  return result;
}
export function offlineElapsed(s: GameState, now: number, consumedThrough = 0) {
  if (!s.clock.speed || s.ended || s.pendingSuccession)
    return { hours: 0, remainder: s.clock.offlineRemainderMs };
  const budget =
    s.clock.offlineRemainderMs +
    Math.max(0, now - Math.max(s.lastSavedAt, consumedThrough));
  const whole = Math.floor(budget / TIME.offlineHourMs);
  return {
    hours: Math.min(TIME.offlineLimit, whole),
    remainder:
      whole >= TIME.offlineLimit ? 0 : budget - whole * TIME.offlineHourMs,
  };
}
