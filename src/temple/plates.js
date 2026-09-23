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
 *
 * The corridor is not a plate. It is projected onto a box the camera walks
 * into; see src/temple/projection.js.
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
    // The ceremony finishes at its cover pose, preserving the full source
    // composition instead of pushing into a low-resolution close-up.
    name: 'ceremony',
    order: -20,
    // The last camera station is the cover pose. This preserves the complete
    // source composition instead of enlarging the 1672px plate into a close-up.
    coverZ: -3.3,
    y: -1,
    // On a phone the caption occupies the lower third, so the couple are lifted
    // into the upper middle of the frame.
    yPortrait: 1.6,
    portraitMargin: 2.9,
    layers: [
      { id: 'far', url: plate('ceremony', 'far'), z: -20.8 },
      // There is deliberately no mid layer. The couple appear in the far layer
      // already, so a second layer carrying them too separates into a visible
      // double image as the camera pushes in. Only the foreground pillars, which
      // appear nowhere else, are split out.
      { id: 'near', url: plate('ceremony', 'near'), z: -16.8 },
    ],
  },
];

export const corridorImage = plate('corridor', 'far');

export const textures = {
  graniteDiff: `${base}assets/pbr/granite-diff.webp`,
  graniteNor: `${base}assets/pbr/granite-nor.webp`,
  graniteArm: `${base}assets/pbr/granite-arm.webp`,
  portrait: `${base}assets/couple/mohan-nandhini.webp`,
  garland: `${base}assets/dressing/garland-strip.webp`,
  kolam: `${base}assets/dressing/kolam.webp`,
  bananaSprite: `${base}assets/dressing/banana-plant.webp`,
  lampSprite: `${base}assets/dressing/standing-kuthuvilakku.webp`,
  pillarFace: `${base}assets/dressing/carved-pillar-face.webp`,
};

export const models = {
  lantern: `${base}assets/models/brass_diya_lantern/brass_diya_lantern.gltf`,
  banana: `${base}assets/models/banana-plant.glb`,
  standingLamp: `${base}assets/models/standing-brass-lamp.glb`,
  carvedPillar: `${base}assets/models/carved-temple-pillar.glb`,
};

export const environmentMap = `${base}assets/env/temple-env.hdr`;
