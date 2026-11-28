// Brand constants: the single source for the browser (router, header) and the edge (functions/_lib/seo.js).
// index.html and public/404.html are static copies: tests/unit/site.test.js keeps them in sync.
export const SITE = 'TheMan의 Patch Notes'; // title suffix, og:site_name, RSS title
export const SITE_EN = "TheMan's Patch Notes"; // WebSite JSON-LD alternateName
export const SITE_SUBTITLE = 'IT Security Blog'; // header sub-line, home title
export const SITE_TAGLINE = '기술을 읽고, 생각을 적는다';
export const AUTHOR = 'TheMan'; // JSON-LD author
export const HOME_TITLE = `${SITE} - ${SITE_SUBTITLE}`;
export const DEFAULT_DESCRIPTION = `${SITE_TAGLINE}. IT·AI·보안의 기술과 동향, 그리고 보안을 바라보는 생각을 기록하는 TheMan의 블로그.`;
