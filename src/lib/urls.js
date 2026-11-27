const segs = (path) => String(path).split('/').map(encodeURIComponent).join('/');

/** `a/b c` -> `/posts/a/b%20c` */
export const postHref = (slug) => `/posts/${segs(slug)}`;

/** One segment = a section root (`/tech`); deeper = `/categories/<path>`. */
export const categoryHref = (path) => (String(path).includes('/') ? `/categories/${segs(path)}` : `/${encodeURIComponent(path)}`);
