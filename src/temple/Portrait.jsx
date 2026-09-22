import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The real photograph of Mohan and Nandhini, shown the way it would be at the
 * wedding itself: a garlanded portrait on a carved stone plinth beside the
 * aisle, lit by its own lamp. The camera drifts past it between the two family
 * stones.
 *
 * It is a plain rectangular crop inside a frame, never a cut-out silhouette,
 * so there is no matte to fringe at close range.
 */
export default function Portrait({ assets, position = [-2.35, 0, -22], rotation = 0.4 }) {
  const lamp = useRef();
  const aspect = useMemo(() => {
    const image = assets.portrait?.image;
    return image ? image.width / image.height : 0.736;
  }, [assets.portrait]);

  const height = 1.34;
  const width = height * aspect;
  const border = 0.075;

  const garland = useMemo(() => {
    const beads = [], roses = [];
    const count = 46;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      // Drapes over the top corners and down both sides of the frame.
      const x = (t - 0.5) * (width + border * 2.6);
      const y = -Math.sin(t * Math.PI) * 0.26;
      beads.push([x, y, 0.06]);
      if (i % 6 === 3) roses.push([x, y - 0.06, 0.09]);
    }
    return { beads, roses };
  }, [width, border]);

  const instanced = useRef(), rosesRef = useRef();
  useFrame(({ clock }) => {
    if (lamp.current) lamp.current.intensity = 3.4 + Math.sin(clock.elapsedTime * 6.2) * 0.45;
  });

  const place = (ref, items) => {
    if (!ref.current) return;
    const matrix = new THREE.Matrix4();
    items.forEach((p, i) => { matrix.makeTranslation(p[0], p[1], p[2]); ref.current.setMatrixAt(i, matrix); });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  };

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Carved plinth */}
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.35, 0.32, 0.9]} />
        <meshStandardMaterial {...assets.granite} color="#c2b19a" roughness={1} metalness={1} normalScale={new THREE.Vector2(0.8, 0.8)} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.62, 0.66]} />
        <meshStandardMaterial {...assets.granite} color="#c2b19a" roughness={1} metalness={1} normalScale={new THREE.Vector2(0.8, 0.8)} />
      </mesh>
      <mesh position={[0, 0.98, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.12, 0.86]} />
        <meshStandardMaterial {...assets.granite} color="#cdbca4" roughness={1} metalness={1} />
      </mesh>

      {/* Brass frame, then the photograph itself */}
      <group position={[0, 1.04 + height / 2 + border, 0.03]}>
        <mesh castShadow>
          <boxGeometry args={[width + border * 2, height + border * 2, 0.06]} />
          <meshStandardMaterial color="#c8953f" roughness={0.3} metalness={1} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={assets.portrait} toneMapped={false} />
        </mesh>
        <group position={[0, height / 2 + border, 0]}>
          <instancedMesh ref={el => { instanced.current = el; place(instanced, garland.beads); }} args={[undefined, undefined, garland.beads.length]}>
            <sphereGeometry args={[0.055, 6, 5]} />
            <meshStandardMaterial color="#fdf6e3" roughness={0.72} metalness={0} />
          </instancedMesh>
          <instancedMesh ref={el => { rosesRef.current = el; place(rosesRef, garland.roses); }} args={[undefined, undefined, garland.roses.length]}>
            <sphereGeometry args={[0.062, 6, 5]} />
            <meshStandardMaterial color="#a8202c" roughness={0.6} metalness={0} />
          </instancedMesh>
        </group>
      </group>

      {/* A small lamp at the foot of the portrait, and its light on the photo */}
      <mesh position={[0.62, 1.06, 0.26]}>
        <cylinderGeometry args={[0.07, 0.11, 0.1, 12]} />
        <meshStandardMaterial color="#c8953f" roughness={0.3} metalness={1} />
      </mesh>
      <mesh position={[0.62, 1.17, 0.26]} scale={[1, 2.1, 1]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#ffc463" toneMapped={false} />
      </mesh>
      <pointLight ref={lamp} position={[0.5, 1.5, 0.75]} color="#ffb264" intensity={3.4} distance={4.5} decay={2} />
    </group>
  );
}
