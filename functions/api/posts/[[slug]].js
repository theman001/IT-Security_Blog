import { getDb } from '../../_lib/db.js';
import { edgeCached } from '../../_lib/cache.js';
import { handlePosts } from '../../_lib/handlers.js';

export const onRequest = edgeCached((ctx) => handlePosts(ctx, { getDb }));
