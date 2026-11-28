import { getDb } from '../_lib/db.js';
import { edgeCached } from '../_lib/cache.js';
import { handleLinkPreview } from '../_lib/link-preview.js';

// previews change rarely: keep a successful result for a day at the edge
export const onRequest = edgeCached((ctx) => handleLinkPreview(ctx, { getDb }), { ttl: 86400 });
