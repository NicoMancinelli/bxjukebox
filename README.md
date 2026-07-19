# BX Jukebox 🎵

A zero-server media player and modern "Jukebox" for [Boxden](https://boxden.com). Ships two ways from one codebase: a **Tampermonkey/Violentmonkey userscript** and a **Chrome extension** — everything runs in the browser, no hosting, no backend, no cost.

```
bxjukebox/
├── bx-jukebox.user.js   ← the whole player (userscript AND extension core)
├── extension/           ← MV3 Chrome extension (manifest + build.sh)
└── demo/                ← self-contained mock-Boxden demo site
```

## Features

- **📺 Theater overlay** — full-screen dark player launched from a floating button on any subforum page. Three panels: playlist, player, reactions.
- **Playlist from the page** — scans the thread list and lazily pulls each thread's media (YouTube, Streamable, Vimeo, SoundCloud) as iframes, plain links, or raw URLs. The next track is **prefetched** so skipping is instant.
- **🎬 Every clip in the thread** — all videos/songs across all posts (OP *and* replies) are collected into a clip strip under the player; Next/Prev and autoplay walk through a thread's clips before moving to the next thread, and queue rows show an "N clips" badge.
- **📁 Section switcher** — hop between Hip-Hop / Sports / News etc. from a dropdown without leaving the player (sections are auto-discovered from the page's `forumdisplay.php?f=` links).
- **⤵ Load more** — follows the forum's pagination to append page 2, 3, … to the queue.
- **🔥 Hot filter** — crowdsourced Jukebox: filters/sorts by thread Props (≥ 15, top 20; falls back to top-20-by-props).
- **🔎 Search** — live-filter the queue by title.
- **⏭ Autoplay & 🔀 Shuffle** — YouTube tracks auto-advance when they end (YT iframe API over postMessage); both toggles persist across sessions via `localStorage`. Media-less threads are skipped during auto-advance.
- **💬 BX Reactions** — first ~10 comments from the playing thread, rendered beside the player (HTML-escaped).
- **🎧 Jukebox Mode** — audio-only: collapses the video, keeps the track playing.
- **Pop Out** — Document Picture-in-Picture floating window.
- **Keyboard**: `N` next · `P` prev · `S` shuffle · `A` audio mode · `Esc` close.

## Try the demo

No Boxden needed — the repo includes a mock forum:

```bash
npx -y http-server -p 8123 -c-1 .
# open http://localhost:8123/demo/index.html
```

The Jukebox auto-opens over a fake Hip-Hop section with real playable YouTube embeds, a second page (Load more), and Sports/News sections for the switcher.

## Install (userscript)

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Dashboard → **Create a new script** → paste [`bx-jukebox.user.js`](bx-jukebox.user.js) → save. (Once on GitHub, the raw file URL installs in one click.)
3. Open any Boxden section (`boxden.com/forumdisplay.php?f=…`) → **📺 Launch BX Jukebox**.

## Install (Chrome extension)

```bash
./extension/build.sh     # copies the userscript in as content.js
```

Then `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `extension/` folder. The same file works in both environments because the fetch layer (`bxFetch`) uses `GM_xmlhttpRequest` when available and falls back to `window.fetch` (the extension's `host_permissions` covers boxden.com). Re-run `build.sh` after editing the userscript.

To distribute to other BX users: zip the `extension/` folder for the Chrome Web Store (one-time $5 dev fee) or share the raw userscript link in a thread.

## Tuning

Constants at the top of the script:

| Constant | Default | Meaning |
|---|---|---|
| `settings.hotThreshold` | 15 | Min props for the 🔥 Hot filter (persisted) |
| `MAX_REACTIONS` | 10 | Comments shown in the Reactions drawer |
| `REACTION_MAX_CHARS` | 180 | Truncation length per comment |

## Notes / caveats

- Selectors target standard vBulletin structure (`thread_title_*` anchors, `.post_message`, `.post_container`) with fallbacks, but Boxden's markup may drift — if the playlist comes up empty, adjust `scanDoc()` / `renderReactions()`.
- Autoplay-on-end works for YouTube embeds; Streamable/Vimeo need a manual **Next ▶** (`N`).
- Cloudflare is a non-issue: requests come from your own logged-in browser session.
- `demo/demo-shim.js` is demo-only plumbing (maps mock vBulletin URLs to fixture files); it never ships to users.
