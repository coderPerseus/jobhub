const apiUrl = (process.env.API_URL ?? "https://folk-job-api.snailrun160.workers.dev").replace(/\/$/, "");
const limit = Math.min(Math.max(Number(process.env.LIMIT ?? 500), 1), 500);
const force = process.env.FORCE === "1";
const jobIdArgument = process.argv.find((value) => value.startsWith("--job-id="));
const jobId = jobIdArgument?.slice("--job-id=".length).trim() || process.env.JOB_ID?.trim() || undefined;

if (!process.env.INGEST_TOKEN) throw new Error("INGEST_TOKEN is required");

const response = await fetch(`${apiUrl}/admin/enrichment/enqueue`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.INGEST_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ limit, force, jobId }),
});
const payload = await response.json();
if (!response.ok) throw new Error(`Enqueue failed (${response.status}): ${JSON.stringify(payload)}`);
console.log(JSON.stringify(payload));
