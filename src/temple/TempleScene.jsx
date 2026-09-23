import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { sampleJourney, plateOpacity } from './cameraPath';
import { plates } from './plates';
import { useAssets, resetAssets } from './useAssets';
import { COVER_Z } from './projection';
import Corridor from './Corridor';
import Plate from './Plate';
import Portrait from './Portrait';
import { Fire, Petals, Dust } from './Atmosphere';

/**
 * Quality tiers. A phone gets the same composition and the same photoreal
 * corridor, with costly extras (additional lights, particles, and a finer
 * projection mesh) traded away rather than the look.
 */
function qualityFor(width, height) {
  const portrait = width < height;
  const small = Math.min(width, height) < 700;
  return {
    portrait,
    fullLighting: !small,
    corridorColumns: small ? 140 : 240,
    corridorRows: small ? 80 : 136,
    petals: small ? 40 : 90,
    dust: small ? 90 : 220,
    dpr: small ? 1.3 : 1.65,
  };
}

/** Drives the camera from scroll progress and reports frame statistics back. */
function CameraRig({ targetProgress, progress, onProgress, quality }) {
  const point = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const { camera } = useThree();
  const count = useRef(0);
  const timing = useRef({ frames: 0, time: 0 });

  useFrame((state, delta) => {
    if (delta < 0.5) { timing.current.frames++; timing.current.time += delta; }
    const target = targetProgress.current;
    progress.current = THREE.MathUtils.damp(progress.current, target, 9, Math.min(delta, 0.05));
    if (Math.abs(progress.current - target) < 0.0001) progress.current = target;

    sampleJourney(progress.current, point, look, quality.portrait);
    camera.position.copy(point);
    camera.lookAt(look);

    const fov = quality.portrait ? 68 : 54;
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }

    if (++count.current % 3 === 0) {
      onProgress(progress.current, {
        fps: timing.current.frames / Math.max(0.01, timing.current.time),
        drawCalls: state.gl.info.render.calls,
        triangles: state.gl.info.render.triangles,
      });
    }
    state.gl.info.reset();
  });
  return null;
}

function Scene({ targetProgress, onProgress, onReady, quality, portraitActive, portraitOverlayRef }) {
  const { gl, scene } = useThree();
  const assets = useAssets(gl);
  const progress = useRef(targetProgress.current);

  useEffect(() => {
    scene.environment = assets.envMap;
    scene.environmentIntensity = 0.55;
    onReady();
  }, [assets, scene, onReady]);

  return (
    <>
      {/* Low-key, like the render: the dark is real dark, and what light there
          is comes from the flames and the golden glow at the end of the aisle. */}
      <color attach="background" args={['#24150f']} />
      <fog attach="fog" args={['#2a1a10', 14, 42]} />
      <ambientLight intensity={0.16} color="#ffd9b0" />
      <hemisphereLight args={['#ffe2bf', '#2a1a10', 0.3]} />
      {/* The pavilion's glow, rimming everything that hangs in the aisle from behind. */}
      <pointLight position={[0, 4, COVER_Z - 26]} color="#ffc47a" intensity={170} distance={44} decay={2} />

      <Corridor assets={assets} progress={progress} quality={quality} />
      {/* Beside the aisle between the near lamps; a phone's narrow frame needs it nearer the centre line. */}
      <Portrait
        assets={assets}
        progress={progress}
        active={portraitActive}
        overlayRef={portraitOverlayRef}
        position={quality.portrait ? [-0.72, 0, 4.8] : [-1.9, 0, 4.2]}
        rotation={0.55}
        restScale={quality.portrait ? 0.68 : 1}
      />
      {plates.map(plate => (
        <Plate key={plate.name} plate={plate} assets={assets} opacity={plateOpacity[plate.name]} progress={progress} />
      ))}
      {/* The homa fire burns in the foreground of the ceremony, between the couple. */}
      <Fire position={[0, 0.05, -13.3]} progress={progress} scale={0.9} />
      <Petals count={quality.petals} />
      <Dust count={quality.dust} />

      <CameraRig targetProgress={targetProgress} progress={progress} onProgress={onProgress} quality={quality} />
    </>
  );
}

export default function TempleScene({ targetProgress, onProgress, onReady, onFailure, active, portraitActive, portraitOverlayRef }) {
  const cleanup = useRef(() => {});
  const quality = useMemo(() => qualityFor(window.innerWidth, window.innerHeight), []);
  useEffect(() => () => { cleanup.current(); resetAssets(); }, []);

  return (
    <Canvas
      shadows={false}
      dpr={[1, quality.dpr]}
      camera={{ position: [0, 3.3, 20], fov: quality.portrait ? 68 : 54, near: 0.1, far: 130 }}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        // The photographic plates are already colour graded. Keeping the
        // renderer neutral preserves their source pixels and facial detail.
        gl.toneMapping = THREE.NoToneMapping;
        // The camera rig samples and resets these counters once per frame so
        // the visual checks report stable scene metrics.
        gl.info.autoReset = false;
        const lost = event => { event.preventDefault(); onFailure(); };
        gl.domElement.addEventListener('webglcontextlost', lost);
        cleanup.current = () => gl.domElement.removeEventListener('webglcontextlost', lost);
      }}
      fallback={null}
    >
      <Suspense fallback={null}>
        <Scene targetProgress={targetProgress} onProgress={onProgress} onReady={onReady} quality={quality} portraitActive={portraitActive} portraitOverlayRef={portraitOverlayRef} />
      </Suspense>
    </Canvas>
  );
}
