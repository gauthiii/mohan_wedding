import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { plates, textures, models, corridorImage, environmentMap } from './plates';

/**
 * A tiny suspense-friendly cache. Everything the scene needs is loaded once,
 * in parallel, and the promise is thrown until it settles, so <Suspense> shows
 * the poster frame rather than a half-dressed temple.
 */
let entry = null;

const loadTexture = (url, colorSpace, anisotropy = 8) => new Promise((resolve, reject) => {
  new THREE.TextureLoader().load(url, texture => {
    if (colorSpace) texture.colorSpace = colorSpace;
    texture.anisotropy = anisotropy;
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
    corridor,
    graniteDiff, graniteNor, graniteArm,
    portrait,
    garland, kolam,
    environment,
    lantern,
  ] = await Promise.all([
    Promise.all(plateUrls.map(url => loadTexture(url, THREE.SRGBColorSpace, renderer.capabilities.getMaxAnisotropy()))),
    // The corridor is walked into, so its floor is seen at a grazing angle:
    // the highest anisotropy the hardware offers keeps the tiles crisp.
    loadTexture(corridorImage, THREE.SRGBColorSpace, renderer.capabilities.getMaxAnisotropy()),
    loadTexture(textures.graniteDiff, THREE.SRGBColorSpace),
    loadTexture(textures.graniteNor),
    loadTexture(textures.graniteArm),
    loadTexture(textures.portrait, THREE.SRGBColorSpace),
    loadTexture(textures.garland, THREE.SRGBColorSpace),
    loadTexture(textures.kolam, THREE.SRGBColorSpace, renderer.capabilities.getMaxAnisotropy()),
    new Promise((resolve, reject) => new RGBELoader().load(environmentMap, resolve, undefined, () => reject(new Error('failed to load environment map')))),
    new GLTFLoader().loadAsync(models.lantern).then(gltf => gltf.scene),
  ]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envMap = pmrem.fromEquirectangular(environment).texture;
  environment.dispose();
  pmrem.dispose();

  const byUrl = new Map(plateUrls.map((url, i) => [url, plateTextures[i]]));

  return {
    plate: url => byUrl.get(url),
    corridor,
    envMap,
    lantern,
    garland,
    kolam,
    granite: {
      map: tiled(graniteDiff, [1, 1]),
      normalMap: tiled(graniteNor, [1, 1]),
      armMap: tiled(graniteArm, [1, 1]),
    },
    portrait,
    dispose() {
      byUrl.forEach(t => t.dispose());
      [corridor, graniteDiff, graniteNor, graniteArm, portrait, garland, kolam].forEach(t => t.dispose());
      envMap.dispose();
      [lantern].forEach(model => {
        model.traverse(node => {
          if (!node.isMesh) return;
          node.geometry?.dispose();
          for (const m of [].concat(node.material)) {
            for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap']) m[key]?.dispose();
            m.dispose();
          }
        });
      });
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
