import { getDb } from './_lib/db.js';
import { edgeCached } from './_lib/cache.js';
import { handleCatchAll, isAssetPath } from './_lib/edge-handlers.js';

const cached = edgeCached((ctx) => handleCatchAll(ctx, { getDb }));
// Asset pass-through (env.ASSETS) is not cached here.
export const onRequest = (ctx) => (isAssetPath(new URL(ctx.request.url).pathname) ? handleCatchAll(ctx, { getDb }) : cached(ctx));
