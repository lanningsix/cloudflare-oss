
interface Env {
	DB: D1Database;
	MY_BUCKET: R2Bucket;
}

// Helper for hashing passwords
async function hashPassword(password: string): Promise<string> {
	const msgBuffer = new TextEncoder().encode(password);
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// 1. CORS Headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-User-Type',
            'Access-Control-Expose-Headers': 'ETag',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Check for required bindings
		if (!env.DB || !env.MY_BUCKET) {
			return new Response(JSON.stringify({ error: 'Bindings missing.' }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		const path = url.pathname;

		// --- AUTH ROUTES ---

		// POST /api/auth/register
		if (request.method === 'POST' && path === '/api/auth/register') {
			try {
				const { username, password } = (await request.json()) as any;
				
				if (!username || !password) {
					return new Response(JSON.stringify({ error: 'Username and password required' }), { status: 400, headers: corsHeaders });
				}

				// Initialize users table if not exists
				await env.DB.prepare(`
					CREATE TABLE IF NOT EXISTS users (
						id TEXT PRIMARY KEY,
						username TEXT UNIQUE,
						password TEXT,
						created_at INTEGER
					)
				`).run();

				// Check existing
				const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
				if (existing) {
					return new Response(JSON.stringify({ error: 'Username already exists' }), { status: 409, headers: corsHeaders });
				}

				const id = crypto.randomUUID();
				const hashedPassword = await hashPassword(password);

				await env.DB.prepare('INSERT INTO users (id, username, password, created_at) VALUES (?, ?, ?, ?)')
					.bind(id, username, hashedPassword, Date.now())
					.run();

				return new Response(JSON.stringify({ 
					user: { id, name: username, isGuest: false } 
				}), { 
					headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
				});

			} catch (e) {
				return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
			}
		}

		// POST /api/auth/login
		if (request.method === 'POST' && path === '/api/auth/login') {
			try {
				const { username, password } = (await request.json()) as any;

				if (!username || !password) {
					return new Response(JSON.stringify({ error: 'Username and password required' }), { status: 400, headers: corsHeaders });
				}

				const user = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();

				if (!user) {
					return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: corsHeaders });
				}

				const hashedPassword = await hashPassword(password);
				if (hashedPassword !== user.password) {
					return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401, headers: corsHeaders });
				}

				return new Response(JSON.stringify({ 
					user: { id: user.id, name: user.username, isGuest: false } 
				}), { 
					headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
				});

			} catch (e) {
				return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
			}
		}

		// --- FILE ROUTES ---

		// AUTHENTICATION CONTEXT FOR FILES
		const userId = request.headers.get('X-User-Id');
		const userType = request.headers.get('X-User-Type') || 'guest';

		if (!userId) {
			return new Response(JSON.stringify({ error: 'Unauthorized: Missing User ID' }), { 
				status: 401, 
				headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
			});
		}

		// --- GET /api/files (List) ---
		if (request.method === 'GET' && path === '/api/files') {
			try {
				// Ensure table exists
				await env.DB.prepare(`
					CREATE TABLE IF NOT EXISTS files (
						id TEXT PRIMARY KEY,
						key TEXT,
						name TEXT,
						size INTEGER,
						type TEXT,
						uploadedAt INTEGER,
						url TEXT,
						folder TEXT,
						owner_id TEXT
					)
				`).run();

				const { results } = await env.DB.prepare(
					'SELECT * FROM files WHERE owner_id = ? ORDER BY type = "directory" DESC, uploadedAt DESC'
				).bind(userId).all();
				
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
				const prefix = folderPath === '/' ? '' : folderPath.slice(1);
				const r2Key = `${prefix}${body.name}/`;

				// Create folder marker
				await env.MY_BUCKET.put(r2Key, new Uint8Array(0));

				// Insert with owner_id
				await env.DB.prepare('INSERT INTO files (id, key, name, size, type, uploadedAt, url, folder, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
					.bind(id, r2Key, body.name, 0, 'directory', Date.now(), '', folderPath, userId)
					.run();

				return new Response(
					JSON.stringify({
						file: { id, key: r2Key, name: body.name, size: 0, type: 'directory', uploadedAt: Date.now(), url: '', folder: folderPath, ownerId: userId },
					}),
					{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
				);
			} catch (e) {
				return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
			}
		}

        // --- MULTIPART UPLOAD ROUTES (Start) ---
        
        // 1. Init Multipart Upload
        if (request.method === 'POST' && path === '/api/upload/init') {
            try {
                // Check limits
                if (userType === 'guest') {
                    const countResult = await env.DB.prepare(
                        'SELECT COUNT(*) as count FROM files WHERE owner_id = ? AND type != "directory"'
                    ).bind(userId).first();
                    const count = countResult ? (countResult.count as number) : 0;
                    if (count >= 10) {
                        return new Response(JSON.stringify({ error: 'Upload limit reached (Max 10 files for guests).' }), { 
                            status: 403, 
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                        });
                    }
                }

                const { name, folder, type } = await request.json() as any;
                if (!name) throw new Error("Name required");

                const uuid = crypto.randomUUID();
                const lastDotIndex = name.lastIndexOf('.');
                const ext = lastDotIndex !== -1 ? name.substring(lastDotIndex) : '';
                const prefix = folder === '/' ? '' : folder.slice(1);
                const key = prefix + uuid + ext;

                const multipartUpload = await env.MY_BUCKET.createMultipartUpload(key, {
                    httpMetadata: { contentType: type || 'application/octet-stream' }
                });

                return new Response(JSON.stringify({
                    uploadId: multipartUpload.uploadId,
                    key: key
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

            } catch (e) {
                return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
            }
        }

        // 2. Upload Part
        if (request.method === 'PUT' && path === '/api/upload/part') {
            try {
                const uploadId = url.searchParams.get('uploadId');
                const key = url.searchParams.get('key');
                const partNumber = parseInt(url.searchParams.get('partNumber') || '0');

                if (!uploadId || !key || !partNumber) {
                    throw new Error("Missing uploadId, key, or partNumber");
                }

                const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
                const part = await multipartUpload.uploadPart(partNumber, request.body as ReadableStream);

                return new Response(JSON.stringify({
                    partNumber,
                    etag: part.etag
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

            } catch (e) {
                return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
            }
        }

        // 3. Complete Multipart Upload
        if (request.method === 'POST' && path === '/api/upload/complete') {
             try {
                const { uploadId, key, parts, name, folder, size, type } = await request.json() as any;

                if (!uploadId || !key || !parts) {
                    throw new Error("Missing completion data");
                }

                const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
                await multipartUpload.complete(parts);

                const publicUrl = `https://static-oss.dundun.uno/${key}`;

                // Record in DB
                const id = crypto.randomUUID();
                await env.DB.prepare('INSERT INTO files (id, key, name, size, type, uploadedAt, url, folder, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
					.bind(id, key, name, size, type, Date.now(), publicUrl, folder, userId)
					.run();

                return new Response(JSON.stringify({
                    file: { id, key, name, size, type, uploadedAt: Date.now(), url: publicUrl, folder, ownerId: userId }
                }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});

             } catch (e) {
                return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
             }
        }

        // --- MULTIPART UPLOAD ROUTES (End) ---


		// --- POST /api/upload (Simple Upload) ---
		if (request.method === 'POST' && path === '/api/upload') {
			try {
				// CHECK LIMITS FOR GUESTS
				if (userType === 'guest') {
					const countResult = await env.DB.prepare(
						'SELECT COUNT(*) as count FROM files WHERE owner_id = ? AND type != "directory"'
					).bind(userId).first();
					
					const count = countResult ? (countResult.count as number) : 0;
					
					if (count >= 10) {
						return new Response(JSON.stringify({ error: 'Upload limit reached (Max 10 files for guests).' }), { 
							status: 403, 
							headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
						});
					}
				}

				const formData = await request.formData();
				const file = formData.get('file') as File;
				const folder = (formData.get('folder') as string) || '/';

				if (!file) return new Response('No file uploaded', { status: 400, headers: corsHeaders });

				const id = crypto.randomUUID();
				const uuid = crypto.randomUUID();
				const lastDotIndex = file.name.lastIndexOf('.');
				const ext = lastDotIndex !== -1 ? file.name.substring(lastDotIndex) : '';
				const prefix = folder === '/' ? '' : folder.slice(1);
				const key = prefix + uuid + ext;

				await env.MY_BUCKET.put(key, file);
				const publicUrl = `https://static-oss.dundun.uno/${key}`;

				await env.DB.prepare('INSERT INTO files (id, key, name, size, type, uploadedAt, url, folder, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
					.bind(id, key, file.name, file.size, file.type, Date.now(), publicUrl, folder, userId)
					.run();

				return new Response(
					JSON.stringify({
						file: { id, key, name: file.name, size: file.size, type: file.type, uploadedAt: Date.now(), url: publicUrl, folder, ownerId: userId },
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
					// Folder Delete
					const folderPathForDb = '/' + key;
					const query = `SELECT key FROM files WHERE (folder = ? OR folder LIKE ?) AND owner_id = ?`;
					const { results } = await env.DB.prepare(query)
						.bind(folderPathForDb, folderPathForDb + '%', userId)
						.all();

					const keysToDelete = results.map((r: any) => r.key as string);
					keysToDelete.push(key); // Add folder key itself

					const chunkSize = 1000;
					for (let i = 0; i < keysToDelete.length; i += chunkSize) {
						const batch = keysToDelete.slice(i, i + chunkSize);
						if (batch.length > 0) await env.MY_BUCKET.delete(batch);
					}

					const deleteQuery = `DELETE FROM files WHERE (folder = ? OR folder LIKE ? OR key = ?) AND owner_id = ?`;
					await env.DB.prepare(deleteQuery)
						.bind(folderPathForDb, folderPathForDb + '%', key, userId)
						.run();

				} else {
					// File Delete
					await env.MY_BUCKET.delete(key);
					await env.DB.prepare('DELETE FROM files WHERE key = ? AND owner_id = ?')
						.bind(key, userId)
						.run();
				}

				return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
			} catch (e) {
				return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
			}
		}

		return new Response('Not Found', { status: 404, headers: corsHeaders });
	},
};
