import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite, lens, emotions, readFeeling, emotionFaceQuestions;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  lens = await vite.ssrLoadModule('/projects/emotion-lens/lens.ts');
  emotions = await vite.ssrLoadModule('/projects/emotion-face/emotions.ts');
  ({ readFeeling } = await vite.ssrLoadModule('/projects/emotion-lens/server.ts'));
  ({ questions: emotionFaceQuestions } = await vite.ssrLoadModule('/projects/emotion-face/server.ts'));
});
after(async () => { await vite?.close(); });

const frame = id => lens.FRAMES.find(f => f.id === id);
const moodOf = id => ({ mix: { ...emotions.NEUTRAL.mix, [id]: 1 }, strength: 0.8 });
const readable = (id, frameId, tone) =>
  lens.readability(lens.expressionWeights(moodOf(id)), lens.visibility(frameId ? frame(frameId) : null, tone)).total;

test('every blendshape belongs to exactly one face region', () => {
  const counts = { brow: 0, eye: 0, cheek: 0, lower: 0 };
  for (const name of emotions.ARKIT_BLENDSHAPES) counts[lens.regionOf(name)]++;
  assert.deepEqual(counts, { brow: 5, eye: 14, cheek: 2, lower: 31 });
});

test('frame data matches the launch export and is internally consistent', () => {
  assert.deepEqual(lens.FRAMES.map(f => f.model), ['Vanilla', 'Rococo', 'Boni', 'Gent', 'New Her']);
  const skus = lens.FRAMES.flatMap(f => f.variants.map(v => v.sku));
  assert.equal(new Set(skus).size, skus.length, 'SKUs are unique');
  for (const f of lens.FRAMES) {
    for (const key of ['lensWidth', 'bridge', 'frameFront', 'templeLength', 'lensHeight']) assert.ok(f[key] > 0, `${f.id}.${key}`);
    assert.ok(f.variants.length > 0);
    for (const v of f.variants) assert.ok(v.tone in lens.TONES, `${v.name} has a known lens type`);
  }
  // Every option points at a real variant of its own frame in that lens type.
  for (const o of lens.OPTIONS) assert.ok(o.frame.variants.includes(o.variant) && o.variant.tone === o.tone);
});

test('lens height decides whether brows and cheeks are covered', () => {
  for (const f of lens.FRAMES) assert.equal(lens.coverage(f).eye, 1, `${f.id} covers the eyes`);
  const small = lens.coverage(frame('vanilla'));
  const large = lens.coverage(frame('new-her'));
  assert.ok(small.brow < 0.5 && large.brow === 1, 'only the tall lens covers the brows');
  assert.ok(small.cheek === 0 && large.cheek > 0.9, 'only the tall lens reaches the cheeks');
  // Coverage grows with lens height.
  const byHeight = [...lens.FRAMES].sort((a, b) => a.lensHeight - b.lensHeight).map(f => lens.coverage(f).brow);
  assert.deepEqual(byHeight, [...byHeight].sort((a, b) => a - b));
});

test('no glasses shows everything, and darker lenses show less', () => {
  for (const id of ['happy', 'sad', 'surprised', 'fear']) {
    assert.ok(Math.abs(readable(id, null, null) - 1) < 1e-9, `${id} is fully readable bare-faced`);
    const tint = readable(id, 'gent', 'TINT');
    const dark = readable(id, 'gent', 'DARK');
    assert.ok(tint > dark, `${id}: TINT shows more than DARK`);
  }
  assert.ok(readable('fear', 'vanilla', 'DARK') > readable('fear', 'vanilla', 'MIRROR'));
});

test('big lenses hide surprise and fear far more than a smile', () => {
  // Surprise and fear live around the eyes and brows; a smile lives mostly in the mouth.
  assert.ok(readable('surprised', 'new-her', 'DARK') < readable('surprised', 'vanilla', 'DARK') - 0.3);
  assert.ok(readable('fear', 'new-her', 'DARK') < readable('fear', 'vanilla', 'DARK'));
  assert.ok(readable('happy', 'new-her', 'DARK') > readable('surprised', 'new-her', 'DARK') + 0.3);
});

test('a neutral face has nothing to read, so nothing is recommended', () => {
  const weights = lens.expressionWeights(emotions.NEUTRAL);
  assert.equal(lens.readability(weights, lens.visibility(frame('gent'), 'DARK')).total, null);
  assert.deepEqual(lens.recommend(weights, 0.5), []);
});

test('recommendations land closest to how much the person wants to show', () => {
  const weights = lens.expressionWeights(moodOf('surprised'));
  const hide = lens.recommend(weights, 0);
  const show = lens.recommend(weights, 1);
  assert.equal(hide.length, 3);
  assert.ok(hide[0].total <= hide[2].total, 'sorted by distance from 0');
  assert.ok(show[0].total > hide[0].total);
  assert.equal(show[0].tone, 'TINT', 'showing the most picks the lightest lens');
  assert.ok(['gent', 'new-her'].includes(hide[0].frame.id), 'hiding the most picks a tall lens');
});

test('the feeling question uses the same emotion ids as the facial presets', async () => {
  let sent;
  const mock = { systemOne: async request => { sent = request; return { marker: 'typed response' }; } };
  const result = await readFeeling({ text: '내일 첫 면접이에요' }, mock);
  assert.deepEqual(Object.keys(sent.questions), ['feeling', 'intensity']);
  assert.deepEqual(
    Object.keys(sent.questions.feeling.criteria).sort(),
    Object.keys(emotionFaceQuestions.emotion.criteria).sort(),
  );
  assert.equal(sent.state.situation_in_own_words, '내일 첫 면접이에요');
  assert.equal(result.response.marker, 'typed response');
});

test('readFeeling rejects empty and oversized input before calling Jev', async () => {
  let calls = 0;
  const mock = { systemOne: async () => { calls++; return {}; } };
  for (const body of [null, {}, { text: '' }, { text: '   ' }, { text: 3 }]) {
    await assert.rejects(readFeeling(body, mock), error => error.status === 400);
  }
  await assert.rejects(readFeeling({ text: 'x'.repeat(501) }, mock), error => error.status === 413);
  assert.equal(calls, 0);
});
