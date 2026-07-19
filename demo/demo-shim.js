// Demo-only shim: maps mock vBulletin URLs to static fixture files so the
// unmodified userscript (which falls back to window.fetch when
// GM_xmlhttpRequest is absent) works against this static demo site.
(function () {
    const realFetch = window.fetch.bind(window);
    const SECTION_MAP = { 2: 'index.html', 4: 'sports.html', 5: 'news.html' };
    window.fetch = function (input, init) {
        try {
            const u = new URL(typeof input === 'string' ? input : input.url, location.href);
            if (u.pathname.endsWith('/forumdisplay.php')) {
                const f = u.searchParams.get('f');
                if (SECTION_MAP[f]) return realFetch(SECTION_MAP[f], init);
            }
        } catch (e) { /* fall through */ }
        return realFetch(input, init);
    };
})();
