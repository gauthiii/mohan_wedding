import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ramp } from './cameraPath';

/**
 * Everything that moves: the homa fire burning in front of the ceremony plate,
 * its embers and smoke, jasmine petals drifting through the colonnade, and the
 * dust caught in the shafts of light. These are the cues that stop a still
 * photograph reading as a still photograph.
 */

const FLAME_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// A tapered, flickering flame. Two noise frequencies keep it from looping visibly.
const FLAME_FRAGMENT = `
varying vec2 vUv;
uniform float time;
void main() {
  float y = vUv.y;
  float sway = sin(y * 8.0 - time * 4.6) * 0.055 * y + sin(y * 17.0 - time * 7.3) * 0.022 * y;
  float x = vUv.x - 0.5 + sway;
  float width = (1.0 - y * 0.82) * (0.34 + 0.05 * sin(y * 23.0 - time * 9.0));
  float flame = 1.0 - smoothstep(width * 0.3, width, abs(x));
  float base = smoothstep(0.0, 0.12, y);
  float tip = 1.0 - smoothstep(0.78, 1.0, y);
  float core = 1.0 - smoothstep(0.0, width * 0.5, abs(x));
  vec3 colour = mix(vec3(0.95, 0.12, 0.0), vec3(1.0, 0.55, 0.06), flame * (1.0 - y * 0.55));
  colour = mix(colour, vec3(1.0, 0.85, 0.42), core * (1.0 - y) * 0.42);
  gl_FragColor = vec4(colour, flame * base * tip * 0.95);
}`;

export function Fire({ position = [0, 0, 0], progress }) {
  const flames = useRef(), embers = useRef(), smoke = useRef(), light = useRef(), group = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const uniforms = useMemo(() => [0, 1, 2, 3, 4].map(() => ({ time: { value: 0 } })), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // The fire only exists once the ceremony plate is on screen behind it.
    const reveal = ramp(progress.current, 0.6, 0.74);
    if (group.current) group.current.visible = reveal > 0.01;
    if (group.current) group.current.scale.setScalar(0.4 + reveal * 0.6);
    if (reveal <= 0.01) return;

    uniforms.forEach((u, i) => { u.time.value = t + i * 1.7; });
    flames.current?.children.forEach((mesh, i) => { mesh.scale.y = 0.94 + Math.sin(t * 5.1 + i * 2.1) * 0.09; });
    if (light.current) light.current.intensity = (16 + Math.sin(t * 7.4) * 2.6 + Math.sin(t * 13.1) * 1.2) * reveal;

    for (let i = 0; i < 26; i++) {
      const h = (t * 0.4 + i * 0.163) % 2.1;
      dummy.position.set(Math.sin(i * 13.1 + t * 0.4) * (0.08 + h * 0.19), h * 0.85 + 0.35, Math.cos(i * 7.3 + t * 0.2) * (0.07 + h * 0.14));
      dummy.scale.setScalar(0.016 * Math.max(0, 1 - h / 2.1));
      dummy.updateMatrix();
      embers.current.setMatrixAt(i, dummy.matrix);
    }
    embers.current.instanceMatrix.needsUpdate = true;

    smoke.current?.children.forEach((mesh, i) => {
      const h = (t * 0.19 + i * 0.28) % 1.8;
      mesh.position.set(Math.sin(h * 2.1 + i) * 0.16, h * 1.5 + 0.7, Math.cos(h * 1.4 + i) * 0.1);
      mesh.scale.setScalar(0.12 + h * 0.26);
      mesh.material.opacity = (1 - h / 1.8) * 0.03 * reveal;
    });
  });

  return (
    <group ref={group} position={position}>
      <pointLight ref={light} position={[0, 0.7, 0]} color="#ff9430" intensity={16} distance={11} decay={2} />
      <group ref={flames}>
        {[0, 1, 2, 3, 4].map(i => (
          <mesh key={i} position={[0, 0.62, 0]} rotation={[0, (i * Math.PI) / 5, 0]}>
            <planeGeometry args={[1.45, 2.0]} />
            <shaderMaterial
              transparent
              depthWrite={false}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
              uniforms={uniforms[i]}
              vertexShader={FLAME_VERTEX}
              fragmentShader={FLAME_FRAGMENT}
            />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={embers} args={[undefined, undefined, 26]}>
        <sphereGeometry args={[1, 6, 4]} />
        <meshBasicMaterial color="#ffd27d" toneMapped={false} />
      </instancedMesh>
      <group ref={smoke}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <mesh key={i}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color="#b8a48c" transparent opacity={0.03} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Jasmine and rose petals falling through the whole length of the colonnade. */
export function Petals({ count = 90 }) {
  const ref = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({
    x: (Math.random() - 0.5) * 14,
    z: -Math.random() * 50 + 2,
    speed: 0.32 + Math.random() * 0.4,
    phase: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 1.6,
    scale: 0.022 + Math.random() * 0.022,
    tint: Math.random(),
  })), [count]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    seeds.forEach((seed, i) => {
      const fall = (t * seed.speed + seed.phase) % 7;
      dummy.position.set(seed.x + Math.sin(t * 0.6 + seed.phase) * 0.5, 6.6 - fall, seed.z);
      dummy.rotation.set(t * seed.spin, t * seed.spin * 0.7, seed.phase);
      dummy.scale.setScalar(seed.scale);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <circleGeometry args={[1, 5]} />
      <meshStandardMaterial color="#e8d3cf" roughness={0.92} metalness={0} side={THREE.DoubleSide} envMapIntensity={0.25} />
    </instancedMesh>
  );
}

/** Dust motes hanging in the light shafts between the roof panels. */
export function Dust({ count = 220 }) {
  const ref = useRef();
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 1] = Math.random() * 6 + 0.4;
      positions[i * 3 + 2] = -Math.random() * 46 + 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.04) * 0.02;
  });
  return (
    <points ref={ref} geometry={geometry} frustumCulled={false}>
      <pointsMaterial size={0.026} color="#ffdfa8" transparent opacity={0.34} sizeAttenuation depthWrite={false} toneMapped={false} />
    </points>
  );
}
