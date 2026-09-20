# Corpora AI investigation workstation

## Product promise

Corpora helps security teams turn fragmented observations into **defensible investigations**. It is an investigation workstation, not a chatbot that produces unsupported security conclusions.

## Human authority and AI responsibility

Humans define the objective and scope, authorize collection and controlled experiments, review competing explanations, approve defensive actions, and retain operational and legal accountability. The AI retrieves evidence, verifies provenance and quality, correlates observations, challenges its own hypotheses, proposes bounded experiments, explains uncertainty, recommends next evidence, and preserves the reasoning trail. The AI is an investigator and reasoning engine, **not the authority**.

## Human workstation surfaces

The workstation is organized around seven analyst tasks: seeing endpoint, network, malware, vulnerability, infrastructure, geospatial, detection, and telemetry-health observations; starting and maintaining investigations; understanding observed versus inferred attack stages; testing defenses in the authorized cyber range; reviewing reversible response options; auditing telemetry trust and assumptions; and producing incident timelines, evidence inventories, detection-performance summaries, hypotheses, mitigation histories, audit trails, and limitations.

## AI reasoning loop

```text
RETRIEVE → VERIFY → CORRELATE → CHALLENGE → HYPOTHESIZE
        → TEST → EXPLAIN → RECOMMEND → PRESERVE PROVENANCE
```

Every meaningful claim must distinguish **Observed**, **Correlated**, **Inferred**, and **Unknown**. A hypothesis must include supporting evidence, contradicting evidence, alternative explanations, missing evidence, and a justified confidence level. The AI must never convert `SIMULATED_C2` into `REAL_C2`, and it must never convert telemetry silence into “no suspicious activity.” When telemetry is unavailable, the report must say that a conclusion cannot currently be established.

## Evidence-centered relationship analysis

The AI may surface relationships such as a shared certificate, related infrastructure, similar beacon timing, overlapping behavior, and a historical association. It must present the chain as evidence and inference, for example:

```text
Observed: certificate X appears on entities A and B.
Correlated: A ↔ B share certificate X and similar timing.
Inference: the relationship may be relevant.
Confidence: moderate.
Missing evidence: independent endpoint telemetry and collection timestamps.
```

It must not claim that a relationship identifies an attacker without corroboration.

## Controlled experiments

The AI may recommend a harmless synthetic experiment when a detection hypothesis needs testing. The experiment follows:

```text
hypothesis → authorized experiment → telemetry → detection → result → conclusion
```

Experiments use predefined tasks inside the isolated cyber range. The existing fail-closed C2 simulator remains the execution boundary. Real-world collection, external targets, arbitrary commands, malware deployment, persistence, lateral movement, tunneling, and retaliation are outside the product contract.

## Defensive recommendations

A recommendation must state the action, reason, supporting evidence, operational risk, reversibility, required authorization, and confidence. The AI may recommend isolation, blocking, quarantine, credential rotation, patching, evidence preservation, or restoration, but high-impact actions require human approval and are not silently executed by the reasoning layer.

## Simulation learning loop

```text
SIMULATE → BEHAVIOR → TELEMETRY → DETECTION → CONTAINMENT → RECOVERY
                         ↓
                 What was missed?
                 Which evidence was absent?
                 Which rule triggered?
                 How long did containment take?
                 Could benign activity trigger it?
```

Both detected and not-detected outcomes are valid evaluation cases. The system must record detection latency, missing telemetry, false-positive or false-negative status, containment, recovery, evidence retention, and residual uncertainty.

## Contract reference

The machine-readable contract is [`contracts/investigation-workstation.v1.json`](../contracts/investigation-workstation.v1.json). It is deliberately separate from the runtime permissions and does not grant the AI new authority.
