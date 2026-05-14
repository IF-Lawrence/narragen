/**
 * Prompt Logger Service
 * 使用本地服务器 API 记录 Prompt 日志（替代 IndexedDB）
 */

const API_BASE = '/api/storage';
const IMAGES_API = '/api/images';

/**
 * 上传图像到服务器
 * @param {string} type - 图像类型（如 'prompt_logs'）
 * @param {string} filename - 文件名
 * @param {string} base64Data - Base64 图像数据
 * @returns {Promise<string>} 图像 URL
 */
async function uploadImage(type, filename, base64Data) {
    const response = await fetch(`${IMAGES_API}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, filename, data: base64Data })
    });
    if (!response.ok) {
        throw new Error('Failed to upload image');
    }
    const result = await response.json();
    return result.url;
}

export const PromptLogger = {
    /**
     * 开始日志（在调用 LLM 前调用）
     * 创建一个"正在生成"状态的日志条目
     */
    async startLog({ projectId, agent, action, modules, fullPrompt, model, taskId, taskName, chapterNumber }) {
        try {
            const id = crypto.randomUUID();
            const entry = {
                id,
                taskId: taskId || 'default',
                taskName: taskName || '',
                projectId,
                timestamp: Date.now(),
                agent,
                action,
                modules: typeof modules === 'object' ? JSON.stringify(modules) : modules,
                fullPrompt,
                response: '[GENERATING] 正在生成响应...',
                model,
                chapterNumber: chapterNumber ? Number(chapterNumber) : null,
                status: 'generating'
            };

            await fetch(`${API_BASE}/prompt_logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry)
            });

            return entry.id;
        } catch (error) {
            console.error('Failed to start log:', error);
            return null;
        }
    },

    /**
     * 完成日志（在 LLM 返回后调用）
     * 更新日志的响应内容和状态
     */
    async completeLog(logId, response, error = null) {
        if (!logId) return;

        try {
            let processedResponse = error ? `[ERROR] ${error}` : response;

            // 如果响应是图像 Base64，先上传到服务器
            if (!error && response && typeof response === 'string' && response.startsWith('data:image')) {
                try {
                    const imageUrl = await uploadImage('prompt_logs', `${logId}.png`, response);
                    processedResponse = imageUrl;
                } catch (uploadError) {
                    console.warn('Failed to upload image, storing URL reference:', uploadError);
                }
            }

            await fetch(`${API_BASE}/prompt_logs`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: logId,
                    response: processedResponse,
                    status: error ? 'error' : 'completed',
                    completedAt: Date.now()
                })
            });
        } catch (err) {
            console.error('Failed to complete log:', err);
        }
    },

    /**
     * 原有的一次性日志方法（保持兼容性）
     */
    async log({ projectId, agent, action, modules, fullPrompt, response, model, taskId, taskName, chapterNumber }) {
        try {
            const id = crypto.randomUUID();

            // 如果响应是图像 Base64，先上传到服务器
            let processedResponse = response;
            if (response && typeof response === 'string' && response.startsWith('data:image')) {
                try {
                    const imageUrl = await uploadImage('prompt_logs', `${id}.png`, response);
                    processedResponse = imageUrl;
                } catch (uploadError) {
                    console.warn('Failed to upload image, storing URL reference:', uploadError);
                    // 如果上传失败，仍然保留原始数据（降级）
                }
            }

            const entry = {
                id,
                taskId: taskId || 'default',
                taskName: taskName || '',
                projectId,
                timestamp: Date.now(),
                agent,
                action,
                modules: typeof modules === 'object' ? JSON.stringify(modules) : modules,
                fullPrompt,
                response: processedResponse,
                model,
                chapterNumber: chapterNumber ? Number(chapterNumber) : null,
                status: 'completed'
            };

            await fetch(`${API_BASE}/prompt_logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entry)
            });

            return entry.id;
        } catch (error) {
            console.error('Failed to log prompt:', error);
        }
    },

    async getLogs(projectId, limit = 200) {
        try {
            const response = await fetch(`${API_BASE}/prompt_logs?projectId=${projectId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch logs');
            }
            let logs = await response.json();

            // 解析 modules 字段
            logs = logs.map(log => {
                if (log.modules && typeof log.modules === 'string') {
                    try { log.modules = JSON.parse(log.modules); } catch { }
                }
                return log;
            });

            // 按时间戳降序排序（最新的在前）
            logs.sort((a, b) => b.timestamp - a.timestamp);

            // 返回限制数量
            return logs.slice(0, limit);
        } catch (error) {
            console.error('Failed to get prompt logs:', error);
            return [];
        }
    },

    async clearLogs(projectId) {
        try {
            const logs = await this.getLogs(projectId, 10000); // 获取所有日志
            for (const log of logs) {
                // 只删除日志记录，不删除图片文件
                // 图片文件的生命周期由项目/角色管理，日志只是引用
                await fetch(`${API_BASE}/prompt_logs/${log.id}`, { method: 'DELETE' });
            }
        } catch (error) {
            console.error('Failed to clear prompt logs:', error);
        }
    }
};
