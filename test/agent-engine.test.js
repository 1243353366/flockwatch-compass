import { test } from "node:test";
import assert from "node:assert";
import { runAgentAnalysis, buildEvidenceChain, analyzeUSCoverage, haversine, WEIGHTS } from "../src/flock-agent-engine.js";
import { generateDeterministicNarrative } from "../src/ai-narrative.js";

const SAMPLE_OBS = [
  { id: "obs_1", timestamp: "2026-09-23T18:30:00Z", source_type: "wigle", location: { lat: 42.7392, lon: -84.4083 }, signal: { rssi_dbm: -65 }, device: { mac: "C4:48:54:11:22:33", oui: "C4:48:54", ssid: "Flock-Cam" }, confidence: { oui_match: 1.0, ssid_pattern: 1.0, ble_pattern: 0, rf_fingerprint: 0, cross_source: 0, timing_pattern: 0 }, confidence_overall: 0.45, confidence_explanation: "OUI and SSID matched" },
  { id: "obs_2", timestamp: "2026-09-23T18:30:05Z", source_type: "esp32_wifi", location: { lat: 42.7395, lon: -84.4088 }, signal: { rssi_dbm: -72 }, device: { mac: "D8:31:34:AA:BB:CC", oui: "D8:31:34", ssid: "FlockSafety-Node" }, confidence: { oui_match: 1.0, ssid_pattern: 1.0, ble_pattern: 0, rf_fingerprint: 0, cross_source: 0.3, timing_pattern: 0 }, confidence_overall: 0.6, confidence_explanation: "OUI, SSID, cross-source" },
  { id: "obs_3", timestamp: "2026-09-23T18:30:08Z", source_type: "esp32_ble", location: { lat: 42.7400, lon: -84.4090 }, signal: { rssi_dbm: -58 }, device: { mac: "C4:48:54:55:66:77", oui: "C4:48:54", ble_name: "Flock-Node-003" }, confidence: { oui_match: 1.0, ssid_pattern: 0, ble_pattern: 0.9, rf_fingerprint: 0, cross_source: 0.3, timing_pattern: 0 }, confidence_overall: 0.57, confidence_explanation: "OUI and BLE matched" },
  { id: "obs_4", timestamp: "2026-09-22T14:00:00Z", source_type: "wigle", location: { lat: 34.0522, lon: -118.2437 }, signal: { rssi_dbm: -78 }, device: { mac: "C4:48:54:99:88:77", oui: "C4:48:54", ssid: "FLK-ALPR-003" }, confidence: { oui_match: 1.0, ssid_pattern: 1.0, ble_pattern: 0, rf_fingerprint: 0, cross_source: 0, timing_pattern: 0 }, confidence_overall: 0.45, confidence_explanation: "OUI and SSID matched" },
];

test("haversine distance", () => {
  const dist = haversine(42.7392, -84.4083, 42.7395, -84.4088);
  assert.ok(dist > 30 && dist < 60, `Expected ~50m, got ${dist}m`);
});

test("runAgentAnalysis clusters nearby observations", () => {
  const result = runAgentAnalysis(SAMPLE_OBS, { threshold: 0.0, includeCoverageGaps: false, clusterDistance: 100 });
  // First 3 observations are within ~100m, should cluster
  assert.ok(result.summary.total_clusters <= 2, `Expected <= 2 clusters, got ${result.summary.total_clusters}`);
});

test("runAgentAnalysis produces ranked leads", () => {
  const result = runAgentAnalysis(SAMPLE_OBS, { threshold: 0.0, maxResults: 10 });
  assert.ok(result.leads.length > 0, "Expected at least one lead");
  assert.ok(result.leads[0].confidence_score >= 0, "Lead should have a score");
  assert.ok(result.leads[0].evidence_chain.evidence.length > 0, "Lead should have evidence");
});

test("evidence chain has all required fields", () => {
  const result = runAgentAnalysis(SAMPLE_OBS, { threshold: 0.0, maxResults: 1 });
  const lead = result.leads[0];
  assert.ok(lead.evidence_chain.evidence, "Missing evidence");
  assert.ok(lead.evidence_chain.interpretations, "Missing interpretations");
  assert.ok(lead.evidence_chain.recommendations, "Missing recommendations");
  assert.ok(lead.evidence_chain.actions, "Missing actions");
  assert.ok(lead.legal_note, "Missing legal note");
});

test("coverage analysis produces US grid", () => {
  const result = runAgentAnalysis(SAMPLE_OBS, { threshold: 0.0, includeCoverageGaps: true });
  assert.ok(result.coverage, "Missing coverage analysis");
  assert.ok(result.coverage.total_grid_cells > 300, `Expected >300 US grid cells, got ${result.coverage.total_grid_cells}`);
  assert.ok(result.coverage.coverage_percentage < 100, "Coverage should not be 100%");
  assert.ok(result.coverage.gaps.length > 0, "Should have coverage gaps");
});

test("high confidence leads get appropriate recommendations", () => {
  const highConfObs = [{
    id: "obs_h", timestamp: new Date().toISOString(), source_type: "sdr",
    location: { lat: 40.0, lon: -80.0 },
    signal: { rssi_dbm: -50 }, device: {},
    rf_fingerprint: { matched_template: "flock_wifi_beacon", template_similarity: 0.9 },
    confidence: { oui_match: 1.0, ssid_pattern: 1.0, ble_pattern: 0.9, rf_fingerprint: 0.9, cross_source: 0.6, timing_pattern: 0.8 },
    confidence_overall: 0.9,
  }];
  const result = runAgentAnalysis(highConfObs, { threshold: 0.3 });
  assert.ok(result.leads.length > 0, "Expected a lead");
  assert.ok(["high", "moderate"].includes(result.leads[0].confidence_level), `Expected high or moderate, got ${result.leads[0].confidence_level}`);
});

test("deterministic narrative generates all sections", () => {
  const analysis = runAgentAnalysis(SAMPLE_OBS, { threshold: 0.0 });
  const narrative = generateDeterministicNarrative(analysis);
  assert.ok(narrative.includes("Executive Summary"));
  assert.ok(narrative.includes("Risk Assessment"));
  assert.ok(narrative.includes("Recommended Next Steps"));
});

test("weights sum to 1.0", () => {
  const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1.0) < 0.001, `Weights should sum to 1.0, got ${total}`);
});
