import test from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector2, Vector3, DoubleSide } from 'three';
import { sampleJourney, plateOpacity, corridorOpacity, ramp, CORRIDOR_TRAVEL } from '../src/temple/cameraPath.js';
import { plates } from '../src/temple/plates.js';
import { buildCorridorGeometry, coverUV, coverEye, COVER_Z, REFERENCE } from '../src/temple/projection.js';

const sample = (p, portrait = false) => {
  const position = new Vector3(), target = new Vector3();
  sampleJourney(p, position, target, portrait);
  return { position, target };
};

test('the camera stays in the clear aisle, above the floor, and never jumps', () => {
  const previous = new Vector3();
  for (let i = 0; i <= 1000; i++) {
    const { position, target } = sample(i / 1000);
    assert.ok([...position, ...target].every(Number.isFinite), 'non-finite camera sample');
    // The corridor eye is deliberately low, at the photograph's own height.
    assert.ok(position.y > 0.6, `camera dipped to y=${position.y}`);
    // The lamps stand at |x| = 3.4 and the portrait at 1.9; stay well clear.
    if (position.z < COVER_Z + 1) assert.ok(Math.abs(position.x) < 1, 'camera drifts out of the aisle');
    if (i) assert.ok(position.distanceTo(previous) < 0.35, 'camera jumps between samples');
    previous.copy(position);
  }
});

test('the camera only ever moves forward, down the aisle', () => {
  let previousZ = Infinity;
  for (let i = 0; i <= 1000; i++) {
    const { position } = sample(i / 1000);
    assert.ok(position.z <= previousZ + 1e-9, `camera reversed at p=${i / 1000}`);
    previousZ = position.z;
  }
});

test('the rebuilt journey travels at least thirty percent farther', () => {
  assert.ok(CORRIDOR_TRAVEL >= 14.3, `corridor travel is only ${CORRIDOR_TRAVEL.toFixed(2)}m`);
});

test('the camera reaches the cover pose exactly when the exterior starts to dissolve', () => {
  const { position } = sample(0.15);
  const eye = coverEye();
  assert.ok(position.distanceTo(eye) < 0.05, `camera at ${position.toArray()} not at the cover eye ${eye.toArray()}`);
  assert.equal(plateOpacity.exterior(0.15), 1);
});

/**
 * The bug this guards against: a plate sized and placed for one part of the
 * journey, still faded in while the camera has already drawn level with it, so
 * the camera flies through the photograph.
 */
test('no plate is ever visible once the camera has reached it', () => {
  for (const plate of plates) {
    const opacity = plateOpacity[plate.name];
    assert.ok(opacity, `no fade defined for the ${plate.name} plate`);
    const nearestZ = Math.max(...plate.layers.map(layer => layer.z));
    for (let i = 0; i <= 1000; i++) {
      const p = i / 1000;
      if (opacity(p) <= 0.002) continue;
      const { position } = sample(p);
      assert.ok(
        position.z > nearestZ + 1,
        `${plate.name} plate is visible at p=${p} with the camera at z=${position.z.toFixed(2)}, past its nearest layer at z=${nearestZ}`,
      );
    }
  }
});

test('plate fades stay within range and the opening is always covered', () => {
  for (let i = 0; i <= 1000; i++) {
    const p = i / 1000;
    for (const plate of plates) {
      const value = plateOpacity[plate.name](p);
      assert.ok(value >= 0 && value <= 1, `${plate.name} opacity out of range at p=${p}`);
    }
    // Nothing stands behind the exterior plate before the cover pose, so it
    // has to carry the frame on its own until then.
    if (p < 0.15) assert.equal(plateOpacity.exterior(p), 1, `opening not covered at p=${p}`);
    // The corridor box must still be there until the ceremony plate has
    // fully covered it.
    if (plateOpacity.ceremony(p) < 1) assert.equal(corridorOpacity(p), 1, `corridor retired too early at p=${p}`);
  }
});

test('the ceremony plate has arrived before the journey ends', () => {
  assert.equal(plateOpacity.ceremony(1), 1);
  assert.equal(plateOpacity.exterior(1), 0);
});

test('the final camera station is the ceremony cover pose', () => {
  const ceremony = plates.find(plate => plate.name === 'ceremony');
  const { position } = sample(1);
  assert.ok(Math.abs(position.z - ceremony.coverZ) < 1e-9,
    `final camera z=${position.z} does not match ceremony cover z=${ceremony.coverZ}`);
});

test('sampling is deterministic in both directions', () => {
  const forward = [];
  for (let i = 0; i <= 100; i++) forward.push(sample(i / 100).position);
  for (let i = 100; i >= 0; i--) {
    assert.ok(sample(i / 100).position.distanceTo(forward[i]) < 1e-9, 'reverse sampling diverged');
  }
});

test('the portrait camera is continuous across every chapter boundary', () => {
  const previous = new Vector3();
  for (let i = 0; i <= 1000; i++) {
    const { position } = sample(i / 1000, true);
    if (i) assert.ok(position.distanceTo(previous) < 0.35, 'portrait camera jumps');
    previous.copy(position);
  }
});

test('ramp is a clamped smoothstep', () => {
  assert.equal(ramp(0, 0.2, 0.8), 0);
  assert.equal(ramp(1, 0.2, 0.8), 1);
  assert.ok(Math.abs(ramp(0.5, 0.2, 0.8) - 0.5) < 1e-9);
});

/**
 * The corridor box is a projection of the photograph. Whatever depth each
 * vertex is given, it must stay on its own ray from the cover eye, or the
 * picture would drift from the render the moment the camera arrives.
 */
const viewports = [
  { name: 'desktop', fov: 54, aspect: 1440 / 900, portrait: false },
  { name: 'ultrawide', fov: 54, aspect: 21 / 9, portrait: false },
  { name: 'phone', fov: 68, aspect: 390 / 844, portrait: true },
];

test('every corridor vertex reprojects onto its own pixel from the cover eye', () => {
  for (const viewport of viewports) {
    const { geometry, frame } = buildCorridorGeometry({ ...viewport, columns: 48, rows: 27 });
    const position = geometry.attributes.position, uv = geometry.attributes.uv;
    const point = new Vector3();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      const back = coverUV(point, frame);
      assert.ok(back, `${viewport.name}: vertex ${i} is behind the cover eye`);
      assert.ok(Math.abs(back.u - uv.getX(i)) < 1e-5 && Math.abs(back.v - (1 - uv.getY(i))) < 1e-5,
        `${viewport.name}: vertex ${i} drifted from its pixel`);
      assert.ok(point.y > -1e-6 && point.z < COVER_Z + 1e-6, `${viewport.name}: vertex ${i} outside the box`);
    }
  }
});

test('every card is well formed and stands on the floor', () => {
  for (const card of REFERENCE.cards) {
    assert.ok(card.u0 < card.u1 && card.v0 < card.v1, 'degenerate card');
    assert.ok(card.base >= card.v0 && card.base <= card.v1 + 1e-9, 'card base outside its own rectangle');
    assert.ok(card.base > REFERENCE.horizon, 'a card must stand on the floor, below the horizon');
  }
});

/**
 * The box is open at the front. From the cover pose the open side coincides
 * with the frame exactly, so any move backwards, or any turn before enough
 * forward travel, would show the void past an edge. This walks the corridor
 * on every viewport and fires the frame's four corner rays into the box.
 */
test('no corner of the frame ever sees past the open front of the corridor box', () => {
  const raycaster = new Raycaster();
  const corners = [new Vector2(-1, -1), new Vector2(1, -1), new Vector2(-1, 1), new Vector2(1, 1)];
  for (const viewport of viewports) {
    const { geometry } = buildCorridorGeometry({ ...viewport, columns: 96, rows: 54 });
    const mesh = new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
    const camera = new PerspectiveCamera(viewport.fov, viewport.aspect, 0.1, 130);
    for (let i = 0; i <= 200; i++) {
      const p = i / 200;
      // The box carries the frame from the moment the exterior begins to
      // dissolve until the ceremony plate has covered it.
      if (p < 0.15 || plateOpacity.ceremony(p) >= 1) continue;
      const { position, target } = sample(p, viewport.portrait);
      camera.position.copy(position);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      for (const corner of corners) {
        raycaster.setFromCamera(corner, camera);
        const hit = raycaster.intersectObject(mesh, false)[0];
        assert.ok(hit, `${viewport.name}: frame corner (${corner.x}, ${corner.y}) sees past the box at p=${p}, camera z=${position.z.toFixed(2)}`);
      }
    }
  }
});
