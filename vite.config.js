import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/narragen/',
  plugins: [
    react(),
    {
      name: 'local-storage-server',
      configureServer(server) {
        let db;
        const initDatabase = async () => {
          if (db) return db;
          const path = await import('path');
          const fs = await import('fs');
          const Database = (await import('better-sqlite3')).default;
          const dataDir = path.resolve('data');
          if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
          const dbFile = path.join(dataDir, 'app.sqlite');
          db = new Database(dbFile);
          db.pragma('journal_mode = WAL');
          db.exec(`
            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value TEXT
            );
            CREATE TABLE IF NOT EXISTS projects (
              id TEXT PRIMARY KEY,
              name TEXT,
              createdAt TEXT,
              updatedAt TEXT,
              cover TEXT,
              systemPrompt TEXT,
              outline TEXT,
              background TEXT
            );
            CREATE TABLE IF NOT EXISTS chapters (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              volumeId TEXT,
              "order" INTEGER,
              content TEXT,
              summary TEXT,
              createdAt TEXT,
              updatedAt TEXT,
              summaryGeneratedAt TEXT
            );
            CREATE TABLE IF NOT EXISTS characters (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              name TEXT,
              role TEXT,
              bio TEXT,
              traits TEXT,
              currentStatus TEXT,
              "order" INTEGER,
              avatar TEXT,
              displayImage TEXT,
              statusUpdatedAt TEXT,
              createdAt TEXT,
              updatedAt TEXT
            );
            CREATE TABLE IF NOT EXISTS constraints (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              content TEXT
            );
            CREATE TABLE IF NOT EXISTS relationships (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              "from" TEXT,
              "to" TEXT,
              relationship TEXT,
              type TEXT,
              createdAt TEXT
            );
            CREATE TABLE IF NOT EXISTS core_outlines (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              title TEXT,
              content TEXT,
              createdAt TEXT,
              updatedAt TEXT
            );
            CREATE TABLE IF NOT EXISTS volumes (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              name TEXT,
              "order" INTEGER,
              description TEXT,
              goal TEXT,
              startChapter INTEGER,
              endChapter INTEGER,
              keyEvents TEXT,
              createdAt TEXT,
              updatedAt TEXT
            );
            CREATE TABLE IF NOT EXISTS chapter_nodes (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              volumeId TEXT,
              "order" INTEGER,
              title TEXT,
              summary TEXT,
              content TEXT,
              createdAt TEXT,
              updatedAt TEXT
            );
            CREATE TABLE IF NOT EXISTS plot_states (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              version INTEGER,
              state TEXT,
              createdAt TEXT
            );
            CREATE TABLE IF NOT EXISTS plot_events (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              chapterNodeId TEXT,
              type TEXT,
              payload TEXT,
              createdAt TEXT
            );
            CREATE TABLE IF NOT EXISTS char_dynamic_states (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              characterId TEXT,
              state TEXT,
              createdAt TEXT,
              updatedAt TEXT
            );
            CREATE TABLE IF NOT EXISTS char_growth_arcs (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              characterId TEXT,
              name TEXT,
              description TEXT,
              progress INTEGER,
              createdAt TEXT,
              updatedAt TEXT
            );
            CREATE TABLE IF NOT EXISTS compressed_contexts (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              source TEXT,
              context TEXT,
              createdAt TEXT
            );
            CREATE TABLE IF NOT EXISTS prompt_logs (
              id TEXT PRIMARY KEY,
              projectId TEXT,
              taskId TEXT,
              taskName TEXT,
              timestamp INTEGER,
              agent TEXT,
              action TEXT,
              modules TEXT,
              fullPrompt TEXT,
              response TEXT,
              model TEXT,
              chapterNumber INTEGER
            );
            CREATE TABLE IF NOT EXISTS agent_activities (
              id TEXT PRIMARY KEY,
              chapterId TEXT,
              type TEXT,
              content TEXT,
              createdAt TEXT,
              updatedAt TEXT
            );
            CREATE TABLE IF NOT EXISTS custom_templates (
              id TEXT PRIMARY KEY,
              name TEXT,
              content TEXT,
              createdAt TEXT,
              updatedAt TEXT
            );
            CREATE TABLE IF NOT EXISTS prompt_templates (
              id TEXT PRIMARY KEY,
              name TEXT,
              content TEXT,
              type TEXT,
              createdAt TEXT,
              updatedAt TEXT
            );
          `);
          // Ensure columns exist for evolved schemas
          const ensureColumn = (table, column, type) => {
            try {
              const info = db.prepare(`PRAGMA table_info(${table})`).all();
              const exists = info.some(r => r.name === column);
              if (!exists) {
                db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
              }
            } catch { }
          };
          ensureColumn('volumes', 'goal', 'TEXT');
          ensureColumn('volumes', 'startChapter', 'INTEGER');
          ensureColumn('volumes', 'endChapter', 'INTEGER');
          ensureColumn('volumes', 'keyEvents', 'TEXT');
          ensureColumn('volumes', 'plannedChapters', 'INTEGER');
          ensureColumn('volumes', 'scenesPerChapter', 'INTEGER');
          ensureColumn('volumes', 'mainGoal', 'TEXT');
          ensureColumn('volumes', 'cliffhanger', 'TEXT');
          // Projects 表扩展列
          ensureColumn('projects', 'bookStyle', 'TEXT');
          ensureColumn('projects', 'tags', 'TEXT');
          // Characters 表扩展列
          ensureColumn('characters', 'age', 'TEXT');
          ensureColumn('characters', 'gender', 'TEXT');
          ensureColumn('characters', 'appearance', 'TEXT');
          ensureColumn('characters', 'goal', 'TEXT');
          ensureColumn('characters', 'arc', 'TEXT');
          ensureColumn('characters', 'originalAvatar', 'TEXT');
          ensureColumn('characters', 'originalDisplayImage', 'TEXT');
          ensureColumn('characters', 'currentState', 'TEXT');
          ensureColumn('characters', 'relationships', 'TEXT');
          ensureColumn('characters', 'stateHistory', 'TEXT');
          ensureColumn('characters', 'chapterAppearances', 'TEXT');
          ensureColumn('characters', 'updatedAt', 'TEXT');
          ensureColumn('characters', 'createdAt', 'TEXT');
          // chapter_nodes 表扩展列
          ensureColumn('chapter_nodes', 'passionLevel', 'INTEGER');
          ensureColumn('chapter_nodes', 'chapterGoal', 'TEXT');
          ensureColumn('chapter_nodes', 'chapterOutcome', 'TEXT');
          ensureColumn('chapter_nodes', 'openQuestions', 'TEXT');
          ensureColumn('chapter_nodes', 'resolvedQuestions', 'TEXT');
          // custom_templates 表扩展列
          ensureColumn('custom_templates', 'icon', 'TEXT');
          ensureColumn('custom_templates', 'description', 'TEXT');
          ensureColumn('custom_templates', 'category', 'TEXT');
          ensureColumn('custom_templates', 'storyFields', 'TEXT');
          ensureColumn('custom_templates', 'worldFields', 'TEXT');
          ensureColumn('custom_templates', 'characters', 'TEXT');
          ensureColumn('custom_templates', 'options', 'TEXT');
          // prompt_logs 表扩展列
          ensureColumn('prompt_logs', 'status', 'TEXT');
          ensureColumn('prompt_logs', 'completedAt', 'INTEGER');
          // agent_activities 表扩展列
          ensureColumn('agent_activities', 'agent', 'TEXT');
          ensureColumn('agent_activities', 'time', 'TEXT');
          ensureColumn('agent_activities', 'action', 'TEXT');
          ensureColumn('agent_activities', 'details', 'TEXT');
          ensureColumn('agent_activities', 'status', 'TEXT');
          ensureColumn('agent_activities', 'extraData', 'TEXT');
          // One-time migration from JSON files if tables are empty
          const tables = ['projects', 'chapters', 'characters', 'constraints', 'relationships', 'settings'];
          for (const t of tables) {
            const count = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
            if (count === 0) {
              const jsonPath = path.join(dataDir, `${t}.json`);
              if (fs.existsSync(jsonPath)) {
                try {
                  const arr = JSON.parse(fs.readFileSync(jsonPath, 'utf-8')) || [];
                  if (Array.isArray(arr) && arr.length) {
                    const cols = t === 'settings' ? ['key', 'value'] : Object.keys(arr[0]);
                    const placeholders = cols.map(() => '?').join(',');
                    const stmt = db.prepare(`INSERT INTO ${t} (${cols.join(',')}) VALUES (${placeholders})`);
                    const insertMany = db.transaction((rows) => {
                      for (const r of rows) stmt.run(cols.map(c => r[c]));
                    });
                    insertMany(arr);
                  }
                } catch { }
              }
            }
          }

          // 首次安装自动加载出厂种子数据（data/seed/）
          // 触发条件：projects 表为空（全新用户，没有手动创建过任何项目）
          try {
            const projectCount = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
            const seedDir = path.join(dataDir, 'seed');
            if (projectCount === 0 && fs.existsSync(path.join(seedDir, 'projects.json'))) {
              console.log('[Seed] Empty DB detected, loading factory seed data...');

              const seedTables = [
                'projects', 'volumes', 'chapter_nodes', 'characters',
                'constraints', 'core_outlines', 'settings',
              ];

              // 某些表的字段在 DB 里以 JSON 字符串存储，加载时需 stringify 回去
              const jsonStringifyFields = {
                projects: ['bookStyle', 'tags'],
                volumes: ['keyEvents'],
                characters: ['currentState', 'relationships', 'stateHistory', 'chapterAppearances'],
              };
              const stringifyJson = (table, row) => {
                const fields = jsonStringifyFields[table];
                if (!fields) return row;
                for (const f of fields) {
                  if (row[f] != null && typeof row[f] !== 'string') {
                    row[f] = JSON.stringify(row[f]);
                  }
                }
                return row;
              };

              const insertSeedRows = db.transaction((table, rows) => {
                if (rows.length === 0) return;
                if (table === 'settings') {
                  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
                  for (const r of rows) stmt.run(r.key, r.value);
                } else {
                  const cols = Object.keys(rows[0]);
                  // SQLite 关键字列名（如 order/from/to）需要加引号
                  const quoteIfReserved = (c) => ['order', 'from', 'to'].includes(c.toLowerCase()) ? `"${c}"` : c;
                  const colIdents = cols.map(quoteIfReserved).join(',');
                  const placeholders = cols.map(() => '?').join(',');
                  const stmt = db.prepare(`INSERT INTO ${table} (${colIdents}) VALUES (${placeholders})`);
                  for (const r of rows) {
                    const normalized = stringifyJson(table, { ...r });
                    stmt.run(...cols.map(c => normalized[c]));
                  }
                }
              });

              for (const t of seedTables) {
                const f = path.join(seedDir, `${t}.json`);
                if (!fs.existsSync(f)) continue;
                const rows = JSON.parse(fs.readFileSync(f, 'utf-8')) || [];
                try {
                  insertSeedRows(t, rows);
                  console.log(`[Seed]   ${t}: ${rows.length} rows`);
                } catch (innerErr) {
                  console.error(`[Seed]   ✗ ${t} failed: ${innerErr.message}`);
                  if (rows.length > 0) {
                    console.error(`[Seed]     first row keys: ${Object.keys(rows[0]).join(', ')}`);
                  }
                  throw innerErr;
                }
              }

              // 清空 custom_templates / prompt_templates：出厂时不应有任何"用户自定义模板"
              // （这是用户的工作数据，但全新安装应该从空白开始）
              for (const t of ['custom_templates', 'prompt_templates']) {
                const before = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
                if (before > 0) {
                  db.exec(`DELETE FROM ${t}`);
                  console.log(`[Seed]   ${t}: cleared ${before} rows (factory reset)`);
                }
              }

              // 拷贝种子图片到运行时图片目录（仅当目标不存在，避免覆盖用户后续修改）
              const imgSrc = path.join(seedDir, 'images');
              const imgDst = path.join(dataDir, 'images');
              if (fs.existsSync(imgSrc)) {
                for (const sub of ['covers', 'characters']) {
                  const src = path.join(imgSrc, sub);
                  const dst = path.join(imgDst, sub);
                  if (!fs.existsSync(src)) continue;
                  fs.mkdirSync(dst, { recursive: true });
                  for (const file of fs.readdirSync(src)) {
                    const s = path.join(src, file);
                    const d = path.join(dst, file);
                    if (!fs.existsSync(d)) fs.copyFileSync(s, d);
                  }
                }
                console.log('[Seed]   images copied');
              }

              console.log('[Seed] Factory seed loaded successfully.');
            }
          } catch (seedErr) {
            console.error('[Seed] Failed to load factory seed:', seedErr);
          }

          return db;
        };

        server.middlewares.use('/api/storage', async (req, res) => {
          const path = await import('path');
          const url = new URL(req.url, `http://${req.headers.host}`);
          const parts = url.pathname.split('/').filter(p => p);
          const storeName = parts[0];
          const id = parts[1];
          const database = await initDatabase();

          const quoteIdent = (k) => {
            return ['order', 'from', 'to'].includes(k) ? `"${k}"` : k;
          };

          const sendJSON = (obj) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
          };

          try {
            if (req.method === 'GET') {
              const projectId = url.searchParams.get('projectId');
              const volumeId = url.searchParams.get('volumeId');
              const characterId = url.searchParams.get('characterId');
              const chapterNodeId = url.searchParams.get('chapterNodeId');
              if (id) {
                if (storeName === 'settings') {
                  const row = database.prepare('SELECT key, value FROM settings WHERE key = ?').get(id);
                  sendJSON(row || null);
                } else {
                  const row = database.prepare(`SELECT * FROM ${storeName} WHERE id = ?`).get(id);
                  sendJSON(row || null);
                }
              } else {
                let rows;
                const filters = [];
                const params = [];
                if (projectId) { filters.push('projectId = ?'); params.push(projectId); }
                if (volumeId) { filters.push('volumeId = ?'); params.push(volumeId); }
                if (characterId) { filters.push('characterId = ?'); params.push(characterId); }
                if (chapterNodeId) { filters.push('chapterNodeId = ?'); params.push(chapterNodeId); }
                const source = url.searchParams.get('source');
                if (source) { filters.push('source = ?'); params.push(source); }
                const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
                rows = database.prepare(`SELECT * FROM ${storeName}${where}`).all(...params);
                if (storeName === 'projects') {
                  rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                }
                sendJSON(rows);
              }
            } else if (req.method === 'POST') {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', () => {
                try {
                  const item = JSON.parse(body || '{}');
                  const keys = Object.keys(item);
                  // 序列化对象值为 JSON 字符串
                  const serializeValue = (v) => {
                    if (v === null || v === undefined) return null;
                    if (typeof v === 'object') return JSON.stringify(v);
                    return v;
                  };


                  const colIdents = keys.map(quoteIdent).join(',');
                  const placeholders = keys.map(() => '?').join(',');
                  const stmt = database.prepare(`INSERT INTO ${storeName} (${colIdents}) VALUES (${placeholders})`);
                  stmt.run(keys.map(k => serializeValue(item[k])));
                  sendJSON(item);
                } catch (error) {
                  console.error('Storage POST Error:', error);
                  res.statusCode = 500;
                  sendJSON({ error: error.message });
                }
              });
            } else if (req.method === 'PUT') {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', async () => {
                try {
                  const updates = JSON.parse(body || '{}');

                  // 智能清理旧图片：只有当用新的有效图像替换旧图像时才删除
                  // 空值、undefined 或非图像路径的新值不会触发删除
                  if (storeName === 'projects' || storeName === 'characters') {
                    try {
                      if (updates.id) {
                        const oldRow = database.prepare(`SELECT * FROM ${storeName} WHERE id = ?`).get(updates.id);
                        if (oldRow) {
                          const imageFields = ['cover', 'avatar', 'displayImage'];
                          const fs = await import('fs');
                          const path = await import('path');

                          for (const field of imageFields) {
                            const newUrl = updates[field];
                            const oldUrl = oldRow[field];

                            // 条件：新值是有效图像路径 && 旧值是有效图像路径 && 两者不同
                            const isNewUrlValid = newUrl && typeof newUrl === 'string' && newUrl.startsWith('/api/images/');
                            const isOldUrlValid = oldUrl && typeof oldUrl === 'string' && oldUrl.startsWith('/api/images/');

                            if (isNewUrlValid && isOldUrlValid && newUrl !== oldUrl) {
                              const relPath = oldUrl.replace('/api/images/', 'data/images/');
                              const absPath = path.resolve(relPath);
                              if (fs.existsSync(absPath)) {
                                fs.unlinkSync(absPath);
                                console.log(`[Storage] Cleaned up old image: ${relPath}`);
                              }
                            }
                          }
                        }
                      }
                    } catch (cleanupErr) {
                      console.error('[Storage] Image cleanup failed:', cleanupErr);
                    }
                  }
                  // 辅助函数：序列化对象为 JSON 字符串
                  const serializeValue = (v) => {
                    if (v === null || v === undefined) return null;
                    if (typeof v === 'object') return JSON.stringify(v);
                    return v;
                  };
                  if (storeName === 'settings') {
                    // 验证必需参数
                    if (!updates.key) {
                      res.statusCode = 400;
                      sendJSON({ error: 'Missing required field: key' });
                      return;
                    }
                    const stmt = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
                    stmt.run(updates.key, serializeValue(updates.value));
                    sendJSON(updates);
                  } else {
                    // 验证 id 存在
                    if (!updates.id) {
                      res.statusCode = 400;
                      sendJSON({ error: 'Missing required field: id' });
                      return;
                    }
                    const keys = Object.keys(updates).filter(k => k !== 'id');
                    if (keys.length === 0) {
                      sendJSON(updates);
                      return;
                    }
                    // 序列化对象值为 JSON 字符串
                    const serializeValue = (v) => {
                      if (v === null || v === undefined) return null;
                      if (typeof v === 'object') return JSON.stringify(v);
                      return v;
                    };
                    const setClause = keys.map(k => `${quoteIdent(k)} = ?`).join(', ');
                    const stmt = database.prepare(`UPDATE ${storeName} SET ${setClause} WHERE id = ?`);
                    stmt.run([...keys.map(k => serializeValue(updates[k])), updates.id]);
                    const row = database.prepare(`SELECT * FROM ${storeName} WHERE id = ?`).get(updates.id);
                    sendJSON(row);
                  }
                } catch (error) {
                  console.error('Storage PUT Error:', error);
                  res.statusCode = 500;
                  sendJSON({ error: error.message });
                }
              });
            } else if (req.method === 'DELETE') {
              if (storeName === 'settings') {
                // settings table uses 'key' as primary key, not 'id'
                const stmt = database.prepare(`DELETE FROM settings WHERE key = ?`);
                stmt.run(id);
              } else {
                const stmt = database.prepare(`DELETE FROM ${storeName} WHERE id = ?`);
                stmt.run(id);
              }
              sendJSON({ success: true });
            }
          } catch (error) {
            console.error('Storage API Error:', error);
            res.statusCode = 500;
            sendJSON({ error: error.message });
          }
        });

        // ========== 图像文件存储 API ==========
        // POST /api/images/upload - 上传图像（支持文件直接上传和 Base64）
        server.middlewares.use('/api/images/upload', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          const path = await import('path');
          const fs = await import('fs');
          const crypto = await import('crypto');

          const contentType = req.headers['content-type'] || '';

          // 处理 multipart/form-data（文件直接上传）
          if (contentType.includes('multipart/form-data')) {
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', async () => {
              try {
                const buffer = Buffer.concat(chunks);
                const boundary = contentType.split('boundary=')[1];
                if (!boundary) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'Missing boundary' }));
                  return;
                }

                // 简单解析 multipart 数据
                const parts = buffer.toString('binary').split('--' + boundary);
                let fileData = null;
                let type = 'misc';
                let originalFilename = 'image.png';

                for (const part of parts) {
                  if (part.includes('Content-Disposition')) {
                    const nameMatch = part.match(/name="([^"]+)"/);
                    const filenameMatch = part.match(/filename="([^"]+)"/);

                    if (nameMatch) {
                      const name = nameMatch[1];
                      const content = part.split('\r\n\r\n')[1];

                      if (name === 'type' && content) {
                        type = content.split('\r\n')[0].trim();
                      } else if (name === 'file' && filenameMatch) {
                        originalFilename = filenameMatch[1];
                        // 获取文件二进制数据
                        const dataStart = part.indexOf('\r\n\r\n') + 4;
                        const dataEnd = part.lastIndexOf('\r\n');
                        fileData = Buffer.from(part.slice(dataStart, dataEnd), 'binary');
                      }
                    }
                  }
                }

                if (!fileData) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: 'No file uploaded' }));
                  return;
                }

                // 生成唯一文件名
                const ext = path.extname(originalFilename) || '.png';
                const uniqueId = crypto.randomBytes(8).toString('hex');
                const filename = `${Date.now()}_${uniqueId}${ext}`;

                // 确保目录存在
                const imagesDir = path.resolve('data', 'images', type);
                if (!fs.existsSync(imagesDir)) {
                  fs.mkdirSync(imagesDir, { recursive: true });
                }

                // 保存文件
                const filePath = path.join(imagesDir, filename);
                fs.writeFileSync(filePath, fileData);

                const url = `/api/images/${type}/${filename}`;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, url, path: filePath }));

              } catch (error) {
                console.error('File upload error:', error);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: error.message }));
              }
            });
            return;
          }

          // 处理 JSON（Base64 上传，保持兼容性）
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', async () => {
            try {
              const { type, filename, data } = JSON.parse(body);

              if (!type || !filename || !data) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing required fields: type, filename, data' }));
                return;
              }

              // 确保目录存在
              const imagesDir = path.resolve('data', 'images', type);
              if (!fs.existsSync(imagesDir)) {
                fs.mkdirSync(imagesDir, { recursive: true });
              }

              // 从 Base64 提取图像数据
              let base64Data = data;
              if (data.includes(',')) {
                base64Data = data.split(',')[1];
              }

              // 保存文件
              const filePath = path.join(imagesDir, filename);
              fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

              const url = `/api/images/${type}/${filename}`;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, url, path: filePath }));
            } catch (error) {
              console.error('Image upload error:', error);
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error.message }));
            }
          });
        });

        // GET /api/images/:type/:filename - 获取图像
        server.middlewares.use('/api/images', async (req, res, next) => {
          // 排除 upload 路由（已单独处理）
          if (req.url.startsWith('/upload')) {
            next();
            return;
          }

          const path = await import('path');
          const fs = await import('fs');

          const urlPath = req.url.split('?')[0]; // 移除查询参数
          const parts = urlPath.split('/').filter(p => p);

          if (parts.length < 2) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Invalid path. Use /api/images/:type/:filename' }));
            return;
          }

          const [type, rawFilename] = parts;
          // Decode filename to handle Chinese characters and spaces correctly
          const filename = decodeURIComponent(rawFilename);
          const filePath = path.resolve('data', 'images', type, filename);

          if (req.method === 'GET') {
            if (!fs.existsSync(filePath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Image not found' }));
              return;
            }

            // 确定 MIME 类型
            const ext = path.extname(filename).toLowerCase();
            const mimeTypes = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.webp': 'image/webp'
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';

            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年缓存
            const imageBuffer = fs.readFileSync(filePath);
            res.end(imageBuffer);

          } else if (req.method === 'DELETE') {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));

          } else {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
          }
        });
      }
    }
  ],
})
