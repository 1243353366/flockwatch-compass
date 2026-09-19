# Upstream credits and license record

**Corpora AI** is an independent project. The systems below informed the research, provenance, observability, evaluation, and defensive-simulation design. Unless a row explicitly says otherwise, the reference is **catalogue-only**: this repository does not claim to include upstream source code, model weights, malware samples, or operational tooling from that project.

License terms apply to the upstream project and exact version, not automatically to Corpora AI. Before importing code or data, review the upstream repository’s current `LICENSE`, `NOTICE`, usage terms, and attribution requirements. No upstream license is silently extended to unrelated material.

## Project and platform references

| Upstream | Creator / maintainer | Use in Corpora AI | Credit / license handling |
|---|---|---|---|
| [Aadi’s Digital Lab](https://github.com/1243353366/aadi-digital-lab) | [@1243353366](https://github.com/1243353366) | Reasoning, evidence, and provenance foundation | Separate companion project; preserve its repository license and history. |
| [Corpora AI](https://github.com/1243353366/corpora-ai) | [@1243353366](https://github.com/1243353366) | Corpus and retrieval layer | This repository; original additions are MIT-licensed where stated. |
| [Cloudflare Security Audit Skill](https://github.com/cloudflare/security-audit-skill) | [@cloudflare](https://github.com/cloudflare) | Defensive audit and deployment reference | Reference-only; verify upstream license before reuse. |
| [MITRE ATT&CK](https://attack.mitre.org/) and [ATT&CK STIX Data](https://github.com/mitre-attack/attack-stix-data) | [@mitre-attack](https://github.com/mitre-attack) / The MITRE Corporation | Behavioral vocabulary and technique mapping | Preserve MITRE attribution, trademark notices, and current license terms. |
| [CALDERA](https://github.com/mitre/caldera) | [@mitre](https://github.com/mitre) | Authorized purple-team simulation reference | Catalogue-only; no live adversary execution is enabled by this credit. |
| [Atomic Red Team](https://github.com/redcanaryco/atomic-red-team) | [@redcanaryco](https://github.com/redcanaryco) | Benign, scoped detection-test reference | Reference-only; use only within authorized isolated environments. |
| [Sigma](https://github.com/SigmaHQ/sigma) | [@SigmaHQ](https://github.com/SigmaHQ) | Detection-rule vocabulary | Preserve upstream licensing and rule attribution when applicable. |
| [YARA](https://github.com/VirusTotal/yara) | [@VirusTotal](https://github.com/VirusTotal) | Pattern-matching and defensive analysis reference | Reference-only; verify exact upstream terms before code reuse. |
| [Velociraptor](https://github.com/Velocidex/velociraptor) | [@Velocidex](https://github.com/Velocidex) | Endpoint telemetry and forensic workflow reference | Catalogue-only; no endpoint collection is enabled by this record. |
| [Security Onion](https://github.com/Security-Onion-Solutions/securityonion) | [@Security-Onion-Solutions](https://github.com/Security-Onion-Solutions) | Defensive monitoring and network-security reference | Reference-only; preserve upstream notices if integrated. |
| [OpenTelemetry](https://github.com/open-telemetry/opentelemetry-specification) | [@open-telemetry](https://github.com/open-telemetry) | Trace, span, and agent-run observability reference | Verify component-specific licenses before reuse. |
| [Model Context Protocol](https://github.com/modelcontextprotocol) | [@modelcontextprotocol](https://github.com/modelcontextprotocol) | Tool-contract and context-boundary reference | Reference-only; tools remain governed by application policy. |

## Agent and evaluation references

| Upstream | Creator / maintainer | Design contribution | Credit / license handling |
|---|---|---|---|
| [DSPy](https://github.com/stanfordnlp/dspy) | [@stanfordnlp](https://github.com/stanfordnlp) | Measurable reasoning and optimization | Catalogue-only; verify exact upstream license before reuse. |
| [PydanticAI](https://github.com/pydantic/pydantic-ai) | [@pydantic](https://github.com/pydantic) | Typed claims, evidence, and structured outputs | Catalogue-only; verify exact upstream license before reuse. |
| [DeepEval](https://github.com/confident-ai/deepeval) | [@confident-ai](https://github.com/confident-ai) | Evaluation and regression methodology | Catalogue-only; verify exact upstream license before reuse. |
| [Guardrails AI](https://github.com/guardrails-ai/guardrails) | [@guardrails-ai](https://github.com/guardrails-ai) | Output validation and safety constraints | Catalogue-only; verify exact upstream license before reuse. |
| [Outlines](https://github.com/dottxt-ai/outlines) | [@dottxt-ai](https://github.com/dottxt-ai) | Constrained structured generation reference | Catalogue-only; verify exact upstream license before reuse. |
| [LangGraph](https://github.com/langchain-ai/langgraph) | [@langchain-ai](https://github.com/langchain-ai) | Stateful orchestration and checkpoints | Catalogue-only; verify exact upstream license before reuse. |
| [smolagents](https://github.com/huggingface/smolagents) | [@huggingface](https://github.com/huggingface) | Controlled tool reasoning reference | Catalogue-only; no tool execution is enabled here. |
| [LlamaIndex](https://github.com/run-llama/llama_index) | [@run-llama](https://github.com/run-llama) | Retrieval and knowledge-index reference | Catalogue-only; verify exact upstream license before reuse. |
| [Haystack](https://github.com/deepset-ai/haystack) | [@deepset-ai](https://github.com/deepset-ai) | Explicit retrieval-pipeline reference | Catalogue-only; verify exact upstream license before reuse. |
| [Agno](https://github.com/agno-agi/agno) | [@agno-agi](https://github.com/agno-agi) | Agent-team and memory reference | Catalogue-only; verify exact upstream license before reuse. |
| [AutoGen / AG2](https://github.com/microsoft/autogen) | [@microsoft](https://github.com/microsoft) | Multi-agent review and disagreement reference | Catalogue-only; verify exact upstream license before reuse. |
| [BeeAI Framework](https://github.com/i-am-bee/bee-agent-framework) | [@i-am-bee](https://github.com/i-am-bee) | Agent workflow and tool-contract reference | Catalogue-only; verify exact upstream license before reuse. |
| [OpenLLMetry](https://github.com/traceloop/openllmetry) | [@traceloop](https://github.com/traceloop) | Tracing and evaluation observability | Catalogue-only; verify exact upstream license before reuse. |

## Threat-research and sandbox references

The following names came from the supplied research handoff and are retained as **reference categories**, not as bundled samples or execution dependencies: [MalwareBazaar](https://bazaar.abuse.ch/), [ThreatFox](https://threatfox.abuse.ch/), [URLhaus](https://urlhaus.abuse.ch/), [YARAify](https://yaraify.abuse.ch/), [ANY.RUN](https://any.run/), [VX-Underground](https://vx-underground.org/), [CAPE Sandbox](https://github.com/kevoreilly/capemon), [theZoo](https://github.com/ytisf/theZoo), and InQuest research. Corpora AI does not download, execute, redistribute, or operationalize live malware through these references.

## Attribution standard

Where upstream code, rules, data, or documentation is ever incorporated, the change must identify the exact upstream version, creator, license, copyright notice, files affected, and any modifications. Unlicensed or unclear material remains reference-only. The system’s defensive boundary is explicit: evidence can support analysis, but it does not authorize intrusion, retaliation, live-malware execution, unauthorized scanning, or unsupported legal or actor-attribution conclusions.
