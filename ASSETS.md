# Assets and the temple journey

## What the three routes are

| Route | What it is | WebGL |
| --- | --- | --- |
| `/traditional` | The 3D temple journey: one continuous camera move from the courtyard to the sacred fire, driven by scroll. | yes |
| `/wedding` | The original scroll-parallax invitation, preserved unchanged. | no |
| `/modern` | The Museum of Us image gallery. | no |

`/` and any unknown URL redirect to `/wedding`.

All three carry the same RSVP form, and all three write to one Google Sheet —
see [rsvp/README.md](rsvp/README.md) for the five-minute setup. Until it is
configured the form reports that it saved nothing rather than pretending.

## How the temple journey is built

It is a **hybrid**, not a fully modelled temple, and that is deliberate.

Far from the camera, where modelling would only produce a worse version of
something we already have, the frame is carried by the rendered images
themselves. Near the camera, the things a photograph cannot do are real
geometry or world-space photographic cards: flames that burn, a generated
jasmine strip and brass lamps that hang in the aisle and slide past, the red
carpet, a calibrated kolam decal, the couple's interactive framed portrait,
petals and dust, and the sacred fire.

This is ordinary film set extension. It is why the couple look photographic:
they *are* photographic. Nothing tries to reproduce them in geometry.

### The corridor: a picture the camera walks into

The corridor render is a one-point perspective, so `src/temple/projection.js`
unfolds it into a box: a floor, a ceiling, two walls and a back wall that meet
at the picture's vanishing point. Every pixel is cast along its own ray from
the eye that took the picture and lands on whichever face that ray hits first.
Seen from that eye (the **cover pose**, `COVER_Z`) the box *is* the photograph;
move the eye forward and each face slides at its own rate, which is real
parallax on real photographic detail. This is the "tour into the picture"
technique (Horry, Anjyo and Arai, 1997).

Objects that stand on the floor in front of the pillars, the lamps and the
urli bowls, would be smeared across the floor and wall by that unfolding, so
they are declared as **cards**: vertical planes at the depth of their base.
A card's depth is feathered into its surroundings so its edge warps rather
than tears.

Every measurement the unfolding depends on (horizon, doorway, eye height,
pillar spacing, cards) lives in `REFERENCE` in that file, in image fractions,
and was read off `assets-src/temple-corridor.png`. Change the render and
those numbers change with it.

Two rules are load-bearing, and `scripts/journey.test.mjs` enforces them:

- **Every vertex stays on its ray.** Whatever depth a vertex is given, it must
  reproject exactly onto its own pixel from the cover eye, or the picture
  would drift from the render the moment the camera arrives.
- **No frame corner ever sees past the open front.** The box is open where the
  camera enters, and from the cover pose that opening coincides with the frame
  exactly. Any move backwards, or any turn before enough forward travel, would
  show the void. The test walks the camera path on desktop, ultrawide and
  phone and fires the frame's four corner rays into the box.

The walk is short on purpose, about six metres, because a photograph only has
so much detail: the near walls would stretch past reading as stone if the
camera went much further. The ceremony plate dissolves over the far end
before that point.

The corridor eye is low, at the height the render was taken from, and tilted
up by the render's own small angle; the camera rises to a standing eye for the
ceremony as the corridor dissolves.

### Flames on painted lamps

`LANDMARKS` lists the pixel of every lamp in the render. Each is cast onto the
box in the same way, so a live, flickering flame (`Flame` in
`src/temple/Atmosphere.jsx`) sits exactly where the render put its lamp and
the picture's lamps burn instead of merely glowing.

### The plates

`scripts/build-assets.mjs` splits the exterior and ceremony renders into
layers using purely geometric feathered masks — never a colour-keyed matte, so
there is no edge to fringe. The `far` layer of every plate is the complete,
unmasked frame, which means a nearer layer sliding across it can never expose
a hole. The corridor render is written out whole, uncut, for the projection.

Two rules are load-bearing here too, and the same test file enforces them:

- **All layers of one plate share a margin.** Apparent size is
  `height / distance`, and height is proportional to `distance × margin`, so a
  shared margin is what makes the layers register exactly at `coverZ`. Vary it
  per layer and the same couple appears at two slightly different sizes.
- **A plate must never still be visible once the camera has reached it**,
  or the camera flies through the photograph.

Plates are drawn without a depth test. The corridor box's floor runs on under
the ceremony plate, and the exterior plate hangs inside the box, so a plate
has to paint over whatever it covers outright; render order decides which is
in front.

The ceremony plate has **no mid layer on purpose**. The couple already appear in
its far layer; a second layer carrying them too separates into a visible double
image as the camera pushes in. Only the foreground pillars, which appear nowhere
else, are split out.

`coverZ` is the camera position where a plate reproduces the source framing.
The ceremony now finishes exactly at that pose, so it never enlarges a
1672×941 source into a soft close-up.

On a phone the corridor box covers the tall frame by height, so a phone sees a
central slice of the render, exactly as `object-fit: cover` would; the
ceremony plate is sized by **width** instead, because forcing a 16:9 image to
cover a 9:19.5 screen slices the couple down both sides. The exterior plate is
marked `cover`, because at the opening there is no architecture behind it to
hide a gap.

## Where the assets come from

| Asset | Source | Licence |
| --- | --- | --- |
| `assets-src/temple-*.png`, `museum-gallery.png`, `couple-turnaround.png` | AI-generated renders supplied with the project | project-owned |
| `assets-src/banana-plant.png`, `standing-kuthuvilakku.png`, `garland-strip.png`, `kolam.png`, `carved-pillar-face.png` | Generated for this project with OpenAI image generation, using `temple-corridor.png` as the lighting/style reference | project-owned |
| `assets-src/couple-photo.jpeg` | Photograph of Mohan and Nandhini | private, see below |
| `assets-src/mohanwedding.mp3` | The couple's own track, 320kbps master | project-owned |
| `public/assets/pbr/granite-*` | Poly Haven `granite_tile_03`, on the portrait's plinth | CC0 |
| `public/assets/pbr/marble-*` | Poly Haven `marble_01` (no longer loaded; kept for the pipeline) | CC0 |
| `public/assets/env/temple-env.hdr` | Poly Haven `afrikaans_church_interior` | CC0 |
| `public/assets/models/brass_diya_lantern/` | Poly Haven `brass_diya_lantern`, textures shrunk to 512px | CC0 |
| `assets-src/models/banana-plant.glb` | [3DAssets.dev banana plant](https://3dassets.dev/assets/botanical-glasshouse-and-palm-house-botanical-glasshou-68a0811e), 1,644 triangles | CC0 1.0 |
| `assets-src/models/standing-brass-lamp-source.glb` | [3DAssets.dev Indian shrine lamp column](https://3dassets.dev/assets/indian-bazaar-street-and-temple-lamp-column-25a2244c), 1,396 triangles | CC0 1.0 |
| `assets-src/models/standing-brass-lamp.glb` | Project-built exact five-tier kuthuvilakku with 40 emissive flames; reproducible with `npm run build-lamp-model`, 9,112 triangles | project-owned |
| `assets-src/models/carved-temple-pillar.glb` | [3DAssets.dev carved square temple column](https://3dassets.dev/assets/jungle-temple-and-stone-city-square-column-73398d46), 4,172 triangles; generic carved-temple fallback, not South Indian hero art | CC0 1.0 |

Poly Haven assets are CC0 and require no attribution; they are credited here as
a courtesy and so the sources can be re-fetched.

The three production GLBs are self-contained, use no decoder and are far below
the 30k-triangle budget. They remain bundled for future scenes, but none is
loaded in the current corridor. Flat banana, standing-lamp and full-width
garland cards were also removed because they duplicated the photograph and
looked pasted on when the camera passed them. The corridor now relies on its
own photographic detail, live flames, two hanging CC0 lamps, the carpet and
kolam. The generated garland is used only on the portrait frame.

The generated transparent PNGs are never served directly. `build-assets`
re-encodes them to alpha WebP under `public/assets/dressing/`; the garland is
expanded to 4096 px wide and the kolam to 2048 px square during that step.

**`assets-src/` is never served.** The originals are 13MB of PNG. The pipeline
writes web-sized WebP into `public/assets/`, which cut the built site from 21MB
to roughly 8MB.

### The photograph

`assets-src/couple-photo.jpeg` is a real photograph of the couple. It was
previously excluded by `.gitignore`; it is now committed and a cropped copy is
served at `public/assets/couple/mohan-nandhini.webp`, appearing in the journey
as a garlanded portrait beside the aisle. Publishing it was an explicit
decision. If the repository is public, the full-resolution original is
downloadable from it — remove `assets-src/couple-photo.jpeg` from version
control if only the cropped, served copy should be public.

## Music

The couple's track loops under all three invitations, controlled by the speaker
button in the header. Nothing is downloaded until a guest actually asks for
sound, so the audio is free for everyone who never presses it.

The 320kbps master is re-encoded to two web versions by `npm run build-audio`:
Ogg Opus at 72kbps (1.4MB) for browsers that support it, and MP3 at 112kbps
(2.1MB) as the Safari fallback — down from 6.1MB. The track has no silence at
either end, so it loops tightly; `scripts/visual-check.mjs` asserts that it
actually wraps rather than stopping, on both codecs.

The shell that owns the player sits *above* the router, so switching invitation
does not restart the music, reset the language, or re-download anything. If the
browser refuses to play, the control falls back to showing itself as muted
rather than claiming to be playing.

## Commands

```
npm run dev            # develop
npm run build          # production build
npm run build-assets   # regenerate every derived asset (needs network on first run)
npm run build-audio    # re-encode the music from the master in assets-src/
npm test               # camera-path and plate invariants
npm run visual-check   # full browser suite against a running preview
npm run shoot          # screenshot every chapter: npm run shoot -- <url> [mobile]
```

`build-assets` runs its image work inside headless Chrome, because this project
has no ImageMagick, sharp or PIL available, and Chrome encodes WebP with alpha
natively. Poly Haven downloads are cached in `.asset-cache/` (git-ignored), so
the pipeline is reproducible from a clean checkout but only hits the network
once.

## Performance

Measured in headless Chrome via `npm run visual-check` in the interactive
portrait chapter:

| Viewport | Draw calls | Triangles | FPS |
| --- | --- | --- | --- |
| 1440×900 | 46 | ~157k | ~57 |
| 390×844 | 40 | ~71k | ~56 |

Inside the corridor the projection mesh is a single draw call. The portrait
garland adds three small alpha planes. Runtime depth of field and fullscreen
post-processing were removed because the source plates already contain their
own depth and colour grade; this also keeps the temple, trees and couple at the
source image's native clarity. A phone retains the same photographic scene
with a coarser projection mesh, fewer flame lights and fewer particles.

The journey degrades in three steps: reduced-motion and no-WebGL visitors get a
static three-panel version, and a lost WebGL context falls back to it at
runtime. All three paths are covered by the browser suite.
