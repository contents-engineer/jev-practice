import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ProbabilityBars } from '../emotion-face/bars';
import { Face } from '../emotion-face/face';
import type { Mood } from '../emotion-face/emotions';
import { CASES, MOVES, MOVE_META, TIER_META, caseById, type CaseFile, type Tier } from './cases';
import { flashForEvents, moodForTier } from './director';
import { EVENT_META, OUTCOME_KO, applyTurn, hintFor, isBreaking, newGame, shareText, tierOf, type GameState, type Grade, type TurnRecord } from './engine';
import type { TurnReading } from './server';

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
const html = document.documentElement;
const startEl = $('#start');
const roomEl = $('#room');
const stageEl = $('#stage');
const slotEl = $('#face-slot');
const talkEl = $('#talk');
const form = $<HTMLFormElement>('#say');
const input = $<HTMLTextAreaElement>('#line');
const sendBtn = $<HTMLButtonElement>('#send');
const countEl = $('#count');
const statusEl = $('#status');
const statusText = $('#status-text');
const ending = $<HTMLDialogElement>('#ending');
const out = {
  plateName: $('#plate-name'),
  plateTier: $('#plate-tier'),
  pressure: $('#m-pressure'),
  trust: $('#m-trust'),
  guard: $('#m-guard'),
  cracks: $('#m-cracks'),
  turns: $('#m-turns'),
  fileDifficulty: $('#file-difficulty'),
  fileTitle: $('#file-title'),
  fileSuspect: $('#file-suspect'),
  fileBrief: $('#file-brief'),
  fileTips: $('#file-tips'),
  hint: $('#hint'),
  evidence: $('#evidence'),
  notes: $('#notes'),
  note: $('#reading-note'),
  rMove: $('#r-move'),
  rTopic: $('#r-topic'),
  rEvidence: $('#r-evidence'),
  rHostility: $('#r-hostility'),
  rEmpathy: $('#r-empathy'),
  rPromise: $('#r-promise'),
  rExpects: $('#r-expects'),
  confidence: $('#meta-confidence'),
  latency: $('#meta-latency'),
  tokens: $('#meta-tokens'),
  requests: $('#meta-requests'),
  failures: $('#meta-failures'),
  rawResponse: $('#raw-response'),
  rawRequest: $('#raw-request'),
  endingKicker: $('#ending-kicker'),
  endingTitle: $('#ending-title'),
  endingGrade: $('#ending-grade'),
  endingStats: $('#ending-stats'),
  endingBody: $('#ending-body'),
  endingNote: $('#ending-note'),
  endingShare: $('#ending-share'),
};

const HOSTILITY_KO = ['정중', '단호', '폭언', '위법'];
const moveBars = new ProbabilityBars($('#move-bars'), MOVES.map((id) => ({ key: id, label: MOVE_META[id].ko, hint: id })));
const hostilityBars = new ProbabilityBars($('#hostility-bars'), HOSTILITY_KO.map((name, level) => ({ key: String(level), label: `${level} · ${name}` })));

// ── Stage: the face under a lamp ─────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ canvas: $<HTMLCanvasElement>('#face'), antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
camera.position.set(0.35, 0.3, 6);
const target = new THREE.Vector3();
// A single lamp over the table, a cold fill from the front, and a rim that reddens with pressure.
const lamp = new THREE.DirectionalLight(0xf2b134, 2.2);
lamp.position.set(0.3, 3, 1.6);
const fill = new THREE.DirectionalLight(0xbfd4e8, 0.35);
fill.position.set(-2, 0.4, 3);
const rim = new THREE.DirectionalLight(0xe2554b, 0);
rim.position.set(-3, 1, -2);
scene.add(lamp, fill, rim);
const headSize = new THREE.Vector3(1.9, 2.3, 2.3);

/** Fit the head into #face-slot, or the whole stage when the slot is hidden. */
function frame() {
  const stage = stageEl.getBoundingClientRect();
  const slot = slotEl.offsetParent ? slotEl.getBoundingClientRect() : stage;
  if (!stage.width || !slot.width) return;
  renderer.setSize(stage.width, stage.height, false);
  camera.aspect = stage.width / stage.height;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fillRatio = Math.max(headSize.y / slot.height, headSize.x / slot.width);
  camera.position.sub(target).setLength((fillRatio * stage.height) / (0.9 * 2 * tan)).add(target);
  camera.lookAt(target);
  const dx = slot.left + slot.width / 2 - (stage.left + stage.width / 2);
  const dy = slot.top + slot.height / 2 - (stage.top + stage.height / 2);
  camera.setViewOffset(stage.width, stage.height, -dx, -dy, stage.width, stage.height);
  camera.updateProjectionMatrix();
  stageEl.style.setProperty('--glow-x', `${slot.left - stage.left + slot.width / 2}px`);
  stageEl.style.setProperty('--glow-y', `${slot.top - stage.top + slot.height * 0.45}px`);
}
const resizes = new ResizeObserver(frame);
resizes.observe(stageEl);
resizes.observe(slotEl);

let face: Face | undefined;
let baseMood: Mood = moodForTier('calm');
let flashTimer = 0;
Face.load(renderer)
  .then((loaded) => {
    face = loaded;
    scene.add(loaded.root);
    loaded.setMood(baseMood);
    const bounds = new THREE.Box3().setFromObject(loaded.root, true);
    bounds.getSize(headSize);
    bounds.getCenter(target);
    target.y -= 0.02 * headSize.y;
    frame();
    stageEl.classList.add('is-ready');
  })
  .catch((err: Error) => {
    $('#loading').textContent = `얼굴 모델을 불러오지 못했습니다: ${err.message}`;
  });

function setFace(mood: Mood, flash?: { mood: Mood; ms: number } | null) {
  baseMood = mood;
  clearTimeout(flashTimer);
  face?.setMood(flash ? flash.mood : mood);
  if (flash) flashTimer = window.setTimeout(() => face?.setMood(baseMood), flash.ms);
}

// ── Pressure: a pulse line, and the colour of everything that follows it ─

const PULSE = [new THREE.Color('#36a99b'), new THREE.Color('#f2b134'), new THREE.Color('#e2554b')];
const pulseColor = new THREE.Color();
const ecg = $<HTMLCanvasElement>('#ecg');
const ecgCtx = ecg.getContext('2d')!;
const shown = { pressure: 0, target: 0 };
let phase = 0;
let lastTick = performance.now();

/** One heartbeat: P bump, QRS spike, T bump, as a function of the beat phase 0–1. */
function beat(t: number) {
  const bump = (at: number, width: number, height: number) => height * Math.exp(-(((t - at) / width) ** 2));
  return bump(0.18, 0.04, 0.12) - bump(0.3, 0.012, 0.15) + bump(0.34, 0.016, 1) - bump(0.385, 0.014, 0.35) + bump(0.58, 0.06, 0.22);
}

const trace: number[] = [];
function drawEcg(now: number) {
  const dt = Math.min(0.05, (now - lastTick) / 1000);
  lastTick = now;
  shown.pressure += (shown.target - shown.pressure) * (1 - Math.exp(-3 * dt));
  const p = shown.pressure / 100;
  const bpm = 62 + p * 118;
  phase = (phase + (dt * bpm) / 60) % 1;
  const { width, height } = ecg;
  trace.push(beat(phase) * (0.35 + 0.65 * p));
  const capacity = Math.floor(width / 2.5);
  while (trace.length > capacity) trace.shift();

  pulseColor.copy(p < 0.5 ? PULSE[0] : PULSE[1]).lerp(p < 0.5 ? PULSE[1] : PULSE[2], p < 0.5 ? p * 2 : (p - 0.5) * 2);
  const css = `${Math.round(pulseColor.r * 255)} ${Math.round(pulseColor.g * 255)} ${Math.round(pulseColor.b * 255)}`;
  html.style.setProperty('--pulse', css);
  html.style.setProperty('--pressure', p.toFixed(3));
  rim.color.copy(pulseColor);
  rim.intensity = 0.15 + p * 2.6;

  ecgCtx.clearRect(0, 0, width, height);
  ecgCtx.lineWidth = 2;
  ecgCtx.lineJoin = 'round';
  ecgCtx.strokeStyle = `rgb(${css})`;
  ecgCtx.shadowColor = `rgb(${css} / 0.8)`;
  ecgCtx.shadowBlur = 6;
  ecgCtx.beginPath();
  const base = height * 0.68;
  for (let i = 0; i < trace.length; i++) {
    const x = width - (trace.length - i) * 2.5;
    const y = base - trace[i] * height * 0.6;
    if (i === 0) ecgCtx.moveTo(x, y);
    else ecgCtx.lineTo(x, y);
  }
  ecgCtx.stroke();
}

// ── Game state and rendering ─────────────────────────────────────────────

const BEST_KEY = 'jev-lab:interrogation:best';
const GRADE_ORDER: Grade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
const GRADE_NOTE: Record<Grade, string> = {
  S: '완벽한 취조. 진술을 받고, 증거로 찌르고, 마무리했다.',
  A: '깔끔했다. 한두 마디만 아꼈어도 S.',
  B: '자백은 받았지만 길었다.',
  C: '턱걸이. 허세나 폭언이 있었거나 너무 오래 걸렸다.',
  D: '시간이 다 됐다. 진술 없이 증거를 냈거나, 증거 없이 밀어붙였다.',
  E: '용의자가 입을 닫았다. 방어를 100까지 올린 건 형사다.',
  F: '자백은 받았지만 증거로 쓸 수 없다. 강압과 거짓 약속의 대가.',
};

function loadBest(): Record<string, Grade> {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveBest(caseId: string, grade: Grade) {
  const best = loadBest();
  if (!best[caseId] || GRADE_ORDER.indexOf(grade) < GRADE_ORDER.indexOf(best[caseId])) {
    best[caseId] = grade;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(best));
    } catch {
      /* private mode: nothing to keep */
    }
  }
}

let file: CaseFile = CASES[0];
let state: GameState = newGame(file);
let busy = false;
const tally = { requests: 0, failures: 0 };

function renderCases() {
  const best = loadBest();
  const casesEl = $('#cases');
  casesEl.replaceChildren(
    ...CASES.map((c, i) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'case';
      button.innerHTML =
        `<span class="case__no">사건 ${String(i + 1).padStart(2, '0')} · ${c.difficulty}</span>` +
        `<span class="case__title">${c.title}</span>` +
        `<span class="case__tag">${c.tagline}</span>` +
        `<span class="case__foot"><span>용의자 <b>${c.suspect.name_ko}</b> · ${c.maxTurns}턴 · 모순 ${c.cracksNeeded}개</span>` +
        `<span class="case__best">${best[c.id] ? `최고 ${best[c.id]}` : '미해결'}</span></span>`;
      button.addEventListener('click', () => startCase(c));
      li.append(button);
      return li;
    }),
  );
}

function setTint(hex: string) {
  const c = new THREE.Color(hex);
  html.style.setProperty('--lamp', `${Math.round(c.r * 255)} ${Math.round(c.g * 255)} ${Math.round(c.b * 255)}`);
  lamp.color.copy(c);
}

function startCase(next: CaseFile) {
  file = next;
  state = newGame(file);
  busy = false;
  setTint(file.suspect.tint);
  startEl.hidden = true;
  roomEl.hidden = false;
  roomEl.dataset.panel = 'talk';
  html.classList.add('in-room');
  for (const tab of roomEl.querySelectorAll<HTMLButtonElement>('.tabs button')) tab.setAttribute('aria-current', String(tab.dataset.tab === 'talk'));
  out.fileDifficulty.textContent = `사건 ${String(CASES.indexOf(file) + 1).padStart(2, '0')} · ${file.difficulty}`;
  out.fileTitle.textContent = file.title;
  out.fileSuspect.textContent = `용의자 ${file.suspect.name_ko} (${file.suspect.age}) · ${file.suspect.job_ko}`;
  out.fileBrief.replaceChildren(...file.brief_ko.map((text) => Object.assign(document.createElement('p'), { textContent: text })));
  out.fileTips.replaceChildren(...(file.tips ?? []).map((text) => Object.assign(document.createElement('li'), { textContent: text })));
  out.plateName.textContent = file.suspect.name_ko;
  out.evidence.replaceChildren(
    ...file.evidence.map((e) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'card';
      button.dataset.id = e.id;
      button.innerHTML = `<span class="card__name">${e.name_ko}<span class="card__state"></span></span><span class="card__detail">${e.detail_ko}</span>`;
      button.addEventListener('click', () => insertText(e.name_ko));
      li.append(button);
      return li;
    }),
  );
  talkEl.replaceChildren();
  showIdleReading();
  renderState(null);
  setFace(moodForTier('calm'));
  frame();
  void say(file.suspect.opening, 'calm');
  input.value = '';
  onInput();
  input.disabled = false;
  sendBtn.disabled = false;
  if (matchMedia('(min-width: 1024px)').matches) input.focus();
  requestAnimationFrame(() => roomEl.scrollTo(0, 0));
}

function insertText(text: string) {
  const { selectionStart: s, selectionEnd: e, value } = input;
  const before = value.slice(0, s);
  const glue = before && !/\s$/.test(before) ? ' ' : '';
  input.value = `${before}${glue}${text} ${value.slice(e)}`;
  input.selectionStart = input.selectionEnd = before.length + glue.length + text.length + 1;
  onInput();
  roomEl.dataset.panel = 'talk';
  syncTabs();
  input.focus();
}

/** Meters, pips, turn counter, evidence card states and the notebook, from the state. */
function renderState(record: TurnRecord | null) {
  const m = state.meters;
  shown.target = m.pressure;
  out.pressure.textContent = String(m.pressure);
  out.trust.textContent = String(m.trust);
  out.guard.textContent = String(m.guard);
  html.style.setProperty('--trust', (m.trust / 100).toFixed(3));
  html.style.setProperty('--guard', (m.guard / 100).toFixed(3));
  out.cracks.replaceChildren(
    ...Array.from({ length: file.cracksNeeded }, (_, i) => {
      const pip = document.createElement('i');
      pip.classList.toggle('is-on', i < state.cracked.length);
      return pip;
    }),
  );
  out.turns.textContent = `${Math.max(0, file.maxTurns - state.turn)} / ${file.maxTurns}`;
  const tier: Tier = record?.tier ?? tierOf(m, isBreaking(state, file));
  out.plateTier.textContent = `${TIER_META[tier].ko} · ${tier}`;
  out.hint.textContent = hintFor(state, file);

  for (const card of out.evidence.querySelectorAll<HTMLButtonElement>('.card')) {
    const id = card.dataset.id!;
    const cracked = state.cracked.includes(id);
    const adapted = state.adapted.includes(id);
    const presented = state.presented.includes(id);
    card.classList.toggle('is-cracked', cracked);
    card.classList.toggle('is-adapted', adapted);
    card.classList.toggle('is-presented', presented);
    card.querySelector('.card__state')!.textContent = cracked ? '모순 잡힘' : adapted ? '이야기 바뀜' : presented ? '제시함' : '';
  }

  if (state.committed.length === 0) {
    out.notes.replaceChildren(Object.assign(document.createElement('li'), { className: 'notes__empty', textContent: '아직 진술이 없습니다. 먼저 물어보세요.' }));
  } else {
    out.notes.replaceChildren(
      ...state.committed.map((id) => {
        const topic = file.topics.find((t) => t.id === id)!;
        const bent = file.evidence.find((e) => e.breaks === id && state.adapted.includes(e.id));
        const cracked = file.evidence.some((e) => e.breaks === id && state.cracked.includes(e.id));
        const li = document.createElement('li');
        li.className = `note${cracked ? ' is-cracked' : bent ? ' is-adapted' : ''}`;
        li.innerHTML = `<span class="note__topic">${topic.name_ko}<span class="note__state">${cracked ? '모순' : bent ? '증거에 맞춰 바꿈' : '진술'}</span></span><p class="note__text"></p>`;
        li.querySelector('.note__text')!.textContent = bent && !cracked ? bent.adapt : topic.statement;
        return li;
      }),
    );
  }
}

function showIdleReading() {
  moveBars.set(null, null);
  hostilityBars.set(null, null);
  for (const el of [out.rMove, out.rTopic, out.rEvidence, out.rHostility, out.rEmpathy, out.rPromise, out.rExpects, out.confidence, out.latency, out.tokens]) el.textContent = '–';
  out.note.textContent = '첫 마디를 하면 Jev가 그 말을 어떻게 읽었는지 여기에 나타납니다. 대사는 사건 파일에서 고릅니다.';
  out.rawResponse.textContent = '아직 응답이 없습니다.';
  out.rawRequest.textContent = '아직 요청이 없습니다.';
  setStatus('idle', '대기 중');
}

function showReading({ reading, request, response, latency_ms }: TurnReading) {
  const { move, topic, evidence, hostility } = response.answers;
  moveBars.set(reading.moveProbabilities, reading.move);
  const peak = Object.entries(hostility.probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  hostilityBars.set(hostility.probabilities as Record<string, number>, peak);
  out.rMove.replaceChildren(Object.assign(document.createElement('b'), { textContent: `${MOVE_META[reading.move].emoji} ${MOVE_META[reading.move].ko}` }), ` ${reading.move}`);
  const topicName = file.topics.find((t) => t.id === topic.choice)?.name_ko ?? '없음';
  const evidenceName = file.evidence.find((e) => e.id === evidence.choice)?.name_ko ?? '없음';
  out.rTopic.textContent = `${topicName} (${topic.choice}, ${topic.probabilities[topic.choice]?.toFixed(2)})`;
  out.rEvidence.textContent = `${evidenceName} (${evidence.choice}, ${evidence.probabilities[evidence.choice]?.toFixed(2)})`;
  out.rHostility.textContent = `${reading.hostility.toFixed(2)} → ${reading.hostilityLevel} ${HOSTILITY_KO[reading.hostilityLevel]}`;
  out.rEmpathy.textContent = reading.empathy.toFixed(3);
  out.rPromise.textContent = reading.falsePromise.toFixed(3);
  out.rExpects.textContent = reading.expectsAnswer.toFixed(3);
  out.confidence.textContent = move.confidence.toFixed(3);
  out.latency.textContent = `${latency_ms}ms`;
  out.tokens.textContent = String(response.usage.input_tokens);
  out.rawResponse.textContent = JSON.stringify(response, null, 2);
  out.rawRequest.textContent = JSON.stringify(request, null, 2);
  out.note.textContent = '형사의 마지막 말을 Jev가 읽은 결과입니다. 확률은 말의 뜻에 대한 판단이지 용의자의 상태가 아닙니다.';
  setStatus('ok', `${response.model} · ${latency_ms}ms · 토큰 ${response.usage.input_tokens}개`);
}

function setStatus(kind: 'idle' | 'reading' | 'ok' | 'error', text: string) {
  statusEl.dataset.state = kind;
  statusText.textContent = text;
}

// ── Transcript ───────────────────────────────────────────────────────────

function chip(text: string, className = 'chip') {
  return Object.assign(document.createElement('span'), { className, textContent: text });
}

function addDetectiveTurn(text: string) {
  const li = document.createElement('li');
  li.className = 'turn turn--detective';
  const who = Object.assign(document.createElement('span'), { className: 'who', textContent: `형사 · ${state.turn + 1}턴` });
  const bubble = Object.assign(document.createElement('p'), { className: 'bubble', textContent: text });
  const chips = Object.assign(document.createElement('p'), { className: 'chips' });
  chips.append(chip('Jev가 읽는 중…', 'chip chip--pending'));
  li.append(who, bubble, chips);
  talkEl.append(li);
  scrollTalk();
  return chips;
}

function describeTurn(chips: HTMLElement, record: TurnRecord) {
  const { reading, events } = record;
  chips.replaceChildren();
  chips.append(chip(`${MOVE_META[reading.move].emoji} ${MOVE_META[reading.move].ko}`));
  const topic = file.topics.find((t) => t.id === reading.topic);
  if (topic) chips.append(chip(`화제 · ${topic.name_ko}`));
  // The engine reads the evidence id only as the argument of a presentation, so the chip does too.
  const item = reading.move === 'present_evidence' ? file.evidence.find((e) => e.id === reading.evidence) : undefined;
  if (item) chips.append(chip(`증거 · ${item.name_ko}`));
  chips.append(chip(`어조 · ${HOSTILITY_KO[reading.hostilityLevel]}`));
  if (reading.empathy >= 0.6) chips.append(chip('공감'));
  for (const event of events) {
    const meta = EVENT_META[event];
    if (meta.badge) chips.append(chip(meta.ko, `badge badge--${event}`));
  }
}

const ARROW = (n: number) => (n > 0 ? `+${n}` : String(n));

async function say(text: string, tier: Tier, record?: TurnRecord) {
  const li = document.createElement('li');
  li.className = 'turn turn--suspect';
  const who = Object.assign(document.createElement('span'), { className: 'who', textContent: `${file.suspect.name_ko} · ${TIER_META[tier].ko}` });
  const bubble = Object.assign(document.createElement('p'), { className: 'bubble is-typing' });
  bubble.dataset.tier = tier;
  li.append(who, bubble);
  if (record) {
    const d = { pressure: record.after.pressure - record.before.pressure, trust: record.after.trust - record.before.trust, guard: record.after.guard - record.before.guard };
    const parts = [d.pressure && `압박 <b>${ARROW(d.pressure)}</b>`, d.trust && `신뢰 <b>${ARROW(d.trust)}</b>`, d.guard && `방어 <b>${ARROW(d.guard)}</b>`].filter(Boolean);
    const delta = Object.assign(document.createElement('p'), { className: 'delta' });
    delta.innerHTML = parts.length ? parts.join(' · ') : '변화 없음';
    li.append(delta);
  }
  talkEl.append(li);
  scrollTalk();
  await typeOut(bubble, text);
}

let skipTyping = false;
talkEl.addEventListener('click', () => {
  skipTyping = true;
});

function typeOut(el: HTMLElement, text: string): Promise<void> {
  return new Promise((done) => {
    const chars = [...text];
    let i = 0;
    skipTyping = false;
    const step = () => {
      if (skipTyping) i = chars.length;
      else i++;
      el.textContent = chars.slice(0, i).join('');
      scrollTalk();
      if (i >= chars.length) {
        el.classList.remove('is-typing');
        done();
        return;
      }
      const c = chars[i - 1];
      setTimeout(step, c === '…' ? 260 : /[.?!,\n]/.test(c) ? 120 : 24);
    };
    step();
  });
}

function scrollTalk() {
  talkEl.scrollTop = talkEl.scrollHeight;
}

// ── One turn ─────────────────────────────────────────────────────────────

async function fetchTurn(text: string): Promise<TurnReading> {
  out.requests.textContent = String(++tally.requests);
  try {
    const res = await fetch('/api/interrogation/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId: file.id, text, committed: state.committed, adapted: state.adapted }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `요청에 실패했습니다 (${res.status})`);
    return body;
  } catch (err) {
    out.failures.textContent = String(++tally.failures);
    throw err;
  }
}

async function submit() {
  const text = input.value.trim();
  if (!text || busy || state.ending) return;
  busy = true;
  input.disabled = true;
  sendBtn.disabled = true;
  setStatus('reading', 'Jev가 읽는 중…');
  const chips = addDetectiveTurn(text);
  let result: TurnReading;
  try {
    result = await fetchTurn(text);
  } catch (err) {
    chips.replaceChildren(chip(err instanceof Error ? err.message : '요청에 실패했습니다', 'chip chip--error'));
    setStatus('error', '읽지 못했습니다. 다시 말해 보세요. 이 턴은 세지 않습니다.');
    busy = false;
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
    return;
  }
  input.value = '';
  onInput();
  state = applyTurn(state, file, text, result.reading);
  const record = state.log[state.log.length - 1];
  describeTurn(chips, record);
  showReading(result);
  renderState(record);
  setFace(moodForTier(record.tier), flashForEvents(record.events));
  await say(record.reply, record.tier, record);
  busy = false;
  if (state.ending) {
    saveBest(file.id, state.ending.grade);
    setTimeout(showEnding, 500);
    return;
  }
  input.disabled = false;
  sendBtn.disabled = false;
  if (matchMedia('(min-width: 1024px)').matches) input.focus();
}

const ENDING_TITLE: Record<NonNullable<GameState['ending']>['kind'], [string, string]> = {
  confession: ['CONFESSION', '자백을 받아냈다'],
  tainted: ['INADMISSIBLE', '자백은 받았지만, 쓸 수 없다'],
  lawyer: ['LAWYERED UP', '용의자가 입을 닫았다'],
  timeout: ['RELEASED', '시간이 다 됐다'],
};

function showEnding() {
  const end = state.ending!;
  const [kicker, title] = ENDING_TITLE[end.kind];
  out.endingKicker.textContent = `${kicker} · ${file.title}`;
  out.endingTitle.textContent = title;
  out.endingGrade.textContent = end.grade;
  const route = end.route === 'breakdown' ? '무너뜨리기' : end.route === 'opening' ? '마음 열기' : '–';
  out.endingStats.textContent = `${OUTCOME_KO[end.kind]} · ${state.turn}턴\n모순 ${state.cracked.length}개 (필요 ${file.cracksNeeded}) · 진술 ${state.committed.length}개 · 경로 ${route}\n${state.tainted ? `강압 표시: ${state.tainted === 'threat' ? '위법한 위협' : '거짓 약속'}` : '강압 없음'}`;
  const last = state.log[state.log.length - 1];
  out.endingBody.replaceChildren(...last.reply.split('\n\n').map((text) => Object.assign(document.createElement('p'), { textContent: text })));
  out.endingNote.textContent =
    end.kind === 'tainted'
      ? `${GRADE_NOTE.F} 위협이나 법적 이익의 약속 아래 나온 자백은 임의성이 없어 증거로 쓸 수 없습니다. 이것이 「!!!」로 자백을 받는 게임과 이 게임의 차이입니다.`
      : GRADE_NOTE[end.grade];
  out.endingShare.textContent = shareText(state, file, `${location.origin}${location.pathname}`);
  ending.showModal();
}

// ── Wiring ───────────────────────────────────────────────────────────────

function onInput() {
  countEl.textContent = `${input.value.length} / ${input.maxLength}`;
}

input.addEventListener('input', onInput);
input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void submit();
  }
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void submit();
});

function syncTabs() {
  for (const tab of roomEl.querySelectorAll<HTMLButtonElement>('.tabs button')) tab.setAttribute('aria-current', String(tab.dataset.tab === roomEl.dataset.panel));
  frame();
}
for (const tab of roomEl.querySelectorAll<HTMLButtonElement>('.tabs button')) {
  tab.addEventListener('click', () => {
    roomEl.dataset.panel = tab.dataset.tab;
    syncTabs();
  });
}

function toCases() {
  ending.close();
  roomEl.hidden = true;
  startEl.hidden = false;
  html.classList.remove('in-room');
  renderCases();
  window.scrollTo(0, 0);
}
$('#back').addEventListener('click', toCases);
$('#to-cases').addEventListener('click', toCases);
$('#retry').addEventListener('click', () => {
  ending.close();
  startCase(file);
});
$('#share').addEventListener('click', async () => {
  const button = $<HTMLButtonElement>('#share');
  try {
    await navigator.clipboard.writeText(out.endingShare.textContent ?? '');
    button.textContent = '복사했습니다';
  } catch {
    button.textContent = '복사 실패 · 직접 선택해 주세요';
  }
  setTimeout(() => (button.textContent = '결과 복사'), 1600);
});
ending.addEventListener('cancel', (event) => event.preventDefault()); // Esc keeps the result up

// The hub-style deep link: /interrogation/?case=<id> opens that case directly.
renderCases();
onInput();
const wanted = caseById(new URLSearchParams(location.search).get('case') ?? '');
if (wanted) startCase(wanted);
void Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, 800))]).then(() => html.classList.add('is-live'));

// ── Frame loop ───────────────────────────────────────────────────────────

let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  drawEcg(now);
  if (!roomEl.hidden) {
    face?.update(dt, now / 1000);
    renderer.render(scene, camera);
  }
});
