# Holo Card Studio

**A holographic World Cup trading card you design in the browser — and export as a 10-second holo video.**

Live at **[wccard.xyz](https://wccard.xyz)**

---

## Origin

I built this in **two days** after seeing the new FIFA World Cup player cards — the refractor foils, the full-bleed portraits, the way light catches the slab. I wanted that feeling in something people could actually *make* themselves: upload a photo, pick a nation, dial in the foil, and walk away with a clip that looks like it came out of a pack.

This is a designer-led project. The engineering exists to serve the illusion — every layer, easing curve, and micro-copy choice is there so the card reads as a physical collectible, not a flat image with a filter on top.

---

## What you can do

1. Upload a portrait (background removed in-browser)
2. Enter your name and choose from all **48 World Cup 2026 nations**
3. Pick a **card style**, **foil shine**, and **finish** (gloss or matte)
4. Tilt the card with your cursor or phone gyro
5. Hit **Download** — the app renders a **10s holo animation** and saves it as video

No account. No app install. The whole thing runs in the browser.

---

## The card — what went into the design

The card is not a single image. It is a **stack of composited layers** — each with its own blend mode, mask, and motion — meant to reproduce how real chromium refractors behave under light.

### Layer architecture

| Layer | Role |
|-------|------|
| **Base & full art** | Team-tinted gradients, light leaks, and slow-drifting art plates behind the subject |
| **Facet emboss** | Style-specific refractor texture (cracked ice, starburst, honeycomb, or fine diamond grid) |
| **Holo + Holo²** | Dual foil passes — linear spectrum sweep + conic rainbow — masked through the facet pattern |
| **Photo backdrop** | Soft radial lift so cutouts don’t float on flat black |
| **Portrait** | Transparent PNG cutout with auto-fit sizing into the card’s safe zone |
| **Photo shine** | ~2% foil pass *on top of the subject* so the player catches the same light as the slab |
| **Art fade** | Bottom-weighted vignette so typography stays legible |
| **Sweep** | Animated specular band that glides across the surface on idle |
| **Glare** | Pointer-linked hotspot — moves with your cursor like a desk lamp |
| **Frame** | Gradient foil border (team colors) + inner recess shadow |

That’s **15+ visual layers** before you count blend modes, masks, and animations.

### Four refractor styles

Each style is a pair of custom assets — a **facet mask** (where light breaks) and an **emboss map** (surface relief):

- **Prizm** — cracked-ice shard geometry, the classic panini look
- **Optic** — single center starburst, full-card radial mask
- **Mosaic** — interlocking honeycomb hive, repeating micro pattern
- **Galaxy** — tight diamond grid with amplified holo intensity

### Five foil shines + two finishes

Shine controls the *color story* of the foil (rainbow, diamond, sapphire, emerald, ruby). Finish controls the *material*:

- **Gloss** — color-dodge foils, screen sweeps, high glare, saturated spectrum
- **Matte** — softened overlays, paper-grain noise, lower sweep opacity, muted hue shift

Each shine/finish pair maps to **14 tuned CSS variables** (opacity ranges, brightness curves, saturation multipliers, sweep weight) so combinations feel intentional, not like a global brightness slider.

### Team-aware everything

All 48 nations ship with:

- **Kit colors** (`c1`, `c2`, `accent`) that drive the card frame, foil tint, page backdrop, and buy-button hover state
- **Authentic cheer lines** in local language — *Vamos, Brasil!*, *Allez la France !*, *Heia Norge!*, etc.
- **Official-style crests** (self-hosted for reliable video capture)
- **Flags** in the country picker

When you change country, the **entire environment shifts** — blurred kit-color blobs drift behind the UI, and the card frame gradient re-tints to match.

### Motion & interaction

Things that are easy to miss:

- **Idle life** — the card gently floats, hue-shimmers, and pulses glow even when you’re not touching it
- **Pointer tilt** — `rotateX` / `rotateY` with eased return; foil gradients track `--mx`, `--my`, `--bgx`, `--bgy`, and `--hue` in real time
- **Device gyro** — on mobile, tilting your phone drives the same holo system
- **Active vs idle** — when you interact, idle animations stop and the pointer takes over (no fighting motion)
- **Registered CSS properties** — `--hue` and `--glow` are `@property` values so browsers can interpolate them smoothly

### Typography that survives the card

- **Saira Condensed** for the player name — dynamically **shrinks and wraps** to fit long names without clipping the art
- **Anton** for panel controls and the masthead
- **Instrument Serif** for subtle editorial moments
- Fonts are **self-hosted via `next/font`** so the video recorder can embed them — Google Fonts URLs would break capture and names would fall back to system fonts mid-render

### Portrait treatment

- **Client-side background removal** (ISNet via IMG.LY) with a custom polish pass: full-resolution compositing, hair-safe morphological erosion, background-color decontamination, and fringe cleanup
- **Alpha-aware auto-fit** — the cutout is measured by opaque pixels, scaled into a defined safe zone (below the header, above the name plate), and vertically centered with tuned offsets
- **Subject foil** — holo gradients composite over the player at low opacity so they feel *in* the slab, not pasted on top

---

## The website

### Layout & rhythm

- Single-screen **composer**: card preview left (or top on mobile), controls right
- Staggered **rise-in** entrance animation — masthead → card → panel → download
- Mobile reflow puts the card first, then controls, then download — you see your card before you configure it

### Control panel

Designed like a grading bench, not a settings form:

- **Upload photo** — primary action, Anton uppercase, panel-height field
- **Country picker** — searchable dropdown with flags, 48 teams alphabetically sorted
- **Style / Shine / Finish** — tactile chips with embossed corner details on style cards, circular swatches on shine, compact finish toggles
- **Hover affordances** — subtle pulse rings on interactive chips (respects `prefers-reduced-motion`)

### Background removal UX

- Thin **indeterminate progress bar** (no fake percentages)
- Rotating **collector-flavored copy** — *"Heating the foil press…"*, *"Arguing with the grading company…"*, *"Injecting +5 hype…"*
- Processing overlay sits on the card itself so you never lose context of what’s being built

### Download flow

- One button: **Download**
- Modal opens directly into **"Creating your holo video"** — no extra checkout step
- On success: inline video preview, re-download, copy share link, and platform shortcuts (X, Facebook, WhatsApp, Instagram with upload guidance)

### Mobile polish

- **Clip-path corner fix** for iOS Safari — `border-radius` alone fails when 3D transforms and scaled art layers are involved; the card uses explicit rounded clipping
- Flattened `translateZ` lifts on mobile so header/footer text doesn’t poke past rounded corners
- Gyro + touch tilt still work

---

## The video — cinematic capture

The exported clip is not a screen recording. It is a **frame-by-frame DOM capture** choreographed to feel like someone slowly tilting a slab under a light:

1. **Intro** — card fades in from a soft vignette, scale eases up
2. **Perimeter tour** — virtual hover point travels clockwise around the card edge along a rounded-rect path (with corner arcs, not naive linear interpolation)
3. **Hero hold** — settles on a flattering upper-third angle
4. **Outro** — gentle fade to black

Technical details:

- **10 seconds** at **30fps** (~300 frames)
- **2× supersampled** DOM capture via `modern-screenshot`
- **WebCodecs VP9** encoding when available, MediaRecorder fallback
- **Self-hosted fonts & crests** so nothing blocks cross-origin capture
- **Vignette + fade** painted per-frame for cinematic framing
- Custom cursor hidden during capture; recording layout expands with padding so tilt never clips

---

## Details people usually miss

- The **foil follows a facet mask** — rainbow light only appears *inside* the refractor geometry, not as a flat gradient overlay
- **Two holo layers** use different blend modes and drift at different rates
- **Matte finish** adds a paper-grain SVG turbulence pass across the entire card
- **Team backdrop** uses five overlapping radial blobs in kit colors, blurred 52px, drifting on a 22s loop
- **Selection highlight** on body text uses champagne tint (`::selection`)
- **Download button** picks up the active nation’s kit colors on hover, with a custom World Cup trophy cursor
- **Share URLs** encode card state (name, team, style, shine, finish) so links restore a design
- **48 crest PNGs** in `/public/crests` — England and Scotland use subnational FA codes (`gb-eng`, `gb-sct`)
- **Safe-zone math** for portraits is pixel-aware against the 336×470 card coordinate system, not guesswork CSS percentages

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, CSS Modules + global design tokens |
| Fonts | Geist, Anton, Saira Condensed, Instrument Serif |
| Background removal | `@imgly/background-removal` (ISNet), custom canvas polish |
| Video | `modern-screenshot`, WebCodecs + `webm-muxer`, MediaRecorder fallback |
| Deployment | Vercel · [wccard.xyz](https://wccard.xyz) |

