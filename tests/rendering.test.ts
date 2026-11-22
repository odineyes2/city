import { describe, it, expect } from "vitest";
import {
  FrameMeter,
  registerScene,
  visualDiagnostics,
} from "../src/game/performance";
import { supportsWebGL } from "../src/game/city/WebGLSupport";
import { clampTarget } from "../src/game/city/CityCamera";
describe("도시 렌더링 경계", () => {
  it("카메라 목표는 지구 경계 안에 제한한다", () => {
    expect(clampTarget(100, -100)).toEqual({ x: 65, z: -50 });
    expect(clampTarget(0, 2)).toEqual({ x: 0, z: 2 });
  });
  it("WebGL 미지원·초기화 예외를 대체 화면 조건으로 반환한다", () => {
    expect(
      supportsWebGL(
        () => ({ getContext: () => null }) as unknown as HTMLCanvasElement,
      ),
    ).toBe(false);
    expect(
      supportsWebGL(() => {
        throw Error("GPU");
      }),
    ).toBe(false);
  });
  it("장면 정리는 여러 번 호출해도 활성 수를 중복 차감하지 않는다", () => {
    const initial = visualDiagnostics.cityActive,
      stop = registerScene("city");
    expect(visualDiagnostics.cityActive).toBe(initial + 1);
    stop();
    stop();
    expect(visualDiagnostics.cityActive).toBe(initial);
  });
  it("실제 프레임 간격으로 FPS와 p95를 계산하고 잘못된 표본을 제외한다", () => {
    const meter = new FrameMeter("three");
    expect(meter.sample(Infinity)).toBe(null);
    let m = null;
    for (let i = 0; i < 100; i++) m = meter.sample(16) ?? m;
    expect(m?.fps).toBe(63);
    expect(m?.p95Ms).toBe(16);
  });
});
