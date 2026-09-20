-- Corpora AI intelligence index, stored in the existing D1 binding.
-- The AI tables are an evaluation/memory layer, not a model-weight trainer.
CREATE TABLE IF NOT EXISTS corpora (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  keywords TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_corpora_source ON corpora(source);
CREATE INDEX IF NOT EXISTS idx_corpora_created_at ON corpora(created_at DESC);

-- Opt-in normalized document metadata for retrieval and provenance.
CREATE TABLE IF NOT EXISTS ai_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  corpus_id INTEGER,
  content_hash TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_documents_source ON ai_documents(source);

-- One record per opted-in analysis/evaluation case. No raw text is stored here.
CREATE TABLE IF NOT EXISTS ai_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL,
  model TEXT NOT NULL,
  input_chars INTEGER NOT NULL,
  output_json TEXT NOT NULL,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_runs_created_at ON ai_runs(created_at DESC);

-- Customer-scoped control token. Only a SHA-256 token hash is stored.
CREATE TABLE IF NOT EXISTS ai_run_access (
  run_id INTEGER PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Claims remain separate from observations so unsupported inferences can be scored.
CREATE TABLE IF NOT EXISTS ai_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  claim TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_claims_run_id ON ai_claims(run_id);

-- Human labels feed evaluation and regression review; they do not update model weights.
CREATE TABLE IF NOT EXISTS ai_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_run_id ON ai_feedback(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_label ON ai_feedback(label);


-- Catalogue-only references used to shape retrieval and evaluation plans.
-- These rows do not claim that source code or model weights were imported.
CREATE TABLE IF NOT EXISTS ai_source_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  license_status TEXT NOT NULL DEFAULT 'verify upstream before code reuse',
  creator TEXT NOT NULL,
  usage_mode TEXT NOT NULL DEFAULT 'reference-only',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_source_catalog_category ON ai_source_catalog(category);

INSERT OR IGNORE INTO ai_source_catalog (name, url, category, creator, notes) VALUES
('LangGraph', 'https://github.com/langchain-ai/langgraph', 'agent orchestration', 'LangChain AI / @langchain-ai', 'Stateful graphs, cycles, checkpoints, and human-in-the-loop patterns.'),
('smolagents', 'https://github.com/huggingface/smolagents', 'controlled tools', 'Hugging Face / @huggingface', 'Tool reasoning reference; no sandbox execution is enabled by this catalog.'),
('DSPy', 'https://github.com/stanfordnlp/dspy', 'reasoning optimization', 'Stanford NLP / @stanfordnlp', 'Measurable prompt and pipeline optimization reference.'),
('PydanticAI', 'https://github.com/pydantic/pydantic-ai', 'structured outputs', 'Pydantic / @pydantic', 'Typed claims, evidence, confidence, and tool-result patterns.'),
('LlamaIndex', 'https://github.com/run-llama/llama_index', 'retrieval', 'LlamaIndex / @run-llama', 'Knowledge, graph, document, and index retrieval reference.'),
('Haystack', 'https://github.com/deepset-ai/haystack', 'retrieval pipelines', 'deepset / @deepset-ai', 'Explicit retrieval, routing, and evaluation pipeline reference.'),
('Agno', 'https://github.com/agno-agi/agno', 'agent teams', 'Agno / @agno-agi', 'Agent, team, memory, and structured-output reference.'),
('AutoGen / AG2', 'https://github.com/microsoft/autogen', 'multi-agent review', 'Microsoft / @microsoft', 'Debate, delegation, review, and termination-condition reference.'),
('BeeAI Framework', 'https://github.com/i-am-bee/bee-agent-framework', 'agent workflows', 'BeeAI / @i-am-bee', 'Workflow, tool, memory, and structured-agent reference.'),
('OpenLLMetry', 'https://github.com/traceloop/openllmetry', 'observability', 'Traceloop / @traceloop', 'Tracing and evaluation observability reference for agent runs.');


-- Curated defensive knowledge seeds. These are provenance-bearing references,
-- not claims that content, malware, or executable tooling was imported.
INSERT OR IGNORE INTO ai_source_catalog (name, url, category, creator, usage_mode, notes) VALUES
('MITRE ATT&CK', 'https://attack.mitre.org/', 'behavior vocabulary', 'The MITRE Corporation / @mitre-attack', 'reference-only', 'Tactics, techniques, software, groups, and defensive mappings.'),
('MITRE ATT&CK STIX Data', 'https://github.com/mitre-attack/attack-stix-data', 'structured threat knowledge', 'The MITRE Corporation / @mitre-attack', 'reference-only', 'Versioned ATT&CK objects with provenance and relationships.'),
('NIST SP 800-61 Rev. 2', 'https://csrc.nist.gov/pubs/sp/800/61/r2/final', 'incident response', 'NIST / @NIST', 'reference-only', 'Incident-response lifecycle and handling guidance.'),
('NIST SP 800-115', 'https://csrc.nist.gov/pubs/sp/800/115/final', 'security testing', 'NIST / @NIST', 'reference-only', 'Planning and conducting authorized technical security tests.'),
('CISA Known Exploited Vulnerabilities Catalog', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', 'vulnerability intelligence', 'CISA / @CISA', 'reference-only', 'Publicly listed exploited vulnerabilities and remediation prioritization.'),
('MalwareBazaar', 'https://bazaar.abuse.ch/', 'malware intelligence', 'abuse.ch', 'reference-only', 'Sample metadata and indicators; no samples are downloaded or executed here.'),
('ThreatFox', 'https://threatfox.abuse.ch/', 'indicator intelligence', 'abuse.ch', 'reference-only', 'IOC relationships and sightings with source provenance.'),
('URLhaus', 'https://urlhaus.abuse.ch/', 'malicious URL intelligence', 'abuse.ch', 'reference-only', 'Malicious URL metadata; no external retrieval is performed by the proof path.'),
('YARAify', 'https://yaraify.abuse.ch/', 'malware rule intelligence', 'abuse.ch', 'reference-only', 'Rule and scan context; no live sample execution.'),
('ANY.RUN public reports', 'https://any.run/', 'sandbox reports', 'ANY.RUN', 'reference-only', 'Public analysis reports used as secondary evidence only.'),
('CAPE Sandbox', 'https://github.com/kevoreilly/capemon', 'sandbox analysis', 'CAPE contributors / @kevoreilly', 'reference-only', 'Sandbox methodology reference; not invoked by this Worker.'),
('VX-Underground', 'https://vx-underground.org/', 'malware research archive', 'VX-Underground', 'reference-only', 'Research archive reference; no samples are bundled or executed.');


-- Content-bearing knowledge documents used by read-only retrieval.
CREATE TABLE IF NOT EXISTS ai_knowledge_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  creator TEXT NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  observed_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,
  provenance_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_ai_knowledge_documents_category ON ai_knowledge_documents(category);

INSERT OR IGNORE INTO ai_knowledge_documents (source_name, source_url, category, creator, content, content_hash, provenance_json) VALUES
('MITRE ATT&CK', 'https://attack.mitre.org/', 'behavior vocabulary', 'The MITRE Corporation / @mitre-attack', 'MITRE ATT&CK is a knowledge base for adversary tactics and techniques. Use it as a behavioral vocabulary and map only behaviors supported by evidence; observing one technique does not establish a complete attack chain.', 'seed-mitre-attack-v1', '{"classification":"REFERENCE","usage":"defensive-analysis"}'),
('NIST SP 800-61', 'https://csrc.nist.gov/pubs/sp/800/61/r2/final', 'incident response', 'NIST / @NIST', 'Incident response guidance organizes preparation, detection and analysis, containment, eradication and recovery, and post-incident activity. Preserve evidence and record decisions throughout the lifecycle.', 'seed-nist-800-61-v1', '{"classification":"REFERENCE","usage":"incident-response"}'),
('NIST SP 800-115', 'https://csrc.nist.gov/pubs/sp/800/115/final', 'security testing', 'NIST / @NIST', 'Technical security testing requires planning, authorization, defined scope, controlled execution, evidence collection, and reporting. Testing must not silently expand to systems outside the approved scope.', 'seed-nist-800-115-v1', '{"classification":"REFERENCE","usage":"authorized-testing"}'),
('CISA KEV Catalog', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', 'vulnerability intelligence', 'CISA / @CISA', 'The Known Exploited Vulnerabilities Catalog identifies vulnerabilities with evidence of exploitation and supports remediation prioritization. Catalog membership is not proof that a specific local asset is compromised.', 'seed-cisa-kev-v1', '{"classification":"REFERENCE","usage":"prioritization"}'),
('MalwareBazaar', 'https://bazaar.abuse.ch/', 'malware intelligence', 'abuse.ch', 'MalwareBazaar provides malware sample metadata and indicators. This deployment stores reference content only and does not download or execute samples.', 'seed-malwarebazaar-v1', '{"classification":"REFERENCE","usage":"metadata-only"}'),
('ThreatFox', 'https://threatfox.abuse.ch/', 'indicator intelligence', 'abuse.ch', 'ThreatFox provides indicator relationships and sightings. Indicators remain hypotheses until corroborated with local telemetry and timestamps.', 'seed-threatfox-v1', '{"classification":"REFERENCE","usage":"indicator-correlation"}'),
('URLhaus', 'https://urlhaus.abuse.ch/', 'malicious URL intelligence', 'abuse.ch', 'URLhaus provides malicious URL metadata. Retrieval is read-only and does not contact or fetch the listed URLs.', 'seed-urlhaus-v1', '{"classification":"REFERENCE","usage":"metadata-only"}');

-- Synthetic EDR events are structured telemetry fixtures, not host agents.
CREATE TABLE IF NOT EXISTS edr_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,
  observation_id TEXT NOT NULL UNIQUE,
  event_version TEXT NOT NULL,
  event_type TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  host_id TEXT NOT NULL,
  process_name TEXT NOT NULL DEFAULT '',
  parent_process TEXT NOT NULL DEFAULT '',
  command_line TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT '',
  destination_ip TEXT NOT NULL DEFAULT '',
  destination_port INTEGER,
  username TEXT NOT NULL DEFAULT '',
  synthetic INTEGER NOT NULL DEFAULT 1,
  provenance_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edr_events_observed_at ON edr_events(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_edr_events_host_id ON edr_events(host_id);

CREATE TABLE IF NOT EXISTS edr_detections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  alert_id TEXT NOT NULL UNIQUE,
  correlation_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence REAL NOT NULL,
  status TEXT NOT NULL,
  rationale TEXT NOT NULL,
  false_positive_notes TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edr_detections_event_id ON edr_detections(event_id);


CREATE TABLE IF NOT EXISTS edr_rejections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rejection_id TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  event_hash TEXT NOT NULL,
  event_version TEXT NOT NULL DEFAULT 'unknown',
  received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_edr_rejections_received_at ON edr_rejections(received_at DESC);
