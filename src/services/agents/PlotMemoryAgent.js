import { BaseAgent } from './BaseAgent';
import { storageEx, storage } from '../storage';
import { openai } from '../openai';
import { PromptLogger } from '../PromptLogger';

/**
 * PlotMemoryAgent - Manages plot memory for long-form novels
 * Extracts and categorizes critical plot information to maintain continuity
 */
export class PlotMemoryAgent extends BaseAgent {
    constructor() {
        super('PlotMemory', 0.3);
    }

    /**
     * Build comprehensive memory context for a chapter
     * @param {string} projectId - Project ID
     * @param {number} currentChapter - Current chapter number
     * @returns {Promise<Object>} Memory context object
     */
    async buildMemoryContext(projectId, currentChapter) {
        try {
            // Fetch all chapters for this project
            const allChapters = await storageEx.getItems('chapter_nodes', { projectId });

            // Filter to only previous chapters
            const previousChapters = allChapters
                .filter(chapter => chapter.order < currentChapter)
                .sort((a, b) => a.order - b.order); // Chronological order

            if (previousChapters.length === 0) {
                // No previous chapters, return empty context
                return {
                    globalClues: [],
                    openConflicts: [],
                    relationshipTimeline: '',
                    foreshadowing: [],
                    recentChapters: []
                };
            }

            // Extract different types of memory in parallel for efficiency
            const [
                globalClues,
                openConflicts,
                relationshipTimeline,
                foreshadowing,
                recentChapters
            ] = await Promise.all([
                this.extractGlobalClues(previousChapters),
                this.extractOpenConflicts(previousChapters),
                this.buildRelationshipTimeline(previousChapters),
                this.extractForeshadowing(previousChapters),
                this.getRecentSummaries(previousChapters, currentChapter, 5)
            ]);

            return {
                globalClues,
                openConflicts,
                relationshipTimeline,
                foreshadowing,
                recentChapters
            };
        } catch (error) {
            console.error('Error building memory context:', error);
            return {
                globalClues: [],
                openConflicts: [],
                relationshipTimeline: '',
                foreshadowing: [],
                recentChapters: []
            };
        }
    }

    /**
     * Extract global clues and mysteries from all chapters
     * @param {Array} allChapters - All previous chapter nodes
     * @param {Object} context - Optional context for logging
     * @returns {Promise<Array<string>>} Array of global clue descriptions
     */
    async extractGlobalClues(allChapters, context = {}) {
        if (allChapters.length === 0) return [];

        try {
            // Prepare chapter summaries for AI analysis
            const chapterSummaries = allChapters.map(chapter => {
                try {
                    const parsed = JSON.parse(chapter.summary);
                    return `第${chapter.order}章: ${parsed.oneSentence || parsed.chapterTitle || chapter.title || ''}`;
                } catch {
                    return `第${chapter.order}章: ${chapter.title || ''}`;
                }
            }).join('\n');

            const systemPrompt = '你是剧情分析专家，负责识别小说中的全局线索和未解之谜。';
            const userPrompt = `分析以下章节，提取仍然活跃的全局线索和未解之谜。只列出尚未完全解决的线索。

章节摘要：
${chapterSummaries}

请以JSON数组格式输出，每个元素是一个简短的线索描述（不超过50字）。
格式：["线索1", "线索2", ...]`;

            const result = await openai.generateText(userPrompt, systemPrompt, {
                temperature: this.temperature,
                feature: 'archivist'
            });

            // Log to Prompt Inspector
            if (context.projectId) {
                await PromptLogger.log({
                    projectId: context.projectId,
                    agent: 'PlotMemoryAgent (Global Clues)',
                    action: '提取全局线索',
                    modules: {
                        system: systemPrompt,
                        context: `分析 ${allChapters.length} 个章节`,
                        output_format: 'JSON Array'
                    },
                    fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
                    response: result,
                    model: (await openai.getFeatureConfig('archivist')).model || 'unknown',
                    taskId: context.taskId,
                    taskName: context.taskName,
                    chapterNumber: context.chapterNumber
                });
            }

            // Parse AI response - handle various markdown formats
            let cleanResult = result
                .replace(/```json\n?|```\n?|```/g, '')  // Remove code blocks
                .replace(/^>\s*.*$/gm, '')              // Remove blockquotes
                .replace(/\*\*.*?\*\*/g, '')            // Remove bold markdown
                .trim();

            // Try to extract JSON array from the result
            const arrayMatch = cleanResult.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                const parsed = JSON.parse(arrayMatch[0]);
                return Array.isArray(parsed) ? parsed : [];
            }
            return [];
        } catch (error) {
            console.error('Error extracting global clues:', error);
            return [];
        }
    }

    /**
     * Extract unresolved conflicts and suspense
     * @param {Array} allChapters - All previous chapter nodes
     * @param {Object} context - Optional context for logging
     * @returns {Promise<Array<string>>} Array of open conflict descriptions
     */
    async extractOpenConflicts(allChapters, context = {}) {
        if (allChapters.length === 0) return [];

        try {
            // Get recent chapters for conflict analysis (last 10 or all if less)
            const recentChapters = allChapters.slice(-10);

            const chapterSummaries = recentChapters.map(chapter => {
                try {
                    const parsed = JSON.parse(chapter.summary);
                    // Include scene conflicts if available
                    if (parsed.scenes && Array.isArray(parsed.scenes)) {
                        const conflicts = parsed.scenes
                            .map(s => s.conflict)
                            .filter(c => c)
                            .join('; ');
                        return `第${chapter.order}章: ${conflicts || parsed.oneSentence || ''}`;
                    }
                    return `第${chapter.order}章: ${parsed.oneSentence || parsed.chapterTitle || ''}`;
                } catch {
                    return `第${chapter.order}章: ${chapter.title || ''}`;
                }
            }).join('\n');

            const systemPrompt = '你是剧情分析专家，负责识别小说中未解决的冲突和悬念。';
            const userPrompt = `分析以下章节，提取仍然未解决的冲突和悬念。只列出尚未得到解决的冲突。

章节摘要：
${chapterSummaries}

请以JSON数组格式输出，每个元素是一个简短的冲突描述（不超过50字）。
格式：["冲突1", "冲突2", ...]`;

            const result = await openai.generateText(userPrompt, systemPrompt, {
                temperature: this.temperature,
                feature: 'archivist'
            });

            // Log to Prompt Inspector
            if (context.projectId) {
                await PromptLogger.log({
                    projectId: context.projectId,
                    agent: 'PlotMemoryAgent (Conflicts)',
                    action: '提取未解决冲突',
                    modules: {
                        system: systemPrompt,
                        context: `分析最近 ${recentChapters.length} 个章节`,
                        output_format: 'JSON Array'
                    },
                    fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
                    response: result,
                    model: (await openai.getFeatureConfig('archivist')).model || 'unknown',
                    taskId: context.taskId,
                    taskName: context.taskName,
                    chapterNumber: context.chapterNumber
                });
            }

            // Parse AI response - handle various markdown formats
            let cleanResult = result
                .replace(/```json\n?|```\n?|```/g, '')
                .replace(/^>\s*.*$/gm, '')
                .replace(/\*\*.*?\*\*/g, '')
                .trim();

            const arrayMatch = cleanResult.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                const parsed = JSON.parse(arrayMatch[0]);
                return Array.isArray(parsed) ? parsed : [];
            }
            return [];
        } catch (error) {
            console.error('Error extracting open conflicts:', error);
            return [];
        }
    }

    /**
     * Build character relationship evolution timeline
     * @param {Array} allChapters - All previous chapter nodes
     * @param {Object} context - Optional context for logging
     * @returns {Promise<string>} Formatted relationship timeline text
     */
    async buildRelationshipTimeline(allChapters, context = {}) {
        if (allChapters.length === 0) return '';

        try {
            // Sample chapters for relationship analysis (every 3rd chapter or all if < 10)
            const sampledChapters = allChapters.length <= 10
                ? allChapters
                : allChapters.filter((_, idx) => idx % 3 === 0 || idx === allChapters.length - 1);

            const chapterSummaries = sampledChapters.map(chapter => {
                try {
                    const parsed = JSON.parse(chapter.summary);
                    // Include character information if available
                    if (parsed.scenes && Array.isArray(parsed.scenes)) {
                        const characters = [...new Set(parsed.scenes.flatMap(s => s.characters || []))];
                        return `第${chapter.order}章 (角色: ${characters.join(', ')}): ${parsed.oneSentence || ''}`;
                    }
                    return `第${chapter.order}章: ${parsed.oneSentence || parsed.chapterTitle || ''}`;
                } catch {
                    return `第${chapter.order}章: ${chapter.title || ''}`;
                }
            }).join('\n');

            const systemPrompt = '你是角色关系分析专家，负责追踪小说中角色关系的演变。';
            const userPrompt = `分析以下章节，总结主要角色之间关系的演变过程。重点关注关系的变化和转折点。

章节摘要：
${chapterSummaries}

请用简洁的文字描述关系演变（200字以内），格式如：
"角色A与角色B：从...到...（第X章）；角色C与角色D：..."`;

            const result = await openai.generateText(userPrompt, systemPrompt, {
                temperature: this.temperature,
                feature: 'archivist'
            });

            // Log to Prompt Inspector
            if (context.projectId) {
                await PromptLogger.log({
                    projectId: context.projectId,
                    agent: 'PlotMemoryAgent (Relationships)',
                    action: '分析角色关系演变',
                    modules: {
                        system: systemPrompt,
                        context: `采样 ${sampledChapters.length} 个章节`,
                        output_format: 'Text'
                    },
                    fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
                    response: result,
                    model: (await openai.getFeatureConfig('archivist')).model || 'unknown',
                    taskId: context.taskId,
                    taskName: context.taskName,
                    chapterNumber: context.chapterNumber
                });
            }

            return result.trim();
        } catch (error) {
            console.error('Error building relationship timeline:', error);
            return '';
        }
    }

    /**
     * Extract important foreshadowing elements
     * @param {Array} allChapters - All previous chapter nodes
     * @param {Object} context - Optional context for logging
     * @returns {Promise<Array<string>>} Array of foreshadowing descriptions
     */
    async extractForeshadowing(allChapters, context = {}) {
        if (allChapters.length === 0) return [];

        try {
            // Focus on earlier chapters for foreshadowing (first half)
            const earlyChapters = allChapters.slice(0, Math.ceil(allChapters.length / 2));

            const chapterSummaries = earlyChapters.map(chapter => {
                try {
                    const parsed = JSON.parse(chapter.summary);
                    return `第${chapter.order}章: ${parsed.oneSentence || parsed.chapterTitle || chapter.title || ''}`;
                } catch {
                    return `第${chapter.order}章: ${chapter.title || ''}`;
                }
            }).join('\n');

            const systemPrompt = '你是剧情分析专家，负责识别小说中的伏笔和铺垫。';
            const userPrompt = `分析以下章节，提取重要的伏笔和铺垫。只列出可能在后续章节中发挥作用的伏笔。

章节摘要：
${chapterSummaries}

请以JSON数组格式输出，每个元素是一个简短的伏笔描述（不超过50字）。
格式：["伏笔1", "伏笔2", ...]`;

            const result = await openai.generateText(userPrompt, systemPrompt, {
                temperature: this.temperature,
                feature: 'archivist'
            });

            // Log to Prompt Inspector
            if (context.projectId) {
                await PromptLogger.log({
                    projectId: context.projectId,
                    agent: 'PlotMemoryAgent (Foreshadowing)',
                    action: '提取伏笔',
                    modules: {
                        system: systemPrompt,
                        context: `分析前 ${earlyChapters.length} 个章节`,
                        output_format: 'JSON Array'
                    },
                    fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
                    response: result,
                    model: (await openai.getFeatureConfig('archivist')).model || 'unknown',
                    taskId: context.taskId,
                    taskName: context.taskName,
                    chapterNumber: context.chapterNumber
                });
            }

            // Parse AI response - handle various markdown formats
            let cleanResult = result
                .replace(/```json\n?|```\n?|```/g, '')
                .replace(/^>\s*.*$/gm, '')
                .replace(/\*\*.*?\*\*/g, '')
                .trim();

            const arrayMatch = cleanResult.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                const parsed = JSON.parse(arrayMatch[0]);
                return Array.isArray(parsed) ? parsed : [];
            }
            return [];
        } catch (error) {
            console.error('Error extracting foreshadowing:', error);
            return [];
        }
    }

    /**
     * Get detailed summaries of recent chapters
     * @param {Array} allChapters - All previous chapter nodes
     * @param {number} currentChapter - Current chapter number
     * @param {number} count - Number of recent chapters to retrieve
     * @returns {Array<Object>} Array of recent chapter summaries
     */
    getRecentSummaries(allChapters, currentChapter, count = 5) {
        if (allChapters.length === 0) return [];

        try {
            // Get the most recent N chapters
            const recentChapters = allChapters
                .filter(chapter => chapter.order < currentChapter)
                .sort((a, b) => b.order - a.order)
                .slice(0, count)
                .reverse(); // Back to chronological order

            return recentChapters.map(chapter => {
                try {
                    const parsed = JSON.parse(chapter.summary);
                    return {
                        chapter: chapter.order,
                        title: parsed.chapterTitle || chapter.title || `第${chapter.order}章`,
                        summary: parsed.oneSentence || '',
                        scenes: parsed.scenes || []
                    };
                } catch {
                    return {
                        chapter: chapter.order,
                        title: chapter.title || `第${chapter.order}章`,
                        summary: chapter.summary || '',
                        scenes: []
                    };
                }
            });
        } catch (error) {
            console.error('Error getting recent summaries:', error);
            return [];
        }
    }
}
