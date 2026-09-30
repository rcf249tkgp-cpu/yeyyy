# VYRO Athletics

The VYRO Athletics website: home page, shop with filters and search, product
pages, cart drawer and cart page, and customer accounts with wishlist.
Plain HTML, CSS and JavaScript. There is no build step and nothing to install.

## Deploy to Vercel

1. Upload this folder to a GitHub repository (or run `npx vercel` inside it).
2. In Vercel, choose **Add New > Project**, import the repository and keep
   the defaults: Framework Preset **Other**, no build command, output
   directory left empty (the project root).
3. Deploy. `vercel.json` marks the project as a static site (no framework,
   no install or build step) and adds the clean URLs `/shop`, `/cart`,
   `/account` and `/product`, image caching and security headers.
   `.vercelignore` keeps the optional Node server (`server/`) out of the
   deployment, so Vercel never tries to run it.

**Accounts on Vercel:** Vercel serves the site as static files, and the
optional Node server (`server/vyro-server.js`, which stores accounts,
wishlists and orders in a SQLite file) can't keep data there because Vercel
has no permanent disk. If it is ever run on Vercel anyway, it writes nothing
to disk and turns its account API off (set `DB_PATH` to a path under `/tmp`
for throwaway test storage only). The site detects this
automatically and switches to preview mode: sign-up, log in, wishlist,
addresses and test orders still work, but they're saved in each visitor's own
browser, and the account screens say so. Everything else (shop, filters,
search, product pages, cart) works exactly the same.

To keep real accounts in a database, either:
- host the whole folder on a service that runs Node 22+ (Render, Railway,
  Fly.io, a VPS) with `npm start` and a persistent disk for `data/`, or
- move the API in `server/vyro-server.js` to Vercel Functions with a hosted database
  (Vercel Postgres/Neon, Turso or Supabase). The front end already talks to
  `/api/*` and switches over automatically once it answers.

## Run it

```bash
npm start                 # same as: node server/vyro-server.js
                          # http://localhost:3000
```

`server/vyro-server.js` serves the site and the account API, and stores
accounts, wishlists, addresses and orders in SQLite (`data/vyro.db` inside
the project, created on the first account request, never at startup). It uses Node 22's built-in `node:sqlite`, so there is nothing to
install. Options: `PORT=8080`, `DB_PATH=/path/to/vyro.db`,
`NODE_ENV=production` (secure cookies, hides test reset links). A relative
`DB_PATH` is resolved from the project folder.

Clean URLs work on the server: `/shop`, `/cart`, `/account`.

The site also works as plain static files (`npx serve .`). In that case
accounts, wishlists and orders fall back to the visitor's browser storage and
the account screens say so ("Preview mode").

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

## Products and product pages

Every product lives in one catalogue: the `PRODUCTS` array in `js/shop.js`.
Each entry holds the slug, name, category, price, copy (lede, description,
features, fit, care), sizes, default colorway, the card image(s) and a
`gallery(color)` function that returns the photos for that colorway.

- **Product page route:** `product.html?id=<slug>&color=<black|navy|gray>`,
  for example `product.html?id=club-jogger&color=gray`. One template,
  `product.html` + `js/product.js`, renders every product from the catalogue.
  The colour is optional and defaults to the product's `defaultColor`.
- **Cards:** the shop rail on the home page and "You might also like" on
  product pages both use the same `cardHTML()` component, so a product added
  to the catalogue appears in both automatically.
- **Adding a product:** add an entry to `PRODUCTS` and drop its photos into
  `assets/`. No new HTML page is needed.
- **Bag:** stored in the browser (`localStorage`) so the count follows you
  between pages. Replace `addToBag()` in `js/shop.js` with your store's cart
  API when you connect checkout.

Unknown product IDs show a "Product not found" page with a link back to the shop.

## Shop features

| Feature | Where |
|---|---|
| Shared header, footer, cart drawer, search, log in window, wishlist hearts | `js/chrome.js` |
| Product catalogue, card and row components, search, bag | `js/shop.js` |
| Account client (server database, or browser fallback) | `js/api.js` |
| Shop page with filters and sorting | `shop.html`, `js/shop-page.js` |
| Cart page and test checkout | `cart.html`, `js/cart-page.js` |
| My Account (profile, orders, wishlist, addresses, settings) | `account.html`, `js/account.js` |
| Product page with Complete the Look | `product.html`, `js/product.js` |
| API and database (Node hosts) | `server/vyro-server.js` |

- **Filters** combine: any option within a group can match, and every group
  must match. They live in the URL, so a filtered view can be shared, for
  example `shop.html?type=Hoodies,Tees&color=navy&sort=price-asc`.
- **Search** matches product names, categories and each product's `tags`
  in `js/shop.js`. Colour words ("navy hoodie") open results in that colour.
  Press `/` or Ctrl/Cmd+K to search from any page.
- **Complete the Look** uses each product's `look` list in `js/shop.js`.
- **New arrivals** use each product's `isNew` flag; "Newest" sorts by `added`.

## Before going live

- **Payments:** checkout is a test. It records the order but takes no
  payment. Connect a payment provider (Stripe, Shopify checkout, and so on)
  in `js/cart-page.js` and the `POST /api/orders` route in
  `server/vyro-server.js`.
- **Password reset emails:** there's no email service yet. Reset links are
  printed in the server log (and shown on screen outside production). Add
  your provider in `sendResetEmail()` in `server/vyro-server.js`.
- **Drop alert signup** on the home page isn't connected: `js/main.js`,
  search for `Hook your email provider here`.
- **Women's line:** add products with `gender: 'women'` in `js/shop.js`. The
  shop's Men/Women filter picks them up automatically.

## Stack

GSAP 3 + ScrollTrigger, Lenis and Three.js, loaded from cdnjs and jsdelivr.
Archivo from Google Fonts: extra-condensed for display type, normal width for body text.
Reduced motion is respected: it turns off the intro, pinning, momentum scroll and WebGL motion.
