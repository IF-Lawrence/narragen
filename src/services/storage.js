/**
 * Storage Service
 * 使用本地服务器 API 存储数据（替代 IndexedDB）
 */

const API_BASE = '/api/storage';

/**
 * 通用 fetch 封装，带错误处理
 */
async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `API Error: ${response.status}`);
    }
    return response.json();
}

/**
 * Parse JSON fields based on store name
 * Database stores objects/arrays as JSON strings, this function parses them back
 */
function parseJsonFields(storeName, item) {
    if (!item) return item;

    const jsonFieldsMap = {
        'characters': ['currentState', 'relationships', 'stateHistory', 'chapterAppearances'],
        'volumes': ['keyEvents'],
        'projects': ['bookStyle', 'tags'],
        'custom_templates': ['storyFields', 'worldFields', 'characters', 'options'],
    };

    const fields = jsonFieldsMap[storeName];
    if (!fields) return item;

    for (const field of fields) {
        if (item[field] && typeof item[field] === 'string') {
            try {
                item[field] = JSON.parse(item[field]);
            } catch {
                // If parsing fails, keep as-is or set to default
                if (field.endsWith('s') || field === 'stateHistory' || field === 'chapterAppearances') {
                    item[field] = []; // Array fields
                } else {
                    item[field] = {}; // Object fields
                }
            }
        }
    }
    return item;
}

export const storage = {
    // ========== 项目 ==========
    async getProjects() {
        const projects = await apiFetch(`${API_BASE}/projects`);
        // Parse JSON fields (bookStyle, tags)
        return projects.map(p => parseJsonFields('projects', p));
    },

    async getProject(id) {
        const project = await apiFetch(`${API_BASE}/projects/${id}`);
        // Parse JSON fields (bookStyle, tags)
        return parseJsonFields('projects', project);
    },

    async createProject(name) {
        const project = {
            id: crypto.randomUUID(),
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            bookStyle: JSON.stringify({
                spineColor: '#F9F4EE',
                titleStyle: 'vertical',
                fontFamily: 'inherit'
            })
        };
        await apiFetch(`${API_BASE}/projects`, {
            method: 'POST',
            body: JSON.stringify(project)
        });
        // 返回时解析 bookStyle
        return { ...project, bookStyle: JSON.parse(project.bookStyle) };
    },

    async updateProject(id, updates) {
        // 如果更新包含 bookStyle 对象，序列化为字符串
        const payload = { ...updates };
        if (payload.bookStyle && typeof payload.bookStyle === 'object') {
            payload.bookStyle = JSON.stringify(payload.bookStyle);
        }
        const result = await apiFetch(`${API_BASE}/projects`, {
            method: 'PUT',
            body: JSON.stringify({ id, ...payload, updatedAt: new Date().toISOString() })
        });
        // 返回时解析 bookStyle
        if (result.bookStyle && typeof result.bookStyle === 'string') {
            try { result.bookStyle = JSON.parse(result.bookStyle); } catch { }
        }
        return result;
    },

    // ========== 通用 CRUD ==========
    async getItemsByProject(storeName, projectId) {
        const items = await apiFetch(`${API_BASE}/${storeName}?projectId=${projectId}`);
        // Parse JSON fields based on store name
        return items.map(item => parseJsonFields(storeName, item));
    },

    async addItem(storeName, item) {
        const newItem = { ...item, id: item.id || crypto.randomUUID() };
        await apiFetch(`${API_BASE}/${storeName}`, {
            method: 'POST',
            body: JSON.stringify(newItem)
        });
        return newItem;
    },

    async updateItem(storeName, item) {
        await apiFetch(`${API_BASE}/${storeName}`, {
            method: 'PUT',
            body: JSON.stringify(item)
        });
        return item;
    },

    /**
     * Get a single item by ID from any table
     */
    async getItemById(storeName, id) {
        const item = await apiFetch(`${API_BASE}/${storeName}/${id}`);
        return parseJsonFields(storeName, item);
    },

    async deleteItem(storeName, id) {
        await apiFetch(`${API_BASE}/${storeName}/${id}`, { method: 'DELETE' });
    },

    /**
     * Cascade delete a project and ALL related data
     * This includes: volumes, chapter_nodes, characters, constraints, relationships,
     * prompt_logs, core_outline, and form drafts
     */
    async deleteProjectCascade(projectId) {
        console.log(`[Storage] Starting cascade delete for project: ${projectId}`);

        // 1. Get project info first (for image cleanup)
        const project = await this.getProject(projectId);

        // 2. Delete related data from all tables
        const relatedTables = [
            'volumes',
            'chapter_nodes',
            'characters',
            'constraints',
            'relationships',
            'prompt_logs'
        ];

        for (const table of relatedTables) {
            try {
                const items = await this.getItemsByProject(table, projectId);
                for (const item of items) {
                    // Clean up image files for characters
                    if (table === 'characters') {
                        if (item.avatar) await this.deleteImageFile(item.avatar);
                        if (item.displayImage) await this.deleteImageFile(item.displayImage);
                    }
                    await this.deleteItem(table, item.id);
                }
                console.log(`[Storage] Deleted ${items.length} items from ${table}`);
            } catch (e) {
                console.warn(`[Storage] Failed to delete from ${table}:`, e);
            }
        }

        // 3. Delete settings entries (core outline, form drafts, etc.)
        const settingsKeys = [
            `core_outline_${projectId}`,
            `narragen_form_draft_${projectId}`,
            `volumePlan_subplots_${projectId}`,
            `volumePlan_foreshadowing_${projectId}`
        ];

        for (const key of settingsKeys) {
            try {
                await this.deleteSetting(key);
                console.log(`[Storage] Deleted setting: ${key}`);
            } catch (e) {
                // Setting may not exist, ignore
            }
        }

        // 4. Delete project cover image
        if (project?.cover) {
            await this.deleteImageFile(project.cover);
        }

        // 5. Finally delete the project itself
        await this.deleteItem('projects', projectId);
        console.log(`[Storage] Cascade delete completed for project: ${projectId}`);
    },

    /**
     * Helper to delete an image file from the server
     */
    async deleteImageFile(imageUrl) {
        if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('/api/images/')) {
            return;
        }
        try {
            await apiFetch(imageUrl, { method: 'DELETE' });
            console.log(`[Storage] Deleted image: ${imageUrl}`);
        } catch (e) {
            console.warn(`[Storage] Failed to delete image ${imageUrl}:`, e);
        }
    },

    // ========== 设置（键值存储） ==========
    async getItem(key) {
        const result = await apiFetch(`${API_BASE}/settings/${key}`);
        const value = result?.value;
        if (value == null) return null;

        // 自动尝试解析 JSON 字符串（后端 serializeValue 会将对象/数组 stringify）
        if (typeof value === 'string') {
            try {
                // 检测是否是 JSON 对象或数组格式
                const trimmed = value.trim();
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                    (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                    return JSON.parse(value);
                }
            } catch {
                // 解析失败则返回原始字符串
            }
        }
        return value;
    },

    async setItem(key, value) {
        // 自动序列化对象/数组值
        const serializedValue = (typeof value === 'object' && value !== null)
            ? JSON.stringify(value)
            : value;
        await apiFetch(`${API_BASE}/settings`, {
            method: 'PUT',
            body: JSON.stringify({ key, value: serializedValue })
        });
    },

    async deleteSetting(key) {
        await apiFetch(`${API_BASE}/settings/${key}`, { method: 'DELETE' });
    },

    async getAllKeys() {
        const settings = await apiFetch(`${API_BASE}/settings`);
        return settings.map(s => s.key);
    },

    // 别名，保持兼容性
    async getSetting(key) {
        return this.getItem(key);
    },

    async saveSettings(key, value) {
        return this.setItem(key, value);
    },

    // Agent Activities
    async getActivitiesByChapter(chapterId) {
        return apiFetch(`${API_BASE}/agent_activities?chapterId=${chapterId}`);
    },

    async addActivity(activity) {
        return storage.addItem('agent_activities', {
            ...activity,
            createdAt: new Date().toISOString()
        });
    },

    async updateActivity(activity) {
        await storage.updateItem('agent_activities', {
            ...activity,
            updatedAt: new Date().toISOString()
        });
        return activity;
    },

    async clearActivitiesByChapter(chapterId) {
        const activities = await this.getActivitiesByChapter(chapterId);
        for (const act of activities) {
            await storage.deleteItem('agent_activities', act.id);
        }
    }
};

export const storageEx = {
    async getVolumes(projectId) {
        const volumes = await storage.getItemsByProject('volumes', projectId);
        // Parse JSON fields that may be stored as strings
        return volumes.map(v => {
            // Parse keyEvents
            if (v.keyEvents && typeof v.keyEvents === 'string') {
                try { v.keyEvents = JSON.parse(v.keyEvents); } catch { v.keyEvents = []; }
            }
            return v;
        });
    },

    async getItems(storeName, query = {}) {
        let url = `${API_BASE}/${storeName}`;
        const params = new URLSearchParams();
        if (query.projectId) params.set('projectId', query.projectId);
        if (query.volumeId) params.set('volumeId', query.volumeId);
        if (query.characterId) params.set('characterId', query.characterId);
        if (query.chapterNodeId) params.set('chapterNodeId', query.chapterNodeId);
        if (query.source) params.set('source', query.source);
        const qs = params.toString();
        if (qs) url += '?' + qs;
        const items = await apiFetch(url);
        // Parse JSON fields based on store name
        return items.map(item => parseJsonFields(storeName, item));
    },

    async getCoreOutline(projectId) {
        const raw = await storage.getItem(`core_outline_${projectId}`);
        if (!raw) return null;
        // storage.getItem returns the value which may be a stringified JSON
        try {
            // The value is stored as JSON.stringify({ content, updatedAt })
            // So we need to parse it to get the actual object
            return typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
            console.error('Failed to parse core outline:', e);
            // Return as-is if parsing fails (legacy format)
            return { content: raw };
        }
    },

    async saveCoreOutline(projectId, content) {
        const data = { content, updatedAt: new Date().toISOString() };
        await storage.setItem(`core_outline_${projectId}`, JSON.stringify(data));
    },

    async updateCoreOutline(projectId, data) {
        const existingRaw = await storage.getItem(`core_outline_${projectId}`);
        let existing = {};
        if (existingRaw) {
            try {
                existing = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
            } catch (e) {
                console.error('Failed to parse existing core outline:', e);
                // If parsing fails, treat it as legacy format
                existing = { content: existingRaw };
            }
        }
        const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
        await storage.setItem(`core_outline_${projectId}`, JSON.stringify(updated));
    },

    async deleteCoreOutline(projectId) {
        await storage.deleteSetting(`core_outline_${projectId}`);
    },

    async getChapterNodesByVolume(volumeId) {
        return apiFetch(`${API_BASE}/chapter_nodes?volumeId=${volumeId}`);
    },

    async addVolume(projectId, volumeData) {
        return storage.addItem('volumes', { ...volumeData, projectId });
    },

    async addPlotEvent(projectId, chapterId, type, content) {
        const key = `plot_event_${projectId}_${Date.now()}`;
        await storage.setItem(key, JSON.stringify({
            projectId, chapterId, type, content, createdAt: new Date().toISOString()
        }));
    },

    async addChapterNode(projectId, volumeId, nodeData) {
        return storage.addItem('chapter_nodes', { ...nodeData, projectId, volumeId });
    },

    async addCompressedContext(projectId, source, content) {
        const key = `compressed_${projectId}_${source}_${Date.now()}`;
        await storage.setItem(key, JSON.stringify({
            projectId, source, content, createdAt: new Date().toISOString()
        }));
    },

    async addPlotState(projectId, statePayload) {
        const key = `plot_state_${projectId}_${Date.now()}`;
        await storage.setItem(key, JSON.stringify({
            projectId, ...statePayload, createdAt: new Date().toISOString()
        }));
    },


};
