# VYRO Athletics: Shopify theme

`shopify-theme/` is the VYRO website as a Shopify Online Store 2.0 theme, with the same design, animations and layout as the static site.
Upload `vyro-shopify-theme.zip` in **Shopify Admin → Nettbutikk → Temaer → Legg til tema → Last opp zip-fil**.

The theme runs entirely on Shopify, with no Vercel, Node or server.
GSAP, ScrollTrigger, Lenis and Three.js are bundled in `assets/`.
The Archivo font is loaded from Google Fonts, as on the original site.

## What's native Shopify

| Part | Shopify feature |
|---|---|
| Products, variants, prices, stock | Products with a **Color** and a **Size** option |
| Cart drawer and cart page | Cart AJAX API + Section Rendering API |
| Checkout | Shopify checkout (the Checkout buttons post to `/cart`) |
| Filters and sorting | Storefront filtering (Search & Discovery app) |
| Search overlay | Predictive search |
| "You might also like" | Product recommendations |
| Accounts | Classic customer accounts: log in, register, orders, addresses, password reset |
| Drop alerts signup | Customer form (subscribers show up under Customers) |

## Set up your products

1. **Options:** name them **Color** (or Colour/Farge) and **Size** (or Størrelse). Colours called Black, Navy and Gray use the VYRO swatch colours from theme settings. Any other colour uses the swatch set on the option value in Shopify.
2. **Photos:** add every photo to the product and put the colour name in its **alt text**, for example "Navy flat front" or "Navy worn in the gym".
   - The product page shows only the photos for the chosen colour.
   - Cards use the first photo for each colour.
   - Put **flat** in the alt text for flat-lay shots so they're shown whole on the dark stage.
3. **Tags:** tag new products with `new` to get the New badge.
4. **Menu:** the header shows the VYRO links (Shop, Drop 01, Why VYRO, Community) until you pick a menu under Header in the theme editor.
5. **Filters:** in the Search & Discovery app, add filters for Product type, Size, Color and Price.
6. **Optional metafields** (Settings → Custom data → Products):

   | Metafield | Type | Used for |
   |---|---|---|
   | `custom.subtitle` | single line text | line under the name on cards (else the product type) |
   | `custom.lede` | multi-line text | intro under the price |
   | `custom.features` | list of single line text | Features accordion |
   | `custom.fit` | multi-line text | Size and fit accordion |
   | `custom.care` | multi-line text | Care accordion |
   | `custom.complete_the_look` | list of products | Complete the Look pieces |

   Without `custom.complete_the_look`, the product template's Complete the Look section uses the products picked in the theme editor.

## Editing in the theme editor

- **Home page:** every section can be edited, reordered or removed, with its own images, text and blocks.
  - Sections: hero slides, statement, lookbook, Drop colorways, details, product rail, categories, brand story, reviews, drop alerts.
  - Until you upload your own images, the sections use the bundled VYRO photos.
- **Theme settings:**
  - Logo, favicon, colours and swatch colours.
  - Free-shipping threshold for the cart progress bar.
  - Cart type (drawer or page).
  - Intro animation and WebGL effects on or off.
  - Popular searches and social links.
- **Languages:** English (default) and Norwegian (`nb`). Add Norwegian under Settings → Languages to publish it.

## Good to know

- **Wishlist:** Shopify has no built-in wishlist. The hearts work as before (they ask shoppers to log in first), but each customer's list is saved in their browser. A wishlist app is needed to sync it across devices.
- **Reviews:** the Reviews section holds the reviews you type into it. It isn't connected to a reviews app.
