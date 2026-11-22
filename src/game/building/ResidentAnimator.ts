import type { AnimationState } from "../presentation/GamePresentation";
export interface Pose {
  leftLeg: number;
  rightLeg: number;
  leftArm: number;
  rightArm: number;
  lean: number;
  bob: number;
  sit: boolean;
}
export function residentPose(
  state: AnimationState,
  phase: number,
  area: string | null,
): Pose {
  const p: Pose = {
    leftLeg: 0,
    rightLeg: 0,
    leftArm: 0.08,
    rightArm: -0.08,
    lean: 0,
    bob: Math.sin(phase * 2) * 0.35,
    sit: false,
  };
  if (state === "walking") {
    const wave = Math.sin(phase * 8);
    p.leftLeg = wave * 0.55;
    p.rightLeg = -wave * 0.55;
    p.leftArm = -wave * 0.4;
    p.rightArm = wave * 0.4;
    p.bob = Math.abs(Math.cos(phase * 8)) * 1.2;
  }
  if (state === "working") {
    p.lean = area === "food" ? 0.15 : 0.05;
    p.leftArm = -0.7 + Math.sin(phase * 3) * 0.25;
    p.rightArm = area === "guard" ? 0.2 : -0.9 + Math.cos(phase * 3) * 0.35;
    if (area === "materials") {
      p.leftArm = -1.1;
      p.rightArm = -1.1;
    }
    if (area === "guard") {
      p.lean = Math.sin(phase * 0.8) * 0.04;
      p.leftArm = -0.3;
      p.rightArm = -0.6;
    }
  }
  if (state === "repairing") {
    p.lean = 0.18;
    p.rightArm = -1.2 + Math.sin(phase * 6) * 0.9;
    p.leftArm = -0.7;
  }
  if (state === "resting" || state === "injured") {
    p.sit = true;
    p.leftLeg = -1.25;
    p.rightLeg = -1.1;
    p.lean = state === "injured" ? 0.2 : 0.1;
    p.rightArm = state === "injured" ? -0.8 : 0;
  }
  return p;
}
