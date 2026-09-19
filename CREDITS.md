# Credits and Attributions

Every record in the Corpora index carries a Source / Upstream Project header
with repository URL, license, and authors. Provenance is preserved. Nothing
here is presented as original work of Aadi's Digital Lab.

## Upstream projects in the corpus

| Project | License | Authors | Records |
|---------|---------|---------|---------|
| [ahmia/ahmia-crawler](https://github.com/ahmia/ahmia-crawler) | BSD 3-Clause "New" or "Revised", Copyright 2024 Juha Nurmi | Juha Nurmi (Ahmia search engine project, Finland) | 11 |
| [cmangun/clinical-nlp-pipeline](https://github.com/cmangun/clinical-nlp-pipeline) | MIT, Copyright (c) 2026 Christopher Mangun | Christopher Mangun | 7 |
| [mitre-attack/attack-stix-data](https://github.com/mitre-attack/attack-stix-data) | MITRE ATT&CK license (non-exclusive, royalty-free) | The MITRE Corporation (ATT&CK team); contributors: isaisabel, jondricek, ElJocko, elucchesileon, seansica | 6 |
| [zachbrowne/portable-ai-usb](https://github.com/zachbrowne/portable-ai-usb) | MIT, Copyright (c) 2026 (holder not specified upstream) | zachbrowne (owner); git contributors: Tech Jarves, sureshk243, Souradeep De, johnrosse | 8 |

"(c) 2026 The MITRE Corporation. This work is reproduced and distributed with
the permission of The MITRE Corporation." ATT&CK is a registered trademark
of The MITRE Corporation.

Third-party downloadable AI models referenced by portable-ai-usb (NemoMix,
Dolphin, Mistral, Qwen, Llama, Phi) are separate upstream artifacts of their
respective owners and are not part of any import.

| [ProjectZeroDays/AI-Driven-Zero-Click-Exploit-Deployment-Framework](https://github.com/ProjectZeroDays/AI-Driven-Zero-Click-Exploit-Deployment-Framework) | MIT, Copyright (c) 2025 ProjectZeroDays | ProjectZeroDays (git authors: PROJECT ZERO, Researcher) | 3 |
| [010io/cyberwar-tools-ua](https://github.com/010io/cyberwar-tools-ua) | MIT | Omelchenko Ihor Oleksandrovych (010io) | 6 |
| [DurgaRamireddy/Sandworm-APT-Analysis](https://github.com/DurgaRamireddy/Sandworm-APT-Analysis) | No license declared - catalogue entry only, no content reproduced | DurgaRamireddy | 1 |
| [astroicers/Athena](https://github.com/astroicers/Athena) | Open-core commercial license - catalogue entry only, no content reproduced | astroicers | 1 |

Corpus policy on offensive material (AI-Driven-Zero-Click-Exploit-Deployment-Framework): operational code is not imported; only documentation and metadata are preserved as research data, per the Research-Use Policy.

| [googleapis/python-genai](https://github.com/googleapis/python-genai) | Apache-2.0, Copyright 2025 Google LLC | Google LLC (googleapis org) and contributors | 3 |
| [huggingface/transformers](https://github.com/huggingface/transformers) | Apache-2.0, Copyright 2018- The Hugging Face team | The Hugging Face team and community contributors | 3 |
| [NVIDIA/NeMo](https://github.com/NVIDIA/NeMo) | Apache-2.0, NVIDIA Corporation | NVIDIA Corporation and contributors | 3 |
| [mistralai/client-python](https://github.com/mistralai/client-python) | Apache-2.0, Mistral AI | Mistral AI and contributors | 3 |
| [Cloudflare AI tooling](https://developers.cloudflare.com/workers-ai/) - Workers AI / AI Gateway / AI Search | Apache-2.0, Cloudflare, Inc. (cloudflare/cloudflare-docs) | Cloudflare, Inc. | 4 |

## Lab material

Aadi's Digital Lab seeds (repository metadata, research notes, launch log)
and the corpus research policy record are original Lab content.

All corpus material is for ethical research use only - a research tool.


## Observatory agent-architecture references

The following projects were supplied as architecture references for the agentic-reasoning layer. Corpora AI stores their public URLs and intended roles as catalogue metadata; it does not copy their source code, execute their tools, or redistribute their models. License status is therefore recorded conservatively and must be re-verified against the exact version before any future code integration.

| Project | Creator / organization | Role in the architecture | License handling |
|---|---|---|---|
| [LangGraph](https://github.com/langchain-ai/langgraph) | LangChain AI / `@langchain-ai` | Stateful agent orchestration | Catalogue-only; verify upstream license before reuse. |
| [smolagents](https://github.com/huggingface/smolagents) | Hugging Face / `@huggingface` | Controlled tool reasoning | Catalogue-only; no tool execution enabled here. |
| [DSPy](https://github.com/stanfordnlp/dspy) | Stanford NLP / `@stanfordnlp` | Measurable reasoning/prompt optimization | Catalogue-only; verify upstream license before reuse. |
| [PydanticAI](https://github.com/pydantic/pydantic-ai) | Pydantic / `@pydantic` | Structured claims and typed outputs | Catalogue-only; verify upstream license before reuse. |
| [LlamaIndex](https://github.com/run-llama/llama_index) | LlamaIndex / `@run-llama` | Evidence retrieval and indexing | Catalogue-only; verify upstream license before reuse. |
| [Haystack](https://github.com/deepset-ai/haystack) | deepset / `@deepset-ai` | Explicit retrieval pipelines | Catalogue-only; verify upstream license before reuse. |
| [Agno](https://github.com/agno-agi/agno) | Agno / `@agno-agi` | Agent teams, memory, and tools | Catalogue-only; verify upstream license before reuse. |
| [AutoGen / AG2](https://github.com/microsoft/autogen) | Microsoft / `@microsoft` | Multi-agent review and delegation | Catalogue-only; verify upstream license before reuse. |
| [BeeAI Framework](https://github.com/i-am-bee/bee-agent-framework) | BeeAI / `@i-am-bee` | Agent workflows and structured tools | Catalogue-only; verify upstream license before reuse. |
| [OpenLLMetry](https://github.com/traceloop/openllmetry) | Traceloop / `@traceloop` | Agent-run and tool-call observability | Catalogue-only; verify upstream license before reuse. |

The reference boundary is deliberate: raw evidence must become normalized observations and retrieved corroboration before the system produces hypotheses or conclusions. No source in this table grants permission to attack real systems, execute arbitrary tools, or bypass authorization.
