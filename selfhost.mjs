import { createServer } from "node:http";
import worker from "./src/index.js";

const port = Number(process.env.PORT || 8787);
const env = {
  AI: null,
  DB: null,
  AI_DB: null,
  INGEST_TOKEN: process.env.INGEST_TOKEN || "",
  AI_FEEDBACK_TOKEN: process.env.AI_FEEDBACK_TOKEN || "",
};

const server = createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://localhost:${port}${incoming.url || "/"}`, {
      method: incoming.method || "GET",
      headers: incoming.headers,
      body: incoming.method === "GET" || incoming.method === "HEAD" ? undefined : body,
    });
    const response = await worker.fetch(request, env);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, key) => outgoing.setHeader(key, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    outgoing.statusCode = 500;
    outgoing.setHeader("content-type", "application/json; charset=utf-8");
    outgoing.end(JSON.stringify({ error: "self-host adapter failure", detail: String(error.message || error) }));
  }
});

server.listen(port, "0.0.0.0", () => console.log(`Corpora AI self-host adapter listening on port ${port}`));
