/**
 * FlockWatch Agent Engine
 *
 * Agentic reasoning engine that locates suspected Flock cameras across the US.
 * Uses the Evidence → Interpretation → Recommendation → Action → Owner → Dependency → Success criterion
 * chain pattern from Project Compass, applied to FlockWatch detection data.
 */

const WEIGHTS = Object.freeze({
  confidence: 0.30,
  density: 0.20,
  recency: 0.15,
  cross_source: 0.20,
  rf_corroboration: 0.15,
});

function buildEvidenceChain(cluster, observations) {
  const evidence = [];
  const interpretations = [];
  const recommendations = [];
  const actions = [];

  const sourceTypes = new Set();
  const ouiMatches = [];
  const ssidMatches = [];
  const bleMatches = [];
  const rfMatches = [];

  for (const obs of observations) {
    sourceTypes.add(obs.source_type);

    if (obs.confidence?.oui_match > 0) {
      ouiMatches.push({ mac: obs.device?.mac, oui: obs.device?.oui, rssi: obs.signal?.rssi_dbm });
    }
    if (obs.confidence?.ssid_pattern > 0) {
      ssidMatches.push({ ssid: obs.device?.ssid, rssi: obs.signal?.rssi_dbm });
    }
    if (obs.confidence?.ble_pattern > 0) {
      bleMatches.push({ name: obs.device?.ble_name, uuids: obs.device?.ble_service_uuids });
    }
    if (obs.confidence?.rf_fingerprint > 0) {
      rfMatches.push({
        template: obs.rf_fingerprint?.matched_template,
        similarity: obs.rf_fingerprint?.template_similarity,
        freq: obs.rf_fingerprint?.center_freq_mhz,
      });
    }
  }

  if (ouiMatches.length > 0) {
    evidence.push({ type: "oui_match", description: `${ouiMatches.length} device(s) with MAC OUI prefixes matching known Flock vendor assignments`, details: ouiMatches, weight: 0.9 });
  }
  if (ssidMatches.length > 0) {
    evidence.push({ type: "ssid_pattern", description: `${ssidMatches.length} Wi-Fi network(s) with SSID patterns consistent with Flock device naming`, details: ssidMatches, weight: 0.8 });
  }
  if (bleMatches.length > 0) {
    evidence.push({ type: "ble_pattern", description: `${bleMatches.length} BLE device(s) with service UUIDs or names matching Flock signatures`, details: bleMatches, weight: 0.75 });
  }
  if (rfMatches.length > 0) {
    evidence.push({ type: "rf_fingerprint", description: `${rfMatches.length} RF capture(s) with spectral fingerprints matching known Flock transmission templates`, details: rfMatches, weight: 0.85 });
  }
  evidence.push({ type: "cross_source", description: `Evidence collected from ${sourceTypes.size} independent source type(s): ${[...sourceTypes].join(", ")}`, weight: Math.min(1.0, sourceTypes.size * 0.3) });

  const overallConfidence = cluster.confidence_score;
  let interpretation;
  if (overallConfidence >= 0.7) {
    interpretation = `High-confidence detection at ${cluster.center_lat.toFixed(4)}, ${cluster.center_lon.toFixed(4)}. Multiple independent evidence vectors corroborate the presence of Flock hardware at this location.`;
  } else if (overallConfidence >= 0.4) {
    interpretation = `Moderate-confidence detection at ${cluster.center_lat.toFixed(4)}, ${cluster.center_lon.toFixed(4)}. Some evidence is consistent with Flock hardware but additional verification is recommended.`;
  } else {
    interpretation = `Low-confidence lead at ${cluster.center_lat.toFixed(4)}, ${cluster.center_lon.toFixed(4)}. Weak or single-source evidence. This may be a false positive or a location warranting further data collection.`;
  }
  interpretations.push(interpretation);

  if (overallConfidence >= 0.7) {
    recommendations.push("Verify the physical presence of a camera at this location using publicly observable methods.");
    recommendations.push("Cross-reference with public Flock Safety deployment maps or FOIA records if available.");
    actions.push({ action: "Field verify location", owner: "Analyst", dependency: "Physical access to general vicinity", success_criterion: "Visual confirmation or exclusion of camera hardware" });
  } else if (overallConfidence >= 0.4) {
    recommendations.push("Collect additional Wi-Fi/BLE scans from this area to increase detection confidence.");
    recommendations.push("Deploy an SDR capture session to attempt RF fingerprint matching.");
    actions.push({ action: "Collect additional RF data", owner: "Field operator", dependency: "ESP32 or SDR equipment", success_criterion: "At least 3 additional observations from different source types" });
  } else {
    recommendations.push("This lead is too weak for field deployment. Monitor WiGLE for new data in this area.");
    actions.push({ action: "Monitor for new data", owner: "Analyst", dependency: "WiGLE account or periodic scans", success_criterion: "New observations that increase cluster confidence above 0.4" });
  }

  const coverageGaps = [];
  if (observations.length < 3) {
    coverageGaps.push("Insufficient observations at this location — confidence may increase with more data collection.");
  }
  if (sourceTypes.size === 1) {
    coverageGaps.push(`Only one source type (${[...sourceTypes][0]}) detected this location. Multi-source corroboration would significantly increase confidence.`);
  }

  return {
    cluster_id: cluster.id,
    location: { lat: cluster.center_lat, lon: cluster.center_lon },
    confidence_score: overallConfidence,
    confidence_level: overallConfidence >= 0.7 ? "high" : overallConfidence >= 0.4 ? "moderate" : "low",
    observation_count: observations.length,
    source_types: [...sourceTypes],
    evidence_chain: { evidence, interpretations, recommendations, actions, success_criteria: [] },
    coverage_gaps: coverageGaps,
    legal_note: "Passive detection only. No active probing, jamming, or device access. Verify all findings through lawful means.",
  };
}

function scoreCluster(cluster, observations) {
  const obsInCluster = observations.filter(o => cluster.observation_ids.includes(o.id));

  const confidences = obsInCluster.map(o => o.confidence_overall || 0);
  const avgConfidence = confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

  const density = Math.min(1.0, obsInCluster.length / 10);

  const now = Date.now();
  const mostRecent = Math.max(...obsInCluster.map(o => new Date(o.timestamp).getTime()));
  const ageDays = (now - mostRecent) / (1000 * 60 * 60 * 24);
  const recency = Math.max(0, 1 - ageDays / 30);

  const sourceTypes = new Set(obsInCluster.map(o => o.source_type));
  const crossSource = Math.min(1.0, sourceTypes.size / 4);

  const rfCount = obsInCluster.filter(o => o.rf_fingerprint?.template_similarity > 0).length;
  const rfCorroboration = Math.min(1.0, rfCount / 2);

  const score =
    avgConfidence * WEIGHTS.confidence +
    density * WEIGHTS.density +
    recency * WEIGHTS.recency +
    crossSource * WEIGHTS.cross_source +
    rfCorroboration * WEIGHTS.rf_corroboration;

  return {
    ...cluster,
    confidence_score: Math.round(score * 1000) / 1000,
    confidence_breakdown: { confidence: avgConfidence, density, recency, cross_source: crossSource, rf_corroboration: rfCorroboration },
    observation_count: obsInCluster.length,
    source_types: [...sourceTypes],
  };
}

function analyzeUSCoverage(clusters) {
  const US_BOUNDS = { minLat: 24.5, maxLat: 49.5, minLon: -125.0, maxLon: -66.5 };
  const gridSize = 2.0;
  const grid = {};

  for (const cluster of clusters) {
    if (cluster.center_lat < US_BOUNDS.minLat || cluster.center_lat > US_BOUNDS.maxLat || cluster.center_lon < US_BOUNDS.minLon || cluster.center_lon > US_BOUNDS.maxLon) continue;
    const cellLat = Math.floor(cluster.center_lat / gridSize) * gridSize;
    const cellLon = Math.floor(cluster.center_lon / gridSize) * gridSize;
    const key = `${cellLat},${cellLon}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(cluster);
  }

  const latCells = Math.ceil((US_BOUNDS.maxLat - US_BOUNDS.minLat) / gridSize);
  const lonCells = Math.ceil((US_BOUNDS.maxLon - US_BOUNDS.minLon) / gridSize);
  const totalCells = latCells * lonCells;
  const coveredCells = Object.keys(grid).length;

  const coverage = {
    total_grid_cells: totalCells,
    covered_cells: coveredCells,
    coverage_percentage: Math.round((coveredCells / totalCells) * 1000) / 10,
    gaps: [],
    hotspots: [],
  };

  for (let lat = US_BOUNDS.minLat; lat < US_BOUNDS.maxLat; lat += gridSize) {
    for (let lon = US_BOUNDS.minLon; lon < US_BOUNDS.maxLon; lon += gridSize) {
      const key = `${Math.floor(lat / gridSize) * gridSize},${Math.floor(lon / gridSize) * gridSize}`;
      if (!grid[key]) {
        coverage.gaps.push({ region: `${lat.toFixed(1)}, ${lon.toFixed(1)}`, status: "no_data", note: "No detection data for this region. This does NOT mean no cameras are present — only that no evidence has been collected." });
      }
    }
  }

  coverage.hotspots = clusters
    .filter(c => c.confidence_score >= 0.5)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, 20)
    .map(c => ({ location: { lat: c.center_lat, lon: c.center_lon }, confidence: c.confidence_score, observation_count: c.observation_count }));

  return coverage;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function runAgentAnalysis(observations, options = {}) {
  const { threshold = 0.3, maxResults = 50, includeCoverageGaps = true, clusterDistance = 50 } = options;

  const located = observations.filter(o => o.location);

  // Greedy clustering
  const clusters = [];
  const assigned = new Set();

  for (const obs of located) {
    if (assigned.has(obs.id)) continue;

    let foundCluster = false;
    for (const cluster of clusters) {
      const dist = haversine(obs.location.lat, obs.location.lon, cluster.center_lat, cluster.center_lon);
      if (dist <= clusterDistance) {
        cluster.observation_ids.push(obs.id);
        const n = cluster.observation_ids.length;
        cluster.center_lat = cluster.center_lat * (n - 1) / n + obs.location.lat / n;
        cluster.center_lon = cluster.center_lon * (n - 1) / n + obs.location.lon / n;
        assigned.add(obs.id);
        foundCluster = true;
        break;
      }
    }

    if (!foundCluster) {
      clusters.push({ id: `cluster_${clusters.length + 1}`, center_lat: obs.location.lat, center_lon: obs.location.lon, observation_ids: [obs.id] });
      assigned.add(obs.id);
    }
  }

  const scoredClusters = clusters.map(c => scoreCluster(c, located));

  const ranked = scoredClusters
    .filter(c => c.confidence_score >= threshold)
    .sort((a, b) => b.confidence_score - a.confidence_score)
    .slice(0, maxResults);

  const leads = ranked.map(cluster => {
    const clusterObs = located.filter(o => cluster.observation_ids.includes(o.id));
    return buildEvidenceChain(cluster, clusterObs);
  });

  const coverage = includeCoverageGaps ? analyzeUSCoverage(scoredClusters) : null;

  return {
    summary: {
      total_observations: observations.length,
      located_observations: located.length,
      total_clusters: clusters.length,
      ranked_leads: leads.length,
      high_confidence: leads.filter(l => l.confidence_level === "high").length,
      moderate_confidence: leads.filter(l => l.confidence_level === "moderate").length,
      low_confidence: leads.filter(l => l.confidence_level === "low").length,
      analysis_timestamp: new Date().toISOString(),
    },
    leads,
    coverage,
    legal_notice: "This analysis is based on passive detection data only. Coverage gaps indicate regions with no collected data, not confirmed absence of cameras. All findings require lawful verification.",
  };
}

export { runAgentAnalysis, buildEvidenceChain, scoreCluster, analyzeUSCoverage, haversine, WEIGHTS };
