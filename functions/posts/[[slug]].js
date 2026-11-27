import { getDb } from '../_lib/db.js';
import { handlePost } from '../_lib/edge-handlers.js';

export const onRequest = (ctx) => handlePost(ctx, { getDb });
