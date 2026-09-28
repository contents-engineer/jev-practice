import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import Swiper from 'swiper';
import { FreeMode, Mousewheel } from 'swiper/modules';
import type { EmotionReading } from './server';
import { ProbabilityBars } from './bars';
import { EMOTIONS, EMOTION_IDS, INTENSITY_LEVELS, NEUTRAL, moodOf, type Mood } from './emotions';
import { Face } from './face';
import { ShapeMeter } from './meters';
import { SAMPLES } from './samples';
import { ReadingLoop } from './reading-loop';

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
const html = document.documentElement;
const stageEl = $('#stage');
const slotEl = $('#face-slot');
const input = $<HTMLTextAreaElement>('#message');
const statusEl = $('#status');
const statusText = $('#status-text');
const countEl = $('#count');
const readoutEl = $('#readout');
const out = {
  emotion: $('#sum-emotion'),
  intensityBar: $('#sum-intensity-bar'),
  intensity: $('#sum-intensity'),
  score: $('#sum-score'),
  confidence: $('#meta-confidence'),
  latency: $('#meta-latency'),
  elapsed: $('#meta-elapsed'),
  analyzed: $('#analyzed-message'),
  note: $('#reading-note'),
  tokens: $('#meta-tokens'),
  requests: $('#meta-requests'),
  failures: $('#meta-failures'),
  rawResponse: $('#raw-response'),
  rawRequest: $('#raw-request'),
};

const emotionBars = new ProbabilityBars(
  $('#emotion-bars'),
  EMOTION_IDS.map((id) => ({ key: id, label: EMOTIONS[id].ko, hint: id, color: EMOTIONS[id].color })),
);
const intensityBars = new ProbabilityBars(
  $('#intensity-bars'),
  INTENSITY_LEVELS.map((name, level) => ({ key: String(level), label: `${level} · ${name}` })),
);
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
    $('#loading').textContent = `얼굴 모델을 불러오지 못했습니다: ${err.message}`;
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

/** Session totals for the meta block. */
const tally = { requests: 0, failures: 0 };

async function fetchReading(text: string): Promise<EmotionReading> {
  out.requests.textContent = String(++tally.requests);
  try {
    const res = await fetch('/api/emotion-face/emotion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
    return body;
  } catch (err) {
    out.failures.textContent = String(++tally.failures);
    throw err;
  }
}

const readings = new ReadingLoop<EmotionReading>({
  read: fetchReading,
  show: (reading, text, elapsed) => {
    showReading(reading);
    out.analyzed.textContent = text;
    out.elapsed.textContent = `${elapsed}ms`;
  },
  pending: () => {
    setMood(NEUTRAL);
    out.note.textContent = '입력이 바뀌었습니다. 아래 값은 마지막 분석 결과이며, 현재 문장을 다시 읽고 있습니다.';
    setStatus('reading', '현재 문장을 읽는 중…');
  },
  idle: showIdle,
  error: (error) => {
    out.note.textContent = '현재 문장을 분석하지 못했습니다. 아래 값은 마지막 분석 결과입니다.';
    setStatus('error', error instanceof Error ? error.message : '요청에 실패했습니다');
  },
});

function onTextChange() {
  countEl.textContent = `${input.value.length} / ${input.maxLength}`;
  readings.update(input.value);
}

function showReading({ request, response, latency_ms }: EmotionReading) {
  const { emotion, intensity } = response.answers;
  const level = Math.round(intensity.score);
  const unclear = emotion.choice === 'unclear';
  setMood(unclear ? NEUTRAL : moodOf(emotion.probabilities, intensity.score));
  out.note.textContent = unclear
    ? '맥락이 부족하거나 여러 해석이 가능합니다. 강도는 표시·적용하지 않습니다. 원본 응답은 아래에서 볼 수 있습니다.'
    : '문장만으로 추정한 반응입니다. 확률은 감정의 혼합 비율이 아니며, 표정 혼합은 시각적 연출입니다.';
  // The summary dot and the intensity bars take the colour of the chosen emotion.
  readoutEl.style.setProperty('--c', EMOTIONS[emotion.choice].color);
  emotionBars.set(emotion.probabilities, emotion.choice);
  const peakLevel = Object.entries(intensity.probabilities).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  intensityBars.set(unclear ? null : intensity.probabilities, unclear ? null : peakLevel);

  const dot = document.createElement('i');
  const name = document.createElement('b');
  const id = document.createElement('code');
  name.textContent = EMOTIONS[emotion.choice].ko;
  id.textContent = emotion.choice;
  out.emotion.replaceChildren(dot, name, id);
  out.intensityBar.style.setProperty('--v', unclear ? '0' : String(intensity.score / 4));
  out.intensity.textContent = unclear ? '–' : (intensity.score / 4).toFixed(3);
  out.score.textContent = unclear ? '판단 보류' : `${intensity.score.toFixed(3)} → "${INTENSITY_LEVELS[level]}"`;
  out.confidence.textContent = `감정 ${emotion.confidence.toFixed(3)}\n강도 ${intensity.confidence.toFixed(3)}`;
  out.latency.textContent = `${latency_ms}ms`;
  out.tokens.textContent = String(response.usage.input_tokens);
  out.rawResponse.textContent = JSON.stringify(response, null, 2);
  out.rawRequest.textContent = JSON.stringify(request, null, 2);
  setStatus('ok', `${response.model} · ${latency_ms}ms · 토큰 ${response.usage.input_tokens}개`);
}

function showIdle() {
  setMood(NEUTRAL);
  readoutEl.style.removeProperty('--c');
  emotionBars.set(null, null);
  intensityBars.set(null, null);
  out.emotion.textContent = '–';
  out.intensityBar.style.setProperty('--v', '0');
  for (const el of [out.intensity, out.score, out.confidence, out.latency, out.elapsed, out.analyzed, out.tokens]) el.textContent = '–';
  out.note.textContent = '문장을 입력하면 예상 반응을 보여 줍니다. 실제 수신자의 감정을 측정하는 도구는 아닙니다.';
  out.rawResponse.textContent = '아직 응답이 없습니다.';
  out.rawRequest.textContent = '아직 요청이 없습니다.';
  setStatus('idle', '메시지를 기다리는 중');
}

let answered = false;

/** While reading, the last answer's stats stay up; only the dot pulses. */
function setStatus(state: 'idle' | 'reading' | 'ok' | 'error', text?: string) {
  statusEl.dataset.state = state;
  if (state === 'ok') answered = true;
  if (text) statusText.textContent = text;
  else if (!answered) statusText.textContent = 'Jev가 읽는 중…';
}

// ── Samples type themselves out, so the face changes as the sentence builds ──

let typing = 0;

function typeOut(sample: string) {
  clearInterval(typing);
  input.value = '';
  onTextChange();
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
const sampleButtons = SAMPLES.map(({ text: sample }) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sample swiper-slide';
  button.textContent = sample;
  button.addEventListener('click', () => typeOut(sample)); // Swiper swallows the click that ends a drag
  return button;
});
samplesEl.querySelector('.swiper-wrapper')!.append(...sampleButtons);

const samplesSwiper = new Swiper(samplesEl, {
  modules: [FreeMode, Mousewheel],
  slidesPerView: 'auto',
  spaceBetween: 8,
  slidesOffsetBefore: 24,
  slidesOffsetAfter: 24,
  freeMode: { enabled: true, momentumRatio: 0.6 },
  mousewheel: { forceToAxis: true }, // horizontal trackpad swipes only; vertical wheel still scrolls the page
  grabCursor: true,
});
// Tabbing to a chip past the edge: the browser would scroll the overflow-hidden container
// behind Swiper's back, so undo that and let Swiper bring the chip into view.
samplesEl.addEventListener('focusin', (event) => {
  const index = sampleButtons.indexOf(event.target as HTMLButtonElement);
  if (index < 0) return;
  samplesEl.scrollLeft = 0;
  samplesSwiper.slideTo(index);
});

input.addEventListener('input', () => {
  clearInterval(typing); // the person took over the keyboard
  onTextChange();
});

showIdle();
// Everything the page draws from script now exists. Korean web fonts are heavy, so give them
// a moment to land before the reveal rather than swapping typefaces mid-animation.
void Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, 800))]).then(() =>
  html.classList.add('is-live'),
);

// ── Frame loop ───────────────────────────────────────────────────────────

let last = performance.now();
renderer.setAnimationLoop((now: number) => {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const time = now / 1000;
  face?.update(dt, time);
  if (face) shapes.update(face.weights, time);
  updateMood(dt);
  controls.update();
  renderer.render(scene, camera);
});
