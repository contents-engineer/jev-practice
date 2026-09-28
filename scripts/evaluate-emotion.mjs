import { createServer } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Calls the same local HTTP endpoint used by the UI; no key is read or logged here.
const endpoint = new URL('/api/emotion-face/emotion', process.env.EVAL_BASE_URL || 'http://localhost:5173');
const vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
let samples;
try {
  ({ SAMPLES: samples } = await vite.ssrLoadModule('/projects/emotion-face/samples.ts'));
} finally {
  await vite.close();
}
const independent = JSON.parse(await readFile(new URL('../evals/emotion-cases.json', import.meta.url), 'utf8'));
const cases = [
  ...samples.map((sample, i) => ({ id: `sample-${i + 1}`, text: sample.text, emotions: [sample.emotion], intensity: null, group: 'samples' })),
  ...independent.map(item => ({ ...item, group: 'independent' })),
];
const results = [];
for (const item of cases) {
  const started = performance.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.text }), signal: AbortSignal.timeout(20_000),
    });
    const reading = await response.json();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${reading.error || 'API error'}`);
    const { emotion, intensity } = reading.response.answers;
    const emotionPass = item.emotions.includes(emotion.choice);
    // UI intentionally ignores the speculative intensity when the reading is unclear.
    const intensityPass = item.intensity === null || emotion.choice === 'unclear'
      ? null : intensity.score >= item.intensity[0] && intensity.score <= item.intensity[1];
    const pass = emotionPass && intensityPass !== false;
    results.push({ ...item, pass, emotionPass, intensityPass, elapsed_ms: Math.round(performance.now() - started), reading });
    console.log(`${pass ? 'PASS' : 'FAIL'} ${item.id}: ${emotion.choice}, score=${intensity.score.toFixed(2)}`);
  } catch (error) {
    results.push({ ...item, pass: false, serviceError: String(error) });
    console.log(`ERROR ${item.id}: ${error}`);
  }
}
const completed = results.filter(item => item.reading);
const times = completed.map(item => item.elapsed_ms).sort((a, b) => a - b);
const summary = {
  total: results.length,
  passed: results.filter(item => item.pass).length,
  serviceErrors: results.filter(item => item.serviceError).length,
  groups: Object.fromEntries(['samples', 'independent'].map(group => [group, {
    total: results.filter(item => item.group === group).length,
    passed: results.filter(item => item.group === group && item.pass).length,
  }])),
  models: [...new Set(completed.map(item => item.reading.response.model))],
  inputTokens: completed.reduce((sum, item) => sum + item.reading.response.usage.input_tokens, 0),
  medianHttpMs: times[Math.floor(times.length / 2)] ?? null,
  p95HttpMs: times[Math.max(0, Math.ceil(times.length * 0.95) - 1)] ?? null,
};
const report = {
  at: new Date().toISOString(), endpoint: endpoint.href,
  casesSha256: createHash('sha256').update(JSON.stringify(cases)).digest('hex'),
  note: 'Small developer-labelled regression set, not measured human reactions or a population accuracy benchmark. Timings are HTTP round trips, not input-to-render.',
  summary, results,
};
await mkdir(new URL('../evals/reports/', import.meta.url), { recursive: true });
await writeFile(new URL('../evals/reports/latest.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
console.log('Report: evals/reports/latest.json');
if (summary.passed !== summary.total) process.exitCode = 1;
