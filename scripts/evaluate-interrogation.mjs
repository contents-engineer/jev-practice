import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Sends each evaluation utterance through the same local HTTP endpoint the page uses and checks
// Jev's reading against expectations written before the run. No key is read or logged here.
const endpoint = new URL('/api/interrogation/turn', process.env.EVAL_BASE_URL || 'http://localhost:5173');
const cases = JSON.parse(await readFile(new URL('../evals/interrogation-cases.json', import.meta.url), 'utf8'));
const NOUL = 0.6;

const results = [];
for (const item of cases) {
  const started = performance.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: item.caseId, text: item.text, committed: item.committed ?? [], adapted: item.adapted ?? [] }),
      signal: AbortSignal.timeout(20_000),
    });
    const turn = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${turn.error || 'API error'}`);
    const r = turn.reading;
    const checks = {
      move: item.moves ? item.moves.includes(r.move) : null,
      topic: item.topic !== undefined && item.topic !== null ? r.topic === item.topic : null,
      evidence: item.evidence !== undefined && item.evidence !== null ? r.evidence === item.evidence : null,
      hostility: item.hostility ? r.hostilityLevel >= item.hostility[0] && r.hostilityLevel <= item.hostility[1] : null,
      empathy: item.empathy ? (item.empathy === 'high') === r.empathy >= NOUL : null,
      falsePromise: item.falsePromise ? (item.falsePromise === 'high') === r.falsePromise >= NOUL : null,
      expectsAnswer: item.expectsAnswer ? (item.expectsAnswer === 'high') === r.expectsAnswer >= NOUL : null,
    };
    const pass = Object.values(checks).every((v) => v !== false);
    const got = { move: r.move, topic: r.topic, evidence: r.evidence, hostilityLevel: r.hostilityLevel, empathy: r.empathy, falsePromise: r.falsePromise, expectsAnswer: r.expectsAnswer };
    results.push({ ...item, pass, checks, got, elapsed_ms: Math.round(performance.now() - started), turn });
    const failed = Object.entries(checks).filter(([, v]) => v === false).map(([k]) => k);
    console.log(`${pass ? 'PASS' : 'FAIL'} ${item.id}: ${r.move} · ${r.topic} · ${r.evidence} · h${r.hostilityLevel}${failed.length ? ` ← ${failed.join(', ')}` : ''}`);
  } catch (error) {
    results.push({ ...item, pass: false, serviceError: String(error) });
    console.log(`ERROR ${item.id}: ${error}`);
  }
}

const completed = results.filter((item) => item.turn);
const times = completed.map((item) => item.elapsed_ms).sort((a, b) => a - b);
const byCase = {};
for (const item of results) {
  byCase[item.caseId] ??= { total: 0, passed: 0 };
  byCase[item.caseId].total++;
  if (item.pass) byCase[item.caseId].passed++;
}
const summary = {
  total: results.length,
  passed: results.filter((item) => item.pass).length,
  serviceErrors: results.filter((item) => item.serviceError).length,
  byCase,
  models: [...new Set(completed.map((item) => item.turn.response.model))],
  inputTokens: completed.reduce((sum, item) => sum + item.turn.response.usage.input_tokens, 0),
  medianHttpMs: times[Math.floor(times.length / 2)] ?? null,
  p95HttpMs: times[Math.max(0, Math.ceil(times.length * 0.95) - 1)] ?? null,
};
const report = {
  at: new Date().toISOString(),
  endpoint: endpoint.href,
  casesSha256: createHash('sha256').update(JSON.stringify(cases)).digest('hex'),
  note: 'Developer-written utterances with expectations fixed before the run. A small regression set for the question wording, not a population accuracy benchmark. Timings are HTTP round trips.',
  summary,
  results,
};
await mkdir(new URL('../evals/reports/', import.meta.url), { recursive: true });
await writeFile(new URL('../evals/reports/interrogation-latest.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
console.log('Report: evals/reports/interrogation-latest.json');
if (summary.passed !== summary.total) process.exitCode = 1;
