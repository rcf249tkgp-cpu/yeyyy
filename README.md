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
| `assets/logo/vyro-logo.png` | Intro wipe, nav, hero, footer | Extracted from the tank-top sheet and upscaled. Swap in a vector export of the real logo when you have one. |
| `assets/photos/life-1.jpg` … `life-9.jpg` | Hero sequence, story, reviews, signup backdrop | Gym shots of the hoodie and jogger. On desktop the hero shows three per slide. |
| `assets/photos/{tee,tank,shorts}-model-*.jpg` | Lookbook, category rows | On-model shots. |
| `assets/products/*.jpg` | Drop 01, collection, details | Flat product shots and close-ups. |
| `assets/products/lineup-sheet-*.webp` | Not shown | The original sheets everything above was cropped from. |

All photos were cropped from those sheets, so each one is only a few hundred
pixels wide. Replace them with high-res originals at the same filenames and the
page picks them up with no code changes.

Colorway switching swaps photos by filename: each product image has a
`data-pimg` pattern such as `assets/products/hoodie-{c}-front.jpg`, where `{c}`
is `black`, `navy` or `gray`. Categories that haven't launched yet (tees,
pumpers, shorts, stringers) use SVG garment stand-ins from `js/garments.js`.

## Hooks to wire up

- **Email signup:** `js/main.js`, search for `Hook your email provider here`.
- **Add to bag:** currently updates the counter and shows a toast. Connect it to your cart (Shopify and so on).
- **Women's line:** enable the second tab in the categories section and add a second `.cats` list.

## Stack

GSAP 3 + ScrollTrigger, Lenis and Three.js, loaded from cdnjs and jsdelivr.
Archivo from Google Fonts: extra-condensed for display type, normal width for body text.
Reduced motion is respected: it turns off the intro, pinning, momentum scroll and WebGL motion.
