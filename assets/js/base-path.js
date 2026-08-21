// Matches vite.config.js's `base` — dev is accessed through code-server's
// /absproxy/<port>/ (not /proxy/<port>/, which strips its prefix before
// forwarding and breaks Vite's dev-mode module graph; see vite.config.js).
// Production (Cloudflare Pages) is served from the real domain root.
export const BASE_PATH = import.meta.env.DEV ? '/absproxy/5173/' : '/';

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
