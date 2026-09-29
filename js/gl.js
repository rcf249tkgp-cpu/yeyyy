/*
  WebGL layer (Three.js)
  1. Hero: slow ambient sequence with a noise-dissolve transition, drifting
     chalk dust and a subtle grade. Uses the hero photos when present,
     otherwise renders cinematic stand-ins (barbell, rack, plates).
  2. Product cards: one shared renderer that attaches to the hovered card and
     adds a restrained ripple + RGB split that follows the pointer.
*/
(function () {
  if (!window.THREE) return;
  const THREE = window.THREE;

  function supportsGL() {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  /* -------------------------------------------------------------- *
   * Stand-in textures (used until real photography is dropped in)
   * -------------------------------------------------------------- */
  function noiseTile() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const d = x.createImageData(128, 128);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 18;
    }
    x.putImageData(d, 0, 0);
    return c;
  }

  function standIn(kind) {
    const W = 1920, H = 1080;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');

    x.fillStyle = '#0A0A0B';
    x.fillRect(0, 0, W, H);

    // overhead light shaft
    const lx = [W * 0.64, W * 0.36, W * 0.55][kind];
    const g = x.createRadialGradient(lx, -120, 20, lx, -120, H * 1.35);
    g.addColorStop(0, 'rgba(214,220,226,0.62)');
    g.addColorStop(0.35, 'rgba(160,170,178,0.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);

    // floor
    const f = x.createLinearGradient(0, H * 0.62, 0, H);
    f.addColorStop(0, 'rgba(40,42,45,0.0)');
    f.addColorStop(0.2, 'rgba(34,36,39,0.55)');
    f.addColorStop(1, 'rgba(8,8,9,1)');
    x.fillStyle = f;
    x.fillRect(0, H * 0.62, W, H * 0.38);

    // chalk haze drifting through the light
    for (let k = 0; k < 3; k++) {
      const hx = W * (0.3 + 0.2 * k + 0.1 * kind), hy = H * (0.45 + 0.1 * ((k + kind) % 2));
      const hz = x.createRadialGradient(hx, hy, 10, hx, hy, 420 + 80 * k);
      hz.addColorStop(0, 'rgba(220,224,228,0.08)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = hz; x.fillRect(0, 0, W, H);
    }

    // vignette
    const v = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.75)');
    x.fillStyle = v; x.fillRect(0, 0, W, H);

    x.fillStyle = x.createPattern(noiseTile(), 'repeat');
    x.fillRect(0, 0, W, H);
    return c;
  }

  // Several portrait shots side by side, for wide screens
  function compose(imgs) {
    const FW = 640, FH = 1000, GAP = 6;
    const c = document.createElement('canvas');
    c.width = FW * imgs.length + GAP * (imgs.length - 1);
    c.height = FH;
    const x = c.getContext('2d');
    x.fillStyle = '#0A0A0A';
    x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = 'high';
    imgs.forEach(function (img, i) {
      const r = Math.max(FW / img.naturalWidth, FH / img.naturalHeight);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      x.save();
      x.beginPath(); x.rect(i * (FW + GAP), 0, FW, FH); x.clip();
      x.drawImage(img, i * (FW + GAP) + (FW - w) / 2, (FH - h) / 2, w, h);
      x.restore();
    });
    return c;
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  /* -------------------------------------------------------------- *
   * Hero
   * -------------------------------------------------------------- */
  const heroFrag = `
    precision highp float;
    uniform sampler2D uTex0; uniform sampler2D uTex1;
    uniform vec2 uSize0; uniform vec2 uSize1; uniform vec2 uRes;
    uniform float uProg; uniform float uTime; uniform float uZoom0; uniform float uZoom1;
    uniform float uScroll; uniform vec2 uPointer;
    varying vec2 vUv;

    vec2 cover(vec2 uv, vec2 size, float zoom) {
      float rs = uRes.x / uRes.y, ri = size.x / size.y;
      vec2 s = rs < ri ? vec2(ri / rs, 1.0) : vec2(1.0, rs / ri);
      uv = (uv - 0.5) / s + 0.5;
      return (uv - 0.5) / zoom + 0.5;
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
    }
    float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; } return v; }

    void main() {
      vec2 uv = vUv;
      vec2 par = (uPointer - 0.5) * 0.012;
      float n = fbm(uv * 3.2 + uTime * 0.03);

      // brush-like dissolve travelling left to right
      float edge = uProg * 1.5 - 0.25;
      float m = smoothstep(edge - 0.18, edge + 0.18, n * 0.55 + (1.0 - uv.x) * 0.45);
      m = 1.0 - m;

      vec2 d = vec2(n - 0.5) * 0.06;
      vec3 a = texture2D(uTex0, cover(uv + par + d * m, uSize0, uZoom0)).rgb;
      vec3 b = texture2D(uTex1, cover(uv + par - d * (1.0 - m), uSize1, uZoom1)).rgb;
      vec3 col = mix(a, b, m);

      // grade: cool shadows, slight desaturation, darken on scroll
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 0.82);
      col = pow(col, vec3(1.06));
      col *= vec3(0.97, 0.99, 1.02);
      col *= 1.0 - uScroll * 0.65;
      float vig = smoothstep(1.15, 0.35, length((uv - 0.5) * vec2(1.25, 1.0)));
      col *= mix(0.55, 1.0, vig);
      col += (hash(uv * uRes + uTime) - 0.5) * 0.035;
      gl_FragColor = vec4(col, 1.0);
    }`;

  const vert = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  const dustVert = `
    attribute float aSeed; attribute float aSize;
    uniform float uTime; uniform float uDpr; uniform float uAspect;
    varying float vA;
    void main() {
      vec3 p = position;
      float t = uTime * (0.012 + aSeed * 0.02);
      p.y = mod(p.y + t + 1.0, 2.0) - 1.0;
      p.x += sin(uTime * 0.2 + aSeed * 40.0) * 0.03;
      vA = smoothstep(-1.0, -0.4, p.y) * (1.0 - smoothstep(0.6, 1.0, p.y)) * (0.25 + aSeed * 0.6);
      gl_Position = vec4(p.x, p.y, 0.0, 1.0);
      gl_PointSize = aSize * uDpr;
    }`;
  const dustFrag = `
    precision mediump float;
    varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.0, d) * vA;
      gl_FragColor = vec4(vec3(0.93, 0.94, 0.95), a * 0.55);
    }`;

  function initHero(canvas, sources, opts) {
    opts = opts || {};
    if (!supportsGL()) return null;

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x0a0a0a, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTex0: { value: null }, uTex1: { value: null },
      uSize0: { value: new THREE.Vector2(16, 9) }, uSize1: { value: new THREE.Vector2(16, 9) },
      uRes: { value: new THREE.Vector2(1, 1) },
      uProg: { value: 0 }, uTime: { value: 0 },
      uZoom0: { value: 1.0 }, uZoom1: { value: 1.0 },
      uScroll: { value: 0 }, uPointer: { value: new THREE.Vector2(0.5, 0.5) }
    };
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: uniforms, vertexShader: vert, fragmentShader: heroFrag }));
    scene.add(plane);

    // chalk dust
    const count = window.innerWidth < 700 ? 140 : 320;
    const pos = new Float32Array(count * 3), seed = new Float32Array(count), size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * 2 - 1;
      pos[i * 3 + 1] = Math.random() * 2 - 1;
      seed[i] = Math.random();
      size[i] = 1.5 + Math.pow(Math.random(), 3) * 7;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const dustU = { uTime: { value: 0 }, uDpr: { value: dpr }, uAspect: { value: 1 } };
    const dust = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: dustU, vertexShader: dustVert, fragmentShader: dustFrag,
      transparent: true, depthTest: false, blending: THREE.AdditiveBlending
    }));
    scene.add(dust);

    // textures: photo if present, stand-in otherwise
    const slides = sources.map(function (src, i) {
      const tex = new THREE.CanvasTexture(standIn(i % 3));
      tex.minFilter = THREE.LinearFilter;
      const s = { tex: tex, size: new THREE.Vector2(1920, 1080), isPhoto: false };
      const list = Array.isArray(src) ? src : [src];
      Promise.all(list.map(loadImage)).then(function (imgs) {
        if (imgs.some(function (im) { return !im; })) return;
        const img = imgs.length === 1 ? imgs[0] : compose(imgs);
        const t = img.tagName === 'CANVAS' ? new THREE.CanvasTexture(img) : new THREE.Texture(img);
        t.minFilter = THREE.LinearFilter;
        t.needsUpdate = true;
        s.tex = t; s.size.set(img.naturalWidth || img.width, img.naturalHeight || img.height); s.isPhoto = true;
        if (current === i) { uniforms.uTex0.value = t; uniforms.uSize0.value = s.size; }
        if (opts.onPhoto) opts.onPhoto(i);
      });
      return s;
    });

    let current = 0;
    let slideStart = 0;
    uniforms.uTex0.value = slides[0].tex; uniforms.uSize0.value = slides[0].size;
    uniforms.uTex1.value = slides[1 % slides.length].tex; uniforms.uSize1.value = slides[1 % slides.length].size;

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false);
      uniforms.uRes.value.set(w, h);
    }
    resize();
    window.addEventListener('resize', resize);

    const pointerTarget = new THREE.Vector2(0.5, 0.5);
    if (!opts.reduced) {
      window.addEventListener('pointermove', function (e) {
        pointerTarget.set(e.clientX / window.innerWidth, 1 - e.clientY / window.innerHeight);
      }, { passive: true });
    }

    let visible = true, running = !opts.reduced;
    const io = new IntersectionObserver(function (en) { visible = en[0].isIntersecting; });
    io.observe(canvas);

    const clock = new THREE.Clock();
    const HOLD = 6.5;

    function goTo(next) {
      const n = slides[next];
      uniforms.uTex1.value = n.tex; uniforms.uSize1.value = n.size;
      uniforms.uZoom1.value = 1.08;
      if (opts.onChange) opts.onChange(next, HOLD);
      window.gsap.to(uniforms.uProg, {
        value: 1, duration: 2.2, ease: 'power2.inOut',
        onComplete: function () {
          current = next;
          uniforms.uTex0.value = n.tex; uniforms.uSize0.value = n.size;
          uniforms.uZoom0.value = uniforms.uZoom1.value;
          uniforms.uProg.value = 0;
          slideStart = clock.elapsedTime - 2.2;
        }
      });
    }

    function tick() {
      const t = clock.getElapsedTime();
      uniforms.uTime.value = t;
      dustU.uTime.value = t;
      uniforms.uPointer.value.lerp(pointerTarget, 0.04);
      // slow push-in on the live frame
      const local = t - slideStart;
      uniforms.uZoom0.value = 1.0 + Math.min(local / (HOLD + 2.2), 1) * 0.08;
      if (running && uniforms.uProg.value === 0 && local > HOLD) {
        slideStart = t;
        goTo((current + 1) % slides.length);
      }
      if (visible) renderer.render(scene, camera);
    }

    if (opts.reduced) {
      // single static frame, no dust drift
      renderer.render(scene, camera);
      const notify = opts.onPhoto;
      opts.onPhoto = function (i) { renderer.render(scene, camera); if (notify) notify(i); };
    } else {
      window.gsap.ticker.add(tick);
      if (opts.onChange) opts.onChange(0, HOLD);
    }

    return {
      setScroll: function (v) { uniforms.uScroll.value = v; if (opts.reduced) renderer.render(scene, camera); },
      renderer: renderer
    };
  }

  /* -------------------------------------------------------------- *
   * Product card hover distortion
   * -------------------------------------------------------------- */
  const hoverFrag = `
    precision highp float;
    uniform sampler2D uTex; uniform float uHover; uniform vec2 uMouse; uniform vec2 uVel; uniform float uTime;
    varying vec2 vUv;
    void main() {
      vec2 uv = vUv;
      float d = distance(uv, uMouse);
      float fall = smoothstep(0.55, 0.0, d);
      vec2 dir = normalize(uv - uMouse + 1e-5);
      uv += dir * sin(d * 30.0 - uTime * 3.5) * 0.0045 * uHover * fall;
      uv = (uv - 0.5) * (1.0 - 0.035 * uHover) + 0.5;
      vec2 s = uVel * 0.9 * uHover;
      float r = texture2D(uTex, uv + s).r;
      float g = texture2D(uTex, uv).g;
      float b = texture2D(uTex, uv - s).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }`;

  function initHover(cards, drawSource) {
    if (!supportsGL()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const canvas = renderer.domElement;
    canvas.setAttribute('aria-hidden', 'true');
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const u = {
      uTex: { value: null }, uHover: { value: 0 }, uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) }, uVel: { value: new THREE.Vector2(0, 0) }
    };
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ uniforms: u, vertexShader: vert, fragmentShader: hoverFrag })));

    let active = null, token = 0, last = null;
    const target = new THREE.Vector2(0.5, 0.5);
    const clock = new THREE.Clock();

    function tick() {
      u.uTime.value = clock.getElapsedTime();
      const prev = u.uMouse.value.clone();
      u.uMouse.value.lerp(target, 0.12);
      u.uVel.value.lerp(new THREE.Vector2((u.uMouse.value.x - prev.x) * 0.4, (u.uMouse.value.y - prev.y) * 0.4), 0.2);
      renderer.render(scene, camera);
    }

    function enter(card, e) {
      const media = card.querySelector('[data-hover-gl]');
      const r = media.getBoundingClientRect();
      const my = ++token;
      active = card;
      renderer.setSize(r.width, r.height, false);
      media.appendChild(canvas);
      target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      u.uMouse.value.copy(target);
      drawSource(card, r.width * renderer.getPixelRatio(), r.height * renderer.getPixelRatio()).then(function (src) {
        if (my !== token || !src) return;
        if (u.uTex.value) u.uTex.value.dispose();
        const t = new THREE.CanvasTexture(src);
        t.minFilter = THREE.LinearFilter;
        u.uTex.value = t;
        if (!last) { window.gsap.ticker.add(tick); last = tick; }
        window.gsap.to(canvas, { opacity: 1, duration: 0.25, overwrite: true });
        window.gsap.to(u.uHover, { value: 1, duration: 0.9, ease: 'power3.out', overwrite: true });
      });
    }

    function leave(card) {
      if (active !== card) return;
      const my = ++token;
      window.gsap.to(u.uHover, {
        value: 0, duration: 0.6, ease: 'power2.out', overwrite: true,
        onComplete: function () {
          if (my !== token) return;
          window.gsap.to(canvas, {
            opacity: 0, duration: 0.2, overwrite: true, onComplete: function () {
              if (my !== token) return;
              if (last) { window.gsap.ticker.remove(last); last = null; }
              if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
              active = null;
            }
          });
        }
      });
    }

    cards.forEach(function (card) {
      const media = card.querySelector('[data-hover-gl]');
      media.addEventListener('pointerenter', function (e) { enter(card, e); });
      media.addEventListener('pointermove', function (e) {
        const r = media.getBoundingClientRect();
        target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
      });
      media.addEventListener('pointerleave', function () { leave(card); });
    });

    return {
      refresh: function (card) {
        if (active !== card) return;
        const media = card.querySelector('[data-hover-gl]');
        const r = media.getBoundingClientRect();
        drawSource(card, r.width * renderer.getPixelRatio(), r.height * renderer.getPixelRatio()).then(function (src) {
          if (active !== card || !src) return;
          if (u.uTex.value) u.uTex.value.dispose();
          const t = new THREE.CanvasTexture(src);
          u.uTex.value = t;
        });
      }
    };
  }

  window.VyroGL = { supported: supportsGL, initHero: initHero, initHover: initHover, loadImage: loadImage };
})();
