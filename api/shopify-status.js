/*
  GET /api/shopify-status

  Connection test for the Shopify Storefront API. It changes nothing on the
  site and nothing in Shopify except creating one empty cart, which Shopify
  discards on its own. It reports each step so a failed setup says exactly
  where it stopped. It never returns tokens, secrets or cart IDs.

  How it authenticates (all server-side, credentials from Vercel env vars):
    1. Client credentials grant: Client ID + secret of the VYRO Storefront
       app (Shopify Dev Dashboard) -> short-lived app token.
    2. That token creates a delegate token limited to the Storefront scopes
       below.
    3. The delegate token calls the Storefront API as
       Shopify-Storefront-Private-Token, with the shopper's IP as
       Shopify-Storefront-Buyer-IP.

  Environment variables:
    SHOPIFY_STORE_DOMAIN   your-store.myshopify.com
    SHOPIFY_CLIENT_ID      from the Dev Dashboard app
    SHOPIFY_CLIENT_SECRET  from the Dev Dashboard app (Sensitive)
    SHOPIFY_API_VERSION    e.g. 2026-07 (optional, defaults below)
    SHOPIFY_STATUS_KEY     optional; if set, call /api/shopify-status?key=<value>
*/

const DEFAULT_API_VERSION = '2026-07';

// Minimum Storefront access for products, tags, carts and the checkout link.
// No customer scopes, no Admin API data scopes.
const STOREFRONT_SCOPES = [
  'unauthenticated_read_product_listings',
  'unauthenticated_read_product_tags',
  'unauthenticated_read_checkouts',
  'unauthenticated_write_checkouts'
];

const TIMEOUT_MS = 8000;

// Cached per warm function instance so repeated checks don't mint new tokens
let appToken = null;      // { value, expiresAt }
let delegateToken = null; // { value, expiresAt }

function config() {
  const env = process.env;
  const domain = String(env.SHOPIFY_STORE_DOMAIN || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return {
    domain,
    clientId: String(env.SHOPIFY_CLIENT_ID || '').trim(),
    clientSecret: String(env.SHOPIFY_CLIENT_SECRET || '').trim(),
    version: String(env.SHOPIFY_API_VERSION || DEFAULT_API_VERSION).trim(),
    statusKey: String(env.SHOPIFY_STATUS_KEY || '').trim()
  };
}

async function request(url, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, Object.assign({}, options, { signal: ctrl.signal }));
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
    return { status: res.status, json, text, apiVersion: res.headers.get('x-shopify-api-version') };
  } finally {
    clearTimeout(timer);
  }
}

// Shopify error bodies can be long HTML pages; keep a short, safe summary
function describe(res) {
  if (res.json) {
    const j = res.json;
    const msg = j.error_description || j.error || j.errors || j.message || j;
    return typeof msg === 'string' ? msg : JSON.stringify(msg).slice(0, 400);
  }
  return ('HTTP ' + res.status + ' ' + String(res.text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 300);
}

async function getAppToken(cfg) {
  if (appToken && appToken.expiresAt > Date.now() + 60000) return { token: appToken.value, cached: true };
  const res = await request('https://' + cfg.domain + '/admin/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: cfg.clientId, client_secret: cfg.clientSecret }).toString()
  });
  if (res.status !== 200 || !res.json || !res.json.access_token) throw new Error(describe(res));
  const ttl = (+res.json.expires_in || 3600) * 1000;
  appToken = { value: res.json.access_token, expiresAt: Date.now() + ttl, scope: res.json.scope || '' };
  return { token: appToken.value, cached: false, scope: appToken.scope };
}

async function getDelegateToken(cfg, parent) {
  if (delegateToken && delegateToken.expiresAt > Date.now() + 60000) return { token: delegateToken.value, cached: true };
  // Must not outlive the app token it is derived from
  const expiresIn = Math.max(300, Math.min(3600, Math.floor((appToken.expiresAt - Date.now()) / 1000) - 120));
  const res = await request('https://' + cfg.domain + '/admin/api/' + cfg.version + '/graphql.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Shopify-Access-Token': parent },
    body: JSON.stringify({
      query: 'mutation($input: DelegateAccessTokenInput!) { delegateAccessTokenCreate(input: $input) { delegateAccessToken { accessToken accessScopes } userErrors { field message } } }',
      variables: { input: { delegateAccessScope: STOREFRONT_SCOPES, expiresIn } }
    })
  });
  const data = res.json && res.json.data && res.json.data.delegateAccessTokenCreate;
  if (res.status !== 200 || !data) throw new Error(res.json && res.json.errors ? JSON.stringify(res.json.errors).slice(0, 400) : describe(res));
  if (data.userErrors && data.userErrors.length) throw new Error(data.userErrors.map(e => e.message).join('; '));
  delegateToken = { value: data.delegateAccessToken.accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  return { token: delegateToken.value, cached: false, scopes: data.delegateAccessToken.accessScopes };
}

async function storefront(cfg, token, buyerIp, query, variables) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', 'Shopify-Storefront-Private-Token': token };
  if (buyerIp) headers['Shopify-Storefront-Buyer-IP'] = buyerIp;
  const res = await request('https://' + cfg.domain + '/api/' + cfg.version + '/graphql.json', {
    method: 'POST', headers, body: JSON.stringify({ query, variables: variables || {} })
  });
  if (res.status !== 200 || !res.json) throw new Error(describe(res));
  if (res.json.errors && res.json.errors.length) throw new Error(res.json.errors.map(e => e.message).join('; ').slice(0, 400));
  return { data: res.json.data, apiVersion: res.apiVersion };
}

function buyerIpOf(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || String(req.headers['x-real-ip'] || '').trim() || '';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    return res.end(JSON.stringify({ ok: false, error: 'Use GET' }));
  }

  const cfg = config();
  const url = new URL(req.url, 'http://localhost');
  if (cfg.statusKey && url.searchParams.get('key') !== cfg.statusKey) {
    res.statusCode = 404;
    return res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  }

  const steps = [];
  const report = { ok: false, store: cfg.domain || null, requestedApiVersion: cfg.version, steps };
  function done(status) {
    report.ok = steps.length > 0 && steps.every(s => s.ok);
    res.statusCode = status || (report.ok ? 200 : 502);
    res.end(JSON.stringify(report, null, 2));
  }

  // 1. Configuration present (values are never echoed)
  const missing = ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_CLIENT_ID', 'SHOPIFY_CLIENT_SECRET']
    .filter(k => !String(process.env[k] || '').trim());
  const domainOk = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(cfg.domain);
  steps.push({
    step: 'config',
    ok: missing.length === 0 && domainOk,
    detail: missing.length ? 'Missing Vercel environment variables: ' + missing.join(', ')
      : domainOk ? 'Environment variables found' : 'SHOPIFY_STORE_DOMAIN must be the your-store.myshopify.com address, not a custom domain'
  });
  if (!steps[0].ok) return done(500);

  // 2. App token (client credentials grant)
  let parent;
  try {
    const t = await getAppToken(cfg);
    parent = t.token;
    steps.push({ step: 'app_token', ok: true, detail: t.cached ? 'Reused cached app token' : 'Client credentials accepted', grantedScopes: t.scope ? t.scope.split(',') : undefined });
  } catch (e) {
    steps.push({ step: 'app_token', ok: false, detail: 'Shopify refused the Client ID / secret: ' + e.message });
    return done();
  }

  // 3. Delegate token limited to the Storefront scopes
  let token;
  try {
    const d = await getDelegateToken(cfg, parent);
    token = d.token;
    steps.push({ step: 'storefront_token', ok: true, detail: d.cached ? 'Reused cached Storefront token' : 'Storefront token created', scopes: d.scopes || STOREFRONT_SCOPES });
  } catch (e) {
    steps.push({ step: 'storefront_token', ok: false, detail: 'Could not create the Storefront token: ' + e.message, requestedScopes: STOREFRONT_SCOPES });
    return done();
  }

  const ip = buyerIpOf(req);

  // 4. Read products (products, variants, prices, images, tags)
  try {
    const r = await storefront(cfg, token, ip, `{
      shop { name }
      products(first: 5) {
        nodes {
          handle title productType tags availableForSale
          featuredImage { url altText }
          variants(first: 1) { nodes { title price { amount currencyCode } } }
        }
      }
    }`);
    const products = r.data.products.nodes;
    report.shopName = r.data.shop.name;
    report.apiVersion = r.apiVersion || cfg.version;
    steps.push({
      step: 'read_products',
      ok: true,
      detail: products.length ? products.length + ' product(s) visible to the Storefront API (showing up to 5)' : 'Connected, but no products are visible yet. Add products, set them Active and publish them to the VYRO Storefront app.',
      products: products.map(p => ({
        handle: p.handle,
        title: p.title,
        type: p.productType,
        tags: p.tags,
        availableForSale: p.availableForSale,
        firstVariant: p.variants.nodes[0] ? p.variants.nodes[0].title + ' ' + p.variants.nodes[0].price.amount + ' ' + p.variants.nodes[0].price.currencyCode : null,
        hasImage: !!p.featuredImage
      }))
    });
    if (report.apiVersion !== cfg.version) steps[steps.length - 1].note = 'Shopify answered with API version ' + report.apiVersion + ' instead of ' + cfg.version + '. Set SHOPIFY_API_VERSION to a supported version.';
  } catch (e) {
    steps.push({ step: 'read_products', ok: false, detail: 'Storefront API query failed: ' + e.message });
    return done();
  }

  // 5. Create an empty cart and read its checkout link (cart scopes)
  try {
    const r = await storefront(cfg, token, ip, `mutation { cartCreate(input: {}) { cart { checkoutUrl } userErrors { field message } } }`);
    const c = r.data.cartCreate;
    if (c.userErrors && c.userErrors.length) throw new Error(c.userErrors.map(e => e.message).join('; '));
    let checkoutHost = null;
    try { checkoutHost = new URL(c.cart.checkoutUrl).host; } catch (e) { /* leave null */ }
    steps.push({ step: 'cart', ok: true, detail: 'Cart created; checkout link points to ' + (checkoutHost || 'an unknown host') });
  } catch (e) {
    steps.push({ step: 'cart', ok: false, detail: 'Cart API failed: ' + e.message });
  }

  return done();
}
