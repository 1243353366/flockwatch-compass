/**
 * FlockWatch Compass Server v2
 *
 * RF OSINT correlation system. Corpora AI is the research layer,
 * FlockWatch is the evidence/detection layer. The LLM NEVER decides
 * a camera exists — it explains evidence.
 *
 * API:
 *   POST /api/research       — Run full research pipeline on observations
 *   POST /api/near-me        — "What's near me?" search by location
 *   GET  /api/coverage       — US coverage analysis
 *   GET  /api/request-token  — Get one-time request token
 *   GET  /health             — Health check
 */

import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, mkdir, readdir } from "node:fs/promises";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { runResearchAgent, whatsNearMe } from "./research-agent.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const REQUEST_TOKEN_TTL_MS = 10 * 60_000;
const DATA_DIR = join(ROOT, "data", "sessions");

mkdirSync(DATA_DIR, { recursive: true });

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
});

function securityHeaders(extra = {}) {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=self",  // Allow geolocation for "what's near me"
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "cross-origin-opener-policy": "same-origin",
    "content-security-policy": "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    ...extra,
  };
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, securityHeaders({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-request-id": res.requestId || "unavailable",
  }));
  res.end(JSON.stringify(data));
}

function getClientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket.remoteAddress || "unknown";
}

const hits = new Map();
const requestTokens = new Map();

function rateLimited(req) {
  const key = getClientIp(req);
  const now = Date.now();
  let record = hits.get(key);
  if (!record || now - record.startedAt > RATE_WINDOW_MS) record = { startedAt: now, count: 0 };
  record.count += 1;
  hits.set(key, record);
  if (hits.size > 5000) hits.clear();
  return record.count > RATE_LIMIT;
}

function issueToken() {
  const token = randomBytes(32).toString("hex");
  requestTokens.set(token, { issued: Date.now() });
  if (requestTokens.size > 1000) {
    const now = Date.now();
    for (const [k, v] of requestTokens) {
      if (now - v.issued > REQUEST_TOKEN_TTL_MS) requestTokens.delete(k);
    }
  }
  return token;
}

function validateToken(token) {
  if (!token) return false;
  const record = requestTokens.get(token);
  if (!record) return false;
  if (Date.now() - record.issued > REQUEST_TOKEN_TTL_MS) {
    requestTokens.delete(token);
    return false;
  }
  requestTokens.delete(token);
  return true;
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) { reject(new Error("Body too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function readBodyJson(req) {
  const body = await readBody(req);
  try { return JSON.parse(body); } catch { throw new Error("Invalid JSON"); }
}

// ─── Handlers ────────────────────────────────────────────────────────────────
async function handleResearch(req, res) {
  const body = await readBodyJson(req);
  const { observations, city, state, wantNarrative, skipPublicLookup } = body;

  if (!Array.isArray(observations)) {
    return sendJson(res, { error: "observations must be an array" }, 400);
  }

  const result = await runResearchAgent(observations, {
    city, state,
    wantNarrative: wantNarrative || false,
    skipPublicLookup: skipPublicLookup || false,
  });

  sendJson(res, result);
}

async function handleNearMe(req, res) {
  const body = await readBodyJson(req);
  const { lat, lon, radiusM, city, state, wantNarrative } = body;

  if (typeof lat !== "number" || typeof lon !== "number") {
    return sendJson(res, { error: "lat and lon are required as numbers" }, 400);
  }

  const result = await whatsNearMe(lat, lon, {
    radiusM: radiusM || 500,
    city, state,
    wantNarrative: wantNarrative || false,
  });

  sendJson(res, result);
}

async function handleCoverage(req, res) {
  const observations = [];
  const sessions = await readdir(DATA_DIR).catch(() => []);
  for (const session of sessions) {
    const scoredFile = join(DATA_DIR, session, "scored.jsonl");
    if (existsSync(scoredFile)) {
      const content = readFileSync(scoredFile, "utf-8");
      for (const line of content.split("\n")) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            observations.push(parsed.observation || parsed);
          } catch {}
        }
      }
    }
  }

  // Simple coverage analysis
  const US_BOUNDS = { minLat: 24.5, maxLat: 49.5, minLon: -125.0, maxLon: -66.5 };
  const gridSize = 2.0;
  const grid = {};
  for (const obs of observations) {
    if (!obs.location) continue;
    if (obs.location.lat < US_BOUNDS.minLat || obs.location.lat > US_BOUNDS.maxLat) continue;
    if (obs.location.lon < US_BOUNDS.minLon || obs.location.lon > US_BOUNDS.maxLon) continue;
    const key = `${Math.floor(obs.location.lat / gridSize)},${Math.floor(obs.location.lon / gridSize)}`;
    grid[key] = (grid[key] || 0) + 1;
  }

  const latCells = Math.ceil((US_BOUNDS.maxLat - US_BOUNDS.minLat) / gridSize);
  const lonCells = Math.ceil((US_BOUNDS.maxLon - US_BOUNDS.minLon) / gridSize);
  const totalCells = latCells * lonCells;
  const covered = Object.keys(grid).length;

  sendJson(res, {
    coverage: {
      total_grid_cells: totalCells,
      covered_cells: covered,
      coverage_percentage: Math.round((covered / totalCells) * 1000) / 10,
      gaps: totalCells - covered,
      note: "Coverage gaps mean no data collected — NOT confirmed absence of cameras.",
    },
    summary: {
      total_observations: observations.length,
      located: observations.filter(o => o.location).length,
    },
  });
}

// ─── Server ──────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  res.requestId = randomUUID();
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, securityHeaders());
    res.end();
    return;
  }

  if (rateLimited(req)) return sendJson(res, { error: "Rate limit exceeded" }, 429);

  if (pathname === "/health" && req.method === "GET") {
    return sendJson(res, {
      status: "ok",
      timestamp: new Date().toISOString(),
      python_available: existsSync(join(ROOT, "flockwatch_agent", "__init__.py")),
      ai_enabled: process.env.AI_MODE === "on",
    });
  }

  if (pathname === "/api/request-token" && req.method === "GET") {
    const token = issueToken();
    res.setHeader("Set-Cookie", `request_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600`);
    return sendJson(res, { token, expires_in: REQUEST_TOKEN_TTL_MS });
  }

  if (pathname.startsWith("/api/")) {
    const token = req.headers["x-request-token"];
    if (!validateToken(token)) return sendJson(res, { error: "Invalid or missing request token" }, 403);

    try {
      switch (pathname) {
        case "/api/research":
          if (req.method === "POST") return await handleResearch(req, res);
          break;
        case "/api/near-me":
          if (req.method === "POST") return await handleNearMe(req, res);
          break;
        case "/api/coverage":
          if (req.method === "GET") return await handleCoverage(req, res);
          break;
      }
      return sendJson(res, { error: "Endpoint not found" }, 404);
    } catch (error) {
      return sendJson(res, { error: error.message || error.error || "Internal error" }, 500);
    }
  }

  if (req.method === "GET") {
    // Clean URL handling: try exact file, then slug.html, then directory/index.html
    let filePath = join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
    let safePath = normalize(filePath);

    // If no extension, try .html fallback for clean URLs
    if (!extname(safePath) && safePath.startsWith(PUBLIC_DIR)) {
      const htmlPath = safePath + ".html";
      if (existsSync(htmlPath)) {
        safePath = htmlPath;
      } else {
        const indexPath = join(safePath, "index.html");
        if (existsSync(indexPath)) {
          safePath = indexPath;
        }
      }
    }

    if (!safePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }

    try {
      const content = await readFile(safePath);
      const ext = extname(safePath);
      res.writeHead(200, securityHeaders({
        "content-type": MIME_TYPES[ext] || "application/octet-stream",
        "cache-control": "public, max-age=300",
      }));
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`FlockWatch Compass — RF OSINT Research Agent`);
  console.log(`Server: http://${HOST}:${PORT}`);
  console.log(`Python agent: ${existsSync(join(ROOT, "flockwatch_agent", "__init__.py")) ? "available" : "not found"}`);
  console.log(`AI narrative: ${process.env.AI_MODE === "on" ? "enabled" : "disabled (reports work without AI)"}`);
});
