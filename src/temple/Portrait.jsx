import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const FRAME_HEIGHT = 1.34;
const BORDER = 0.075;

function GarlandPiece({ texture, width, position, rotation = 0 }) {
  return (
    <mesh position={position} rotation={[0, 0, rotation]} renderOrder={6}>
      <planeGeometry args={[width, width / 3]} />
      <meshBasicMaterial map={texture} transparent alphaTest={0.04} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

/**
 * A framed photograph beside the aisle. The DOM overlay is updated from the
 * projected frame corners, so hover, touch and keyboard interaction remain
 * crisp and accessible while the visual itself stays in the 3D scene.
 */
export default function Portrait({
  assets,
  progress,
  active = false,
  overlayRef,
  position = [-2.1, 0, 5.2],
  rotation = 0.55,
  restScale = 1,
}) {
  const group = useRef();
  const lamp = useRef();
  const wasActive = useRef(false);
  const activeDistance = useRef(5);
  const { camera, size } = useThree();
  const direction = useMemo(() => new THREE.Vector3(), []);
  const up = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  const rest = useMemo(() => new THREE.Vector3(...position), [position]);
  const aspect = useMemo(() => {
    const image = assets.portrait?.image;
    return image ? image.width / image.height : 0.736;
  }, [assets.portrait]);
  const width = FRAME_HEIGHT * aspect;
  const frameCentreY = 0.81 + FRAME_HEIGHT / 2 + BORDER;

  const project = (local, element, name) => {
    point.copy(local);
    group.current.localToWorld(point);
    point.project(camera);
    const x = (point.x * 0.5 + 0.5) * size.width;
    const y = (-point.y * 0.5 + 0.5) * size.height;
    element.style.setProperty(`--${name}-x`, `${x}px`);
    element.style.setProperty(`--${name}-y`, `${y}px`);
    return { x, y };
  };

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    const lambda = 7.2;
    if (active && !wasActive.current) {
      activeDistance.current = THREE.MathUtils.clamp(camera.position.distanceTo(group.current.position), 3.8, 5.5);
    }
    wasActive.current = active;
    if (active) {
      camera.getWorldDirection(direction);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      target.copy(camera.position).addScaledVector(direction, activeDistance.current).addScaledVector(up, -1.15);
      group.current.position.x = THREE.MathUtils.damp(group.current.position.x, target.x, lambda, delta);
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, target.y, lambda, delta);
      group.current.position.z = THREE.MathUtils.damp(group.current.position.z, target.z, lambda, delta);
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, 0, lambda, delta);
    } else {
      group.current.position.x = THREE.MathUtils.damp(group.current.position.x, rest.x, lambda, delta);
      group.current.position.y = THREE.MathUtils.damp(group.current.position.y, rest.y, lambda, delta);
      group.current.position.z = THREE.MathUtils.damp(group.current.position.z, rest.z, lambda, delta);
      group.current.rotation.y = THREE.MathUtils.damp(group.current.rotation.y, rotation, lambda, delta);
    }
    const scale = active ? restScale * 1.15 : restScale;
    const nextScale = THREE.MathUtils.damp(group.current.scale.x, scale, lambda, delta);
    group.current.scale.setScalar(nextScale);
    group.current.updateWorldMatrix(true, false);

    if (lamp.current) lamp.current.intensity = 1.35 + Math.sin(clock.elapsedTime * 6.2) * 0.16;

    const overlay = overlayRef?.current;
    if (!overlay) return;
    const p = progress.current;
    const visible = p >= 0.22 && p <= 0.575;
    group.current.visible = p >= 0.18 && p <= 0.59;
    overlay.dataset.visible = visible ? 'true' : 'false';
    if (!visible) return;

    const lowerLeft = project(new THREE.Vector3(-0.72, 0, 0.12), overlay, 'portrait-left-bottom');
    const upperRight = project(new THREE.Vector3(0.72, 2.34, 0.12), overlay, 'portrait-right-top');
    const left = Math.min(lowerLeft.x, upperRight.x);
    const right = Math.max(lowerLeft.x, upperRight.x);
    const top = Math.min(lowerLeft.y, upperRight.y);
    const bottom = Math.max(lowerLeft.y, upperRight.y);
    overlay.style.setProperty('--portrait-left', `${left}px`);
    overlay.style.setProperty('--portrait-top', `${top}px`);
    overlay.style.setProperty('--portrait-width', `${right - left}px`);
    overlay.style.setProperty('--portrait-height', `${bottom - top}px`);

    const imagePoint = (u, v) => new THREE.Vector3((u - 0.5) * width, frameCentreY + (0.5 - v) * FRAME_HEIGHT, 0.14);
    project(imagePoint(0.34, 0.28), overlay, 'nandhini');
    project(imagePoint(0.66, 0.25), overlay, 'mohan');
  });

  return (
    <group ref={group} position={position} rotation={[0, rotation, 0]} scale={restScale}>
      <mesh position={[0, 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.35, 0.32, 0.9]} />
        <meshStandardMaterial {...assets.granite} color="#c2b19a" roughness={1} metalness={1} normalScale={new THREE.Vector2(0.8, 0.8)} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.05, 0.38, 0.66]} />
        <meshStandardMaterial {...assets.granite} color="#c2b19a" roughness={1} metalness={1} normalScale={new THREE.Vector2(0.8, 0.8)} />
      </mesh>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.3, 0.12, 0.86]} />
        <meshStandardMaterial color="#cdbca4" roughness={1} metalness={1} />
      </mesh>

      <group position={[0, frameCentreY, 0.03]}>
        <mesh castShadow>
          <boxGeometry args={[width + BORDER * 2, FRAME_HEIGHT + BORDER * 2, 0.06]} />
          <meshStandardMaterial color="#b98234" roughness={0.46} metalness={0.88} />
        </mesh>
        <mesh position={[0, 0, 0.035]}>
          <planeGeometry args={[width, FRAME_HEIGHT]} />
          <meshBasicMaterial map={assets.portrait} toneMapped={false} />
        </mesh>
        <GarlandPiece texture={assets.garland} width={width + 0.08} position={[0, FRAME_HEIGHT / 2 + 0.08, 0.085]} />
        <GarlandPiece texture={assets.garland} width={0.66} position={[-width / 2 - 0.035, FRAME_HEIGHT / 2 - 0.22, 0.08]} rotation={Math.PI / 2} />
        <GarlandPiece texture={assets.garland} width={0.66} position={[width / 2 + 0.035, FRAME_HEIGHT / 2 - 0.22, 0.08]} rotation={Math.PI / 2} />
      </group>

      <mesh position={[0.62, 0.83, 0.26]}>
        <cylinderGeometry args={[0.07, 0.11, 0.1, 12]} />
        <meshStandardMaterial color="#c8953f" roughness={0.4} metalness={1} />
      </mesh>
      <mesh position={[0.62, 0.94, 0.26]} scale={[1, 2.1, 1]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#ffc463" toneMapped={false} />
      </mesh>
      <pointLight ref={lamp} position={[0.5, 1.27, 0.75]} color="#ffb264" intensity={1.35} distance={3.2} decay={2} />
    </group>
  );
}
