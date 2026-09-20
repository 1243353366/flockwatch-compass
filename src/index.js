/* Corpora AI — text intelligence worker for Aadi's Digital Lab.
   Pure JS, no dependencies. Serves a dark-mode-first single page,
   an analysis API backed by Workers AI + an algorithmic pass,
   with CSP-clean external CSS/JS, a 32KB cap, and rate limiting. */

const AI_MODEL = "@cf/openai/gpt-oss-20b";
const MAX_BYTES = 32768;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60000;
const hits = new Map(); /* best-effort per-isolate rate limiting */

/* ---------- helpers ---------- */

function secHeaders(extra = {}) {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy": "default-src 'self'; img-src 'self' data:; connect-src 'self'",
    ...extra,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: secHeaders({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }),
  });
}

function asset(body, type) {
  return new Response(body, {
    headers: secHeaders({ "content-type": type, "cache-control": "public, max-age=300" }),
  });
}

/* ---------- algorithmic analysis ---------- */

const STOPWORDS = new Set(("a the and or but if then of to in on for with as by at from is are was were be been " +
  "being it its this that these those i you he she we they them his her their our your my me us not no so do does " +
  "did have has had will would can could should may might must about into over after before between out up down " +
  "all any both each few more most other some such only own same than too very just also now when where why how " +
  "what which who whom because while until again there here").split(" "));

function syllables(w) {
  const m = w.toLowerCase().replace(/[^a-z]/g, "").match(/[aeiouy]+/g);
  return Math.max(1, m ? m.length : 1);
}

function analyzeText(text) {
  const words = text.toLowerCase().match(/[a-z][a-z'-]{1,}/g) || [];
  const sentences = (text.match(/[.!?]+(\s|$)/g) || []).length || 1;
  const totalSyl = words.reduce((n, w) => n + syllables(w), 0);
  const freq = new Map();
  for (const w of words) if (!STOPWORDS.has(w) && w.length > 2) freq.set(w, (freq.get(w) || 0) + 1);
  const keywords = Array.from(freq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([term, count]) => ({ term, count, share: +(count / Math.max(1, words.length)).toFixed(4) }));
  const readability = words.length
    ? +(206.835 - 1.015 * (words.length / sentences) - 84.6 * (totalSyl / words.length)).toFixed(1)
    : null;
  return {
    stats: {
      characters: text.length,
      words: words.length,
      uniqueWords: new Set(words).size,
      sentences,
      readingTimeMin: Math.max(1, Math.round(words.length / 220)),
    },
    keywords,
    readability,
  };
}

function skepticReview(text, algo, ai) {
  const lower = text.toLowerCase();
  const contradictionMarkers = ["however", "but", "although", "contradict", "conflict", "dispute", "unknown", "unconfirmed"];
  const markers = contradictionMarkers.filter((marker) => lower.includes(marker));
  const explicitUncertainty = markers.some((marker) => ["unknown", "unconfirmed", "dispute", "conflict"].includes(marker));
  const claims = ai && ai.summary ? [ai.summary] : (algo.keywords || []).slice(0, 3).map((item) => item.term);
  return {
    status: explicitUncertainty ? "conflicting_or_uncertain" : "review_required",
    hypothesis: claims.length ? "The available text supports a preliminary observation, not a verified causal or attribution claim." : "No supported hypothesis can be formed from the available text.",
    alternativeHypothesis: "The observed pattern may reflect benign, shared, delayed, or independently caused activity rather than the leading interpretation.",
    contradictionSignals: markers,
    missingEvidence: ["primary telemetry", "independent corroboration", "observed and collected timestamps"],
    negativeEvidenceGuard: "not_observed_is_not_observed_absence",
    nextQuestion: "What independent evidence would distinguish the leading hypothesis from the alternative?",
  };
}

/* ---------- Workers AI pass ---------- */

async function aiAnalyze(env, text, onErr) {
  if (!env.AI) { (onErr || (()=>{}))("no-AI-binding"); return null; }
  const sys = "You are a research analyst. Analyze the user's text corpus. Respond with ONLY minified JSON, no prose, no code fences: " +
    '{"summary": "one summary of at most 60 words", "entities": [{"name": "string", "type": "person|org|place|date|tech|other"}], ' +
    '"topics": ["3-6 short topic phrases"], "sentiment": "positive|neutral|negative"}';
  try {
    const res = await Promise.race([
      env.AI.run(AI_MODEL, { messages: [{ role: "system", content: sys }, { role: "user", content: text.slice(0, 6000) }], max_tokens: 2048 }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("ai-timeout")), 20000)),
    ]);
    /* models answer as plain text, { response }, or OpenAI chat shape;
       reasoning models put final text in content and thinking in reasoning_content */
    const msg = res && res.choices && res.choices[0] && res.choices[0].message;
    const raw = typeof res === "string" ? res
      : (msg && msg.content) || (msg && msg.reasoning_content) || (res && res.response) || "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : null,
      entities: Array.isArray(parsed.entities) ? parsed.entities.slice(0, 15) : [],
      topics: Array.isArray(parsed.topics) ? parsed.topics.slice(0, 8).map(String) : [],
      sentiment: ["positive", "neutral", "negative"].includes(parsed.sentiment) ? parsed.sentiment : "neutral",
    };
  } catch (e) { (onErr || (()=>{}))(String(e && e.message || e).slice(0, 160)); return null; }
}

/* ---------- request handling ---------- */

function rateLimited(ip) {
  const now = Date.now();
  let a = hits.get(ip);
  if (!a || now - a.start > RATE_WINDOW_MS) a = { start: now, n: 0 };
  a.n++;
  hits.set(ip, a);
  if (hits.size > 5000) hits.clear(); /* crude memory bound */
  return a.n > RATE_LIMIT;
}

async function handleAnalyze(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (rateLimited(ip)) return json({ error: "Rate limit: 10 analyses per minute." }, 429);
  const len = +request.headers.get("content-length") || 0;
  if (len > MAX_BYTES) return json({ error: "Corpus too large: 32KB max." }, 413);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return json({ error: "Field 'text' is required." }, 400);
  if (text.length > MAX_BYTES) return json({ error: "Corpus too large: 32KB max." }, 413);
  const algo = analyzeText(text);
  const ai = await aiAnalyze(env, text);
  const skeptic = skepticReview(text, algo, ai);
  const result = { ok: true, mode: ai ? "ai+algorithmic" : "algorithmic", ...algo, ai, skeptic };
  if (body.persist === true) result.runId = await persistAnalysis(env, result, text.length);
  return json(result);
}

function aiDb(env) { return env.AI_DB || env.DB; }

async function persistAnalysis(env, result, inputChars) {
  const db = aiDb(env);
  if (!db) return null;
  if (!(await encryptionKey(env))) return null;
  const requestId = crypto.randomUUID();
  const accessToken = crypto.randomUUID() + "-" + crypto.randomUUID();
  const output = JSON.stringify({ summary: result.ai && result.ai.summary, topics: result.ai && result.ai.topics || [], entities: result.ai && result.ai.entities || [], algorithmic: result.stats, skeptic: result.skeptic });
  try {
    const encryptedOutput = await encryptForStorage(env, output);
    if (!encryptedOutput) return null;
    const encryptedClaim = result.ai && result.ai.summary ? await encryptForStorage(env, JSON.stringify({ claim: result.ai.summary.slice(0, 1200), evidence: result.ai.entities || [] })) : null;
    if (result.ai && result.ai.summary && !encryptedClaim) return null;
    const inserted = await db.prepare("INSERT INTO ai_runs (request_id, mode, model, input_chars, output_json, confidence) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(requestId, result.mode, result.ai ? AI_MODEL : "algorithmic", inputChars, encryptedOutput, result.ai ? 0.5 : null).run();
    const runId = inserted.meta && inserted.meta.last_row_id;
    if (!runId) return null;
    const followUp = [db.prepare("INSERT INTO ai_run_access (run_id, token_hash) VALUES (?, ?)").bind(runId, await sha256Hex(accessToken))];
    if (runId && result.ai && result.ai.summary && encryptedClaim) {
      followUp.push(db.prepare("INSERT INTO ai_claims (run_id, claim, claim_type, evidence_json, confidence, verification_status) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(runId, "Encrypted analysis claim; decrypt through an authorized dashboard path.", "encrypted-summary", encryptedClaim, 0.5, "unverified"));
    }
    await db.batch(followUp);
    return { runId, accessToken };
  } catch { return null; }
}

/* ---------- corpora intelligence index (shared D1: blog_db) ---------- */

async function handleIngest(request, env) {
  const token = env.INGEST_TOKEN;
  if (!token) return json({ error: "Ingestion is not configured on this worker." }, 503);
  const auth = request.headers.get("Authorization") || "";
  if (auth !== "Bearer " + token) return json({ error: "Unauthorized." }, 401);
  if (!env.DB) return json({ error: "Corpora database not bound." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const records = Array.isArray(body) ? body : [body];
  if (records.length < 1 || records.length > 50) return json({ error: "Send 1 to 50 records." }, 400);
  const stmts = [];
  for (const r of records) {
    const source = typeof r.source === "string" ? r.source.trim().slice(0, 64) : "";
    const title = typeof r.title === "string" ? r.title.trim().slice(0, 200) : "";
    const text = typeof r.body === "string" ? r.body.slice(0, MAX_BYTES) : "";
    const keywords = Array.isArray(r.keywords) ? r.keywords.join(", ").slice(0, 300)
      : typeof r.keywords === "string" ? r.keywords.slice(0, 300) : "";
    if (!source || !title || !text.trim()) return json({ error: "Each record needs source, title and body." }, 400);
    stmts.push(env.DB.prepare("INSERT INTO corpora (source, title, body, keywords) VALUES (?, ?, ?, ?)")
      .bind(source, title, text, keywords));
  }
  try { await env.DB.batch(stmts); } catch { return json({ error: "Insert failed. Was the corpora table created?" }, 500); }
  return json({ ok: true, ingested: stmts.length });
}

async function handleCorporaSearch(request, env) {
  if (!env.DB) return json({ error: "Corpora database not bound." }, 503);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (rateLimited("search:" + ip)) return json({ error: "Rate limit: 10 searches per minute." }, 429);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 200);
  if (!q) return json({ error: "Parameter 'q' is required." }, 400);
  /* simple keyword matching: each term OR-matches title, body or keywords */
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5)
    .map((t) => t.replace(/[\\%_]/g, (c) => "\\" + c));
  const where = terms.map(() => "(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR keywords LIKE ? ESCAPE '\\')").join(" OR ");
  const params = [];
  for (const t of terms) params.push("%" + t + "%", "%" + t + "%", "%" + t + "%");
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, source, title, substr(body, 1, 240) AS snippet, substr(body, 1, 1600) AS content, keywords, created_at
       FROM corpora WHERE ${where} ORDER BY created_at DESC, id DESC LIMIT 20`
    ).bind(...params).all();
    return json({ ok: true, q, count: results.length, results });
  } catch {
    return json({ error: "Query failed. Was the corpora table created?" }, 500);
  }
}

const KNOWLEDGE_SEEDS = [
  { name: "MITRE ATT&CK", url: "https://attack.mitre.org/", category: "behavior vocabulary", creator: "The MITRE Corporation / @mitre-attack", content: "MITRE ATT&CK is a knowledge base for adversary tactics and techniques. Map only behaviors supported by evidence; observing one technique does not establish a complete attack chain." },
  { name: "NIST SP 800-61", url: "https://csrc.nist.gov/pubs/sp/800/61/r2/final", category: "incident response", creator: "NIST / @NIST", content: "Incident response guidance organizes preparation, detection and analysis, containment, eradication and recovery, and post-incident activity. Preserve evidence and record decisions throughout the lifecycle." },
  { name: "NIST SP 800-115", url: "https://csrc.nist.gov/pubs/sp/800/115/final", category: "security testing", creator: "NIST / @NIST", content: "Technical security testing requires planning, authorization, defined scope, controlled execution, evidence collection, and reporting. Testing must not silently expand outside approved scope." },
  { name: "CISA KEV Catalog", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", category: "vulnerability intelligence", creator: "CISA / @CISA", content: "The Known Exploited Vulnerabilities Catalog supports remediation prioritization. Catalog membership is not proof that a specific local asset is compromised." },
  { name: "MalwareBazaar", url: "https://bazaar.abuse.ch/", category: "malware intelligence", creator: "abuse.ch", content: "MalwareBazaar provides sample metadata and indicators. This deployment stores reference content only and does not download or execute samples." },
  { name: "ThreatFox", url: "https://threatfox.abuse.ch/", category: "indicator intelligence", creator: "abuse.ch", content: "ThreatFox provides indicator relationships and sightings. Indicators remain hypotheses until corroborated with local telemetry and timestamps." },
  { name: "URLhaus", url: "https://urlhaus.abuse.ch/", category: "malicious URL intelligence", creator: "abuse.ch", content: "URLhaus provides malicious URL metadata. Retrieval is read-only and does not contact or fetch listed URLs." },
];
const LOCAL_EDR_SEEN = new Set();
const EDR_HEALTH = { collector: "unknown", visibility: "unknown", lastTelemetryAt: null, lastHeartbeatAt: null, received: 0, processed: 0, rejected: 0, duplicated: 0, dropped: 0, timestampErrors: 0, authenticationFailures: 0, lastError: null };

async function handleKnowledgeRetrieve(request, env) {
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 160).toLowerCase();
  if (!q) return json({ error: "Parameter 'q' is required." }, 400);
  const db = aiDb(env);
  if (db) {
    try {
      const like = `%${q}%`;
      const { results } = await db.prepare("SELECT source_name AS name, source_url AS url, category, creator, content, content_hash, observed_at FROM ai_knowledge_documents WHERE lower(source_name) LIKE ? OR lower(category) LIKE ? OR lower(content) LIKE ? ORDER BY observed_at DESC LIMIT 10").bind(like, like, like).all();
      return json({ ok: true, mode: "d1", query: q, count: results.length, results });
    } catch { /* use embedded seeds as a safe fallback */ }
  }
  const results = KNOWLEDGE_SEEDS.filter((item) => `${item.name} ${item.category} ${item.content}`.toLowerCase().includes(q)).map((item) => ({ ...item, content_hash: "embedded-seed", observed_at: null }));
  return json({ ok: true, mode: "embedded-seed", query: q, count: results.length, results });
}

function detectEdrEvent(event) {
  const command = event.commandLine.toLowerCase();
  const process = event.processName.toLowerCase();
  const suspicious = ["powershell", "rundll32", "regsvr32", "mshta", "wscript", "cscript"].some((name) => process.includes(name) || command.includes(name));
  const simulatedBeacon = event.collector === "simulated-c2" && event.eventType.includes("beacon") && event.destinationPort === 443;
  const ruleId = simulatedBeacon ? "EDR-SIM-001-beacon-pattern" : suspicious ? "EDR-SYNTH-001-suspicious-script-interpreter" : "EDR-SYNTH-000-no-match";
  const detected = simulatedBeacon || suspicious;
  return { ruleId, ruleVersion: "1", severity: detected ? "medium" : "informational", confidence: simulatedBeacon ? 0.82 : suspicious ? 0.78 : 0.1, status: detected ? "detected" : "no-threat-observed", rationale: simulatedBeacon ? "Synthetic beacon-like timing and destination metadata matched a bounded C2-simulation rule; this is not evidence of a real compromise." : suspicious ? "A synthetic script-interpreter event matched a bounded defensive rule; validate parent process, command line, and user context before action." : "No bounded synthetic rule matched this event; this is not proof that no threat exists.", falsePositiveNotes: "Periodic application traffic, monitoring, updates, and administrative automation can resemble this pattern.", requiredTelemetry: ["process_name", "parent_process", "command_line", "observed_at", "host_id"] };
}

async function rejectEdr(env, raw, reason) {
  const rejectionId = "rejection-" + crypto.randomUUID();
  const db = aiDb(env);
  if (db) {
    try { await db.prepare("INSERT INTO edr_rejections (rejection_id, reason, event_hash, event_version) VALUES (?, ?, ?, ?)").bind(rejectionId, reason, await sha256(JSON.stringify(raw || {})), String(raw && raw.eventVersion || "unknown").slice(0, 40)).run(); } catch { /* preserve the response even if quarantine storage is unavailable */ }
  }
  return { rejectionId, reason, logged: Boolean(db) };
}

async function handleEdrEvents(request, env, options = {}) {
  const body = await request.json().catch(() => null);
  const events = Array.isArray(body) ? body : body && Array.isArray(body.events) ? body.events : body ? [body] : [];
  if (!events.length || events.length > 50) return json({ error: "Send 1 to 50 synthetic EDR events.", state: "REJECTED" }, 400);
  const normalized = [];
  const seen = new Set();
  EDR_HEALTH.received += events.length;
  if (options.allowAuthorizedLocal) {
    EDR_HEALTH.collector = options.collector || "authorized-local";
    EDR_HEALTH.visibility = options.visibility || "container-local";
    EDR_HEALTH.lastTelemetryAt = new Date().toISOString();
  }
  for (const raw of events) {
    if (!raw || (raw.synthetic !== true && options.allowAuthorizedLocal !== true)) { EDR_HEALTH.rejected++; return json({ error: "Only synthetic EDR fixtures are accepted by this endpoint.", state: "REJECTED", rejection: await rejectEdr(env, raw, "synthetic flag is required") }, 403); }
    if (raw.eventVersion !== "edr.process.v1" && raw.eventVersion !== "edr.network.v1" && raw.eventVersion !== "edr.file.v1" && raw.eventVersion !== "edr.identity.v1") { EDR_HEALTH.rejected++; return json({ error: "Unsupported eventVersion.", state: "REJECTED", rejection: await rejectEdr(env, raw, "unsupported event version") }, 400); }
    if (!raw.eventId || !raw.eventType || !raw.hostId || !raw.observedAt) { EDR_HEALTH.rejected++; return json({ error: "eventId, eventType, hostId, and observedAt are required.", state: "REJECTED", rejection: await rejectEdr(env, raw, "required field missing") }, 400); }
    const expectedType = raw.eventVersion.split(".")[1];
    if (!String(raw.eventType).toLowerCase().startsWith(expectedType)) { EDR_HEALTH.rejected++; return json({ error: "eventType does not match eventVersion.", state: "REJECTED", rejection: await rejectEdr(env, raw, "event version and type mismatch") }, 400); }
    const timestamp = new Date(String(raw.observedAt));
    if (Number.isNaN(timestamp.getTime())) { EDR_HEALTH.rejected++; return json({ error: "observedAt must be a valid timestamp.", state: "REJECTED", rejection: await rejectEdr(env, raw, "invalid timestamp") }, 400); }
    if (Math.abs(Date.now() - timestamp.getTime()) > 86400000) EDR_HEALTH.timestampErrors++;
    const eventId = String(raw.eventId).slice(0, 120);
    if (seen.has(eventId) || LOCAL_EDR_SEEN.has(eventId)) { EDR_HEALTH.duplicated++; continue; }
    seen.add(eventId);
    LOCAL_EDR_SEEN.add(eventId);
    if (LOCAL_EDR_SEEN.size > 10000) LOCAL_EDR_SEEN.delete(LOCAL_EDR_SEEN.values().next().value);
    const simulated = !options.allowAuthorizedLocal && raw.collector === "simulated-c2";
    const event = { eventId, observationId: await sha256(JSON.stringify(raw)), eventVersion: raw.eventVersion, eventType: String(raw.eventType).slice(0, 60), collector: String(raw.collector || "synthetic-edr-fixture").slice(0, 60), hostId: String(raw.hostId).slice(0, 120), observedAt: timestamp.toISOString(), processName: String(raw.processName || "").slice(0, 160), parentProcess: String(raw.parentProcess || "").slice(0, 160), commandLine: String(raw.commandLine || "").slice(0, 500), filePath: String(raw.filePath || "").slice(0, 300), destinationIp: String(raw.destinationIp || "").slice(0, 80), destinationPort: Number.isInteger(raw.destinationPort) ? raw.destinationPort : null, username: String(raw.username || "").slice(0, 120), synthetic: options.allowAuthorizedLocal ? false : true, provenance: options.allowAuthorizedLocal ? { classification: "LIVE_LOCAL_OBSERVATION", source: options.collector || "authorized-local-collector", authorization: "server-verified-authorized-lab", visibility: options.visibility || "container-local" } : { classification: simulated ? "SIMULATED_C2" : "SYNTHETIC_FIXTURE", source: simulated ? "contained-cyber-range" : "synthetic-edr-fixture", authorization: "synthetic-only", visibility: "synthetic" } };
    if (options.allowAuthorizedLocal && event.eventType === "identity_heartbeat") EDR_HEALTH.lastHeartbeatAt = new Date().toISOString();
    const detection = detectEdrEvent(event);
    const correlationId = `host:${event.hostId}:event:${event.eventType}`;
    const alertId = `alert:${event.eventId}`;
    normalized.push({ event, detection: { ...detection, alertId, correlationId, evidence: { eventId, observationId: event.observationId, requiredTelemetry: detection.requiredTelemetry } }, audit: [{ stage: "ingest", status: "complete" }, { stage: "validate", status: "complete", schema: event.eventVersion }, { stage: "normalize", status: "complete" }, { stage: "deduplicate", status: "complete" }, { stage: "correlate", status: detection.status === "detected" ? "inferred-candidate" : "no-match" }, { stage: "detect", status: detection.status }, { stage: "alert", status: detection.status === "detected" ? "created" : "not-created" }, { stage: "display", status: "complete" }] });
  }
  EDR_HEALTH.processed += normalized.length;
  let stored = false;
  const db = aiDb(env);
  if (db) {
    try {
      const statements = [];
      for (const item of normalized) {
        const e = item.event; const d = item.detection; statements.push(db.prepare("INSERT OR IGNORE INTO edr_events (event_id, observation_id, event_version, event_type, observed_at, host_id, process_name, parent_process, command_line, file_path, destination_ip, destination_port, username, synthetic, provenance_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(e.eventId, e.observationId, e.eventVersion, e.eventType, e.observedAt, e.hostId, e.processName, e.parentProcess, e.commandLine, e.filePath, e.destinationIp, e.destinationPort, e.username, e.synthetic ? 1 : 0, JSON.stringify(e.provenance))); statements.push(db.prepare("INSERT OR IGNORE INTO edr_detections (event_id, alert_id, correlation_id, rule_id, rule_version, severity, confidence, status, rationale, false_positive_notes, evidence_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(e.eventId, d.alertId, d.correlationId, d.ruleId, d.ruleVersion, d.severity, d.confidence, d.status, d.rationale, d.falsePositiveNotes, JSON.stringify(d.evidence)));
      }
      await db.batch(statements);
      stored = true;
    } catch { stored = false; }
  }
  return json({ ok: true, mode: options.allowAuthorizedLocal ? "authorized-local" : (db ? "d1-or-fallback" : "synthetic-local"), health: db ? "PARTIALLY_OPERATIONAL" : "DEGRADED", collector: EDR_HEALTH.collector, visibility: EDR_HEALTH.visibility, count: normalized.length, received: events.length, processed: normalized.length, duplicates: events.length - normalized.length, rejected: 0, stored, events: normalized });
}

async function handleAuthorizedCollectorIngest(request, env) {
  const token = env.INGEST_TOKEN;
  if (!token) return json({ error: "Collector ingestion is not configured.", state: "DEGRADED" }, 503);
  if (request.headers.get("Authorization") !== "Bearer " + token) { EDR_HEALTH.authenticationFailures++; return json({ error: "Unauthorized collector.", state: "REJECTED" }, 401); }
  let body; try { body = await request.json(); } catch { return json({ error: "Invalid collector JSON.", state: "REJECTED" }, 400); }
  const lab = body && body.lab;
  if (!lab || lab.environment !== "authorized-lab" || !["osquery", "local-proc", "ssh-local", "ssh-honeypot"].includes(lab.collector) || lab.target_type !== "local" || lab.remote_targets !== false || lab.external_scanning !== false || lab.production_access !== false || lab.telemetry_only !== true) return json({ error: "Collector lab policy rejected. Only authorized local telemetry collectors are accepted.", state: "REJECTED" }, 403);
  const sourceEvents = Array.isArray(body.events) ? body.events : [];
  if (!sourceEvents.length || sourceEvents.length > 50) return json({ error: "Collector must send 1 to 50 events.", state: "REJECTED" }, 400);
  const events = sourceEvents.map((event) => ({ ...event, synthetic: false, collector: lab.collector }));
  return handleEdrEvents(new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ events }) }), env, { allowAuthorizedLocal: true, collector: lab.collector, visibility: lab.collector === "osquery" ? "host-level" : "container-local" });
}

async function handleEdrHealth() {
  const last = EDR_HEALTH.lastTelemetryAt ? Date.parse(EDR_HEALTH.lastTelemetryAt) : 0;
  const ageSeconds = last ? Math.max(0, Math.round((Date.now() - last) / 1000)) : null;
  const heartbeat = EDR_HEALTH.lastHeartbeatAt ? Date.parse(EDR_HEALTH.lastHeartbeatAt) : 0;
  const heartbeatAgeSeconds = heartbeat ? Math.max(0, Math.round((Date.now() - heartbeat) / 1000)) : null;
  const trustReasons = [];
  if (!last) trustReasons.push("no telemetry observed");
  if (ageSeconds !== null && ageSeconds > 90) trustReasons.push("telemetry stale");
  if (!heartbeat || heartbeatAgeSeconds > 90) trustReasons.push("collector heartbeat missing or stale");
  if (EDR_HEALTH.timestampErrors) trustReasons.push("timestamp consistency errors observed");
  if (EDR_HEALTH.authenticationFailures) trustReasons.push("authentication failures observed");
  const trust = trustReasons.length ? (last && ageSeconds <= 90 ? "DEGRADED" : "UNVERIFIED") : "VERIFIED";
  const state = trust === "VERIFIED" ? "HEALTHY" : trust === "DEGRADED" ? "DEGRADED" : last ? "DATA_GAP" : "FAILED";
  return json({ ok: true, state, telemetryTrust: trust, trustReasons, collector: EDR_HEALTH.collector, visibility: EDR_HEALTH.visibility, freshness: { lastTelemetryAt: EDR_HEALTH.lastTelemetryAt, ageSeconds, lastHeartbeatAt: EDR_HEALTH.lastHeartbeatAt, heartbeatAgeSeconds, staleAfterSeconds: 90 }, metrics: { ...EDR_HEALTH } });
}

async function handleSourceCatalog(request, env) {
  const db = aiDb(env);
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 120).toLowerCase();
  if (!db) {
    const sources = KNOWLEDGE_SEEDS.filter((item) => !q || `${item.name} ${item.category}`.toLowerCase().includes(q)).map((item) => ({ name: item.name, url: item.url, category: item.category, creator: item.creator, usage_mode: "embedded-content" }));
    return json({ ok: true, mode: "embedded-seed", count: sources.length, sources });
  }
  try {
    const query = q
      ? "SELECT id, name, url, category, license_status, creator, usage_mode, notes FROM ai_source_catalog WHERE lower(name) LIKE ? OR lower(category) LIKE ? ORDER BY name LIMIT 50"
      : "SELECT id, name, url, category, license_status, creator, usage_mode, notes FROM ai_source_catalog ORDER BY name LIMIT 50";
    const params = q ? [`%${q}%`, `%${q}%`] : [];
    const { results } = await db.prepare(query).bind(...params).all();
    return json({ ok: true, count: results.length, sources: results });
  } catch { return json({ error: "Source catalog is not initialized." }, 500); }
}

async function handleFeedback(request, env) {
  const token = env.AI_FEEDBACK_TOKEN || env.INGEST_TOKEN;
  if (!token) return json({ error: "Feedback is not configured on this worker." }, 503);
  if (request.headers.get("Authorization") !== "Bearer " + token) return json({ error: "Unauthorized." }, 401);
  const db = aiDb(env);
  if (!db) return json({ error: "AI memory database not bound." }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const runId = Number(body.runId);
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 40) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";
  if (!Number.isInteger(runId) || runId < 1 || !["accepted", "needs-review", "unsupported", "incorrect"].includes(label)) return json({ error: "runId and a supported label are required." }, 400);
  try {
    await db.prepare("INSERT INTO ai_feedback (run_id, label, notes) VALUES (?, ?, ?)").bind(runId, label, notes).run();
    return json({ ok: true, runId, label });
  } catch { return json({ error: "Feedback insert failed." }, 500); }
}

async function sha256(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64Bytes(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptionKey(env) {
  const encoded = typeof env.AI_MEMORY_ENCRYPTION_KEY === "string" ? env.AI_MEMORY_ENCRYPTION_KEY : "";
  if (!encoded) return null;
  let raw;
  try {
    const binary = atob(encoded);
    raw = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch { return null; }
  if (raw.length !== 32) return null;
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
}

async function encryptForStorage(env, value) {
  const key = await encryptionKey(env);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `aes-256-gcm:v1:${base64Bytes(iv)}:${base64Bytes(new Uint8Array(ciphertext))}`;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeEntity(value) {
  return String(value || "").trim().toLowerCase().replace(/\[\.\]/g, ".").replace(/\s+/g, " ");
}

async function persistProof(env, proof) {
  const db = aiDb(env);
  if (!db || !(await encryptionKey(env))) return null;
  const requestId = crypto.randomUUID();
  try {
    const encrypted = await encryptForStorage(env, JSON.stringify(proof));
    if (!encrypted) return null;
    const inserted = await db.prepare("INSERT INTO ai_runs (request_id, mode, model, input_chars, output_json, confidence) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(requestId, "observatory-proof", "algorithmic-skeptic-v1+a256gcm", proof.observation.details.length, encrypted, proof.assessment.confidence).run();
    const runId = inserted.meta && inserted.meta.last_row_id;
    if (runId) {
      await db.prepare("INSERT INTO ai_claims (run_id, claim, claim_type, evidence_json, confidence, verification_status) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(runId, "Encrypted observatory proof; decrypt through an authorized dashboard path.", "encrypted-hypothesis", encrypted, proof.assessment.confidence, "requires-human-review").run();
    }
    return runId || requestId;
  } catch { return null; }
}

async function handleDiagnostics(request, env) {
  const url = new URL(request.url);
  const encryptionConfigured = !!(await encryptionKey(env));
  const databaseConfigured = !!aiDb(env);
  const checks = {
    transport: { status: url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1" ? "OK" : "REVIEW", detail: "HTTPS is required outside localhost." },
    encryption: { status: encryptionConfigured ? "OK" : "BLOCKED", detail: encryptionConfigured ? "AES-256-GCM persistence is configured." : "Set a valid base64-encoded 32-byte AI_MEMORY_ENCRYPTION_KEY; persistence fails closed until then." },
    database: { status: databaseConfigured ? "OK" : "DEGRADED", detail: databaseConfigured ? "AI database binding is available." : "Bind AI_DB or DB for persisted audit records; analysis can remain stateless." },
    collector: { status: env.INGEST_TOKEN ? "CONFIGURED" : "BLOCKED", detail: env.INGEST_TOKEN ? "Ingestion authentication is configured." : "Set INGEST_TOKEN and point the collector to http://127.0.0.1:<PORT>/api/edr/ingest for local testing." },
  };
  const fixes = Object.values(checks).filter((check) => check.status === "BLOCKED" || check.status === "DEGRADED" || check.status === "REVIEW").map((check) => check.detail);
  return json({ ok: fixes.length === 0, checks, dataPath: ["customer input", "AI processing", "redacted operational logs", "error state", "telemetry", "bounded collector audit", "encrypted database persistence", "encrypted audit records", "authorized exports"], fixes: fixes.length ? fixes : ["No configuration repair required."], privacy: "Diagnostics never return customer content, tokens, encryption keys, or raw exception bodies." });
}

async function handleObservatoryProof(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (rateLimited("proof:" + ip)) return json({ error: "Rate limit: 10 proof runs per minute." }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const source = body && body.source && typeof body.source === "object" ? body.source : {};
  const entity = body && body.entity && typeof body.entity === "object" ? body.entity : {};
  const signal = typeof body.signal === "string" ? body.signal.trim().slice(0, 500) : "";
  const details = typeof body.details === "string" ? body.details.trim().slice(0, 8000) : "";
  const observedAt = typeof body.observedAt === "string" ? body.observedAt : "";
  if (!source.name || !source.url || !entity.value || !signal || !observedAt || !details) {
    return json({ error: "source.name, source.url, entity.value, signal, observedAt, and details are required." }, 400);
  }
  let sourceUrl;
  let timestamp;
  try { sourceUrl = new URL(String(source.url)); timestamp = new Date(observedAt); } catch { return json({ error: "source.url or observedAt is invalid." }, 400); }
  if (!["http:", "https:"].includes(sourceUrl.protocol) || Number.isNaN(timestamp.getTime())) return json({ error: "Use an http(s) source URL and valid observedAt timestamp." }, 400);
  const observation = {
    classification: "OBSERVATION",
    source: { name: String(source.name).slice(0, 160), url: sourceUrl.toString(), license: String(source.license || "verify upstream terms").slice(0, 160) },
    entity: { value: String(entity.value).slice(0, 240), normalized: normalizeEntity(entity.value), type: String(entity.type || "unknown").slice(0, 60) },
    signal,
    details,
    observedAt: timestamp.toISOString(),
  };
  const evidenceHash = await sha256(JSON.stringify(observation));
  const correlation = {
    status: "possibly_related",
    key: observation.entity.normalized,
    matches: [{ field: "normalized_entity", value: observation.entity.normalized, relationship: "same_entity_candidate" }],
    caveat: "Correlation is not attribution; independent evidence is required before merging entities.",
  };
  const skeptic = {
    classification: "HYPOTHESIS",
    challenge: "The signal may reflect benign, shared, delayed, or independently caused activity rather than the leading interpretation.",
    contradictingEvidenceNeeded: ["primary telemetry", "independent corroboration", "collection and observed timestamps"],
    negativeEvidenceGuard: "not_observed_is_not_observed_absence",
    status: "requires_human_review",
  };
  const simulationAuthorized = body.authorizationConfirmed === true && body.simulationMode === "benign-isolated";
  const simulation = {
    classification: "SIMULATION_RESULT",
    status: simulationAuthorized ? "plan_ready_no_execution" : "blocked_pending_authorization_and_isolation",
    scope: "synthetic target only",
    steps: ["identify behavior", "define telemetry", "verify isolation", "run benign emulation", "test detection", "test containment", "restore", "verify recovery"],
    executed: false,
  };
  const proof = {
    version: "observatory-proof-v1",
    observation: { ...observation, evidenceHash },
    correlation,
    assessment: {
      classification: "HYPOTHESIS",
      hypothesis: `The observed ${observation.signal} may be associated with ${observation.entity.value}, but the evidence is insufficient for attribution.`,
      alternative: skeptic.challenge,
      confidence: 0.35,
      status: "requires_human_review",
    },
    skeptic,
    simulation,
    report: {
      summary: "One provenance-bearing observation was normalized and correlated, then challenged without forcing attribution.",
      unknowns: ["independent corroboration", "complete telemetry coverage", "operator attribution"],
      mitigation: ["preserve evidence", "validate timestamps", "apply reversible detection and containment controls only after authorization"],
      legalGovernance: "LEGAL_REVIEW_RECOMMENDED before testing third-party infrastructure or handling personal data.",
    },
    auditTrail: [
      { stage: "ingest", status: "complete", evidenceHash },
      { stage: "normalize", status: "complete", entity: observation.entity.normalized },
      { stage: "correlate", status: "complete", result: correlation.status },
      { stage: "hypothesize", status: "complete", classification: "HYPOTHESIS" },
      { stage: "skeptic", status: "complete", result: skeptic.status },
      { stage: "simulate", status: simulation.status, executed: false },
      { stage: "report", status: "complete", requiresHumanReview: true },
    ],
  };
  proof.auditId = await persistProof(env, proof);
  return json({ ok: true, proof });
}

/* ---------- assets ---------- */

const PAGE = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Corpora AI &middot; Text Intelligence</title>
<link rel="stylesheet" href="/style.css">
<script src="/app.js" defer></script>
</head>
<body>
<header class="nav">
  <a class="brand" href="/">Corpora <span>AI</span></a>
  <button id="theme-toggle" class="icon-btn" type="button" aria-label="Toggle theme"></button>
</header>
<section id="jurisdiction-prompt" class="modal" hidden aria-labelledby="jurisdiction-title" role="dialog" aria-modal="true">
  <div class="modal-card">
    <h2 id="jurisdiction-title">Configure data-protection profile</h2>
    <p class="muted">Where will Corpora AI process or store customer data? This configures safeguards; it is not a compliance or legal-advice determination.</p>
    <div class="data-notice"><strong>Why we use customer data:</strong> to analyze submitted text, retrieve related reference material, correlate observations, test authorized synthetic scenarios, produce reports, and maintain an auditable security workflow.</div>
    <div class="data-notice"><strong>Scope:</strong> data you submit, requested telemetry, configuration choices, security metadata, and optional evaluation output. Raw analysis input is not stored by default. If you opt into persistence, output and claims are stored only when server-side AES-256-GCM encryption is configured; otherwise persistence fails closed.</div>
    <div class="data-notice"><strong>How it is needed:</strong> the minimum necessary data supports the requested analysis and evidence chain. Retention, residency, legal basis, access, deletion, and transfers remain customer-policy and counsel-controlled.</div>
    <label class="lbl" for="data-region">Processing or storage jurisdiction</label>
    <select id="data-region" class="text-input">
      <option value="US_ONLY">United States only</option>
      <option value="EU_EEA">European Union / EEA</option>
      <option value="UK">United Kingdom</option>
      <option value="MULTIPLE">Multiple jurisdictions</option>
      <option value="UNKNOWN">Unknown</option>
    </select>
    <label class="lbl modal-label" for="eu-personal-data">Will Corpora AI process personal data belonging to people in the EU/EEA?</label>
    <select id="eu-personal-data" class="text-input">
      <option value="YES">Yes</option>
      <option value="NO">No</option>
      <option value="UNKNOWN">Unknown</option>
    </select>
    <label class="consent"><input id="data-consent" type="checkbox" required> I understand why data is processed, what is in scope, and that legal review may be required for my use case.</label>
    <p class="legal-note">Legal information only. Jurisdiction, legal basis, retention, residency, transfers, and admissibility require customer policy and qualified counsel. Evidence preservation metadata does not guarantee admissibility.</p>
    <button id="save-jurisdiction" class="cta" type="button" disabled>Save profile</button>
  </div>
</section>
<main>
  <section class="hero">
    <h1>Paste a corpus.<br>Get the intelligence out.</h1>
    <p class="sub">Summary, entities, topics, key terms and readability &mdash; Workers AI plus an algorithmic pass, in one request.</p>
    <p id="legal-profile-status" class="tagline"></p>
  </section>
  <section class="input-card" id="login-portal">
    <div class="lbl">Login portal &middot; ad-observation privacy lab</div>
    <p class="muted">Login is only the identity step. Corpora will not read mailbox contents, contacts, messages, passwords, precise location, Wi-Fi, cellular, or device fingerprints. Ad analysis accepts only permitted ad observations.</p>
    <div class="provider-grid"><button class="cta secondary provider-login" data-provider="iCloud" type="button">iCloud</button><button class="cta secondary provider-login" data-provider="GitHub" type="button">GitHub</button><button class="cta secondary provider-login" data-provider="Gmail" type="button">Gmail</button><button class="cta secondary provider-login" data-provider="Work email" type="button">Work email</button><button class="cta secondary provider-login" data-provider="YouTube" type="button">YouTube</button></div>
    <div class="data-notice"><strong>One-time API key:</strong> generate a temporary key when no provider connector is configured. The plaintext is shown once, then only its hash is held until expiry.</div>
    <div class="row"><button id="issue-api-key" class="cta" type="button">Generate one-time API key</button><input id="api-key" class="text-input" type="password" placeholder="Paste generated key" autocomplete="one-time-code"><button id="verify-api-key" class="cta secondary" type="button">Login with key</button></div>
    <p id="login-status" class="tagline" role="status" aria-live="polite">Not logged in</p>
    <div id="ad-observation-panel" hidden>
      <label class="lbl" for="ad-source">Connected data source (declared)</label><select id="ad-source" class="text-input"><option value="iCloud">iCloud</option><option value="GitHub">GitHub</option><option value="Gmail">Gmail</option><option value="Work email">Work email</option><option value="YouTube">YouTube</option><option value="One-time API key">One-time API key</option></select>
      <label class="lbl modal-label" for="ad-advertiser">Advertiser or company shown (optional)</label><input id="ad-advertiser" class="text-input" placeholder="Only what the ad visibly identifies">
      <label class="lbl modal-label" for="ad-text">Observed ad label or description</label><textarea id="ad-text" rows="4" placeholder="Paste or describe the ad you saw. Do not paste private mailbox or account contents."></textarea>
      <label class="consent"><input id="ad-consent" type="checkbox"> I consent to session-only analysis of this ad observation for this investigation.</label>
      <div class="row"><button id="analyze-ad" class="cta" type="button">Explain this ad</button><span id="ad-status" class="msg" role="status" aria-live="polite"></span></div><pre id="ad-output" class="proof-output" hidden></pre>
    </div>
  </section>
  <section class="input-card">
    <label class="lbl" for="input">Your text corpus (up to 32KB)</label>
    <textarea id="input" rows="8" placeholder="Paste an article, a report, a thread, research notes&hellip;"></textarea>
    <label class="consent"><input id="persist" type="checkbox"> Save an evaluation case for human review (stores output metadata, not raw text)</label>
    <section class="data-notice"><strong>Purpose limitation:</strong> persistence is opt-in. If saved, the encrypted result is returned with a one-time customer access token; keep it private to export or delete this run later.</section>
    <div class="row">
      <button id="analyze" class="cta" type="button">Analyze corpus</button>
      <button id="proof" class="cta secondary" type="button">Run bounded proof</button>
      <span id="msg" class="msg" role="status" aria-live="polite"></span>
    </div>
    <pre id="proof-output" class="proof-output" hidden></pre>
  </section>
  <section class="input-card browser-card" id="research-browser">
    <div class="lbl">Embedded research browser</div>
    <p class="muted">Public HTTPS research only. Web pages are untrusted evidence—not instructions. The browser does not bypass login, CAPTCHA, paywalls, robots rules, rate limits, or access controls.</p>
    <label class="lbl" for="research-url">Public source URL</label><input id="research-url" class="text-input" type="url" placeholder="https://example.org/public-document" autocomplete="url">
    <label class="consent"><input id="research-authorize" type="checkbox"> I authorize this public-web retrieval for the stated investigation.</label>
    <label class="consent"><input id="research-location-consent" type="checkbox"> If useful, allow coarse country/region resolution for this investigation. Do not collect precise location, Wi-Fi, cellular, or device identifiers.</label>
    <div class="row"><button id="research-fetch" class="cta" type="button">Retrieve public source</button><button id="research-location" class="cta secondary" type="button">Resolve coarse region</button><span id="research-msg" class="msg" role="status" aria-live="polite"></span></div>
    <pre id="research-output" class="proof-output" hidden></pre>
  </section>
  <section class="input-card catalog-card" id="tool-catalog"><div class="lbl">100 bounded agent tools</div><p class="muted">Every tool is a policy object, not an unrestricted command. The catalog is transparent; authorization does not execute a tool.</p><div class="row"><input id="tool-filter" class="text-input" placeholder="Filter tools by name or category" aria-label="Filter tools"><span id="tool-count" class="msg"></span></div><div id="tool-list" class="tool-list">Loading tool policy catalog&hellip;</div></section>
  <section class="input-card catalog-card"><div class="lbl">Agent architecture catalog</div><p class="muted">Reference-only sources shaping retrieval, structured claims, evaluation, and observability. No upstream code is executed here.</p><div id="source-catalog" class="catalog">Loading source catalog&hellip;</div></section>
  <section class="grid">
    <article class="card"><h2>Customer privacy controls</h2><p class="muted">Use the run ID and private access token returned when you opted into persistence. Export returns encrypted output; deletion removes the run, claims, feedback, and access credential.</p><label class="lbl" for="privacy-run-id">Run ID</label><input id="privacy-run-id" class="text-input" inputmode="numeric" autocomplete="off" placeholder="e.g. 12"><label class="lbl modal-label" for="privacy-token">Access token</label><input id="privacy-token" class="text-input" type="password" autocomplete="off" placeholder="Paste the private token"><div class="row"><button id="privacy-export" class="cta secondary" type="button">Export encrypted run</button><button id="privacy-delete" class="cta secondary" type="button">Delete run</button></div><pre id="privacy-run-output" class="proof-output" hidden></pre></article>
    <article class="card"><h2>Evidence retrieval</h2><p class="muted">Retrieve content-bearing, provenance-labeled material from the local knowledge index. Results are context, not proof of compromise.</p><div class="row"><input id="retrieve-query" class="text-input" value="incident response" aria-label="Retrieval query"><button id="retrieve" class="cta" type="button">Retrieve content</button></div><pre id="retrieval-output" class="proof-output" hidden></pre></article>
    <article class="card"><h2>Synthetic EDR pipeline</h2><p class="muted">Run one harmless fixture through ingest, normalization, correlation, detection, display, and audit logging. No host agent or real target is contacted.</p><button id="edr-demo" class="cta secondary" type="button">Run synthetic EDR check</button><pre id="edr-output" class="proof-output" hidden></pre></article>
    <article class="card"><h2>EDR health and visibility</h2><p class="muted">Health is based on recent telemetry, not application uptime. Visibility is server-labeled and never upgrades container-local data to host-level EDR.</p><div id="edr-health" class="health-panel">Checking telemetry health&hellip;</div></article>
    <article class="card"><h2>Customer-data pipeline</h2><p class="muted">Checks transport, encryption, persistence, and local ingestion configuration without exposing secrets or customer content.</p><button id="diagnostics" class="cta secondary" type="button">Check pipeline</button><pre id="diagnostics-output" class="proof-output" hidden></pre></article>
    <article class="card"><h2>Privacy exposure scan</h2><p class="muted">Browser-local only: paste a public broker result or notice and an identifier you control. The identifier is hashed locally and is not sent to Corpora or broker sites.</p><label class="lbl" for="scan-identifier">Identifier you control</label><input id="scan-identifier" class="text-input" type="text" autocomplete="off" placeholder="Use only your own email, phone, or name"><label class="lbl modal-label" for="scan-material">Pasted public result or privacy notice</label><textarea id="scan-material" rows="4" placeholder="Paste text you already obtained lawfully&hellip;"></textarea><button id="privacy-scan" class="cta secondary" type="button">Scan locally</button><pre id="privacy-output" class="proof-output" hidden></pre><p class="tagline">Storage disclosure: request memory during processing; raw input not stored by default; persisted output requires valid AES-256-GCM configuration; deployment and backup regions are unverified unless the operator documents them.</p></article>
  </section>
  <section id="results" hidden>
    <div class="grid">
      <article class="card"><h2>Summary</h2><p id="summary" class="muted">—</p><p id="sentiment" class="tagline"></p></article>
      <article class="card"><h2>Topics</h2><div id="topics" class="chips"></div><h2 class="mt">Entities</h2><div id="entities" class="chips"></div></article>
      <article class="card"><h2>Key terms</h2><div id="keywords" class="bars"></div></article>
      <article class="card"><h2>Corpus stats</h2><div id="stats" class="tiles"></div><p class="tagline" id="readability"></p></article>
      <article class="card skeptic-card"><h2>Skeptic review</h2><p id="skeptic-status" class="tagline"></p><p id="skeptic-hypothesis" class="muted"></p><p id="skeptic-alternative" class="muted"></p><p id="skeptic-missing" class="muted"></p><p id="skeptic-next" class="muted"></p></article>
    </div>
  </section>
</main>
<footer><p>Corpora AI &middot; part of Aadi&rsquo;s Digital Lab &middot; opt-in evaluation memory only &middot; raw input is not stored by default</p></footer>
</body>
</html>`;

const PAGE_CSS = `:root{--bg:#0b0e14;--card:#12161f;--border:#232a37;--text:#e6e9ef;--muted:#8b93a3;--accent:#8b5cf6;--accent-ink:#f4f0ff;--chip:#1b2230}
[data-theme=light]{--bg:#f7f8fa;--card:#ffffff;--border:#e3e6ec;--text:#1a1d24;--muted:#5b6472;--accent:#6d4de0;--accent-ink:#f4f0ff;--chip:#eef0f5}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif}
.nav{display:flex;justify-content:space-between;align-items:center;padding:18px 6vw;border-bottom:1px solid var(--border)}
.modal{position:fixed;inset:0;z-index:10;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.72)}.modal[hidden]{display:none}.modal-card{width:min(560px,100%);background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.35)}.modal-card h2{margin-top:0}.modal-label{margin-top:16px}.data-notice{background:var(--chip);border:1px solid var(--border);border-radius:8px;padding:10px;margin:10px 0;color:var(--muted);font-size:.82rem}.data-notice strong{color:var(--text)}.legal-note{color:var(--muted);font-size:.78rem;border-left:3px solid var(--accent);padding-left:10px;margin:16px 0}
.brand{color:var(--text);text-decoration:none;font-weight:700;font-size:1.15rem;letter-spacing:.02em}
.brand span{color:var(--accent)}
.icon-btn{background:var(--card);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:1rem;padding:6px 12px;cursor:pointer}
main{max-width:900px;margin:0 auto;padding:32px 5vw 64px}
.hero h1{font-size:clamp(1.6rem,4.5vw,2.4rem);line-height:1.15;margin:24px 0 8px}
.sub{color:var(--muted);max-width:34em}
.input-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;margin:28px 0}
.lbl{display:block;color:var(--muted);font-size:.85rem;margin-bottom:8px}
textarea{width:100%;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:12px;font:inherit;resize:vertical}
textarea:focus{outline:2px solid var(--accent);outline-offset:1px}
.text-input{min-width:0;flex:1;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:10px;padding:11px;font:inherit}
.text-input:focus{outline:2px solid var(--accent);outline-offset:1px}
.row{display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap}
.cta{background:var(--accent);color:var(--accent-ink);border:0;border-radius:10px;padding:12px 22px;font-weight:600;font-size:1rem;cursor:pointer}
.cta.secondary{background:var(--chip);color:var(--text);border:1px solid var(--border)}
.cta:disabled{opacity:.55;cursor:wait}
.msg{color:var(--muted);font-size:.9rem}
.consent{display:flex;gap:8px;align-items:flex-start;color:var(--muted);font-size:.82rem;margin-top:12px}
.consent input{accent-color:var(--accent);margin-top:5px}
.catalog-card{margin-top:18px}.catalog{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.source{background:var(--chip);border:1px solid var(--border);border-radius:10px;padding:10px}.source a{color:var(--text);font-weight:600;text-decoration:none}.source small{display:block;color:var(--muted);font-size:.75rem;margin-top:3px}
.tool-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px;margin-top:14px}.tool{background:var(--chip);border:1px solid var(--border);border-radius:10px;padding:12px}.tool-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}.tool p{color:var(--muted);font-size:.82rem;margin:8px 0}.tool small{display:block;color:var(--muted);font-size:.72rem;margin-top:5px}
.provider-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin:14px 0}.provider-login{padding:10px 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px;min-width:0}
.card h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:0 0 12px}
.card h2.mt{margin-top:20px}
.muted{color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:8px}
.chip{background:var(--chip);border:1px solid var(--border);border-radius:999px;padding:4px 12px;font-size:.85rem}
.bars .bar-row{margin:8px 0}
.bar-row .bar-track{background:var(--chip);border-radius:6px;height:10px;overflow:hidden}
.bar-row .bar-fill{height:100%;background:var(--accent);border-radius:6px}
.bar-row .bar-lbl{display:flex;justify-content:space-between;font-size:.85rem;color:var(--muted);margin-bottom:2px}
.bar-row .bar-lbl b{color:var(--text)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:10px}
.tile{background:var(--chip);border-radius:10px;padding:10px;text-align:center}
.tile .n{font-weight:700;font-size:1.2rem}
.tile .t{font-size:.75rem;color:var(--muted)}
.tagline{color:var(--muted);font-size:.85rem;margin:12px 0 0}
.proof-output{white-space:pre-wrap;overflow:auto;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--muted);padding:12px;margin:16px 0 0;font-size:.78rem;max-height:360px}
.health-panel{background:var(--chip);border:1px solid var(--border);border-radius:10px;padding:12px;color:var(--muted);font-size:.85rem;white-space:pre-line}
footer{border-top:1px solid var(--border);padding:24px 6vw;color:var(--muted);font-size:.85rem}
footer p{margin:0}`;

const PAGE_JS = `"use strict";
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* theme */
const btn = $("theme-toggle");
const setTheme = (t) => { document.documentElement.dataset.theme = t; btn.textContent = t === "dark" ? "☀" : "☾"; };
setTheme(localStorage.getItem("corpora-theme") || "dark");
btn.addEventListener("click", () => {
  const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("corpora-theme", t); setTheme(t);
});

/* Jurisdiction is customer-provided configuration; never infer it from IP geolocation. */
const jurisdictionPrompt = $("jurisdiction-prompt");
const jurisdictionStatus = $("legal-profile-status");
const renderJurisdiction = (profile) => {
  const euMode = profile.region === "EU_EEA" || profile.euPersonalData === "YES";
  jurisdictionStatus.textContent = "Data-protection profile: " + (euMode ? "EUROPEAN DATA-PROTECTION MODE" : profile.region === "UNKNOWN" || profile.euPersonalData === "UNKNOWN" ? "UNVERIFIED — legal review recommended" : profile.region) + ". Legal review required where facts or jurisdiction matter.";
};
const savedJurisdiction = localStorage.getItem("corpora-jurisdiction-profile");
if (savedJurisdiction) {
  try { renderJurisdiction(JSON.parse(savedJurisdiction)); } catch { jurisdictionPrompt.hidden = false; }
} else jurisdictionPrompt.hidden = false;
const dataConsent = $("data-consent");
const saveJurisdiction = $("save-jurisdiction");
dataConsent.addEventListener("change", () => { saveJurisdiction.disabled = !dataConsent.checked; });
$("save-jurisdiction").addEventListener("click", () => {
  if (!dataConsent.checked) return;
  const profile = { region: $("data-region").value, euPersonalData: $("eu-personal-data").value, configuredAt: new Date().toISOString(), source: "customer-declared", ipInference: false };
  localStorage.setItem("corpora-jurisdiction-profile", JSON.stringify(profile));
  renderJurisdiction(profile); jurisdictionPrompt.hidden = true;
});

$("analyze").addEventListener("click", async () => {
  const text = $("input").value.trim();
  const msg = $("msg");
  if (!text) { msg.textContent = "Paste or type some text first."; return; }
  $("analyze").disabled = true; msg.textContent = "Analyzing corpus…";
  try {
    const res = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, persist: $("persist").checked }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Analysis failed (" + res.status + ")");
    render(data);
    if (data.runId && typeof data.runId === "object") {
      $("privacy-run-id").value = data.runId.runId;
      $("privacy-token").value = data.runId.accessToken;
      msg.textContent = "Saved as evaluation run " + data.runId.runId + ". Keep the displayed access token private; it will not be shown again by the server.";
    } else msg.textContent = data.mode === "ai+algorithmic" ? "Analyzed with Workers AI + algorithmic pass." : "Analyzed in algorithmic mode (AI unavailable right now).";
  } catch (e) { msg.textContent = e.message; }
  $("analyze").disabled = false;
});

async function privacyRequest(method, path) {
  const output = $("privacy-run-output");
  const runId = Number($("privacy-run-id").value.trim());
  const accessToken = $("privacy-token").value.trim();
  if (!Number.isInteger(runId) || !accessToken) { output.hidden = false; output.textContent = "Enter the run ID and private access token."; return; }
  try {
    const res = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ runId, accessToken }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Privacy request failed (" + res.status + ")");
    output.hidden = false; output.textContent = JSON.stringify(data, null, 2);
    if (method === "DELETE") { $("privacy-token").value = ""; output.textContent += "\\n\\nThe access token was cleared from this page."; }
  } catch (e) { output.hidden = false; output.textContent = e.message; }
}
$("privacy-export").addEventListener("click", () => privacyRequest("POST", "/api/privacy/export"));
$("privacy-delete").addEventListener("click", () => privacyRequest("DELETE", "/api/privacy/run"));

$("research-fetch").addEventListener("click", async () => {
  const msg = $("research-msg");
  const output = $("research-output");
  const url = $("research-url").value.trim();
  if (!$("research-authorize").checked) { msg.textContent = "Explicit authorization is required before retrieval."; return; }
  if (!url) { msg.textContent = "Enter a public HTTPS source URL."; return; }
  $("research-fetch").disabled = true; msg.textContent = "Retrieving public source and checking robots policy…";
  try {
    const res = await fetch("/api/research/fetch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, authorized: true, purpose: "customer-declared research" }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Research retrieval failed (" + res.status + ")");
    output.hidden = false; output.textContent = JSON.stringify(data, null, 2);
    msg.textContent = data.safety && data.safety.promptInjectionSuspected ? "Retrieved as untrusted evidence; possible prompt injection was flagged." : "Retrieved as unverified public evidence. Review provenance and contradictions before relying on it.";
  } catch (e) { output.hidden = false; output.textContent = e.message; msg.textContent = "Retrieval did not complete."; }
  $("research-fetch").disabled = false;
});

$("research-location").addEventListener("click", async () => {
  const msg = $("research-msg");
  const output = $("research-output");
  if (!$("research-location-consent").checked) { msg.textContent = "Coarse region lookup requires explicit consent."; return; }
  try {
    const res = await fetch("/api/research/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true, purpose: "customer-declared research" }) });
    const data = await res.json();
    output.hidden = false; output.textContent = JSON.stringify(data, null, 2);
    msg.textContent = data.location ? "Coarse country/region resolved; it was not stored." : "Coarse region is unavailable; no precise location was collected.";
  } catch (e) { msg.textContent = "Location lookup unavailable."; }
});

let toolCatalog = [];
const renderTools = () => {
  const filter = $("tool-filter").value.trim().toLowerCase();
  const visible = toolCatalog.filter((tool) => !filter || (tool.name + " " + tool.category + " " + tool.targetScope).toLowerCase().includes(filter));
  $("tool-count").textContent = visible.length + " of " + toolCatalog.length + " tools";
  $("tool-list").innerHTML = visible.map((tool) => '<article class="tool"><div class="tool-head"><b>' + String(tool.number).padStart(2, "0") + " · " + esc(tool.name) + '</b><span class="chip">' + esc(tool.category) + '</span></div><p>' + esc(tool.purpose) + '</p><small>scope: ' + esc(tool.targetScope) + ' · data: ' + esc(tool.dataClasses.join(", ")) + ' · ' + (tool.readOnly ? "read-only" : "side-effecting") + ' · authorization: required · escalation: ' + (tool.escalationRequired ? "required" : "not required") + '</small><small>retention: ' + esc(tool.retentionBehavior) + ' · provenance: required · ' + (tool.simulationOnly ? "SIMULATION ONLY" : "bounded analysis") + '</small></article>').join("") || '<p class="muted">No tools match this filter.</p>';
};
$("tool-filter").addEventListener("input", renderTools);
fetch("/api/tools/catalog").then((res) => res.json()).then((data) => { toolCatalog = data.tools || []; renderTools(); }).catch(() => { $("tool-list").textContent = "Tool policy catalog unavailable."; });

let adSessionToken = "";
const loginStatus = $("login-status");
document.querySelectorAll(".provider-login").forEach((button) => button.addEventListener("click", async () => {
  const provider = button.dataset.provider;
  const res = await fetch("/api/login/provider", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
  const data = await res.json();
  loginStatus.textContent = data.message || data.next || (data.ok ? provider + " login ready." : "Provider login unavailable.");
}));
$("issue-api-key").addEventListener("click", async () => {
  const res = await fetch("/api/login/key/issue", { method: "POST" });
  const data = await res.json();
  if (!res.ok) { loginStatus.textContent = data.error || "Key generation failed."; return; }
  $("api-key").type = "text"; $("api-key").value = data.apiKey; loginStatus.textContent = "One-time key generated. Copy it or use Login with key; it expires in 10 minutes.";
});
$("verify-api-key").addEventListener("click", async () => {
  const apiKey = $("api-key").value.trim();
  const res = await fetch("/api/login/key/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey }) });
  const data = await res.json();
  if (!res.ok) { loginStatus.textContent = data.error || "Login failed."; return; }
  adSessionToken = data.sessionToken; $("ad-observation-panel").hidden = false; loginStatus.textContent = "Logged in with a temporary session. Explicit ad-observation consent is still required."; $("api-key").value = ""; $("api-key").type = "password";
});
$("analyze-ad").addEventListener("click", async () => {
  const status = $("ad-status"); const output = $("ad-output");
  if (!adSessionToken) { status.textContent = "Login required."; return; }
  if (!$("ad-consent").checked) { status.textContent = "Explicit session-only ad-observation consent is required."; return; }
  const res = await fetch("/api/ads/observe", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + adSessionToken }, body: JSON.stringify({ source: $("ad-source").value, advertiser: $("ad-advertiser").value, adText: $("ad-text").value, consent: true, dataScope: "ad-observations-only", retention: "session-only" }) });
  const data = await res.json(); output.hidden = false; output.textContent = JSON.stringify(data, null, 2); status.textContent = res.ok ? "Ad observation analyzed without persistence." : (data.error || "Ad analysis failed.");
});

$("proof").addEventListener("click", async () => {
  const text = $("input").value.trim();
  const msg = $("msg");
  const output = $("proof-output");
  if (!text) { msg.textContent = "Paste or type an observation first."; return; }
  $("proof").disabled = true; msg.textContent = "Running bounded proof; no external action will execute.";
  try {
    const res = await fetch("/api/observatory/proof", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      source: { name: "Corpora AI dashboard submission", url: window.location.origin, license: "user-provided observation" },
      entity: { value: "submitted-observation", type: "unknown" }, signal: "analyst-submitted text evidence",
      observedAt: new Date().toISOString(), details: text, authorizationConfirmed: false, simulationMode: "not-authorized"
    }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Proof failed (" + res.status + ")");
    output.hidden = false; output.textContent = JSON.stringify(data.proof, null, 2);
    msg.textContent = data.proof.auditId ? "Proof stored encrypted as audit " + data.proof.auditId + "." : "Proof complete; encrypted persistence is not configured in this runtime.";
  } catch (e) { msg.textContent = e.message; }
  $("proof").disabled = false;
});

$("retrieve").addEventListener("click", async () => {
  const query = $("retrieve-query").value.trim();
  const output = $("retrieval-output");
  if (!query) return;
  $("retrieve").disabled = true;
  try {
    const res = await fetch("/api/observatory/retrieve?q=" + encodeURIComponent(query));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Retrieval failed (" + res.status + ")");
    output.hidden = false; output.textContent = JSON.stringify(data, null, 2);
  } catch (e) { output.hidden = false; output.textContent = e.message; }
  $("retrieve").disabled = false;
});

$("edr-demo").addEventListener("click", async () => {
  const output = $("edr-output");
  $("edr-demo").disabled = true;
  try {
    const res = await fetch("/api/edr/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ synthetic: true, eventVersion: "edr.process.v1", eventId: "dashboard-fixture-" + Date.now(), eventType: "process_start", observedAt: new Date().toISOString(), hostId: "synthetic-host-01", processName: "powershell.exe", parentProcess: "outlook.exe", commandLine: "powershell -NoProfile -Command synthetic_fixture", username: "synthetic-user" }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "EDR check failed (" + res.status + ")");
    output.hidden = false; output.textContent = JSON.stringify(data, null, 2);
  } catch (e) { output.hidden = false; output.textContent = e.message; }
  $("edr-demo").disabled = false;
});

async function loadSources() {
  try {
    const res = await fetch("/api/corpora/sources");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Catalog unavailable");
    $("source-catalog").innerHTML = data.sources.map((s) => '<div class="source"><a href="' + esc(s.url) + '" target="_blank" rel="noreferrer">' + esc(s.name) + '</a><small>' + esc(s.category) + ' · ' + esc(s.creator) + '</small></div>').join("");
  } catch (e) { $("source-catalog").textContent = "Source catalog unavailable until the D1 schema is applied."; }
}
loadSources();

async function loadEdrHealth() {
  try {
    const res = await fetch("/api/edr/health");
    const data = await res.json();
    const m = data.metrics || {};
    $("edr-health").textContent = [
      "State: " + data.state,
      "Telemetry trust: " + data.telemetryTrust,
      "Trust reasons: " + ((data.trustReasons && data.trustReasons.length) ? data.trustReasons.join(", ") : "none"),
      "Visibility: " + data.visibility,
      "Collector: " + data.collector,
      "Last telemetry: " + (data.freshness && data.freshness.lastTelemetryAt || "UNKNOWN"),
      "Telemetry age: " + (data.freshness && data.freshness.ageSeconds === null ? "UNKNOWN" : (data.freshness && data.freshness.ageSeconds) + "s"),
      "Received / processed / rejected / duplicated: " + [m.received, m.processed, m.rejected, m.duplicated].join(" / "),
      "Auth failures / dropped: " + [m.authenticationFailures, m.dropped].join(" / ")
    ].join("\\n");
  } catch (e) { $("edr-health").textContent = "State: UNKNOWN\\nHealth endpoint unavailable"; }
}
loadEdrHealth();
setInterval(loadEdrHealth, 15000);

$("diagnostics").addEventListener("click", async () => {
  const output = $("diagnostics-output");
  $("diagnostics").disabled = true;
  try {
    const res = await fetch("/api/governance/diagnostics");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Diagnostics failed (" + res.status + ")");
    output.hidden = false;
    output.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    output.hidden = false;
    output.textContent = JSON.stringify({ ok: false, fixes: ["Confirm the preview is running on the configured localhost port.", "Check the terminal for a bounded adapter error; customer content is not required for repair."], error: e.message }, null, 2);
  }
  $("diagnostics").disabled = false;
});

$("privacy-scan").addEventListener("click", async () => {
  const identifier = $("scan-identifier").value.trim();
  const material = $("scan-material").value;
  const output = $("privacy-output");
  if (!identifier || !material.trim()) { output.hidden = false; output.textContent = "Provide your own identifier and paste public material you already obtained lawfully."; return; }
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identifier));
  const identifierHash = Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const needle = identifier.toLowerCase();
  const matches = material.toLowerCase().split(needle).length - 1;
  output.hidden = false;
  output.textContent = JSON.stringify({ mode: "browser-local", identifierHash, rawIdentifierSent: false, matchesInPastedMaterial: matches, storage: { rawInputStored: false, identifierStored: false, hashStored: false }, nextSteps: ["Open the broker's official opt-out or removal page.", "Use only the minimum verification information required.", "Save the confirmation and date in your private records.", "Recheck after the broker's stated processing period.", "If a legal request, identity verification, or dispute is required, consult qualified counsel."], limitation: "This scan does not query broker sites, confirm a match beyond the pasted material, or guarantee removal." }, null, 2);
});

function render(d) {
  $("results").hidden = false;
  $("summary").textContent = (d.ai && d.ai.summary) || "AI summary unavailable in this mode — see key terms and stats below.";
  $("sentiment").textContent = d.ai ? "Sentiment: " + d.ai.sentiment : "";
  $("topics").innerHTML = (d.ai && d.ai.topics.length ? d.ai.topics : ["(no topics — algorithmic mode)"]).map((t) => '<span class="chip">' + esc(t) + "</span>").join("");
  $("entities").innerHTML = (d.ai && d.ai.entities.length ? d.ai.entities.map((e) => esc(e.name) + " · " + esc(e.type || "other")) : ["(none)"]).map((t) => '<span class="chip">' + t + "</span>").join("");
  const max = Math.max(1, ...(d.keywords || []).map((k) => k.count));
  $("keywords").innerHTML = (d.keywords || []).map((k) =>
    '<div class="bar-row"><div class="bar-lbl"><b>' + esc(k.term) + "</b><span>" + k.count + "</span></div>" +
    '<div class="bar-track"><div class="bar-fill" style="width:' + Math.round((k.count / max) * 100) + '%"></div></div></div>').join("");
  const s = d.stats;
  $("stats").innerHTML = [["words", s.words], ["unique", s.uniqueWords], ["sentences", s.sentences], ["chars", s.characters], ["read min", s.readingTimeMin]]
    .map(([t, n]) => '<div class="tile"><div class="n">' + n + '</div><div class="t">' + t + "</div></div>").join("");
  $("readability").textContent = d.readability !== null ? "Flesch reading ease: " + d.readability : "";
  if (d.skeptic) {
    $("skeptic-status").textContent = "Status: " + d.skeptic.status;
    $("skeptic-hypothesis").textContent = "Hypothesis: " + d.skeptic.hypothesis;
    $("skeptic-alternative").textContent = "Alternative: " + d.skeptic.alternativeHypothesis;
    $("skeptic-missing").textContent = "Missing evidence: " + d.skeptic.missingEvidence.join(", ");
    $("skeptic-next").textContent = "Next question: " + d.skeptic.nextQuestion;
  }
}`;

/* ---------- router ---------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET") {
      if (url.pathname === "/" || url.pathname === "/index.html") return asset(PAGE, "text/html; charset=utf-8");
      if (url.pathname === "/style.css") return asset(PAGE_CSS, "text/css; charset=utf-8");
      if (url.pathname === "/app.js") return asset(PAGE_JS, "application/javascript; charset=utf-8");
      if (url.pathname === "/health") return json({ ok: true, service: "corpora-ai", mode: env.AI ? "ai+algorithmic" : "algorithmic", corporaDb: !!env.DB, aiMemoryDb: !!aiDb(env), encryptedMemory: !!(await encryptionKey(env)), model: AI_MODEL });
      if (url.pathname === "/api/governance/diagnostics") return handleDiagnostics(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/analyze") return handleAnalyze(request, env);
    if (request.method === "POST" && url.pathname === "/api/privacy/export") return handlePrivacyExport(request, env);
    if (request.method === "DELETE" && url.pathname === "/api/privacy/run") return handlePrivacyDelete(request, env);
    if (request.method === "POST" && url.pathname === "/api/research/fetch") return handleResearchFetch(request, env);
    if (request.method === "POST" && url.pathname === "/api/research/location") return handleResearchLocation(request, env);
    if (request.method === "GET" && url.pathname === "/api/tools/catalog") return handleToolCatalog(request, env);
    if (request.method === "POST" && url.pathname === "/api/tools/authorize") return handleToolAuthorization(request, env);
    if (request.method === "POST" && url.pathname === "/api/login/key/issue") return handleKeyIssue(request, env);
    if (request.method === "POST" && url.pathname === "/api/login/key/verify") return handleKeyVerify(request, env);
    if (request.method === "POST" && url.pathname === "/api/login/provider") return handleProviderLogin(request, env);
    if (request.method === "POST" && url.pathname === "/api/ads/observe") return handleAdObservation(request, env);
    if (request.method === "POST" && url.pathname === "/api/corpora/ingest") return handleIngest(request, env);
    if (request.method === "GET" && url.pathname === "/api/corpora/search") return handleCorporaSearch(request, env);
    if (request.method === "GET" && url.pathname === "/api/corpora/sources") return handleSourceCatalog(request, env);
    if (request.method === "GET" && url.pathname === "/api/observatory/retrieve") return handleKnowledgeRetrieve(request, env);
    if (request.method === "POST" && url.pathname === "/api/edr/events") return handleEdrEvents(request, env);
    if (request.method === "POST" && url.pathname === "/api/edr/ingest") return handleAuthorizedCollectorIngest(request, env);
    if (request.method === "GET" && url.pathname === "/api/edr/health") return handleEdrHealth();
    if (request.method === "POST" && url.pathname === "/api/ai/feedback") return handleFeedback(request, env);
    if (request.method === "POST" && url.pathname === "/api/observatory/proof") return handleObservatoryProof(request, env);
    if (request.method === "GET" && url.pathname === "/api/range/c2/catalog") return handleC2Catalog();
    if (request.method === "POST" && url.pathname === "/api/range/c2/run") return handleC2Run(request, env);
    if (request.method === "POST" && url.pathname === "/api/range/c2/contain") return handleC2Contain(request);
    return new Response("Not found", { status: 404, headers: secHeaders({ "content-type": "text/plain; charset=utf-8" }) });
  },
};


const C2_TASKS = Object.freeze({
  DISCOVERY_SIMULATION: { eventVersion: "edr.network.v1", eventType: "network_discovery_simulation", behavior: "synthetic discovery metadata only" },
  PROCESS_ENUMERATION_SIMULATION: { eventVersion: "edr.process.v1", eventType: "process_enumeration_simulation", behavior: "synthetic process inventory metadata only" },
  NETWORK_ENUMERATION_SIMULATION: { eventVersion: "edr.network.v1", eventType: "network_enumeration_simulation", behavior: "synthetic network inventory metadata only" },
  FILE_ACCESS_SIMULATION: { eventVersion: "edr.file.v1", eventType: "file_access_simulation", behavior: "synthetic file-access metadata only" },
  BEACON_TEST: { eventVersion: "edr.network.v1", eventType: "network_beacon_simulation", behavior: "synthetic periodic beacon metadata only" },
  SLEEP_JITTER_TEST: { eventVersion: "edr.identity.v1", eventType: "identity_jitter_simulation", behavior: "synthetic timing jitter metadata only" },
  EXFILTRATION_SIMULATION: { eventVersion: "edr.network.v1", eventType: "network_exfiltration_simulation", behavior: "synthetic transfer metadata only; no data leaves the range" },
});
const C2_RUNS = new Map();

function c2SafetyFailure(body) {
  const required = { range: "authorized-cyber-range", authorized: true, syntheticTarget: true, isolated: true, safeSimulationMode: true };
  return Object.entries(required).find(([key, value]) => body[key] !== value);
}

function c2Event(runId, agentId, taskName, task, index, scenario) {
  const observedAt = new Date(Date.now() + index * (scenario.jitterMs || 0)).toISOString();
  const detectedPath = scenario.mode === "detected";
  return {
    synthetic: true,
    eventVersion: task.eventVersion,
    eventId: `sim-${runId}-${agentId}-${index}`,
    eventType: task.eventType,
    collector: "simulated-c2",
    observedAt,
    hostId: agentId,
    processName: task.eventVersion === "edr.process.v1" ? "simulated-agent" : "",
    parentProcess: task.eventVersion === "edr.process.v1" ? "simulated-range-controller" : "",
    commandLine: "",
    destinationIp: "127.0.0.1",
    destinationPort: task.eventVersion === "edr.network.v1" ? (detectedPath ? 443 : 8443) : null,
    username: "synthetic-agent",
    simulationId: runId,
    taskId: `task-${runId}-${index}`,
    behavior: task.behavior,
    jitterMs: scenario.jitterMs || 0,
  };
}

async function handleC2Catalog() {
  return json({ ok: true, mode: "contained-cyber-range", safety: { bind: "localhost-or-isolated-range-only", arbitraryCommands: false, externalAgents: false, scanning: false, persistence: false, privilegeEscalation: false, tunneling: false, lateralMovement: false, malware: false, fileTransfer: false }, tasks: Object.entries(C2_TASKS).map(([name, task]) => ({ name, ...task })), scenarios: [{ name: "detected-beacon", mode: "detected", expectedDetection: true }, { name: "not-detected-benign-periodic", mode: "not-detected", expectedDetection: false }] });
}

async function handleC2Run(request, env) {
  const body = await request.json().catch(() => null) || {};
  const failed = c2SafetyFailure(body);
  if (failed) return json({ error: `Simulation blocked: safety preflight failed at ${failed[0]}.`, state: "BLOCKED" }, 403);
  const scenario = ["detected", "not-detected"].includes(body.mode) ? { mode: body.mode, jitterMs: Math.min(5000, Math.max(0, Number(body.jitterMs) || 0)) } : null;
  const taskName = typeof body.task === "string" ? body.task : "BEACON_TEST";
  if (!scenario || !C2_TASKS[taskName]) return json({ error: "Use a predefined task and mode: detected or not-detected.", state: "REJECTED" }, 400);
  const agentCount = Math.min(5, Math.max(1, Number(body.agentCount) || 1));
  const runId = `c2sim-${crypto.randomUUID()}`;
  const task = C2_TASKS[taskName];
  const events = [];
  for (let agent = 1; agent <= agentCount; agent++) events.push(c2Event(runId, `synthetic-agent-${agent}`, taskName, task, agent - 1, scenario));
  const startedAt = Date.now();
  const response = await handleEdrEvents(new Request(request.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ events }) }), env);
  const result = await response.json();
  const detections = Array.isArray(result.events) ? result.events.map((item) => item.detection) : [];
  const actualDetection = detections.some((item) => item.status === "detected");
  const run = { simulationId: runId, syntheticAgentIds: events.map((event) => event.hostId), task: taskName, mode: scenario.mode, expectedDetection: scenario.mode === "detected", actualDetection, detectionLatencyMs: Date.now() - startedAt, telemetryReceived: events.length, telemetryMissing: result.count !== events.length, falsePositiveOrNegative: actualDetection !== (scenario.mode === "detected") ? "mismatch" : "match", containment: { status: "not-requested" }, recovery: "pending", evidenceRetained: true, provenance: "SIMULATED_C2", result };
  C2_RUNS.set(runId, run);
  if (C2_RUNS.size > 100) C2_RUNS.delete(C2_RUNS.keys().next().value);
  return json({ ok: true, mode: "contained-cyber-range", run });
}

async function handleC2Contain(request) {
  const body = await request.json().catch(() => null) || {};
  const failed = c2SafetyFailure(body);
  if (failed) return json({ error: `Containment blocked: safety preflight failed at ${failed[0]}.`, state: "BLOCKED" }, 403);
  const runId = typeof body.simulationId === "string" ? body.simulationId : "";
  const run = C2_RUNS.get(runId);
  if (!run) return json({ error: "Simulation not found in this Worker isolate.", state: "NOT_FOUND" }, 404);
  run.containment = { status: "contained", action: "SIMULATED_AGENT_ISOLATED", executedAgainst: run.syntheticAgentIds, externalEffect: false };
  run.recovery = "verified-in-range";
  return json({ ok: true, mode: "contained-cyber-range", simulationId: runId, containment: run.containment, recovery: run.recovery, evidenceRetained: run.evidenceRetained });
}

async function scopedRun(request, env) {
  let body;
  try { body = await request.json(); } catch { return { error: json({ error: "Invalid JSON body." }, 400) }; }
  const runId = Number.isInteger(body.runId) ? body.runId : Number(body.runId);
  const accessToken = typeof body.accessToken === "string" ? body.accessToken.slice(0, 200) : "";
  if (!Number.isInteger(runId) || runId < 1 || !accessToken) return { error: json({ error: "runId and accessToken are required." }, 400) };
  const db = aiDb(env);
  if (!db) return { error: json({ error: "Encrypted memory database is not configured." }, 503) };
  try {
    const { results } = await db.prepare("SELECT r.id, r.request_id, r.mode, r.model, r.input_chars, r.output_json, r.confidence, r.created_at FROM ai_runs r JOIN ai_run_access a ON a.run_id = r.id WHERE r.id = ? AND a.token_hash = ? LIMIT 1").bind(runId, await sha256Hex(accessToken)).all();
    if (!results || !results[0]) return { error: json({ error: "Run not found or access token invalid." }, 404) };
    return { db, row: results[0], runId };
  } catch { return { error: json({ error: "Privacy control unavailable; verify the ai_run_access migration is applied." }, 503) }; }
}

async function handlePrivacyExport(request, env) {
  const scoped = await scopedRun(request, env);
  if (scoped.error) return scoped.error;
  return json({ ok: true, export: { format: "encrypted-json", run: { id: scoped.row.id, requestId: scoped.row.request_id, mode: scoped.row.mode, model: scoped.row.model, inputChars: scoped.row.input_chars, confidence: scoped.row.confidence, createdAt: scoped.row.created_at, encryptedOutput: scoped.row.output_json } }, limitation: "The exported payload remains AES-256-GCM encrypted. The customer or authorized operator must retain the deployment key to decrypt it." });
}

async function handlePrivacyDelete(request, env) {
  const scoped = await scopedRun(request, env);
  if (scoped.error) return scoped.error;
  try {
    await scoped.db.batch([
      scoped.db.prepare("DELETE FROM ai_claims WHERE run_id = ?").bind(scoped.runId),
      scoped.db.prepare("DELETE FROM ai_feedback WHERE run_id = ?").bind(scoped.runId),
      scoped.db.prepare("DELETE FROM ai_run_access WHERE run_id = ?").bind(scoped.runId),
      scoped.db.prepare("DELETE FROM ai_runs WHERE id = ?").bind(scoped.runId),
    ]);
    return json({ ok: true, deleted: true, runId: scoped.runId });
  } catch { return json({ error: "Deletion failed; no completion claim was made." }, 500); }
}

/* ---------- privacy controls ---------- */


/* ---------- safe public-web research browser ---------- */

const RESEARCH_MAX_BYTES = 128 * 1024;
const RESEARCH_MAX_REDIRECTS = 3;
const PRIVATE_HOST_RE = /^(localhost|.*\.localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|::1|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})$/i;
const INJECTION_RE = /(ignore|disregard|forget)\s+(all|any|previous|prior)\s+(instructions|rules)|system\s+message|developer\s+message|reveal\s+(your|the)\s+(prompt|secrets|credentials)|click\s+this\s+link\s+to\s+continue/i;

function researchUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password || PRIVATE_HOST_RE.test(parsed.hostname)) return null;
    if (parsed.port && parsed.port !== "443") return null;
    parsed.hash = "";
    return parsed;
  } catch { return null; }
}

function htmlToResearchText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ").trim();
}

function researchLinks(html, base) {
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(html)) && links.length < 30) {
    try {
      const target = new URL(match[1], base);
      if (target.protocol !== "https:" || target.username || target.password || PRIVATE_HOST_RE.test(target.hostname)) continue;
      target.hash = "";
      const href = target.toString();
      if (!seen.has(href)) { seen.add(href); links.push(href); }
    } catch { /* malformed links are ignored */ }
  }
  return links;
}

async function allowedByRobots(target) {
  try {
    const robotsUrl = new URL("/robots.txt", target.origin);
    const response = await fetch(robotsUrl, { headers: { "user-agent": "CorporaAI-Research/1.0 (+public-research; respects robots.txt)" } });
    if (!response.ok) return { checked: true, allowed: true, status: response.status };
    const text = (await response.text()).slice(0, 20000);
    let applies = false;
    let disallowed = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.split("#")[0].trim();
      const separator = line.indexOf(":");
      if (separator < 0) continue;
      const key = line.slice(0, separator).trim().toLowerCase();
      const value = line.slice(separator + 1).trim();
      if (key === "user-agent") applies = value === "*" || /corpora/i.test(value);
      if (applies && key === "disallow" && value) disallowed.push(value);
    }
    const path = target.pathname || "/";
    const blocked = disallowed.some((rule) => rule === "/" || path.startsWith(rule));
    return { checked: true, allowed: !blocked, status: response.status, matchedRules: blocked ? disallowed : [] };
  } catch { return { checked: false, allowed: false, status: null, reason: "robots.txt could not be checked" }; }
}

async function handleResearchFetch(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "research-unknown";
  if (rateLimited("research:" + ip)) return json({ error: "Research rate limit exceeded; try again later." }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  if (body.authorized !== true) return json({ error: "Explicit user authorization is required before public-web retrieval." }, 400);
  const requested = researchUrl(body.url);
  if (!requested) return json({ error: "Only public HTTPS URLs without credentials, private hosts, or non-standard ports are allowed." }, 400);
  const robots = await allowedByRobots(requested);
  if (!robots.allowed) return json({ error: "Retrieval blocked by robots.txt or robots policy could not be verified.", requestedUrl: requested.toString(), robots }, 403);
  let current = requested;
  let response;
  const redirectChain = [];
  for (let hop = 0; hop <= RESEARCH_MAX_REDIRECTS; hop++) {
    try {
      response = await fetch(current, { redirect: "manual", headers: { "accept": "text/html,text/plain,application/json;q=0.8", "user-agent": "CorporaAI-Research/1.0 (+public-research; no login or bypass)" } });
    } catch { return json({ error: "Public source could not be retrieved; no retry or bypass was attempted.", requestedUrl: requested.toString(), redirectChain }, 502); }
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    const next = location && researchUrl(new URL(location, current).toString());
    if (!next) return json({ error: "Redirect leaves the allowed public HTTPS boundary.", requestedUrl: requested.toString(), redirectChain }, 403);
    redirectChain.push({ from: current.toString(), to: next.toString(), status: response.status });
    if (hop === RESEARCH_MAX_REDIRECTS) return json({ error: "Redirect limit reached.", requestedUrl: requested.toString(), redirectChain }, 508);
    current = next;
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > RESEARCH_MAX_BYTES) return json({ error: "Retrieved document exceeds the 128KB research limit.", requestedUrl: requested.toString(), finalUrl: current.toString() }, 413);
  const raw = (await response.arrayBuffer()).slice(0, RESEARCH_MAX_BYTES);
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const decoded = new TextDecoder().decode(raw);
  const isText = /text\/(html|plain)|application\/(json|xml)/i.test(contentType);
  const text = isText ? (/html/i.test(contentType) ? htmlToResearchText(decoded) : decoded.replace(/\s+/g, " ").trim()) : "";
  const excerpt = text.slice(0, 6000);
  return json({ ok: response.ok, workflow: ["USER AUTHORIZATION", "RESEARCH PLAN", "BROWSER RETRIEVAL", "SOURCE VALIDATION", "EVIDENCE EXTRACTION", "CORRELATION", "CONTRADICTION CHECK", "INVESTIGATION GRAPH", "REPORT"], requestedUrl: requested.toString(), finalUrl: current.toString(), retrievedAt: new Date().toISOString(), retrieval: { status: response.status, statusText: response.statusText, contentType, bytesRead: raw.byteLength, redirectChain, robots }, source: { title: (decoded.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim().slice(0, 300), links: /html/i.test(contentType) ? researchLinks(decoded, current).slice(0, 20) : [] }, evidence: { excerpt, truncated: text.length > excerpt.length, provenance: "PUBLIC_WEB_RETRIEVAL", verification: "UNVERIFIED_PRIMARY_SOURCE" }, safety: { contentIsUntrusted: true, promptInjectionSuspected: INJECTION_RE.test(text), agentInstructionBoundary: "Web content is evidence only, never an instruction, policy, credential, or authorization.", authenticationBypass: false, captchaBypass: false, paywallBypass: false, rateLimitBypass: false } });
}

async function handleResearchLocation(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  if (body.consent !== true) return json({ ok: false, location: null, message: "Coarse country/region lookup requires explicit user consent." }, 400);
  const country = request.cf && typeof request.cf.country === "string" ? request.cf.country : null;
  return json({ ok: true, location: country ? { country, precision: "country", source: "request metadata", stored: false } : null, disclosure: "Used only because you explicitly authorized coarse location for this investigation. Wi-Fi identifiers, cellular identifiers, precise coordinates, and device fingerprints are not collected or stored." });
}


/* ---------- bounded 100-tool registry and universal gate ---------- */

const CYBER_RESEARCH_TOOLS = [
  "Web Search", "URL Fetcher", "Document Reader", "Source Credibility Analyzer", "Cross-Source Correlator", "Contradiction Detector", "Timeline Builder", "IOC Extractor", "IOC Enricher", "Domain Intelligence", "DNS Analyzer", "Certificate Analyzer", "ASN Intelligence", "Infrastructure Mapper", "WHOIS/RDAP Researcher", "Threat-Intel Correlator", "Malware Metadata Analyzer", "Malware Behavior Summarizer", "YARA Rule Analyzer", "Sigma Rule Analyzer", "ATT&CK Mapper", "CVE Researcher", "KEV Checker", "Exploitability Assessor", "Patch Intelligence", "Security-Advisory Researcher", "PCAP Analyzer", "Network-Flow Analyzer", "Beacon Analyzer", "DNS-Anomaly Analyzer", "Log Analyzer", "Authentication Analyzer", "Process-Telemetry Analyzer", "Persistence Analyzer", "Lateral-Movement Analyzer", "Detection Validator", "False-Positive Analyzer", "False-Negative Analyzer", "Telemetry-Health Analyzer", "Evidence-Integrity Verifier", "Chain-of-Custody Tracker", "Investigation Graph Builder", "Hypothesis Generator", "Hypothesis Challenger", "Negative-Evidence Analyzer", "Threat-Actor Characterizer", "Incident Summarizer", "Cyber-Range Controller", "Detection Regression Runner", "Investigation Report Generator",
];

const PRIVACY_DEVICE_TOOLS = [
  "Privacy Exposure Scanner", "Data-Broker Directory Search", "Broker Relationship Mapper", "Opt-Out Locator", "Opt-Out Instructions Generator", "Privacy-Policy Analyzer", "Privacy-Policy Diff", "Terms Analyzer", "Data-Collection Classifier", "Data-Sharing Analyzer", "Data-Retention Analyzer", "Data-Deletion Analyzer", "Data-Access Request Generator", "Deletion-Request Generator", "Correction-Request Generator", "Privacy-Rights Navigator", "Consent Audit", "Cookie Analyzer", "Tracker Detector", "Third-Party Script Analyzer", "App Permission Auditor", "Device Permission Auditor", "Location-Access Auditor", "Background-Activity Analyzer", "Network-Connection Viewer", "DNS-Privacy Checker", "Certificate/TLS Checker", "Wi-Fi Security Auditor", "Router Configuration Auditor", "Firewall Status Checker", "Security-Update Checker", "Application-Update Auditor", "Installed-Software Auditor", "Startup-Application Auditor", "Browser-Extension Auditor", "Credential-Exposure Checker", "Password-Hygiene Analyzer", "MFA Auditor", "Account-Security Auditor", "Session Audit", "Device-Telemetry Health Check", "Local EDR Health Check", "Suspicious-Process Detector", "Suspicious-Network-Activity Detector", "Phishing Analyzer", "Scam/Impersonation Analyzer", "Privacy Risk Mapper", "Personal Data Inventory", "Data-Lifecycle Viewer", "Privacy Defense Report",
];

function toolSlug(name) { return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function makeTool(name, index, category) {
  const simulationOnly = name === "Cyber-Range Controller" || name === "Detection Regression Runner";
  const sensitive = category === "privacy-device-defense" || /Credential|Password|MFA|Account|Session|Location|Personal Data|Device|Wi-Fi|Router|Firewall|Network-Connection/.test(name);
  const publicResearch = category === "cybersecurity-research" && !/PCAP|Log|Process|Telemetry|Authentication|Persistence|Lateral|Network-Flow/.test(name);
  return {
    id: `${String(index + 1).padStart(3, "0")}-${toolSlug(name)}`,
    number: index + 1,
    name,
    category,
    purpose: simulationOnly ? "Run a predefined harmless defensive exercise in an authorized isolated range." : `Perform bounded ${name.toLowerCase()} for defensive research and user-authorized analysis.`,
    readOnly: true,
    requiresUserAuthorization: true,
    targetScope: simulationOnly ? "authorized synthetic target only" : (publicResearch ? "public sources only" : (category === "privacy-device-defense" ? "user-owned data or device only" : "authorized evidence only")),
    dataClasses: sensitive ? ["customer-provided sensitive data", "security metadata"] : ["public research data", "defensive evidence"],
    geographicScope: sensitive ? "customer-declared jurisdiction; coarse region only when separately consented" : "declared investigation scope",
    externalSideEffects: false,
    retentionBehavior: "no raw input by default; retain only explicitly opted-in encrypted outputs and provenance metadata",
    provenanceRequired: true,
    rateLimit: "bounded per-request and per-origin rate limits",
    simulationOnly,
    escalationRequired: simulationOnly || sensitive,
    authorizationBoundary: simulationOnly ? "Predefined simulation labels only; no shell, exploit, malware, credential theft, persistence, lateral movement, external C2, or arbitrary target." : "The tool cannot expand scope, infer consent, or turn evidence into authority.",
    availability: ["URL Fetcher", "Web Search"].includes(name) ? "research-browser-backed" : "catalogued-policy-envelope",
  };
}

const TOOL_CATALOG = Object.freeze([
  ...CYBER_RESEARCH_TOOLS.map((name, index) => makeTool(name, index, "cybersecurity-research")),
  ...PRIVACY_DEVICE_TOOLS.map((name, index) => makeTool(name, index + CYBER_RESEARCH_TOOLS.length, "privacy-device-defense")),
]);

function toolGate(tool, body) {
  if (!tool) return { allowed: false, reason: "Unknown tool identifier." };
  if (body.authorization !== true) return { allowed: false, reason: "Explicit user authorization is required." };
  if (tool.simulationOnly && (body.simulationMode !== true || body.targetScope !== "authorized synthetic target")) return { allowed: false, reason: "This tool is restricted to an explicitly authorized synthetic target and predefined simulation mode." };
  if (tool.externalSideEffects && body.confirmedSideEffect !== true) return { allowed: false, reason: "An explicit side-effect confirmation is required." };
  if (tool.escalationRequired && body.humanReview !== true) return { allowed: false, reason: "Human review is required for this sensitive or simulation-scoped tool." };
  return { allowed: true, reason: "Policy envelope satisfied; execution remains limited to the declared scope." };
}

async function handleToolCatalog() {
  return json({ ok: true, count: TOOL_CATALOG.length, policy: "Every tool is bounded by purpose, authorization, scope, data class, geography, side effects, retention, provenance, rate limit, simulation status, and escalation requirements.", tools: TOOL_CATALOG });
}

async function handleToolAuthorization(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
  const tool = TOOL_CATALOG.find((item) => item.id === body.toolId || item.name === body.toolName);
  const decision = toolGate(tool, body);
  return json({ ok: decision.allowed, decision: decision.allowed ? "ALLOW" : "DENY", tool: tool || null, reason: decision.reason, execution: "This endpoint authorizes policy only; it does not execute arbitrary commands, scans, exploitation, collection, or external side effects." }, decision.allowed ? 200 : 403);
}


/* ---------- consented login and ad-observation service ---------- */

const LOGIN_KEYS = new Map();
const LOGIN_SESSIONS = new Map();
const LOGIN_TTL_MS = 60 * 60 * 1000;
const LOGIN_PROVIDERS = ["iCloud", "GitHub", "Gmail", "Work email", "YouTube", "One-time API key"];

function newSecret() { return crypto.randomUUID() + "-" + crypto.randomUUID(); }
function pruneLoginState() {
  const now = Date.now();
  for (const [key, item] of LOGIN_KEYS) if (item.expiresAt < now) LOGIN_KEYS.delete(key);
  for (const [key, item] of LOGIN_SESSIONS) if (item.expiresAt < now) LOGIN_SESSIONS.delete(key);
}
async function readJson(request) { try { return await request.json(); } catch { return null; } }

async function handleKeyIssue() {
  pruneLoginState();
  const key = newSecret();
  LOGIN_KEYS.set(await sha256Hex(key), { expiresAt: Date.now() + 10 * 60 * 1000, used: false });
  return json({ ok: true, provider: "One-time API key", apiKey: key, expiresInSeconds: 600, use: "Enter this key in the portal to create a temporary session.", storage: "The plaintext key is returned once and is not stored; only a hash is held in this Worker isolate until expiry." });
}

async function handleKeyVerify(request) {
  pruneLoginState();
  const body = await readJson(request);
  const apiKey = body && typeof body.apiKey === "string" ? body.apiKey.slice(0, 200) : "";
  const hash = apiKey ? await sha256Hex(apiKey) : "";
  const record = LOGIN_KEYS.get(hash);
  if (!record || record.used || record.expiresAt < Date.now()) return json({ error: "Invalid or expired one-time API key." }, 401);
  record.used = true;
  const sessionToken = newSecret();
  LOGIN_SESSIONS.set(await sha256Hex(sessionToken), { expiresAt: Date.now() + LOGIN_TTL_MS, provider: "One-time API key", consented: false });
  return json({ ok: true, sessionToken, expiresInSeconds: LOGIN_TTL_MS / 1000, next: "Present explicit data-source and ad-observation consent before submitting observations." });
}

async function handleProviderLogin(request) {
  const body = await readJson(request);
  const provider = body && typeof body.provider === "string" ? body.provider : "";
  if (!LOGIN_PROVIDERS.includes(provider)) return json({ error: "Unsupported login provider." }, 400);
  if (provider === "One-time API key") return json({ ok: true, next: "Use POST /api/login/key/issue to generate a one-time key." });
  return json({ ok: false, state: "OAUTH_NOT_CONFIGURED", provider, message: `${provider} login requires a separately registered OAuth application and scoped connector. No credentials were requested or collected by this Worker.`, requiredScopes: ["identity only", "no mailbox contents", "no message bodies", "no contact import"] }, 501);
}

async function sessionFromRequest(request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const hash = await sha256Hex(token);
  const session = LOGIN_SESSIONS.get(hash);
  if (!session || session.expiresAt < Date.now()) { LOGIN_SESSIONS.delete(hash); return null; }
  return session;
}

function classifyAdObservation(body) {
  const text = `${body.adText || ""} ${body.context || ""}`.toLowerCase();
  const categories = [];
  const rules = [
    [/(running|shoes|fitness|workout|gym|protein)/, "health, fitness, or activity interest"],
    [/(loan|credit|bank|insurance|mortgage|invest)/, "financial-product interest"],
    [/(travel|flight|hotel|vacation|airline)/, "travel intent"],
    [/(phone|laptop|computer|software|gadget|device)/, "technology or product interest"],
    [/(car|auto|vehicle|truck)/, "automotive interest"],
    [/(baby|parent|diaper|family)/, "family or life-stage signal"],
    [/(sale|discount|coupon|shop|buy|deal)/, "shopping or commercial intent"],
  ];
  for (const [pattern, label] of rules) if (pattern.test(text)) categories.push(label);
  if (!categories.length) categories.push("unclassified contextual or broad-interest signal");
  const company = typeof body.advertiser === "string" && body.advertiser.trim() ? body.advertiser.trim().slice(0, 160) : "advertiser not supplied";
  return { likelyCategories: [...new Set(categories)], advertiser: company, explanation: "These are hypotheses from the observation supplied by the user. They do not prove the advertiser purchased or received a personal dossier, and they do not identify a person-level data source.", possibleSignals: ["page or video context", "recent search or browsing intent", "broad interest segment", "geographic or language context", "advertiser first-party interaction"], unknowns: ["actual platform auction inputs", "whether a data broker was involved", "retention period", "identity linkage"], nextSteps: ["Open the platform's ad-preferences explanation.", "Review the advertiser and platform privacy policies.", "Compare multiple observations over time without adding sensitive identifiers."], rawObservationStored: false };
}

async function handleAdObservation(request) {
  const session = await sessionFromRequest(request);
  if (!session) return json({ error: "Login required before ad-observation analysis." }, 401);
  const body = await readJson(request);
  if (!body || body.consent !== true || body.dataScope !== "ad-observations-only") return json({ error: "Explicit consent for ad observations and the restricted data scope are required." }, 400);
  if (body.retention !== "session-only") return json({ error: "This preview accepts session-only retention; persistent profiling is not enabled." }, 400);
  if (!LOGIN_PROVIDERS.includes(body.source)) return json({ error: "Choose a declared available data source." }, 400);
  const adText = typeof body.adText === "string" ? body.adText.trim().slice(0, 4000) : "";
  if (!adText) return json({ error: "Supply an observed ad label or description; private account content is not accepted." }, 400);
  const result = classifyAdObservation({ ...body, adText });
  return json({ ok: true, workflow: ["LOGIN", "EXPLICIT CONSENT", "CONNECT AVAILABLE DATA SOURCE", "COLLECT PERMITTED AD OBSERVATION", "EXPLAIN WHY IT MAY HAVE APPEARED", "SHOW COMPANIES AND DATA CATEGORIES", "REPORT"], source: body.source, analyzedAt: new Date().toISOString(), retention: "session-only", result, privacyBoundary: "No mailbox, message body, contacts, password, private account history, precise location, Wi-Fi, cellular, or device fingerprint was requested or stored." });
}
