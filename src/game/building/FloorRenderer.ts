import { Container, Graphics } from "pixi.js";
import type { BuildingLayout } from "./BuildingLayout";
import { label, rect } from "./RoomRenderer";
export function drawFloors(layout: BuildingLayout) {
  const c = new Container(),
    g = new Graphics();
  c.addChild(g);
  rect(g, 0, 0, 1140, layout.height, 0x202c26);
  rect(g, 16, 54, 1120, layout.height - 60, 0x4a5142);
  rect(g, 32, 67, 130, layout.height - 83, 0x26372e);
  for (let i = 0; i < 60; i++) {
    const x = (i * 107) % 1120,
      y = 65 + ((i * 47) % (layout.height - 90));
    g.poly([x, y, x + 20, y - 9, x + 34, y + 9, x + 6, y + 11]).fill({
      color: 0x8b8d70,
      alpha: 0.1,
    });
  }
  c.addChild(label("DAWN / TRANSIT REFUGE", 184, 20, 17, 0xb9c4a1));
  c.addChild(label("구조 단면 · 층별 독립 생산 없음", 780, 25, 12, 0x8fa18b));
  for (const floor of layout.floors) {
    rect(g, 170, floor.y - 6, 925, 6, 0x858b70);
    rect(g, 170, floor.y + 136, 925, 14, 0x737d63);
    rect(g, 1094, floor.y, 12, 150, 0x7c826b);
    c.addChild(label(floor.label, 180, floor.y + 137, 9, 0x222f23));
    const n = layout.nodes.find(
      (n) => n.id === `b${layout.buildingId}:stair:${floor.index}`,
    )!;
    g.moveTo(n.x, n.y).lineTo(180, n.y).stroke({ color: 0x78876d, width: 5 });
    if (floor.index > 0) {
      const prev = layout.nodes.find(
        (n) => n.id === `b${layout.buildingId}:stair:${floor.index - 1}`,
      )!;
      for (let j = 0; j < 16; j++) {
        const a = j / 16,
          x = prev.x + (n.x - prev.x) * a,
          y = prev.y + (n.y - prev.y) * a;
        g.moveTo(x - 15, y)
          .lineTo(x + 15, y)
          .stroke({ color: 0x849077, width: 4 });
      }
      g.moveTo(prev.x - 20, prev.y - 24)
        .lineTo(n.x - 20, n.y - 24)
        .stroke({ color: 0xb3b59a, width: 2 });
    }
    rect(g, 44, floor.y + 18, 85, 19, 0x182d24);
    c.addChild(
      label(
        floor.index === 0 ? "ENTRY" : `B${floor.index}`,
        55,
        floor.y + 21,
        11,
        0xa5bb95,
      ),
    );
  }
  return c;
}
