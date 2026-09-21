import { Worker } from "bullmq";
import IORedis from "ioredis";
import { recommendProject } from "../src/recommendation-engine.js";
import { authorizePlanningCapabilities } from "../src/capability-policy.js";

const queueUrl = process.env.QUEUE_URL;
if (!queueUrl) throw new Error("QUEUE_URL is required for the private planning worker.");

const connection = new IORedis(queueUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
const concurrency = Math.max(1, Math.min(4, Number(process.env.WORKER_CONCURRENCY || 2)));

const worker = new Worker(
  "project-compass-planning",
  async (job) => {
    if (job.name !== "build-decision-brief") throw new Error("Unsupported job type.");
    authorizePlanningCapabilities(job.data.input);
    return recommendProject(job.data.input);
  },
  { connection, concurrency, lockDuration: 30_000 }
);

worker.on("ready", () => console.log(`Project Compass planning worker ready with concurrency ${concurrency}.`));
worker.on("failed", (job, error) => console.error(JSON.stringify({ event: "job_failed", jobId: job?.id || null, error: error.name })));
worker.on("error", (error) => console.error(JSON.stringify({ event: "worker_error", error: error.name })));

async function shutdown() {
  await worker.close();
  await connection.quit();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
