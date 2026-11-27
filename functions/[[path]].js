import { getDb } from './_lib/db.js';
import { handleCatchAll } from './_lib/edge-handlers.js';

export const onRequest = (ctx) => handleCatchAll(ctx, { getDb });
