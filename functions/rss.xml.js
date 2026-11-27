import { getDb } from './_lib/db.js';
import { handleRss } from './_lib/edge-handlers.js';

export const onRequest = (ctx) => handleRss(ctx, { getDb });
