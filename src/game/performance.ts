// 두 렌더러가 직접 보고하는 프레임/자원 수치. 시뮬레이션이나 저장 상태와 무관하다.
export interface RenderMetrics {
  fps: number;
  p95Ms: number;
  frames: number;
  calls: number;
  geometries: number;
  textures: number;
  renderer: "three" | "pixi";
}
export const visualDiagnostics = {
  cityActive: 0,
  buildingActive: 0,
  cityDisposed: 0,
  buildingDisposed: 0,
  cityFrames: 0,
  buildingFrames: 0,
  errors: [] as string[],
  last: null as RenderMetrics | null,
};
const listeners = new Set<() => void>();
export const subscribeScenes = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const sceneSnapshot = () =>
  [
    visualDiagnostics.cityActive,
    visualDiagnostics.buildingActive,
    visualDiagnostics.cityDisposed,
    visualDiagnostics.buildingDisposed,
  ].join("|");
if (typeof window !== "undefined")
  Object.defineProperty(window, "__ASHEN_VISUALS__", {
    value: visualDiagnostics,
    configurable: true,
  });
export function registerScene(kind: "city" | "building") {
  const active = kind === "city" ? "cityActive" : "buildingActive",
    disposed = kind === "city" ? "cityDisposed" : "buildingDisposed";
  visualDiagnostics[active]++;
  listeners.forEach((fn) => fn());
  let done = false;
  return () => {
    if (done) return;
    done = true;
    visualDiagnostics[active]--;
    visualDiagnostics[disposed]++;
    listeners.forEach((fn) => fn());
  };
}
export class FrameMeter {
  private elapsed = 0;
  private samples: number[] = [];
  constructor(private renderer: RenderMetrics["renderer"]) {}
  sample(
    ms: number,
    counts = { calls: 0, geometries: 0, textures: 0 },
  ): RenderMetrics | null {
    if (!Number.isFinite(ms) || ms <= 0 || ms > 1000) return null;
    this.elapsed += ms;
    this.samples.push(ms);
    if (this.elapsed < 1500) return null;
    const sorted = [...this.samples].sort((a, b) => a - b),
      result = {
        fps: Math.round((this.samples.length * 1000) / this.elapsed),
        p95Ms:
          Math.round(
            sorted[
              Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))
            ] * 10,
          ) / 10,
        frames: this.samples.length,
        ...counts,
        renderer: this.renderer,
      };
    this.elapsed = 0;
    this.samples = [];
    visualDiagnostics.last = result;
    return result;
  }
}
