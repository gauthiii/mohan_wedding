import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildCorridorGeometry, surfacePoint, LANDMARKS, COVER_Z } from './projection';
import { corridorOpacity, ramp } from './cameraPath';
import { Flame } from './Atmosphere';

/**
 * The corridor: the rendered photograph unfolded into a box the camera walks
 * into (see projection.js), dressed with the things a photograph cannot do.
 *
 * Live flames burn on every painted lamp, placed by casting the lamp's pixel
 * onto the box so they sit exactly where the render put them. In front of the
 * picture hang a thick flower garland and two brass lamps on chains, and the
 * red carpet runs up the aisle: these are the real objects the camera passes,
 * whose parallax against the picture is what makes the walk read as a walk.
 *
 * The decorations are held back until the exterior plate has dissolved, so
 * that nothing drawn over the box can show through the opening shot.
 */

const GOLD = '#c8953f';

/** A hanging brass lamp from the Poly Haven model, on a chain from the beams. */
function Lantern({ model, position, ceiling, scale = 4, phase = 0 }) {
  const swing = useRef();
  const scene = useMemo(() => {
    const clone = model.clone(true);
    clone.traverse(node => { if (node.isMesh) { node.frustumCulled = false; } });
    return clone;
  }, [model]);
  const chain = ceiling - (position[1] + 0.38 * scale);
  useFrame(({ clock }) => {
    if (swing.current) swing.current.rotation.z = Math.sin(clock.elapsedTime * 0.7 + phase) * 0.012;
  });
  return (
    <group position={[position[0], ceiling, position[2]]}>
      <group ref={swing}>
        <mesh position={[0, -chain / 2, 0]}>
          <cylinderGeometry args={[0.014, 0.014, chain, 6]} />
          <meshStandardMaterial color="#5a4a30" roughness={0.5} metalness={1} />
        </mesh>
        <group position={[0, -ceiling + position[1], 0]}>
          <primitive object={scene} scale={scale} />
          <Flame position={[0.03 * scale, 0.12 * scale, 0]} size={0.13} light={{ color: '#ffb063', intensity: 2.4, distance: 5 }} />
        </group>
      </group>
    </group>
  );
}

export default function Corridor({ assets, progress, quality }) {
  const { size } = useThree();
  const group = useRef(), decorations = useRef(), material = useRef(), kolamMaterial = useRef();
  const portrait = size.width < size.height;
  const fov = portrait ? 68 : 54;
  const aspect = size.width / size.height;

  const { geometry, frame, box } = useMemo(
    () => buildCorridorGeometry({ fov, aspect, columns: quality.corridorColumns, rows: quality.corridorRows }),
    [fov, aspect, quality],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  // Every painted flame, cast onto the box so it lands on its own pixel.
  const flames = useMemo(() => {
    const at = ([u, v]) => surfacePoint(u, v, frame, box).toArray();
    return {
      near: LANDMARKS.nearLampFlames.map(at),
      mid: LANDMARKS.midLampFlames.map(at),
      hanging: LANDMARKS.hangingLampFlames.map(at),
      bowls: LANDMARKS.bowlFlames.map(at),
      diyas: LANDMARKS.floorDiyas.slice(0, 4).map(at),
    };
  }, [frame, box]);

  const reveal = useRef(0);
  useFrame(() => {
    const p = progress.current;
    const opacity = corridorOpacity(p);
    if (group.current) group.current.visible = opacity > 0.002;
    if (material.current) material.current.opacity = opacity;
    // Decorations appear as the exterior plate dissolves.
    reveal.current = ramp(p, 0.16, 0.26);
    if (decorations.current) decorations.current.visible = reveal.current > 0.01;
    if (kolamMaterial.current) kolamMaterial.current.opacity = 1 - ramp(p, 0.27, 0.34);
  });

  const lamps = quality.fullLighting;
  const backZ = COVER_Z - box.depth;

  return (
    <group ref={group}>
      <mesh geometry={geometry} renderOrder={-40} frustumCulled={false}>
        <meshBasicMaterial ref={material} map={assets.corridor} toneMapped={false} transparent opacity={1} depthWrite side={THREE.DoubleSide} fog={false} />
      </mesh>

      <group ref={decorations} visible={false}>
        {/* The red carpet, laid from just past the kolam to the mandapam steps. */}
        <group position={[0, 0.012, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (7.25 + backZ) / 2]}>
            <planeGeometry args={[2.2, 7.25 - backZ]} />
            <meshStandardMaterial color="#7a1a20" roughness={0.88} metalness={0} envMapIntensity={0.15} />
          </mesh>
          {[-1, 1].map(s => (
            <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[s * 1.06, 0.002, (7.25 + backZ) / 2]}>
              <planeGeometry args={[0.065, 7.25 - backZ]} />
              <meshStandardMaterial color={GOLD} roughness={0.4} metalness={1} envMapIntensity={0.8} />
            </mesh>
          ))}
        </group>

        {/* A real floor decal keeps the foreground kolam crisp as its projected
            counterpart reaches the steepest part of the unfolded floor. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.024, 8.45]} renderOrder={3}>
          <planeGeometry args={[3.65, 3.65]} />
          <meshBasicMaterial ref={kolamMaterial} map={assets.kolam} transparent opacity={1} alphaTest={0.03} depthWrite={false} toneMapped={false} />
        </mesh>

        {/* Flames on the painted lamps. */}
        {flames.near.map((p, i) => <Flame key={`n${i}`} position={p} size={0.3} reveal={reveal} light={lamps || i === 0 ? { color: '#ffae5c', intensity: 9, distance: 8 } : null} phase={i * 2.1} />)}
        {flames.mid.map((p, i) => <Flame key={`m${i}`} position={p} size={0.24} reveal={reveal} light={lamps ? { color: '#ffae5c', intensity: 6, distance: 7 } : null} phase={i * 1.3 + 4} />)}
        {flames.hanging.map((p, i) => <Flame key={`h${i}`} position={p} size={0.22} reveal={reveal} phase={i * 0.7 + 2} />)}
        {flames.bowls.map((p, i) => <Flame key={`b${i}`} position={p} size={0.2} reveal={reveal} light={lamps ? { color: '#ffa858', intensity: 3, distance: 4 } : null} phase={i * 1.9 + 1} />)}
        {flames.diyas.map((p, i) => <Flame key={`d${i}`} position={[p[0], p[1] + 0.03, p[2]]} size={0.09} reveal={reveal} phase={i * 0.9} />)}

        {/* Two brass lamps still hang beneath the beams. */}
        {assets.lantern && [-1, 1].map(s => (
          <Lantern key={s} model={assets.lantern} position={[s * 2.35, 3.45, 0.2]} ceiling={6.6} scale={3.2} phase={s * 1.2} />
        ))}
      </group>
    </group>
  );
}
