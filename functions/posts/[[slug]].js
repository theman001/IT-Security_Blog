import { getDb } from '../_lib/db.js';
import { edgeCached } from '../_lib/cache.js';
import { handlePost } from '../_lib/edge-handlers.js';

export const onRequest = edgeCached((ctx) => handlePost(ctx, { getDb }));
