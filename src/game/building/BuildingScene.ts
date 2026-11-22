import { Application, Container, Graphics, type Ticker } from "pixi.js";
import type { BuildingPresentation } from "../presentation/GamePresentation";
import { RoomRenderer } from "./RoomRenderer";
import { drawFloors } from "./FloorRenderer";
import { ResidentRenderer } from "./ResidentRenderer";
import type { InteriorSession } from "../ViewSession";
import {
  FrameMeter,
  registerScene,
  visualDiagnostics,
  type RenderMetrics,
} from "../performance";
export interface SceneCallbacks {
  room: (id: string) => void;
  resident: (id: string) => void;
  metrics: (m: RenderMetrics) => void;
  motion: (ticks: number) => void;
}
export class BuildingScene {
  private world = new Container();
  private rooms: RoomRenderer[] = [];
  private actors = new Map<string, ResidentRenderer>();
  private background = new Graphics();
  private resize: ResizeObserver;
  private unregister: () => void;
  private meter = new FrameMeter("pixi");
  private dragging = false;
  private last = { x: 0, y: 0 };
  private start = { x: 0, y: 0 };
  private disposed = false;
  private motionTicks = 0;
  private reportElapsed = 0;
  constructor(
    private app: Application,
    private host: HTMLElement,
    private model: BuildingPresentation,
    private callbacks: SceneCallbacks,
    private viewState?: InteriorSession,
  ) {
    this.unregister = registerScene("building");
    app.stage.addChild(this.background, this.world);
    this.world.addChild(drawFloors(model.layout));
    for (const room of model.layout.floors.flatMap((f) => f.rooms)) {
      const renderer = new RoomRenderer(
        room,
        model.rooms.find((r) => r.id === room.id)!,
        (id) => {
          if (
            Math.hypot(this.last.x - this.start.x, this.last.y - this.start.y) <
            6
          )
            this.callbacks.room(id);
        },
      );
      this.rooms.push(renderer);
      this.world.addChild(renderer.container);
    }
    this.update(model);
    this.resize = new ResizeObserver(() => {
      if (this.disposed) return;
      this.resizeViewport();
      this.bound();
    });
    this.resize.observe(host);
    host.addEventListener("wheel", this.wheel, { passive: false });
    host.addEventListener("pointerdown", this.down);
    host.addEventListener("pointermove", this.move);
    window.addEventListener("pointerup", this.up);
    app.ticker.add(this.tick);
    const saved = viewState?.camera;
    this.fit();
    if (saved) {
      this.world.position.set(saved.x, saved.y);
      this.world.scale.set(saved.scale);
      this.bound();
    }
  }
  update(model: BuildingPresentation, room = "", resident = "") {
    this.model = model;
    for (const r of this.rooms)
      r.update(
        model.rooms.find((m) => m.id === r.layout.id)!,
        r.layout.id === room,
      );
    for (const [id, actor] of this.actors)
      if (!model.residents.some((p) => p.id === id)) {
        actor.destroy();
        this.actors.delete(id);
      }
    for (const person of model.residents) {
      let actor = this.actors.get(person.id);
      if (!actor && person.present) {
        actor = new ResidentRenderer(person, model, (id) => {
          if (
            Math.hypot(this.last.x - this.start.x, this.last.y - this.start.y) <
            6
          )
            this.callbacks.resident(id);
        });
        this.actors.set(person.id, actor);
        this.world.addChild(actor.container);
      }
      actor?.update(person, model);
      actor?.select(resident);
    }
  }
  private tick = (ticker: Ticker) => {
    const dt = Math.min(0.08, ticker.deltaMS / 1000);
    visualDiagnostics.buildingFrames++;
    for (const room of this.rooms) room.tick(dt, this.model.paused);
    for (const actor of this.actors.values()) actor.draw(dt, this.model.paused);
    if (!this.model.paused) this.motionTicks++;
    this.reportElapsed += dt;
    if (this.reportElapsed > 1) {
      this.reportElapsed = 0;
      this.callbacks.motion(this.motionTicks);
      this.host.dataset.walking = String(
        [...this.actors.values()].filter((a) => a.walking).length,
      );
      this.host.dataset.actors = String(
        [...this.actors.values()].filter((a) => a.active).length,
      );
    }
    const m = this.meter.sample(ticker.deltaMS, {
      calls: -1,
      geometries: -1,
      textures: -1,
    });
    if (m) this.callbacks.metrics(m);
  };
  private resizeViewport = () => {
    if (this.disposed) return;
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.app.renderer.resize(w, h);
    this.background.clear().rect(0, 0, w, h).fill(0x15241e);
    for (let i = 0; i < 9; i++)
      this.background
        .moveTo(0, 160 + i * 90)
        .lineTo(w, 130 + i * 90)
        .stroke({ color: 0x667554, width: 22, alpha: 0.045 });
  };
  fit = () => {
    this.resizeViewport();
    const w = this.host.clientWidth,
      h = this.host.clientHeight,
      top = w < 900 ? 235 : 180,
      scale = Math.min(
        (w - 36) / this.model.layout.width,
        (h - top - 65) / this.model.layout.height,
      );
    this.world.scale.set(Math.max(0.18, scale));
    this.world.position.set(
      (w - this.model.layout.width * this.world.scale.x) / 2,
      top,
    );
    this.rememberCamera();
  };
  zoom = (
    factor: number,
    x = this.host.clientWidth / 2,
    y = this.host.clientHeight / 2,
  ) => {
    const old = this.world.scale.x,
      next = Math.max(0.18, Math.min(2.6, old * factor));
    this.world.position.set(
      x - ((x - this.world.x) * next) / old,
      y - ((y - this.world.y) * next) / old,
    );
    this.world.scale.set(next);
    this.bound();
  };
  pan = (x: number, y: number) => {
    this.world.x += x;
    this.world.y += y;
    this.bound();
  };
  residentState = (id: string) => this.actors.get(id)?.state;
  focusFloor = (index: number) => {
    const f = this.model.layout.floors[index];
    if (!f) return;
    const s = Math.min(
      1.35,
      (this.host.clientWidth - 40) / this.model.layout.width,
    );
    this.world.scale.set(s);
    this.world.position.set(
      (this.host.clientWidth - this.model.layout.width * s) / 2,
      this.host.clientHeight / 2 - (f.y + 68) * s,
    );
    this.bound();
  };
  private bound() {
    const s = this.world.scale.x,
      w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.world.x = Math.max(
      70 - this.model.layout.width * s,
      Math.min(w - 70, this.world.x),
    );
    this.world.y = Math.max(
      170 - this.model.layout.height * s,
      Math.min(h - 80, this.world.y),
    );
    this.rememberCamera();
  }
  private rememberCamera() {
    const camera = {
      x: this.world.x,
      y: this.world.y,
      scale: this.world.scale.x,
    };
    if (this.viewState) this.viewState.camera = camera;
    this.host.dataset.camera = JSON.stringify(camera);
  }
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const r = this.host.getBoundingClientRect();
    this.zoom(
      Math.exp(-e.deltaY * 0.001),
      e.clientX - r.left,
      e.clientY - r.top,
    );
  };
  private down = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.dragging = true;
    this.last = { x: e.clientX, y: e.clientY };
    this.start = { ...this.last };
  };
  private move = (e: PointerEvent) => {
    if (!this.dragging) return;
    const x = e.clientX - this.last.x,
      y = e.clientY - this.last.y;
    this.last = { x: e.clientX, y: e.clientY };
    if (Math.hypot(this.last.x - this.start.x, this.last.y - this.start.y) > 5)
      this.pan(x, y);
  };
  private up = () => {
    this.dragging = false;
  };
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    for (const actor of this.actors.values()) actor.remember();
    this.resize.disconnect();
    this.host.removeEventListener("wheel", this.wheel);
    this.host.removeEventListener("pointerdown", this.down);
    this.host.removeEventListener("pointermove", this.move);
    window.removeEventListener("pointerup", this.up);
    this.app.ticker.remove(this.tick);
    this.unregister();
    this.app.destroy(true, { children: true });
  }
}
