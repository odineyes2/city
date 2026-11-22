import { useLayoutEffect, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";
export interface BoxItem {
  position: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
}
export function BoxBatch({
  items,
  size = [1, 1, 1],
  color = "#666d59",
  emissive = "#000000",
  opacity = 1,
  castShadow = false,
}: {
  items: BoxItem[];
  size?: [number, number, number];
  color?: string;
  emissive?: string;
  opacity?: number;
  castShadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const transform = new Object3D(),
      tint = new Color();
    items.forEach((item, i) => {
      transform.position.set(...item.position);
      transform.scale.set(...(item.scale ?? [1, 1, 1]));
      transform.rotation.set(...(item.rotation ?? [0, 0, 0]));
      transform.updateMatrix();
      ref.current!.setMatrixAt(i, transform.matrix);
      ref.current!.setColorAt(i, tint.set(item.color ?? color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items, color]);
  if (!items.length) return null;
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, items.length]}
      castShadow={castShadow}
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color="white"
        emissive={emissive}
        emissiveIntensity={0.35}
        roughness={0.88}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </instancedMesh>
  );
}
export function Block({
  at,
  size,
  color = "#666d59",
  rotation = [0, 0, 0],
  emissive = "#000000",
  opacity = 1,
}: {
  at: [number, number, number];
  size: [number, number, number];
  color?: string;
  rotation?: [number, number, number];
  emissive?: string;
  opacity?: number;
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.91}
        metalness={0.08}
        emissive={emissive}
        emissiveIntensity={0.6}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}
export function Cylinder({
  at,
  radius = 0.5,
  height = 1,
  color = "#707361",
  rotation = [0, 0, 0],
}: {
  at: [number, number, number];
  radius?: number;
  height?: number;
  color?: string;
  rotation?: [number, number, number];
}) {
  return (
    <mesh position={at} rotation={rotation} castShadow>
      <cylinderGeometry args={[radius, radius, height, 10]} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0.2} />
    </mesh>
  );
}
export const noise = (seed: number) => {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return n - Math.floor(n);
};
