/**
 * Offline asset pipeline for the temple journey.
 *
 * There is no ImageMagick, sharp or PIL on this machine, so every pixel
 * operation runs inside headless Chrome, which encodes WebP (with alpha)
 * natively. Run it once after changing a source render:
 *
 *   npm run build-assets
 *
 * Source images live in assets-src/ and are never served: they are 13MB of PNG.
 * Outputs land in public/assets/{plates,pbr,couple,generated,audio} and are
 * committed. The audio is encoded separately; see `npm run build-audio`.
 *
 * The parallax plates are cut with purely geometric feathered masks, never a
 * colour-keyed matte. The full image is always kept as the rearmost layer, so
 * a foreground layer can never expose a hole behind itself.
 */
import { chromium } from 'playwright-core';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => path.join(root, 'public', 'assets', ...p);
const src = (...p) => path.join(root, ...p);

/** Source renders, and the parallax layers cut from each. */
const PLATES = [
  {
    name: 'exterior',
    file: src('assets-src/temple-exterior.png'),
    width: 2048,
    layers: [
      // The whole frame, always rearmost: guarantees no hole can appear.
      { id: 'far', mask: null, quality: 0.82 },
      // The garland swag across the top and the carved pillars framing it.
      { id: 'near', quality: 0.86, mask: [
        { type: 'band', edge: 'top', size: 0.24, feather: 0.07 },
        { type: 'band', edge: 'left', size: 0.16, feather: 0.06 },
        { type: 'band', edge: 'right', size: 0.16, feather: 0.06 },
      ] },
    ],
  },
  {
    // Projected whole onto the corridor box (src/temple/projection.js), so it
    // has no cut layers: every pixel is placed by the projection instead.
    name: 'corridor',
    file: src('assets-src/temple-corridor.png'),
    width: 2048,
    layers: [{ id: 'far', mask: null, quality: 0.86 }],
  },
  {
    name: 'ceremony',
    file: src('assets-src/temple-ceremony.png'),
    width: 2048,
    layers: [
      { id: 'far', mask: null, quality: 0.84 },
      // The garlanded pillars down both edges of the frame.
      { id: 'near', quality: 0.86, mask: [
        { type: 'band', edge: 'left', size: 0.17, feather: 0.05 },
        { type: 'band', edge: 'right', size: 0.17, feather: 0.05 },
      ] },
    ],
  },
];

/**
 * PBR sets and the environment map, all CC0 from Poly Haven, recompressed for
 * the web. They are fetched into a local cache on first run so the pipeline is
 * reproducible on a clean checkout.
 */
const PH = 'https://dl.polyhaven.org/file/ph-assets';
const CACHE = path.join(root, '.asset-cache');

const TEXTURES = [
  { remote: `${PH}/Textures/jpg/1k/granite_tile_03/granite_tile_03_diff_1k.jpg`, to: out('pbr', 'granite-diff.webp'), size: 1024, quality: 0.8 },
  { remote: `${PH}/Textures/jpg/1k/granite_tile_03/granite_tile_03_nor_gl_1k.jpg`, to: out('pbr', 'granite-nor.webp'), size: 1024, quality: 0.86 },
  { remote: `${PH}/Textures/jpg/1k/granite_tile_03/granite_tile_03_arm_1k.jpg`, to: out('pbr', 'granite-arm.webp'), size: 512, quality: 0.8 },
  { remote: `${PH}/Textures/jpg/1k/marble_01/marble_01_diff_1k.jpg`, to: out('pbr', 'marble-diff.webp'), size: 1024, quality: 0.8 },
  { remote: `${PH}/Textures/jpg/1k/marble_01/marble_01_nor_gl_1k.jpg`, to: out('pbr', 'marble-nor.webp'), size: 1024, quality: 0.86 },
  { remote: `${PH}/Textures/jpg/1k/marble_01/marble_01_arm_1k.jpg`, to: out('pbr', 'marble-arm.webp'), size: 512, quality: 0.8 },
];

/** The HDRI is copied through untouched; three.js reads Radiance .hdr directly. */
const ENVIRONMENT = {
  remote: `${PH}/HDRIs/hdr/1k/afrikaans_church_interior_1k.hdr`,
  to: out('env', 'temple-env.hdr'),
};

/**
 * CC0 props from Poly Haven, served as glTF with their textures shrunk to
 * web size. Only the hanging brass lamp is used: it is the one temple object
 * the catalogue has. There is no carved pillar, standing lamp or banana plant
 * there, which is why the corridor is a projected photograph and not a model.
 */
const MODELS = [
  {
    name: 'brass_diya_lantern',
    gltf: `${PH}/Models/gltf/1k/brass_diya_lantern/brass_diya_lantern_1k.gltf`,
    bin: `${PH}/Models/gltf/8k/brass_diya_lantern/brass_diya_lantern.bin`,
    textures: ['diff', 'nor_gl', 'arm'].map(kind => `${PH}/Models/jpg/1k/brass_diya_lantern/brass_diya_lantern_${kind}_1k.jpg`),
    size: 512,
    quality: 0.86,
  },
];

/** Fetches a remote asset once and caches it under .asset-cache/. */
const cached = async (remote) => {
  const file = path.join(CACHE, path.basename(remote));
  try {
    await readFile(file);
    return file;
  } catch {
    await mkdir(CACHE, { recursive: true });
    const response = await fetch(remote);
    if (!response.ok) throw new Error(`${response.status} fetching ${remote}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
    console.log(`fetched ${path.basename(remote)}`);
    return file;
  }
};

/**
 * The real photograph, cropped to the couple and resized. This is a plain
 * rectangular crop shown inside a frame — no silhouette is cut out, so there
 * is no matte to fringe.
 */
const PORTRAIT = {
  from: src('assets-src/couple-photo.jpeg'),
  to: out('couple', 'mohan-nandhini.webp'),
  crop: { x: 0.1, y: 0.12, w: 0.84, h: 0.76 },
  width: 900,
  quality: 0.86,
};

/**
 * Web copies of the source renders, used by the /wedding and /modern routes and
 * by the temple journey's poster and no-WebGL fallbacks. Shipping the original
 * PNGs instead costs 13MB.
 */
const FLATS = ['temple-exterior', 'temple-corridor', 'temple-ceremony', 'couple-turnaround', 'museum-gallery']
  .map(name => ({ from: src('assets-src', `${name}.png`), to: out('generated', `${name}.webp`), width: 1600, quality: 0.84 }));

/** Transparent generated dressing, kept separate from the photographic plates. */
const SPRITES = [
  { name: 'banana-plant', width: 1024, quality: 0.88 },
  { name: 'standing-kuthuvilakku', width: 1024, quality: 0.9 },
  { name: 'garland-strip', width: 4096, quality: 0.88 },
  { name: 'kolam', width: 2048, quality: 0.9 },
  { name: 'carved-pillar-face', width: 1024, quality: 0.88 },
].map(asset => ({
  ...asset,
  from: src('assets-src', `${asset.name}.png`),
  to: out('dressing', `${asset.name}.webp`),
}));

/** Licence-checked, self-contained CC0 GLBs kept in assets-src/models. */
const LOCAL_MODELS = ['banana-plant', 'standing-brass-lamp', 'carved-temple-pillar']
  .map(name => ({ from: src('assets-src', 'models', `${name}.glb`), to: out('models', `${name}.glb`) }));

const dataUrl = async (file) => {
  const buffer = await readFile(file);
  const type = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${type};base64,${buffer.toString('base64')}`;
};

const write = async (target, base64) => {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(base64.split(',')[1], 'base64'));
};

/** Runs in the page: paints a feathered alpha mask, then multiplies it in. */
const pageHelpers = () => {
  window.loadImage = (url) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image decode failed'));
    image.src = url;
  });

  window.paintMask = (ctx, shapes, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    for (const shape of shapes) {
      if (shape.type === 'band') {
        const feather = shape.feather * (shape.edge === 'left' || shape.edge === 'right' ? w : h);
        const size = shape.size * (shape.edge === 'left' || shape.edge === 'right' ? w : h);
        let gradient;
        let rect;
        if (shape.edge === 'left') { gradient = ctx.createLinearGradient(0, 0, size + feather, 0); rect = [0, 0, size + feather, h]; }
        else if (shape.edge === 'right') { gradient = ctx.createLinearGradient(w, 0, w - size - feather, 0); rect = [w - size - feather, 0, size + feather, h]; }
        else if (shape.edge === 'top') { gradient = ctx.createLinearGradient(0, 0, 0, size + feather); rect = [0, 0, w, size + feather]; }
        else { gradient = ctx.createLinearGradient(0, h, 0, h - size - feather); rect = [0, h - size - feather, w, size + feather]; }
        const stop = size / (size + feather);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(stop, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(...rect);
      } else if (shape.type === 'ellipse') {
        const cx = shape.cx * w, cy = shape.cy * h, rx = shape.rx * w, ry = shape.ry * h;
        const inner = Math.max(0.01, 1 - shape.feather / Math.max(shape.rx, shape.ry));
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(inner, 'rgba(255,255,255,1)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
        ctx.translate(-cx, -cy);
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - Math.max(rx, ry), cy - Math.max(rx, ry), Math.max(rx, ry) * 2, Math.max(rx, ry) * 2);
        ctx.restore();
      }
    }
  };

  /** Mean linear-ish luminance and colour, used to grade the 3D set to the plate. */
  window.averageColor = (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, 64, 64);
    const { data } = ctx.getImageData(0, 0, 64, 64);
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
    const n = data.length / 4;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  };
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await browser.newPage();
await page.addInitScript(pageHelpers);
await page.goto('about:blank');
const manifest = { plates: {}, generatedAt: new Date().toISOString() };

try {
  for (const plate of PLATES) {
    const url = await dataUrl(plate.file);
    for (const layer of plate.layers) {
      const result = await page.evaluate(async ({ url, width, mask, quality }) => {
        const image = await window.loadImage(url);
        const scale = width / image.naturalWidth;
        const w = Math.round(image.naturalWidth * scale);
        const h = Math.round(image.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, w, h);
        if (mask) {
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = w; maskCanvas.height = h;
          window.paintMask(maskCanvas.getContext('2d'), mask, w, h);
          ctx.globalCompositeOperation = 'destination-in';
          ctx.drawImage(maskCanvas, 0, 0);
          ctx.globalCompositeOperation = 'source-over';
        }
        return {
          data: canvas.toDataURL('image/webp', quality),
          w, h,
          average: window.averageColor(image),
          aspect: image.naturalWidth / image.naturalHeight,
        };
      }, { url, width: plate.width, mask: layer.mask, quality: layer.quality });

      const file = `${plate.name}-${layer.id}.webp`;
      await write(out('plates', file), result.data);
      manifest.plates[plate.name] ??= { aspect: result.aspect, average: result.average, layers: [] };
      manifest.plates[plate.name].layers.push({ id: layer.id, file: `assets/plates/${file}` });
      const kb = Math.round(Buffer.from(result.data.split(',')[1], 'base64').length / 1024);
      console.log(`plate ${file.padEnd(24)} ${result.w}x${result.h} ${String(kb).padStart(5)}KB`);
    }
    console.log(`  ${plate.name} average colour rgb(${manifest.plates[plate.name].average.join(',')})`);
  }

  for (const texture of TEXTURES) {
    const url = await dataUrl(await cached(texture.remote));
    const data = await page.evaluate(async ({ url, size, quality }) => {
      const image = await window.loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, size, size);
      return canvas.toDataURL('image/webp', quality);
    }, { url, size: texture.size, quality: texture.quality });
    await write(texture.to, data);
    const kb = Math.round(Buffer.from(data.split(',')[1], 'base64').length / 1024);
    console.log(`pbr   ${path.basename(texture.to).padEnd(24)} ${texture.size}px ${String(kb).padStart(5)}KB`);
  }

  for (const flat of FLATS) {
    const url = await dataUrl(flat.from);
    const data = await page.evaluate(async ({ url, width, quality }) => {
      const image = await window.loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round(width * (image.naturalHeight / image.naturalWidth));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', quality);
    }, { url, width: flat.width, quality: flat.quality });
    await write(flat.to, data);
    const kb = Math.round(Buffer.from(data.split(',')[1], 'base64').length / 1024);
    console.log(`flat  ${path.basename(flat.to).padEnd(24)} ${flat.width}px ${String(kb).padStart(5)}KB`);
  }

  for (const sprite of SPRITES) {
    const url = await dataUrl(sprite.from);
    const result = await page.evaluate(async ({ url, width, quality }) => {
      const image = await window.loadImage(url);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round(width * (image.naturalHeight / image.naturalWidth));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      return { data: canvas.toDataURL('image/webp', quality), height: canvas.height };
    }, { url, width: sprite.width, quality: sprite.quality });
    await write(sprite.to, result.data);
    const kb = Math.round(Buffer.from(result.data.split(',')[1], 'base64').length / 1024);
    console.log(`dress ${path.basename(sprite.to).padEnd(24)} ${sprite.width}x${result.height} ${String(kb).padStart(5)}KB`);
  }

  {
    const url = await dataUrl(PORTRAIT.from);
    const data = await page.evaluate(async ({ url, crop, width, quality }) => {
      const image = await window.loadImage(url);
      const sx = crop.x * image.naturalWidth, sy = crop.y * image.naturalHeight;
      const sw = crop.w * image.naturalWidth, sh = crop.h * image.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round(width * (sh / sw));
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', quality);
    }, { url, crop: PORTRAIT.crop, width: PORTRAIT.width, quality: PORTRAIT.quality });
    await write(PORTRAIT.to, data);
    const kb = Math.round(Buffer.from(data.split(',')[1], 'base64').length / 1024);
    console.log(`photo ${path.basename(PORTRAIT.to).padEnd(24)} ${PORTRAIT.width}px ${String(kb).padStart(5)}KB`);
  }

  {
    const source = await cached(ENVIRONMENT.remote);
    await mkdir(path.dirname(ENVIRONMENT.to), { recursive: true });
    await writeFile(ENVIRONMENT.to, await readFile(source));
    const kb = Math.round((await readFile(ENVIRONMENT.to)).length / 1024);
    console.log(`env   ${path.basename(ENVIRONMENT.to).padEnd(24)} 1k     ${String(kb).padStart(5)}KB`);
  }

  for (const model of MODELS) {
    const folder = out('models', model.name);
    await mkdir(path.join(folder, 'textures'), { recursive: true });
    // The glTF and its binary are copied through; only the textures change.
    await writeFile(path.join(folder, `${model.name}.gltf`), await readFile(await cached(model.gltf)));
    await writeFile(path.join(folder, path.basename(model.bin)), await readFile(await cached(model.bin)));
    let total = 0;
    for (const remote of model.textures) {
      const url = await dataUrl(await cached(remote));
      const data = await page.evaluate(async ({ url, size, quality }) => {
        const image = await window.loadImage(url);
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/jpeg', quality);
      }, { url, size: model.size, quality: model.quality });
      await write(path.join(folder, 'textures', path.basename(remote)), data);
      total += Buffer.from(data.split(',')[1], 'base64').length;
    }
    const bin = (await readFile(path.join(folder, path.basename(model.bin)))).length;
    console.log(`model ${model.name.padEnd(24)} ${model.size}px ${String(Math.round((total + bin) / 1024)).padStart(5)}KB`);
  }

  for (const model of LOCAL_MODELS) {
    await mkdir(path.dirname(model.to), { recursive: true });
    const data = await readFile(model.from);
    await writeFile(model.to, data);
    console.log(`model ${path.basename(model.to).padEnd(24)} bundled ${String(Math.round(data.length / 1024)).padStart(5)}KB`);
  }

  await mkdir(out('plates'), { recursive: true });
  await writeFile(out('plates', 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nAsset pipeline complete.');
} finally {
  await browser.close();
}
