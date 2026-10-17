/* 全ページ共通の初期化。
 * canvas[data-contour] に等高線を描画する。オプションは data 属性で渡す:
 *   data-color="--bg-rgb"  線色（CSS カスタムプロパティ名 or "r, g, b"）
 *   data-cell="10"         グリッドセルの大きさ (css px)
 *   data-lattice="44"      等高線の代わりに + ラティスを描く（404 のプレースホルダー）
 * data-contour-coords があれば、地形の再生成に合わせて座標表示を更新する。
 * 複数フレームがある場合は data-contour-frame で canvas と coords を対応させる。 */
(() => {
  const canvases = document.querySelectorAll('canvas[data-contour]');
  if (!canvases.length) return;

  function findCoords(canvas) {
    const frame = canvas.dataset.contourFrame;
    if (frame) {
      return Array.from(document.querySelectorAll('[data-contour-coords]'))
        .find(coords => coords.dataset.contourFrame === frame);
    }

    const scope = canvas.closest('.site-panel') || document;
    return scope.querySelector('[data-contour-coords]');
  }

  const instances = [];
  canvases.forEach(canvas => {
    const opts = {};
    if (canvas.dataset.color) opts.color = canvas.dataset.color;
    if (canvas.dataset.cell) opts.cell = Number(canvas.dataset.cell);
    if (canvas.dataset.lattice) opts.lattice = Number(canvas.dataset.lattice);

    const coords = findCoords(canvas);
    if (coords) {
      opts.onRegenerate = ({ lat, lon }) => {
        coords.textContent = Contour.formatCoords(lat, lon);
      };
    }

    instances.push(Contour.create(canvas, opts));
  });

  // テーマ切り替え時、線色（CSS 変数由来）を読み直して全フレームを再描画する。
  window.addEventListener('themechange', () => instances.forEach(c => c.render()));
})();
