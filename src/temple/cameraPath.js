import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * One continuous camera move, from the courtyard outside the gopuram to the
 * sacred fire. Measured in metres, travelling down -Z with the aisle clear.
 *
 * The world is laid out as:
 *   z = +20 .. +1   approach and threshold, framed by the exterior plate
 *   z =  -2 .. -44  the built colonnade
 *   z = -46 .. -52  the mandapam and the ceremony plate behind it
 */
const stops = [0, 0.14, 0.24, 0.42, 0.58, 0.74, 0.9, 1];
const positions = [
  [0, 3.3, 20],
  [0, 2.7, 9.5],
  [0, 2.05, 1],
  [0.55, 1.95, -12],
  [0, 1.9, -24],
  [0, 1.85, -33],
  [0, 1.75, -37.5],
  [0, 1.7, -40],
];
const targets = [
  [0, 3.6, 0],
  [0, 3.1, -6],
  [0, 2.5, -14],
  [-0.75, 2.0, -22],
  [0, 2.0, -36],
  [0, 1.95, -44],
  [0, 1.8, -48],
  [0, 1.78, -48],
];

const positionPath = new CatmullRomCurve3(positions.map(p => new Vector3(...p)), false, 'centripetal');
const targetPath = new CatmullRomCurve3(targets.map(p => new Vector3(...p)), false, 'centripetal');

/** Maps journey progress onto the curve, keeping the stop spacing even. */
export function sampleJourney(progress, position, target, portrait = false) {
  const p = Math.max(0, Math.min(1, progress));
  let i = stops.findIndex((end, index) => index > 0 && p <= end) - 1;
  i = Math.max(0, Math.min(stops.length - 2, i));
  const local = (p - stops[i]) / (stops[i + 1] - stops[i]);
  const t = (i + local) / (stops.length - 1);
  positionPath.getPoint(t, position);
  targetPath.getPoint(t, target);

  if (portrait) {
    // A tall viewport sees less width, so sit back a little and stay centred.
    const ease = (a, b) => { const x = Math.max(0, Math.min(1, (p - a) / (b - a))); return x * x * (3 - 2 * x); };
    position.y += 0.75 * (1 - ease(0, 0.3));
    position.z += 2.6 * ease(0.6, 0.95);
    // Stay centred in the narrow view, but keep turning toward the portrait so
    // it is not left clipped against the edge of a phone screen.
    position.x *= 0.45;
  }
}


/** Smoothstep helper shared by the fade ranges below. */
export const ramp = (p, a, b) => {
  const x = Math.max(0, Math.min(1, (p - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/**
 * Cross-fade windows for the photoreal plates. The exterior carries the opening,
 * the corridor plate holds the vanishing point while the camera is inside the
 * colonnade, and the ceremony plate takes over for the ritual.
 */
export const plateOpacity = {
  exterior: p => 1 - ramp(p, 0.15, 0.25),
  // The ceremony plate sits in front of the corridor plate, so it simply
  // dissolves over it; the corridor plate is then retired once hidden.
  corridor: p => ramp(p, 0.16, 0.26) * (1 - ramp(p, 0.78, 0.88)),
  ceremony: p => ramp(p, 0.7, 0.82),
};
