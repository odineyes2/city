import { useSyncExternalStore } from "react";
import { subscribeScenes, sceneSnapshot } from "./performance";
export default function VisualLifecycle() {
  const [city, building, cityDisposed, buildingDisposed] = useSyncExternalStore(
    subscribeScenes,
    sceneSnapshot,
    sceneSnapshot,
  ).split("|");
  return (
    <output
      hidden
      aria-hidden="true"
      data-testid="visual-lifecycle"
      data-city-active={city}
      data-building-active={building}
      data-city-disposed={cityDisposed}
      data-building-disposed={buildingDisposed}
    />
  );
}
