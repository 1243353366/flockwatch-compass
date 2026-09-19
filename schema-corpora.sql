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
