import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { sampleJourney, plateOpacity, ramp } from '../src/temple/cameraPath.js';
import { plates } from '../src/temple/plates.js';

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
    assert.ok(position.y > 1.5, `camera dipped to y=${position.y}`);
    // The colonnade pillars stand at |x| = 3.9; stay well clear of them.
    if (position.z < 2) assert.ok(Math.abs(position.x) < 1, 'camera drifts into the pillars');
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
    // The built colonnade is hidden below p=0.1, so the exterior plate has to
    // carry the frame on its own until then.
    if (p < 0.1) assert.equal(plateOpacity.exterior(p), 1, `opening not covered at p=${p}`);
  }
});

test('the ceremony plate has arrived before the journey ends', () => {
  assert.equal(plateOpacity.ceremony(1), 1);
  assert.equal(plateOpacity.exterior(1), 0);
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
