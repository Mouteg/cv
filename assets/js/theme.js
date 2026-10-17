/* ライト/ダーク切り替え。初期値（data-theme）は head.html のインラインスクリプトが
 * CSS 適用前に確定させている。ここでは [data-theme-toggle] のクリックで反転し、
 * 選択を localStorage に保存し、canvas 再描画のため themechange を発火する。 */
(() => {
  const root = document.documentElement;
  const buttons = document.querySelectorAll('[data-theme-toggle]');
  if (!buttons.length) return;

  // 現在のテーマ（属性は head のインラインスクリプトが light/dark で確定済み）。
  const current = () => (root.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  function syncPressed(theme) {
    buttons.forEach(b => b.setAttribute('aria-pressed', String(theme === 'light')));
  }

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('contour-theme', theme); } catch (e) { /* 保存不可でも続行 */ }
    syncPressed(theme);
    window.dispatchEvent(new Event('themechange'));
  }

  // 初期表示は aria-pressed の同期のみ（保存や再描画はユーザー操作時に行う）。
  syncPressed(current());
  buttons.forEach(b => b.addEventListener('click', () => {
    setTheme(current() === 'light' ? 'dark' : 'light');
  }));
})();

/* Dark palette toggle (fg ⇄ fgd, bg ⇄ bgd). The initial data-fg is set by the inline script in head.html.
 * Clicking [data-fg-toggle] flips it, saves the choice to localStorage and fires themechange so canvases redraw. */
(() => {
  const root = document.documentElement;
  const buttons = document.querySelectorAll('[data-fg-toggle]');
  if (!buttons.length) return;

  const isFgd = () => root.getAttribute('data-fg') === 'fgd';

  function syncPressed(on) {
    buttons.forEach(b => b.setAttribute('aria-pressed', String(on)));
  }

  function setFgd(on) {
    if (on) {
      root.setAttribute('data-fg', 'fgd');
      // Entering the dark palette clears the fg/bg swap so fgd is always the text colour.
      root.setAttribute('data-theme', 'dark');
      document.querySelectorAll('[data-theme-toggle]').forEach(b => b.setAttribute('aria-pressed', 'false'));
      try { localStorage.setItem('contour-theme', 'dark'); } catch (e) { /* storage unavailable: carry on */ }
    } else {
      root.removeAttribute('data-fg');
    }
    try { localStorage.setItem('contour-fg', on ? 'fgd' : 'fg'); } catch (e) { /* storage unavailable: carry on */ }
    syncPressed(on);
    window.dispatchEvent(new Event('themechange'));
  }

  syncPressed(isFgd());
  buttons.forEach(b => b.addEventListener('click', () => setFgd(!isFgd())));
})();
