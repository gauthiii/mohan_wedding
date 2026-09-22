import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ASPECT } from './plates';

/**
 * A photoreal still, split into depth layers and hung in the world so the
 * camera dollying past it produces genuine parallax.
 *
 * Layers are drawn unlit and without tone mapping: these pixels are already a
 * finished, colour-graded photograph and must reach the screen unaltered.
 *
 * Sizing has two modes. A `cover` plate always fills the frame, which the
 * opening needs because there is no architecture behind it to hide a gap. Every
 * other plate is sized by width on a portrait screen: forcing a 16:9 image to
 * cover a 9:19.5 phone shows barely a quarter of its width and slices the
 * couple down both sides, so instead the image spans the phone comfortably and
 * the colonnade closes the frame above and below, as it already does on desktop.
 */
export default function Plate({ plate, assets, opacity, progress }) {
  const { size } = useThree();
  const group = useRef();
  const materials = useRef([]);

  // Every layer of a plate shares one margin. Apparent size is
  // height / distance, and height is proportional to distance * margin, so a
  // shared margin is what makes the layers register exactly at coverZ - vary it
  // per layer and the same couple appears at two slightly different sizes.
  const layers = useMemo(() => plate.layers.map((layer, index) => ({
    ...layer,
    distance: Math.abs(plate.coverZ - layer.z),
    renderOrder: (plate.order ?? -20) + index,
  })), [plate]);

  useFrame(() => {
    const value = opacity(progress.current);
    if (group.current) group.current.visible = value > 0.002;
    for (const material of materials.current) if (material) material.opacity = value;
  });

  const portrait = size.width < size.height;
  const fov = THREE.MathUtils.degToRad(portrait ? 68 : 54);
  const viewAspect = size.width / size.height;
  const margin = plate.margin ?? 1.32;
  const y = (portrait ? plate.yPortrait : undefined) ?? plate.y ?? 2;

  return (
    <group ref={group}>
      {layers.map((layer, index) => {
        const frameHeight = 2 * layer.distance * Math.tan(fov / 2);
        const frameWidth = frameHeight * viewAspect;
        const height = (plate.cover || !portrait)
          // Fill the frame: by height, widened when the viewport is wider than the image.
          ? Math.max(frameHeight, frameWidth / ASPECT) * margin
          // Span the narrow screen; the architecture closes the frame vertically.
          : (frameWidth / ASPECT) * (plate.portraitMargin ?? 2.1);
        const width = height * ASPECT;
        return (
          <mesh key={layer.id} position={[0, y, layer.z]} renderOrder={layer.renderOrder} frustumCulled={false}>
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial
              ref={el => { materials.current[index] = el; }}
              map={assets.plate(layer.url)}
              transparent
              opacity={0}
              depthWrite={false}
              toneMapped={false}
              side={THREE.FrontSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}
