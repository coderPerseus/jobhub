const apiUrl = (process.env.API_URL ?? "https://folk-job-api.snailrun160.workers.dev").replace(/\/$/, "");
const token = process.env.INGEST_TOKEN;

if (!token) throw new Error("INGEST_TOKEN is required");

const response = await fetch(`${apiUrl}/admin/notifications/dispatch`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
const payload = await response.json();
if (!response.ok) throw new Error(`Notification dispatch failed (${response.status}): ${JSON.stringify(payload)}`);
console.log(JSON.stringify(payload));
