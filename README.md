# VYRO Athletics: home page

Static site: `index.html`, `css/styles.css`, `js/` and `assets/`. There is no build step.

## Run it

The WebGL layer loads images as textures, which browsers block on `file://`.
Serve the folder over HTTP instead:

```bash
npx serve .          # or: python3 -m http.server
```

## Swap in the real brand assets

Every image slot is optional. If a file is missing, the page shows a styled
stand-in, so you can add photos one at a time.

| File | Where it shows | Notes |
|---|---|---|
| `assets/logo/vyro-logo.svg` | Intro wipe, nav, hero, footer | **Placeholder.** Replace with the original brush-stroke logo, exported white on transparent and cropped tight. |
| `assets/photos/hero-01.jpg` … `hero-03.jpg` | Hero ambient sequence | Dark and cinematic, landscape, at least 2400px wide. |
| `assets/products/pump-cover-{black,navy,green,white}.png` | Pinned Drop 01 colorway section | Transparent cut-outs, portrait. |
| `assets/photos/cat-{tees,pumpers,hoodies,shorts,stringers}.jpg` | Category rows | 4:5 portrait. |
| `assets/photos/story.jpg` | Why VYRO backdrop | Full-bleed, moody. |
| `assets/photos/review-01.jpg` … `review-04.jpg` | Reviews | 4:5 portrait. |
| `assets/photos/join.jpg` | Drop alert CTA backdrop | Full-bleed. |

The collection cards show SVG garment stand-ins drawn in the real colorways
(`js/garments.js`). To use product photos there, add an `<img data-photo>` inside
each `.pcard__media`, the same way the category rows do.

## Hooks to wire up

- **Email signup:** `js/main.js`, search for `Hook your email provider here`.
- **Add to bag:** currently updates the counter and shows a toast. Connect it to your cart (Shopify and so on).
- **Women's line:** enable the second tab in the categories section and add a second `.cats` list.

## Stack

GSAP 3 + ScrollTrigger, Lenis and Three.js, loaded from cdnjs and jsdelivr.
Archivo from Google Fonts: extra-condensed for display type, normal width for body text.
Reduced motion is respected: it turns off the intro, pinning, momentum scroll and WebGL motion.
