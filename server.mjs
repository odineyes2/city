// 빌드된 게임만 제공하는 운영 HTTP 서버와 dev 서비스 연결용 상태 확인.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const project = fileURLToPath(new URL(".", import.meta.url));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export function createAppServer(root = resolve(project, "dist")) {
  const directory = resolve(root);
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      res.end();
      return;
    }
    const respond = (
      status,
      body,
      contentType = "text/plain; charset=utf-8",
      cache = "no-store",
    ) => {
      res.writeHead(status, {
        "Content-Type": contentType,
        "Cache-Control": cache,
      });
      res.end(req.method === "HEAD" ? undefined : body);
    };
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname === "/api/health") {
        // HTML만 있는 더미 health가 아니라 빌드 진입점과 실제 번들 존재를 확인한다.
        const html = await readFile(resolve(directory, "index.html"), "utf8");
        const assets = [
          ...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g),
        ].map((match) => match[1]);
        if (!assets.length) throw new Error("Missing game assets");
        await Promise.all(
          assets.map((asset) => stat(resolve(directory, `.${asset}`))),
        );
        respond(
          200,
          JSON.stringify({
            ok: true,
            app: "city",
            version: "0.3.0",
            assets: assets.length,
          }),
          types[".json"],
        );
        return;
      }
      const relative = pathname === "/" ? "index.html" : pathname.slice(1);
      const file = resolve(directory, relative);
      if (
        !file.startsWith(directory + sep) ||
        relative.split(/[\\/]/).some((part) => part.startsWith("."))
      ) {
        respond(404, "Not found");
        return;
      }
      const body = await readFile(file);
      respond(
        200,
        body,
        types[extname(file)] || "application/octet-stream",
        pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      );
    } catch (error) {
      if (error instanceof URIError) respond(400, "Bad request");
      else if (req.url?.split("?")[0] === "/api/health")
        respond(
          503,
          JSON.stringify({
            ok: false,
            app: "city",
            error: "Game build is not ready",
          }),
          types[".json"],
        );
      else respond(404, "Not found");
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const port = Number(process.env.PORT || 8402);
  const host = "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid PORT");
  const server = createAppServer();
  server.listen(port, host, () =>
    console.log(`ASHEN CITY production: http://${host}:${port}`),
  );
  const close = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
}
