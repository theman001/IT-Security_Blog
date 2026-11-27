import { getDb } from '../../_lib/db.js';
import { edgeCached } from '../../_lib/cache.js';
import { handleCategories } from '../../_lib/handlers.js';

export const onRequest = edgeCached((ctx) => handleCategories(ctx, { getDb }));
