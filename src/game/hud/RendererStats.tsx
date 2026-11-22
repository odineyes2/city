import type { RenderMetrics } from "../performance";
export default function RendererStats({
  metrics,
}: {
  metrics: RenderMetrics | null;
}) {
  return (
    <details
      className="renderer-stats"
      data-testid="renderer-stats"
      data-fps={metrics?.fps ?? 0}
      data-p95={metrics?.p95Ms ?? 0}
    >
      <summary>
        {metrics ? `${metrics.fps} FPS` : "렌더링 측정 중"} <span>· 성능</span>
      </summary>
      <p>
        {metrics
          ? `${metrics.renderer === "three" ? "Three.js" : "PixiJS"} · 최근 ${metrics.frames}프레임 · p95 ${metrics.p95Ms}ms`
          : "장면이 준비된 후 실제 프레임을 측정합니다."}
      </p>
      {metrics && (
        <p>
          {metrics.calls >= 0
            ? `그리기 ${metrics.calls} · 도형 ${metrics.geometries} · 텍스처 ${metrics.textures}`
            : "GPU 객체·그리기 호출 수 미계측"}
        </p>
      )}
      <small>이 브라우저·현재 화면에서의 실측값입니다.</small>
    </details>
  );
}
