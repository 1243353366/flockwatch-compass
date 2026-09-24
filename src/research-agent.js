/**
 * FlockWatch Research Agent
 *
 * Corpora AI's role: ingest evidence observations, correlate with public data,
 * produce deterministic evidence reports. The LLM EXPLAINS, never DECIDES.
 *
 * Pipeline: Observation → normalize → cluster → public-source lookup →
 *           FCC hardware lookup → deterministic confidence → report →
 *           optional AI narrative (explanation only)
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const AGENT_DIR = path.join(ROOT, "flockwatch_agent");
const PYTHON = process.env.PYTHON || "python3";
const MAX_EXECUTION_MS = Number(process.env.AGENT_TIMEOUT_MS || 60_000);

// ─── Run Python research pipeline ─────────────────────────────────────────────
function runPythonPipeline(observations, options = {}) {
  return new Promise((resolve, reject) => {
    const sessionId = randomUUID();
    const sessionDir = path.join(ROOT, "data", "sessions", sessionId);
    mkdirSync(sessionDir, { recursive: true });

    const inputFile = path.join(sessionDir, "observations.json");
    const outputFile = path.join(sessionDir, "report.json");

    // Write observations
    writeFileSync(inputFile, JSON.stringify(observations));

    // Build Python script
    const script = `
import json, sys
sys.path.insert(0, "${ROOT}")
from flockwatch_agent.research_agent import normalize_flockwatch_observation, run_research_pipeline
from flockwatch_agent.scanner import generate_scan_config

observations = json.load(open("${inputFile}"))
evidence_obs = [normalize_flockwatch_observation(o) for o in observations]

report = run_research_pipeline(
    evidence_obs,
    city=${options.city ? `"${options.city}"` : "None"},
    state=${options.state ? `"${options.state}"` : "None"},
    skip_public_lookup=${options.skipPublicLookup ? "True" : "False"},
)

# Add AI narrative prompt if requested
ai_prompt = None
if ${options.wantNarrative ? "True" : "False"}:
    from flockwatch_agent.research_agent import generate_ai_narrative_prompt
    ai_prompt = generate_ai_narrative_prompt(report)

# Generate scan config for continued monitoring
scan_config = generate_scan_config(
    include_wifi=True,
    include_ble=True,
    include_ism=True,
    include_5ghz=False,
    duration_seconds=60,
)

result = {
    "report": json.loads(report.model_dump_json()),
    "report_text": report.to_text(),
    "ai_prompt": ai_prompt,
    "scan_config": scan_config,
    "session_id": "${sessionId}",
}
print(json.dumps(result, default=str))
`;

    execFile(PYTHON, ["-c", script], {
      cwd: ROOT,
      timeout: MAX_EXECUTION_MS,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, PYTHONPATH: ROOT },
    }, (error, stdout, stderr) => {
      if (error) {
        reject({
          error: error.message,
          stderr: stderr?.slice(0, 3000),
          stdout: stdout?.slice(0, 3000),
        });
      } else {
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError) {
          reject({ error: `Failed to parse pipeline output: ${parseError.message}`, stdout: stdout?.slice(0, 3000) });
        }
      }
    });
  });
}

// ─── AI narrative (optional, explanation only) ────────────────────────────────
async function generateAINarrative(report, prompt) {
  const AI_MODE = process.env.AI_MODE === "on";
  const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
  const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.openai.com/v1";
  const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
  const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 15_000);

  if (!AI_MODE || !AI_API_KEY || !prompt) {
    return null; // No AI — report is still complete without narrative
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: "You are an intelligence analyst explaining passive RF detection evidence. You EXPLAIN evidence — you never DECIDE whether a camera exists. Use phrases like 'the evidence suggests', 'consistent with', 'additional verification recommended'. Always note FCC records corroborate hardware, not physical location." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    const narrative = data.choices?.[0]?.message?.content;
    if (!narrative || narrative.trim().length < 50) return null;

    return narrative;
  } catch {
    return null;
  }
}

// ─── Main research agent entry point ──────────────────────────────────────────
async function runResearchAgent(observations, options = {}) {
  // Step 1-4: Run Python pipeline (deterministic)
  const result = await runPythonPipeline(observations, options);
  const report = result.report;
  const reportText = result.report_text;

  // Step 5: Optional AI narrative (explanation only)
  if (options.wantNarrative && result.ai_prompt) {
    const narrative = await generateAINarrative(report, result.ai_prompt);
    if (narrative) {
      report.ai_narrative = narrative;
      report.ai_generated = true;
    }
  }

  return {
    report,
    report_text: reportText,
    session_id: result.session_id,
    legal_notice: "Passive detection only. Confidence tier is deterministic — not AI-assessed. FCC records corroborate hardware, not physical location. All findings require lawful verification.",
  };
}

// ─── "What's near me?" search ─────────────────────────────────────────────────
async function whatsNearMe(lat, lon, options = {}) {
  /**
   * Takes a location and returns nearby evidence from all collected data.
   * This is the user-facing entry point: "What's near me?"
   */
  const { radiusM = 500 } = options;

  // Search through all session data for nearby observations
  const { readdir } = await import("node:fs/promises");
  const sessionsDir = path.join(ROOT, "data", "sessions");
  const sessions = await readdir(sessionsDir).catch(() => []);

  const nearby = [];
  for (const session of sessions) {
    const scoredFile = path.join(sessionsDir, session, "scored.jsonl");
    if (existsSync(scoredFile)) {
      const content = readFileSync(scoredFile, "utf-8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          const obs = JSON.parse(line);
          const fullObs = obs.observation || obs;
          if (fullObs.location) {
            const dist = haversine(lat, lon, fullObs.location.lat, fullObs.location.lon);
            if (dist <= radiusM) {
              nearby.push({ ...fullObs, distance_m: Math.round(dist) });
            }
          }
        } catch {}
      }
    }
  }

  // If we have nearby observations, run the research pipeline on them
  if (nearby.length > 0) {
    return await runResearchAgent(nearby, { ...options, skipPublicLookup: false });
  }

  return {
    message: `No observations found within ${radiusM}m of ${lat.toFixed(4)}, ${lon.toFixed(4)}`,
    nearby: [],
    suggestion: "No detection data has been collected in this area. This does NOT mean no cameras are present — only that no evidence has been gathered. Consider collecting Wi-Fi/BLE scans in this area.",
  };
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { runResearchAgent, whatsNearMe, haversine };
