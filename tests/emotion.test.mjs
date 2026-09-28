import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite, ReadingLoop, RequestBudget, readEmotion;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  ({ ReadingLoop } = await vite.ssrLoadModule('/projects/emotion-face/reading-loop.ts'));
  ({ RequestBudget } = await vite.ssrLoadModule('/server/budget.ts'));
  ({ readEmotion } = await vite.ssrLoadModule('/projects/emotion-face/server.ts'));
});
after(async () => { await vite?.close(); });

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
function harness() {
  const requests = [], shown = [], errors = [];
  let idle = 0;
  const loop = new ReadingLoop({
    read: text => new Promise((resolve, reject) => requests.push({ text, resolve, reject })),
    show: (value, text) => shown.push({ value, text }),
    pending: () => {}, idle: () => { idle++; }, error: error => errors.push(error),
  }, 0);
  return { loop, requests, shown, errors, idle: () => idle };
}

test('append-only negation discards stale response and sends only latest queued text', async () => {
  const h = harness();
  h.loop.update('난 네가 좋아');
  await tick();
  h.loop.update('난 네가 좋아서');
  h.loop.update('난 네가 좋아서 만나는 게 아니야.');
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve('happy');
  await tick();
  assert.deepEqual(h.shown, []);
  assert.equal(h.requests[1].text, '난 네가 좋아서 만나는 게 아니야.');
  h.requests[1].resolve('sad');
  await tick();
  assert.deepEqual(h.shown, [{ value: 'sad', text: '난 네가 좋아서 만나는 게 아니야.' }]);
});

test('clearing and retyping the same text invalidates its old revision', async () => {
  const h = harness();
  h.loop.update('안녕');
  await tick();
  h.loop.update('');
  h.loop.update('안녕');
  h.requests[0].resolve('old');
  await tick();
  assert.equal(h.idle(), 1);
  assert.deepEqual(h.shown, []);
  h.requests[1].resolve('new');
  await tick();
  assert.equal(h.shown[0].value, 'new');
});

test('stale failures do not replace current state and the queue recovers', async () => {
  const h = harness();
  h.loop.update('old');
  await tick();
  h.loop.update('new');
  h.requests[0].reject(new Error('old failure'));
  await tick();
  assert.equal(h.errors.length, 0);
  h.requests[1].reject(new Error('current failure'));
  await tick();
  assert.equal(h.errors.length, 1);
  h.loop.update('recovered');
  await tick();
  h.requests[2].resolve('ok');
  await tick();
  assert.equal(h.shown[0].value, 'ok');
});

test('clearing an in-flight input never resurrects the face', async () => {
  const h = harness();
  h.loop.update('old');
  await tick();
  h.loop.update('');
  h.requests[0].resolve('old');
  await tick();
  assert.deepEqual(h.shown, []);
  assert.equal(h.requests.length, 1);
});

test('concurrency, minute and daily budgets reset at their own boundaries', () => {
  const budget = new RequestBudget({ perMinute: 2, perDay: 3, concurrent: 1 });
  const release = budget.acquire(0);
  assert.equal(typeof release, 'function');
  assert.equal(budget.acquire(0), undefined);
  release(); release(); // idempotent; cannot manufacture extra slots
  budget.acquire(0)();
  assert.equal(budget.acquire(0), undefined);
  budget.acquire(60_000)();
  assert.equal(budget.acquire(120_000), undefined);
  budget.acquire(86_400_000)();
});

test('invalid payloads never invoke Jev; valid requests batch independent questions', async () => {
  const calls = [];
  const mock = { systemOne: async (...args) => { calls.push(args); return { marker: 'typed response' }; } };
  for (const body of [null, {}, { text: '' }, { text: 1 }, { text: '   ' }]) {
    await assert.rejects(readEmotion(body, mock), error => error.status === 400);
  }
  await assert.rejects(readEmotion({ text: 'x'.repeat(2001) }, mock), error => error.status === 413);
  assert.equal(calls.length, 0);
  const result = await readEmotion({ text: '내일 3시에 만나.' }, mock);
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0][0].questions), ['emotion', 'intensity']);
  assert.equal(result.request.state.message_to_recipient, '내일 3시에 만나.');
  assert.equal(result.response.marker, 'typed response');
});
