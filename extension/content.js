// ==UserScript==
// @name         Boxden Modern Jukebox & Media Player
// @namespace    https://github.com/neek/bxjukebox
// @version      1.2.0
// @description  Zero-server media player for Boxden: section playlists, Hot 🔥 props filter, shuffle, autoplay queue, search, BX Reactions drawer, audio-only Jukebox mode, and Picture-in-Picture.
// @author       Nico
// @match        https://boxden.com/forumdisplay.php*
// @match        https://www.boxden.com/forumdisplay.php*
// @match        https://boxden.com/showthread.php*
// @match        https://www.boxden.com/showthread.php*
// @grant        GM_xmlhttpRequest
// @connect      boxden.com
// @connect      www.boxden.com
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ------------------------------------------------------------------
    // Config & persisted settings
    // ------------------------------------------------------------------
    const MAX_REACTIONS = 10;         // comments shown in the drawer
    const REACTION_MAX_CHARS = 180;
    const SETTINGS_KEY = 'bxJukeboxSettings';

    const settings = Object.assign(
        { autoplay: true, shuffle: false, hotThreshold: 15 },
        (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })()
    );
    function saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ }
    }

    // ------------------------------------------------------------------
    // Styles
    // ------------------------------------------------------------------
    const styles = `
        #bx-player-root {
            --bx-bg: #0b0b0d;
            --bx-panel: #131316;
            --bx-card: #1c1c21;
            --bx-card-hover: #232329;
            --bx-border: #26262c;
            --bx-text: #e9e9ec;
            --bx-muted: #8d8d96;
            --bx-faint: #5b5b64;
            --bx-accent: #ff4500;
            --bx-accent-soft: rgba(255, 69, 0, 0.12);
            position: fixed; inset: 0;
            background: var(--bx-bg);
            z-index: 100000; display: none;
            color: var(--bx-text);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px; line-height: 1.45;
        }
        #bx-player-root * { box-sizing: border-box; }
        #bx-player-root ::-webkit-scrollbar { width: 8px; }
        #bx-player-root ::-webkit-scrollbar-thumb { background: #2e2e35; border-radius: 4px; }
        #bx-player-root ::-webkit-scrollbar-thumb:hover { background: #3a3a42; }
        #bx-player-root button { font-family: inherit; }
        #bx-player-root button:focus-visible,
        #bx-player-root input:focus-visible,
        #bx-player-root select:focus-visible {
            outline: 2px solid var(--bx-accent); outline-offset: 1px;
        }

        /* ---- Top bar ---------------------------------------------- */
        .bx-topbar {
            height: 58px; display: flex; align-items: center; gap: 16px;
            padding: 0 20px; background: var(--bx-panel);
            border-bottom: 1px solid var(--bx-border);
        }
        .bx-brand { font-weight: 700; font-size: 1rem; letter-spacing: 0.01em; white-space: nowrap; }
        .bx-brand .bx-logo { color: var(--bx-accent); margin-right: 6px; }
        #bx-section-select {
            background: var(--bx-card); color: var(--bx-text);
            border: 1px solid var(--bx-border); border-radius: 8px;
            padding: 7px 10px; font-size: 0.86rem; cursor: pointer; max-width: 220px;
        }
        #bx-section-select:hover { border-color: #3a3a42; }
        #bx-count { color: var(--bx-muted); font-size: 0.8rem; white-space: nowrap; }
        .bx-spacer { flex: 1; }
        .bx-close-btn {
            width: 34px; height: 34px; border-radius: 8px; border: none;
            background: transparent; color: var(--bx-muted);
            font-size: 1rem; cursor: pointer; line-height: 1;
        }
        .bx-close-btn:hover { background: var(--bx-card); color: #fff; }

        /* ---- Layout ------------------------------------------------ */
        .bx-layout { display: flex; width: 100%; height: calc(100% - 58px); }
        .bx-sidebar {
            width: 320px; background: var(--bx-panel); border-right: 1px solid var(--bx-border);
            display: flex; flex-direction: column; padding: 16px; gap: 10px; min-width: 0;
        }
        .bx-main {
            flex: 1; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 32px 40px 56px; position: relative; min-width: 0;
        }
        .bx-reactions {
            width: 320px; background: var(--bx-panel); border-left: 1px solid var(--bx-border);
            display: flex; flex-direction: column; padding: 16px; gap: 10px; min-width: 0;
        }
        .bx-panel-label {
            font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em;
            text-transform: uppercase; color: var(--bx-faint); padding: 2px 2px 0;
            flex-shrink: 0;
        }

        /* ---- Sidebar controls -------------------------------------- */
        #bx-search-wrap { position: relative; flex-shrink: 0; }
        #bx-search {
            width: 100%; background: var(--bx-card); color: var(--bx-text);
            border: 1px solid var(--bx-border); border-radius: 8px;
            padding: 8px 30px 8px 12px; font-size: 0.86rem;
        }
        #bx-search::placeholder { color: var(--bx-faint); }
        #bx-search-clear {
            position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
            width: 24px; height: 24px; border: none; border-radius: 6px;
            background: transparent; color: var(--bx-muted); cursor: pointer;
            display: none; font-size: 0.8rem; line-height: 1;
        }
        #bx-search-clear:hover { color: #fff; background: var(--bx-card-hover); }
        .bx-seg {
            display: flex; background: var(--bx-card); border-radius: 8px;
            padding: 3px; gap: 3px; flex-shrink: 0; border: 1px solid var(--bx-border);
        }
        .bx-seg button {
            flex: 1; border: none; background: transparent; color: var(--bx-muted);
            padding: 6px 0; border-radius: 6px; font-size: 0.8rem; font-weight: 600;
            cursor: pointer; transition: background .15s, color .15s;
        }
        .bx-seg button:hover { color: var(--bx-text); }
        .bx-seg button.bx-toggled { background: #2c2c33; color: #fff; }

        /* ---- Playlist ---------------------------------------------- */
        .bx-list { list-style: none; padding: 0; margin: 0; overflow-y: auto; flex: 1; }
        .bx-list-item {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 10px; border-radius: 8px; cursor: pointer;
            margin-bottom: 2px; font-size: 0.87rem;
            border-left: 2px solid transparent;
            transition: background 0.12s;
        }
        .bx-list-item:hover { background: var(--bx-card); }
        .bx-list-item.active {
            background: var(--bx-accent-soft);
            border-left-color: var(--bx-accent);
        }
        .bx-list-item.bx-no-media { opacity: 0.4; }
        .bx-idx {
            width: 18px; flex-shrink: 0; text-align: right;
            color: var(--bx-faint); font-size: 0.75rem; font-variant-numeric: tabular-nums;
        }
        .bx-list-item.active .bx-idx { color: var(--bx-accent); }
        .bx-track-title-text {
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
        }
        .bx-props-badge {
            color: var(--bx-muted); font-size: 0.72rem; font-weight: 600;
            flex-shrink: 0; font-variant-numeric: tabular-nums;
        }
        .bx-list-item.active .bx-props-badge { color: var(--bx-accent); }
        #bx-load-more {
            flex-shrink: 0; width: 100%;
            background: transparent; color: var(--bx-muted);
            border: 1px dashed var(--bx-border);
            border-radius: 8px; padding: 9px; cursor: pointer; font-size: 0.8rem;
        }
        #bx-load-more:hover:not(:disabled) { color: var(--bx-text); border-color: #3a3a42; background: var(--bx-card); }
        #bx-load-more:disabled { opacity: 0.35; cursor: default; }

        /* ---- Stage -------------------------------------------------- */
        .bx-video-container {
            width: 100%; max-width: 860px; aspect-ratio: 16/9;
            background: #000; border-radius: 12px; overflow: hidden;
            border: 1px solid var(--bx-border);
            box-shadow: 0 20px 50px rgba(0,0,0,0.45);
        }
        .bx-video-container iframe { width: 100%; height: 100%; border: none; display: block; }
        #bx-player-root.bx-audio-mode .bx-video-container {
            position: absolute; width: 1px; height: 1px;
            opacity: 0.01; pointer-events: none; bottom: 0; left: 0;
        }
        #bx-audio-badge {
            display: none; align-items: center; gap: 12px;
            background: var(--bx-card); border: 1px solid var(--bx-border);
            border-radius: 12px; padding: 26px 34px; font-size: 0.95rem; color: var(--bx-muted);
        }
        #bx-player-root.bx-audio-mode #bx-audio-badge { display: inline-flex; }
        .bx-eq { display: inline-flex; gap: 3px; align-items: flex-end; height: 20px; }
        .bx-eq span {
            width: 4px; background: var(--bx-accent); border-radius: 2px;
            animation: bx-eq-bounce 1s ease-in-out infinite;
        }
        .bx-eq span:nth-child(2) { animation-delay: .2s; }
        .bx-eq span:nth-child(3) { animation-delay: .4s; }
        @keyframes bx-eq-bounce { 0%, 100% { height: 6px; } 50% { height: 20px; } }

        #bx-track-title {
            margin: 22px 0 0; font-size: 1.15rem; font-weight: 600; text-align: center;
            max-width: 860px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        #bx-thread-link {
            color: var(--bx-muted); font-size: 0.8rem; margin-top: 6px; text-decoration: none;
        }
        #bx-thread-link:hover { color: var(--bx-accent); }

        /* ---- Transport + toggles ------------------------------------ */
        .bx-controls {
            margin-top: 22px; display: flex; gap: 10px; align-items: center;
            flex-wrap: wrap; justify-content: center;
        }
        .bx-icon-btn {
            width: 46px; height: 46px; border-radius: 50%; border: 1px solid var(--bx-border);
            background: var(--bx-card); color: var(--bx-text); cursor: pointer;
            font-size: 1rem; display: inline-flex; align-items: center; justify-content: center;
            transition: background .15s, transform .1s;
        }
        .bx-icon-btn:hover { background: var(--bx-card-hover); }
        .bx-icon-btn:active { transform: scale(0.94); }
        .bx-icon-btn.bx-primary {
            background: var(--bx-accent); border-color: var(--bx-accent); color: #fff;
            width: 52px; height: 52px; font-size: 1.15rem;
        }
        .bx-icon-btn.bx-primary:hover { background: #e03d00; }
        .bx-controls-divider { width: 1px; height: 28px; background: var(--bx-border); margin: 0 6px; }
        .bx-chip {
            border: 1px solid var(--bx-border); background: var(--bx-card); color: var(--bx-muted);
            border-radius: 999px; padding: 7px 14px 7px 10px; cursor: pointer;
            font-size: 0.8rem; font-weight: 600;
            display: inline-flex; align-items: center; gap: 7px;
            transition: color .15s, border-color .15s, background .15s;
        }
        .bx-chip::before {
            content: ''; width: 7px; height: 7px; border-radius: 50%;
            background: var(--bx-faint); transition: background .15s;
        }
        .bx-chip:hover { color: var(--bx-text); background: var(--bx-card-hover); }
        .bx-chip.bx-toggled {
            color: var(--bx-text); border-color: rgba(255, 69, 0, 0.5);
            background: var(--bx-accent-soft);
        }
        .bx-chip.bx-toggled::before { background: var(--bx-accent); }
        .bx-chip.bx-plain { padding-left: 14px; }
        .bx-chip.bx-plain::before { display: none; }

        /* ---- Reactions ---------------------------------------------- */
        .bx-comment-card {
            background: var(--bx-card); padding: 10px 12px; border-radius: 10px;
            margin-bottom: 8px; font-size: 0.84rem; line-height: 1.45;
            word-wrap: break-word; display: flex; gap: 10px; align-items: flex-start;
        }
        .bx-avatar {
            width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
            background: #2c2c33; color: var(--bx-muted);
            display: flex; align-items: center; justify-content: center;
            font-size: 0.75rem; font-weight: 700; margin-top: 1px;
        }
        .bx-comment-body { min-width: 0; }
        .bx-comment-user { font-weight: 600; color: var(--bx-text); font-size: 0.8rem; margin-bottom: 2px; }
        .bx-comment-text { color: var(--bx-muted); }

        /* ---- States: empty / loading -------------------------------- */
        .bx-empty {
            text-align: center; margin: 28px 12px; color: var(--bx-faint); font-size: 0.84rem;
        }
        .bx-empty .bx-empty-icon { font-size: 1.6rem; display: block; margin-bottom: 8px; opacity: 0.8; }
        .bx-viewport-msg {
            display: flex; flex-direction: column; gap: 6px; height: 100%;
            align-items: center; justify-content: center; color: var(--bx-muted);
            font-size: 0.95rem; padding: 20px; text-align: center;
        }
        .bx-skeleton { position: relative; height: 100%; background: #101013; overflow: hidden; }
        .bx-skeleton::after {
            content: ''; position: absolute; inset: 0;
            background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.05) 50%, transparent 70%);
            animation: bx-shimmer 1.2s infinite;
        }
        .bx-skel-card { border-radius: 10px; height: 52px; margin-bottom: 8px; }
        @keyframes bx-shimmer { from { transform: translateX(-100%); } to { transform: translateX(100%); } }

        /* ---- Toast --------------------------------------------------- */
        #bx-toast {
            position: absolute; bottom: 52px; left: 50%; transform: translateX(-50%) translateY(8px);
            background: #232329; color: var(--bx-text); border: 1px solid var(--bx-border);
            border-radius: 10px; padding: 10px 16px; font-size: 0.84rem; max-width: 460px;
            opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4); z-index: 5; text-align: center;
        }
        #bx-toast.bx-show { opacity: 1; transform: translateX(-50%) translateY(0); }

        /* ---- Launch button & hints ----------------------------------- */
        #bx-launch-btn {
            position: fixed; bottom: 25px; right: 25px; z-index: 99999;
            background: #131316; color: #fff; border: 1px solid #26262c; border-radius: 999px;
            padding: 12px 20px; font-weight: 600; font-size: 0.9rem; cursor: pointer;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45); transition: transform 0.15s, border-color .15s;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: inline-flex; align-items: center; gap: 8px;
        }
        #bx-launch-btn .bx-logo { color: #ff4500; }
        #bx-launch-btn:hover { transform: translateY(-1px); border-color: #ff4500; }
        .bx-kbd-hint {
            position: absolute; bottom: 16px; left: 0; right: 0;
            text-align: center; color: var(--bx-faint); font-size: 0.72rem;
        }
        .bx-kbd-hint kbd {
            background: var(--bx-card); border: 1px solid var(--bx-border);
            border-radius: 4px; padding: 1px 6px; font-family: inherit; color: var(--bx-muted);
        }

        @media (max-width: 1100px) {
            .bx-reactions { display: none; }
            .bx-sidebar { width: 270px; }
            .bx-main { padding: 20px 24px 56px; }
        }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------
    let playlist = [];        // filtered view  { title, url, props, embedUrl|null|undefined }
    let fullPlaylist = [];    // unfiltered master list for the current source
    let currentIndex = -1;
    let hotMode = false;
    let searchQuery = '';
    let nextPageUrl = null;   // pagination cursor for "Load more"
    let loadToken = 0;        // invalidates stale async loads

    // ------------------------------------------------------------------
    // Fetch layer — works as a userscript (GM_xmlhttpRequest) or as a
    // plain content script / demo page (window.fetch).
    // ------------------------------------------------------------------
    function bxFetch(url) {
        if (typeof GM_xmlhttpRequest === 'function') {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url,
                    onload: (r) => (r.status >= 200 && r.status < 400) ? resolve(r.responseText) : reject(new Error(`HTTP ${r.status}`)),
                    onerror: () => reject(new Error('network error')),
                    ontimeout: () => reject(new Error('timeout')),
                    timeout: 20000
                });
            });
        }
        return fetch(url, { credentials: 'include' }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
        });
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function emptyState(icon, line, sub = '') {
        return `<div class="bx-empty"><span class="bx-empty-icon">${icon}</span>${escapeHtml(line)}${sub ? `<br><span style="font-size:0.76rem;">${escapeHtml(sub)}</span>` : ''}</div>`;
    }

    const VIEWPORT_SKELETON = '<div class="bx-skeleton"></div>';
    const REACTIONS_SKELETON = '<div class="bx-skeleton bx-skel-card"></div>'.repeat(3);

    let toastTimer = null;
    function toast(msg, ms = 3800) {
        const el = document.getElementById('bx-toast');
        el.textContent = msg;
        el.classList.add('bx-show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('bx-show'), ms);
    }

    // Turn a raw link or iframe src into a playable embed URL, or null.
    function toEmbedUrl(raw) {
        if (!raw) return null;
        try {
            const u = new URL(raw, location.origin);
            const host = u.hostname.replace(/^www\./, '');

            // YouTube — watch links, short links, and existing embeds
            if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
                let id = null;
                if (u.pathname === '/watch') id = u.searchParams.get('v');
                else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2];
                else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2];
                if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
            }
            if (host === 'youtu.be') {
                const id = u.pathname.slice(1).split('/')[0];
                if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(location.origin)}`;
            }
            // Streamable
            if (host === 'streamable.com') {
                const id = u.pathname.replace(/^\/(e|s|o)\//, '/').slice(1).split('/')[0];
                if (id) return `https://streamable.com/e/${id}?autoplay=1`;
            }
            // Vimeo
            if (host === 'vimeo.com') {
                const id = u.pathname.slice(1).split('/')[0];
                if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}?autoplay=1`;
            }
            if (host === 'player.vimeo.com') return raw;
            // SoundCloud embeds pass through
            if (host === 'w.soundcloud.com') return raw;
        } catch (e) { /* bad URL — ignore */ }
        return null;
    }

    // Find the best embed inside a thread's first post.
    function extractEmbedFromThreadDoc(doc) {
        const firstPost = doc.querySelector('.post_message, [id^="post_message_"]');
        if (!firstPost) return null;

        // 1. Real embeds already in the post
        const iframe = firstPost.querySelector(
            "iframe[src*='youtube'], iframe[src*='youtu.be'], iframe[src*='streamable'], iframe[src*='player.vimeo'], iframe[src*='w.soundcloud']"
        );
        if (iframe) {
            const normalized = toEmbedUrl(iframe.src);
            if (normalized) return normalized;
            return iframe.src;
        }

        // 2. Plain links to media sites
        const links = firstPost.querySelectorAll('a[href]');
        for (const a of links) {
            const embed = toEmbedUrl(a.href);
            if (embed) return embed;
        }

        // 3. Raw URLs in text (last resort)
        const m = firstPost.textContent.match(
            /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[\w-]+|youtu\.be\/[\w-]+|streamable\.com\/[\w-]+|vimeo\.com\/\d+)/
        );
        if (m) return toEmbedUrl(m[0]);

        return null;
    }

    // ------------------------------------------------------------------
    // UI scaffolding
    // ------------------------------------------------------------------
    const launchBtn = document.createElement('button');
    launchBtn.id = 'bx-launch-btn';
    launchBtn.innerHTML = '<span class="bx-logo">▶</span> BX Jukebox';
    document.body.appendChild(launchBtn);

    const playerRoot = document.createElement('div');
    playerRoot.id = 'bx-player-root';
    playerRoot.innerHTML = `
        <div class="bx-topbar">
            <div class="bx-brand"><span class="bx-logo">▶</span>BX Jukebox</div>
            <select id="bx-section-select" title="Jump to another section without leaving the player" aria-label="Section"></select>
            <span id="bx-count"></span>
            <span class="bx-spacer"></span>
            <button class="bx-close-btn" id="bx-close-player" title="Close (Esc)" aria-label="Close">✕</button>
        </div>
        <div class="bx-layout">
            <div class="bx-sidebar">
                <div class="bx-panel-label">Queue</div>
                <div id="bx-search-wrap">
                    <input id="bx-search" type="text" placeholder="Filter tracks…" autocomplete="off" aria-label="Filter tracks">
                    <button id="bx-search-clear" title="Clear" aria-label="Clear search">✕</button>
                </div>
                <div class="bx-seg" role="group" aria-label="Playlist filter">
                    <button id="bx-filter-all">All posts</button>
                    <button id="bx-filter-hot">🔥 Hot</button>
                </div>
                <ul class="bx-list" id="bx-playlist-ul"></ul>
                <button id="bx-load-more">Load more threads</button>
            </div>
            <div class="bx-main">
                <div class="bx-video-container" id="bx-player-viewport">
                    <div class="bx-viewport-msg">Pick a track from the queue to start the vibe</div>
                </div>
                <div id="bx-audio-badge">
                    <span class="bx-eq"><span></span><span></span><span></span></span>
                    <span>Audio only — track keeps playing while you browse</span>
                </div>
                <h2 id="bx-track-title"></h2>
                <a id="bx-thread-link" target="_blank" rel="noopener" style="display:none;">View original thread ↗</a>
                <div class="bx-controls">
                    <button class="bx-icon-btn" id="bx-prev-btn" title="Previous (P)" aria-label="Previous">◀</button>
                    <button class="bx-icon-btn bx-primary" id="bx-next-btn" title="Next (N)" aria-label="Next">▶</button>
                    <span class="bx-controls-divider"></span>
                    <button class="bx-chip" id="bx-autoplay-btn" title="Play the next track automatically when one ends" aria-pressed="false">Autoplay</button>
                    <button class="bx-chip" id="bx-shuffle-btn" title="Shuffle (S)" aria-pressed="false">Shuffle</button>
                    <button class="bx-chip" id="bx-audio-btn" title="Hide the video, keep the sound (A)" aria-pressed="false">Audio only</button>
                    <button class="bx-chip bx-plain" id="bx-pip-btn" title="Float the video in a small window">Pop out</button>
                </div>
                <div id="bx-toast" role="status"></div>
                <div class="bx-kbd-hint">
                    <kbd>N</kbd> next &nbsp; <kbd>P</kbd> prev &nbsp; <kbd>S</kbd> shuffle &nbsp; <kbd>A</kbd> audio &nbsp; <kbd>Esc</kbd> close
                </div>
            </div>
            <div class="bx-reactions">
                <div class="bx-panel-label">BX Reactions</div>
                <div class="bx-list" id="bx-reactions-container">
                    ${emptyState('💬', 'Play a track to load the chatter')}
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(playerRoot);

    const viewport = document.getElementById('bx-player-viewport');
    const reactionsContainer = document.getElementById('bx-reactions-container');
    const sectionSelect = document.getElementById('bx-section-select');
    const loadMoreBtn = document.getElementById('bx-load-more');
    const searchInput = document.getElementById('bx-search');
    const searchClear = document.getElementById('bx-search-clear');

    // ------------------------------------------------------------------
    // Playlist scanning — works on the live page or any fetched document
    // ------------------------------------------------------------------
    function scanDoc(doc, baseUrl) {
        const items = [];
        const seen = new Set();

        // vBulletin thread title anchors; fall back to showthread links
        let anchors = doc.querySelectorAll("a[id^='thread_title_']");
        if (anchors.length === 0) {
            anchors = doc.querySelectorAll("a[href*='showthread.php']");
        }

        anchors.forEach((a) => {
            const title = a.textContent.trim();
            let url;
            try { url = new URL(a.getAttribute('href'), baseUrl).href; } catch (e) { return; }
            if (!title || seen.has(url)) return;
            seen.add(url);

            // Props / replies live somewhere in the same row — be defensive
            let props = 0;
            const row = a.closest('tr, li, .threadbit, .thread-row');
            if (row) {
                const propsNode = row.querySelector("[id^='thread_votes_'], .props, .thread-props");
                if (propsNode) {
                    props = parseInt(propsNode.textContent.replace(/[^0-9]/g, ''), 10) || 0;
                } else {
                    const m = row.textContent.match(/props?\s*[:\-]?\s*(\d+)/i);
                    if (m) props = parseInt(m[1], 10) || 0;
                }
            }
            items.push({ title, url, props, embedUrl: undefined });
        });

        return items;
    }

    function findNextPageUrl(doc, baseUrl) {
        const a = doc.querySelector("a[rel='next'], a.pagenav_next, a[title*='Next Page'], a[title*='next page']");
        if (!a) return null;
        try { return new URL(a.getAttribute('href'), baseUrl).href; } catch (e) { return null; }
    }

    // Sections discovered from links on the current page — lets you hop
    // between Hip-Hop / Sports / News etc. without leaving the player.
    function scanSections() {
        const sections = [];
        const seen = new Set();
        document.querySelectorAll("a[href*='forumdisplay.php?f='], a[href*='forumdisplay.php%3Ff=']").forEach((a) => {
            let u;
            try { u = new URL(a.getAttribute('href'), location.href); } catch (e) { return; }
            const f = u.searchParams.get('f');
            const name = a.textContent.trim();
            if (!f || !name || name.length > 40 || seen.has(f)) return;
            seen.add(f);
            sections.push({ id: f, name, url: u.href });
        });
        return sections;
    }

    function renderSectionOptions() {
        const sections = scanSections();
        sectionSelect.innerHTML = `<option value="">This page</option>` +
            sections.map((s) => `<option value="${escapeHtml(s.url)}">${escapeHtml(s.name)}</option>`).join('');
        sectionSelect.style.display = sections.length ? 'block' : 'none';
    }

    async function loadSource(url) {
        const token = ++loadToken;
        const list = document.getElementById('bx-playlist-ul');
        if (!url) {
            fullPlaylist = scanDoc(document, location.href);
            nextPageUrl = findNextPageUrl(document, location.href);
            applyFilter();
            return;
        }
        list.innerHTML = REACTIONS_SKELETON + REACTIONS_SKELETON;
        try {
            const html = await bxFetch(url);
            if (token !== loadToken) return;
            const doc = new DOMParser().parseFromString(html, 'text/html');
            fullPlaylist = scanDoc(doc, url);
            nextPageUrl = findNextPageUrl(doc, url);
            applyFilter();
        } catch (err) {
            if (token !== loadToken) return;
            list.innerHTML = emptyState('⚠️', 'Could not load this section', err.message);
        }
    }

    async function loadMore() {
        if (!nextPageUrl) return;
        loadMoreBtn.disabled = true;
        loadMoreBtn.textContent = 'Loading…';
        try {
            const pageUrl = nextPageUrl;
            const html = await bxFetch(pageUrl);
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const existing = new Set(fullPlaylist.map((t) => t.url));
            const fresh = scanDoc(doc, pageUrl).filter((t) => !existing.has(t.url));
            fullPlaylist = fullPlaylist.concat(fresh);
            nextPageUrl = findNextPageUrl(doc, pageUrl);
            // Preserve the currently playing track across the re-render
            const playingUrl = currentIndex >= 0 ? playlist[currentIndex]?.url : null;
            applyFilter(playingUrl);
        } catch (err) {
            toast(`Couldn't load the next page (${err.message})`);
            updateLoadMoreUI();
            return;
        }
        updateLoadMoreUI();
    }

    function updateLoadMoreUI() {
        loadMoreBtn.disabled = !nextPageUrl;
        loadMoreBtn.textContent = nextPageUrl ? 'Load more threads' : 'End of section';
    }

    function applyFilter(keepPlayingUrl) {
        // By default keep the currently playing track selected across re-renders
        if (keepPlayingUrl === undefined) {
            keepPlayingUrl = currentIndex >= 0 ? (playlist[currentIndex]?.url ?? null) : null;
        }
        if (hotMode) {
            playlist = fullPlaylist
                .filter((t) => t.props >= settings.hotThreshold)
                .sort((a, b) => b.props - a.props)
                .slice(0, 20);
            // If nothing clears the bar, just show top 20 by props
            if (playlist.length === 0) {
                playlist = [...fullPlaylist].sort((a, b) => b.props - a.props).slice(0, 20);
            }
        } else {
            playlist = [...fullPlaylist];
        }
        currentIndex = keepPlayingUrl ? playlist.findIndex((t) => t.url === keepPlayingUrl) : -1;
        renderPlaylistUI();
        updateLoadMoreUI();
    }

    function updateCount() {
        document.getElementById('bx-count').textContent =
            currentIndex >= 0 ? `Track ${currentIndex + 1} of ${playlist.length}` : `${playlist.length} tracks`;
    }

    function renderPlaylistUI() {
        const list = document.getElementById('bx-playlist-ul');
        list.innerHTML = '';
        const q = searchQuery.toLowerCase();
        let visible = 0;

        playlist.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'bx-list-item' +
                (index === currentIndex ? ' active' : '') +
                (track.embedUrl === null ? ' bx-no-media' : '');
            li.dataset.index = index;
            if (q && !track.title.toLowerCase().includes(q)) li.style.display = 'none';
            else visible++;
            li.innerHTML = `
                <span class="bx-idx">${index === currentIndex ? '▶' : index + 1}</span>
                <span class="bx-track-title-text" title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</span>
                ${track.props > 0 ? `<span class="bx-props-badge" title="${track.props} props">🔥 ${track.props}</span>` : ''}
            `;
            li.addEventListener('click', () => loadTrack(index));
            list.appendChild(li);
        });

        if (playlist.length === 0) {
            list.innerHTML = emptyState('🕳️', 'No threads found on this page');
        } else if (visible === 0) {
            list.insertAdjacentHTML('beforeend', emptyState('🔎', 'No tracks match your search'));
        }

        updateCount();
        document.getElementById('bx-filter-all').classList.toggle('bx-toggled', !hotMode);
        document.getElementById('bx-filter-hot').classList.toggle('bx-toggled', hotMode);
    }

    function markActive() {
        document.querySelectorAll('#bx-playlist-ul .bx-list-item').forEach((el) => {
            const idx = Number(el.dataset.index);
            el.classList.toggle('active', idx === currentIndex);
            const idxEl = el.querySelector('.bx-idx');
            if (idxEl) idxEl.textContent = idx === currentIndex ? '▶' : idx + 1;
        });
        const activeEl = document.querySelector('#bx-playlist-ul .bx-list-item.active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
        updateCount();
    }

    // ------------------------------------------------------------------
    // Track loading + reactions
    // ------------------------------------------------------------------
    async function loadTrack(index, { autoAdvanceOnMiss = false } = {}) {
        if (index < 0 || index >= playlist.length) return;
        currentIndex = index;
        const track = playlist[index];
        const token = ++loadToken;
        markActive();

        document.getElementById('bx-track-title').textContent = track.title;
        const threadLink = document.getElementById('bx-thread-link');
        threadLink.href = track.url;
        threadLink.style.display = 'inline';
        reactionsContainer.innerHTML = REACTIONS_SKELETON;

        // If the embed is already known (prefetched), render instantly and
        // fetch the thread only for the reactions drawer.
        if (typeof track.embedUrl === 'string') {
            renderEmbed(track.embedUrl);
        } else {
            viewport.innerHTML = VIEWPORT_SKELETON;
        }

        let html;
        try {
            html = await bxFetch(track.url);
        } catch (err) {
            if (token !== loadToken) return;
            if (track.embedUrl === undefined) {
                viewport.innerHTML = `<div class="bx-viewport-msg">⚠️ Couldn't load this thread<span style="font-size:0.8rem;color:#5b5b64;">${escapeHtml(err.message)}</span></div>`;
            }
            reactionsContainer.innerHTML = emptyState('💬', 'Chatter unavailable');
            return;
        }
        if (token !== loadToken) return; // user clicked something else meanwhile

        const doc = new DOMParser().parseFromString(html, 'text/html');
        if (track.embedUrl === undefined) {
            track.embedUrl = extractEmbedFromThreadDoc(doc);
        }

        if (typeof track.embedUrl === 'string') {
            if (!document.getElementById('bx-iframe-active')) renderEmbed(track.embedUrl);
        } else {
            renderPlaylistUI(); // grey out the no-media item
            markActive();
            if (autoAdvanceOnMiss && index < playlist.length - 1) {
                loadTrack(index + 1, { autoAdvanceOnMiss: true });
                return;
            }
            viewport.innerHTML = `<div class="bx-viewport-msg">🕳️ No media in this thread<span style="font-size:0.8rem;color:#5b5b64;">It's a text post — hit ▶ Next or pick another track</span></div>`;
        }

        renderReactions(doc);
        prefetchTrack(index + 1);
    }

    function renderEmbed(embedUrl) {
        const iframe = document.createElement('iframe');
        iframe.id = 'bx-iframe-active';
        iframe.src = embedUrl;
        iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        iframe.allowFullscreen = true;
        viewport.innerHTML = '';
        viewport.appendChild(iframe);
        hookYouTubeAutoAdvance(iframe);
    }

    // Warm the next track's embed URL so Next ▶ is instant.
    async function prefetchTrack(index) {
        const track = playlist[index];
        if (!track || track.embedUrl !== undefined) return;
        try {
            const html = await bxFetch(track.url);
            if (track.embedUrl !== undefined) return;
            const doc = new DOMParser().parseFromString(html, 'text/html');
            track.embedUrl = extractEmbedFromThreadDoc(doc);
        } catch (e) { /* best effort */ }
    }

    function renderReactions(doc) {
        reactionsContainer.innerHTML = '';
        // Post containers vary between vBulletin themes — try a few shapes
        let posts = Array.from(doc.querySelectorAll('.post_container'));
        if (posts.length === 0) posts = Array.from(doc.querySelectorAll("[id^='post_'] , .postbit, li.postcontainer"));

        const cards = [];
        for (const post of posts.slice(1)) {
            const userNode = post.querySelector('.username, a.bigusername, .popupmenu .username');
            const messageNode = post.querySelector(".post_message, [id^='post_message_']");
            if (!userNode || !messageNode) continue;

            const username = userNode.textContent.trim();
            let message = messageNode.textContent.trim().replace(/\s+/g, ' ');
            if (!message) continue;
            if (message.length > REACTION_MAX_CHARS) message = message.slice(0, REACTION_MAX_CHARS) + '…';

            cards.push(`
                <div class="bx-comment-card">
                    <span class="bx-avatar">${escapeHtml((username[0] || '?').toUpperCase())}</span>
                    <div class="bx-comment-body">
                        <div class="bx-comment-user">${escapeHtml(username)}</div>
                        <div class="bx-comment-text">${escapeHtml(message)}</div>
                    </div>
                </div>
            `);
            if (cards.length >= MAX_REACTIONS) break;
        }

        reactionsContainer.innerHTML = cards.length
            ? cards.join('')
            : emptyState('💬', 'No comments on this thread yet');
    }

    // ------------------------------------------------------------------
    // Autoplay chain — YouTube iframe API over postMessage
    // ------------------------------------------------------------------
    function hookYouTubeAutoAdvance(iframe) {
        if (!/youtube/.test(iframe.src)) return;
        // Handshake: tell the YT embed we're listening, then watch for ended state (0)
        const ping = () => {
            try {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'bx-jukebox' }), '*');
            } catch (e) { /* not ready yet */ }
        };
        iframe.addEventListener('load', () => { ping(); setTimeout(ping, 1000); });
    }

    window.addEventListener('message', (ev) => {
        if (typeof ev.data !== 'string' || !ev.origin.includes('youtube')) return;
        let data;
        try { data = JSON.parse(ev.data); } catch (e) { return; }
        const state = data?.info?.playerState;
        if (data.event === 'infoDelivery' && state === 0 && settings.autoplay) {
            playNext(true);
        }
    });

    // ------------------------------------------------------------------
    // Controls
    // ------------------------------------------------------------------
    function playNext(auto = false) {
        if (playlist.length === 0) return;
        if (settings.shuffle && playlist.length > 1) {
            let next;
            do { next = Math.floor(Math.random() * playlist.length); } while (next === currentIndex);
            loadTrack(next, { autoAdvanceOnMiss: auto });
        } else if (currentIndex < playlist.length - 1) {
            loadTrack(currentIndex + 1, { autoAdvanceOnMiss: auto });
        }
    }
    function playPrev() {
        if (currentIndex > 0) loadTrack(currentIndex - 1);
    }

    function setChip(id, on) {
        const el = document.getElementById(id);
        el.classList.toggle('bx-toggled', on);
        el.setAttribute('aria-pressed', String(on));
    }

    function toggleAudioMode() {
        const on = playerRoot.classList.toggle('bx-audio-mode');
        setChip('bx-audio-btn', on);
    }

    function toggleShuffle() {
        settings.shuffle = !settings.shuffle;
        saveSettings();
        setChip('bx-shuffle-btn', settings.shuffle);
    }

    function toggleAutoplay() {
        settings.autoplay = !settings.autoplay;
        saveSettings();
        setChip('bx-autoplay-btn', settings.autoplay);
    }

    async function popOut() {
        const activeIframe = document.getElementById('bx-iframe-active');
        if (!activeIframe) { toast('Play a track first, then pop it out.'); return; }
        if (window.documentPictureInPicture) {
            try {
                const pipWindow = await window.documentPictureInPicture.requestWindow({ width: 480, height: 290 });
                pipWindow.document.body.style.cssText = 'margin:0;background:#000;';
                pipWindow.document.body.appendChild(activeIframe);
                activeIframe.style.cssText = 'width:100%;height:100%;border:none;';
                viewport.innerHTML = '<div class="bx-viewport-msg">Playing in the pop-out window</div>';
                pipWindow.addEventListener('pagehide', () => {
                    viewport.innerHTML = '';
                    viewport.appendChild(activeIframe);
                });
            } catch (err) {
                console.error('BX Jukebox PiP error:', err);
                toast('Pop-out was blocked by the browser.');
            }
        } else {
            toast('This browser lacks pop-out support — try "Audio only" to keep the track playing while you browse.');
        }
    }

    function openPlayer() {
        playerRoot.style.display = 'block';
        renderSectionOptions();
        setChip('bx-shuffle-btn', settings.shuffle);
        setChip('bx-autoplay-btn', settings.autoplay);
        loadSource(sectionSelect.value || '');
    }

    function closePlayer() {
        playerRoot.style.display = 'none';
        playerRoot.classList.remove('bx-audio-mode');
        setChip('bx-audio-btn', false);
        viewport.innerHTML = '<div class="bx-viewport-msg">Pick a track from the queue to start the vibe</div>'; // stops audio
        document.getElementById('bx-track-title').textContent = '';
        document.getElementById('bx-thread-link').style.display = 'none';
    }

    launchBtn.addEventListener('click', openPlayer);
    document.getElementById('bx-close-player').addEventListener('click', closePlayer);
    document.getElementById('bx-filter-all').addEventListener('click', () => { hotMode = false; applyFilter(); });
    document.getElementById('bx-filter-hot').addEventListener('click', () => { hotMode = true; applyFilter(); });
    document.getElementById('bx-next-btn').addEventListener('click', () => playNext(false));
    document.getElementById('bx-prev-btn').addEventListener('click', playPrev);
    document.getElementById('bx-shuffle-btn').addEventListener('click', toggleShuffle);
    document.getElementById('bx-autoplay-btn').addEventListener('click', toggleAutoplay);
    document.getElementById('bx-audio-btn').addEventListener('click', toggleAudioMode);
    document.getElementById('bx-pip-btn').addEventListener('click', popOut);
    loadMoreBtn.addEventListener('click', loadMore);
    sectionSelect.addEventListener('change', () => loadSource(sectionSelect.value || ''));

    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        searchClear.style.display = searchQuery ? 'block' : 'none';
        renderPlaylistUI();
    });
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        searchClear.style.display = 'none';
        renderPlaylistUI();
        searchInput.focus();
    });

    document.addEventListener('keydown', (e) => {
        if (playerRoot.style.display !== 'block') return;
        if (/input|textarea|select/i.test(e.target.tagName)) return;
        switch (e.key.toLowerCase()) {
            case 'escape': closePlayer(); break;
            case 'n': playNext(false); break;
            case 'p': playPrev(); break;
            case 'a': toggleAudioMode(); break;
            case 's': toggleShuffle(); break;
        }
    });
})();
