// 화면 세션 전용이다. GameState/직렬화/경제/시간 계산에 포함하지 않는다.
export interface CityCameraState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}
export interface InteriorCameraState {
  x: number;
  y: number;
  scale: number;
}
export interface InteriorSession {
  camera?: InteriorCameraState;
  room: string;
  person: string;
}
export interface ViewSession {
  cityCamera?: CityCameraState;
  interiors: Record<number, InteriorSession>;
}
export const createViewSession = (): ViewSession => ({ interiors: {} });
