// --- Database Client Configuration ---
const DATABASE_URL = "postgresql://neondb_owner:npg_KC8RGJNSLq6j@ep-cold-butterfly-ahxb42ii-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Cache Mechanism
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Driver State
let neonDriver = null;

async function getNeon() {
    if (neonDriver) return neonDriver;
    try {
        // Use esm.sh with specific older version to support function call style
        const module = await import('https://esm.sh/@neondatabase/serverless@0.5.4');
        neonDriver = module.neon;
        return neonDriver;
    } catch (e) {
        console.error('Failed to import Neon driver:', e);
        throw e;
    }
}

async function query(sql, params = []) {
    // 1. Check Cache
    const cacheKey = `sql_${sql}_${JSON.stringify(params)}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
            console.log('Cache Hit:', sql);
            return data;
        }
    }

    try {
        const neon = await getNeon();
        if (!neon) throw new Error('Neon driver not available');

        console.log('Executing SQL:', sql, params);

        const sqlQuery = neon(DATABASE_URL);
        const result = await sqlQuery(sql, params);

        // Cache Result
        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: result
        }));

        return result;

    } catch (e) {
        console.error('DB Query Error:', e);
        return [];
    }
}

// --- Public API Functions ---

export async function fetchCategories() {
    // Recursive CTE to build category tree
    const sql = `
        WITH RECURSIVE CategoryTree AS (
            SELECT 
                id, slug, name, parent_id,
                1 as level,
                slug as path
            FROM categories
            WHERE parent_id IS NULL
            
            UNION ALL
            
            SELECT 
                c.id, c.slug, c.name, c.parent_id,
                ct.level + 1,
                ct.path || '/' || c.slug
            FROM categories c
            JOIN CategoryTree ct ON c.parent_id = ct.id
        )
        SELECT 
            c.*,
            (SELECT COUNT(*) FROM reports r WHERE r.category_id = c.id) as post_count
        FROM CategoryTree c
        ORDER BY path;
    `;
    return await query(sql);
}

export async function fetchPostsByCategory(slugInput) {
    if (!slugInput) return { posts: [], subCategories: [] };

    // 1. Get All Categories to find the ID
    const categories = await fetchCategories();

    // Normalize Check: DB path might be 'contents/test', input might be 'test'
    // Or input 'contents/test' and DB 'contents/test'
    // We try to match the suffx or exact match
    let category = categories.find(c => c.path === slugInput || c.slug === slugInput); // Check computed path or raw slug

    if (!category) {
        // Try precise split matching if simple match fails
        const parts = slugInput.split('/');
        const lastPart = parts[parts.length - 1];
        category = categories.find(c => c.slug === lastPart);
    }

    if (!category) {
        console.warn('Category not found:', slugInput);
        return { posts: [], subCategories: [] };
    }

    // 2. Fetch Posts
    const postsSql = `
        SELECT 
            r.id, r.title, r.slug, r.created_at, r.content_md,
            c.name as category_name
        FROM reports r
        JOIN categories c ON r.category_id = c.id
        WHERE c.id = ${category.id} -- Safe enough for internal integer ID
        ORDER BY r.created_at DESC
    `;

    const rawPosts = await query(postsSql);
    const posts = rawPosts.map(mapReport);

    // 3. Subcategories (Direct children)
    const subCategories = categories.filter(c => c.parent_id === category.id);

    return {
        category,
        posts,
        subCategories
    };
}

export async function fetchPosts() {
    // Simplified Query to debug "No posts found"
    // Using correct column name 'content_md'
    const sql = `
        SELECT r.id, r.title, r.slug, r.created_at, r.content_md
        FROM reports r
        ORDER BY r.created_at DESC
        LIMIT 20
    `;

    try {
        const rawPosts = await query(sql);
        console.log('Fetched Raw Posts:', rawPosts); // Debug
        return rawPosts.map(mapReport);
    } catch (e) {
        console.error('FetchPosts Error:', e);
        return [];
    }
}

// Added Missing Function
export async function fetchPostBySlug(slug) {
    const sql = `
        SELECT r.id, r.title, r.slug, r.created_at, r.content_md
        FROM reports r
        WHERE r.slug = $1
    `;

    // Note: For version 0.5.4, use array for params
    const result = await query(sql, [slug]);
    if (result.length > 0) {
        return mapReport(result[0]);
    }
    return null;
}

// Helper to format DB rows to App objects
function mapReport(r) {
    let dateStr = 'Unknown Date';
    try {
        if (r.created_at) {
            dateStr = new Date(r.created_at).toLocaleDateString();
        }
    } catch (e) { console.warn('Date parse error', e); }

    return {
        id: r.id,
        title: r.title,
        slug: r.slug,
        rawDate: r.created_at,
        date: dateStr,
        content: r.content_md, // Correct Column
        categoryName: r.category_name || 'Uncategorized' // Fallback
    };
}
