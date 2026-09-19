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
  const result = { ok: true, mode: ai ? "ai+algorithmic" : "algorithmic", ...algo, ai };
  if (body.persist === true) result.runId = await persistAnalysis(env, result, text.length);
  return json(result);
}

function aiDb(env) { return env.AI_DB || env.DB; }

async function persistAnalysis(env, result, inputChars) {
  const db = aiDb(env);
  if (!db) return null;
  const requestId = crypto.randomUUID();
  const output = JSON.stringify({ summary: result.ai && result.ai.summary, topics: result.ai && result.ai.topics || [], entities: result.ai && result.ai.entities || [], algorithmic: result.stats });
  try {
    const inserted = await db.prepare("INSERT INTO ai_runs (request_id, mode, model, input_chars, output_json, confidence) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(requestId, result.mode, result.ai ? AI_MODEL : "algorithmic", inputChars, output, result.ai ? 0.5 : null).run();
    const runId = inserted.meta && inserted.meta.last_row_id;
    if (runId && result.ai && result.ai.summary) {
      await db.prepare("INSERT INTO ai_claims (run_id, claim, claim_type, evidence_json, confidence, verification_status) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(runId, result.ai.summary.slice(0, 1200), "summary", JSON.stringify(result.ai.entities || []), 0.5, "unverified").run();
    }
    return runId || requestId;
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

async function handleSourceCatalog(request, env) {
  const db = aiDb(env);
  if (!db) return json({ error: "AI memory database not bound." }, 503);
  const q = (new URL(request.url).searchParams.get("q") || "").trim().slice(0, 120).toLowerCase();
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
<main>
  <section class="hero">
    <h1>Paste a corpus.<br>Get the intelligence out.</h1>
    <p class="sub">Summary, entities, topics, key terms and readability &mdash; Workers AI plus an algorithmic pass, in one request.</p>
  </section>
  <section class="input-card">
    <label class="lbl" for="input">Your text corpus (up to 32KB)</label>
    <textarea id="input" rows="8" placeholder="Paste an article, a report, a thread, research notes&hellip;"></textarea>
    <label class="consent"><input id="persist" type="checkbox"> Save an evaluation case for human review (stores output metadata, not raw text)</label>
    <div class="row">
      <button id="analyze" class="cta" type="button">Analyze corpus</button>
      <span id="msg" class="msg" role="status" aria-live="polite"></span>
    </div>
  </section>
  <section class="input-card catalog-card"><div class="lbl">Agent architecture catalog</div><p class="muted">Reference-only sources shaping retrieval, structured claims, evaluation, and observability. No upstream code is executed here.</p><div id="source-catalog" class="catalog">Loading source catalog&hellip;</div></section>
  <section id="results" hidden>
    <div class="grid">
      <article class="card"><h2>Summary</h2><p id="summary" class="muted">—</p><p id="sentiment" class="tagline"></p></article>
      <article class="card"><h2>Topics</h2><div id="topics" class="chips"></div><h2 class="mt">Entities</h2><div id="entities" class="chips"></div></article>
      <article class="card"><h2>Key terms</h2><div id="keywords" class="bars"></div></article>
      <article class="card"><h2>Corpus stats</h2><div id="stats" class="tiles"></div><p class="tagline" id="readability"></p></article>
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
.row{display:flex;align-items:center;gap:14px;margin-top:14px;flex-wrap:wrap}
.cta{background:var(--accent);color:var(--accent-ink);border:0;border-radius:10px;padding:12px 22px;font-weight:600;font-size:1rem;cursor:pointer}
.cta:disabled{opacity:.55;cursor:wait}
.msg{color:var(--muted);font-size:.9rem}
.consent{display:flex;gap:8px;align-items:flex-start;color:var(--muted);font-size:.82rem;margin-top:12px}
.consent input{accent-color:var(--accent);margin-top:5px}
.catalog-card{margin-top:18px}.catalog{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.source{background:var(--chip);border:1px solid var(--border);border-radius:10px;padding:10px}.source a{color:var(--text);font-weight:600;text-decoration:none}.source small{display:block;color:var(--muted);font-size:.75rem;margin-top:3px}
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
    msg.textContent = data.runId ? "Analyzed and saved as evaluation run " + data.runId + "." : (data.mode === "ai+algorithmic" ? "Analyzed with Workers AI + algorithmic pass." : "Analyzed in algorithmic mode (AI unavailable right now).");
  } catch (e) { msg.textContent = e.message; }
  $("analyze").disabled = false;
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
}`;

/* ---------- router ---------- */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET") {
      if (url.pathname === "/" || url.pathname === "/index.html") return asset(PAGE, "text/html; charset=utf-8");
      if (url.pathname === "/style.css") return asset(PAGE_CSS, "text/css; charset=utf-8");
      if (url.pathname === "/app.js") return asset(PAGE_JS, "application/javascript; charset=utf-8");
      if (url.pathname === "/health") return json({ ok: true, service: "corpora-ai", mode: env.AI ? "ai+algorithmic" : "algorithmic", corporaDb: !!env.DB, aiMemoryDb: !!aiDb(env), model: AI_MODEL });
    }
    if (request.method === "POST" && url.pathname === "/api/analyze") return handleAnalyze(request, env);
    if (request.method === "POST" && url.pathname === "/api/corpora/ingest") return handleIngest(request, env);
    if (request.method === "GET" && url.pathname === "/api/corpora/search") return handleCorporaSearch(request, env);
    if (request.method === "GET" && url.pathname === "/api/corpora/sources") return handleSourceCatalog(request, env);
    if (request.method === "POST" && url.pathname === "/api/ai/feedback") return handleFeedback(request, env);
    return new Response("Not found", { status: 404, headers: secHeaders({ "content-type": "text/plain; charset=utf-8" }) });
  },
};
