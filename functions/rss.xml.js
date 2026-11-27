import { getDb } from './_lib/db.js';
import { edgeCached } from './_lib/cache.js';
import { handleRss } from './_lib/edge-handlers.js';

export const onRequest = edgeCached((ctx) => handleRss(ctx, { getDb }));
