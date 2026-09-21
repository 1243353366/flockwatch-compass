import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { methodologyCatalog, recommendProject } from "./recommendation-engine.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const PUBLIC_DIR = join(ROOT, "public");
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;
const hits = new Map();

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
});

function securityHeaders(extra = {}) {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    ...extra
  };
}

function sendJson(response, data, status = 200) {
  response.writeHead(status, securityHeaders({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  }));
  response.end(JSON.stringify(data));
}

function getClientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket.remoteAddress || "unknown";
}

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

async function readJsonBody(request) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    const error = new Error("Request body is too large.");
    error.code = "PAYLOAD_TOO_LARGE";
    throw error;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.code = "INVALID_JSON";
    throw error;
  }
}

function aiConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  const baseUrl = (process.env.AI_BASE_URL || process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const enabled = process.env.AI_MODE === "on" && Boolean(apiKey);
  return { enabled, apiKey, baseUrl, model };
}

function parseAiJson(value) {
  if (typeof value !== "string") return null;
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1] : value;
  const match = source.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      executiveSummary: typeof parsed.executiveSummary === "string" ? parsed.executiveSummary.slice(0, 900) : "",
      tradeoffNarrative: typeof parsed.tradeoffNarrative === "string" ? parsed.tradeoffNarrative.slice(0, 1200) : "",
      validationQuestions: Array.isArray(parsed.validationQuestions) ? parsed.validationQuestions.map(String).slice(0, 4) : []
    };
  } catch {
    return null;
  }
}

async function addAiPerspective(input, baseline) {
  const config = aiConfig();
  if (!config.enabled) return { mode: "transparent-model", provider: null, perspective: null };

  const systemPrompt = [
    "You are a project-delivery decision-support analyst.",
    "The transparent scoring engine has already selected a primary methodology. Do not replace it or present it as objective truth.",
    "Explain the recommendation using only the supplied project facts and baseline output.",
    "Name tradeoffs and unknowns. Never promise savings or project success.",
    "Return JSON only with keys executiveSummary, tradeoffNarrative, validationQuestions.",
    "executiveSummary must be at most 110 words. tradeoffNarrative must be at most 150 words. validationQuestions must contain 2 to 4 concise questions."
  ].join(" ");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ projectInput: input, baselineRecommendation: baseline }) }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) return { mode: "transparent-model", provider: null, perspective: null };
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || payload?.response || "";
    const perspective = parseAiJson(content);
    return perspective
      ? { mode: "ai-assisted", provider: { model: config.model }, perspective }
      : { mode: "transparent-model", provider: null, perspective: null };
  } catch {
    return { mode: "transparent-model", provider: null, perspective: null };
  } finally {
    clearTimeout(timeout);
  }
}

async function handleRecommendation(request, response) {
  if (rateLimited(request)) {
    sendJson(response, { error: "Too many recommendation requests. Please wait one minute and try again." }, 429);
    return;
  }

  let input;
  try {
    input = await readJsonBody(request);
    const baseline = recommendProject(input);
    const ai = await addAiPerspective(input, baseline);
    sendJson(response, { ok: true, mode: ai.mode, ai: ai.provider, perspective: ai.perspective, ...baseline });
  } catch (error) {
    if (error.code === "VALIDATION_ERROR") {
      sendJson(response, { error: error.message, fields: error.fields }, 422);
      return;
    }
    if (error.code === "PAYLOAD_TOO_LARGE") {
      sendJson(response, { error: error.message }, 413);
      return;
    }
    if (error.code === "INVALID_JSON") {
      sendJson(response, { error: error.message }, 400);
      return;
    }
    sendJson(response, { error: "The recommendation could not be completed. Please review the inputs and try again." }, 500);
  }
}

async function serveStatic(pathname, response) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return false;

  try {
    const body = await readFile(filePath);
    response.writeHead(200, securityHeaders({
      "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
      "cache-control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=300"
    }));
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

export async function requestListener(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/health") {
    const config = aiConfig();
    sendJson(response, {
      ok: true,
      service: "project-compass",
      runtime: "self-hosted-node",
      recommendationEngine: "transparent-model-v1",
      aiAssist: { configured: config.enabled, model: config.enabled ? config.model : null },
      storage: "stateless"
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/methodologies") {
    sendJson(response, { ok: true, methodologies: methodologyCatalog() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/recommend") {
    await handleRecommendation(request, response);
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    if (await serveStatic(url.pathname, response)) return;
  }

  sendJson(response, { error: "Not found" }, 404);
}

export function startServer({ port = PORT, host = HOST } = {}) {
  const server = createServer(requestListener);
  server.listen(port, host, () => {
    const config = aiConfig();
    console.log(`Project Compass is available at http://${host}:${port}`);
    console.log(`Recommendation mode: ${config.enabled ? `AI-assisted (${config.model})` : "transparent scoring model"}`);
  });
  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) startServer();
