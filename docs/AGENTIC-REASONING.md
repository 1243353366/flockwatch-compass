# Agentic Reasoning Architecture

## Overview

FlockWatch Compass combines two codebases into an agentic platform:

1. **FlockWatch** (Python) — detection engine: ingests WiGLE/ESP32/Flipper/SDR data, scores detections, extracts RF fingerprints, generates maps
2. **Project Compass** (Node.js) — decision-support framework: evidence chains, recommendation engine, web UI, security, rate limiting, optional AI narrative

The agentic layer sits on top, using AI reasoning to help analysts locate Flock cameras across the United States.

## Reasoning Model

The agent follows a structured reasoning loop:

```
Ingest → Score → Cluster → Rank → Evidence Chain → AI Narrative → Coverage Analysis
```

### Step 1: Ingest
Observations from multiple sources are parsed by the FlockWatch Python engine into a unified schema with timestamps, locations, signal data, and device info.

### Step 2: Score
Each observation is scored using weighted multi-factor confidence:
- OUI prefix matching (25%)
- SSID pattern matching (20%)
- BLE service UUID/name matching (15%)
- RF fingerprint similarity (20%)
- Cross-source corroboration (15%)
- Transmission timing patterns (5%)

### Step 3: Cluster
Observations within 50m of each other are grouped into location clusters. The cluster center is updated as a running average.

### Step 4: Rank
Clusters are ranked by a composite score:
- Average observation confidence (30%)
- Observation density (20%)
- Recency of most recent observation (15%)
- Cross-source diversity (20%)
- RF corroboration (15%)

### Step 5: Evidence Chain
Each ranked lead gets a full evidence chain following the Project Compass pattern:

```
Evidence → Interpretation → Recommendation → Action → Owner → Dependency → Success criterion
```

This ensures every detection is auditable and traceable.

### Step 6: AI Narrative
An optional AI layer (OpenAI-compatible API) generates a contextual intelligence summary covering:
- Executive summary of the detection landscape
- Top 3 priority leads with verification recommendations
- Notable coverage gaps warranting data collection
- Risk assessment (what could cause false positives)
- Recommended next steps

Falls back to deterministic output if AI is unavailable.

### Step 7: Coverage Analysis
The agent analyzes US-wide coverage using a 2-degree geographic grid:
- Identifies hotspots (high-confidence clusters)
- Identifies gaps (regions with no data — NOT confirmed absence)
- Computes coverage percentage

## What the Agent Is NOT

- **Not autonomous surveillance** — the agent analyzes data, it does not collect it
- **Not a CV model** — satellite imagery is for map display, not automatic camera detection from images
- **Not a guarantee** — coverage gaps mean "no data collected," not "no cameras present"
- **Not active probing** — passive detection only

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Web UI (public/)                          │
│  Agent Analysis │ Data Ingestion │ Coverage Map │ Signatures  │
├─────────────────────────────────────────────────────────────┤
│              Node.js Server (src/server.js)                  │
│  Security │ Rate Limiting │ Token Auth │ Static Files        │
├─────────────────────────────────────────────────────────────┤
│                  Agentic Layer                               │
│  ┌────────────────────┐  ┌──────────────────────────────┐  │
│  │ flock-agent-engine │  │ ai-narrative.js              │  │
│  │ • Clustering       │  │ • Deterministic fallback     │  │
│  │ • Ranking          │  │ • AI narrative (OpenAI-comp.)│  │
│  │ • Evidence chains  │  │ • Intelligence summaries     │  │
│  │ • US coverage      │  │                              │  │
│  └────────────────────┘  └──────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│           Python Bridge (src/flockwatch-runner.js)           │
│  ingest → score → map → rf-extract → list-sigs              │
├─────────────────────────────────────────────────────────────┤
│              FlockWatch Python Engine                        │
│  ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌──────┐            │
│  │WiGLE │ │ESP32 │ │Flipper │ │ SDR  │ │ Maps │            │
│  └──────┘ └──────┘ └────────┘ └──────┘ └──────┘            │
│  Schema │ Scoring │ RF Features │ Fingerprinting │ Geo      │
└─────────────────────────────────────────────────────────────┘
```
