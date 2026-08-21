// Vite sets BASE_URL to match vite.config.js's `base` — '/' in production
// (Cloudflare Pages, served from the real domain root) but a dev-only path
// prefix when developing through the remote code-server's path-based proxy
// (dev.taeuk.site/proxy/5173/). Everything that reads/writes location.pathname
// needs to go through these two helpers so routing works under either.
export const BASE_PATH = import.meta.env.BASE_URL;

const BASE_NO_TRAILING_SLASH = BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;

/** Real browser pathname -> app-relative path the router matches against. */
export function toAppPath(pathname) {
    if (BASE_PATH === '/') return pathname;
    if (!pathname.startsWith(BASE_NO_TRAILING_SLASH)) return pathname;
    return pathname.slice(BASE_NO_TRAILING_SLASH.length) || '/';
}

/** App-relative path (e.g. "/categories") -> the real URL to push into history. */
export function toRealPath(appPath) {
    if (BASE_PATH === '/') return appPath;
    return BASE_NO_TRAILING_SLASH + appPath;
}
