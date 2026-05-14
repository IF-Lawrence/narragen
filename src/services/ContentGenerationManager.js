/**
 * Content Generation Manager
 * 后台正文生成任务管理器 - 独立于 React 组件生命周期
 */

import { AgentCoordinator } from './AgentCoordinator';
import { storage } from './storage';
import { storageEx } from './storage';

// 正在运行的正文生成任务 Map<string, Promise>
const runningContentTasks = new Map();

// 任务状态缓存 (用于组件重新挂载时恢复)
const taskStatusCache = new Map();

/**
 * 获取任务的唯一 Key
 */
function getTaskKey(projectId, chapterNumber) {
    return `${projectId}_chapter_${chapterNumber}`;
}

/**
 * 广播任务状态事件
 */
function dispatchStatus(projectId, chapterNumber, status, data = {}) {
    window.dispatchEvent(new CustomEvent('narragen-content-gen-status', {
        detail: { projectId, chapterNumber, status, ...data }
    }));

    // 同时更新缓存
    const key = getTaskKey(projectId, chapterNumber);
    taskStatusCache.set(key, { status, ...data, timestamp: Date.now() });
}

/**
 * 检查某个章节是否正在生成
 */
export function isContentGenerating(projectId, chapterNumber) {
    const key = getTaskKey(projectId, chapterNumber);
    return runningContentTasks.has(key);
}

/**
 * 获取任务状态 (用于组件重新挂载时恢复)
 */
export function getContentGenerationStatus(projectId, chapterNumber) {
    const key = getTaskKey(projectId, chapterNumber);
    return taskStatusCache.get(key) || null;
}

/**
 * 启动后台正文生成任务
 * @param {string} projectId - 项目 ID
 * @param {number} chapterNumber - 章节号
 * @param {Object} options - 生成选项 (scenes, length, passionLevel, mode, currentText, etc.)
 * @returns {boolean} - 是否成功启动 (如果已在运行则返回 false)
 */
export function startBackgroundContentGeneration(projectId, chapterNumber, options = {}) {
    const key = getTaskKey(projectId, chapterNumber);

    if (runningContentTasks.has(key)) {
        console.log(`[ContentGenManager] Task for chapter ${chapterNumber} is already running`);
        return false;
    }

    console.log(`[ContentGenManager] Starting background generation for chapter ${chapterNumber}`);

    // 广播开始事件
    dispatchStatus(projectId, chapterNumber, 'start');

    // 创建 AbortController 用于取消
    const abortController = new AbortController();

    // 启动异步任务
    const task = (async () => {
        const coordinator = new AgentCoordinator();
        let finalContent = '';
        let scenes = options.scenes || null;

        try {
            const stream = coordinator.executeChapterFlowStream(projectId, chapterNumber, {
                ...options,
                signal: abortController.signal
            });

            for await (const event of stream) {
                // 检查是否被取消
                if (abortController.signal.aborted) {
                    throw new Error('aborted');
                }

                // 根据事件类型广播状态
                if (event.type === 'stage') {
                    dispatchStatus(projectId, chapterNumber, 'progress', {
                        stage: event.stage,
                        data: event.data
                    });
                } else if (event.type === 'chunk') {
                    // 流式内容更新
                    finalContent = event.fullContent;
                    dispatchStatus(projectId, chapterNumber, 'streaming', {
                        stage: event.stage,
                        content: event.fullContent
                    });
                } else if (event.type === 'decisions') {
                    // 场景决策选项 (如果需要用户选择)
                    dispatchStatus(projectId, chapterNumber, 'decisions', {
                        options: event.options
                    });
                } else if (event.type === 'critic') {
                    dispatchStatus(projectId, chapterNumber, 'critic', {
                        data: event.data
                    });
                } else if (event.type === 'complete') {
                    // 生成完成
                    break;
                }
            }

            // ===== 关键：直接保存到数据库 =====
            if (finalContent) {
                const nodes = await storageEx.getItems('chapter_nodes', { projectId });
                const targetNode = nodes.find(n => n.order === chapterNumber);

                if (targetNode) {
                    await storage.updateItem('chapter_nodes', {
                        ...targetNode,
                        content: finalContent,
                        updatedAt: new Date().toISOString()
                    });
                    console.log(`[ContentGenManager] Saved chapter ${chapterNumber} content (${finalContent.length} chars)`);
                }
            }

            // 广播完成事件
            dispatchStatus(projectId, chapterNumber, 'success', {
                content: finalContent,
                wordCount: finalContent.length
            });

        } catch (error) {
            if (error.message === 'aborted') {
                console.log(`[ContentGenManager] Task for chapter ${chapterNumber} was cancelled`);
                dispatchStatus(projectId, chapterNumber, 'cancelled');
            } else {
                console.error(`[ContentGenManager] Task for chapter ${chapterNumber} failed:`, error);
                dispatchStatus(projectId, chapterNumber, 'error', {
                    error: error.message
                });
            }
        } finally {
            // 清理任务
            runningContentTasks.delete(key);
        }
    })();

    // 存储任务引用和 AbortController
    runningContentTasks.set(key, { task, abortController });

    return true;
}

/**
 * 取消正在运行的生成任务
 */
export function cancelContentGeneration(projectId, chapterNumber) {
    const key = getTaskKey(projectId, chapterNumber);
    const taskInfo = runningContentTasks.get(key);

    if (taskInfo) {
        taskInfo.abortController.abort();
        runningContentTasks.delete(key);
        console.log(`[ContentGenManager] Cancelled task for chapter ${chapterNumber}`);
        return true;
    }

    return false;
}

/**
 * 获取所有正在运行的任务
 */
export function getRunningContentTasks() {
    return Array.from(runningContentTasks.keys()).map(key => {
        const [projectId, , chapterStr] = key.split('_');
        return { projectId, chapterNumber: parseInt(chapterStr, 10) };
    });
}

/**
 * 清除过期的状态缓存 (超过 1 小时的)
 */
export function clearStaleStatusCache() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    for (const [key, value] of taskStatusCache.entries()) {
        if (now - value.timestamp > oneHour) {
            taskStatusCache.delete(key);
        }
    }
}
