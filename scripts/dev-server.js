import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 42069);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${host}:${port}`);
  if (requestUrl.pathname === "/") {
    response.statusCode = 302;
    response.setHeader("Location", "/docs/");
    response.end();
    return;
  }

  const requestedPathname = requestUrl.pathname;
  let filePath = path.join(rootDirectory, decodeURIComponent(requestedPathname));

  if (filePath.endsWith(path.sep)) {
    filePath = path.join(filePath, "index.html");
  }

  if (!existsSync(filePath)) {
    response.statusCode = 404;
    response.end("Not found");
    return;
  }

  response.setHeader(
    "Content-Type",
    mimeTypes.get(path.extname(filePath)) || "application/octet-stream",
  );

  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`Roselt.js docs running at http://${host}:${port}/`);
  console.log(`Roselt.js example running at http://${host}:${port}/examples/admin-demo/`);
});