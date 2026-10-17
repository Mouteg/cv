# Contour

[English](README.md) | [日本語](README.ja.md)

等高線をモチーフにTypographyを取り込んだスタイリッシュなHugoテーマ。

- Hugo の新しいテンプレートシステム（`baseof.html` / `home.html` / `page.html` /
  `section.html` / `taxonomy.html` / `term.html`、予約ディレクトリ `_partials` と `_markup`）に準拠。
- タグ（タクソノミー）・アーカイブ・全文検索を標準でサポート。
- CSS / JS は Hugo Pipes で結合。本番ビルドでは minify + fingerprint + SRI。
- 見出しはレベルを問わず同じデザインで、各見出しのアンカーリンク（`#`）は
  `_markup/render-heading.html` が自動付与。

## 必要環境

Hugo **extended** v0.160.0 以降（新テンプレートシステムと `.Language.Locale` のため）。

## LiveDemo

https://mobiusone-org.github.io/hugo-contour/

## LocalDemo（exampleSite）

このリポジトリには `exampleSite/` が同梱されている。
このリポジトリを`contour`としてcloneした後、 リポジトリ直下からテーマを読み込んでプレビューできる:

```bash
cd exampleSite
hugo server --themesDir ../..
```

## インストール

```bash
git submodule add https://github.com/mobiusone-org/hugo-contour.git themes/contour
```

`hugo.toml` に `theme = "contour"` を設定する。

> **注意:** フォルダ名は `theme = "contour"` と一致させること。リポジトリ名は
> `hugo-contour` だが、テーマフォルダ名は `contour` にする必要がある:
>
> ```bash
> # ✅ 正: フォルダ名が theme = "contour" と一致
> git submodule add https://github.com/mobiusone-org/hugo-contour.git themes/contour
>
> # ❌ 誤: フォルダ名が theme = "contour" と一致しない
> git submodule add https://github.com/mobiusone-org/hugo-contour.git themes/hugo-contour
> ```

## 設定

```toml
defaultContentLanguage = "ja"
locale = "ja-JP"
title = "MobiusOne.org"
theme = "contour"

[taxonomies]               # 標準的な分類。タグ一覧 /tags/ が自動生成される。
  tag = "tags"
  category = "categories"

[outputs]                  # /index.json を検索インデックスとして出力する。
  home = ["html", "json"]

[params]
  logoName = "MobiusOne"        # ロゴの太字部分
  logoTLD = ".org"              # ロゴ末尾の細字（TLD）
  kicker = "Software Engineering — Est. 2014"
  description = "サイトの説明。"
  author = "Your Name"                        # author メタと JSON-LD の著者
  images = ["/images/og-default.png"]         # 共有プレビュー画像の既定（static/ 配下）
  axis = "Elevation / Isoline Field — N=54"   # 地図ふう装飾ラベル
  coords = "35.6812° N — 139.7671° E"          # 座標表示の初期値（クリックで更新）

# メニューは pageRef で実ページに結ぶ（タグ一覧は /tags、検索は /search …）。
[[menu.main]]
  name = "Posts"
  pageRef = "/posts"
  weight = 1
[[menu.main]]
  name = "Tags"
  pageRef = "/tags"
  weight = 5
```

## コンテンツ

| ファイル | レイアウト | 用途 |
|---|---|---|
| `content/_index.md` | `home.html` | ランディング（全画面の等高線＋メニュー） |
| `content/posts/_index.md` | `section.html` | 記事一覧 |
| `content/posts/*.md` | `page.html` | 記事ページ（左サイドバー＋本文） |
| `content/feature.md` | `page.html` | 単体ページ（日付・読了時間は出さない） |
| `content/archives.md` | `archives.html` | 年ごとの記事アーカイブ（`layout = "archives"`） |
| `content/search.md` | `search.html` | 全文検索（`layout = "search"`） |
| 自動生成 | `taxonomy.html` / `term.html` | `/tags/`・`/tags/<tag>/` |

`page.html` はセクション内の記事（`posts/`）では日付・読了時間・タグ・前後ナビを出し、
ルート直下の単体ページ（`feature.md` など）では見出しと本文だけにする。

Markdown から描かれる見出しには `id` と、自身を指す `#` リンク（`.heading-anchor`）が付く。
見出しと同じ大きさ（大きな h2 だけ 0.8 倍）でベースラインに揃え、細字・半透明で常時表示する。
`[params]` の `showHeadingAnchors = false` で消せる。

### 検索

`hugo.toml` の `[outputs]` で `home` に `json` を足すと、`posts` セクションの記事から
`/index.json`（タイトル・タグ・要約・本文）が生成される。`content/search.md`
（`layout = "search"`）が依存ライブラリ無しのクライアント検索 UI を提供し、検索ページの
ときだけ `assets/js/search.js` が読み込まれる。`?q=...` で初期クエリを渡せる。

照合は両辺を正規化してから行う: Unicode NFKC（全角/半角）、大文字小文字、カタカナ→ひらがな、
ダイアクリティカルマーク除去。`ＨＵＧＯ` / `hugo` / `Hugo` は同じクエリになり、`いんすとーる` で
`インストール` が見つかる。4 文字以上の語は編集距離 1（8 文字以上は 2）までの近似一致も拾うので、
`Gatewey` のような 1 文字のタイプミスでも `Gateway` に届く。完全一致は近似一致より上位に並び、
短い語は完全一致のみ。語はすべて含む必要があり（AND）、タイトル > タグ > 本文の重みで並べる。
より大規模な索引が必要なら、同じページ構造のまま [Pagefind](https://pagefind.app/)
等への差し替えも可能。

記事の front matter:

```yaml
---
title: "記事タイトル"
date: 2026-06-12
tags: ["graphics", "canvas"]
---
```

### 共有ボタン

`showShare = true` を設定すると、各記事のタイトル直下に共有チップの行が付きます。
チップはテーマ切り替えボタンと同じ正方形で、中身は `currentColor` で描いた
アイコンだけです。共有先の名前はツールチップと `aria-label` で伝えます。

```toml
[params]
  showShare = true
  # 任意: 表示するネットワークと順序。以下が既定値。
  shareNetworks = ["x", "bluesky", "hackernews", "reddit", "copy", "native"]
```

使えるネットワーク: `x`, `bluesky`, `threads`, `mastodon`, `hatena`, `hackernews`,
`reddit`, `facebook`, `line`, `telegram`, `whatsapp`, `mail`。加えて `assets/js/share.js` が動かす
操作が 2 つあり、`copy` は記事 URL をクリップボードへコピーし（アイコンがチェック印に
変わります）、`native` は Web Share API で端末の共有シートを開きます。どちらも
ブラウザが非対応なら自動的に消えます。`shareNetworks` は言語ごとにも設定でき、
日本語だけ `hatena` を足すといった使い方ができます。

ページ単位では front matter の `share = false` で非表示に、`posts/` 外の
単独ページでは `share = true` で表示にできます。

ブランドアイコンは [Simple Icons](https://simpleicons.org/)（CC0 1.0）から取り込み、
`_partials/share-icons.html` にインライン化しています。ロゴの商標は各社に帰属する
ため、有効にするネットワークについては各ブランドのガイドラインを確認してください。
LinkedIn は利用規約が第三者によるロゴ使用を認めておらず（Simple Icons が削除した
理由も同じ）、提供していません。`mail` / `copy` / `native` のアイコンはテーマ独自の
線画です。

### SEO メタデータ

`_partials/seo.html` が全ページの `<head>` に、検索エンジンと共有プレビュー向けの
メタデータを出します。設定は不要で、既存の `description` / `author` / `images` を読みます。

- `description` メタと `og:description`。front matter の `description` →（記事なら）本文の要約
  160 字 → `params.description` の順で決めます。要約は見出しが混ざるので、記事には
  `description` を書くのが確実です。
- `<link rel="canonical">`。
- `robots`。検索ページと 404 は `noindex`。front matter の `robots` で上書きできます。
- 翻訳版がある場合の `hreflang`（既定言語を `x-default` として併記）。
- Open Graph（`og:type` は記事なら `article`、他は `website`。`og:locale` は言語の
  `locale` から）。記事には `article:published_time` / `modified_time` / `section` / `tag` も。
- 代表画像 `og:image`（実寸が分かれば width / height も）。探す順は front matter の
  `images`（配列）または `image` → ページバンドル内の `*feature*` / `*cover*` / `*thumbnail*`
  画像 → `params.images`。`og:image` 推奨サイズは 1200×630 です。
- `twitter:card`。横長の画像なら `summary_large_image`、正方形などは `summary`。
  他の値は `og:*` が読まれるので出しません。
- JSON-LD。ホームは `WebSite`、`posts/` 配下の記事は `BlogPosting`
  （headline / datePublished / dateModified / author / image / keywords）。

### 画像（図版）

本文中の Markdown 画像は「図版（plate）」として表示される。等高線フレームの
+ マークと同じ部材（16px・1px・`currentColor`）から切り出した L 字マークが四隅を
囲み、画像はその内側に少し余白を取って収まる。`title` を書くと計測ラベル体裁の
キャプションになる:

```markdown
![夕暮れの浜に崩れる波](waves.webp "海面 — 標高 0 m の等値線")
```

src はまずページバンドル、次にグローバル `assets/` から解決され、見つかれば
そのリソースの URL と実寸（`width`/`height`）が出力されてレイアウトシフトを防ぐ。
絶対パス（`/images/...`）はサイトの `static/` 直下にあるとみなして `imageConfig`
で実寸を取得する。実寸が取れない場合（リモート URL・SVG・既定外の `staticDir`
など）は属性を出さないだけで、表示は壊れない。実例は exampleSite の
marching-squares 記事を参照。

## 等高線のカスタマイズ

`canvas[data-contour]` に data 属性で渡す:

- `data-color="--bg-rgb"` — 線色（CSS カスタムプロパティ名、または `"r, g, b"`）
- `data-cell="10"` — グリッドセルの大きさ (css px、小さいほど高精細)

配色は `assets/css/base.css` の `--bg` / `--fg`（および `--bg-rgb` / `--fg-rgb`）で変える。
RGB 版は描画に使うので必ず一致させること。

## ライセンス

MIT
