import { useMemo, useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Points, BufferGeometry, Float32BufferAttribute } from "three";
import type { CityBuildingPresentation } from "../presentation/GamePresentation";
import { noise } from "./CityGeometry";
export default function CityEffects({
  buildings,
  paused,
}: {
  buildings: CityBuildingPresentation[];
  paused: boolean;
}) {
  const ref = useRef<Points>(null),
    phase = useRef(0);
  const geometry = useMemo(() => {
    const g = new BufferGeometry(),
      a = new Float32Array(48 * 3);
    for (let i = 0; i < 48; i++) {
      a[i * 3] = -45 + noise(i) * 90;
      a[i * 3 + 1] = 2 + noise(i + 3) * 13;
      a[i * 3 + 2] = -40 + noise(i + 4) * 80;
    }
    g.setAttribute("position", new Float32BufferAttribute(a, 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const sources = buildings.filter(
    (b) => b.active && b.facility === "generator" && b.workerCount > 0,
  );
  useFrame((_, delta) => {
    if (paused || !ref.current) return;
    phase.current += Math.min(delta, 0.06);
    const positions = geometry.attributes.position;
    for (let i = 0; i < 48; i++) {
      const source = sources[i % Math.max(1, sources.length)];
      const rise = (phase.current * 0.7 + i * 0.43) % 9;
      positions.setXYZ(
        i,
        source
          ? source.position[0] + Math.sin(i) * 0.7 + rise * 0.12
          : -45 + noise(i) * 90,
        source ? 15 + rise : 2 + noise(i + 3) * 13,
        source
          ? source.position[2] + Math.cos(i) * 0.7
          : -40 + noise(i + 4) * 80,
      );
    }
    positions.needsUpdate = true;
  });
  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={sources.length ? 0.65 : 0.12}
        color="#c9c5a5"
        transparent
        opacity={sources.length ? 0.2 : 0.26}
        depthWrite={false}
      />
    </points>
  );
}
