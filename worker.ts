/// <reference types="@cloudflare/workers-types" />

interface Env {
	DB: D1Database;
	MY_BUCKET: R2Bucket;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// 1. CORS Headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, HEAD, POST, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Check for required bindings to provide helpful errors
		if (!env.DB) {
			return new Response(
				JSON.stringify({ error: 'D1 Database binding "DB" is missing. Check wrangler.toml or Cloudflare Dashboard.' }),
				{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			);
		}

		if (!env.MY_BUCKET) {
			return new Response(
				JSON.stringify({ error: 'R2 Bucket binding "MY_BUCKET" is missing. Check wrangler.toml or Cloudflare Dashboard.' }),
				{ status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
			);
		}

		// 2. API Routes
		const path = url.pathname;

		// --- GET /api/files (List) ---
		if (request.method === 'GET' && path === '/api/files') {
			try {
				// NOTE: Requires migration: ALTER TABLE files ADD COLUMN folder TEXT DEFAULT '/';
				const { results } = await env.DB.prepare('SELECT * FROM files ORDER BY type = "directory" DESC, uploadedAt DESC').all();
				return new Response(JSON.stringify({ files: results }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			} catch (e) {
				return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
			}
		}

		// --- POST /api/folders (Create Folder) ---
		if (request.method === 'POST' && path === '/api/folders') {
			try {
				const body = await request.json() as { name: string; parent: string };
				if (!body.name) return new Response('Folder name required', { status: 400, headers: corsHeaders });

				const id = crypto.randomUUID();
				// Folders are virtual in R2, we just store them in D1 to maintain structure in the UI
				// We use the UUID as the key for consistency, though it won't map to an R2 object
				const key = crypto.randomUUID();
				const folderPath = body.parent || '/';

				await env.DB.prepare('INSERT INTO files (id, key, name, size, type, uploadedAt, url, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
					.bind(id, key, body.name, 0, 'directory', Date.now(), '', folderPath)
					.run();

				return new Response(
					JSON.stringify({
						file: { id, key, name: body.name, size: 0, type: 'directory', uploadedAt: Date.now(), url: '', folder: folderPath },
					}),
					{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
				);
			} catch (e) {
				return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
			}
		}

		// --- POST /api/upload (Upload) ---
		if (request.method === 'POST' && path === '/api/upload') {
			try {
				const formData = await request.formData();
				const file = formData.get('file') as File;
				const folder = formData.get('folder') as string || '/';

				if (!file) return new Response('No file uploaded', { status: 400, headers: corsHeaders });

				const id = crypto.randomUUID();
				const uuid = crypto.randomUUID(); 
				
				// Extract file extension (e.g., ".jpg") to append to the key
				const lastDotIndex = file.name.lastIndexOf('.');
				const ext = lastDotIndex !== -1 ? file.name.substring(lastDotIndex) : '';

				// If folder is root '/', just use uuid+ext.
				// If folder is '/images/', key becomes 'images/uuid.ext'
				// Remove leading slash for R2 key to avoid empty prefixes
				const prefix = folder === '/' ? '' : folder.slice(1);
				const key = prefix + uuid + ext;

				// Write to R2
				await env.MY_BUCKET.put(key, file);

				// Construct Public URL
				const publicUrl = `https://static-oss.dundun.uno/${key}`;

				// Write to D1
				await env.DB.prepare('INSERT INTO files (id, key, name, size, type, uploadedAt, url, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
					.bind(id, key, file.name, file.size, file.type, Date.now(), publicUrl, folder)
					.run();

				return new Response(
					JSON.stringify({
						file: { id, key, name: file.name, size: file.size, type: file.type, uploadedAt: Date.now(), url: publicUrl, folder },
					}),
					{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
				);
			} catch (e) {
				return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
			}
		}

		// --- DELETE /api/files/:key (Delete) ---
		if (request.method === 'DELETE' && path.startsWith('/api/files/')) {
			try {
				const rawKey = path.slice('/api/files/'.length);
				const key = decodeURIComponent(rawKey);

				if (!key) return new Response('Invalid key', { status: 400, headers: corsHeaders });

				// Check if it's a directory before deleting (optional safety)
				// For now, we just delete. If it's a file, delete from R2.
				// If it's a directory (which we know by checking D1, but here we save a query),
				// R2 delete won't fail if key doesn't exist.
				
				await env.MY_BUCKET.delete(key);

				// Delete from D1
				await env.DB.prepare('DELETE FROM files WHERE key = ?').bind(key).run();

				return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
			} catch (e) {
				return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
			}
		}

		return new Response('Not Found', { status: 404, headers: corsHeaders });
	},
};
