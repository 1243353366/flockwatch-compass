/**
 * AI Narrative Layer for FlockWatch Compass
 *
 * Adapted from Project Compass's AI narrative pattern.
 * Generates contextual intelligence summaries using an OpenAI-compatible API.
 * Falls back to deterministic output if the AI provider is unavailable.
 */

const AI_MODE = process.env.AI_MODE === "on";
const AI_API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || "";
const AI_BASE_URL = process.env.AI_BASE_URL || process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 15_000);

function buildPrompt(analysis) {
  const leads = analysis.leads.slice(0, 10);
  const coverage = analysis.coverage;

  return `You are an intelligence analyst reviewing passive detection data for Flock Safety ALPR cameras across the United States.

## Analysis Summary
- Total observations: ${analysis.summary.total_observations}
- Located observations: ${analysis.summary.located_observations}
- Total clusters: ${analysis.summary.total_clusters}
- Ranked leads: ${analysis.summary.ranked_leads}
- High confidence: ${analysis.summary.high_confidence}
- Moderate confidence: ${analysis.summary.moderate_confidence}
- Low confidence: ${analysis.summary.low_confidence}

## Top Leads
${leads.map((l, i) => `### Lead ${i + 1}: ${l.confidence_level.toUpperCase()} confidence (${(l.confidence_score * 100).toFixed(0)}%)
Location: ${l.location.lat.toFixed(4)}, ${l.location.lon.toFixed(4)}
Observations: ${l.observation_count}
Sources: ${l.source_types.join(", ")}
Evidence: ${l.evidence_chain.evidence.map(e => e.description).join("; ")}
Recommendations: ${l.evidence_chain.recommendations.join("; ")}
Coverage gaps: ${l.coverage_gaps.join("; ")}`).join("\n\n")}

## US Coverage
${coverage ? `Grid coverage: ${coverage.coverage_percentage}% of US territory has detection data
Hotspots: ${coverage.hotspots.length} high-confidence locations
Gaps: ${coverage.gaps.length} regions with no data` : "Coverage analysis not performed"}

Provide:
1. Executive summary (2-3 sentences) of the overall detection landscape
2. Top 3 highest-priority leads with verification recommendations
3. Notable coverage gaps that warrant data collection priority
4. Risk assessment noting what could make these detections false positives
5. Recommended next steps for the analyst`;
}

async function generateNarrative(analysis) {
  if (!AI_MODE || !AI_API_KEY) {
    return { narrative: generateDeterministicNarrative(analysis), generated_by: "deterministic", generated_at: new Date().toISOString() };
  }

  const prompt = buildPrompt(analysis);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const response = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: "You are a professional intelligence analyst specializing in passive surveillance detection. You are precise, transparent about uncertainty, and always recommend lawful verification." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`AI provider returned ${response.status}`);

    const data = await response.json();
    const narrative = data.choices?.[0]?.message?.content;

    if (!narrative || narrative.trim().length < 50) throw new Error("AI provider returned empty or unusable response");

    return { narrative, generated_by: "ai", model: AI_MODEL, generated_at: new Date().toISOString() };
  } catch (error) {
    return { narrative: generateDeterministicNarrative(analysis), generated_by: "deterministic_fallback", fallback_reason: error.message, generated_at: new Date().toISOString() };
  }
}

function generateDeterministicNarrative(analysis) {
  const { summary, leads, coverage } = analysis;
  const lines = [];

  lines.push("## Executive Summary");
  if (summary.ranked_leads === 0) {
    lines.push(`Analysis of ${summary.total_observations} observations produced no ranked leads above the confidence threshold.`);
  } else {
    lines.push(`Analysis of ${summary.total_observations} observations across ${summary.total_clusters} location clusters identified ${summary.ranked_leads} ranked leads, including ${summary.high_confidence} high-confidence and ${summary.moderate_confidence} moderate-confidence detections.`);
  }
  lines.push("");

  lines.push("## Priority Leads");
  const topLeads = leads.slice(0, 3);
  if (topLeads.length === 0) {
    lines.push("No leads met the confidence threshold. Consider collecting additional data from underrepresented regions.");
  } else {
    topLeads.forEach((lead, i) => {
      lines.push(`### Lead ${i + 1}: ${lead.confidence_level.toUpperCase()} (${(lead.confidence_score * 100).toFixed(0)}%)`);
      lines.push(`- Location: ${lead.location.lat.toFixed(4)}, ${lead.location.lon.toFixed(4)}`);
      lines.push(`- Evidence: ${lead.evidence_chain.evidence.map(e => e.description).join("; ")}`);
      lines.push(`- Recommendation: ${lead.evidence_chain.recommendations[0] || "Collect more data."}`);
      lines.push("");
    });
  }

  if (coverage) {
    lines.push("## Coverage Assessment");
    lines.push(`Current data covers approximately ${coverage.coverage_percentage}% of the US landmass grid. ${coverage.gaps.length} regions have no collected data.`);
    lines.push("Coverage gaps indicate areas where no detection data has been collected — not confirmed absence of cameras.");
    lines.push("");
  }

  lines.push("## Risk Assessment");
  lines.push("- False positives may occur from devices with similar OUI prefixes or SSID patterns");
  lines.push("- Single-source detections carry higher uncertainty than multi-source corroboration");
  lines.push("- RF fingerprint template matching depends on reference library quality");
  lines.push("- Coverage gaps do not confirm absence — only lack of collected data");
  lines.push("");

  lines.push("## Recommended Next Steps");
  lines.push("1. Verify high-confidence leads through lawful, publicly observable methods");
  lines.push("2. Collect additional data in coverage gap regions, especially near major roadways and intersections");
  lines.push("3. Cross-reference detections with public Flock Safety deployment records if available");
  lines.push("4. Expand RF fingerprint template library with verified captures");

  return lines.join("\n");
}

export { generateNarrative, generateDeterministicNarrative, buildPrompt };
