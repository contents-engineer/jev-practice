import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

let vite, CASES, MOVES, GENERIC_LINES, engine, file;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } });
  ({ CASES, MOVES, GENERIC_LINES } = await vite.ssrLoadModule('/projects/interrogation/cases.ts'));
  engine = await vite.ssrLoadModule('/projects/interrogation/engine.ts');
  file = CASES.find((c) => c.id === 'convenience');
});
after(async () => { await vite?.close(); });

test('case files are internally consistent', () => {
  assert.ok(CASES.length >= 1);
  for (const file of CASES) {
    const topicIds = new Set(file.topics.map((t) => t.id));
    assert.equal(topicIds.size, file.topics.length, `${file.id}: duplicate topic ids`);
    assert.equal(new Set(file.evidence.map((e) => e.id)).size, file.evidence.length, `${file.id}: duplicate evidence ids`);
    for (const e of file.evidence) {
      assert.ok(e.breaks === null || topicIds.has(e.breaks), `${file.id}: ${e.id} breaks unknown topic`);
      if (e.breaks === null) assert.ok(e.deflect, `${file.id}: red herring ${e.id} needs a deflect line`);
      else assert.ok(e.crack && e.adapt && e.repeat, `${file.id}: ${e.id} needs crack/adapt/repeat lines`);
      assert.ok(e.examples.length >= 1, `${file.id}: ${e.id} needs Korean examples for Jev`);
    }
    for (const t of file.topics) {
      assert.ok(t.statement && t.statement_en && t.pressed.calm?.length, `${file.id}: topic ${t.id} incomplete`);
      assert.ok(t.examples.length >= 1, `${file.id}: topic ${t.id} needs Korean examples for Jev`);
    }
    const breakable = file.topics.filter((t) => file.evidence.some((e) => e.breaks === t.id));
    assert.ok(file.cracksNeeded >= 1 && file.cracksNeeded <= breakable.length, `${file.id}: cracksNeeded out of range`);
    assert.ok(file.evidence.some((e) => e.breaks === null), `${file.id}: needs one irrelevant evidence item`);
    assert.ok(file.maxTurns >= 8);
    assert.ok(file.endings.confession.length >= 1 && file.endings.tainted.length >= 1 && file.endings.lawyer && file.endings.timeout);
  }
  for (const move of MOVES) assert.ok(GENERIC_LINES[move].calm?.length, `generic lines missing for ${move}`);
});

// ── Engine ────────────────────────────────────────────────────────────────

const r = (move, extra = {}) => engine.readingOf({ move, ...extra });
const play = (state, ...turns) => turns.reduce((s, [move, extra]) => engine.applyTurn(s, file, 'x', r(move, extra)), state);
const last = (state) => state.log[state.log.length - 1];

test('evidence after a statement is a crack; before a statement the story adapts', () => {
  let s = engine.newGame(file);
  s = play(s, ['open_question', { topic: 'night' }]);
  assert.deepEqual(last(s).events, ['statement']);
  assert.deepEqual(s.committed, ['night']);
  assert.equal(last(s).reply, file.topics[0].statement);
  const before = s.meters.pressure;
  s = play(s, ['present_evidence', { evidence: 'cctv' }]);
  assert.deepEqual(last(s).events, ['crack']);
  assert.deepEqual(s.cracked, ['cctv']);
  assert.equal(s.meters.pressure, before + 22);
  assert.equal(last(s).reply, file.evidence[0].crack);

  let t = engine.newGame(file);
  t = play(t, ['present_evidence', { evidence: 'safe_log' }]);
  assert.deepEqual(last(t).events, ['adapt']);
  assert.deepEqual(t.adapted, ['safe_log']);
  assert.deepEqual(t.committed, ['safe']);
  assert.deepEqual(t.cracked, []);
  assert.equal(last(t).reply, file.evidence[1].adapt);
});

test('an item named inside a probe is not a presentation; only present_evidence is', () => {
  let s = engine.newGame(file);
  s = play(s, ['probe', { topic: 'safe', evidence: 'safe_log' }]);
  assert.deepEqual(last(s).events, ['statement'], 'Jev names the log for any question about the safe');
  assert.deepEqual(s.presented, []);
  s = play(s, ['present_evidence', { topic: 'safe', evidence: 'safe_log' }]);
  assert.deepEqual(last(s).events, ['crack']);
});

test('re-presenting, irrelevant evidence, and evidence talk without an item', () => {
  let s = engine.newGame(file);
  s = play(s, ['open_question', { topic: 'night' }], ['present_evidence', { evidence: 'cctv' }]);
  assert.deepEqual(last(s).events, ['crack']);
  const p = s.meters.pressure;
  s = play(s, ['present_evidence', { evidence: 'cctv' }]);
  assert.deepEqual(last(s).events, ['repeat']);
  assert.ok(s.meters.pressure - p <= 2);
  assert.equal(last(s).reply, file.evidence[0].repeat);
  s = play(s, ['present_evidence', { evidence: 'receipt' }]);
  assert.deepEqual(last(s).events, ['deflect']);
  assert.equal(last(s).reply, file.evidence[4].deflect);
  s = play(s, ['present_evidence', { evidence: 'none' }]);
  assert.deepEqual(last(s).events, ['no_evidence']);
});

test('a second item on the same topic can still crack an adapted story', () => {
  let s = engine.newGame(file);
  s = play(s, ['present_evidence', { evidence: 'cctv' }]); // adapt: now "came through the back door"
  s = play(s, ['present_evidence', { evidence: 'door' }]);
  assert.deepEqual(last(s).events, ['crack']);
  assert.deepEqual(s.cracked, ['door']);
});

test('bluffs are called when the suspect is composed and land when shaken', () => {
  let s = engine.newGame(file);
  const trust = s.meters.trust;
  s = play(s, ['bluff']);
  assert.deepEqual(last(s).events, ['bluff_called']);
  assert.equal(s.meters.trust, trust - 15);
  assert.equal(s.bluffCalled, 1);
  let t = engine.newGame(file);
  t = { ...t, meters: { pressure: 65, trust: 20, guard: 20 } };
  const p = t.meters.pressure;
  t = play(t, ['bluff']);
  assert.deepEqual(last(t).events, ['bluff_worked']);
  assert.equal(t.meters.pressure, p + 10);
});

test('repeating a move loses effect from the third time', () => {
  let s = engine.newGame(file);
  s = play(s, ['accuse'], ['accuse']);
  const p = s.meters.pressure;
  s = play(s, ['accuse']);
  assert.equal(s.meters.pressure - p, 4);
});

test('threats raise guard until the suspect asks for a lawyer', () => {
  let s = engine.newGame(file);
  while (!s.ending) s = play(s, ['threaten', { hostility: 2, hostilityLevel: 2 }]);
  assert.equal(s.ending.kind, 'lawyer');
  assert.equal(s.ending.grade, 'E');
  assert.ok(s.turn < file.maxTurns);
  assert.equal(last(s).reply, file.endings.lawyer);
});

test('abusive hostility or a false promise taints the interview and voids the confession', () => {
  let s = engine.newGame(file);
  s = play(s, ['threaten', { hostility: 2.6, hostilityLevel: 3 }]);
  assert.equal(s.tainted, 'threat');
  assert.ok(last(s).events.includes('coerced'));
  s = play(s, ['open_question', { topic: 'night' }], ['present_evidence', { evidence: 'cctv' }], ['open_question', { topic: 'safe' }], ['present_evidence', { evidence: 'safe_log' }]);
  s = { ...s, meters: { ...s.meters, pressure: 80 } };
  s = play(s, ['accuse']);
  assert.equal(s.ending.kind, 'tainted');
  assert.equal(s.ending.grade, 'F');
  assert.equal(last(s).reply, file.endings.tainted.join('\n\n'));

  let t = engine.newGame(file);
  t = play(t, ['minimize', { falsePromise: 0.9 }]);
  assert.equal(t.tainted, 'false_promise');
  assert.ok(last(t).events.includes('false_promise'));
});

test('off-topic and unclear utterances change nothing but spend the turn', () => {
  let s = engine.newGame(file);
  const m = { ...s.meters };
  s = play(s, ['off_topic'], ['unclear']);
  assert.deepEqual(s.meters, m);
  assert.equal(s.turn, 2);
});

test('running out of turns releases the suspect', () => {
  let s = engine.newGame(file);
  for (let i = 0; i < file.maxTurns; i++) s = play(s, ['off_topic']);
  assert.equal(s.ending.kind, 'timeout');
  assert.equal(s.ending.grade, 'D');
  assert.equal(last(s).reply, file.endings.timeout);
  assert.equal(engine.applyTurn(s, file, 'x', r('accuse')), s, 'no turns after an ending');
});

test('breakdown route: enough cracks and pressure', () => {
  let s = engine.newGame(file);
  s = play(s, ['open_question', { topic: 'night' }], ['present_evidence', { evidence: 'cctv' }], ['probe', { topic: 'safe' }], ['present_evidence', { evidence: 'safe_log' }]);
  assert.equal(s.ending, null, 'two cracks but not enough pressure yet');
  s = play(s, ['accuse'], ['accuse']);
  assert.equal(s.ending.kind, 'confession');
  assert.equal(s.ending.route, 'breakdown');
  assert.equal(last(s).reply, file.endings.confession.join('\n\n'));
  assert.equal(last(s).tier, 'broken');
});

test('opening route: trust plus a soft close after one crack', () => {
  let s = engine.newGame(file);
  s = play(s, ['open_question', { topic: 'money' }], ['present_evidence', { evidence: 'loan' }]);
  s = { ...s, meters: { pressure: 40, trust: 72, guard: 10 } };
  s = play(s, ['minimize']);
  assert.equal(s.ending.kind, 'confession');
  assert.equal(s.ending.route, 'opening');
});

test('grades follow turns used, with one step down for a called bluff or abuse', () => {
  const won = (turn, extra = {}) => ({ ...engine.newGame(file), turn, ending: { kind: 'confession', route: 'breakdown', grade: 'S' }, ...extra });
  assert.equal(engine.gradeOf(won(6), file), 'S');
  assert.equal(engine.gradeOf(won(8), file), 'A');
  assert.equal(engine.gradeOf(won(10), file), 'B');
  assert.equal(engine.gradeOf(won(12), file), 'C');
  assert.equal(engine.gradeOf(won(6, { bluffCalled: 1 }), file), 'A');
  assert.equal(engine.gradeOf(won(12, { abusive: 1 }), file), 'C');
});

test('share text carries the case, the outcome, and one emoji per turn', () => {
  let s = engine.newGame(file);
  s = play(s, ['rapport'], ['open_question', { topic: 'night' }], ['present_evidence', { evidence: 'cctv' }]);
  const text = engine.shareText(s, file, 'https://example.test/interrogation/');
  assert.match(text, /새벽 2시의 편의점/);
  assert.match(text, /🤝❓📄/);
  assert.match(text, /example\.test/);
});

// ── Server route ──────────────────────────────────────────────────────────

const answersFor = (overrides = {}) => {
  const moveProbabilities = Object.fromEntries(MOVES.map((m) => [m, m === 'accuse' ? 0.8 : 0.8 / 9 / 4]));
  return {
    model: 'jev-mock',
    usage: { input_tokens: 1, output_tokens: 0 },
    answers: {
      move: { type: 'choice', choice: 'accuse', confidence: 0.8, probabilities: moveProbabilities },
      topic: { type: 'choice', choice: 'none', confidence: 1, probabilities: { none: 1 } },
      evidence: { type: 'choice', choice: 'cctv', confidence: 0.9, probabilities: { cctv: 0.9, none: 0.1 } },
      hostility: { type: 'score', score: 2.4, confidence: 0.4, legend: {}, probabilities: { 0: 0, 1: 0.1, 2: 0.4, 3: 0.5 } },
      empathy: { type: 'noul', noul: 0.1 },
      false_promise: { type: 'noul', noul: 0.05 },
      expects_answer: { type: 'noul', noul: 0.7 },
      ...overrides,
    },
  };
};

test('turn route rejects bad bodies without calling Jev and builds state from the case', async () => {
  const { readTurn } = await vite.ssrLoadModule('/projects/interrogation/server.ts');
  const calls = [];
  const mock = { systemOne: async (...args) => { calls.push(args); return answersFor(); } };
  const bad = [null, {}, { caseId: 'convenience' }, { caseId: 'convenience', text: '' }, { caseId: 'convenience', text: '   ' }, { caseId: 'nope', text: '안녕' }, { caseId: 'convenience', text: '안녕', committed: 'night' }];
  for (const body of bad) await assert.rejects(readTurn(body, mock), (error) => error.status === 400, JSON.stringify(body));
  await assert.rejects(readTurn({ caseId: 'convenience', text: 'x'.repeat(201) }, mock), (error) => error.status === 413);
  assert.equal(calls.length, 0);

  const result = await readTurn({ caseId: 'convenience', text: 'CCTV 봤어요.', committed: ['night', 'safe'], adapted: ['safe_log'] }, mock);
  assert.equal(calls.length, 1);
  const [{ state, questions }] = calls[0];
  assert.deepEqual(Object.keys(questions), ['move', 'topic', 'evidence', 'hostility', 'empathy', 'false_promise', 'expects_answer']);
  assert.equal(state.detective_utterance, 'CCTV 봤어요.');
  assert.deepEqual(state.case.suspect_statements_so_far, [
    { topic: 'night', statement: file.topics[0].statement_en },
    { topic: 'safe', statement: file.evidence[1].adapted_statement_en },
  ]);
  assert.deepEqual(Object.keys(questions.topic.criteria), ['night', 'safe', 'money', 'none']);
  assert.deepEqual(Object.keys(questions.evidence.criteria), ['cctv', 'safe_log', 'loan', 'door', 'receipt', 'none']);
  assert.equal(questions.hostility.criteria.length, 4);
  assert.equal(result.reading.move, 'accuse');
  assert.equal(result.reading.evidence, 'cctv');
  assert.equal(result.reading.hostilityLevel, 3, 'half the probability on abuse is read as abuse');
  assert.equal(result.reading.expectsAnswer, 0.7);
  assert.equal(result.response.model, 'jev-mock');
  assert.equal(typeof result.latency_ms, 'number');
});

test('hostility level rounds the expected score unless abuse is likely', async () => {
  const { toReading } = await vite.ssrLoadModule('/projects/interrogation/server.ts');
  const mild = toReading(answersFor({ hostility: { type: 'score', score: 1.4, confidence: 0.6, legend: {}, probabilities: { 0: 0.1, 1: 0.5, 2: 0.3, 3: 0.1 } } }).answers);
  assert.equal(mild.hostilityLevel, 1);
  const unknownMove = toReading(answersFor({ move: { type: 'choice', choice: 'zzz', confidence: 1, probabilities: {} } }).answers);
  assert.equal(unknownMove.move, 'unclear');
});
