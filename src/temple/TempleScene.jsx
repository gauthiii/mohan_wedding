import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, DepthOfField, Vignette, Noise, ToneMapping } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { sampleJourney, plateOpacity } from './cameraPath';
import { plates } from './plates';
import { useAssets, resetAssets } from './useAssets';
import Architecture from './Architecture';
import Plate from './Plate';
import Portrait from './Portrait';
import { Fire, Petals, Dust } from './Atmosphere';

/**
 * Quality tiers. A phone gets the same composition and the same photoreal
 * plates, with the costly parts (shadow maps, depth of field, extra lights)
 * traded away rather than the look.
 */
function qualityFor(width, height) {
  const portrait = width < height;
  const small = Math.min(width, height) < 700;
  return {
    portrait,
    shadows: !small,
    dof: !small,
    lampLightEvery: small ? 6 : 3,
    garlandBeads: small ? 34 : 64,
    petals: small ? 40 : 90,
    dust: small ? 90 : 220,
    dpr: small ? 1.3 : 1.65,
  };
}

/** Drives the camera from scroll progress and reports frame statistics back. */
function CameraRig({ targetProgress, progress, onProgress, quality }) {
  const point = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const { camera, size } = useThree();
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

/**
 * Keeps the focal plane on whatever the camera is looking at, in world units.
 * The focus range is kept wide on purpose: this is a long lens looking down an
 * aisle, not a macro shot, and heavy bokeh reads as mush rather than depth.
 */
function Focus({ progress, dofRef }) {
  useFrame(() => {
    const material = dofRef.current?.circleOfConfusionMaterial;
    if (!material) return;
    const p = progress.current;
    // Metres ahead of the camera: the far end of the aisle early on, then the
    // couple once the ceremony plate is in frame.
    const distance = p < 0.6 ? 26 : THREE.MathUtils.lerp(26, 11, Math.min(1, (p - 0.6) / 0.32));
    material.worldFocusDistance = distance;
    material.worldFocusRange = distance * 0.85;
  });
  return null;
}

function Scene({ targetProgress, onProgress, onReady, quality }) {
  const { gl, scene } = useThree();
  const assets = useAssets(gl);
  const progress = useRef(targetProgress.current);
  const dofRef = useRef();

  useEffect(() => {
    scene.environment = assets.envMap;
    scene.environmentIntensity = 0.95;
    onReady();
  }, [assets, scene, onReady]);

  return (
    <>
      {/* Graded to the plates: rgb(153,107,71) outside warming to rgb(170,112,69)
          at the mandapam, so the built set and the photographs agree. */}
      <color attach="background" args={['#57402c']} />
      <fog attach="fog" args={['#7a5a3c', 20, 82]} />
      <ambientLight intensity={0.42} color="#ffdfb4" />
      <hemisphereLight args={['#fff0d2', '#6b503c', 0.85]} />
      <directionalLight
        position={[7, 17, 12]}
        intensity={3.1}
        color="#ffdcae"
        castShadow={quality.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16} shadow-camera-right={16}
        shadow-camera-top={16} shadow-camera-bottom={-16}
        shadow-camera-far={70}
        shadow-bias={-0.0012}
      />
      {/* Warm fill at the far end so the built colonnade meets the plate evenly. */}
      <pointLight position={[0, 4.2, -38]} color="#ffd6a6" intensity={48} distance={19} decay={2} />
      <pointLight position={[0, 4, -49]} color="#ffca94" intensity={38} distance={20} decay={2} />
      <pointLight position={[0, 3.4, -24]} color="#ffcf9a" intensity={30} distance={18} decay={2} />
      <pointLight position={[0, 3.4, -10]} color="#ffcf9a" intensity={26} distance={18} decay={2} />

      <Architecture assets={assets} progress={progress} quality={quality} />
      <Portrait assets={assets} />
      {plates.map(plate => (
        <Plate key={plate.name} plate={plate} assets={assets} opacity={plateOpacity[plate.name]} progress={progress} />
      ))}
      <Fire position={[0, 0.32, -43]} progress={progress} />
      <Petals count={quality.petals} />
      <Dust count={quality.dust} />

      <CameraRig targetProgress={targetProgress} progress={progress} onProgress={onProgress} quality={quality} />
      <Focus progress={progress} dofRef={dofRef} />

      <EffectComposer multisampling={quality.shadows ? 4 : 0} enableNormalPass={false}>
        <Bloom mipmapBlur intensity={0.72} luminanceThreshold={0.62} luminanceSmoothing={0.28} radius={0.72} />
        {quality.dof ? (
          <DepthOfField ref={dofRef} worldFocusDistance={26} worldFocusRange={22} bokehScale={1.5} height={480} />
        ) : <></>}
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.3} darkness={0.62} blendFunction={BlendFunction.NORMAL} />
        <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.1} />
      </EffectComposer>
    </>
  );
}

export default function TempleScene({ targetProgress, onProgress, onReady, onFailure, active }) {
  const cleanup = useRef(() => {});
  const quality = useMemo(() => qualityFor(window.innerWidth, window.innerHeight), []);
  useEffect(() => () => { cleanup.current(); resetAssets(); }, []);

  return (
    <Canvas
      shadows={quality.shadows ? { type: THREE.PCFSoftShadowMap } : false}
      dpr={[1, quality.dpr]}
      camera={{ position: [0, 3.3, 20], fov: quality.portrait ? 68 : 54, near: 0.1, far: 130 }}
      frameloop={active ? 'always' : 'never'}
      gl={{ antialias: false, powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping; // handled in the effect chain
        // Each composer pass resets render stats; accumulate them per frame so
        // the instrumentation the visual checks read stays meaningful.
        gl.info.autoReset = false;
        const lost = event => { event.preventDefault(); onFailure(); };
        gl.domElement.addEventListener('webglcontextlost', lost);
        cleanup.current = () => gl.domElement.removeEventListener('webglcontextlost', lost);
      }}
      fallback={null}
    >
      <Suspense fallback={null}>
        <Scene targetProgress={targetProgress} onProgress={onProgress} onReady={onReady} quality={quality} />
      </Suspense>
    </Canvas>
  );
}
