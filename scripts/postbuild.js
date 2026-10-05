import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const outputPublicDir = path.join(rootDir, ".output", "public");
const distClientDir = path.join(distDir, "client");

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  console.log("[postbuild] Starting post-build processing...");

  // 1. Ensure dist directory exists
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 2. Copy public directory to dist
  const publicDir = path.join(rootDir, "public");
  if (fs.existsSync(publicDir)) {
    console.log("[postbuild] Copying public to dist...");
    copyDirRecursive(publicDir, distDir);
  }

  // 3. Copy .output/public to dist
  if (fs.existsSync(outputPublicDir)) {
    console.log("[postbuild] Copying .output/public to dist...");
    copyDirRecursive(outputPublicDir, distDir);
  }

  // 4. Copy dist/client into dist
  if (fs.existsSync(distClientDir)) {
    console.log("[postbuild] Copying dist/client to dist...");
    copyDirRecursive(distClientDir, distDir);
  }

  // 4. Prerender root page to produce a functional dist/index.html
  const testPort = 4059;
  const serverPath = path.join(rootDir, ".output", "server", "index.mjs");

  let renderedHtml = null;

  if (fs.existsSync(serverPath)) {
    console.log("[postbuild] Attempting SSR prerender for / on port " + testPort + "...");
    try {
      process.env.PORT = String(testPort);
      process.env.HOST = "127.0.0.1";
      process.env.NITRO_HOST = "127.0.0.1";
      delete process.env.NODE_ENV;

      await import(serverPath);

      // Poll until server is responding (up to 5 seconds)
      for (let attempt = 1; attempt <= 15; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        try {
          const res = await fetch(`http://127.0.0.1:${testPort}/`);
          if (res.status === 200) {
            renderedHtml = await res.text();
            console.log(
              `[postbuild] Successfully prerendered index.html (${renderedHtml.length} bytes)`,
            );
            break;
          }
        } catch {
          // Retry until timeout
        }
      }
    } catch (err) {
      console.warn("[postbuild] Warning: SSR prerender failed:", err.message);
    }
  }

  if (!renderedHtml) {
    // Fallback: look for latest index-*.js and styles-*.css
    console.log("[postbuild] Using fallback index.html template...");
    let entryJs = "";
    let entryCss = "";

    const candidateAssetDirs = [
      path.join(distDir, "assets"),
      path.join(outputPublicDir, "assets"),
      path.join(distClientDir, "assets"),
    ];

    for (const assetsDir of candidateAssetDirs) {
      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        const jsFiles = files
          .filter((f) => f.startsWith("index-") && f.endsWith(".js"))
          .map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(assetsDir, f)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime);

        const cssFiles = files
          .filter((f) => f.startsWith("styles-") && f.endsWith(".css"))
          .map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(assetsDir, f)).mtimeMs,
          }))
          .sort((a, b) => b.mtime - a.mtime);

        if (jsFiles.length > 0 && !entryJs) {
          entryJs = `<script type="module" src="/assets/${jsFiles[0].name}"></script>`;
        }
        if (cssFiles.length > 0 && !entryCss) {
          entryCss = `<link rel="stylesheet" href="/assets/${cssFiles[0].name}">`;
        }
      }
    }

    renderedHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>إيهاب ستور</title>
  <link rel="manifest" href="/manifest.json"/>
  ${entryCss}
</head>
<body>
  <div id="root"></div>
  ${entryJs}
</body>
</html>`;
  }

  fs.writeFileSync(path.join(distDir, "index.html"), renderedHtml, "utf-8");
  if (fs.existsSync(outputPublicDir)) {
    fs.writeFileSync(path.join(outputPublicDir, "index.html"), renderedHtml, "utf-8");
  }

  console.log(
    "[postbuild] Completed successfully. dist/ contains",
    fs.readdirSync(distDir).length,
    "entries.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[postbuild] Fatal error:", err);
  process.exit(1);
});
