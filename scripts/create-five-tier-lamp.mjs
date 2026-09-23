import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// GLTFExporter uses the browser FileReader API even when exporting an
// ArrayBuffer. This tiny Node equivalent keeps this asset recipe dependency-free.
globalThis.FileReader = class FileReader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(result => {
      this.result = result;
      this.onloadend?.();
    }, error => this.onerror?.(error));
  }
};

const transformed = (geometry, position, rotation = [0, 0, 0], scale = [1, 1, 1]) => {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
};

const brass = [];
const flames = [];
const cylinder = (rt, rb, h, y, segments = 24) => brass.push(transformed(new THREE.CylinderGeometry(rt, rb, h, segments), [0, y, 0]));

// Broad, stepped kuthuvilakku base and a turned central shaft.
cylinder(0.62, 0.72, 0.12, 0.06);
cylinder(0.5, 0.62, 0.13, 0.185);
cylinder(0.35, 0.5, 0.15, 0.325);
cylinder(0.19, 0.3, 0.22, 0.51);
cylinder(0.11, 0.14, 2.7, 1.75, 20);

const levels = [0.82, 1.22, 1.62, 2.02, 2.42];
for (const [levelIndex, y] of levels.entries()) {
  const radius = 0.39 - levelIndex * 0.018;
  cylinder(radius * 0.88, radius, 0.075, y);
  brass.push(transformed(new THREE.TorusGeometry(radius * 0.91, 0.035, 8, 24), [0, y + 0.025, 0], [Math.PI / 2, 0, 0]));
  cylinder(0.15, 0.11, 0.12, y + 0.095, 20);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    const x = Math.cos(angle) * radius * 0.78;
    const z = Math.sin(angle) * radius * 0.78;
    brass.push(transformed(new THREE.SphereGeometry(0.075, 8, 6), [x, y + 0.065, z], [0, -angle, 0], [1.35, 0.45, 0.8]));
    flames.push(transformed(new THREE.SphereGeometry(0.035, 7, 5), [x, y + 0.17, z], [0, 0, 0], [0.75, 1.8, 0.75]));
  }
}

// Lotus-like finial.
cylinder(0.18, 0.12, 0.18, 2.63, 20);
brass.push(transformed(new THREE.SphereGeometry(0.16, 16, 10), [0, 2.78, 0], [0, 0, 0], [1, 1.3, 1]));
brass.push(transformed(new THREE.ConeGeometry(0.1, 0.28, 20), [0, 3.02, 0]));

const scene = new THREE.Scene();
scene.name = 'five-tier-standing-kuthuvilakku';
scene.add(new THREE.Mesh(
  mergeGeometries(brass),
  new THREE.MeshStandardMaterial({ name: 'aged-brass', color: 0xb87818, metalness: 0.92, roughness: 0.24 }),
));
scene.add(new THREE.Mesh(
  mergeGeometries(flames),
  new THREE.MeshStandardMaterial({ name: 'lit-flames', color: 0xff9d28, emissive: 0xff5a00, emissiveIntensity: 5, roughness: 0.5 }),
));

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(scene, { binary: true, onlyVisible: true });
await writeFile(new URL('../assets-src/models/standing-brass-lamp.glb', import.meta.url), Buffer.from(result));
console.log(`wrote five-tier standing-brass-lamp.glb (${Math.round(result.byteLength / 1024)}KB)`);
