import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeStoneMaterial } from './stone';

/**
 * The built colonnade: everything the camera passes close enough to read as
 * real geometry. Distant detail is carried by the photoreal plates instead, so
 * nothing here tries to reproduce what a photograph already gives us — there is
 * deliberately no modelled gopuram, because the exterior plate has a far better
 * one.
 *
 * The whole group stays hidden until the exterior plate has taken over the
 * frame, so it can never be seen standing in front of the photograph.
 */

const GOLD = '#c8953f';

/** Batches same-material boxes into a single instanced draw call. */
function Boxes({ items, material }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const euler = new THREE.Euler();
    items.forEach((item, i) => {
      euler.set(item.rx || 0, item.ry || 0, item.rz || 0);
      quaternion.setFromEuler(euler);
      matrix.compose(new THREE.Vector3(...item.p), quaternion, new THREE.Vector3(...item.s));
      ref.current.setMatrixAt(i, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow receiveShadow>
      <boxGeometry />
      <primitive object={material} attach="material" />
    </instancedMesh>
  );
}

function Spheres({ items, radius, children, segments = 6 }) {
  const ref = useRef();
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    items.forEach((p, i) => { matrix.makeTranslation(p[0], p[1], p[2]); ref.current.setMatrixAt(i, matrix); });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <sphereGeometry args={[radius, segments, Math.max(4, segments - 1)]} />
      {children}
    </instancedMesh>
  );
}

/** Jasmine buds, strung tight, with roses and leaves worked in. */
function FlowerRope({ points, scale = 1 }) {
  const { white, red, green } = useMemo(() => {
    const white = [], red = [], green = [];
    points.forEach((p, i) => {
      white.push(p);
      if (i % 7 === 3) red.push([p[0], p[1] - 0.045 * scale, p[2] + 0.035 * scale]);
      if (i % 7 === 6) green.push([p[0], p[1] - 0.04 * scale, p[2] - 0.03 * scale]);
    });
    return { white, red, green };
  }, [points, scale]);
  return (
    <group>
      <Spheres items={white} radius={0.048 * scale}>
        <meshStandardMaterial color="#efe4cd" roughness={0.88} metalness={0} />
      </Spheres>
      <Spheres items={red} radius={0.062 * scale}>
        <meshStandardMaterial color="#9d1f2a" roughness={0.68} metalness={0} />
      </Spheres>
      <Spheres items={green} radius={0.056 * scale}>
        <meshStandardMaterial color="#3d5733" roughness={0.8} metalness={0} />
      </Spheres>
    </group>
  );
}

/** A swag hung between two pillars, sagging under its own weight. */
function Swag({ span, sag, position, count }) {
  const points = useMemo(() => Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return [(t - 0.5) * span, -Math.sin(t * Math.PI) * sag, 0];
  }), [span, sag, count]);
  return <group position={position}><FlowerRope points={points} /></group>;
}

/** A vertical rope hung down the face of a pillar. */
function Hanging({ position, height, count }) {
  const points = useMemo(() => Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return [0, -t * height, Math.sin(t * 5) * 0.012];
  }), [height, count]);
  return <group position={position}><FlowerRope points={points} /></group>;
}

// A standing kuthuvilakku: broad foot, slender stem, small oil bowl with a beak.
const LAMP_PROFILE = [
  [0, 0], [0.3, 0], [0.31, 0.045], [0.17, 0.1], [0.075, 0.17], [0.055, 0.5],
  [0.1, 0.56], [0.055, 0.62], [0.05, 1.0], [0.09, 1.04], [0.17, 1.11],
  [0.175, 1.15], [0.07, 1.18], [0, 1.18],
];

function Lamps({ quality }) {
  const ref = useRef();
  const items = useMemo(() => {
    const list = [];
    for (let z = -8; z > -44; z -= 5.5) for (const x of [-2.75, 2.75]) list.push([x, 0, z]);
    return list;
  }, []);
  const profile = useMemo(() => LAMP_PROFILE.map(p => new THREE.Vector2(...p)), []);
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4();
    items.forEach((p, i) => { matrix.makeTranslation(p[0], p[1], p[2]); ref.current.setMatrixAt(i, matrix); });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items]);
  return (
    <group>
      <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow receiveShadow>
        <latheGeometry args={[profile, 20]} />
        <meshStandardMaterial color={GOLD} roughness={0.28} metalness={1} />
      </instancedMesh>
      {items.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 1.27, 0]} scale={[1, 2.2, 1]}>
            <sphereGeometry args={[0.036, 8, 8]} />
            <meshBasicMaterial color="#ffc978" toneMapped={false} />
          </mesh>
          {i % quality.lampLightEvery === 0 && (
            <pointLight position={[0, 1.4, 0]} color="#ffae5c" intensity={7} distance={8} decay={2} />
          )}
        </group>
      ))}
    </group>
  );
}

export default function Architecture({ assets, progress, quality }) {
  const group = useRef();

  const materials = useMemo(() => ({
    // ~2m stone courses on the masonry, finer on the floor.
    granite: makeStoneMaterial({ ...assets.granite, scale: 0.42, color: '#c4b49c', envMapIntensity: 0.9 }),
    floor: makeStoneMaterial({ ...assets.marble, scale: 0.34, color: '#b9a88e', roughness: 0.32, envMapIntensity: 1.6 }),
    gold: new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.34, metalness: 1 }),
    step: makeStoneMaterial({ ...assets.granite, scale: 0.5, color: '#6f5a44', roughness: 0.8, envMapIntensity: 0.6 }),
  }), [assets]);

  useEffect(() => () => Object.values(materials).forEach(m => m.dispose()), [materials]);

  // Hidden until the exterior plate covers the frame, so the reveal is unseen.
  useFrame(() => { if (group.current) group.current.visible = progress.current > 0.1; });

  const masonry = useMemo(() => {
    const stone = [], gold = [], dark = [];
    const add = (list, p, s, r = {}) => list.push({ p, s, ...r });

    // Side walls and the roof over the colonnade.
    for (const x of [-9.2, 9.2]) {
      add(dark, [x, 3.9, -26], [0.9, 7.8, 46]);
      add(stone, [x, 1.05, -26], [1.25, 0.34, 46]);
      add(stone, [x, 6.9, -26], [1.35, 0.44, 46]);
      // Pilaster strips break up the wall between each bay.
      for (let z = -6; z >= -45; z -= 2.75) {
        add(stone, [x - Math.sign(x) * 0.42, 3.9, z], [0.22, 7.2, 0.5]);
      }
    }
    for (let z = -7; z > -49; z -= 5.5) add(stone, [0, 7.1, z], [18.6, 0.5, 4.5]);

    // Carved pillars: stepped base, fluted shaft, flaring corbel bracket.
    for (let z = -6; z >= -45; z -= 5.5) {
      for (const x of [-3.9, 3.9, -7.1, 7.1]) {
        const outer = Math.abs(x) > 5;
        const k = outer ? 0.86 : 1;
        add(stone, [x, 0.22, z], [1.55 * k, 0.44, 1.55 * k]);
        add(stone, [x, 0.52, z], [1.3 * k, 0.2, 1.3 * k]);
        add(stone, [x, 0.85, z], [1.06 * k, 0.5, 1.06 * k]);
        add(stone, [x, 3.15, z], [0.76 * k, 4.3, 0.76 * k]);
        for (const side of [-1, 1]) {
          add(stone, [x + side * 0.41 * k, 3.15, z], [0.11, 3.8, 0.55 * k]);
          add(stone, [x, 3.15, z + side * 0.41 * k], [0.55 * k, 3.8, 0.11]);
        }
        for (const y of [1.3, 1.58, 4.7, 5.02]) add(stone, [x, y, z], [1.0 * k, 0.14, 1.0 * k]);
        add(stone, [x, 5.42, z], [1.2 * k, 0.42, 1.2 * k]);
        add(stone, [x, 5.78, z], [1.62 * k, 0.34, 1.0 * k]);
        add(stone, [x, 6.08, z], [1.95 * k, 0.28, 1.15 * k]);
      }
      add(stone, [0, 6.45, z], [19, 0.5, 0.95]);
      add(gold, [0, 6.16, z], [7.6, 0.06, 0.14]);
    }

    // The step up to the mandapam, where the built set hands over to the plate.
    add(dark, [0, 0.11, -45.5], [12.5, 0.22, 1.5]);
    add(dark, [0, 0.3, -46.4], [11.5, 0.22, 1.2]);

    return { stone, gold, dark };
  }, []);

  const swags = useMemo(() => {
    const list = [];
    for (let z = -6; z > -45; z -= 5.5) list.push(z);
    return list;
  }, []);

  return (
    <group ref={group} visible={false}>
      {/* Polished floor. It stops at the mandapam step, so the ceremony plate
          carries the ground from there on and no seam crosses the frame. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -8]} receiveShadow>
        <planeGeometry args={[19, 76]} />
        <primitive object={materials.floor} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, -24.5]} receiveShadow>
        <planeGeometry args={[4.4, 45]} />
        <meshStandardMaterial color="#6d1a1f" roughness={0.9} metalness={0} />
      </mesh>

      <Boxes items={masonry.stone} material={materials.granite} />
      <Boxes items={masonry.gold} material={materials.gold} />
      <Boxes items={masonry.dark} material={materials.step} />

      <Lamps quality={quality} />

      {swags.map(z => (
        <group key={z}>
          <Swag span={7.4} sag={0.9} position={[0, 6.1, z]} count={quality.garlandBeads} />
          <Hanging position={[-3.85, 5.72, z + 0.46]} height={3.1} count={Math.round(quality.garlandBeads * 0.45)} />
          <Hanging position={[3.85, 5.72, z + 0.46]} height={3.1} count={Math.round(quality.garlandBeads * 0.45)} />
        </group>
      ))}

      {/* The homa kunda the fire burns in, just in front of the mandapam step. */}
      <group position={[0, 0, -43]}>
        <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.15, 0.26, 1.15]} />
          <meshStandardMaterial color="#4a3526" roughness={0.94} metalness={0} />
        </mesh>
        <mesh position={[0, 0.27, 0]} receiveShadow>
          <boxGeometry args={[0.92, 0.05, 0.92]} />
          <meshStandardMaterial color="#1d120c" roughness={0.95} metalness={0} />
        </mesh>
        {[-1, 1].map(s => (
          <React.Fragment key={s}>
            <mesh position={[s * 0.53, 0.32, 0]}><boxGeometry args={[0.1, 0.15, 1.24]} /><meshStandardMaterial color={GOLD} roughness={0.34} metalness={1} /></mesh>
            <mesh position={[0, 0.32, s * 0.53]}><boxGeometry args={[1.24, 0.15, 0.1]} /><meshStandardMaterial color={GOLD} roughness={0.34} metalness={1} /></mesh>
          </React.Fragment>
        ))}
      </group>
    </group>
  );
}
