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
			return new Response(JSON.stringify({ error: 'D1 Database binding "DB" is missing. Check wrangler.toml or Cloudflare Dashboard.' }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
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
				const body = (await request.json()) as { name: string; parent: string };
				if (!body.name) return new Response('Folder name required', { status: 400, headers: corsHeaders });

				const id = crypto.randomUUID();
				const folderPath = body.parent || '/';

				// Calculate R2 Key for the folder to create a real directory object
				// Remove leading slash for R2 key if it exists (unless it is just root, which becomes empty prefix)
				const prefix = folderPath === '/' ? '' : folderPath.slice(1);
				
				// The key must end with a slash to be treated as a directory marker in standard S3/R2 clients
				const r2Key = `${prefix}${body.name}/`;

				// Create a 0-byte object in R2 to represent the folder
				await env.MY_BUCKET.put(r2Key, new Uint8Array(0));

				// We use the r2Key as the 'key' in D1 so that delete operations work correctly on R2 as well
				await env.DB.prepare('INSERT INTO files (id, key, name, size, type, uploadedAt, url, folder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
					.bind(id, r2Key, body.name, 0, 'directory', Date.now(), '', folderPath)
					.run();

				return new Response(
					JSON.stringify({
						file: { id, key: r2Key, name: body.name, size: 0, type: 'directory', uploadedAt: Date.now(), url: '', folder: folderPath },
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
				const folder = (formData.get('folder') as string) || '/';

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

				const isDirectory = key.endsWith('/');

				if (isDirectory) {
					// It is a folder. We need to perform a recursive delete.
					// 1. Calculate the folder path prefix that children would have in the 'folder' column.
					// The key is like 'foo/bar/'. The folder path used in 'folder' column is '/foo/bar/'.
					const folderPathForDb = '/' + key;

					// 2. Find all files/folders that are inside this folder (recursively)
					// We look for items where 'folder' is exactly this folder or starts with it (subfolders)
					const query = `SELECT key FROM files WHERE folder = ? OR folder LIKE ?`;
					const { results } = await env.DB.prepare(query)
						.bind(folderPathForDb, folderPathForDb + '%')
						.all();

					const keysToDelete = results.map((r: any) => r.key as string);
					
					// Add the folder itself (the marker object) to the deletion list
					keysToDelete.push(key);

					// 3. Delete from R2 (in batches of 1000 to be safe, though R2 delete(string[]) handles it well)
					const chunkSize = 1000;
					for (let i = 0; i < keysToDelete.length; i += chunkSize) {
						const batch = keysToDelete.slice(i, i + chunkSize);
						if (batch.length > 0) {
							await env.MY_BUCKET.delete(batch);
						}
					}

					// 4. Delete from D1
					// Delete all children rows and the folder row itself
					const deleteQuery = `DELETE FROM files WHERE folder = ? OR folder LIKE ? OR key = ?`;
					await env.DB.prepare(deleteQuery)
						.bind(folderPathForDb, folderPathForDb + '%', key)
						.run();

				} else {
					// Single file deletion
					await env.MY_BUCKET.delete(key);
					await env.DB.prepare('DELETE FROM files WHERE key = ?').bind(key).run();
				}

				return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
			} catch (e) {
				return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
			}
		}

		return new Response('Not Found', { status: 404, headers: corsHeaders });
	},
};
