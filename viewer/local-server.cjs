const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4174);
const BACKEND = new URL(process.env.ASSETOPS_BACKEND_URL || "http://127.0.0.1:3001");
const ROOT = __dirname;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
};

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
  );
}

function send(res, code, body, contentType = "text/plain; charset=utf-8") {
  securityHeaders(res);
  res.statusCode = code;
  res.setHeader("Content-Type", contentType);
  res.end(body);
}

function proxyPublicApi(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) {
    return send(res, 405, JSON.stringify({ message: "Read-only viewer: method not allowed" }), "application/json; charset=utf-8");
  }

  const target = new URL(req.url, BACKEND);

  if (!target.pathname.startsWith("/api/public/")) {
    return send(res, 404, "Not found");
  }

  const proxyReq = http.request(
    {
      hostname: BACKEND.hostname,
      port: BACKEND.port || 80,
      method: req.method,
      path: target.pathname + target.search,
      headers: {
        Accept: req.headers.accept || "application/json",
      },
    },
    (proxyRes) => {
      securityHeaders(res);
      res.statusCode = proxyRes.statusCode || 502;
      res.setHeader("Content-Type", proxyRes.headers["content-type"] || "application/json; charset=utf-8");
      proxyRes.pipe(res);
    }
  );

  proxyReq.on("error", (error) => {
    send(
      res,
      502,
      JSON.stringify({
        message: "Public API unavailable",
        detail: error.message,
      }),
      "application/json; charset=utf-8"
    );
  });

  proxyReq.end();
}

function serveStatic(req, res) {
  if (!["GET", "HEAD"].includes(req.method)) {
    return send(res, 405, "Method not allowed");
  }

  const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(parsed.pathname);

  if (pathname === "/") pathname = "/index.html";

  const requestedPath = path.resolve(ROOT, "." + pathname);
  const relative = path.relative(ROOT, requestedPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return send(res, 403, "Forbidden");
  }

  fs.stat(requestedPath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      return send(res, 404, "Not found");
    }

    const ext = path.extname(requestedPath).toLowerCase();
    securityHeaders(res);
    res.statusCode = 200;
    res.setHeader("Content-Type", mime[ext] || "application/octet-stream");

    if (req.method === "HEAD") return res.end();

    fs.createReadStream(requestedPath)
      .on("error", () => send(res, 500, "File read error"))
      .pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith("/api/public/")) {
    return proxyPublicApi(req, res);
  }

  return serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("AssetOps Public Viewer - LOCAL DEMO");
  console.log(`Viewer:  http://${HOST}:${PORT}`);
  console.log(`Backend: ${BACKEND.origin}`);
  console.log("Mode:    READ ONLY");
  console.log("");
});
