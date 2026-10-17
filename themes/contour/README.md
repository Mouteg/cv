# Contour

[English](README.md) | [日本語](README.ja.md)

A stylish Hugo theme that blends contour-line motifs with typography.

- Built on Hugo's new template system (`baseof.html` / `home.html` /
  `page.html` / `section.html` / `taxonomy.html` / `term.html`, with the
  reserved `_partials` and `_markup` directories).
- Supports tags, archives, and full-text search out of the box.
- Bundles CSS and JavaScript with Hugo Pipes. Production builds are minified,
  fingerprinted, and served with SRI metadata.
- Headings share one design at every level, each with an anchor link (`#`)
  added by `_markup/render-heading.html`.

## Requirements

Hugo **extended** v0.160.0 or later: the new template system and `.Language.Locale`.

## Live Demo

https://mobiusone-org.github.io/hugo-contour/

## Local Demo (exampleSite)

This repository includes an `exampleSite/`. Clone this repository as `contour`,
then preview the bundled example site from the repository root:

```bash
cd exampleSite
hugo server --themesDir ../..
```

## Installation

```bash
git submodule add https://github.com/mobiusone-org/hugo-contour.git themes/contour
```

Then set `theme = "contour"` in your `hugo.toml`.

> **Note:** The folder name must match `theme = "contour"`. The repository is
> named `hugo-contour`, but the theme folder must be `contour`:
>
> ```bash
> # ✅ correct — folder matches theme = "contour"
> git submodule add https://github.com/mobiusone-org/hugo-contour.git themes/contour
>
> # ❌ wrong — folder name does not match theme = "contour"
> git submodule add https://github.com/mobiusone-org/hugo-contour.git themes/hugo-contour
> ```

## Configuration

```toml
defaultContentLanguage = "en"
locale = "en-US"
title = "MobiusOne.org"
theme = "contour"

[taxonomies]               # Standard taxonomies. /tags/ is generated automatically.
  tag = "tags"
  category = "categories"

[outputs]                  # Generate /index.json for the search index.
  home = ["html", "json"]

[params]
  logoName = "MobiusOne"        # Bold part of the logo
  logoTLD = ".org"              # Lighter suffix shown after the logo name
  kicker = "Software Engineering - Est. 2014"
  description = "Site description."
  author = "Your Name"                        # author meta and JSON-LD author
  images = ["/images/og-default.png"]         # Default share-preview image (under static/)
  axis = "Elevation / Isoline Field - N=54"   # Map-style decorative label
  coords = "35.6812 deg N - 139.7671 deg E"   # Initial coordinates, refreshed on click

# Use pageRef to connect menu items to real pages.
[[menu.main]]
  name = "Posts"
  pageRef = "/posts"
  weight = 1
[[menu.main]]
  name = "Tags"
  pageRef = "/tags"
  weight = 5
```

## Content

| File | Layout | Purpose |
|---|---|---|
| `content/_index.md` | `home.html` | Landing page with full-screen contour lines and the menu |
| `content/posts/_index.md` | `section.html` | Post list |
| `content/posts/*.md` | `page.html` | Article pages with a left sidebar and body content |
| `content/feature.md` | `page.html` | Standalone page without date or reading time |
| `content/archives.md` | `archives.html` | Yearly article archive (`layout = "archives"`) |
| `content/search.md` | `search.html` | Full-text search (`layout = "search"`) |
| Generated automatically | `taxonomy.html` / `term.html` | `/tags/` and `/tags/<tag>/` |

Every heading rendered from Markdown gets an `id` and a trailing `#` link to
itself (`.heading-anchor`): always visible, light-weight and dimmed, on the
heading's baseline. It is the heading's own size, except on the large h2 where
it is 0.8em. Set `showHeadingAnchors = false` in
`[params]` to omit the link.

For pages in the `posts/` section, `page.html` displays the date, reading time,
tags, and previous/next navigation. For standalone pages at the content root,
such as `feature.md`, it only displays the title and body.

### Search

Add `json` to the `home` output in `hugo.toml` to generate `/index.json` from
posts. The index contains each post's title, tags, summary, and body text.
`content/search.md` (`layout = "search"`) provides a dependency-free client-side
search UI, and `assets/js/search.js` is loaded only on the search page. You can
also pass an initial query with `?q=...`.

Matching is normalized on both sides: Unicode NFKC (full-width/half-width
forms), case folding, katakana → hiragana, and diacritics removal, so `ＨＵＧＯ`,
`hugo` and `Hugo` are the same query and `いんすとーる` finds `インストール`. Terms of
4 characters or more also match within one edit (two for 8+ characters), so a
one-letter typo such as `Gatewey` still finds `Gateway`. Exact matches rank
above approximate ones; shorter terms must match exactly. All terms must match
(AND), and results are weighted title > tags > body.

For larger search indexes, you can replace this with
[Pagefind](https://pagefind.app/) or a similar tool while keeping the same page
structure.

Post front matter:

```yaml
---
title: "Post title"
date: 2026-06-12
tags: ["graphics", "canvas"]
---
```

### Share buttons

Set `showShare = true` to place a row of share chips under the title of every
post. Every chip is the same square as the theme toggle, holds only an icon
drawn in `currentColor`, and names its target in a tooltip and `aria-label`:

```toml
[params]
  showShare = true
  # Optional: pick networks and their order. This is the default set.
  shareNetworks = ["x", "bluesky", "hackernews", "reddit", "copy", "native"]
```

Available networks: `x`, `bluesky`, `threads`, `mastodon`, `hatena`, `hackernews`,
`reddit`, `facebook`, `line`, `telegram`, `whatsapp`, `mail`, plus two actions handled
by `assets/js/share.js`: `copy` copies the post URL to the clipboard (the icon
flips to a check mark) and `native` opens the device share sheet via the Web
Share API. Both hide themselves where the browser lacks support.
`shareNetworks` can be set per language, e.g. to add `hatena` only for Japanese.

Per page, `share = false` in front matter hides the row; `share = true` shows
it on a standalone page outside `posts/`, where it is normally omitted.

Brand icons are taken from [Simple Icons](https://simpleicons.org/) (CC0 1.0)
and inlined in `_partials/share-icons.html`; the logos remain trademarks of
their owners, so check each brand's guidelines for the networks you enable.
LinkedIn is not offered because its terms do not permit third-party use of the
logo, which is why Simple Icons dropped it. The `mail`, `copy` and `native`
icons are the theme's own line drawings.

### SEO metadata

`_partials/seo.html` adds search-engine and share-preview metadata to the
`<head>` of every page. Nothing needs to be enabled; it reads the existing
`description`, `author` and `images` params.

- `description` meta and `og:description`: front matter `description`, then
  (for posts) a 160-character plain-text summary, then `params.description`.
  The summary can pick up headings, so a `description` in front matter is the
  reliable option.
- `<link rel="canonical">`.
- `robots`: the search page and 404 are `noindex`; front matter `robots`
  overrides it.
- `hreflang` links when translations exist, with the default language as
  `x-default`.
- Open Graph: `og:type` is `article` for posts and `website` elsewhere;
  `og:locale` comes from the language's `locale`. Posts also get
  `article:published_time` / `modified_time` / `section` / `tag`.
- A representative `og:image` (with width / height when they can be read),
  resolved from front matter `images` (list) or `image`, then a bundle image
  named `*feature*` / `*cover*` / `*thumbnail*`, then `params.images`. The
  recommended size is 1200×630.
- `twitter:card`: `summary_large_image` for landscape images, `summary` for
  square ones. Other values are omitted because X falls back to `og:*`.
- JSON-LD: `WebSite` on the home page and `BlogPosting` for pages under
  `posts/` (headline, datePublished, dateModified, author, image, keywords).

### Images (plates)

Markdown images in the body are rendered as *plates*: framed by L-shaped corner
marks cut from the same stock as the contour-frame `+` marks (16px, 1px,
`currentColor`), with the image inset from the frame. A `title` becomes a
caption in the measurement-label style:

```markdown
![Waves breaking on a shore at dusk](waves.webp "Sea level — the 0 m isoline")
```

The source is resolved against the page bundle first, then global `assets/`;
when found, the resource's URL and intrinsic `width`/`height` are emitted to
avoid layout shift. Absolute paths (`/images/...`) are assumed to live in the
site's `static/` directory and get their dimensions via `imageConfig`. When
dimensions cannot be determined (remote URLs, SVG, a non-default `staticDir`),
the attributes are simply omitted. See the marching-squares post in the
exampleSite for a live example.

## Customizing Contour Lines

Pass options through data attributes on `canvas[data-contour]`:

- `data-color="--bg-rgb"`: Line color, either a CSS custom property name or an
  `"r, g, b"` value.
- `data-cell="10"`: Grid cell size in CSS pixels. Smaller values produce finer
  detail.

Change colors with `--bg` / `--fg` in `assets/css/base.css`. Their RGB
counterparts, `--bg-rgb` / `--fg-rgb`, are used by the canvas renderer and must
stay in sync.

## License

MIT
