import { CatmullRomCurve3, Vector3 } from 'three';
import { COVER_Z, REFERENCE } from './projection.js';

/**
 * One continuous camera move, from the courtyard outside the gopuram to the
 * sacred fire. Measured in metres, travelling down -Z with the aisle clear.
 *
 * The world is laid out as:
 *   z = +20 .. +11  approach and threshold, framed by the exterior plate
 *   z = +11         the cover pose: the corridor box reproduces its photograph
 *   z = +11 .. +5   the walk down the corridor, inside the projected picture
 *   z =  +5 .. -3.3 the mandapam and the ceremony plate behind it
 *
 * The corridor eye is low, at the height the photograph was taken from, and
 * tilted up by the same small angle. The camera then rises to a standing eye
 * for the ceremony as the corridor dissolves behind it.
 */
const EYE = REFERENCE.eyeHeight;
// tan of the corridor's upward tilt for the desktop frame; see corridorFrame().
const TILT = 0.0638;

const stops = [0, 0.15, 0.26, 0.42, 0.56, 0.74, 0.9, 1];
const positions = [
  [0, 3.3, 20],
  [0, EYE, COVER_Z],
  [0, EYE, 10.1],
  [0.3, EYE, 8.5],
  [0.1, EYE + 0.05, 7],
  [0, 1.3, 6.2],
  [0, 1.7, -2.6],
  [0, 1.7, -3.3],
];
const targets = [
  [0, 3.6, 0],
  [0, EYE + TILT * 20, COVER_Z - 20],
  [0, EYE + TILT * 20, 10.1 - 20],
  [-0.9, EYE + TILT * 12, 8.5 - 12],
  [-0.7, EYE + 0.35, 7 - 10],
  [0, 1.5, -14],
  [0, 1.8, -17],
  [0, 1.78, -18.5],
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
    // A tall viewport sees less width: sit back a little at the mandapam,
    // stay near the centre line, and turn further toward the portrait so it
    // is not left clipped against the edge of a phone screen.
    position.z += 1.4 * ramp(p, 0.6, 0.95);
    position.x *= 0.45;
    target.x *= 1.6;
  }
}

export const ramp = (p, a, b) => {
  const x = Math.max(0, Math.min(1, (p - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/**
 * Cross-fade windows for the photoreal plates. The exterior carries the
 * opening and dissolves to reveal the corridor box, which is opaque the whole
 * way down the aisle; the ceremony plate then dissolves over the far end of
 * the corridor, and the box is retired once it is hidden.
 */
export const plateOpacity = {
  exterior: p => 1 - ramp(p, 0.155, 0.18),
  ceremony: p => ramp(p, 0.735, 0.775),
};

/** The corridor box is simply hidden once the ceremony plate covers it. */
export const corridorOpacity = p => 1 - ramp(p, 0.775, 0.795);

/** Distance travelled after entering the projected corridor, used by tests. */
export const CORRIDOR_TRAVEL = COVER_Z - positions.at(-1)[2];
