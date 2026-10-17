/* タイトル直下の共有チップ（share.html）。リンク型のネットワークは素の <a> で動くので、
 * ここでは操作型の 2 つだけを扱う:
 *   [data-share-copy]   記事 URL を clipboard へコピーし、is-copied でチェック印に切り替えて伝える
 *   [data-share-native] Web Share API（navigator.share）で端末の共有シートを開く
 * どちらも非対応環境ではチップごと消す（<li> を hidden にする）。
 * site.Params.showShare が真のときだけ scripts.html がこのファイルをバンドルに含める。 */
(() => {
  document.querySelectorAll('[data-share]').forEach((nav) => {
    const url = nav.dataset.shareUrl;
    const title = nav.dataset.shareTitle;
    const hide = (btn) => { (btn.closest('li') || btn).hidden = true; };

    nav.querySelectorAll('[data-share-copy]').forEach((btn) => {
      if (!navigator.clipboard) { hide(btn); return; }
      const label = btn.getAttribute('aria-label');
      let timer;
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(url).then(() => {
          btn.classList.add('is-copied');
          btn.setAttribute('aria-label', 'Copied');
          clearTimeout(timer);
          timer = setTimeout(() => {
            btn.classList.remove('is-copied');
            btn.setAttribute('aria-label', label);
          }, 1500);
        });
      });
    });

    nav.querySelectorAll('[data-share-native]').forEach((btn) => {
      if (!navigator.share) { hide(btn); return; }
      btn.addEventListener('click', () => {
        navigator.share({ title, url }).catch(() => { /* キャンセルは無視 */ });
      });
    });
  });
})();
