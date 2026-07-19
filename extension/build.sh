#!/usr/bin/env bash
set -euo pipefail

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# The extension reuses the userscript verbatim: bxFetch() falls back to
# window.fetch when GM_xmlhttpRequest is absent, which is exactly the
# content-script environment (host_permissions grants boxden.com).
cd "$(dirname "$0")"
log "Copying userscript into extension as content.js"
cp ../bx-jukebox.user.js content.js
log "Done. Load this folder via chrome://extensions → Developer mode → Load unpacked."
