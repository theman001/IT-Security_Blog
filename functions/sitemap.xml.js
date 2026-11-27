import { getDb } from './_lib/db.js';
import { handleSitemap } from './_lib/edge-handlers.js';

export const onRequest = (ctx) => handleSitemap(ctx, { getDb });
