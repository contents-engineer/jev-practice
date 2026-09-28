import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { EmotionReading } from './server';
import { EMOTIONS, EMOTION_IDS, INTENSITY_LEVELS, NEUTRAL, moodOf, plutchikWord, type Mood } from './emotions';
import { Face } from './face';
import { IntensityGauge, ShapeMeter } from './meters';
import { Wheel } from './wheel';

const SAMPLES = [
  'We got the apartment!! Moving in next month 🎉',
  "Take your time. I've got everything covered here, I promise.",
  "Don't open the door. Someone has been following me all night.",
  "Wait, you're in town?? Since when?!",
  "I'm so sorry. The vet said there's nothing more they can do.",
  'There was a hair baked into the bread you gave me. Gross.',
  'You read my messages behind my back? Unbelievable.',
  "Tomorrow I'll finally tell you what I've been planning…",
  '걱정하지 마, 내가 끝까지 옆에 있을게',
  '너 또 내 물건 허락 없이 가져갔지? 진짜 화난다',
];

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
const html = document.documentElement;
const stageEl = $('#stage');
const slotEl = $('#face-slot');
const input = $<HTMLTextAreaElement>('#message');
const statusEl = $('#status');
const statusText = $('#status-text');
const countEl = $('#count');
const verdictEl = $('#verdict');
const verdictSub = $('#verdict-sub');
const scoreEl = $('#score');
const rawEl = $('#raw');

const wheel = new Wheel($<SVGSVGElement>('#wheel'));
const gauge = new IntensityGauge($('#gauge'));
const shapes = new ShapeMeter($('#shapes'), $('#top-shapes'));

// ── Stage ────────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ canvas: $<HTMLCanvasElement>('#face'), antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;

const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
camera.position.set(1.5, 0.45, 6); // only the direction matters; frame() sets the distance
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = false;
controls.minAzimuthAngle = -Math.PI / 3;
controls.maxAzimuthAngle = Math.PI / 3;
controls.minPolarAngle = Math.PI / 3;
controls.maxPolarAngle = Math.PI / 1.75;

const key = new THREE.DirectionalLight(0xfff1e0, 1.4);
key.position.set(1.6, 2.2, 3);
// Two side lights from slightly behind wrap the mood colour around cheeks and ears.
const rim = new THREE.DirectionalLight(0xffffff, 0);
rim.position.set(-3, 1.2, -1);
const kicker = new THREE.DirectionalLight(0xffffff, 0);
kicker.position.set(3, 0.2, -1.2);
scene.add(key, rim, kicker);

const headSize = new THREE.Vector3(1.9, 2.3, 2.3); // replaced by the real bounds once loaded

/** Fit the head into #face-slot (or the whole stage on narrow screens, where the slot is hidden). */
function frame() {
  const stage = stageEl.getBoundingClientRect();
  const slot = slotEl.offsetParent ? slotEl.getBoundingClientRect() : stage;
  if (!stage.width || !slot.width) return;
  renderer.setSize(stage.width, stage.height, false);
  camera.aspect = stage.width / stage.height;

  // 0.84 rather than more: the face sits in front of the box centre, so perspective makes it look bigger.
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fill = Math.max(headSize.y / slot.height, headSize.x / slot.width);
  camera.position.sub(controls.target).setLength((fill * stage.height) / (0.84 * 2 * tan)).add(controls.target);
  // Slide the projection so the head lands in the middle of the slot.
  const dx = slot.left + slot.width / 2 - (stage.left + stage.width / 2);
  const dy = slot.top + slot.height / 2 - (stage.top + stage.height / 2);
  camera.setViewOffset(stage.width, stage.height, -dx, -dy, stage.width, stage.height);
  camera.updateProjectionMatrix();

  stageEl.style.setProperty('--glow-x', `${slot.left - stage.left + slot.width / 2}px`);
  stageEl.style.setProperty('--glow-y', `${slot.top - stage.top + slot.height * 0.42}px`);
}
// The slot can change without the stage (e.g. when web fonts land and the grid reflows).
const resizes = new ResizeObserver(frame);
resizes.observe(stageEl);
resizes.observe(slotEl);

let face: Face | undefined;
Face.load(renderer)
  .then((loaded) => {
    face = loaded;
    scene.add(loaded.root);
    loaded.setMood(mood.target);
    const bounds = new THREE.Box3().setFromObject(loaded.root, true);
    bounds.getSize(headSize);
    bounds.getCenter(controls.target);
    controls.target.y -= 0.04 * headSize.y; // seen from slightly above, the head otherwise sits low
    frame();
    stageEl.classList.add('is-ready');
  })
  .catch((err: Error) => {
    $('#loading').textContent = `Couldn't load the face: ${err.message}`;
  });

// ── Mood: face, lights and page colour follow the latest reading ────────

const INK = new THREE.Color('#efe7da');
const COLORS = Object.fromEntries(EMOTION_IDS.map((id) => [id, new THREE.Color(EMOTIONS[id].color)]));
const mood = { target: NEUTRAL, color: INK.clone(), goal: INK.clone(), strength: 0, css: '' };
const srgb = { r: 0, g: 0, b: 0 };

function setMood(next: Mood) {
  mood.target = next;
  face?.setMood(next);
  // Blend the emotion colours by the same mix the face uses; neutral falls back to ink.
  mood.goal.setRGB(0, 0, 0);
  let covered = 0;
  for (const id of EMOTION_IDS) {
    mood.goal.r += COLORS[id].r * next.mix[id];
    mood.goal.g += COLORS[id].g * next.mix[id];
    mood.goal.b += COLORS[id].b * next.mix[id];
    covered += next.mix[id];
  }
  mood.goal.lerp(INK, 1 - covered);
}

function updateMood(dt: number) {
  const k = 1 - Math.exp(-4 * dt);
  mood.color.lerp(mood.goal, k);
  mood.strength += (mood.target.strength - mood.strength) * k;
  rim.color.copy(mood.color);
  rim.intensity = 0.2 + 3.2 * mood.strength;
  kicker.color.copy(mood.color);
  kicker.intensity = 0.1 + 2 * mood.strength;

  mood.color.getRGB(srgb, THREE.SRGBColorSpace);
  const css = `${Math.round(srgb.r * 255)} ${Math.round(srgb.g * 255)} ${Math.round(srgb.b * 255)}|${mood.strength.toFixed(3)}`;
  if (css === mood.css) return;
  mood.css = css;
  const [rgb, strength] = css.split('|');
  html.style.setProperty('--mood', rgb);
  html.style.setProperty('--mood-strength', strength);
}

// ── Reading the message with Jev ─────────────────────────────────────────

async function fetchReading(text: string): Promise<EmotionReading> {
  const res = await fetch('/api/emotion-face/emotion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

/** Bumped whenever the text is replaced wholesale, so answers for the old text are dropped. */
let generation = 0;
let busy = false;
let dirty = false;
let debounce = 0;

/**
 * One request in flight at a time. Keystrokes that land meanwhile mark the text dirty,
 * and the newest text goes out as soon as the answer comes back, so the face keeps up
 * with typing without piling up requests.
 */
async function pump() {
  if (busy) {
    dirty = true;
    return;
  }
  busy = true;
  setStatus('reading');
  do {
    dirty = false;
    const text = input.value.trim();
    if (!text) break;
    const asked = generation;
    try {
      const reading = await fetchReading(text);
      if (asked === generation) showReading(reading);
    } catch (err) {
      if (asked === generation) setStatus('error', (err as Error).message);
    }
  } while (dirty);
  busy = false;
}

function onTextChange() {
  countEl.textContent = `${input.value.length} / ${input.maxLength}`;
  clearTimeout(debounce);
  if (!input.value.trim()) {
    generation++;
    showIdle();
    return;
  }
  debounce = window.setTimeout(pump, 90);
}

function showReading({ request, response, latency_ms }: EmotionReading) {
  const { emotion, intensity } = response.answers;
  setMood(moodOf(emotion.probabilities, intensity.score));
  wheel.set(emotion.probabilities, emotion.choice);
  gauge.set(intensity.score, intensity.probabilities);

  verdictEl.textContent = EMOTIONS[emotion.choice].label;
  verdictEl.style.setProperty('--c', EMOTIONS[emotion.choice].color);
  verdictSub.textContent = [
    plutchikWord(emotion.choice, intensity.score),
    INTENSITY_LEVELS[Math.round(intensity.score)],
    `confidence ${emotion.confidence.toFixed(2)}`,
  ].join(' · ');
  scoreEl.textContent = `${intensity.score.toFixed(2)} / 4 · conf ${intensity.confidence.toFixed(2)}`;
  setStatus('ok', `${response.model} · ${latency_ms} ms · ${response.usage.input_tokens} tokens`);
  rawEl.textContent = JSON.stringify({ response, request }, null, 2);
}

function showIdle() {
  setMood(NEUTRAL);
  wheel.set(null, null);
  gauge.set(null);
  verdictEl.textContent = '—';
  verdictEl.style.removeProperty('--c');
  verdictSub.textContent = 'Start typing a message';
  scoreEl.textContent = '–';
  setStatus('idle', 'Waiting for your message');
}

let answered = false;

/** While reading, the last answer's stats stay up; only the dot pulses. */
function setStatus(state: 'idle' | 'reading' | 'ok' | 'error', text?: string) {
  statusEl.dataset.state = state;
  if (state === 'ok') answered = true;
  if (text) statusText.textContent = text;
  else if (!answered) statusText.textContent = 'Jev is reading…';
}

// ── Samples type themselves out, so the face changes as the sentence builds ──

let typing = 0;

function typeOut(sample: string) {
  clearInterval(typing);
  generation++;
  input.value = '';
  input.focus();
  const chars = [...sample];
  let shown = 0;
  typing = window.setInterval(() => {
    input.value = chars.slice(0, ++shown).join('');
    onTextChange();
    if (shown === chars.length) clearInterval(typing);
  }, 38);
}

const samplesEl = $('#samples');
for (const sample of SAMPLES) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sample';
  button.textContent = sample;
  button.addEventListener('click', () => typeOut(sample));
  samplesEl.append(button);
}

input.addEventListener('input', () => {
  clearInterval(typing); // the person took over the keyboard
  onTextChange();
});

showIdle();
html.classList.add('is-live'); // everything the page draws from script now exists; let it in

// ── Frame loop ───────────────────────────────────────────────────────────

let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;
  face?.update(dt, time);
  wheel.update(dt);
  if (face) shapes.update(face.weights, time);
  updateMood(dt);
  controls.update();
  renderer.render(scene, camera);
});
