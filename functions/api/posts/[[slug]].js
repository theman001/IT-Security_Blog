import { getDb } from '../../_lib/db.js';
import { handlePosts } from '../../_lib/handlers.js';

export const onRequest = (ctx) => handlePosts(ctx, { getDb });
