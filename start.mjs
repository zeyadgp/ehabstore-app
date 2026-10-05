import http from "node:http";
import fs from "node:fs";
import path from "node:path";

// Ensure process doesn't crash on unhandled errors in production
process.on("unhandledRejection", (reason) => {
  console.error("[start.mjs] Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[start.mjs] Uncaught Exception:", error);
});

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const clientDistDir = path.join(distDir, "client");
const publicDir = path.join(rootDir, "public");
const outputPublicDir = path.join(rootDir, ".output", "public");
const serverPath = path.join(rootDir, ".output", "server", "index.mjs");

const searchDirs = [distDir, clientDistDir, outputPublicDir, publicDir];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

function handleStaticRequest(req, res) {
  const reqUrl = req.url || "/";
  const pathname = reqUrl.split("?")[0];
  const isHead = req.method === "HEAD";

  // 1. Health checks for Cloud Run, Google Cloud LB, and container probes
  if (
    pathname === "/health" ||
    pathname === "/api/health" ||
    pathname === "/ping" ||
    pathname === "/_health" ||
    pathname === "/_ah/health" ||
    pathname === "/_ah/start" ||
    pathname === "/healthz" ||
    pathname === "/livez" ||
    pathname === "/readyz"
  ) {
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    if (isHead) {
      res.end();
    } else {
      res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
    }
    return;
  }

  // 2. Resolve static file
  let foundFile = null;
  const cleanPath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");

  for (const dir of searchDirs) {
    const candidate = path.join(dir, cleanPath);
    if (fs.existsSync(candidate)) {
      try {
        if (!fs.statSync(candidate).isDirectory()) {
          foundFile = candidate;
          break;
        }
      } catch {
        // ignore fs stat error
      }
    }
  }

  // 3. SPA Fallback to index.html
  if (!foundFile) {
    for (const dir of searchDirs) {
      const candidate = path.join(dir, "index.html");
      if (fs.existsSync(candidate)) {
        foundFile = candidate;
        break;
      }
    }
  }

  // 4. Default inline HTML fallback if dist/index.html is missing
  if (!foundFile) {
    const fallbackHtml =
      '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>إيهاب ستور</title></head><body><div id="root"></div></body></html>';
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": Buffer.byteLength(fallbackHtml),
    });
    if (isHead) {
      res.end();
    } else {
      res.end(fallbackHtml);
    }
    return;
  }

  const ext = path.extname(foundFile).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";
  const isHtml = ext === ".html";

  try {
    const stat = fs.statSync(foundFile);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": stat.size,
      "Cache-Control": isHtml ? "no-cache" : "public, max-age=31536000, immutable",
    });

    if (isHead) {
      res.end();
    } else {
      fs.createReadStream(foundFile).pipe(res);
    }
  } catch (err) {
    console.error("[start.mjs] Error serving file:", err.message);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  }
}

function startStaticServer(port, host = "0.0.0.0") {
  const server = http.createServer(handleStaticRequest);

  server.on("error", (err) => {
    console.error(`[start.mjs] Static server error on ${host}:${port}:`, err.message);
  });

  server.listen(port, host, () => {
    console.log(`[start.mjs] Static fallback server listening on http://${host}:${port}`);
  });

  return server;
}

function tryStartPort3000Forwarder(targetPort) {
  if (targetPort === 3000) return;

  try {
    const forwarder = http.createServer((req, res) => {
      const options = {
        hostname: "127.0.0.1",
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on("error", (err) => {
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Proxy Gateway Error: " + err.message);
        }
      });

      req.pipe(proxyReq);
    });

    forwarder.on("error", (err) => {
      // If port 3000 is in use, ignore gracefully
      console.log("[start.mjs] Port 3000 forwarder notice:", err.message);
    });

    forwarder.listen(3000, "0.0.0.0", () => {
      console.log(`[start.mjs] Port 3000 forwarder listening and routing to port ${targetPort}`);
    });
  } catch (err) {
    console.log("[start.mjs] Port 3000 forwarder skipped:", err.message);
  }
}

async function main() {
  const targetPort = parseInt(process.env.PORT || "3000", 10);
  const host = "0.0.0.0";

  console.log(`[start.mjs] Initializing production server targetPort=${targetPort}...`);

  // 1. Try launching Nitro SSR server if compiled
  if (fs.existsSync(serverPath)) {
    try {
      console.log(
        `[start.mjs] Launching TanStack Start Nitro server on http://${host}:${targetPort}`,
      );
      process.env.PORT = String(targetPort);
      process.env.HOST = host;
      process.env.NITRO_PORT = String(targetPort);
      process.env.NITRO_HOST = host;

      await import(serverPath);
      console.log(`[start.mjs] Nitro server successfully active on port ${targetPort}`);

      tryStartPort3000Forwarder(targetPort);
      return;
    } catch (err) {
      console.error("[start.mjs] Nitro server startup error, using fallback static server:", err);
    }
  } else {
    console.warn(`[start.mjs] Nitro server not found at ${serverPath}, starting static server...`);
  }

  // 2. Fallback to static server
  startStaticServer(targetPort, host);
  tryStartPort3000Forwarder(targetPort);
}

const handleShutdown = (signal) => {
  console.log(`[start.mjs] Received ${signal}, shutting down gracefully...`);
  process.exit(0);
};
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

main();
