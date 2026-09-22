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

Near the camera — the colonnade, the floor, the lamps, the garlands, the fire,
the framed portrait — is real geometry with real PBR materials and image-based
lighting. Far from the camera, where modelling would only produce a worse
version of something we already have, the frame is carried by the rendered
images themselves, hung in the world as depth-separated planes so that the
camera dollying past them produces genuine parallax.

This is ordinary film set extension. It is why the couple look photographic:
they *are* photographic. Nothing tries to reproduce them in geometry.

### The plates

`scripts/build-assets.mjs` splits each source render into layers using purely
geometric feathered masks — never a colour-keyed matte, so there is no edge to
fringe. The `far` layer of every plate is the complete, unmasked frame, which
means a nearer layer sliding across it can never expose a hole.

Two rules are load-bearing, and `scripts/journey.test.mjs` enforces them:

- **All layers of one plate share a margin.** Apparent size is
  `height / distance`, and height is proportional to `distance × margin`, so a
  shared margin is what makes the layers register exactly at `coverZ`. Vary it
  per layer and the same couple appears at two slightly different sizes.
- **A plate must never still be visible once the camera has reached it**,
  or the camera flies through the photograph.

The ceremony plate has **no mid layer on purpose**. The couple already appear in
its far layer; a second layer carrying them too separates into a visible double
image as the camera pushes in. Only the foreground pillars, which appear nowhere
else, are split out.

`coverZ` is the furthest camera position at which a plate is visible. Beyond
that the camera simply pushes in. The colonnade extends past the camera's final
stop so the last pair of pillars frames the couple, which means the plate only
has to fill the opening rather than the whole frame.

On a phone, plates are sized by **width**, not height. Forcing a 16:9 image to
cover a 9:19.5 screen shows barely a quarter of its width and slices the couple
down both sides. The exterior plate is the exception — it is marked `cover`,
because at the opening there is no architecture behind it to hide a gap.

### Stone

`src/temple/stone.js` projects textures from the three world axes instead of
using the mesh's own UVs. The colonnade is instanced boxes at wildly different
sizes, and a box carries UVs of 0..1 per face, so an ordinary material squeezes
a whole texture onto a thin moulding and stretches it along a tall shaft. That
single artefact is what makes procedural architecture read as stacked planks.
Triplanar projection makes the grain the same real-world size everywhere.

## Where the assets come from

| Asset | Source | Licence |
| --- | --- | --- |
| `assets-src/temple-*.png`, `museum-gallery.png`, `couple-turnaround.png` | AI-generated renders supplied with the project | project-owned |
| `assets-src/couple-photo.jpeg` | Photograph of Mohan and Nandhini | private, see below |
| `assets-src/mohanwedding.mp3` | The couple's own track, 320kbps master | project-owned |
| `public/assets/pbr/granite-*` | Poly Haven `granite_tile_03` | CC0 |
| `public/assets/pbr/marble-*` | Poly Haven `marble_01` | CC0 |
| `public/assets/env/temple-env.hdr` | Poly Haven `afrikaans_church_interior` | CC0 |

Poly Haven assets are CC0 and require no attribution; they are credited here as
a courtesy and so the sources can be re-fetched.

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

Measured in headless Chrome via `npm run visual-check`:

| Viewport | Draw calls | Triangles | FPS |
| --- | --- | --- | --- |
| 1440×1000 | 74 | ~40k | ~58 |
| 390×844 | 53 | ~21k | ~58 |

A phone gets the same composition and the same photoreal plates; shadow maps,
depth of field, half the lamp lights and most of the particles are traded away
instead of the look. `gl.info.autoReset` is disabled because every
post-processing pass resets the render stats, which would otherwise report only
the final fullscreen quad.

The journey degrades in three steps: reduced-motion and no-WebGL visitors get a
static three-panel version, and a lost WebGL context falls back to it at
runtime. All three paths are covered by the browser suite.
