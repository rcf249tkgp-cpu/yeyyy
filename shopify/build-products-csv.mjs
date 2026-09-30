// Builds shopify/products.csv (Shopify product import format) from the
// current catalogue in js/shop.js, so Shopify gets exactly what the site sells.
//
//   node shopify/build-products-csv.mjs
//   node shopify/build-products-csv.mjs --image-base=https://your-site.vercel.app
//
// With --image-base, every product photo is included as a public image URL on
// the deployed site (Shopify downloads them during import). Without it, the
// CSV has no images and photos are uploaded in Shopify Admin instead.
// Nothing here talks to Shopify; importing is a manual step in Shopify Admin.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.find(a => a.startsWith('--image-base='));
const imageBase = arg ? arg.split('=')[1].replace(/\/+$/, '') : '';

// Load js/shop.js with a minimal browser stand-in and read its catalogue
const noop = () => {};
const sandbox = {
  document: { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] },
  localStorage: { getItem: () => null, setItem: noop },
  sessionStorage: { getItem: () => null, setItem: noop },
  addEventListener: noop, dispatchEvent: noop, CustomEvent: function () {},
  setTimeout, clearTimeout
};
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/shop.js'), 'utf8'), sandbox);
const { PRODUCTS, COLORS, COLOR_ORDER } = sandbox.VyroShop;

// Per-product values the site doesn't hold yet. Weights are estimates:
// weigh one sample of each and correct them before importing.
const EXTRA = {
  'athletics-club-hoodie': { sku: 'HOOD', grams: 800 },
  'oversized-tee': { sku: 'TEE', grams: 260 },
  'premium-tank': { sku: 'TANK', grams: 160 },
  'club-jogger': { sku: 'JOG', grams: 650 },
  'training-short': { sku: 'SHRT', grams: 240 },
  'club-set': { sku: 'SET', grams: 1450 }
};
const COLOR_SKU = { black: 'BLK', navy: 'NVY', gray: 'GRY' };

const HEADERS = [
  'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags', 'Published',
  'Option1 Name', 'Option1 Value', 'Option2 Name', 'Option2 Value',
  'Variant SKU', 'Variant Grams', 'Variant Inventory Tracker', 'Variant Inventory Qty', 'Variant Inventory Policy',
  'Variant Fulfillment Service', 'Variant Price', 'Variant Compare At Price', 'Variant Requires Shipping', 'Variant Taxable',
  'Image Src', 'Image Position', 'Image Alt Text', 'Variant Image', 'Variant Weight Unit',
  'SEO Title', 'SEO Description', 'Status',
  'Subtitle (product.metafields.custom.subtitle)',
  'Lede (product.metafields.custom.lede)',
  'Features (product.metafields.custom.features)',
  'Fit (product.metafields.custom.fit)',
  'Care (product.metafields.custom.care)'
];

function esc(v) {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function html(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function url(src) { return imageBase ? imageBase + '/' + src.replace(/^\/+/, '') : ''; }

// Photos per product: every colour's gallery in the site's order, with the
// colour name (and "flat" for flat-lay shots) in the alt text
function imagesFor(p) {
  const seen = new Map();
  const firstOfColor = {};
  for (const c of COLOR_ORDER) {
    const name = COLORS[c].name;
    for (const g of p.gallery(c)) {
      if (!firstOfColor[c]) firstOfColor[c] = g.src;
      if (seen.has(g.src)) continue;
      const alt = name + (g.fit === 'contain' ? ' flat ' : ' ') + g.alt;
      seen.set(g.src, { src: g.src, alt: alt.charAt(0).toUpperCase() + alt.slice(1) });
    }
  }
  return { list: [...seen.values()], firstOfColor };
}

const rows = [];
const summary = [];
for (const p of PRODUCTS) {
  const x = EXTRA[p.slug];
  if (!x) throw new Error('No SKU/weight entry for ' + p.slug);
  const imgs = imagesFor(p);
  const tags = [...new Set(['men', ...(p.isNew ? ['new'] : []), 'drop-01', ...p.tags.map(t => t.toLowerCase())])];
  let first = true;
  let variants = 0;
  for (const c of COLOR_ORDER) {
    for (const size of p.sizes) {
      const r = {
        'Handle': p.slug,
        'Option1 Value': COLORS[c].name,
        'Option2 Value': size,
        'Variant SKU': ['VY', x.sku, COLOR_SKU[c], size].join('-'),
        'Variant Grams': x.grams,
        'Variant Inventory Tracker': 'shopify',
        'Variant Inventory Qty': 0,
        'Variant Inventory Policy': 'deny',
        'Variant Fulfillment Service': 'manual',
        'Variant Price': p.price.toFixed(2),
        'Variant Requires Shipping': 'TRUE',
        'Variant Taxable': 'TRUE',
        'Variant Image': url(imgs.firstOfColor[c]),
        'Variant Weight Unit': 'kg'
      };
      if (first) {
        Object.assign(r, {
          'Title': p.name,
          'Body (HTML)': '<p>' + html(p.description) + '</p>',
          'Vendor': 'VYRO',
          'Type': p.category,
          'Tags': tags.join(', '),
          'Published': 'TRUE',
          'Option1 Name': 'Color',
          'Option2 Name': 'Size',
          'SEO Title': p.name + ' | VYRO Athletics',
          'SEO Description': p.lede,
          'Status': 'active',
          'Subtitle (product.metafields.custom.subtitle)': p.meta,
          'Lede (product.metafields.custom.lede)': p.lede,
          'Features (product.metafields.custom.features)': p.features.join('\n'),
          'Fit (product.metafields.custom.fit)': p.fit,
          'Care (product.metafields.custom.care)': p.care
        });
        first = false;
      }
      rows.push(r);
      variants++;
    }
  }
  // Image rows (only with --image-base): Handle + image columns only
  if (imageBase) {
    imgs.list.forEach((img, i) => {
      rows.push({ 'Handle': p.slug, 'Image Src': url(img.src), 'Image Position': i + 1, 'Image Alt Text': img.alt });
    });
  }
  summary.push({ handle: p.slug, title: p.name, type: p.category, price: p.price, sizes: p.sizes.join(' '), variants, images: imgs.list.length, tags: tags.join(', ') });
}

const out = [HEADERS.join(',')].concat(rows.map(r => HEADERS.map(h => esc(r[h])).join(','))).join('\n') + '\n';
const file = path.join(root, 'shopify', 'products.csv');
fs.writeFileSync(file, out);
console.log('Wrote', path.relative(root, file), '-', rows.length, 'rows,', PRODUCTS.length, 'products,', summary.reduce((n, s) => n + s.variants, 0), 'variants', imageBase ? 'with images from ' + imageBase : '(no images)');
console.table(summary);
