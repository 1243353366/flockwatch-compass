/**
 * FlockWatch Python Runner
 *
 * Bridges the Node.js server to the Python FlockWatch engine.
 * Calls the Python CLI via child process with strict limits.
 */

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PYTHON = process.env.PYTHON || "python3";
const FLOCKWATCH_DIR = process.env.FLOCKWATCH_DIR || path.join(__dirname, "..", "vendor", "flockwatch");
const MAX_EXECUTION_MS = Number(process.env.FLOCKWATCH_TIMEOUT_MS || 30_000);
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;

function runFlockwatch(args, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = options.timeout || MAX_EXECUTION_MS;

    execFile(PYTHON, ["-m", "flockwatch", ...args], {
      cwd: FLOCKWATCH_DIR,
      timeout,
      maxBuffer: MAX_OUTPUT_BYTES,
      env: { ...process.env, PYTHONPATH: FLOCKWATCH_DIR },
    }, (error, stdout, stderr) => {
      if (error) {
        reject({ error: error.message, stderr: stderr?.slice(0, 2000), stdout: stdout?.slice(0, 2000) });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function ingestFile(type, filePath, options = {}) {
  const output = options.output || `${filePath}.observations.jsonl`;
  const args = ["ingest", "--type", type, "--file", filePath, "--output", output];
  if (options.append) args.push("--append");
  await runFlockwatch(args);
  return { output_file: output };
}

async function scoreObservations(inputFile, outputFile, threshold = 0.5) {
  const args = ["score", "--input", inputFile, "--output", outputFile, "--threshold", String(threshold)];
  await runFlockwatch(args);
  const content = readFileSync(outputFile, "utf-8");
  return content.split("\n").filter(line => line.trim()).map(line => JSON.parse(line));
}

async function generateMap(inputFile, outputFile, imagery = "osm") {
  const args = ["map", "--input", inputFile, "--output", outputFile, "--imagery", imagery];
  await runFlockwatch(args);
  return { map_file: outputFile };
}

async function extractRfFeatures(iqFile, sampleRate, centerFreq, outputFile) {
  const args = ["rf-extract", "--file", iqFile, "--sample-rate", String(sampleRate), "--center-freq", String(centerFreq), "--output", outputFile];
  await runFlockwatch(args);
  return JSON.parse(readFileSync(outputFile, "utf-8"));
}

async function listSignatures() {
  const { stdout } = await runFlockwatch(["list-sigs"]);
  return stdout;
}

export { runFlockwatch, ingestFile, scoreObservations, generateMap, extractRfFeatures, listSignatures };
