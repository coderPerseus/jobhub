import { execFileSync } from "node:child_process";

import { classifyInternetJob } from "../src/job-classification.ts";

const applyChanges = process.env.APPLY === "1";

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function query(statement) {
  const output = execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "folk-job", "--remote", "--command", statement, "--json"],
    { encoding: "utf8", maxBuffer: 80 * 1024 * 1024 },
  );
  const payload = JSON.parse(output);
  if (!payload.every((result) => result.success)) throw new Error(output);
  return payload[0]?.results ?? [];
}

const jobs = query("SELECT id, category, title, body FROM jobs ORDER BY published_at DESC");
const retained = [];
const removed = [];
for (const job of jobs) {
  const category = classifyInternetJob(`${job.title}\n${job.body}`, job.category);
  if (category) retained.push({ ...job, nextCategory: category });
  else removed.push(job);
}

const counts = retained.reduce((result, job) => {
  result[job.nextCategory] = (result[job.nextCategory] ?? 0) + 1;
  return result;
}, {});
console.log(JSON.stringify({
  mode: applyChanges ? "apply" : "dry-run",
  total: jobs.length,
  retained: retained.length,
  removed: removed.length,
  categories: counts,
  removedSamples: removed.slice(0, 60).map(({ id, title }) => ({ id, title })),
}, null, 2));

if (applyChanges) {
  for (let index = 0; index < retained.length; index += 75) {
    const statements = retained.slice(index, index + 75).map((job) =>
      `UPDATE jobs SET category=${sql(job.nextCategory)} WHERE id=${sql(job.id)};`,
    );
    query(statements.join("\n"));
  }
  for (let index = 0; index < removed.length; index += 75) {
    const ids = removed.slice(index, index + 75).map((job) => sql(job.id));
    query(`DELETE FROM jobs WHERE id IN (${ids.join(",")})`);
  }
  console.log(JSON.stringify({ applied: true, retained: retained.length, removed: removed.length }));
}
