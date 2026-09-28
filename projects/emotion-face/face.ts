import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ARKIT_BLENDSHAPES, EMOTION_IDS, EMOTIONS, type Blendshape, type Mood } from './emotions';

const COUNT = ARKIT_BLENDSHAPES.length;
const at = (name: Blendshape) => ARKIT_BLENDSHAPES.indexOf(name);
const BLINK = [at('eyeBlink_L'), at('eyeBlink_R')];
const WIDE = [at('eyeWide_L'), at('eyeWide_R')];
const LOOK_DOWN = [at('eyeLookDown_L'), at('eyeLookDown_R')];
const LOOK_UP = [at('eyeLookUp_L'), at('eyeLookUp_R')];

/** Fraction of the remaining distance to cover this frame, independent of frame rate. */
const approach = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const euler = new THREE.Euler();
const turn = new THREE.Quaternion();
const look = new THREE.Vector2();

/**
 * Face Cap's head (52 ARKit morph targets) driven by a Mood instead of the recorded
 * capture the three.js example plays, plus the small motions that keep a face alive.
 */
export class Face {
  /** Weights on the mesh this frame, in ARKIT_BLENDSHAPES order. */
  readonly weights = new Float32Array(COUNT);
  private readonly target = new Float32Array(COUNT);
  private readonly eased = new Float32Array(COUNT);
  private readonly pose = { target: new THREE.Vector3(), eased: new THREE.Vector3() };
  private readonly gaze = { target: new THREE.Vector2(), eased: new THREE.Vector2(), eye: new THREE.Vector2() };
  private readonly saccade = { offset: new THREE.Vector2(), next: 0 };
  private readonly blinking = { next: 1.2, start: -1, twice: false };

  private constructor(
    /** Pivot at the neck; add this to the scene. */
    readonly root: THREE.Group,
    private readonly influences: number[],
    /** Morph target index for each ARKit blendshape. */
    private readonly morphIndex: number[],
    private readonly eyes: { node: THREE.Object3D; rest: THREE.Quaternion }[],
  ) {}

  static async load(renderer: THREE.WebGLRenderer): Promise<Face> {
    const base = import.meta.env.BASE_URL;
    const ktx2 = new KTX2Loader().setTranscoderPath(`${base}basis/`).detectSupport(renderer);
    const gltf = await new GLTFLoader()
      .setKTX2Loader(ktx2)
      .setMeshoptDecoder(MeshoptDecoder)
      .loadAsync(`${base}models/facecap.glb`);
    ktx2.dispose();

    const model = gltf.scene.children[0];
    const head = model.getObjectByName('mesh_2') as THREE.Mesh;
    const dictionary = head.morphTargetDictionary!;
    const morphIndex = ARKIT_BLENDSHAPES.map((name) => {
      const index = dictionary[name] ?? dictionary[`blendShape1.${name}`];
      if (index === undefined) throw new Error(`facecap.glb에 "${name}" blendshape가 없습니다`);
      return index;
    });
    const eyes = ['grp_eyeLeft', 'grp_eyeRight'].map((name) => {
      const node = model.getObjectByName(name)!;
      return { node, rest: node.quaternion.clone() };
    });

    // Turn the head around the neck rather than the middle of the skull. `precise` measures the
    // vertices themselves; the default box also counts every morph target and comes out far too big.
    head.morphTargetInfluences!.fill(0);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const neck = new THREE.Vector3(0, box.min.y + 0.2 * (box.max.y - box.min.y), box.getCenter(new THREE.Vector3()).z);
    const root = new THREE.Group();
    root.position.copy(neck);
    model.position.sub(neck);
    root.add(model);

    return new Face(root, head.morphTargetInfluences!, morphIndex, eyes);
  }

  setMood(mood: Mood) {
    this.target.fill(0);
    this.pose.target.set(0, 0, 0);
    this.gaze.target.set(0, 0);
    for (const id of EMOTION_IDS) {
      const amount = mood.mix[id] * mood.strength;
      if (amount === 0) continue;
      const { face, head, gaze } = EMOTIONS[id];
      for (const [name, weight] of Object.entries(face) as [Blendshape, number][]) {
        this.target[at(name)] += amount * weight;
      }
      this.pose.target.x += amount * head[0];
      this.pose.target.y += amount * head[1];
      this.pose.target.z += amount * head[2];
      this.gaze.target.x += amount * gaze[0];
      this.gaze.target.y += amount * gaze[1];
    }
    for (let i = 0; i < COUNT; i++) this.target[i] = clamp01(this.target[i]);
  }

  update(dt: number, time: number) {
    const k = approach(9, dt);
    for (let i = 0; i < COUNT; i++) this.eased[i] += (this.target[i] - this.eased[i]) * k;
    this.pose.eased.lerp(this.pose.target, approach(3.5, dt));
    this.gaze.eased.lerp(this.gaze.target, approach(4, dt));

    // Micro-saccades: the eyes hop to a nearby point every second or two.
    if (time > this.saccade.next) {
      this.saccade.offset.set(rand(-0.03, 0.03), rand(-0.05, 0.05));
      this.saccade.next = time + rand(0.6, 2.4);
    }
    this.gaze.eye.lerp(look.addVectors(this.gaze.eased, this.saccade.offset), approach(28, dt));

    const w = this.weights;
    w.set(this.eased);
    // Lids follow the eyeballs up and down.
    const pitch = this.gaze.eye.x;
    for (const i of LOOK_DOWN) w[i] += Math.max(0, pitch) * 1.6;
    for (const i of LOOK_UP) w[i] += Math.max(0, -pitch) * 1.6;
    const blink = this.blink(time);
    for (const i of BLINK) w[i] += (1 - w[i]) * blink;
    for (const i of WIDE) w[i] *= 1 - blink;

    for (let i = 0; i < COUNT; i++) {
      w[i] = clamp01(w[i]);
      this.influences[this.morphIndex[i]] = w[i];
    }

    // Expression pose plus a slow idle drift and breathing.
    this.root.rotation.set(
      this.pose.eased.x + 0.016 * Math.sin(time * 0.83) + 0.01 * Math.sin(time * 0.31 + 1),
      this.pose.eased.y + 0.04 * Math.sin(time * 0.23) + 0.015 * Math.sin(time * 0.61 + 2),
      this.pose.eased.z + 0.015 * Math.sin(time * 0.37 + 0.5),
    );
    turn.setFromEuler(euler.set(this.gaze.eye.x, 0, this.gaze.eye.y));
    for (const eye of this.eyes) eye.node.quaternion.copy(eye.rest).multiply(turn);
  }

  /** 0 (open) to 1 (closed): a quick close, a slower open, now and then twice in a row. */
  private blink(time: number) {
    const b = this.blinking;
    if (b.start < 0) {
      if (time < b.next) return 0;
      b.start = time;
    }
    const t = time - b.start;
    if (t < 0.26) {
      const v = t < 0.07 ? t / 0.07 : t < 0.1 ? 1 : 1 - (t - 0.1) / 0.16;
      return v * v * (3 - 2 * v);
    }
    b.start = -1;
    b.twice = !b.twice && Math.random() < 0.2;
    b.next = time + (b.twice ? 0.12 : rand(2.2, 5.5));
    return 0;
  }
}
