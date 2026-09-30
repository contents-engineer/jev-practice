import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EMOTIONS, EMOTION_IDS, INTENSITY_LEVELS, NEUTRAL, moodOf, type EmotionId, type Mood } from '../emotion-face/emotions';
import { Face } from '../emotion-face/face';
import { ReadingLoop } from '../emotion-face/reading-loop';
import { Glasses } from './glasses';
import {
  FRAMES, REGIONS, REGION_KO, TONES, TONE_ORDER, expressionWeights, readability, recommend, visibility,
  type Frame, type Tone,
} from './lens';
import { SAMPLES } from './samples';
import type { FeelingReading } from './server';

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
const html = document.documentElement;
const stageEl = $('#stage');
const slotEl = $('#face-slot');
const input = $<HTMLTextAreaElement>('#situation');
const statusEl = $('#status');
const statusText = $('#status-text');
const countEl = $('#count');
const wantedEl = $<HTMLInputElement>('#wanted');
const out = {
  note: $('#reading-note'),
  feeling: $('#sum-feeling'),
  intensity: $('#sum-intensity'),
  total: $('#read-total'),
  compare: $('#read-compare'),
  regions: $('#regions'),
  frames: $('#frames'),
  tones: $('#tones'),
  variant: $('#variant-name'),
  wanted: $<HTMLOutputElement>('#wanted-out'),
  picks: $('#picks'),
  rawResponse: $('#raw-response'),
  rawRequest: $('#raw-request'),
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

// ── Stage ────────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ canvas: $<HTMLCanvasElement>('#face'), antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.7;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
camera.position.set(1.2, 0.35, 6); // only the direction matters; frame() sets the distance
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = false;
controls.minAzimuthAngle = -Math.PI / 2.2; // far enough round to see the temples
controls.maxAzimuthAngle = Math.PI / 2.2;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 1.75;

const key = new THREE.DirectionalLight(0xfff1e0, 1.4);
key.position.set(1.6, 2.2, 3);
const rim = new THREE.DirectionalLight(0xffffff, 0.3);
rim.position.set(-3, 1.2, -1);
scene.add(key, rim);

const headSize = new THREE.Vector3(1.9, 2.3, 2.3); // replaced by the real bounds once loaded

/** Fit the head into #face-slot (or the whole stage on narrow screens, where the slot is hidden). */
function frame() {
  const stage = stageEl.getBoundingClientRect();
  const slot = slotEl.offsetParent ? slotEl.getBoundingClientRect() : stage;
  if (!stage.width || !slot.width) return;
  renderer.setSize(stage.width, stage.height, false);
  camera.aspect = stage.width / stage.height;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fill = Math.max(headSize.y / slot.height, headSize.x / slot.width);
  camera.position.sub(controls.target).setLength((fill * stage.height) / (0.84 * 2 * tan)).add(controls.target);
  const dx = slot.left + slot.width / 2 - (stage.left + stage.width / 2);
  const dy = slot.top + slot.height / 2 - (stage.top + stage.height / 2);
  camera.setViewOffset(stage.width, stage.height, -dx, -dy, stage.width, stage.height);
  camera.updateProjectionMatrix();
  stageEl.style.setProperty('--glow-x', `${slot.left - stage.left + slot.width / 2}px`);
  stageEl.style.setProperty('--glow-y', `${slot.top - stage.top + slot.height * 0.42}px`);
}
const resizes = new ResizeObserver(frame);
resizes.observe(stageEl);
resizes.observe(slotEl);

let face: Face | undefined;
let glasses: Glasses | undefined;
Face.load(renderer)
  .then((loaded) => {
    face = loaded;
    scene.add(loaded.root);
    loaded.setMood(state.mood);
    const bounds = new THREE.Box3().setFromObject(loaded.root, true);
    bounds.getSize(headSize);
    bounds.getCenter(controls.target);
    controls.target.y -= 0.04 * headSize.y;
    glasses = new Glasses(loaded.root);
    glasses.set(currentFrame(), state.tone);
    frame();
    stageEl.classList.add('is-ready');
  })
  .catch((err: Error) => {
    $('#loading').textContent = `얼굴 모델을 불러오지 못했습니다: ${err.message}`;
  });

// ── State ────────────────────────────────────────────────────────────────

type Source = 'example' | 'manual' | 'jev' | 'none';

const MANUAL_STRENGTH = 0.8;
const moodFor = (id: EmotionId): Mood => ({ mix: { ...NEUTRAL.mix, [id]: 1 }, strength: MANUAL_STRENGTH });

const state: { mood: Mood; source: Source; picked: EmotionId | null; frameId: string; tone: Tone | null } = {
  // Opens on a worked example rather than an empty face; it is labelled as an example.
  mood: moodFor('fear'),
  source: 'example',
  picked: 'fear',
  frameId: 'vanilla',
  tone: 'DARK',
};

const currentFrame = (): Frame => FRAMES.find((f) => f.id === state.frameId) ?? FRAMES[0];

function setMood(mood: Mood, source: Source, picked: EmotionId | null) {
  state.mood = mood;
  state.source = source;
  state.picked = picked;
  face?.setMood(mood);
  // The dominant emotion tints the back light and the page glow.
  const lead = EMOTION_IDS.reduce((a, b) => (mood.mix[b] > mood.mix[a] ? b : a), 'neutral' as EmotionId);
  const color = mood.strength > 0 && mood.mix[lead] > 0 ? EMOTIONS[lead].color : '#efe7da';
  rim.color.set(color);
  rim.intensity = 0.3 + 2.4 * mood.strength;
  const c = new THREE.Color(color);
  html.style.setProperty('--mood', `${Math.round(c.r * 255)} ${Math.round(c.g * 255)} ${Math.round(c.b * 255)}`);
  html.style.setProperty('--mood-strength', mood.strength.toFixed(3));
  renderManual();
  renderReadout();
}

function setLens(frameId: string, tone: Tone | null) {
  state.frameId = frameId;
  const frame = currentFrame();
  // Keep the lens type when the new frame has it; otherwise fall back to its first variant.
  state.tone = tone && frame.variants.some((v) => v.tone === tone) ? tone : tone ? frame.variants[0].tone : null;
  glasses?.set(frame, state.tone);
  renderPicker();
  renderReadout();
}

// ── Readout ──────────────────────────────────────────────────────────────

const regionRows = REGIONS.map((region) => {
  const li = document.createElement('li');
  li.innerHTML =
    `<span class="regions__name">${REGION_KO[region]}</span>` +
    `<span class="regions__bar"><i class="regions__shown"></i><i class="regions__hidden"></i></span>` +
    `<span class="regions__num"></span>`;
  out.regions.append(li);
  return {
    region,
    shown: li.querySelector<HTMLElement>('.regions__shown')!,
    hidden: li.querySelector<HTMLElement>('.regions__hidden')!,
    num: li.querySelector<HTMLElement>('.regions__num')!,
  };
});

function renderReadout() {
  const weights = expressionWeights(state.mood);
  const frame = currentFrame();
  const result = readability(weights, visibility(frame, state.tone));

  if (result.total === null) {
    out.total.textContent = '–';
    out.compare.textContent = state.source === 'none' ? '' : '드러난 표정이 없어 계산하지 않습니다';
  } else {
    out.total.textContent = pct(result.total);
    out.compare.textContent = state.tone ? `맨눈 100% → ${frame.model} ${TONES[state.tone].ko}` : '맨눈';
  }
  for (const row of regionRows) {
    const { share, shown } = result.regions[row.region];
    row.shown.style.width = pct(shown);
    row.hidden.style.width = pct(share - shown);
    row.num.textContent = result.total === null ? '–' : `${pct(shown)} / ${pct(share)}`;
  }

  const wanted = Number(wantedEl.value) / 100;
  out.wanted.value = `${wantedEl.value}%`;
  const picks = result.total === null ? [] : recommend(weights, wanted);
  out.picks.replaceChildren(
    ...picks.map((pick) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const current = pick.frame.id === state.frameId && pick.tone === state.tone;
      button.className = current ? 'is-current' : '';
      button.innerHTML =
        `<span class="picks__name">${pick.variant.name}<small>${pick.frame.model} · ${TONES[pick.tone].ko} · 렌즈 높이 ${pick.frame.lensHeight}mm</small></span>` +
        `<b>${pct(pick.total)}</b>`;
      button.addEventListener('click', () => setLens(pick.frame.id, pick.tone));
      li.append(button);
      return li;
    }),
  );
  if (!picks.length) {
    const li = document.createElement('li');
    li.className = 'picks__empty';
    li.textContent = '감정이 드러나면 원하는 만큼 보여 주는 렌즈를 골라 드립니다.';
    out.picks.append(li);
  }
}

function renderPicker() {
  const frame = currentFrame();
  out.frames.replaceChildren(
    ...FRAMES.map((f) => radio(f.model, `${f.lensHeight}mm`, f.id === state.frameId, () => setLens(f.id, state.tone))),
  );
  const tones = TONE_ORDER.filter((tone) => frame.variants.some((v) => v.tone === tone));
  out.tones.replaceChildren(
    radio('맨눈', '안경 없음', state.tone === null, () => setLens(state.frameId, null)),
    ...tones.map((tone) => radio(TONES[tone].ko, `투과 ${pct(TONES[tone].transmittance)}`, tone === state.tone, () => setLens(state.frameId, tone))),
  );
  const variant = state.tone ? frame.variants.find((v) => v.tone === state.tone) : undefined;
  out.variant.textContent = variant ? `예: ${variant.name} · ${variant.sku}` : '';
}

function radio(label: string, hint: string, checked: boolean, onPick: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('role', 'radio');
  button.setAttribute('aria-checked', String(checked));
  button.innerHTML = `<span>${label}</span><small>${hint}</small>`;
  button.addEventListener('click', onPick);
  return button;
}

function renderManual() {
  for (const button of manualButtons) button.setAttribute('aria-pressed', String(button.dataset.id === state.picked && state.source !== 'jev'));
}

/** The emotion summary is built from DOM nodes: part of it comes back from the server. */
function showSummary(emotion: { color: string; name: string; code: string } | null, intensity: string) {
  if (!emotion) out.feeling.textContent = '–';
  else {
    const dot = document.createElement('i');
    dot.style.setProperty('--c', emotion.color);
    const name = document.createElement('b');
    name.textContent = emotion.name;
    const code = document.createElement('code');
    code.textContent = emotion.code;
    out.feeling.replaceChildren(dot, name, code);
  }
  out.intensity.textContent = intensity;
}

// ── Reading the situation with Jev ───────────────────────────────────────

async function fetchReading(text: string): Promise<FeelingReading> {
  const res = await fetch('/api/emotion-lens/feeling', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

const readings = new ReadingLoop<FeelingReading>({
  read: fetchReading,
  show: (reading) => showReading(reading),
  pending: () => {
    setMood(NEUTRAL, 'none', null);
    out.note.textContent = '입력이 바뀌었습니다. 현재 문장을 다시 읽고 있습니다.';
    setStatus('reading', '현재 문장을 읽는 중…');
  },
  idle: () => {
    setMood(NEUTRAL, 'none', null);
    showSummary(null, '–');
    out.note.textContent = '상황을 쓰거나 감정을 직접 골라 보세요.';
    setStatus('idle', '상황을 기다리는 중');
  },
  error: (error) => {
    out.note.textContent = '현재 문장을 분석하지 못했습니다. 감정을 직접 골라 볼 수 있습니다.';
    setStatus('error', error instanceof Error ? error.message : '요청에 실패했습니다');
  },
});

function showReading({ request, response, latency_ms }: FeelingReading) {
  const { feeling, intensity } = response.answers;
  const unclear = feeling.choice === 'unclear';
  setMood(unclear ? NEUTRAL : moodOf(feeling.probabilities, intensity.score), 'jev', feeling.choice);
  const emotion = EMOTIONS[feeling.choice];
  showSummary(
    { color: emotion.color, name: emotion.ko, code: feeling.choice },
    unclear ? '판단 보류' : `${intensity.score.toFixed(2)} · ${INTENSITY_LEVELS[Math.round(intensity.score)]}`,
  );
  out.note.textContent = unclear
    ? '맥락이 부족하거나 여러 감정이 겹쳐 판단을 보류했습니다. 표정을 적용하지 않습니다.'
    : feeling.choice === 'neutral'
      ? '특별한 감정이 드러나지 않는 상황으로 읽었습니다.'
      : '문장만으로 추정한 감정입니다. 표정 혼합은 시각적 연출입니다.';
  out.rawResponse.textContent = JSON.stringify(response, null, 2);
  out.rawRequest.textContent = JSON.stringify(request, null, 2);
  setStatus('ok', `${response.model} · ${latency_ms}ms`);
}

function setStatus(stateName: 'idle' | 'reading' | 'ok' | 'error', text: string) {
  statusEl.dataset.state = stateName;
  statusText.textContent = text;
}

function onTextChange() {
  countEl.textContent = `${input.value.length} / ${input.maxLength}`;
  readings.update(input.value);
}

input.addEventListener('input', onTextChange);

// ── Chips ────────────────────────────────────────────────────────────────

$('#samples').append(
  ...SAMPLES.map(({ text }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = text;
    button.addEventListener('click', () => {
      input.value = text;
      onTextChange();
    });
    return button;
  }),
);

const MANUAL_IDS: EmotionId[] = ['happy', 'sad', 'angry', 'surprised', 'fear', 'disgust', 'contempt'];
const manualButtons = MANUAL_IDS.map((id) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'chip';
  button.dataset.id = id;
  button.style.setProperty('--c', EMOTIONS[id].color);
  button.innerHTML = `<i></i>${EMOTIONS[id].ko}`;
  button.addEventListener('click', () => {
    setMood(moodFor(id), 'manual', id);
    showSummary({ color: EMOTIONS[id].color, name: EMOTIONS[id].ko, code: '직접 고름' }, `연출 강도 ${MANUAL_STRENGTH}`);
    out.note.textContent = 'Jev를 거치지 않고 직접 고른 감정입니다.';
  });
  return button;
});
$('#manual').append(...manualButtons);

wantedEl.addEventListener('input', renderReadout);

// ── First frame: a worked example ────────────────────────────────────────

renderPicker();
setMood(state.mood, 'example', 'fear');
showSummary({ color: EMOTIONS.fear.color, name: EMOTIONS.fear.ko, code: '예시' }, `연출 강도 ${MANUAL_STRENGTH}`);
out.note.textContent = '예시: 두려움을 직접 골라 둔 상태입니다. 상황을 쓰면 Jev가 읽은 감정으로 바뀝니다.';
setStatus('idle', '상황을 기다리는 중');
void Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, 800))]).then(() =>
  html.classList.add('is-live'),
);

// ── Frame loop ───────────────────────────────────────────────────────────

let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  face?.update(dt, now / 1000);
  controls.update();
  renderer.render(scene, camera);
});
