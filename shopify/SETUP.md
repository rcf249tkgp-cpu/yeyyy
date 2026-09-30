# Shopify backend setup (VYRO website → Vercel → Shopify)

The VYRO website stays on Vercel. Shopify holds products, stock, carts, checkout and orders.
This folder holds setup material only; it isn't deployed (see `.vercelignore`).

- `SETUP.md`: this guide
- `products.csv`: product import file for review. **Don't import it yet.**
- `build-products-csv.mjs`: regenerates `products.csv` from `js/shop.js`

## 1. Create the Storefront app (Shopify Admin → Dev Dashboard)

Since January 2026, new custom apps are created in Shopify's Dev Dashboard, not inside Admin.

1. In Shopify Admin, go to **Settings → Apps**, click **Develop apps**, then **Build apps in Dev Dashboard**.
2. In the Dev Dashboard, click **Create app**. Under **Start from Dev Dashboard**, name it `VYRO Storefront` and click **Create**.
3. Open the new app and create a **version**:
   - **App URL:** keep the default `https://shopify.dev/apps/default-app-home`. The app has no screens of its own.
   - **Embedded in Shopify admin:** off, if the option is shown.
   - **Access → Scopes:** add exactly these four and nothing else:

     | Scope | Needed for |
     |---|---|
     | `unauthenticated_read_product_listings` | products, variants, prices, images, product copy |
     | `unauthenticated_read_product_tags` | product tags (`new`, `men`) |
     | `unauthenticated_read_checkouts` | reading the cart and its checkout link |
     | `unauthenticated_write_checkouts` | creating and changing carts |

   - **Not requested:**
     - no Admin API scopes, since products are managed by hand in Admin and orders come from checkout;
     - no customer scopes;
     - no collection scope, since the site groups products by product type. It can be added in a later version if we build collection pages.
   - Click **Release**, then **Release** again.
4. In the app's **Home**, scroll to **Install app**, choose the VYRO store and click **Install**. Approve the permissions when Admin asks.
5. Open the app's **Settings** in the Dev Dashboard. You'll see a **Client ID** and a **Client secret**. Leave them there for now.
   - The secret goes **only** into Vercel (step 2).
   - Never paste it into chat, GitHub, code or email.
   - If it ever leaks, rotate it in the same screen.

## 2. Add the credentials to Vercel

Go to **Vercel → your project → Settings → Environment Variables**. Add each variable for **Production** and **Preview**, and switch on **Sensitive** for the secret.

| Name | Value | Secret? |
|---|---|---|
| `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com` (the myshopify address, not a custom domain) | no |
| `SHOPIFY_CLIENT_ID` | Client ID from step 1.5 | keep private |
| `SHOPIFY_CLIENT_SECRET` | Client secret from step 1.5 | **yes, Sensitive** |
| `SHOPIFY_API_VERSION` | `2026-07`, optional (that's the default) | no |
| `SHOPIFY_STATUS_KEY` | any random word, optional; locks the test endpoint | no |

Then **redeploy**, because environment variables only apply to new deployments.

None of these values appear in the website's JavaScript. Only `api/shopify-status.js` reads them, on Vercel's servers.

## 3. Test the connection

Open `https://<your-vercel-domain>/api/shopify-status`. Add `?key=<SHOPIFY_STATUS_KEY>` if you set one.

The endpoint reports five steps. All `"ok": true` means Shopify is connected.

| Step | Checks |
|---|---|
| `config` | the three required variables are set and the domain looks right |
| `app_token` | Shopify accepted the Client ID and secret |
| `storefront_token` | a Storefront token with the four scopes was created |
| `read_products` | products are readable; with an empty store it says "no products visible yet", which is fine |
| `cart` | a cart could be created and has a checkout link |

It never shows tokens or secrets. Send me the JSON output if any step fails.

## 4. Product import (after the connection test passes)

**Before importing,** create these product metafield definitions: **Settings → Custom data → Products → Add definition**. Turn on **Storefronts access** for each one.

| Name | Namespace and key | Type |
|---|---|---|
| Subtitle | `custom.subtitle` | Single line text |
| Lede | `custom.lede` | Multi-line text |
| Features | `custom.features` | Multi-line text (one feature per line) |
| Fit | `custom.fit` | Multi-line text |
| Care | `custom.care` | Multi-line text |

"Complete the Look" pairings (`custom.complete_the_look`, list of products) are set in Admin after import, because the CSV can't link products reliably.

**What `products.csv` contains** (from `js/shop.js`):

| Product | Handle | Type | Price (EUR) | Sizes | Variants |
|---|---|---|---|---|---|
| Athletics Club Hoodie | `athletics-club-hoodie` | Hoodies | 85.00 | XS–XXL | 18 |
| Oversized Tee | `oversized-tee` | Tees | 40.00 | XS–XXL | 18 |
| Premium Tank | `premium-tank` | Tanks | 32.00 | XS–XXL | 18 |
| Club Jogger | `club-jogger` | Joggers | 70.00 | S–XXL | 15 |
| Training Short | `training-short` | Shorts | 45.00 | S–XXL | 15 |
| Club Set | `club-set` | Sets | 145.00 | S–XXL | 15 |

**Every product has:**
- **Options:** `Color` (Black, Navy, Gray) and `Size`.
- **SKUs:** `VY-<PRODUCT>-<COLOR>-<SIZE>`, for example `VY-HOOD-BLK-M`.
- **Inventory:** tracked by Shopify, starting at **0**, and "continue selling when out of stock" is **off**. Enter real stock in Admin after import; until then, everything shows as sold out.
- **Tax and shipping:** taxable, requires shipping.
- **Weights:** estimates to correct: hoodie 800 g, tee 260 g, tank 160 g, jogger 650 g, short 240 g, set 1450 g.
- **Tags:** `men`, `drop-01`, `new` (tee, tank, short), plus the site's search words.
- **Copy:** description, SEO title and description, and the metafields above.
- **Status and publishing:** status `active`, published `TRUE`.
- **Club Set:** a separate product with its own stock. There's no bundle or component inventory yet.
- **Product category:** left blank; pick it in Admin if you want Shopify's standard taxonomy.

**Photos:**
- Shopify imports images from public URLs.
- Once the site's Vercel domain is known, run `node shopify/build-products-csv.mjs --image-base=https://<vercel-domain>`. This adds all 93 existing photos, with the colour in each alt text, and sets each variant's image.
- The alternative is uploading the photos in Admin.

**To import later:** Admin → **Products → Import** → choose `products.csv` → review the preview → **Import products**. Then enter stock, and make sure each product is available to the **VYRO Storefront** app under the product's publishing or sales channels panel.
