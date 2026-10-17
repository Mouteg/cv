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
    }, options);
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

    const rnd = (x, y, z) => perm[(perm[(perm[x & 255] + y) & 255] + z) & 255] / 255;

    function noise3(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = x - xi, yf = y - yi, zf = z - zi;
      const u = fade(xf), v = fade(yf), w = fade(zf);
      return lerp(
        lerp(
          lerp(rnd(xi, yi, zi),     rnd(xi + 1, yi, zi),     u),
          lerp(rnd(xi, yi + 1, zi), rnd(xi + 1, yi + 1, zi), u), v),
        lerp(
          lerp(rnd(xi, yi, zi + 1),     rnd(xi + 1, yi, zi + 1),     u),
          lerp(rnd(xi, yi + 1, zi + 1), rnd(xi + 1, yi + 1, zi + 1), u), v),
        w);
    }

    function fbm(x, y, z) {
      let sum = 0, amp = 1, freq = 1, norm = 0;
      for (let o = 0; o < 4; o++) {
        sum += noise3(x * freq, y * freq, z * freq) * amp;
        norm += amp;
        amp *= 0.5;
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
      let h = macro * 0.7 + detail * 0.3;
      h = 0.5 + (h - 0.5) * 1.9; // コントラストを強め、海面下〜山頂までの幅を持たせる
      return h < 0 ? 0 : h > 1 ? 1 : h;
    }

    /* ---------- field + marching squares ---------- */
    let cols, rows, field, dpr, width, height;
    let z = Math.random() * 100;
    let waterFrac = 0.4 + Math.random() * 0.2; // 水面下の割合 40〜60%

    function resize() {
      dpr = Math.min(global.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      cols = Math.ceil(width / opts.cell) + 1;
      rows = Math.ceil(height / opts.cell) + 1;
      field = new Float32Array(cols * rows);
    }

    function sampleField() {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          field[j * cols + i] = elevation(i * opts.cell * opts.scale, j * opts.cell * opts.scale, z);
        }
      }
    }

    function drawLevel(t) {
      const CELL = opts.cell;
      ctx.beginPath();
      for (let j = 0; j < rows - 1; j++) {
        const y0 = j * CELL, y1 = y0 + CELL;
        for (let i = 0; i < cols - 1; i++) {
          const x0 = i * CELL, x1 = x0 + CELL;
          const tl = field[j * cols + i];
          const tr = field[j * cols + i + 1];
          const br = field[(j + 1) * cols + i + 1];
          const bl = field[(j + 1) * cols + i];

          let c = 0;
          if (tl > t) c |= 8;
          if (tr > t) c |= 4;
          if (br > t) c |= 2;
          if (bl > t) c |= 1;
          if (c === 0 || c === 15) continue;

          // interpolated crossing points on each edge
          const top    = [x0 + CELL * cross(tl, tr, t), y0];
          const right  = [x1, y0 + CELL * cross(tr, br, t)];
          const bottom = [x0 + CELL * cross(bl, br, t), y1];
          const left   = [x0, y0 + CELL * cross(tl, bl, t)];

          const seg = (a, b) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); };
          switch (c) {
            case 1:  case 14: seg(left, bottom); break;
            case 2:  case 13: seg(bottom, right); break;
            case 3:  case 12: seg(left, right); break;
            case 4:  case 11: seg(top, right); break;
            case 6:  case 9:  seg(top, bottom); break;
            case 7:  case 8:  seg(left, top); break;
            case 5:  seg(left, top); seg(bottom, right); break;
            case 10: seg(left, bottom); seg(top, right); break;
          }
        }
      }
      ctx.stroke();
    }

    // 標高分布の分位点を海面とすることで、水域の面積比を waterFrac に固定する
    function seaLevel() {
      const sorted = Float32Array.from(field).sort();
      return sorted[Math.min(sorted.length - 1, (sorted.length * waterFrac) | 0)];
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
      sampleField();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // 水域（海面下）: 通常の等高線は引かず、破線の等深線のみ
      const SEA = seaLevel();
      ctx.setLineDash([3, 7]);
      ctx.strokeStyle = `rgba(${opts.color}, 0.16)`;
      ctx.lineWidth = 1;
      for (let d = 1; d <= 3; d++) {
        drawLevel(SEA - d * 0.05);
      }
      ctx.setLineDash([]);

      // 海岸線
      ctx.strokeStyle = `rgba(${opts.color}, 0.9)`;
      ctx.lineWidth = 1.8;
      drawLevel(SEA);

      // 陸地の等高線
      for (let l = 1; l <= opts.levels; l++) {
        const t = l / (opts.levels + 1);
        if (t <= SEA) continue;
        const index = l % 5 === 0; // every 5th line is an "index contour", like topo maps
        ctx.strokeStyle = `rgba(${opts.color}, ${index ? 0.7 : 0.45})`;
        ctx.lineWidth = index ? 1.5 : 1.1;
        drawLevel(t);
      }
    }

    function regenerate() {
      reseed();
      z = Math.random() * 100;
      waterFrac = 0.4 + Math.random() * 0.2;
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
