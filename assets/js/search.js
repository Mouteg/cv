/* 検索ページ用。/index.json を取得し、依存ライブラリ無しで全文検索する。
 * スペース区切りの語をすべて含む記事（AND）を、出現箇所で重み付けして並べる。
 * URL の ?q= で初期クエリを受け取る（共有・ブックマーク用）。
 *
 * 照合の前に両辺を正規化する: NFKC（全角/半角・互換文字）→ 小文字 → カタカナをひらがなに →
 * ダイアクリティカルマーク除去。語が 4 文字以上なら編集距離 1（8 文字以上は 2）までの
 * 近似部分一致（Sellers 法）も許し、完全一致より低い得点で拾う。
 *
 * より高機能な検索が必要になったら、ビルド後に索引を作る Pagefind 等への
 * 差し替えを検討する。その場合もこのページ構造（#search-input / #search-results）は流用できる。 */
(() => {
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const count = document.getElementById('search-count');
  if (!input || !results) return;

  const normalize = (s) =>
    String(s)
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .normalize('NFC');

  // 許容する編集距離。短い語（日本語の 2〜3 文字語など）は誤爆が多いので完全一致のみ。
  const tolerance = (term) => (term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0);

  // text のいずれかの部分文字列と pat との最小編集距離を返す（k を超えたら k + 1）。
  // 完全一致は includes で先に拾い、DP は近似一致が必要なときだけ回す。
  function distance(text, pat, k) {
    if (text.includes(pat)) return 0;
    if (!k) return k + 1;
    const m = pat.length;
    let prev = Array.from({ length: m + 1 }, (_, i) => i);
    let cur = new Array(m + 1);
    let best = k + 1;
    for (let j = 0; j < text.length; j++) {
      const c = text.charCodeAt(j);
      cur[0] = 0;
      for (let i = 1; i <= m; i++) {
        const cost = pat.charCodeAt(i - 1) === c ? 0 : 1;
        cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + cost);
      }
      if (cur[m] < best) best = cur[m];
      [prev, cur] = [cur, prev];
    }
    return best;
  }

  let docs = [];
  const ready = fetch(input.dataset.index)
    .then((r) => r.json())
    .then((d) => {
      docs = d.map((doc) => ({
        doc,
        title: normalize(doc.title),
        tags: (doc.tags || []).map(normalize),
        body: normalize(`${doc.summary} ${doc.content}`),
      }));
    })
    .catch(() => { docs = []; });

  const escapeHTML = (s) =>
    String(s).replace(/[&<>"]/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render(matches, q) {
    results.innerHTML = matches
      .map(
        (m) => `<li>
          <a href="${m.url}">${escapeHTML(m.title)}</a>
          <span class="post-list-date">${escapeHTML(m.date)}</span>
        </li>`
      )
      .join('');
    if (count) {
      count.textContent = q
        ? `${matches.length} result${matches.length === 1 ? '' : 's'}`
        : '';
    }
  }

  // 順位: まず完全一致した語の数、次にフィールド得点（タイトル 3 / タグ 2 / 本文 1 を
  // 編集距離に応じて減らして加算）。近似一致の加点だけでは完全一致を抜けない。
  function search(q) {
    const terms = normalize(q).split(/\s+/).filter(Boolean);
    if (!terms.length) { render([], ''); return; }

    const scored = [];
    for (const d of docs) {
      let score = 0;
      let exact = 0;
      let matchedAll = true;
      for (const t of terms) {
        const k = tolerance(t);
        const dTitle = distance(d.title, t, k);
        const dTags = d.tags.reduce((min, tag) => Math.min(min, distance(tag, t, k)), k + 1);
        const dBody = distance(d.body, t, k);
        const best = Math.min(dTitle, dTags, dBody);
        if (best > k) { matchedAll = false; break; }
        if (best === 0) exact++;
        const credit = (dist) => (dist > k ? 0 : 1 - dist / (k + 1));
        score += 3 * credit(dTitle) + 2 * credit(dTags) + credit(dBody);
      }
      if (matchedAll) scored.push({ doc: d.doc, exact, score });
    }
    scored.sort((a, b) => b.exact - a.exact || b.score - a.score);
    render(scored.map((s) => s.doc), q);
  }

  // 近似一致の DP は本文全体を走査するので、連続入力は少し待ってまとめて処理する。
  let timer;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { ready.then(() => search(input.value.trim())); }, 80);
  });

  const q0 = new URLSearchParams(location.search).get('q');
  if (q0) {
    input.value = q0;
    ready.then(() => search(q0.trim()));
  }
})();
