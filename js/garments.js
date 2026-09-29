/*
  Garment stand-ins.
  Flat-lay SVG silhouettes rendered in the real Drop 01 colorways, so colorway
  switching works before product photography exists. When a matching photo is
  present (see the <img data-photo> next to each garment in index.html) it is
  layered on top and the silhouette is hidden.
*/
(function () {
  const COLORS = {
    black: { fill: '#141517', mark: '#E7E7E1', name: 'Black' },
    navy:  { fill: '#1E2C4B', mark: '#E7E7E1', name: 'Navy' },
    gray:  { fill: '#8A8B8D', mark: '#F1F1EC', name: 'Gray' }
  };

  // viewBox 0 0 400 440
  const SHAPES = {
    tee: {
      body: 'M160 34 C172 62 228 62 240 34 L292 46 L360 84 L390 190 L330 206 L318 158 L322 418 C250 430 150 430 78 418 L82 158 L70 206 L10 190 L40 84 L108 46 Z',
      details: [
        { d: 'M160 34 C172 62 228 62 240 34', w: 9, o: 0.42 },
        { d: 'M318 158 L310 88', w: 1.6, o: 0.22 },
        { d: 'M82 158 L90 88', w: 1.6, o: 0.22 },
        { d: 'M80 398 C150 408 250 408 320 398', w: 1.6, o: 0.2 }
      ],
      folds: ['M150 240 C170 300 160 360 170 410', 'M258 220 C240 300 252 350 236 412'],
      mark: { x: 200, y: 126, size: 20 }
    },
    pumper: {
      body: 'M156 30 C170 58 230 58 244 30 L300 42 L376 96 L398 236 L334 250 L322 176 L326 404 C250 416 150 416 74 404 L78 176 L66 250 L2 236 L24 96 L100 42 Z',
      details: [
        { d: 'M156 30 C170 58 230 58 244 30', w: 10, o: 0.42 },
        { d: 'M322 176 L304 70', w: 1.6, o: 0.22 },
        { d: 'M78 176 L96 70', w: 1.6, o: 0.22 },
        { d: 'M76 384 C150 396 250 396 324 384', w: 1.6, o: 0.2 },
        { d: 'M4 222 L64 234', w: 5, o: 0.3 },
        { d: 'M396 222 L336 234', w: 5, o: 0.3 }
      ],
      folds: ['M140 230 C160 290 150 350 162 398', 'M262 210 C244 290 256 340 240 400', 'M200 250 C204 300 196 350 202 404'],
      mark: { x: 200, y: 122, size: 22 }
    },
    hoodie: {
      body: 'M140 74 C128 26 168 6 200 6 C232 6 272 26 260 74 L300 84 L350 124 L392 382 L348 394 L318 196 L322 420 C250 432 150 432 78 420 L82 196 L52 394 L8 382 L50 124 L100 84 Z',
      details: [
        { d: 'M158 74 C162 44 238 44 242 74 C232 96 168 96 158 74 Z', w: 0, o: 0.45, fill: true },
        { d: 'M186 92 L182 150 M214 92 L218 150', w: 2.4, o: 0.35 },
        { d: 'M128 296 L272 296 L292 378 L108 378 Z', w: 1.8, o: 0.26 },
        { d: 'M82 400 L318 400', w: 6, o: 0.28 },
        { d: 'M12 366 L52 374 M388 366 L348 374', w: 5, o: 0.3 }
      ],
      folds: ['M150 200 C164 250 156 280 160 290', 'M252 190 C240 250 248 280 242 290'],
      mark: { x: 200, y: 170, size: 20 }
    },
    shorts: {
      body: 'M70 44 L330 44 L352 356 L226 372 L200 196 L174 372 L48 356 Z',
      details: [
        { d: 'M70 44 L330 44 L332 82 L68 82 Z', w: 0, o: 0.32, fill: true },
        { d: 'M186 82 L192 118 M214 82 L208 118', w: 2.2, o: 0.35 },
        { d: 'M54 330 L110 336', w: 1.6, o: 0.25 },
        { d: 'M346 330 L290 336', w: 1.6, o: 0.25 },
        { d: 'M200 82 L200 196', w: 1.6, o: 0.22 }
      ],
      folds: ['M120 150 C130 220 118 280 126 350', 'M282 150 C272 220 284 280 276 350'],
      mark: { x: 110, y: 318, size: 14 }
    },
    stringer: {
      body: 'M148 18 L178 18 C182 96 218 96 222 18 L252 18 C252 118 300 150 318 176 L322 420 C250 432 150 432 78 420 L82 176 C100 150 148 118 148 18 Z',
      details: [
        { d: 'M178 18 C182 96 218 96 222 18', w: 5, o: 0.4 },
        { d: 'M148 18 C148 118 100 150 82 176', w: 4, o: 0.35 },
        { d: 'M252 18 C252 118 300 150 318 176', w: 4, o: 0.35 },
        { d: 'M80 404 C150 414 250 414 320 404', w: 1.6, o: 0.2 }
      ],
      folds: ['M160 230 C170 300 160 360 170 414', 'M244 220 C232 300 246 350 234 414'],
      mark: { x: 200, y: 170, size: 18 }
    }
  };

  let uid = 0;

  function svg(type, color) {
    const s = SHAPES[type] || SHAPES.tee;
    const c = COLORS[color] || COLORS.black;
    const id = 'g' + (++uid);
    const light = false;
    const seam = light ? '#000' : '#000';
    const hi = light ? 0.35 : 0.09;

    const details = s.details.map(function (d) {
      return d.fill
        ? '<path d="' + d.d + '" fill="#000" fill-opacity="' + d.o + '"/>'
        : '<path d="' + d.d + '" fill="none" stroke="' + seam + '" stroke-opacity="' + d.o + '" stroke-width="' + d.w + '" stroke-linecap="round"/>';
    }).join('');

    const folds = s.folds.map(function (d) {
      return '<path d="' + d + '" fill="none" stroke="#000" stroke-opacity="' + (light ? 0.1 : 0.28) + '" stroke-width="10" stroke-linecap="round" filter="url(#b' + id + ')"/>' +
             '<path d="' + d + '" fill="none" stroke="#fff" stroke-opacity="' + (light ? 0.5 : 0.05) + '" stroke-width="3" stroke-linecap="round" transform="translate(6 0)" filter="url(#b' + id + ')"/>';
    }).join('');

    return '' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 440" aria-hidden="true" focusable="false">' +
        '<defs>' +
          '<clipPath id="c' + id + '"><path d="' + s.body + '"/></clipPath>' +
          '<linearGradient id="h' + id + '" x1="0" x2="1" y1="0" y2="0">' +
            '<stop offset="0" stop-color="#000" stop-opacity="0.42"/>' +
            '<stop offset="0.45" stop-color="#fff" stop-opacity="' + hi + '"/>' +
            '<stop offset="1" stop-color="#000" stop-opacity="0.5"/>' +
          '</linearGradient>' +
          '<linearGradient id="v' + id + '" x1="0" x2="0" y1="0" y2="1">' +
            '<stop offset="0" stop-color="#fff" stop-opacity="' + (hi * 0.8) + '"/>' +
            '<stop offset="1" stop-color="#000" stop-opacity="0.35"/>' +
          '</linearGradient>' +
          '<filter id="b' + id + '" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>' +
        '</defs>' +
        '<path d="' + s.body + '" fill="' + c.fill + '"/>' +
        '<g clip-path="url(#c' + id + ')">' +
          '<rect width="400" height="440" fill="url(#h' + id + ')"/>' +
          '<rect width="400" height="440" fill="url(#v' + id + ')"/>' +
          folds +
          details +
          '<text x="' + s.mark.x + '" y="' + s.mark.y + '" text-anchor="middle" font-family="Archivo, Arial Narrow, sans-serif" font-weight="800" font-size="' + s.mark.size + '" letter-spacing="3" fill="' + c.mark + '" fill-opacity="0.82">VYRO</text>' +
        '</g>' +
        '<path d="' + s.body + '" fill="none" stroke="#fff" stroke-opacity="' + (light ? 0 : 0.1) + '" stroke-width="1.5"/>' +
      '</svg>';
  }

  function render(el) {
    el.innerHTML = svg(el.dataset.garment, el.dataset.color);
  }

  window.VyroGarments = { COLORS: COLORS, svg: svg, render: render };
})();
