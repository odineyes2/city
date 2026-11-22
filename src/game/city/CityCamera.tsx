import { useRef, useEffect, useCallback, type ComponentRef } from "react";
import { MapControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3,MOUSE } from "three";
const mouseButtons={LEFT:MOUSE.PAN,MIDDLE:MOUSE.DOLLY,RIGHT:MOUSE.ROTATE};
import type { ViewSession } from "../ViewSession";
export type CameraAction =
  | "overview"
  | "focus"
  | "left"
  | "right"
  | "up"
  | "down"
  | "rotate-left"
  | "rotate-right"
  | "zoom-in"
  | "zoom-out";
export interface CameraIntent {
  action: CameraAction;
  serial: number;
}
export const clampTarget = (x: number, z: number) => ({
  x: Math.max(-65, Math.min(65, x)),
  z: Math.max(-50, Math.min(50, z)),
});
export default function CityCamera({
  intent,
  focus,
  session,
}: {
  intent: CameraIntent;
  focus: [number, number, number];
  session?: ViewSession;
}) {
  const ref = useRef<ComponentRef<typeof MapControls>>(null),
    goal = useRef<{ target: Vector3; zoom: number } | null>(null),
    { camera, gl } = useThree();
  const remember = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const snapshot = {
      position: camera.position.toArray() as [number, number, number],
      target: c.target.toArray() as [number, number, number],
      zoom: camera.zoom,
    };
    if (session) session.cityCamera = snapshot;
    gl.domElement.dataset.camera = JSON.stringify(snapshot);
  },[camera,gl,session]);
  const start=useCallback(()=>{goal.current=null;},[]);
  useEffect(() => {
    const c = ref.current;
    if (c) {
      const saved = session?.cityCamera;
      if (saved) {
        camera.position.set(...saved.position);
        camera.zoom = saved.zoom;
        camera.updateProjectionMatrix();
        c.target.set(...saved.target);
      } else c.target.set(-40, 0, -30);
      c.update();
      remember();
    }
  }, []);
  useEffect(() => {
    if (intent.serial === 0) return;
    const c = ref.current;
    if (!c) return;
    const target = c.target.clone();
    let zoom = camera.zoom;
    if (intent.action === "overview") {
      target.set(0, 0, 0);
      zoom = 5.7;
    } else if (intent.action === "focus") {
      target.set(...focus);
      zoom = 11;
    } else if (intent.action.startsWith("rotate")) {
      const offset = camera.position.clone().sub(c.target);
      offset.applyAxisAngle(
        new Vector3(0, 1, 0),
        intent.action === "rotate-left" ? 0.25 : -0.25,
      );
      camera.position.copy(c.target).add(offset);
      c.update();
      return;
    } else if (intent.action === "zoom-in") zoom = Math.min(18, zoom * 1.2);
    else if (intent.action === "zoom-out") zoom = Math.max(4, zoom / 1.2);
    else {
      const amount = 7;
      if (intent.action === "left") target.x -= amount;
      if (intent.action === "right") target.x += amount;
      if (intent.action === "up") target.z -= amount;
      if (intent.action === "down") target.z += amount;
    }
    const bounded = clampTarget(target.x, target.z);
    target.set(bounded.x, 0, bounded.z);
    goal.current = { target, zoom };
  }, [intent.serial]);
  useFrame((_, delta) => {
    const c = ref.current;
    if (!c) return;
    if (goal.current) {
      const alpha = 1 - Math.exp(-Math.min(delta, 0.1) * 7),
        next = c.target.clone().lerp(goal.current.target, alpha),
        movement = next.clone().sub(c.target);
      camera.position.add(movement);
      c.target.copy(next);
      camera.zoom += (goal.current.zoom - camera.zoom) * alpha;
      camera.updateProjectionMatrix();
      if (
        c.target.distanceTo(goal.current.target) < 0.03 &&
        Math.abs(camera.zoom - goal.current.zoom) < 0.02
      )
        goal.current = null;
    }
    const bounded = clampTarget(c.target.x, c.target.z),
      correction = new Vector3(
        bounded.x - c.target.x,
        -c.target.y,
        bounded.z - c.target.z,
      );
    camera.position.add(correction);
    c.target.add(correction);
    if(correction.lengthSq()>1e-10)c.update();
  });
  return (
    <MapControls
      ref={ref}
      domElement={gl.domElement}
      mouseButtons={mouseButtons}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning={false}
      minPolarAngle={0.32}
      maxPolarAngle={1.05}
      minZoom={4}
      maxZoom={18}
      enableRotate
      onStart={start}
      onChange={remember}
    />
  );
}
