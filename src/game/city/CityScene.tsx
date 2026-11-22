import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import CityTerrain from "./CityTerrain";
import CityBuilding from "./CityBuilding";
import CityCamera, { type CameraIntent } from "./CityCamera";
import CityEffects from "./CityEffects";
import type { ViewSession } from "../ViewSession";
import type { GamePresentation } from "../presentation/GamePresentation";
import {
  FrameMeter,
  registerScene,
  visualDiagnostics,
  type RenderMetrics,
} from "../performance";
export default function CityScene({
  presentation,
  selected,
  onSelect,
  intent,
  onMetrics,
  session,
  active = true,
}: {
  presentation: GamePresentation;
  selected: number;
  onSelect: (id: number) => void;
  intent: CameraIntent;
  onMetrics: (m: RenderMetrics) => void;
  session?: ViewSession;
  active?: boolean;
}) {
  const { gl } = useThree(),
    meter = useMemo(() => new FrameMeter("three"), []);
  useEffect(() => {
    const dispose = registerScene("city");
    return () => {
      dispose();
      document.body.style.cursor = "";
    };
  }, []);
  useFrame((_, delta) => {
    visualDiagnostics.cityFrames++;
    const result = meter.sample(delta * 1000, {
      calls: gl.info.render.calls,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    });
    if (result) onMetrics(result);
  });
  const selectedBuilding = presentation.city[selected] ?? presentation.city[0];
  return (
    <>
      <color attach="background" args={["#8c9384"]} />
      <fog attach="fog" args={["#8c9384", 85, 230]} />
      <hemisphereLight args={["#d7ddc4", "#404b3e", 1.3]} />
      <ambientLight intensity={0.3} />
      <directionalLight
        castShadow
        position={[-50, 85, 30]}
        intensity={2.4}
        color="#ecd5ab"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
        shadow-camera-far={230}
        shadow-bias={-0.0005}
        shadow-normalBias={0.08}
      />
      <CityTerrain />
      {presentation.city.map((b) => (
        <CityBuilding
          key={b.id}
          building={b}
          selected={selected === b.id}
          paused={presentation.paused || !active}
          onSelect={onSelect}
        />
      ))}
      <CityEffects
        buildings={presentation.city}
        paused={presentation.paused || !active}
      />
      <pointLight
        position={[
          selectedBuilding.position[0],
          3,
          selectedBuilding.position[2] + 5,
        ]}
        color="#eac580"
        intensity={selectedBuilding.owned && selectedBuilding.powered ? 7 : 0}
        distance={15}
      />
      <CityCamera
        intent={intent}
        focus={selectedBuilding.position}
        session={session}
        active={active}
      />
    </>
  );
}
