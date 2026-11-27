import { handleRobots } from './_lib/edge-handlers.js';

export const onRequest = (ctx) => handleRobots(ctx);
