import { BaseAgent } from './BaseAgent';
import { storageEx, storage } from '../storage';
import { openai } from '../openai';
import { PromptLogger } from '../PromptLogger';

export class ArchivistAgent extends BaseAgent {
  constructor() {
    super('Archivist', 0.1);
  }

  async generatePrompt(context) {
    const summary = context.summary || '';
    return `将以下内容摘要为可检索记忆，压缩上下文并标注来源：\n${summary}`;
  }

  async execute(context) {
    const chapterNodeId = context.chapterNodeId;
    const pre = await this.extractPreInfo({ projectId: context.projectId, chapterNodeId });
    const compressed = await this.compressContext({ projectId: context.projectId, source: context.source || 'chapter', content: pre.aggregate });
    await this.archiveAndUpdate({ projectId: context.projectId, chapterNodeId, compressed, pre });

    // Update character states based on the new content and their arcs
    if (context.chapterNodeId) {
      await this.updateCharacterStates({
        projectId: context.projectId,
        chapterNodeId: context.chapterNodeId,
        summary: compressed,
        characters: pre.characters
      });
    }

    return compressed;
  }

  async extractPreInfo({ projectId, chapterNodeId }) {
    // 1. Current chapter node
    const node = chapterNodeId ? await storageEx.getItem('chapter_nodes', chapterNodeId) : null;

    // 2. Core outline
    const coreOutlineRow = await storageEx.getCoreOutline(projectId);
    let coreOutline = null;
    if (coreOutlineRow?.content) {
      try {
        let text = coreOutlineRow.content;
        if (text.includes('```json')) {
          text = text.replace(/```json\n?|\n?```/g, '');
        } else if (text.includes('```')) {
          text = text.replace(/```\n?|\n?```/g, '');
        }
        coreOutline = JSON.parse(text);
      } catch {
        coreOutline = null;
      }
    }

    // 3. Characters
    const characters = await storage.getItemsByProject('characters', projectId);

    // 4. Constraints
    const constraintsRows = await storageEx.getItems('constraints', { projectId });
    const constraints = constraintsRows.map(c => c.content);

    // 5. Current volume
    let currentVolume = null;
    if (node?.volumeId) {
      currentVolume = await storage.getItem('volumes', node.volumeId);
    }

    // 6. History chapters (only one-sentence summaries)
    const allChapters = await storageEx.getItems('chapter_nodes', { projectId });
    const history = allChapters
      .filter(c => c.order < (node?.order || 999))
      .sort((a, b) => b.order - a.order)
      .slice(0, 5)
      .map(c => {
        try {
          const parsed = JSON.parse(c.summary);
          return `第${c.order}章: ${parsed.oneSentence || parsed.chapterTitle || c.title || ''}`;
        } catch {
          return `第${c.order}章: ${c.title || ''}`;
        }
      });

    // 7. Aggregate context in structured format
    const sections = [];

    // Core settings
    if (coreOutline) {
      const coreSettings = [];
      if (coreOutline.tone) coreSettings.push(`文风: ${coreOutline.tone}`);
      // 兼容新旧 worldSetting 结构
      const ws = coreOutline.worldSetting || {};
      const worldDesc = ws.description || [ws.timePeriod, ws.location, ws.socialStructure].filter(Boolean).join('，');
      if (worldDesc) coreSettings.push(`世界观: ${worldDesc}`);
      if (coreOutline.coreConflict) coreSettings.push(`核心冲突: ${coreOutline.coreConflict}`);
      if (coreSettings.length > 0) {
        sections.push(`【核心设定】\n${coreSettings.join('\n')}`);
      }
    }

    // Current volume
    if (currentVolume) {
      sections.push(`【当前分卷】\n第${currentVolume.order}卷：${currentVolume.name}\n${currentVolume.description || ''}`);
    }

    // Characters
    if (characters.length > 0) {
      const charInfo = characters.map(c =>
        `${c.name}（${c.role || '角色'}）: ${c.traits || c.bio || ''}`
      ).join('\n');
      sections.push(`【角色信息】\n${charInfo}`);
    }

    // Constraints
    if (constraints.length > 0) {
      sections.push(`【创作约束】\n${constraints.join('\n')}`);
    }

    // Current chapter scenes (full detail)
    if (node?.summary) {
      try {
        const parsed = JSON.parse(node.summary);
        if (parsed.scenes && Array.isArray(parsed.scenes)) {
          const scenesText = parsed.scenes.map((s, idx) =>
            `场景${idx + 1}：${s.location || ''}\n动作：${s.action || ''}\n冲突：${s.conflict || ''}\n结果：${s.outcome || ''}`
          ).join('\n\n');
          sections.push(`【当前章节场景】\n${scenesText}`);
        }
      } catch {
        // If parsing fails, skip scenes
      }
    }

    // History
    if (history.length > 0) {
      sections.push(`【历史章节】\n${history.join('\n')}`);
    }

    const aggregate = sections.join('\n\n');

    return {
      node,
      coreOutline,
      characters,
      constraints,
      currentVolume,
      history,
      aggregate
    };
  }

  async compressContext({ projectId, source, content, context = {} }) {
    const systemPrompt = '你是信息提取器，提取事件、状态、对话、线索，输出JSON并附加元数据标签，限制长度。';
    const userPrompt = `文本：\n${content}\n输出一个JSON对象，包含events、states、dialogues、clues、tags、summary，中文。`;
    const result = await openai.generateText(userPrompt, systemPrompt, { temperature: 0.2, feature: 'archivist', projectId: context.projectId || projectId });

    // Log to Prompt Inspector
    if (context.projectId || projectId) {
      await PromptLogger.log({
        projectId: context.projectId || projectId,
        agent: 'ArchivistAgent (Compress)',
        action: '压缩上下文',
        modules: {
          system: systemPrompt,
          context: `来源: ${source}, 内容长度: ${content.length} 字`,
          output_format: 'JSON'
        },
        fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
        response: result,
        model: (await openai.getFeatureConfig('archivist', context.projectId || projectId)).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName,
        chapterNumber: context.chapterNumber
      });
    }

    await storageEx.addCompressedContext(projectId, source, result);
    return result;
  }

  async archiveAndUpdate({ projectId, chapterNodeId, compressed, pre }) {
    let parsed;
    try {
      parsed = JSON.parse(compressed);
    } catch {
      parsed = { summary: compressed, events: [], states: [], dialogues: [], clues: [], tags: [] };
    }

    const statePayload = { events: parsed.events, states: parsed.states, clues: parsed.clues, tags: parsed.tags };
    await storageEx.addPlotState(projectId, statePayload);

    if (chapterNodeId && parsed.summary) {
      const node = await storageEx.getItem('chapter_nodes', chapterNodeId);
      const promptTemplate = await PromptManager.getPrompt('archivist', 'precalc', projectId);
      if (node) {
        await storage.updateItem('chapter_nodes', { ...node, summary: parsed.summary, updatedAt: new Date().toISOString() });
      }
    }
  }

  /**
   * Get key events from previous chapters for WriterAgent context
   * @param {Object} params
   * @param {string} params.projectId - Project ID
   * @param {number} params.currentChapter - Current chapter number
   * @param {number} params.count - Number of previous chapters to retrieve (default: 3)
   * @returns {Promise<Array<string>>} Array of key event summaries
   */
  async getPreviousKeyEvents({ projectId, currentChapter, count = 3 }) {
    try {
      // Get all chapter nodes for this project
      const allNodes = await storageEx.getItems('chapter_nodes', { projectId });

      // Filter to previous chapters and sort by order
      const previousChapters = allNodes
        .filter(node => node.order < currentChapter)
        .sort((a, b) => b.order - a.order) // Most recent first
        .slice(0, count);

      // Extract summaries
      const events = [];
      for (const chapter of previousChapters.reverse()) { // Chronological order
        if (chapter.summary) {
          events.push(`第${chapter.order}章: ${chapter.summary}`);
        }
      }

      return events;
    } catch (error) {
      console.error('Error getting previous key events:', error);
      return [];
    }
  }

  /**
   * Extract causality information from a chapter
   * @param {string} chapterContent - The full chapter content
   * @param {string} chapterSummary - The chapter summary/outline
   * @param {Object} context - Optional context for logging (projectId, taskId, taskName, chapterNumber)
   * @returns {Promise<Object>} Causality data
   */
  async extractCausality(chapterContent, chapterSummary = '', context = {}) {
    try {
      // Truncate content if too long (keep first 3000 chars for analysis)
      const truncatedContent = chapterContent.length > 3000
        ? chapterContent.substring(0, 3000) + '...'
        : chapterContent;

      const systemPrompt = '你是剧情分析专家，负责提取章节的因果关系。只返回JSON，不要其他文字。';

      const userPrompt = `分析以下章节内容，提取因果关系信息。

${chapterSummary ? `章节摘要：\n${chapterSummary}\n\n` : ''}章节内容：
${truncatedContent}

请以JSON格式返回：
{
  "chapterGoal": "本章的主要目标（主角想要达成什么）",
  "chapterOutcome": "本章的结果（实际发生了什么，目标是否达成）",
  "openQuestions": ["本章留下的未解决问题1", "未解决问题2"],
  "resolvedQuestions": ["本章解决的问题1", "解决的问题2"]
}

要求：
1. chapterGoal 应该简洁明确（不超过50字）
2. chapterOutcome 应该总结关键结果（不超过100字）
3. openQuestions 应该列出所有未解决的悬念和问题（每个不超过30字）
4. resolvedQuestions 应该列出本章解决的前文问题（每个不超过30字）
5. 如果某个字段不适用，返回空字符串或空数组`;

      const result = await openai.generateText(userPrompt, systemPrompt, {
        temperature: this.temperature,
        feature: 'archivist',
        response_format: { type: 'json_object' },
        projectId: context.projectId
      });

      // Log to Prompt Inspector
      if (context.projectId) {
        await PromptLogger.log({
          projectId: context.projectId,
          agent: 'ArchivistAgent (Causality)',
          action: '提取因果关系',
          modules: {
            system: systemPrompt,
            context: `章节内容长度: ${chapterContent.length} 字`,
            output_format: 'JSON'
          },
          fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
          response: result,
          model: (await openai.getFeatureConfig('archivist', context.projectId)).model || 'unknown',
          taskId: context.taskId,
          taskName: context.taskName,
          chapterNumber: context.chapterNumber
        });
      }

      // Parse the result
      let causality;
      try {
        causality = JSON.parse(result.replace(/```json\n?|```\n?/g, ''));
      } catch (parseError) {
        console.error('Failed to parse causality JSON:', parseError);
        // Return default structure
        causality = {
          chapterGoal: '',
          chapterOutcome: '',
          openQuestions: [],
          resolvedQuestions: []
        };
      }

      // Validate and sanitize
      return {
        chapterGoal: causality.chapterGoal || '',
        chapterOutcome: causality.chapterOutcome || '',
        openQuestions: Array.isArray(causality.openQuestions) ? causality.openQuestions : [],
        resolvedQuestions: Array.isArray(causality.resolvedQuestions) ? causality.resolvedQuestions : []
      };

    } catch (error) {
      console.error('Error extracting causality:', error);
      // Return empty causality data on error
      return {
        chapterGoal: '',
        chapterOutcome: '',
        openQuestions: [],
        resolvedQuestions: []
      };
    }
  }

  /**
   * Build causality context for a chapter
   * @param {Object} previousChapter - Previous chapter node
   * @param {Object} currentChapterPlan - Current chapter plan/summary
   * @param {Object} nextChapter - Next chapter node (optional)
   * @returns {string} Formatted causality context for prompt
   */
  buildCausalityContext(previousChapter, currentChapterPlan, nextChapter = null) {
    let context = '';

    // Previous chapter's unresolved questions
    if (previousChapter && previousChapter.openQuestions && previousChapter.openQuestions.length > 0) {
      context += `### 上一章遗留问题\n`;
      previousChapter.openQuestions.forEach((question, idx) => {
        context += `${idx + 1}. ${question}\n`;
      });
      context += '\n';
    }

    // Current chapter goal
    if (currentChapterPlan) {
      let goal = '';

      // Try to extract goal from plan
      if (typeof currentChapterPlan === 'object') {
        if (currentChapterPlan.chapterGoal) {
          goal = currentChapterPlan.chapterGoal;
        } else if (currentChapterPlan.summary) {
          goal = currentChapterPlan.summary;
        } else if (currentChapterPlan.oneSentence) {
          goal = currentChapterPlan.oneSentence;
        }
      } else if (typeof currentChapterPlan === 'string') {
        goal = currentChapterPlan;
      }

      if (goal) {
        context += `### 本章目标\n${goal}\n\n`;
      }
    }

    // Next chapter hint
    if (nextChapter) {
      let hint = '';

      // Try to extract summary from next chapter
      if (nextChapter.summary) {
        try {
          const parsed = JSON.parse(nextChapter.summary);
          hint = parsed.oneSentence || parsed.chapterTitle || nextChapter.title || '';
        } catch {
          hint = nextChapter.summary;
        }
      } else if (nextChapter.title) {
        hint = nextChapter.title;
      }

      if (hint) {
        context += `### 下一章预告\n${hint}\n\n`;
      }
    }

    return context;
  }

  async updateCharacterStates({ projectId, chapterNodeId, summary, characters }) {
    if (!characters || characters.length === 0) return;

    // Get chapter info for context
    const chapterNode = await storageEx.getItem('chapter_nodes', chapterNodeId);
    const chapterNum = chapterNode?.order || '?';

    // Filter characters likely to be in this chapter (mentioned in summary or main characters)
    // For now, we process all active characters to be safe, or we could ask LLM to identify relevant ones first.
    // Let's process valid characters with names.
    const validChars = characters.filter(c => c.name);

    const systemPrompt = '你是角色状态追踪器。根据章节摘要和角色“成长弧光”，更新角色的“当前状态”。';
    const userPrompt = `基于第${chapterNum}章的摘要，分析角色经历的变化。
    
    章节摘要：
    ${typeof summary === 'string' ? summary : JSON.stringify(summary)}

    角色列表：
    ${validChars.map(c => `- ${c.name} (弧光: ${c.arc || '无'}) (当前状态: ${c.currentState?.description || '初始状态'})`).join('\n')}

    任务：
    判断哪些角色的状态发生了改变。如果角色本章未出场或状态无明显变化，则忽略。
    对于有变化的角色，生成新的“当前状态”描述。
    
    要求：
    1. 结合“成长弧光”判断进度（例如：如果弧光是“复仇->释怀”，当前还在“复仇”阶段吗？）。
    2. 描述要具体（例如“因XXX事件感到迷茫”）。
    3. 只返回有变化的角色。

    输出 JSON 格式：
    {
      "updates": [
        {
          "name": "角色名",
          "newState": "新的当前状态描述",
          "emotionalState": "当前情感关键词"
        }
      ]
    }`;

    try {
      const result = await openai.generateText(userPrompt, systemPrompt, {
        temperature: 0.3,
        feature: 'archivist',
        response_format: { type: 'json_object' },
        projectId
      });

      let parsed = {};
      try {
        parsed = JSON.parse(result.replace(/```json\n?|```\n?/g, ''));
      } catch (e) {
        console.error('Failed to parse character state updates:', e);
        return;
      }

      if (parsed.updates && Array.isArray(parsed.updates)) {
        for (const update of parsed.updates) {
          const char = validChars.find(c => c.name === update.name);
          if (char) {
            // Update character storage
            const updatedChar = {
              ...char,
              currentState: {
                chapter: chapterNum,
                description: update.newState,
                emotional: update.emotionalState,
                updatedAt: new Date().toISOString()
              }
            };
            await storage.updateItem('characters', updatedChar);
            console.log(`[Archivist] Updated state for ${char.name}: ${update.newState}`);
          }
        }
      }
    } catch (error) {
      console.error('Error updating character states:', error);
    }
  }
}
