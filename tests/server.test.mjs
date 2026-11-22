// 운영 서버가 실제 게임을 제공하고 소스 파일을 노출하지 않는지 확인한다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppServer } from "../server.mjs";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let server, base, root;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), "city-server-"));
  await mkdir(join(root, "assets"));
  await writeFile(
    join(root, "index.html"),
    '<html><script src="/assets/game-abcd.js"></script></html>',
  );
  await writeFile(join(root, "assets/game-abcd.js"), 'console.log("city")');
  server = createAppServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  if (!root || !root.startsWith(join(tmpdir(), "city-server-")))
    throw new Error("Unexpected cleanup directory");
  await rm(root, { recursive: true });
});
describe("운영 정적 서버", () => {
  it("게임 진입점·번들·실제 준비 상태를 제공한다", async () => {
    const page = await fetch(base);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("/assets/game-abcd.js");
    const asset = await fetch(`${base}/assets/game-abcd.js`);
    expect(asset.headers.get("content-type")).toContain("text/javascript");
    expect(asset.headers.get("cache-control")).toContain("immutable");
    expect((await (await fetch(`${base}/api/health`)).json()).ok).toBe(true);
    expect(await (await fetch(base, { method: "HEAD" })).text()).toBe("");
  });
  it("소스·비밀 경로·쓰기 요청을 제공하지 않는다", async () => {
    for (const path of [
      "/src/App.tsx",
      "/.env",
      "/%2e%2e/server.mjs",
      "/%ZZ",
    ]) {
      expect((await fetch(base + path)).status).toBeGreaterThanOrEqual(400);
    }
    expect((await fetch(base, { method: "POST" })).status).toBe(405);
  });
  it("게임 번들이 사라지면 준비 상태 실패를 반환한다", async () => {
    await rm(join(root, "assets/game-abcd.js"));
    expect((await fetch(`${base}/api/health`)).status).toBe(503);
  });
});
