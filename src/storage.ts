// 기존 v1 슬롯 이름을 유지한다. 재개 영수증/소비 시각을 먼저 저장해 같은 파일의 부재 시간을 이중 반영하지 않는다.
import type { GameState } from "./model";
import { decodeSave, deserialize, hashText, serialize } from "./save";
export const AUTO = "ashen-city-auto-v1",
  MANUAL = "ashen-city-save-v1";
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface Receipt {
  through: number;
  source: string;
  result: string;
}
const receiptKey = (s: GameState) => `ashen-city-resume-v2-${s.campaignId}`;
function receipt(storage: StoragePort, s: GameState): Receipt | null {
  const raw = storage.getItem(receiptKey(s));
  if (raw === null) return null;
  try {
    const r = JSON.parse(raw) as Receipt;
    if (
      !r ||
      !Number.isFinite(r.through) ||
      r.through < 0 ||
      r.through > 1e15 ||
      typeof r.source !== "string" ||
      typeof r.result !== "string"
    )
      throw new Error();
    if (
      Boolean(r.source) !== Boolean(r.result) ||
      (r.result && decodeSave(r.result).campaignId !== s.campaignId)
    )
      throw new Error();
    return r;
  } catch {
    throw new Error(
      "오프라인 재개 기록이 손상되었습니다. 원본 저장은 변경하지 않았습니다.",
    );
  }
}
export function resumeGame(
  raw: string,
  storage: StoragePort,
  now = Date.now(),
): GameState {
  const original = decodeSave(raw),
    fingerprint = hashText(raw) + ":" + raw.length;
  if (JSON.parse(raw).version === 1) {
    const backup = `ashen-city-v1-backup-${hashText(raw)}`;
    if (!storage.getItem(backup)) storage.setItem(backup, raw);
  }
  const savedReceipt = receipt(storage, original);
  const source =
    savedReceipt?.source === fingerprint ? savedReceipt.result : raw;
  const state = deserialize(source, now, {
    consumedThrough: savedReceipt?.through ?? 0,
  });
  // 쓰기에 실패하면 상태를 반환하지 않는다. 같은 원본을 다시 열어 중복 보상받는 것을 방지한다.
  storage.setItem(
    receiptKey(state),
    JSON.stringify({
      through: Math.max(now, savedReceipt?.through ?? 0),
      source: fingerprint,
      result: serialize(state, now),
    }),
  );
  return state;
}
export function saveGame(
  slot: string,
  state: GameState,
  storage: StoragePort,
  now = Date.now(),
) {
  const previous = receipt(storage, state);
  storage.setItem(slot, serialize(state, now));
  storage.setItem(
    receiptKey(state),
    JSON.stringify({
      through: Math.max(now, previous?.through ?? 0),
      source: previous?.source ?? "",
      result: previous?.result ?? "",
    }),
  );
}
