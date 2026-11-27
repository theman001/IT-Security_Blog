import { getDb } from '../../_lib/db.js';
import { handleCategories } from '../../_lib/handlers.js';

export const onRequest = (ctx) => handleCategories(ctx, { getDb });
