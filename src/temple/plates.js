/**
 * Photoreal plate configuration.
 *
 * Each plate is one of the rendered images split into depth layers by
 * scripts/build-assets.mjs. The `far` layer is always the complete, unmasked
 * frame, so a nearer layer sliding across it can never expose a hole.
 *
 * `z` is the layer's world position; `coverZ` is the camera position at which
 * the layers should exactly fill the frame. Everything else is derived, so a
 * plate stays correctly framed at any field of view or aspect ratio.
 */
const base = import.meta.env?.BASE_URL ?? "/";
const plate = (name, id) => `${base}assets/plates/${name}-${id}.webp`;

export const ASPECT = 1672 / 941;

export const plates = [
  {
    // Drawn last of the three: it sits nearest the camera.
    name: 'exterior',
    order: -10,
    // Nothing stands behind the opening shot, so this plate must always fill
    // the frame, on a phone as much as on a desktop.
    cover: true,
    coverZ: 20,
    layers: [
      { id: 'far', url: plate('exterior', 'far'), z: -15 },
      { id: 'near', url: plate('exterior', 'near'), z: -1 },
    ],
  },
  {
    // Furthest back, so the ceremony plate cleanly occludes it as it arrives.
    name: 'corridor',
    order: -30,
    coverZ: -24,
    portraitMargin: 3.1,
    layers: [
      { id: 'far', url: plate('corridor', 'far'), z: -54 },
      { id: 'near', url: plate('corridor', 'near'), z: -52 },
    ],
  },
  {
    // coverZ is the FARTHEST camera position at which this plate is visible, so
    // it always fills the frame; any closer and the camera simply pushes in.
    // The colonnade frames this plate all the way to the final stop, so it only
    // has to fill the opening between the last pillars. The centre is dropped so
    // the couple's faces land in the upper middle of the shot as the camera
    // pushes in, rather than rising out of frame.
    name: 'ceremony',
    order: -20,
    coverZ: -34,
    y: -3.5,
    // On a phone the caption occupies the lower third, so the couple are lifted
    // into the upper middle of the frame.
    yPortrait: 1.6,
    portraitMargin: 2.45,
    layers: [
      { id: 'far', url: plate('ceremony', 'far'), z: -51.5 },
      // There is deliberately no mid layer. The couple appear in the far layer
      // already, so a second layer carrying them too separates into a visible
      // double image as the camera pushes in. Only the foreground pillars, which
      // appear nowhere else, are split out.
      { id: 'near', url: plate('ceremony', 'near'), z: -47.5 },
    ],
  },
];

export const textures = {
  graniteDiff: `${base}assets/pbr/granite-diff.webp`,
  graniteNor: `${base}assets/pbr/granite-nor.webp`,
  graniteArm: `${base}assets/pbr/granite-arm.webp`,
  marbleDiff: `${base}assets/pbr/marble-diff.webp`,
  marbleNor: `${base}assets/pbr/marble-nor.webp`,
  marbleArm: `${base}assets/pbr/marble-arm.webp`,
  portrait: `${base}assets/couple/mohan-nandhini.webp`,
};

export const environmentMap = `${base}assets/env/temple-env.hdr`;
