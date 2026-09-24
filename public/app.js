// FlockWatch Compass — Frontend application

const API = {
  token: null,

  async getToken() {
    if (this.token) return this.token;
    const res = await fetch('/api/request-token');
    const data = await res.json();
    this.token = data.token;
    return this.token;
  },

  async post(endpoint, body) {
    const token = await this.getToken();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Token': token,
        'X-Request-Timestamp': Date.now().toString(),
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  async get(endpoint) {
    const token = await this.getToken();
    const res = await fetch(endpoint, {
      headers: {
        'X-Request-Token': token,
        'X-Request-Timestamp': Date.now().toString(),
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
};

// ─── Tab switching ───────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ─── Health check ────────────────────────────────────────────────────────────
async function checkHealth() {
  try {
    const res = await fetch('/health');
    const data = await res.json();
    document.getElementById('serverStatus').textContent = 'Server: Online';
    document.getElementById('serverStatus').className = 'status-pill status-ok';
    document.getElementById('pythonStatus').textContent = `Python: ${data.python_available ? 'Available' : 'Not configured'}`;
    document.getElementById('pythonStatus').className = `status-pill ${data.python_available ? 'status-ok' : 'status-error'}`;
    document.getElementById('aiStatus').textContent = `AI: ${data.ai_enabled ? 'Enabled' : 'Deterministic'}`;
    document.getElementById('aiStatus').className = 'status-pill status-unknown';
  } catch {
    document.getElementById('serverStatus').textContent = 'Server: Offline';
    document.getElementById('serverStatus').className = 'status-pill status-error';
  }
}
checkHealth();

// ─── Sample data ─────────────────────────────────────────────────────────────
const SAMPLE_OBSERVATIONS = [
  { id: "obs_1", timestamp: "2026-09-23T18:30:00Z", source_type: "wigle", location: { lat: 42.7392, lon: -84.4083 }, signal: { rssi_dbm: -65, frequency_mhz: 2437, band: "2.4GHz" }, device: { mac: "C4:48:54:11:22:33", oui: "C4:48:54", ssid: "Flock-Cam-A1F2" }, confidence: { oui_match: 1.0, ssid_pattern: 1.0, ble_pattern: 0, rf_fingerprint: 0, cross_source: 0, timing_pattern: 0 }, confidence_overall: 0.45, confidence_explanation: "OUI and SSID matched Flock patterns" },
  { id: "obs_2", timestamp: "2026-09-23T18:30:05Z", source_type: "esp32_wifi", location: { lat: 42.7395, lon: -84.4088 }, signal: { rssi_dbm: -72, frequency_mhz: 2462, band: "2.4GHz" }, device: { mac: "D8:31:34:AA:BB:CC", oui: "D8:31:34", ssid: "FlockSafety-Node" }, confidence: { oui_match: 1.0, ssid_pattern: 1.0, ble_pattern: 0, rf_fingerprint: 0, cross_source: 0.3, timing_pattern: 0 }, confidence_overall: 0.6, confidence_explanation: "OUI and SSID matched; cross-source corroboration" },
  { id: "obs_3", timestamp: "2026-09-23T18:30:08Z", source_type: "esp32_ble", location: { lat: 42.7400, lon: -84.4090 }, signal: { rssi_dbm: -58, frequency_mhz: 2420, band: "2.4GHz" }, device: { mac: "C4:48:54:55:66:77", oui: "C4:48:54", ble_name: "Flock-Node-003", ble_service_uuids: ["0000fe59-0000-1000-8000-00805f9b34fb"], ble_manufacturer_id: 490 }, confidence: { oui_match: 1.0, ssid_pattern: 0, ble_pattern: 0.9, rf_fingerprint: 0, cross_source: 0.3, timing_pattern: 0 }, confidence_overall: 0.57, confidence_explanation: "OUI and BLE matched; cross-source corroboration" },
  { id: "obs_4", timestamp: "2026-09-23T18:30:10Z", source_type: "sdr", location: { lat: 42.7401, lon: -84.4091 }, signal: { rssi_dbm: -55, frequency_mhz: 2437, band: "2.4GHz" }, device: {}, rf_fingerprint: { matched_template: "flock_wifi_beacon_2_4ghz", template_similarity: 0.82, center_freq_mhz: 2437, burst_count: 5, burst_intervals_ms: [102.4, 98.1, 103.5, 99.8] }, confidence: { oui_match: 0, ssid_pattern: 0, ble_pattern: 0, rf_fingerprint: 0.82, cross_source: 0.3, timing_pattern: 0.8 }, confidence_overall: 0.52, confidence_explanation: "RF fingerprint matched template; regular burst timing; cross-source" },
  { id: "obs_5", timestamp: "2026-09-22T14:00:00Z", source_type: "wigle", location: { lat: 34.0522, lon: -118.2437 }, signal: { rssi_dbm: -78, frequency_mhz: 2412, band: "2.4GHz" }, device: { mac: "C4:48:54:99:88:77", oui: "C4:48:54", ssid: "FLK-ALPR-003" }, confidence: { oui_match: 1.0, ssid_pattern: 1.0, ble_pattern: 0, rf_fingerprint: 0, cross_source: 0, timing_pattern: 0 }, confidence_overall: 0.45, confidence_explanation: "OUI and SSID matched Flock patterns" },
  { id: "obs_6", timestamp: "2026-09-21T10:00:00Z", source_type: "flipper", location: { lat: 40.7589, lon: -73.9851 }, signal: { rssi_dbm: -50, frequency_mhz: 915, band: "subGHz" }, device: {}, confidence: { oui_match: 0, ssid_pattern: 0, ble_pattern: 0, rf_fingerprint: 0, cross_source: 0, timing_pattern: 0.4 }, confidence_overall: 0.02, confidence_explanation: "Semi-regular burst timing only" },
];

document.getElementById('loadSample').addEventListener('click', () => {
  document.getElementById('observationsInput').value = JSON.stringify(SAMPLE_OBSERVATIONS, null, 2);
});

// ─── Run analysis ────────────────────────────────────────────────────────────
document.getElementById('runAnalysis').addEventListener('click', async () => {
  const resultsDiv = document.getElementById('analysisResults');
  const input = document.getElementById('observationsInput').value.trim();

  if (!input) {
    resultsDiv.innerHTML = '<div class="error-message">Please enter observations or load sample data.</div>';
    resultsDiv.classList.remove('hidden');
    return;
  }

  let observations;
  try {
    observations = JSON.parse(input);
  } catch {
    resultsDiv.innerHTML = '<div class="error-message">Invalid JSON. Please check your input.</div>';
    resultsDiv.classList.remove('hidden');
    return;
  }

  resultsDiv.innerHTML = '<div class="loading">Running agent analysis...</div>';
  resultsDiv.classList.remove('hidden');

  try {
    const result = await API.post('/api/analyze', {
      observations,
      threshold: parseFloat(document.getElementById('threshold').value),
      maxResults: parseInt(document.getElementById('maxResults').value),
      includeCoverageGaps: document.getElementById('includeGaps').checked,
      generateNarrative: document.getElementById('wantNarrative').checked,
    });
    renderAnalysisResults(result);
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
  }
});

function renderAnalysisResults(result) {
  const div = document.getElementById('analysisResults');
  const s = result.summary;
  const c = result.coverage;

  let html = '<div class="card">';

  // Summary stats
  html += '<h2>Analysis Summary</h2>';
  html += '<div class="summary-grid">';
  html += `<div class="summary-stat"><div class="value">${s.total_observations}</div><div class="label">Observations</div></div>`;
  html += `<div class="summary-stat"><div class="value">${s.total_clusters}</div><div class="label">Clusters</div></div>`;
  html += `<div class="summary-stat"><div class="value">${s.ranked_leads}</div><div class="label">Ranked Leads</div></div>`;
  html += `<div class="summary-stat"><div class="value" style="color:var(--danger)">${s.high_confidence}</div><div class="label">High Confidence</div></div>`;
  html += `<div class="summary-stat"><div class="value" style="color:var(--warning)">${s.moderate_confidence}</div><div class="label">Moderate</div></div>`;
  html += `<div class="summary-stat"><div class="value" style="color:var(--text-dim)">${s.low_confidence}</div><div class="label">Low Confidence</div></div>`;
  html += '</div>';

  // Coverage
  if (c) {
    html += '<h3>US Coverage</h3>';
    html += `<div class="coverage-bar"><div class="coverage-fill" style="width: ${c.coverage_percentage}%"></div></div>`;
    html += `<p style="color:var(--text-dim);font-size:13px;">${c.coverage_percentage}% of US grid covered · ${c.covered_cells}/${c.total_grid_cells} cells · ${c.gaps.length} gap regions · ${c.hotspots.length} hotspots</p>`;
  }

  html += '</div>';

  // AI Narrative
  if (result.narrative) {
    html += '<div class="card">';
    html += `<h2>AI Intelligence Summary</h2>`;
    html += `<p class="description">Generated by: ${result.narrative.generated_by}${result.narrative.model ? ' (' + result.narrative.model + ')' : ''}</p>`;
    html += `<div class="narrative">${result.narrative.narrative}</div>`;
    html += '</div>';
  }

  // Leads
  if (result.leads && result.leads.length > 0) {
    html += '<div class="card"><h2>Ranked Detection Leads</h2></div>';
    for (const lead of result.leads) {
      const confClass = lead.confidence_level === 'high' ? 'confidence-high' : lead.confidence_level === 'moderate' ? 'confidence-moderate' : 'confidence-low';
      html += '<div class="lead-card">';
      html += '<div class="lead-header">';
      html += `<div><span class="lead-location">${lead.location.lat.toFixed(4)}, ${lead.location.lon.toFixed(4)}</span></div>`;
      html += `<span class="confidence-badge ${confClass}">${lead.confidence_level} · ${(lead.confidence_score * 100).toFixed(0)}%</span>`;
      html += '</div>';
      html += `<p style="font-size:13px;color:var(--text-dim);margin-bottom:12px;">${lead.observation_count} observation(s) from ${lead.source_types.length} source type(s)</p>`;

      // Source tags
      html += '<div class="source-tags">';
      for (const src of lead.source_types) {
        html += `<span class="source-tag source-${src}">${src}</span>`;
      }
      html += '</div>';

      // Evidence chain
      html += '<dl class="evidence-chain" style="margin-top:12px;">';
      html += '<dt>Evidence</dt>';
      for (const e of lead.evidence_chain.evidence) {
        html += `<dd>• ${e.description}</dd>`;
      }
      html += '<dt>Interpretation</dt>';
      for (const interp of lead.evidence_chain.interpretations) {
        html += `<dd>${interp}</dd>`;
      }
      html += '<dt>Recommendations</dt>';
      for (const rec of lead.evidence_chain.recommendations) {
        html += `<dd>→ ${rec}</dd>`;
      }
      if (lead.coverage_gaps.length > 0) {
        html += '<dt>Coverage Gaps</dt>';
        for (const gap of lead.coverage_gaps) {
          html += `<dd>⚠ ${gap}</dd>`;
        }
      }
      html += '</dl>';

      html += `<p style="font-size:11px;color:var(--text-muted);margin-top:12px;font-style:italic;">${lead.legal_note}</p>`;
      html += '</div>';
    }
  } else {
    html += '<div class="card"><p class="description">No leads met the confidence threshold. Consider lowering the threshold or collecting more data.</p></div>';
  }

  div.innerHTML = html;
}

// ─── Ingest ──────────────────────────────────────────────────────────────────
document.getElementById('runIngest').addEventListener('click', async () => {
  const resultsDiv = document.getElementById('ingestResults');
  const type = document.getElementById('ingestType').value;
  const file_path = document.getElementById('ingestFile').value.trim();

  if (!file_path) {
    resultsDiv.innerHTML = '<div class="error-message">Please enter a file path.</div>';
    resultsDiv.classList.remove('hidden');
    return;
  }

  resultsDiv.innerHTML = '<div class="loading">Ingesting data...</div>';
  resultsDiv.classList.remove('hidden');

  try {
    const result = await API.post('/api/ingest', { type, file_path });
    resultsDiv.innerHTML = `<div class="card"><h3>Ingestion Complete</h3><p class="description">Session: ${result.session_id}</p><pre>${JSON.stringify(result, null, 2)}</pre></div>`;
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
  }
});

document.getElementById('runScore').addEventListener('click', async () => {
  const resultsDiv = document.getElementById('ingestResults');
  resultsDiv.innerHTML = '<div class="loading">Scoring observations...</div>';
  resultsDiv.classList.remove('hidden');

  try {
    // Use last session from ingest
    const sessionDiv = document.getElementById('ingestResults');
    const sessionMatch = sessionDiv.innerHTML.match(/Session: ([a-f0-9-]+)/);
    const session_id = sessionMatch ? sessionMatch[1] : '';

    if (!session_id) {
      resultsDiv.innerHTML = '<div class="error-message">No active session. Ingest data first.</div>';
      return;
    }

    const result = await API.post('/api/score', { session_id });
    resultsDiv.innerHTML = `<div class="card"><h3>Scoring Complete</h3><p class="description">${result.total_observations} observations scored.</p><pre>${JSON.stringify(result, null, 2)}</pre></div>`;
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
  }
});

// ─── Coverage ────────────────────────────────────────────────────────────────
document.getElementById('loadCoverage').addEventListener('click', async () => {
  const resultsDiv = document.getElementById('coverageResults');
  resultsDiv.innerHTML = '<div class="loading">Loading coverage analysis...</div>';
  resultsDiv.classList.remove('hidden');

  try {
    const result = await API.get('/api/coverage');
    const c = result.coverage;
    const s = result.summary;

    let html = '<div class="card">';
    html += '<h2>US Coverage Analysis</h2>';
    html += '<div class="summary-grid">';
    html += `<div class="summary-stat"><div class="value">${s.total_observations}</div><div class="label">Total Observations</div></div>`;
    html += `<div class="summary-stat"><div class="value">${s.total_clusters}</div><div class="label">Clusters</div></div>`;
    html += `<div class="summary-stat"><div class="value" style="color:var(--accent)">${c.coverage_percentage}%</div><div class="label">US Coverage</div></div>`;
    html += `<div class="summary-stat"><div class="value">${c.covered_cells}</div><div class="label">Cells Covered</div></div>`;
    html += `<div class="summary-stat"><div class="value" style="color:var(--warning)">${c.gaps.length}</div><div class="label">Gap Regions</div></div>`;
    html += `<div class="summary-stat"><div class="value" style="color:var(--danger)">${c.hotspots.length}</div><div class="label">Hotspots</div></div>`;
    html += '</div>';

    html += `<div class="coverage-bar"><div class="coverage-fill" style="width: ${c.coverage_percentage}%"></div></div>`;
    html += `<p style="color:var(--text-dim);font-size:13px;">Coverage gaps indicate regions with no collected data, not confirmed absence of cameras.</p>`;

    if (c.hotspots.length > 0) {
      html += '<h3 style="margin-top:20px;">Detection Hotspots</h3>';
      for (const h of c.hotspots.slice(0, 10)) {
        html += `<div class="lead-card"><div class="lead-header"><span class="lead-location">${h.location.lat.toFixed(4)}, ${h.location.lon.toFixed(4)}</span><span class="confidence-badge confidence-high">${(h.confidence * 100).toFixed(0)}%</span></div><p style="font-size:13px;color:var(--text-dim);">${h.observation_count} observations</p></div>`;
      }
    }

    html += '</div>';
    resultsDiv.innerHTML = html;
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
  }
});

// ─── Signatures ──────────────────────────────────────────────────────────────
document.getElementById('loadSignatures').addEventListener('click', async () => {
  const resultsDiv = document.getElementById('signatureResults');
  resultsDiv.innerHTML = '<div class="loading">Loading signatures...</div>';
  resultsDiv.classList.remove('hidden');

  try {
    const result = await API.get('/api/signatures');
    resultsDiv.innerHTML = `<div class="card"><h3>Signature Database</h3><pre>${result.signatures || 'No signatures available'}</pre></div>`;
  } catch (error) {
    resultsDiv.innerHTML = `<div class="error-message">${error.message}</div>`;
  }
});
