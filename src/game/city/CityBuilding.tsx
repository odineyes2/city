import { memo, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import CityLabel from "./CityLabel";
import { Group } from "three";
import type { CityBuildingPresentation } from "../presentation/GamePresentation";
import { BoxBatch, Block, Cylinder, noise, type BoxItem } from "./CityGeometry";
const shapes: Record<string, [number, number, number]> = {
  shelter: [10, 3, 8],
  store: [11, 5.5, 9],
  waterworks: [11, 3.8, 10],
  residential: [8.5, 24, 8.5],
  substation: [10, 5, 8],
  workshop: [11, 5.5, 9],
  parking: [12, 12, 12],
  market: [12, 4.5, 9],
  checkpoint: [7, 7, 7],
  lab: [11, 8, 9],
  library: [12, 12, 8],
  warehouse: [13, 6, 11],
  clinic: [13, 16, 10],
  rooftop: [9, 12, 9],
  machine: [11, 9, 10],
  tower: [5, 29, 5],
};
function CityBuilding({
  building: b,
  selected,
  paused,
  onSelect,
}: {
  building: CityBuildingPresentation;
  selected: boolean;
  paused: boolean;
  onSelect: (id: number) => void;
}) {
  const [w, h, d] = shapes[b.type] ?? [9, 8, 9],
    roof = useRef<Group>(null),
    owned = b.owned,
    known = b.known;
  const tint = !known
    ? "#505b51"
    : owned
      ? "#898b71"
      : b.type === "clinic"
        ? "#a19a81"
        : b.type === "substation"
          ? "#737e70"
          : "#7c806d";
  const windows = useMemo(() => {
    const result: BoxItem[] = [];
    const floors = Math.max(1, Math.floor(h / 3.2));
    for (let floor = 0; floor < floors; floor++)
      for (let col = 0; col < Math.floor(w / 1.7); col++) {
        if (
          floor > floors - 2 &&
          col > 1 &&
          noise(b.id + floor * 17 + col) > 0.55
        )
          continue;
        const color =
          b.active && b.powered && noise(col + floor * 9 + b.id) > 0.38
            ? "#d0b983"
            : noise(col + floor + b.id) > 0.5
              ? "#37473e"
              : "#4d5d51";
        result.push({
          position: [
            -w / 2 + 1.1 + col * 1.7,
            1.35 + floor * 3.2,
            d / 2 + 0.035,
          ],
          scale: [0.85, 1.3, 0.09],
          color,
        });
        if (col < Math.floor(d / 1.7))
          result.push({
            position: [
              w / 2 + 0.035,
              1.35 + floor * 3.2,
              -d / 2 + 1.1 + col * 1.7,
            ],
            scale: [0.09, 1.3, 0.85],
            color,
          });
      }
    return result;
  }, [b.id, b.active, b.powered, w, h, d]);
  const floors = useMemo(
    () =>
      Array.from({ length: Math.max(1, Math.floor(h / 3.2)) }, (_, i) => ({
        position: [0, 0.7 + i * 3.2, 0] as [number, number, number],
        scale: [w + 0.18, 0.16, d + 0.18] as [number, number, number],
        color: "#646b5a",
      })),
    [w, h, d],
  );
  const select = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 6) onSelect(b.id);
  };
  useFrame((_, delta) => {
    if (!paused && roof.current && b.active && b.powered && b.workerCount > 0)
      roof.current.rotation.y += Math.min(delta, 0.05) * 0.5;
  });
  const industry = ["warehouse", "workshop", "substation", "machine"].includes(
      b.type,
    ),
    open = ["parking", "tower", "waterworks"].includes(b.type);
  return (
    <group
      position={b.position}
      onClick={select}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <Block
        at={[0, 0.36, 0]}
        size={[w + 0.8, 0.45, d + 0.8]}
        color="#747967"
      />
      {!open && (
        <>
          <Block
            at={[-w * 0.1, h * 0.42, 0]}
            size={[w * 0.8, h * 0.84, d]}
            color={tint}
          />
          <Block
            at={[w * 0.35, h * 0.3, 0]}
            size={[w * 0.3, h * 0.6, d]}
            color={tint}
          />
          <Block
            at={[-w * 0.14, h * 0.89, -d * 0.1]}
            size={[w * 0.7, h * 0.1, d * 0.8]}
            color={tint}
          />
        </>
      )}
      {open && (
        <>
          <BoxBatch items={floors} castShadow />
          {[-w / 2 + 0.5, w / 2 - 0.5].flatMap((x) =>
            [-d / 2 + 0.5, d / 2 - 0.5].map((z) => (
              <Block
                key={`${x}-${z}`}
                at={[x, h / 2, z]}
                size={[0.6, h, 0.6]}
                color={tint}
              />
            )),
          )}
        </>
      )}
      {!open && <BoxBatch items={floors} />}
      {!open && (
        <BoxBatch
          items={windows}
          emissive={b.active && b.powered ? "#9c7540" : "#000000"}
        />
      )}
      <Block
        at={[0, 0.9, d / 2 + 0.08]}
        size={[industry ? 3 : 1.7, 1.9, 0.16]}
        color="#263a30"
      />
      <Block
        at={[0, 2.05, d / 2 + 0.25]}
        size={[industry ? 3.4 : 2.2, 0.2, 0.65]}
        color="#8a8670"
      />
      {known && (
        <Block
          at={[0, 2.5, d / 2 + 0.1]}
          size={[w * 0.62, 0.34, 0.16]}
          color={industry ? "#9d9464" : "#666d58"}
        />
      )}
      <Block
        at={[-w * 0.22, h * 0.95, 0]}
        size={[1.8, 0.75, 1.6]}
        color="#575f52"
      />
      <Cylinder
        at={[-w * 0.25, h + 1, -d * 0.24]}
        radius={0.32}
        height={2}
        color="#4b574b"
      />
      {b.type === "residential" && (
        <>
          <Block
            at={[-w * 0.3, h * 0.7, d * 0.54]}
            size={[w * 0.34, h * 0.2, 1]}
            color="#454f43"
          />
          {[1, 3, 5].map((i) => (
            <Block
              key={i}
              at={[w * 0.32, i * 3.2, d * 0.54]}
              size={[w * 0.25, 0.3, 1.4]}
              color="#7b8069"
            />
          ))}
          <Block
            at={[w * 0.12, h + 0.6, -d * 0.3]}
            size={[0.15, 2.7, 0.15]}
            color="#454f43"
            rotation={[0.1, 0.1, -0.1]}
          />
        </>
      )}
      {b.type === "clinic" && (
        <>
          <Block
            at={[-w * 0.43, h * 0.33, 1]}
            size={[3.3, h * 0.67, d + 1.2]}
            color="#90917b"
          />
          <Block
            at={[w * 0.43, h * 0.33, 1]}
            size={[3.3, h * 0.67, d + 1.2]}
            color="#90917b"
          />
          <Block
            at={[0, h * 0.7, d / 2 + 0.1]}
            size={[2.6, 0.62, 0.18]}
            color="#985b47"
          />
          <Block
            at={[0, h * 0.7, d / 2 + 0.15]}
            size={[0.62, 2.6, 0.18]}
            color="#985b47"
          />
        </>
      )}
      {industry && (
        <>
          <Block
            at={[0, h + 0.2, 0]}
            size={[w + 1, 0.4, d + 1]}
            rotation={[0, 0, 0.04]}
            color="#656c5b"
          />
          {[-3, 0, 3].map((x, i) => (
            <Cylinder
              key={x}
              at={[x, 1.2, d * 0.6 + 1]}
              radius={0.7}
              height={2}
              color={i % 2 ? "#797354" : "#585f4c"}
            />
          ))}
          <Block
            at={[w * 0.65, 0.9, 0]}
            size={[1.8, 1.7, 2.2]}
            color="#746b4d"
          />
        </>
      )}
      {b.type === "substation" && (
        <>
          {[-2, 2].map((x) => (
            <group key={x} position={[x, 0, d * 0.7]}>
              <Block at={[0, 1.25, 0]} size={[2.5, 2, 2.6]} color="#657b6a" />
              {[-0.8, 0, 0.8].map((xx) => (
                <Cylinder
                  key={xx}
                  at={[xx, 2.8, 0]}
                  radius={0.18}
                  height={1.3}
                  color="#b5aa81"
                />
              ))}
            </group>
          ))}
          <Block at={[0, 5, d * 0.7]} size={[9, 0.28, 0.28]} color="#525f4e" />
        </>
      )}
      {b.type === "waterworks" && (
        <>
          {[-3, 3].map((x) => (
            <group key={x}>
              <Cylinder
                at={[x, 1.1, 0]}
                radius={2.5}
                height={2}
                color="#879481"
              />
              <Cylinder
                at={[x, 2.15, 0]}
                radius={2.2}
                height={0.1}
                color="#4f7771"
              />
            </group>
          ))}
          <Cylinder
            at={[0, 3, 0]}
            radius={0.2}
            height={8}
            rotation={[0, 0, Math.PI / 2]}
            color="#778a7a"
          />
        </>
      )}
      {(b.type === "rooftop" || b.type === "lab") && (
        <>
          <Block
            at={[0, h + 0.8, 0]}
            size={[w * 0.7, 0.18, d * 0.7]}
            rotation={[0.25, 0, 0]}
            color="#40585a"
          />
          {[-2, 0, 2].map((x) => (
            <Block
              key={x}
              at={[x, h + 0.9, 0]}
              size={[0.08, 0.2, d * 0.75]}
              rotation={[0.25, 0, 0]}
              color="#939c88"
            />
          ))}
        </>
      )}
      {b.type === "tower" && (
        <>
          <Block at={[0, h, 0]} size={[8, 0.6, 7]} color="#8b8c71" />
          <Block at={[0, h + 2, 0]} size={[5, 3.4, 4]} color="#5d6e61" />
          <Cylinder
            at={[0, h + 6, 0]}
            radius={0.12}
            height={5}
            color="#b2ad88"
          />
          <group position={[0, h + 4, 0]} ref={roof}>
            <mesh rotation={[Math.PI / 2, 0, 0.4]}>
              <sphereGeometry args={[1.7, 12, 8, 0, Math.PI]} />
              <meshStandardMaterial color="#a2a591" side={2} />
            </mesh>
          </group>
        </>
      )}
      {b.type === "shelter" && (
        <>
          <Block at={[0, 0.25, d * 0.7]} size={[6, 0.3, 3.6]} color="#3b493e" />
          {[0, 1, 2, 3].map((i) => (
            <Block
              key={i}
              at={[0, 0.4 + i * 0.18, d * 0.5 + i * 0.5]}
              size={[5, 0.16, 1]}
              color="#8b8e75"
            />
          ))}
          <Block at={[0, 3.4, d * 0.5]} size={[9, 0.22, 3]} color="#6d7b69" />
          {[-4, 4].map((x) => (
            <Cylinder
              key={x}
              at={[x, 1.8, d * 0.8]}
              radius={0.1}
              height={3}
              color="#a3aa88"
            />
          ))}
          <Block
            at={[0, 2.5, d * 0.51]}
            size={[4, 0.6, 0.12]}
            color="#c5b16e"
            emissive={b.powered ? "#967337" : "#000000"}
          />
        </>
      )}
      {(b.type === "store" || b.type === "market") && (
        <Block
          at={[0, 2.6, d * 0.6]}
          size={[w * 0.9, 0.15, 2.4]}
          color="#657b57"
          rotation={[0.12, 0, 0]}
        />
      )}
      {owned && (
        <>
          <Cylinder
            at={[w * 0.57, 2, d * 0.42]}
            radius={0.07}
            height={3.6}
            color="#7b896e"
          />
          <Block
            at={[w * 0.57 + 0.6, 3.2, d * 0.42]}
            size={[1.2, 0.7, 0.05]}
            color="#80a17d"
          />
          <Block
            at={[0, 0.62, d * 0.64]}
            size={[1.6, 0.15, 0.6]}
            color="#cbb27a"
            emissive={
              b.powered || b.status === "restoring" ? "#ac7d3f" : "#000000"
            }
          />
        </>
      )}
      {b.status === "restoring" && (
        <>
          <BoxBatch
            items={Array.from({ length: 5 }, (_, i) => ({
              position: [-w * 0.55 + i * w * 0.275, h * 0.4, d * 0.6] as [
                number,
                number,
                number,
              ],
              scale: [0.1, h * 0.8, 0.1] as [number, number, number],
              color: "#a49c76",
            }))}
          />
          {[0.2, 0.45, 0.7].map((y) => (
            <Block
              key={y}
              at={[0, h * y, d * 0.6]}
              size={[w * 1.2, 0.13, 0.7]}
              color="#9a8d64"
            />
          ))}
          <Cylinder at={[w * 0.7, 2, d * 0.55]} radius={0.1} height={3.5} />
          <Block
            at={[w * 0.7, 3.4, d * 0.55]}
            size={[1, 0.4, 0.4]}
            color="#d4b675"
            emissive="#b4893f"
          />
        </>
      )}
      {b.active && b.facility === "farm" && (
        <>
          <Block
            at={[0, h + 0.4, d * 0.15]}
            size={[w * 0.6, 0.8, d * 0.55]}
            color="#557f50"
          />
          {[-2, 0, 2].map((x) => (
            <Block
              key={x}
              at={[x, h + 1, d * 0.15]}
              size={[0.5, 0.8, d * 0.5]}
              color="#7a9d61"
            />
          ))}
        </>
      )}
      {b.active && b.facility === "generator" && (
        <group
          position={[w * 0.2, h + 1, 0]}
          ref={b.type !== "tower" ? roof : undefined}
        >
          <Block at={[0, 0, 0]} size={[3, 0.12, 0.3]} color="#b0b094" />
          <Block at={[0, 0, 0]} size={[0.3, 0.12, 3]} color="#b0b094" />
        </group>
      )}
      {selected && (
        <>
          <mesh position={[0, 0.56, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry
              args={[Math.max(w, d) * 0.64, Math.max(w, d) * 0.67, 48]}
            />
            <meshBasicMaterial
              color="#c6d9a4"
              transparent
              opacity={0.75}
              depthWrite={false}
            />
          </mesh>
          <CityLabel
            name={b.name}
            detail={`${b.owner} · ${b.statusName}`}
            height={h}
          />
        </>
      )}
    </group>
  );
}
export default memo(
  CityBuilding,
  (a, b) =>
    a.selected === b.selected &&
    a.paused === b.paused &&
    a.onSelect === b.onSelect &&
    a.building.status === b.building.status &&
    a.building.owner === b.building.owner &&
    a.building.facility === b.building.facility &&
    a.building.progress === b.building.progress &&
    a.building.powered === b.building.powered &&
    a.building.workerCount === b.building.workerCount &&
    a.building.condition === b.building.condition,
);
