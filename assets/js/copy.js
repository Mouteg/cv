/* コードブロックのコピーボタン。.post-body 内の pre に copy/ ボタンを重ね、
 * クリックで中身を clipboard へコピーする。結果はラベルの反転表示で伝える。
 * clipboard API が使えない環境（非 HTTPS 等）では何も表示しない。
 * site.Params.showCodeCopy = false のときは scripts.html がこのファイルを
 * バンドルに含めないため、ここでの判定は不要。 */
(() => {
  if (!navigator.clipboard) return;

  document.querySelectorAll('.post-body pre').forEach((pre) => {
    const code = pre.querySelector('code');
    if (!code) return;

    // Chroma でハイライトされた場合は <div class="highlight"><pre> の入れ子になる。
    // pre は overflow-x: auto でスクロールするため、ボタンはその外側に置く。
    const mount = pre.parentElement.classList.contains('highlight') ? pre.parentElement : pre;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.textContent = 'copy/';
    btn.setAttribute('aria-label', 'Copy code to clipboard');

    let timer;
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(code.innerText).then(() => {
        btn.textContent = 'copied/';
        clearTimeout(timer);
        timer = setTimeout(() => { btn.textContent = 'copy/'; }, 1500);
      });
    });
    mount.appendChild(btn);
  });
})();
