// --- Database Client Configuration ---
const DATABASE_URL = "postgresql://app_reader:STRONG_PASSWORD_HERE@ep-cold-butterfly-ahxb42ii-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
/* ============================================================
   Role Name : app_reader
   Purpose   : Edge / Serverless API 전용 READ-ONLY 계정
               - 정적 웹 / 블로그 게시글 조회용
               - INSERT / UPDATE / DELETE 불가
               - 보안 최소 권한 원칙 적용
   Target DB : neondb
   ============================================================ */


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
            (SELECT COUNT(*) FROM reports r WHERE r.category_id = c.id) as post_count,
            (SELECT COUNT(*) FROM categories child WHERE child.parent_id = c.id) as sub_category_count
        FROM CategoryTree c
        ORDER BY path;
    `;
    return await query(sql);
}

export async function fetchPostsByCategory(slugInput) {
    if (!slugInput) return { posts: [], subCategories: [] };

    const categories = await fetchCategories();

    let category = categories.find(
        c => c.path === slugInput || c.slug === slugInput
    );

    if (!category) {
        const lastPart = slugInput.split('/').pop();
        category = categories.find(c => c.slug === lastPart);
    }

    if (!category) {
        console.warn('Category not found:', slugInput);
        return { posts: [], subCategories: [] };
    }

    const postsSql = `
        SELECT 
            r.id, r.title, r.slug, r.created_at, r.content_md,
            c.name as category_name
        FROM reports r
        JOIN categories c ON r.category_id = c.id
        WHERE c.id = $1
        ORDER BY r.created_at ASC, r.id ASC
    `;

    const rawPosts = await query(postsSql, [category.id]);

    return {
        category,
        posts: rawPosts.map(mapReport),
        subCategories: categories.filter(c => c.parent_id === category.id)
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

export async function fetchAllPostsSimple() {
    const sql = `
        SELECT id, title, slug, category_id, created_at
        FROM reports
        ORDER BY title ASC
    `;
    try {
        const result = await query(sql);
        return result;
    } catch (e) {
        console.error('FetchAllPostsSimple Error:', e);
        return [];
    }
}

// Added Missing Function
export async function fetchPostBySlug(slug) {
    console.log('[DEBUG] fetchPostBySlug Input:', slug); // Debug Log
    const sql = `
        WITH PostNeighbors AS (
            SELECT 
                id, 
                LAG(slug) OVER (PARTITION BY category_id ORDER BY created_at ASC, id ASC) as prev_slug,
                LAG(title) OVER (PARTITION BY category_id ORDER BY created_at ASC, id ASC) as prev_title,
                LEAD(slug) OVER (PARTITION BY category_id ORDER BY created_at ASC, id ASC) as next_slug,
                LEAD(title) OVER (PARTITION BY category_id ORDER BY created_at ASC, id ASC) as next_title
            FROM reports
        )
        SELECT 
            r.id, r.title, r.slug, r.created_at, r.content_md, 
            r.category_id, r.author_type, r.tags,
            c.name as category_name,
            pn.prev_slug, pn.prev_title,
            pn.next_slug, pn.next_title
        FROM reports r
        LEFT JOIN categories c ON r.category_id = c.id
        LEFT JOIN PostNeighbors pn ON r.id = pn.id
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

    // Parse Tags (Handle JSON array string or array)
    let tags = [];
    if (Array.isArray(r.tags)) {
        tags = r.tags;
    } else if (typeof r.tags === 'string') {
        try {
            // Check if it looks like a JSON array
            if (r.tags.trim().startsWith('[')) {
                tags = JSON.parse(r.tags);
            }
        } catch (e) { console.warn('Tag parse error', e); }
    }

    return {
        id: r.id,
        title: r.title,
        slug: r.slug,
        rawDate: r.created_at,
        date: dateStr,
        content: r.content_md, // Correct Column
        categoryName: r.category_name || 'Uncategorized', // Fallback
        authorType: r.author_type || 'Unknown',
        tags: tags,
        prev: r.prev_slug ? { slug: r.prev_slug, title: r.prev_title } : null,
        next: r.next_slug ? { slug: r.next_slug, title: r.next_title } : null
    };
}

export function resetCache() {
    console.log('Clearing DB Cache...');
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sql_')) {
            keysToRemove.push(key);
        }
    }

    keysToRemove.forEach(k => localStorage.removeItem(k));
    alert('Cache Cleared! Page will reload.');
    window.location.reload();
}
