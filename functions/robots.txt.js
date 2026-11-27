import { edgeCached } from './_lib/cache.js';
import { handleRobots } from './_lib/edge-handlers.js';

export const onRequest = edgeCached((ctx) => handleRobots(ctx));
