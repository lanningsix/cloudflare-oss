
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
				
                // Logic to generate R2 Key with User Isolation
                const prefix = folderPath === '/' ? '' : folderPath.slice(1);
				// We enforce user-specific directory structure in R2: userId/path/to/folder/
				const r2Key = `${userId}/${prefix}${body.name}/`;

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

        // --- POST /api/files/batch-delete ---
        if (request.method === 'POST' && path === '/api/files/batch-delete') {
            try {
                const { fileIds } = await request.json() as { fileIds: string[] };
                if (!fileIds || fileIds.length === 0) return new Response('No files specified', { status: 400, headers: corsHeaders });

                // 1. Get info
                const placeholders = fileIds.map(() => '?').join(',');
                const { results } = await env.DB.prepare(`SELECT key, id, type, folder, name FROM files WHERE id IN (${placeholders}) AND owner_id = ?`)
                    .bind(...fileIds, userId)
                    .all();

                if (!results || results.length === 0) return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

                const filesOnly = results.filter((f: any) => f.type !== 'directory');
                const foldersOnly = results.filter((f: any) => f.type === 'directory');

                // 2. Delete Files
                if (filesOnly.length > 0) {
                    const keys = filesOnly.map((f:any) => f.key);
                    const ids = filesOnly.map((f:any) => f.id);
                    
                    // R2 Batch Delete (chunks of 1000)
                    for (let i = 0; i < keys.length; i += 1000) {
                        await env.MY_BUCKET.delete(keys.slice(i, i + 1000));
                    }
                    // DB Delete
                    const idPlaceholders = ids.map(() => '?').join(',');
                    await env.DB.prepare(`DELETE FROM files WHERE id IN (${idPlaceholders})`).bind(...ids).run();
                }

                // 3. Delete Folders (Iterative due to complexity of finding children)
                for (const folder of foldersOnly) {
                    const folderPathForDb = (folder as any).folder === '/' ? `/${(folder as any).name}/` : `${(folder as any).folder}${(folder as any).name}/`;
                    
                    // Find all children keys
                    const q = `SELECT key FROM files WHERE (folder = ? OR folder LIKE ?) AND owner_id = ?`;
                    const ch = await env.DB.prepare(q).bind(folderPathForDb, folderPathForDb + '%', userId).all();
                    
                    const kDel = ch.results.map((r:any) => r.key as string);
                    kDel.push((folder as any).key); // add folder marker
                    
                    if (kDel.length > 0) {
                        for (let i = 0; i < kDel.length; i += 1000) await env.MY_BUCKET.delete(kDel.slice(i, i+1000));
                    }
                    
                    await env.DB.prepare(`DELETE FROM files WHERE (folder = ? OR folder LIKE ? OR id = ?) AND owner_id = ?`)
                        .bind(folderPathForDb, folderPathForDb + '%', (folder as any).id, userId).run();
                }

                return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

            } catch (e) {
                return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
            }
        }

        // --- POST /api/files/move ---
        if (request.method === 'POST' && path === '/api/files/move') {
             try {
                const { fileIds, destination } = await request.json() as { fileIds: string[], destination: string };
                // Note: Destination is a folder path, e.g. '/' or '/photos/'
                if (!fileIds || !fileIds.length) return new Response(JSON.stringify({error: 'No files'}), { status: 400, headers: corsHeaders});

                // Sanitize destination to ensure it starts with /
                // This fixes the issue where moving to "move/" resulted in "ove/" because of slice(1) on "move/"
                const finalDest = destination.startsWith('/') ? destination : '/' + destination;

                // Only supporting file moves for safety, folder moves are complex (recursive R2 copy/delete)
                const placeholders = fileIds.map(() => '?').join(',');
                const { results } = await env.DB.prepare(`SELECT * FROM files WHERE id IN (${placeholders}) AND owner_id = ?`)
                    .bind(...fileIds, userId)
                    .all();
                
                const movedFiles = [];

                for (const file of results as any[]) {
                    if (file.type === 'directory') continue; // Skip folders

                    const destPrefix = finalDest === '/' ? '' : finalDest.slice(1);
                    const oldKey = file.key;
                    
                    // Extract filename. 
                    // We assume the key structure ends with the filename.
                    const keyFileName = oldKey.split('/').pop();
                    if (!keyFileName) {
                        console.warn(`Invalid key format for ${file.name}: ${oldKey}`);
                        continue;
                    }
                    
                    // Construct new key with User Isolation enforced
                    const newKey = `${userId}/${destPrefix}${keyFileName}`;
                    
                    if (oldKey === newKey) continue;

                    // R2 Copy
                    try {
                        // 1. Verify Source Exists
                        const object = await env.MY_BUCKET.get(oldKey);
                        if (!object) {
                             console.warn(`Source file not found in R2: ${oldKey}`);
                             // Do NOT update DB if file is missing in R2
                             continue;
                        }

                        // 2. Put (Copy)
                        await env.MY_BUCKET.put(newKey, object.body, {
                            httpMetadata: object.httpMetadata
                        });
                        
                        // 3. Delete Old (only if Put didn't throw)
                        await env.MY_BUCKET.delete(oldKey);
                        
                        // 4. Update DB
                        const newUrl = `https://static-oss.dundun.uno/${newKey}`; 
                        
                        await env.DB.prepare(`UPDATE files SET folder = ?, key = ?, url = ? WHERE id = ?`)
                            .bind(finalDest, newKey, newUrl, file.id)
                            .run();
                        
                        movedFiles.push(file.id);
                    } catch (err) {
                        console.error(`Failed to move ${file.name}`, err);
                    }
                }

                return new Response(JSON.stringify({ success: true, moved: movedFiles }), { headers: corsHeaders });
             } catch(e) {
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
                
                // Enforce User Isolation
                const key = `${userId}/${prefix}${uuid}${ext}`;

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

        // 4. Abort Multipart Upload (Cleanup)
        if (request.method === 'POST' && path === '/api/upload/abort') {
             try {
                const { uploadId, key } = await request.json() as any;
                if (uploadId && key) {
                    const multipartUpload = env.MY_BUCKET.resumeMultipartUpload(key, uploadId);
                    await multipartUpload.abort();
                }
                return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
             } catch (e) {
                 // Even if it fails (e.g. already done), return success to UI
                 return new Response(JSON.stringify({ success: true, warning: (e as Error).message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
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
				
                // Enforce User Isolation
                const key = `${userId}/${prefix}${uuid}${ext}`;

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

                // Retrieve file metadata first to safely handle folder deletion structure
                const fileRecord = await env.DB.prepare('SELECT * FROM files WHERE key = ? AND owner_id = ?').bind(key, userId).first();

                if (!fileRecord) {
                    // Attempt to delete from R2 anyway to clean up orphans, then return success
                    await env.MY_BUCKET.delete(key);
                    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
                }

				const isDirectory = fileRecord.type === 'directory';

				if (isDirectory) {
					// Folder Delete Logic
                    // Determine virtual path from DB record, not just from key
                    let virtualPath = '';
                    if (fileRecord.folder === '/') {
                        virtualPath = `/${fileRecord.name}/`;
                    } else {
                        virtualPath = `${fileRecord.folder}${fileRecord.name}/`;
                    }

					const query = `SELECT key FROM files WHERE (folder = ? OR folder LIKE ?) AND owner_id = ?`;
					const { results } = await env.DB.prepare(query)
						.bind(virtualPath, virtualPath + '%', userId)
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
						.bind(virtualPath, virtualPath + '%', key, userId)
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
