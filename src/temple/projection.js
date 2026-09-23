import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';

/**
 * The corridor as a "tour into the picture".
 *
 * The rendered corridor photograph is a one-point perspective, so it can be
 * unfolded into a box: a floor, a ceiling, two walls and a back wall that all
 * meet at the vanishing point. Every pixel is cast along its own ray from the
 * eye that took the picture and lands on whichever face that ray hits first.
 * Seen from that eye the box is the photograph, exactly; move the eye forward
 * and every face slides at its own rate, which is real parallax on real
 * photographic detail. This is Horry, Anjyo and Arai's technique from 1997,
 * and it is why the corridor looks like the render: it is the render.
 *
 * Objects that stand on the floor in front of the pillars, the lamps and the
 * urli bowls, would be smeared across the floor and wall by that unfolding, so
 * they are declared as cards: vertical planes at the depth of their base. A
 * card's depth is feathered into its surroundings so the join warps instead of
 * tearing.
 *
 * Every vertex stays on its ray, whatever depth it is given, so the cover view
 * can never drift from the source image. journey.test.mjs proves that, and
 * proves that no frame corner can ever see past the open front of the box.
 */

export const CORRIDOR_ASPECT = 1672 / 941;

/** Measured on assets-src/temple-corridor.png. All values are fractions of the image. */
export const REFERENCE = {
  // The petal lines along both edges of the aisle converge here.
  horizon: 526 / 941,
  centre: 0.5,
  // The far opening at the end of the aisle, which becomes the back wall.
  doorway: { v0: 265 / 941, v1: 545 / 941 },
  // Metres. The eye is low: the kolam is seen from just above a seated head.
  eyeHeight: 0.85,
  // Half the distance between the two rows of pillars, metres.
  halfWidth: 5.2,
  // Standing objects, with the row of pixels their base rests on.
  cards: [
    { u0: 275 / 1672, u1: 395 / 1672, v0: 415 / 941, v1: 668 / 941, base: 655 / 941 }, // near lamp, left
    { u0: 1277 / 1672, u1: 1397 / 1672, v0: 415 / 941, v1: 668 / 941, base: 655 / 941 }, // near lamp, right
    { u0: 598 / 1672, u1: 668 / 1672, v0: 478 / 941, v1: 598 / 941, base: 588 / 941 }, // mid lamp, left
    { u0: 1004 / 1672, u1: 1074 / 1672, v0: 478 / 941, v1: 598 / 941, base: 588 / 941 }, // mid lamp, right
    { u0: 0, u1: 268 / 1672, v0: 555 / 941, v1: 700 / 941, base: 690 / 941 }, // pillar base, left
    { u0: 1404 / 1672, u1: 1, v0: 555 / 941, v1: 700 / 941, base: 690 / 941 }, // pillar base, right
    { u0: 0, u1: 268 / 1672, v0: 690 / 941, v1: 1, base: 935 / 941 }, // urli bowls, left
    { u0: 1404 / 1672, u1: 1, v0: 690 / 941, v1: 1, base: 935 / 941 }, // urli bowls, right
  ],
  // How far, in image fractions, a card's depth blends into its surroundings.
  // Wider across than down: the camera walks forward, so a card slides
  // sideways against its background and needs room to warp rather than shear.
  featherU: 0.03,
  featherV: 0.012,
  // The image is built a little larger than the frame so the camera can be a
  // fraction off the cover pose without exposing an edge.
  margin: 1.06,
};

/** Where the camera stands when the box reproduces the photograph exactly. */
export const COVER_Z = 11;

/**
 * Landmarks in the photograph, as image fractions, that the scene decorates
 * with live flames. Each is placed in 3D by casting its pixel onto the box.
 */
export const LANDMARKS = {
  nearLampFlames: [[330 / 1672, 438 / 941], [1342 / 1672, 438 / 941]],
  midLampFlames: [[632 / 1672, 490 / 941], [1040 / 1672, 490 / 941]],
  hangingLampFlames: [[330 / 1672, 152 / 941], [1342 / 1672, 152 / 941]],
  bowlFlames: [[178 / 1672, 705 / 941], [1494 / 1672, 705 / 941]],
  floorDiyas: [
    [572 / 1672, 578 / 941], [1100 / 1672, 578 / 941],
    [640 / 1672, 552 / 941], [1032 / 1672, 552 / 941],
    [688 / 1672, 540 / 941], [984 / 1672, 540 / 941],
  ],
  // The far pavilion's glow, the light the whole corridor is walking toward.
  doorway: [0.5, 420 / 941],
};

const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/**
 * Everything the unfolding needs for one viewport. The image is scaled to
 * cover the frame, so a wide screen sees the image's full height and a phone
 * sees a central slice, exactly as `object-fit: cover` would.
 */
export function corridorFrame({ fov, aspect, reference = REFERENCE }) {
  const tanHalf = Math.tan((fov * Math.PI) / 360);
  const halfHeight = tanHalf * Math.max(1, aspect / CORRIDOR_ASPECT) * reference.margin;
  const halfWidth = halfHeight * CORRIDOR_ASPECT;
  // The horizon sits below the centre of the frame, so the eye looks slightly
  // up. Verticals in the image stay parallel, which is what a level sensor
  // gives, and the small tilt is absorbed by the geometry.
  const pitch = Math.atan((reference.horizon - 0.5) * 2 * halfHeight);
  return { tanHalf, halfHeight, halfWidth, pitch, aspect, fov };
}

/** The ray, in world space from the cover eye, through image point (u, v). */
export function rayThrough(u, v, frame, reference = REFERENCE, out = new Vector3()) {
  const x = (u - reference.centre) * 2 * frame.halfWidth;
  const y = (0.5 - v) * 2 * frame.halfHeight;
  const cos = Math.cos(frame.pitch), sin = Math.sin(frame.pitch);
  // Camera space (x, y, -1), tilted up by `pitch` about the x axis.
  return out.set(x, y * cos + sin, y * sin - cos).normalize();
}

export function coverEye(reference = REFERENCE, out = new Vector3()) {
  return out.set(0, reference.eyeHeight, COVER_Z);
}

/** The box faces derived from the measurements, in metres from the cover eye. */
export function corridorBox(frame, reference = REFERENCE) {
  const dir = new Vector3();
  // The doorway's foot is where the floor ends; its lintel is where the back
  // wall meets the ceiling.
  rayThrough(reference.centre, reference.doorway.v1, frame, reference, dir);
  const depth = (reference.eyeHeight / -dir.y) * -dir.z;
  rayThrough(reference.centre, reference.doorway.v0, frame, reference, dir);
  const ceiling = reference.eyeHeight + (depth / -dir.z) * dir.y;
  return { depth, ceiling, halfWidth: reference.halfWidth, eyeHeight: reference.eyeHeight };
}

/**
 * Distance along the ray through (u, v) to the surface of the unfolded
 * picture: the nearest box face, or a card where one is declared.
 */
export function surfaceDistance(u, v, frame, box, reference = REFERENCE, dir = new Vector3()) {
  rayThrough(u, v, frame, reference, dir);
  let t = Infinity;
  if (dir.y < 0) t = Math.min(t, -box.eyeHeight / dir.y);
  if (dir.y > 0) t = Math.min(t, (box.ceiling - box.eyeHeight) / dir.y);
  if (dir.x < 0) t = Math.min(t, -box.halfWidth / dir.x);
  if (dir.x > 0) t = Math.min(t, box.halfWidth / dir.x);
  if (dir.z < 0) t = Math.min(t, -box.depth / dir.z);

  const fu = reference.featherU, fv = reference.featherV;
  for (const card of reference.cards) {
    const weight = smooth((u - card.u0 + fu) / fu) * smooth((card.u1 + fu - u) / fu)
      * smooth((v - card.v0 + fv) / fv) * smooth((card.v1 + fv - v) / fv);
    if (weight <= 0) continue;
    // The card stands where its base row meets the floor.
    const base = rayThrough(u, card.base, frame, reference, new Vector3());
    const cardDepth = (box.eyeHeight / -base.y) * -base.z;
    const tCard = -cardDepth / dir.z;
    if (tCard < t) t = t + (tCard - t) * weight;
  }
  return t;
}

/** World position of image point (u, v) on the unfolded picture. */
export function surfacePoint(u, v, frame, box, reference = REFERENCE, out = new Vector3()) {
  const dir = new Vector3();
  const t = surfaceDistance(u, v, frame, box, reference, dir);
  return out.copy(dir).multiplyScalar(t).add(coverEye(reference));
}

/**
 * The unfolded picture as a mesh: a regular grid over the image, each vertex
 * pushed out along its ray. Dense enough that the creases between faces and
 * the feathered card edges read as clean folds rather than steps.
 */
export function buildCorridorGeometry({ fov, aspect, columns = 240, rows = 136, reference = REFERENCE }) {
  const frame = corridorFrame({ fov, aspect, reference });
  const box = corridorBox(frame, reference);
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3);
  const uvs = new Float32Array((columns + 1) * (rows + 1) * 2);
  const point = new Vector3();
  let i = 0;
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    for (let c = 0; c <= columns; c++) {
      const u = c / columns;
      surfacePoint(u, v, frame, box, reference, point);
      positions[i * 3] = point.x; positions[i * 3 + 1] = point.y; positions[i * 3 + 2] = point.z;
      uvs[i * 2] = u; uvs[i * 2 + 1] = 1 - v;
      i++;
    }
  }
  const index = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const a = r * (columns + 1) + c, b = a + 1, d = a + columns + 1, e = d + 1;
      index.push(a, d, b, b, d, e);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeBoundingSphere();
  return { geometry, frame, box };
}

/**
 * Projects a world point back through the cover eye, returning the image
 * fraction it lands on. Used by the tests to prove the geometry reproduces
 * the picture and that the frame never sees past its edges.
 */
export function coverUV(point, frame, reference = REFERENCE) {
  const eye = coverEye(reference);
  const d = new Vector3().subVectors(point, eye);
  const cos = Math.cos(frame.pitch), sin = Math.sin(frame.pitch);
  // Undo the tilt, then divide through by depth.
  const x = d.x;
  const y = d.y * cos + d.z * sin;
  const z = d.z * cos - d.y * sin;
  if (z >= 0) return null;
  const u = reference.centre + x / -z / (2 * frame.halfWidth);
  const v = 0.5 - y / -z / (2 * frame.halfHeight);
  return { u, v };
}
