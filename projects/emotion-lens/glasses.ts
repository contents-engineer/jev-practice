import * as THREE from 'three';
import { LAYOUT, TONES, type Frame, type Tone } from './lens';

/** Average adult pupillary distance in mm, used only to turn frame millimetres into model units. */
const IPD_MM = 63;
/** How far in front of the eyeball centres the lenses sit, in mm: clear of raised brows on tall lenses. */
const LENS_FORWARD = 30;
/** Pantoscopic tilt: the lower rim leans toward the cheeks, as on a real front. */
const TILT = THREE.MathUtils.degToRad(6);
const RIM = 2.6;
const WRAP = THREE.MathUtils.degToRad(6);

const LENS_COLOR: Record<Tone, number> = { TINT: 0x5b4330, DARK: 0x0b0c0e, MIRROR: 0xb9c1cc };

function roundedRect(width: number, height: number, radius: number) {
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/**
 * Sunglasses built from a frame's real front dimensions and hung on the Face Cap head, so the
 * lens covers the brows and cheeks by the same geometry lens.ts uses for its numbers.
 */
export class Glasses {
  /** Follows the head; its axes are the world axes at load time, in millimetres. */
  private readonly mount = new THREE.Group();
  // Black acetate: a soft sheen, not the chrome the room reflections would otherwise give it.
  private readonly frameMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x070708, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.35,
  });

  constructor(head: THREE.Object3D) {
    const model = head.children[0];
    head.updateMatrixWorld(true);
    const [left, right] = ['grp_eyeLeft', 'grp_eyeRight'].map((name) => {
      const eye = model.getObjectByName(name);
      if (!eye) throw new Error(`facecap.glb에 ${name}이 없습니다`);
      return eye.getWorldPosition(new THREE.Vector3());
    });
    const unit = left.distanceTo(right) / IPD_MM;
    const pupils = left.add(right).multiplyScalar(0.5);
    // Built while the head is at rest, so the mount's local axes match the world's: x right, y up, z toward the camera.
    this.mount.position.copy(pupils).add(new THREE.Vector3(0, LAYOUT.lensCentre * unit, LENS_FORWARD * unit));
    this.mount.scale.setScalar(unit);
    this.mount.rotation.x = TILT;
    model.attach(this.mount);
  }

  set(frame: Frame | null, tone: Tone | null) {
    for (const child of [...this.mount.children]) {
      this.mount.remove(child);
      child.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          if (node.material !== this.frameMaterial) (node.material as THREE.Material).dispose();
        }
      });
    }
    this.mount.visible = Boolean(frame && tone);
    if (!frame || !tone) return;

    const { lensWidth: w, lensHeight: h, bridge } = frame;
    const radius = Math.min(w, h) * 0.38;
    const lensShape = roundedRect(w, h, radius);
    const rimShape = roundedRect(w + RIM * 2, h + RIM * 2, radius + RIM);
    rimShape.holes.push(roundedRect(w, h, radius));

    const lensMaterial = new THREE.MeshPhysicalMaterial({
      color: LENS_COLOR[tone],
      // Opacity mirrors the transmittance lens.ts uses, so what you see matches the numbers.
      opacity: 1 - TONES[tone].transmittance,
      transparent: true,
      roughness: tone === 'MIRROR' ? 0.05 : 0.08,
      metalness: tone === 'MIRROR' ? 1 : 0,
      // Tinted glass keeps only a faint reflection, so the lens reads as its own colour.
      envMapIntensity: tone === 'MIRROR' ? 1 : 0.18,
      specularIntensity: tone === 'MIRROR' ? 1 : 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    for (const side of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.x = side * (bridge / 2 + w / 2);
      eye.rotation.y = side * WRAP; // outer edges swept back a little, like a real front
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(lensShape, 24), lensMaterial);
      lens.renderOrder = 2;
      const rim = new THREE.Mesh(
        new THREE.ExtrudeGeometry(rimShape, { depth: 3, bevelEnabled: false, curveSegments: 24 }),
        this.frameMaterial,
      );
      rim.position.z = -1.5;
      eye.add(lens, rim);

      // Endpiece out to the frame front width, then the temple back toward the ear.
      const outer = bridge / 2 + w + RIM;
      const edge = Math.max(outer + 1.5, frame.frameFront / 2);
      const endpiece = new THREE.Mesh(new THREE.BoxGeometry(edge - outer + 2, 4, 3), this.frameMaterial);
      endpiece.position.set(side * ((outer + edge) / 2 - 1), h * 0.28, 0);
      const temple = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.2, frame.templeLength * 0.72), this.frameMaterial);
      temple.position.set(side * (edge - 1), h * 0.28, -(frame.templeLength * 0.72) / 2);
      this.mount.add(eye, endpiece, temple);
    }

    const bridgePiece = new THREE.Mesh(new THREE.BoxGeometry(bridge + 4, 3.2, 3), this.frameMaterial);
    bridgePiece.position.y = h * 0.22;
    this.mount.add(bridgePiece);
  }
}
