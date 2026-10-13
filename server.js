// Narragen production server (Express-based, replaces Vite dev server for deployment)
// Re-implements the dev middleware from vite.config.js so the same storage/images API
// is available without depending on Vite.
//
// Mounted at: /narragen/api/*  (URL prefix is stripped before routing)

import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '5174', 10);
const URL_PREFIX = '/narragen';
const DATA_DIR = path.resolve(__dirname, 'data');

let db = null;

function initDatabase() {
    if (db) return db;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const dbFile = path.join(DATA_DIR, 'app.sqlite');
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
    ensureColumn('projects', 'bookStyle', 'TEXT');
    ensureColumn('projects', 'tags', 'TEXT');
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
    ensureColumn('chapter_nodes', 'passionLevel', 'INTEGER');
    ensureColumn('chapter_nodes', 'chapterGoal', 'TEXT');
    ensureColumn('chapter_nodes', 'chapterOutcome', 'TEXT');
    ensureColumn('chapter_nodes', 'openQuestions', 'TEXT');
    ensureColumn('chapter_nodes', 'resolvedQuestions', 'TEXT');
    ensureColumn('custom_templates', 'icon', 'TEXT');
    ensureColumn('custom_templates', 'description', 'TEXT');
    ensureColumn('custom_templates', 'category', 'TEXT');
    ensureColumn('custom_templates', 'storyFields', 'TEXT');
    ensureColumn('custom_templates', 'worldFields', 'TEXT');
    ensureColumn('custom_templates', 'characters', 'TEXT');
    ensureColumn('custom_templates', 'options', 'TEXT');
    ensureColumn('prompt_logs', 'status', 'TEXT');
    ensureColumn('prompt_logs', 'completedAt', 'INTEGER');
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
            const jsonPath = path.join(DATA_DIR, `${t}.json`);
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

    // Auto-load factory seed on first run (empty projects table)
    try {
        const projectCount = db.prepare('SELECT COUNT(*) AS c FROM projects').get().c;
        const seedDir = path.join(DATA_DIR, 'seed');
        if (projectCount === 0 && fs.existsSync(path.join(seedDir, 'projects.json'))) {
            console.log('[Seed] Empty DB detected, loading factory seed data...');
            const seedTables = [
                'projects', 'volumes', 'chapter_nodes', 'characters',
                'constraints', 'core_outlines', 'settings',
            ];
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
                    throw innerErr;
                }
            }
            for (const t of ['custom_templates', 'prompt_templates']) {
                const before = db.prepare(`SELECT COUNT(*) AS c FROM ${t}`).get().c;
                if (before > 0) {
                    db.exec(`DELETE FROM ${t}`);
                    console.log(`[Seed]   ${t}: cleared ${before} rows (factory reset)`);
                }
            }
            const imgSrc = path.join(seedDir, 'images');
            const imgDst = path.join(DATA_DIR, 'images');
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
}

const quoteIdent = (k) => ['order', 'from', 'to'].includes(k) ? `"${k}"` : k;
const sendJSON = (res, obj) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(obj));
};

const app = express();
app.use(express.json({ limit: '50mb' }));

// /api/storage/:storeName[/:id]  —  CRUD on any table
app.use(URL_PREFIX + '/api/storage', async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split('/').filter(p => p);
    const storeName = parts[0];
    const id = parts[1];
    const database = initDatabase();

    try {
        if (req.method === 'GET') {
            const projectId = url.searchParams.get('projectId');
            const volumeId = url.searchParams.get('volumeId');
            const characterId = url.searchParams.get('characterId');
            const chapterNodeId = url.searchParams.get('chapterNodeId');
            if (id) {
                if (storeName === 'settings') {
                    const row = database.prepare('SELECT key, value FROM settings WHERE key = ?').get(id);
                    sendJSON(res, row || null);
                } else {
                    const row = database.prepare(`SELECT * FROM ${storeName} WHERE id = ?`).get(id);
                    sendJSON(res, row || null);
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
                sendJSON(res, rows);
            }
        } else if (req.method === 'POST') {
            const item = req.body;
            const keys = Object.keys(item || {});
            const serializeValue = (v) => {
                if (v === null || v === undefined) return null;
                if (typeof v === 'object') return JSON.stringify(v);
                return v;
            };
            const colIdents = keys.map(quoteIdent).join(',');
            const placeholders = keys.map(() => '?').join(',');
            const stmt = database.prepare(`INSERT INTO ${storeName} (${colIdents}) VALUES (${placeholders})`);
            stmt.run(keys.map(k => serializeValue(item[k])));
            sendJSON(res, item);
        } else if (req.method === 'PUT') {
            const updates = req.body;
            if (storeName === 'projects' || storeName === 'characters') {
                try {
                    if (updates.id) {
                        const oldRow = database.prepare(`SELECT * FROM ${storeName} WHERE id = ?`).get(updates.id);
                        if (oldRow) {
                            const imageFields = ['cover', 'avatar', 'displayImage'];
                            for (const field of imageFields) {
                                const newUrl = updates[field];
                                const oldUrl = oldRow[field];
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
            const serializeValue = (v) => {
                if (v === null || v === undefined) return null;
                if (typeof v === 'object') return JSON.stringify(v);
                return v;
            };
            if (storeName === 'settings') {
                if (!updates.key) { res.statusCode = 400; return sendJSON(res, { error: 'Missing required field: key' }); }
                const stmt = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
                stmt.run(updates.key, serializeValue(updates.value));
                sendJSON(res, updates);
            } else {
                if (!updates.id) { res.statusCode = 400; return sendJSON(res, { error: 'Missing required field: id' }); }
                const keys = Object.keys(updates).filter(k => k !== 'id');
                if (keys.length === 0) { sendJSON(res, updates); return; }
                const setClause = keys.map(k => `${quoteIdent(k)} = ?`).join(', ');
                const stmt = database.prepare(`UPDATE ${storeName} SET ${setClause} WHERE id = ?`);
                stmt.run([...keys.map(k => serializeValue(updates[k])), updates.id]);
                const row = database.prepare(`SELECT * FROM ${storeName} WHERE id = ?`).get(updates.id);
                sendJSON(res, row);
            }
        } else if (req.method === 'DELETE') {
            if (storeName === 'settings') {
                const stmt = database.prepare(`DELETE FROM settings WHERE key = ?`);
                stmt.run(id);
            } else {
                const stmt = database.prepare(`DELETE FROM ${storeName} WHERE id = ?`);
                stmt.run(id);
            }
            sendJSON(res, { success: true });
        } else {
            res.statusCode = 405;
            sendJSON(res, { error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Storage API Error:', error);
        res.statusCode = 500;
        sendJSON(res, { error: error.message });
    }
});

// /api/images/upload
app.post(URL_PREFIX + '/api/images/upload', async (req, res) => {
    const contentType = req.headers['content-type'] || '';
    const imagesDir = (type) => {
        const p = path.resolve(DATA_DIR, 'images', type);
        if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
        return p;
    };

    try {
        if (contentType.includes('multipart/form-data')) {
            const chunks = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', async () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    const boundary = contentType.split('boundary=')[1];
                    if (!boundary) { res.statusCode = 400; return sendJSON(res, { error: 'Missing boundary' }); }
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
                                    const dataStart = part.indexOf('\r\n\r\n') + 4;
                                    const dataEnd = part.lastIndexOf('\r\n');
                                    fileData = Buffer.from(part.slice(dataStart, dataEnd), 'binary');
                                }
                            }
                        }
                    }
                    if (!fileData) { res.statusCode = 400; return sendJSON(res, { error: 'No file uploaded' }); }
                    const ext = path.extname(originalFilename) || '.png';
                    const uniqueId = crypto.randomBytes(8).toString('hex');
                    const filename = `${Date.now()}_${uniqueId}${ext}`;
                    const filePath = path.join(imagesDir(type), filename);
                    fs.writeFileSync(filePath, fileData);
                    const url = `/api/images/${type}/${filename}`;
                    sendJSON(res, { success: true, url, path: filePath });
                } catch (error) {
                    console.error('File upload error:', error);
                    res.statusCode = 500;
                    sendJSON(res, { error: error.message });
                }
            });
            return;
        }

        // JSON / Base64
        const { type, filename, data } = req.body;
        if (!type || !filename || !data) { res.statusCode = 400; return sendJSON(res, { error: 'Missing required fields: type, filename, data' }); }
        let base64Data = data.includes(',') ? data.split(',')[1] : data;
        const filePath = path.join(imagesDir(type), filename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        const url = `/api/images/${type}/${filename}`;
        sendJSON(res, { success: true, url, path: filePath });
    } catch (error) {
        console.error('Image upload error:', error);
        res.statusCode = 500;
        sendJSON(res, { error: error.message });
    }
});

// /api/images/:type/:filename  —  GET / DELETE
app.use(URL_PREFIX + '/api/images', (req, res) => {
    if (req.url.startsWith('/upload')) return;  // handled by dedicated POST route above
    const urlPath = req.url.split('?')[0];
    const parts = urlPath.split('/').filter(p => p);
    if (parts.length < 2) { res.statusCode = 400; return sendJSON(res, { error: 'Invalid path. Use /api/images/:type/:filename' }); }
    const [type, rawFilename] = parts;
    const filename = decodeURIComponent(rawFilename);
    const filePath = path.resolve(DATA_DIR, 'images', type, filename);
    if (req.method === 'GET') {
        if (!fs.existsSync(filePath)) { res.statusCode = 404; return sendJSON(res, { error: 'Image not found' }); }
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.end(fs.readFileSync(filePath));
    } else if (req.method === 'DELETE') {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return sendJSON(res, { success: true });
    } else {
        res.statusCode = 405;
        return sendJSON(res, { error: 'Method not allowed' });
    }
});

// Health check
app.get(URL_PREFIX + '/api/health', (req, res) => sendJSON(res, { ok: true }));

app.listen(PORT, '127.0.0.1', () => {
    console.log(`Narragen production server listening on http://127.0.0.1:${PORT}`);
    initDatabase();
});
