/**
 * FlockWatch Compass Server
 *
 * Combines Project Compass's server architecture with FlockWatch's detection
 * engine and an agentic AI reasoning layer.
 */

import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgentAnalysis } from "./flock-agent-engine.js";
import { generateNarrative } from "./ai-narrative.js";
import { ingestFile, scoreObservations, listSignatures } from "./flockwatch-runner.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const REQUEST_TOKEN_TTL_MS = 10 * 60_000;
const MAX_CONCURRENT_ANALYSES = 4;
const DATA_DIR = join(ROOT, "data", "sessions");

await mkdir(DATA_DIR, { recursive: true }).catch(() => {});

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
});

function securityHeaders(extra = {}) {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
    "x-dns-prefetch-control": "off",
    "content-security-policy": "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    ...extra,
  };
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, securityHeaders({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-request-id": response.requestId || "unavailable",
  }));
  response.end(JSON.stringify(data));
}

function getClientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

const hits = new Map();
const requestTokens = new Map();
let activeAnalyses = 0;

function rateLimited(request) {
  const key = getClientIp(request);
  const now = Date.now();
  let record = hits.get(key);
  if (!record || now - record.startedAt > RATE_WINDOW_MS) record = { startedAt: now, count: 0 };
  record.count += 1;
  hits.set(key, record);
  if (hits.size > 5_000) hits.clear();
  return record.count > RATE_LIMIT;
}

function issueToken() {
  const token = randomBytes(32).toString("hex");
  requestTokens.set(token, { issued: Date.now() });
  if (requestTokens.size > 1000) {
    const now = Date.now();
    for (const [key, val] of requestTokens) {
      if (now - val.issued > REQUEST_TOKEN_TTL_MS) requestTokens.delete(key);
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

function readBody(request, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    request.on("data", (chunk) => {
      total += chunk.length;
      if (total > maxBytes) { reject(new Error("Request body too large")); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    request.on("error", reject);
  });
}

async function readBodyJson(request) {
  const body = await readBody(request);
  try { return JSON.parse(body); } catch { throw new Error("Invalid JSON body"); }
}

async function handleAnalyze(request, response) {
  if (activeAnalyses >= MAX_CONCURRENT_ANALYSES) {
    return sendJson(response, { error: "Too many concurrent analyses. Please retry." }, 503);
  }
  activeAnalyses++;
  try {
    const body = await readBodyJson(request);
    const { observations, threshold, maxResults, includeCoverageGaps, generateNarrative: wantNarrative } = body;

    if (!Array.isArray(observations)) return sendJson(response, { error: "observations must be an array" }, 400);

    const analysis = runAgentAnalysis(observations, {
      threshold: threshold || 0.3,
      maxResults: maxResults || 50,
      includeCoverageGaps: includeCoverageGaps !== false,
    });

    if (wantNarrative) {
      analysis.narrative = await generateNarrative(analysis);
    }

    sendJson(response, analysis);
  } catch (error) {
    sendJson(response, { error: error.message }, 500);
  } finally {
    activeAnalyses--;
  }
}

async function handleIngest(request, response) {
  try {
    const body = await readBodyJson(request);
    const { type, file_path, session_id } = body;
    if (!type || !file_path) return sendJson(response, { error: "type and file_path are required" }, 400);

    const sessionId = session_id || randomUUID();
    const sessionDir = join(DATA_DIR, sessionId);
    await mkdir(sessionDir, { recursive: true });
    const outputFile = join(sessionDir, "observations.jsonl");

    const result = await ingestFile(type, file_path, { output: outputFile, append: existsSync(outputFile) });
    sendJson(response, { ...result, session_id: sessionId });
  } catch (error) {
    sendJson(response, { error: error.message }, 500);
  }
}

async function handleScore(request, response) {
  try {
    const body = await readBodyJson(request);
    const { session_id, threshold } = body;
    if (!session_id) return sendJson(response, { error: "session_id is required" }, 400);

    const inputFile = join(DATA_DIR, session_id, "observations.jsonl");
    const outputFile = join(DATA_DIR, session_id, "scored.jsonl");
    if (!existsSync(inputFile)) return sendJson(response, { error: "No observations found for session" }, 404);

    const observations = await scoreObservations(inputFile, outputFile, threshold || 0.5);
    sendJson(response, { session_id, total_observations: observations.length, scored_file: outputFile });
  } catch (error) {
    sendJson(response, { error: error.message }, 500);
  }
}

async function handleCoverage(request, response) {
  try {
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
    const analysis = runAgentAnalysis(observations, { includeCoverageGaps: true });
    sendJson(response, { coverage: analysis.coverage, summary: analysis.summary });
  } catch (error) {
    sendJson(response, { error: error.message }, 500);
  }
}

async function handleSignatures(request, response) {
  try {
    const output = await listSignatures();
    sendJson(response, { signatures: output });
  } catch (error) {
    sendJson(response, { error: "Python FlockWatch engine not available", detail: error.message }, 500);
  }
}

const server = createServer(async (request, response) => {
  response.requestId = randomUUID();
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  if (request.method === "OPTIONS") {
    response.writeHead(204, securityHeaders());
    response.end();
    return;
  }

  if (rateLimited(request)) return sendJson(response, { error: "Rate limit exceeded" }, 429);

  if (pathname === "/health" && request.method === "GET") {
    return sendJson(response, {
      status: "ok",
      timestamp: new Date().toISOString(),
      active_analyses: activeAnalyses,
      python_available: existsSync(join(ROOT, "vendor", "flockwatch", "flockwatch")),
      ai_enabled: process.env.AI_MODE === "on",
    });
  }

  if (pathname === "/api/request-token" && request.method === "GET") {
    const token = issueToken();
    response.setHeader("Set-Cookie", `request_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=600`);
    return sendJson(response, { token, expires_in: REQUEST_TOKEN_TTL_MS });
  }

  if (pathname.startsWith("/api/")) {
    const token = request.headers["x-request-token"];
    if (!validateToken(token)) return sendJson(response, { error: "Invalid or missing request token" }, 403);

    try {
      switch (pathname) {
        case "/api/analyze":
          if (request.method === "POST") return await handleAnalyze(request, response);
          break;
        case "/api/ingest":
          if (request.method === "POST") return await handleIngest(request, response);
          break;
        case "/api/score":
          if (request.method === "POST") return await handleScore(request, response);
          break;
        case "/api/coverage":
          if (request.method === "GET") return await handleCoverage(request, response);
          break;
        case "/api/signatures":
          if (request.method === "GET") return await handleSignatures(request, response);
          break;
      }
      return sendJson(response, { error: "Endpoint not found" }, 404);
    } catch (error) {
      return sendJson(response, { error: error.message }, 500);
    }
  }

  if (request.method === "GET") {
    const filePath = join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
    const safePath = normalize(filePath);
    if (!safePath.startsWith(PUBLIC_DIR)) { response.writeHead(403); response.end("Forbidden"); return; }

    try {
      const content = await readFile(safePath);
      const ext = extname(safePath);
      response.writeHead(200, securityHeaders({
        "content-type": MIME_TYPES[ext] || "application/octet-stream",
        "cache-control": "public, max-age=300",
      }));
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

server.listen(PORT, HOST, () => {
  console.log(`FlockWatch Compass server running at http://${HOST}:${PORT}`);
  console.log(`AI narrative: ${process.env.AI_MODE === "on" ? "enabled" : "disabled (deterministic fallback)"}`);
});
