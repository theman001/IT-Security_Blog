import { getDb } from './_lib/db.js';
import { edgeCached } from './_lib/cache.js';
import { handleSitemap } from './_lib/edge-handlers.js';

export const onRequest = edgeCached((ctx) => handleSitemap(ctx, { getDb }));
