import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { plates, textures, environmentMap } from './plates';

/**
 * A tiny suspense-friendly cache. Everything the scene needs is loaded once,
 * in parallel, and the promise is thrown until it settles, so <Suspense> shows
 * the poster frame rather than a half-dressed temple.
 */
let entry = null;

const loadTexture = (url, colorSpace) => new Promise((resolve, reject) => {
  new THREE.TextureLoader().load(url, texture => {
    if (colorSpace) texture.colorSpace = colorSpace;
    texture.anisotropy = 8;
    resolve(texture);
  }, undefined, () => reject(new Error(`failed to load ${url}`)));
});

const tiled = (texture, repeat) => {
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat[0], repeat[1]);
  return texture;
};

async function loadAll(renderer) {
  const plateUrls = plates.flatMap(p => p.layers.map(l => l.url));
  const [
    plateTextures,
    graniteDiff, graniteNor, graniteArm,
    marbleDiff, marbleNor, marbleArm,
    portrait,
    environment,
  ] = await Promise.all([
    Promise.all(plateUrls.map(url => loadTexture(url, THREE.SRGBColorSpace))),
    loadTexture(textures.graniteDiff, THREE.SRGBColorSpace),
    loadTexture(textures.graniteNor),
    loadTexture(textures.graniteArm),
    loadTexture(textures.marbleDiff, THREE.SRGBColorSpace),
    loadTexture(textures.marbleNor),
    loadTexture(textures.marbleArm),
    loadTexture(textures.portrait, THREE.SRGBColorSpace),
    new Promise((resolve, reject) => new RGBELoader().load(environmentMap, resolve, undefined, () => reject(new Error('failed to load environment map')))),
  ]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(environment).texture;
  environment.dispose();
  pmrem.dispose();

  const byUrl = new Map(plateUrls.map((url, i) => [url, plateTextures[i]]));

  return {
    plate: url => byUrl.get(url),
    envMap,
    granite: {
      map: tiled(graniteDiff, [1, 1]),
      normalMap: tiled(graniteNor, [1, 1]),
      armMap: tiled(graniteArm, [1, 1]),
    },
    marble: {
      map: tiled(marbleDiff, [14, 42]),
      normalMap: tiled(marbleNor, [14, 42]),
      armMap: tiled(marbleArm, [14, 42]),
    },
    portrait,
    dispose() {
      byUrl.forEach(t => t.dispose());
      [graniteDiff, graniteNor, graniteArm, marbleDiff, marbleNor, marbleArm, portrait].forEach(t => t.dispose());
      envMap.dispose();
    },
  };
}

/** Throws a promise on first call so React suspends until assets are ready. */
export function useAssets(renderer) {
  if (!entry) {
    entry = { status: 'pending' };
    entry.promise = loadAll(renderer).then(
      value => { entry.status = 'done'; entry.value = value; },
      error => { entry.status = 'error'; entry.error = error; },
    );
  }
  if (entry.status === 'pending') throw entry.promise;
  if (entry.status === 'error') throw entry.error;
  return entry.value;
}

/** Lets a remount after WebGL context loss rebuild everything from scratch. */
export function resetAssets() {
  entry?.value?.dispose?.();
  entry = null;
}
