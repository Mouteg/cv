/*
 * Contour — シード付きノイズ標高場を marching squares で等高線として描画するモジュール。
 *
 * 任意の canvas に取り付けられる。サイズは canvas の CSS ボックスに追従する。
 *
 *   const c = Contour.create(canvas, {
 *     color: '--bg-rgb',      // 線色: CSS カスタムプロパティ名 or "r, g, b"
 *     onRegenerate: ({ lat, lon }) => { ... },
 *   });
 *   c.regenerate();           // 新しい地形を生成して再描画
 */
(function (global) {
  'use strict';

  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  // edge interpolation: where does the iso level cross between corner values a, b
  const cross = (a, b, t) => (t - a) / (b - a);

  function cssRGB(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function formatCoords(lat, lon) {
    return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'} — ` +
           `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
  }

  function create(canvas, options) {
    const opts = Object.assign({
      color: '--fg-rgb', // 線色: CSS カスタムプロパティ名 or "r, g, b"
      cell: 12,          // grid cell size (css px)
      lattice: 0,        // >0 なら等高線の代わりに + ラティスを描く（目標間隔 css px）
      scale: 0.0021,     // noise frequency
      levels: 54,        // number of iso lines
      interactive: true, // クリックで地形を再生成する
      onRegenerate: null, // ({ lat, lon }) => void
      // Terrain shape. The defaults reproduce the original look exactly.
      octaves: 4,        // noise layers in fbm; more = finer detail
      roughness: 0.5,    // amplitude kept per octave (0..1); higher = jaggier lines
      detail: 0.3,       // weight of the fine-detail layer vs the warped macro layer (0..1)
      ridged: false,     // fold the noise into sharp crests and pointy peaks
      smooth: true,      // smoothstep between noise points; false = faceted, kinked lines
      morph: 0,          // click transition in ms: the terrain flows into a new shape; 0 = instant jump
      drift: 2,          // how far a morph travels through the noise; lower = gentler change (≥1 = clearly new map)
      spread: 0,         // >0: the morph starts at the click and spreads outward; higher = longer wavefront lag
      ping: false,       // draw expanding rings at the click point
    }, options);
    const octaves = Math.max(1, Math.round(opts.octaves));
    // 線色が CSS カスタムプロパティ名なら、その名前を保持して render() ごとに読み直す。
    // これでテーマ切り替え（--*-rgb の入れ替え）に追従して再描画できる（初回解決も render が行う）。
    const colorVar = opts.color.startsWith('--') ? opts.color : null;

    const ctx = canvas.getContext('2d');

    /* ---------- seeded 3D value noise ---------- */
    let perm;
    function reseed() {
      perm = new Uint8Array(512);
      const p = Uint8Array.from({ length: 256 }, (_, i) => i);
      for (let i = 255; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [p[i], p[j]] = [p[j], p[i]];
      }
      for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    }

    const ease = opts.smooth ? fade : t => t;

    /* Corner value of lattice point (x, y, z) is perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255.
       The x and (x, y) stages are shared between corners: 14 table lookups instead of 24, same values. */
    function noise3(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = x - xi, yf = y - yi, zf = z - zi;
      const u = ease(xf), v = ease(yf), w = ease(zf);
      const a0 = perm[xi & 255], a1 = perm[(xi + 1) & 255];
      const h00 = perm[(a0 + yi) & 255],     h10 = perm[(a1 + yi) & 255];
      const h01 = perm[(a0 + yi + 1) & 255], h11 = perm[(a1 + yi + 1) & 255];
      const z0 = zi & 255, z1 = (zi + 1) & 255;
      return lerp(
        lerp(
          lerp(perm[(h00 + z0) & 255] / 255, perm[(h10 + z0) & 255] / 255, u),
          lerp(perm[(h01 + z0) & 255] / 255, perm[(h11 + z0) & 255] / 255, u), v),
        lerp(
          lerp(perm[(h00 + z1) & 255] / 255, perm[(h10 + z1) & 255] / 255, u),
          lerp(perm[(h01 + z1) & 255] / 255, perm[(h11 + z1) & 255] / 255, u), v),
        w);
    }

    function fbm(x, y, z) {
      let sum = 0, amp = 1, freq = 1, norm = 0;
      for (let o = 0; o < octaves; o++) {
        let n = noise3(x * freq, y * freq, z * freq);
        if (opts.ridged) n = 1 - Math.abs(n * 2 - 1);
        sum += n * amp;
        norm += amp;
        amp *= opts.roughness;
        freq *= 2;
      }
      return sum / norm;
    }

    /* 標高: ドメインワープした低周波の山塊・盆地に細部ノイズを重ねる */
    function elevation(x, y, z) {
      const wx = fbm(x * 0.4 + 13.7, y * 0.4 + 71.3, z);
      const wy = fbm(x * 0.4 + 91.2, y * 0.4 + 5.5, z);
      const macro = fbm(x * 0.22 + (wx - 0.5) * 1.6, y * 0.22 + (wy - 0.5) * 1.6, z + 37);
      const detail = fbm(x, y, z);
      let h = macro * (1 - opts.detail) + detail * opts.detail;
      h = 0.5 + (h - 0.5) * 1.9; // コントラストを強め、海面下〜山頂までの幅を持たせる
      return h < 0 ? 0 : h > 1 ? 1 : h;
    }

    /* ---------- field + marching squares ---------- */
    let cols, rows, field, scratch, dpr, width, height;
    let z = Math.random() * 100;
    let waterFrac = 0.4 + Math.random() * 0.2; // 水面下の割合 40〜60%

    // The traced contours are cached and only rebuilt when the terrain changes. Anything that
    // changes z, zAt, waterFrac, the seed or the canvas size must set terrainDirty = true.
    let terrainDirty = true;
    let levelPaths = []; // [{ t, kind, path: Path2D }] in draw order; kind: 0 depth, 1 coast, 2 land, 3 index

    function resize() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      cols = Math.ceil(width / opts.cell) + 1;
      rows = Math.ceil(height / opts.cell) + 1;
      field = new Float32Array(cols * rows);
      scratch = new Float32Array(cols * rows); // reused by seaLevel()
      terrainDirty = true;
    }

    // During a spreading morph each point has its own z: zAt(x, y) in css px. Otherwise null.
    let zAt = null;

    function sampleField() {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const zz = zAt ? zAt(i * opts.cell, j * opts.cell) : z;
          field[j * cols + i] = elevation(i * opts.cell * opts.scale, j * opts.cell * opts.scale, zz);
        }
      }
    }

    /* Add the segment(s) where level t crosses one cell to path p (marching squares).
       Corners: tl, tr, br, bl; the cell's top-left is (x0, y0). No allocations. */
    function traceCell(p, t, x0, y0, tl, tr, br, bl) {
      const CELL = opts.cell;
      let c = 0;
      if (tl > t) c |= 8;
      if (tr > t) c |= 4;
      if (br > t) c |= 2;
      if (bl > t) c |= 1;
      if (c === 0 || c === 15) return;

      // interpolated crossing points on each edge
      const x1 = x0 + CELL, y1 = y0 + CELL;
      const topX = x0 + CELL * cross(tl, tr, t);
      const rightY = y0 + CELL * cross(tr, br, t);
      const bottomX = x0 + CELL * cross(bl, br, t);
      const leftY = y0 + CELL * cross(tl, bl, t);

      switch (c) {
        case 1:  case 14: p.moveTo(x0, leftY); p.lineTo(bottomX, y1); break;     // left → bottom
        case 2:  case 13: p.moveTo(bottomX, y1); p.lineTo(x1, rightY); break;    // bottom → right
        case 3:  case 12: p.moveTo(x0, leftY); p.lineTo(x1, rightY); break;      // left → right
        case 4:  case 11: p.moveTo(topX, y0); p.lineTo(x1, rightY); break;       // top → right
        case 6:  case 9:  p.moveTo(topX, y0); p.lineTo(bottomX, y1); break;      // top → bottom
        case 7:  case 8:  p.moveTo(x0, leftY); p.lineTo(topX, y0); break;        // left → top
        case 5:  p.moveTo(x0, leftY); p.lineTo(topX, y0);                        // saddles: two segments
                 p.moveTo(bottomX, y1); p.lineTo(x1, rightY); break;
        case 10: p.moveTo(x0, leftY); p.lineTo(bottomX, y1);
                 p.moveTo(topX, y0); p.lineTo(x1, rightY); break;
      }
    }

    /* Trace every contour level in a single pass over the grid. A level t crosses a cell only if
       min(corners) <= t < max(corners), so each cell visits just those levels instead of all ~58. */
    function buildPaths(SEA) {
      const levels = [];
      for (let d = 1; d <= 3; d++) levels.push({ t: SEA - d * 0.05, kind: 0 }); // depth lines
      levels.push({ t: SEA, kind: 1 });                                          // coastline
      for (let l = 1; l <= opts.levels; l++) {
        const t = l / (opts.levels + 1);
        if (t <= SEA) continue;
        levels.push({ t, kind: l % 5 === 0 ? 3 : 2 }); // every 5th line is an "index contour", like topo maps
      }
      levels.forEach(level => { level.path = new Path2D(); });

      const sorted = levels.slice().sort((a, b) => a.t - b.t);
      const n = sorted.length;
      const T = new Float64Array(n);
      for (let k = 0; k < n; k++) T[k] = sorted[k].t;

      const CELL = opts.cell;
      for (let j = 0; j < rows - 1; j++) {
        const y0 = j * CELL;
        for (let i = 0; i < cols - 1; i++) {
          const tl = field[j * cols + i];
          const tr = field[j * cols + i + 1];
          const br = field[(j + 1) * cols + i + 1];
          const bl = field[(j + 1) * cols + i];
          const mn = Math.min(tl, tr, br, bl), mx = Math.max(tl, tr, br, bl);
          if (mn === mx) continue; // flat cell: no level can cross it

          // first level with t >= mn
          let lo = 0, hi = n;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (T[mid] < mn) lo = mid + 1; else hi = mid;
          }
          const x0 = i * CELL;
          for (let k = lo; k < n && T[k] < mx; k++) {
            traceCell(sorted[k].path, T[k], x0, y0, tl, tr, br, bl);
          }
        }
      }
      levelPaths = levels;
    }

    // 標高分布の分位点を海面とすることで、水域の面積比を waterFrac に固定する。
    // Quickselect on a reused buffer: the same k-th smallest value a full sort would give, in O(n).
    function seaLevel() {
      const a = scratch;
      a.set(field);
      const k = Math.min(a.length - 1, (a.length * waterFrac) | 0);
      let lo = 0, hi = a.length - 1;
      while (hi > lo) {
        const pivot = a[(lo + hi) >> 1];
        let i = lo, j = hi;
        while (i <= j) {
          while (a[i] < pivot) i++;
          while (a[j] > pivot) j--;
          if (i <= j) { const tmp = a[i]; a[i] = a[j]; a[j] = tmp; i++; j--; }
        }
        if (k <= j) hi = j;
        else if (k >= i) lo = i;
        else break; // k lies in the run equal to the pivot
      }
      return a[k];
    }

    /* 読み込み前プレースホルダー: 等高線の代わりに + ラティスを描く（404 など）。
       格子はフレームの + マーク中心（--frame-pad）を通るよう等分割するが、
       描くのは枠の内側のノードのみ。枠線上は .mark（四隅）と axis / coords
       ラベルの領分なので、重ね描きや文字との衝突を避ける。
       + の寸法は .mark と同じ 16px・1px 線。 */
    function renderLattice() {
      const pad = parseFloat(getComputedStyle(canvas).getPropertyValue('--frame-pad')) || 36;
      const arm = 8;
      const innerW = width - pad * 2, innerH = height - pad * 2;
      const nx = Math.max(1, Math.round(innerW / opts.lattice));
      const ny = Math.max(1, Math.round(innerH / opts.lattice));
      ctx.strokeStyle = `rgba(${opts.color}, 0.3)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let j = 1; j < ny; j++) {
        const y = pad + innerH * j / ny;
        for (let i = 1; i < nx; i++) {
          const x = pad + innerW * i / nx;
          ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
          ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
        }
      }
      ctx.stroke();
    }

    function render() {
      // テーマに追従するため、CSS 変数由来の線色は描画ごとに最新値へ更新する。
      if (colorVar) opts.color = cssRGB(colorVar);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (opts.lattice) { renderLattice(); return; }
      // Re-sample and re-trace only when the terrain changed; colour-only redraws (theme switch,
      // ping frames) just re-stroke the cached paths.
      if (terrainDirty) {
        sampleField();
        buildPaths(seaLevel());
        terrainDirty = false;
      }
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      for (const level of levelPaths) {
        if (level.kind === 0) {
          // 水域（海面下）: 通常の等高線は引かず、破線の等深線のみ
          ctx.setLineDash([3, 7]);
          ctx.strokeStyle = `rgba(${opts.color}, 0.16)`;
          ctx.lineWidth = 1;
        } else {
          ctx.setLineDash([]);
          if (level.kind === 1) {        // coastline
            ctx.strokeStyle = `rgba(${opts.color}, 0.9)`;
            ctx.lineWidth = 1.8;
          } else {                       // land contours; every 5th is a thicker index contour
            const index = level.kind === 3;
            ctx.strokeStyle = `rgba(${opts.color}, ${index ? 0.7 : 0.45})`;
            ctx.lineWidth = index ? 1.5 : 1.1;
          }
        }
        ctx.stroke(level.path);
      }
      ctx.setLineDash([]);

      if (ping) drawPing();
    }

    /* ---------- click animations (morph + ping) share one frame loop ---------- */
    const easeMorph = p => (1 - Math.cos(Math.PI * p)) / 2; // gentle sine ease in-out
    const now = () => global.performance.now();
    let frameId = 0;
    let morphing = null; // { start, fromAt, toZ, fromW, toW, cx, cy, reach }
    let ping = null;     // { x, y, start }

    const PING_MS = 1200, PING_R = 70, PING_RINGS = 3, PING_GAP = 0.18;

    /* Expanding rings at the click point, drawn over the contours in the line colour. */
    function drawPing() {
      const t = (now() - ping.start) / PING_MS;
      const span = 1 - (PING_RINGS - 1) * PING_GAP; // each ring's share of the timeline
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      for (let k = 0; k < PING_RINGS; k++) {
        const q = (t - k * PING_GAP) / span;
        if (q <= 0 || q >= 1) continue;
        ctx.strokeStyle = `rgba(${opts.color}, ${(1 - q) * 0.9})`;
        ctx.beginPath();
        ctx.arc(ping.x, ping.y, 3 + (1 - (1 - q) * (1 - q)) * PING_R, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    /* z of point (x, y) at morph progress p. With spread, points near the click run ahead
       and the farthest point starts last, so the change travels outward as a wavefront. */
    function morphZ(m, x, y, p) {
      let lp = p;
      if (opts.spread > 0) {
        const dx = x - m.cx, dy = y - m.cy;
        const d = Math.sqrt(dx * dx + dy * dy) / m.reach; // sqrt, not Math.hypot: hot path, much faster
        lp = Math.min(1, Math.max(0, p * (1 + opts.spread) - opts.spread * d));
      }
      const from = m.fromAt(x, y);
      return from + (m.toZ - from) * easeMorph(lp);
    }

    function tick() {
      frameId = 0;
      let active = false;
      if (morphing) {
        terrainDirty = true;
        const m = morphing;
        const p = Math.min(1, (now() - m.start) / opts.morph);
        waterFrac = m.fromW + (m.toW - m.fromW) * easeMorph(p);
        if (p < 1) {
          zAt = (x, y) => morphZ(m, x, y, p);
          active = true;
        } else {
          z = m.toZ;
          zAt = null;
          morphing = null;
        }
      }
      if (ping) {
        if (now() - ping.start < PING_MS) active = true;
        else ping = null;
      }
      render();
      if (active) frameId = global.requestAnimationFrame(tick);
    }

    function startFrames() {
      if (!frameId) frameId = global.requestAnimationFrame(tick);
    }

    /* Animated regenerate: travel through the noise's z axis (and ease the water level)
       to a new terrain over opts.morph ms. A click mid-morph continues from the current shape. */
    function morph(cx, cy) {
      const prev = morphing;
      let fromAt, base;
      if (prev) {
        // freeze the in-progress shape as this morph's starting point
        const pPrev = Math.min(1, (now() - prev.start) / opts.morph);
        fromAt = (x, y) => morphZ(prev, x, y, pPrev);
        base = prev.toZ;
      } else {
        const z0 = z;
        fromAt = () => z0;
        base = z;
      }
      const reach = Math.max(
        Math.hypot(cx, cy), Math.hypot(width - cx, cy),
        Math.hypot(cx, height - cy), Math.hypot(width - cx, height - cy)) || 1;
      morphing = {
        start: now(), fromAt, cx, cy, reach,
        toZ: base + opts.drift * (0.75 + Math.random() * 0.5), // ±25% so clicks vary
        fromW: waterFrac, toW: 0.4 + Math.random() * 0.2,
      };
      if (opts.onRegenerate) {
        opts.onRegenerate({
          lat: Math.random() * 180 - 90,
          lon: Math.random() * 360 - 180,
        });
      }
      startFrames();
    }

    const reduceMotion = () =>
      !!global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function regenerate(event) {
      const animate = !reduceMotion();
      // click point in canvas css px; programmatic calls use the centre
      let cx = width / 2, cy = height / 2;
      if (event && event.clientX !== undefined) {
        const rect = canvas.getBoundingClientRect();
        cx = event.clientX - rect.left;
        cy = event.clientY - rect.top;
      }
      if (opts.ping && animate) {
        ping = { x: cx, y: cy, start: now() };
        startFrames();
      }
      if (opts.morph > 0 && animate) { morph(cx, cy); return; }
      reseed();
      z = Math.random() * 100;
      waterFrac = 0.4 + Math.random() * 0.2;
      terrainDirty = true;
      if (opts.onRegenerate) {
        opts.onRegenerate({
          lat: Math.random() * 180 - 90,
          lon: Math.random() * 360 - 180,
        });
      }
      render();
    }

    if (opts.interactive && !opts.lattice) canvas.addEventListener('click', regenerate);
    global.addEventListener('resize', () => { resize(); render(); });

    reseed();
    resize();
    render();

    return { render, resize, regenerate };
  }

  global.Contour = { create, formatCoords };
})(window);
