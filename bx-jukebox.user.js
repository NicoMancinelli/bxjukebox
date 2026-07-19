// ==UserScript==
// @name         Boxden Modern Jukebox & Media Player
// @namespace    https://github.com/neek/bxjukebox
// @version      1.1.0
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
            position: fixed; inset: 0;
            background: rgba(10, 10, 10, 0.98);
            z-index: 100000; display: none;
            color: #e4e4e7;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #bx-player-root * { box-sizing: border-box; }
        .bx-layout { display: flex; width: 100%; height: 100%; }
        .bx-sidebar {
            width: 320px; background: #18181b; border-right: 1px solid #27272a;
            display: flex; flex-direction: column; padding: 20px; min-width: 0;
        }
        .bx-main {
            flex: 1; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 40px; position: relative; min-width: 0;
        }
        .bx-reactions {
            width: 320px; background: #18181b; border-left: 1px solid #27272a;
            display: flex; flex-direction: column; padding: 20px; min-width: 0;
        }
        .bx-video-container {
            width: 100%; max-width: 850px; aspect-ratio: 16/9;
            background: #000; border-radius: 8px; overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            transition: max-width .25s ease, opacity .25s ease;
        }
        .bx-video-container iframe { width: 100%; height: 100%; border: none; }
        #bx-player-root.bx-audio-mode .bx-video-container {
            position: absolute; width: 1px; height: 1px;
            opacity: 0.01; pointer-events: none; bottom: 0; left: 0;
        }
        #bx-audio-badge {
            display: none; align-items: center; gap: 10px;
            background: #202023; border: 1px solid #ff4500; border-radius: 10px;
            padding: 24px 32px; font-size: 1.05rem;
        }
        #bx-player-root.bx-audio-mode #bx-audio-badge { display: inline-flex; }
        .bx-eq { display: inline-flex; gap: 3px; align-items: flex-end; height: 20px; }
        .bx-eq span {
            width: 4px; background: #ff4500; border-radius: 2px;
            animation: bx-eq-bounce 1s ease-in-out infinite;
        }
        .bx-eq span:nth-child(2) { animation-delay: .2s; }
        .bx-eq span:nth-child(3) { animation-delay: .4s; }
        @keyframes bx-eq-bounce {
            0%, 100% { height: 6px; } 50% { height: 20px; }
        }
        .bx-header {
            font-size: 1.1rem; font-weight: bold; margin-bottom: 12px; color: #fff;
            border-bottom: 1px solid #27272a; padding-bottom: 10px;
            display: flex; justify-content: space-between; align-items: center;
            flex-shrink: 0; gap: 8px;
        }
        #bx-count { font-size: 0.75rem; color: #a1a1aa; font-weight: normal; }
        #bx-section-select {
            width: 100%; background: #202023; color: #e4e4e7;
            border: 1px solid #3f3f46; border-radius: 6px;
            padding: 8px 10px; font-size: 0.85rem; margin-bottom: 10px;
            flex-shrink: 0; cursor: pointer;
        }
        #bx-search {
            width: 100%; background: #202023; color: #e4e4e7;
            border: 1px solid #3f3f46; border-radius: 6px;
            padding: 8px 10px; font-size: 0.85rem; margin-bottom: 10px;
            flex-shrink: 0;
        }
        #bx-search:focus { outline: none; border-color: #ff4500; }
        .bx-list {
            list-style: none; padding: 0; margin: 0;
            overflow-y: auto; flex: 1;
        }
        .bx-list::-webkit-scrollbar { width: 8px; }
        .bx-list::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
        .bx-list-item {
            padding: 10px 12px; border-radius: 6px; cursor: pointer;
            margin-bottom: 6px; background: #202023; font-size: 0.88rem;
            transition: background 0.15s;
            display: flex; justify-content: space-between; align-items: center; gap: 8px;
        }
        .bx-list-item:hover { background: #27272a; }
        .bx-list-item.active { background: #ff4500; color: #fff; }
        .bx-list-item.bx-no-media { opacity: 0.45; }
        .bx-track-title-text {
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
        }
        .bx-props-badge {
            background: rgba(255, 69, 0, 0.18); color: #ff6a33;
            padding: 2px 7px; border-radius: 4px; font-size: 0.72rem;
            font-weight: bold; flex-shrink: 0;
        }
        .bx-list-item.active .bx-props-badge { background: rgba(255,255,255,0.3); color: #fff; }
        #bx-load-more {
            margin-top: 8px; flex-shrink: 0; width: 100%;
            background: #202023; color: #a1a1aa; border: 1px dashed #3f3f46;
            border-radius: 6px; padding: 9px; cursor: pointer; font-size: 0.82rem;
        }
        #bx-load-more:hover { color: #fff; border-color: #ff4500; }
        #bx-load-more:disabled { opacity: 0.4; cursor: default; }
        .bx-comment-card {
            background: #202023; padding: 12px; border-radius: 6px;
            margin-bottom: 10px; font-size: 0.84rem; line-height: 1.45;
            border-left: 3px solid #ff4500; word-wrap: break-word;
        }
        .bx-comment-user { font-weight: bold; color: #fff; margin-bottom: 4px; }
        .bx-controls { margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .bx-btn {
            background: #ff4500; color: #fff; border: none;
            padding: 10px 16px; border-radius: 6px; cursor: pointer;
            font-weight: bold; font-size: 0.86rem;
            display: inline-flex; align-items: center; gap: 7px;
        }
        .bx-btn:hover { background: #e03d00; }
        .bx-btn-secondary { background: #27272a; color: #e4e4e7; }
        .bx-btn-secondary:hover { background: #3f3f46; }
        .bx-btn-secondary.bx-toggled { background: #ff4500; color: #fff; }
        .bx-filter-row { margin-bottom: 10px; display: flex; gap: 8px; flex-shrink: 0; }
        .bx-filter-row .bx-btn { padding: 6px 12px; font-size: 0.78rem; }
        .bx-close-btn {
            position: absolute; top: 18px; right: 22px; z-index: 2;
            background: none; border: none; color: #a1a1aa;
            font-size: 1.05rem; font-weight: bold; cursor: pointer;
        }
        .bx-close-btn:hover { color: #fff; }
        .bx-empty { text-align: center; margin-top: 20px; color: #71717a; font-size: 0.88rem; }
        .bx-viewport-msg {
            display: flex; height: 100%; align-items: center;
            justify-content: center; color: #71717a; font-size: 1.05rem;
            padding: 20px; text-align: center;
        }
        #bx-track-title {
            margin: 20px 0 0; font-size: 1.2rem; text-align: center;
            max-width: 850px; overflow: hidden; text-overflow: ellipsis;
        }
        #bx-thread-link { color: #ff6a33; font-size: 0.82rem; margin-top: 8px; text-decoration: none; }
        #bx-thread-link:hover { text-decoration: underline; }
        #bx-launch-btn {
            position: fixed; bottom: 25px; right: 25px; z-index: 99999;
            background: #ff4500; color: #fff; border: none; border-radius: 50px;
            padding: 14px 24px; font-weight: bold; font-size: 0.92rem; cursor: pointer;
            box-shadow: 0 4px 15px rgba(255, 69, 0, 0.4); transition: transform 0.2s;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        #bx-launch-btn:hover { transform: scale(1.05); }
        .bx-kbd-hint {
            position: absolute; bottom: 14px; left: 0; right: 0;
            text-align: center; color: #52525b; font-size: 0.72rem;
        }
        .bx-kbd-hint kbd {
            background: #27272a; border-radius: 3px; padding: 1px 5px;
            font-family: inherit; color: #a1a1aa;
        }
        @media (max-width: 1100px) {
            .bx-reactions { display: none; }
            .bx-sidebar { width: 260px; }
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
    launchBtn.textContent = '📺 Launch BX Jukebox';
    document.body.appendChild(launchBtn);

    const playerRoot = document.createElement('div');
    playerRoot.id = 'bx-player-root';
    playerRoot.innerHTML = `
        <button class="bx-close-btn" id="bx-close-player" title="Close (Esc)">✕ Close</button>
        <div class="bx-layout">
            <div class="bx-sidebar">
                <div class="bx-header"><span>🎵 BX Jukebox</span><span id="bx-count"></span></div>
                <select id="bx-section-select" title="Jump to another section without leaving the player"></select>
                <input id="bx-search" type="text" placeholder="🔎 Filter tracks…" autocomplete="off">
                <div class="bx-filter-row">
                    <button class="bx-btn bx-btn-secondary" id="bx-filter-all">All Posts</button>
                    <button class="bx-btn bx-btn-secondary" id="bx-filter-hot">🔥 Hot</button>
                </div>
                <ul class="bx-list" id="bx-playlist-ul"></ul>
                <button id="bx-load-more">⤵ Load more threads</button>
            </div>
            <div class="bx-main">
                <div class="bx-video-container" id="bx-player-viewport">
                    <div class="bx-viewport-msg">Select a track to start the vibe</div>
                </div>
                <div id="bx-audio-badge">
                    <span class="bx-eq"><span></span><span></span><span></span></span>
                    <span>Audio-only Jukebox mode — track keeps playing</span>
                </div>
                <h2 id="bx-track-title"></h2>
                <a id="bx-thread-link" target="_blank" rel="noopener" style="display:none;">View original Boxden thread ↗</a>
                <div class="bx-controls">
                    <button class="bx-btn" id="bx-prev-btn" title="Previous (P)">◀ Prev</button>
                    <button class="bx-btn" id="bx-next-btn" title="Next (N)">Next ▶</button>
                    <button class="bx-btn bx-btn-secondary" id="bx-shuffle-btn" title="Shuffle (S)">🔀 Shuffle</button>
                    <button class="bx-btn bx-btn-secondary" id="bx-autoplay-btn" title="Autoplay next track when one ends">⏭ Autoplay</button>
                    <button class="bx-btn bx-btn-secondary" id="bx-audio-btn" title="Audio-only (A)">🎧 Jukebox Mode</button>
                    <button class="bx-btn bx-btn-secondary" id="bx-pip-btn">📺 Pop Out</button>
                </div>
                <div class="bx-kbd-hint">
                    <kbd>N</kbd> next &nbsp; <kbd>P</kbd> prev &nbsp; <kbd>S</kbd> shuffle &nbsp; <kbd>A</kbd> audio mode &nbsp; <kbd>Esc</kbd> close
                </div>
            </div>
            <div class="bx-reactions">
                <div class="bx-header"><span>💬 BX Reactions</span></div>
                <div class="bx-list" id="bx-reactions-container">
                    <div class="bx-empty">Play a track to load the chatter</div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(playerRoot);

    const viewport = document.getElementById('bx-player-viewport');
    const reactionsContainer = document.getElementById('bx-reactions-container');
    const sectionSelect = document.getElementById('bx-section-select');
    const loadMoreBtn = document.getElementById('bx-load-more');

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
        sectionSelect.innerHTML = `<option value="">📄 This page</option>` +
            sections.map((s) => `<option value="${escapeHtml(s.url)}">📁 ${escapeHtml(s.name)}</option>`).join('');
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
        list.innerHTML = '<div class="bx-empty">Loading section…</div>';
        try {
            const html = await bxFetch(url);
            if (token !== loadToken) return;
            const doc = new DOMParser().parseFromString(html, 'text/html');
            fullPlaylist = scanDoc(doc, url);
            nextPageUrl = findNextPageUrl(doc, url);
            applyFilter();
        } catch (err) {
            if (token !== loadToken) return;
            list.innerHTML = `<div class="bx-empty" style="color:#f43f5e;">Failed to load section (${escapeHtml(err.message)}).</div>`;
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
            loadMoreBtn.textContent = `Failed: ${err.message}`;
            setTimeout(updateLoadMoreUI, 2500);
            return;
        }
        updateLoadMoreUI();
    }

    function updateLoadMoreUI() {
        loadMoreBtn.disabled = !nextPageUrl;
        loadMoreBtn.textContent = nextPageUrl ? '⤵ Load more threads' : 'No more pages';
    }

    function applyFilter(keepPlayingUrl = null) {
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
                <span class="bx-track-title-text" title="${escapeHtml(track.title)}">${escapeHtml(track.title)}</span>
                ${track.props > 0 ? `<span class="bx-props-badge">${track.props} 🔥</span>` : ''}
            `;
            li.addEventListener('click', () => loadTrack(index));
            list.appendChild(li);
        });

        if (playlist.length === 0) {
            list.innerHTML = '<div class="bx-empty">No threads found on this page.</div>';
        } else if (visible === 0) {
            list.insertAdjacentHTML('beforeend', '<div class="bx-empty">No tracks match your search.</div>');
        }

        document.getElementById('bx-count').textContent =
            currentIndex >= 0 ? `${currentIndex + 1} / ${playlist.length}` : `${playlist.length} tracks`;
        document.getElementById('bx-filter-all').classList.toggle('bx-toggled', !hotMode);
        document.getElementById('bx-filter-hot').classList.toggle('bx-toggled', hotMode);
    }

    function markActive() {
        document.querySelectorAll('#bx-playlist-ul .bx-list-item').forEach((el) => {
            el.classList.toggle('active', Number(el.dataset.index) === currentIndex);
        });
        const activeEl = document.querySelector('#bx-playlist-ul .bx-list-item.active');
        if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
        document.getElementById('bx-count').textContent =
            currentIndex >= 0 ? `${currentIndex + 1} / ${playlist.length}` : `${playlist.length} tracks`;
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
        reactionsContainer.innerHTML = '<div class="bx-empty">Loading chatter…</div>';

        // If the embed is already known (prefetched), render instantly and
        // fetch the thread only for the reactions drawer.
        if (typeof track.embedUrl === 'string') {
            renderEmbed(track.embedUrl);
        } else {
            viewport.innerHTML = '<div class="bx-viewport-msg">Loading media stream…</div>';
        }

        let html;
        try {
            html = await bxFetch(track.url);
        } catch (err) {
            if (token !== loadToken) return;
            if (track.embedUrl === undefined) {
                viewport.innerHTML = `<div class="bx-viewport-msg" style="color:#f43f5e;">Failed to load thread (${escapeHtml(err.message)}).</div>`;
            }
            reactionsContainer.innerHTML = '<div class="bx-empty">—</div>';
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
            viewport.innerHTML = '<div class="bx-viewport-msg">No media embed found in the first post. Hit Next ▶</div>';
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
                    <div class="bx-comment-user">@${escapeHtml(username)}</div>
                    <div>${escapeHtml(message)}</div>
                </div>
            `);
            if (cards.length >= MAX_REACTIONS) break;
        }

        reactionsContainer.innerHTML = cards.length
            ? cards.join('')
            : '<div class="bx-empty">No comments on this thread yet.</div>';
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

    function toggleAudioMode() {
        const on = playerRoot.classList.toggle('bx-audio-mode');
        document.getElementById('bx-audio-btn').classList.toggle('bx-toggled', on);
    }

    function toggleShuffle() {
        settings.shuffle = !settings.shuffle;
        saveSettings();
        document.getElementById('bx-shuffle-btn').classList.toggle('bx-toggled', settings.shuffle);
    }

    function toggleAutoplay() {
        settings.autoplay = !settings.autoplay;
        saveSettings();
        document.getElementById('bx-autoplay-btn').classList.toggle('bx-toggled', settings.autoplay);
    }

    async function popOut() {
        const activeIframe = document.getElementById('bx-iframe-active');
        if (!activeIframe) return;
        if (window.documentPictureInPicture) {
            try {
                const pipWindow = await window.documentPictureInPicture.requestWindow({ width: 480, height: 290 });
                pipWindow.document.body.style.cssText = 'margin:0;background:#000;';
                pipWindow.document.body.appendChild(activeIframe);
                activeIframe.style.cssText = 'width:100%;height:100%;border:none;';
                viewport.innerHTML = '<div class="bx-viewport-msg">Playing in pop-out window…</div>';
                pipWindow.addEventListener('pagehide', () => {
                    viewport.innerHTML = '';
                    viewport.appendChild(activeIframe);
                });
            } catch (err) {
                console.error('BX Jukebox PiP error:', err);
            }
        } else {
            alert('Your browser lacks Document Picture-in-Picture. Tip: right-click the video twice and choose "Picture in picture", or use 🎧 Jukebox Mode to keep audio playing while you browse.');
        }
    }

    function openPlayer() {
        playerRoot.style.display = 'block';
        renderSectionOptions();
        document.getElementById('bx-shuffle-btn').classList.toggle('bx-toggled', settings.shuffle);
        document.getElementById('bx-autoplay-btn').classList.toggle('bx-toggled', settings.autoplay);
        loadSource(sectionSelect.value || '');
    }

    function closePlayer() {
        playerRoot.style.display = 'none';
        playerRoot.classList.remove('bx-audio-mode');
        document.getElementById('bx-audio-btn').classList.remove('bx-toggled');
        viewport.innerHTML = '<div class="bx-viewport-msg">Select a track to start the vibe</div>'; // stops audio
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
    document.getElementById('bx-search').addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        renderPlaylistUI();
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
