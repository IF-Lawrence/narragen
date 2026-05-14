import { BaseAgent } from './BaseAgent';
import { openai } from '../openai';
import { storage, storageEx } from '../storage';
import { PromptLogger } from '../PromptLogger';
import { PromptManager } from '../PromptManager';

export class CriticAgent extends BaseAgent {
  constructor() {
    super('Critic', 0.3);
  }

  async generatePrompt(context) {
    const text = context.text || '';
    const rules = context.rules || '';
    return `审阅以下文本，基于规则给出结构化问题清单与改进建议，最后给出通过/不通过判定：\n规则：${rules}\n文本：\n${text}`;
  }

  async execute(context) {
    const prompt = await this.generatePrompt(context);
    const systemPrompt = '你是严苛的评论家，负责质量评审与改进建议。';
    const result = await openai.generateText(prompt, systemPrompt, { temperature: this.temperature, feature: 'critic', projectId: context.projectId });

    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'CriticAgent',
        action: 'execute',
        modules: {
          system: systemPrompt,
          context: { rules: context.rules },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: result,
        model: (await openai.getFeatureConfig('critic', context.projectId)).model || 'unknown'
      });
    }

    return result;
  }

  async buildReviewContext(projectId) {
    const project = await storage.getProject(projectId);
    const constraints = await storage.getItemsByProject('constraints', projectId);
    const characters = await storage.getItemsByProject('characters', projectId);
    // Use chapter_nodes instead of legacy 'chapters' table
    const chapterNodes = await storageEx.getItems('chapter_nodes', { projectId });
    const summaries = chapterNodes
      .filter(node => node.summary)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(node => {
        let summaryText = node.summary;
        try {
          const parsed = JSON.parse(node.summary);
          summaryText = parsed.oneSentence || parsed.chapterTitle || node.summary;
        } catch { }
        return `第${node.order}章：${summaryText}`;
      })
      .join('\n');
    const constraintsText = constraints.map(c => `- ${c.content}`).join('\n');
    const characterContext = characters.map(c => {
      let info = `### ${c.name} (${c.role || '未知角色'})\n`;
      if (c.bio) info += `- 基本信息: ${c.bio}\n`;
      if (c.traits) info += `- 性格特征: ${c.traits}\n`;

      if (c.currentState && typeof c.currentState === 'object') {
        const state = c.currentState;
        if (state.description) info += `- 当前状态: ${state.description}\n`;
        if (state.emotional) info += `- 情感状态: ${state.emotional}\n`;
      } else if (c.currentState && typeof c.currentState === 'string') {
        info += `- 当前状态: ${c.currentState}\n`;
      }
      return info;
    }).join('\n');

    // Get Core Outline for World Setting
    let worldSetting = '';
    let tone = '';
    let theme = '';
    try {
      const coreOutlineRow = await storageEx.getCoreOutline(projectId);
      if (coreOutlineRow) {
        let outline = coreOutlineRow.content || coreOutlineRow;

        // If content is string, try to parse it
        if (typeof outline === 'string') {
          let content = outline;
          if (content.includes('```json')) content = content.replace(/```json\n?|```\n?|```/g, '');
          else if (content.includes('```')) content = content.replace(/```\n?|```/g, '');
          try {
            outline = JSON.parse(content);
          } catch (e) {
            console.warn('Failed to parse core outline JSON string:', e);
          }
        }

        if (typeof outline === 'object') {
          // Handle worldSetting which might be an object or string
          const ws = outline.worldSetting || outline.world_setting || outline.setting;
          if (ws) {
            if (typeof ws === 'object') {
              worldSetting = `${ws.description || ''}\n${ws.rules || ''}`.trim();
              if (!worldSetting) worldSetting = JSON.stringify(ws); // Fallback
            } else {
              worldSetting = String(ws);
            }
          }

          tone = outline.tone || outline.style || '';
          theme = outline.theme || outline.coreTheme || '';
        }
      }
    } catch (e) {
      console.warn('Failed to load core outline for critic:', e);
    }

    return {
      project,
      constraintsText,
      characterProfiles: characterContext,
      summaries,
      worldSetting,
      tone,
      theme
    };
  }

  async executeStructured(context) {
    const { text, projectId } = context;
    const reviewCtx = projectId ? await this.buildReviewContext(projectId) : {
      constraintsText: '',
      characterProfiles: '',
      summaries: '',
      worldSetting: '',
      tone: '',
      theme: ''
    };

    // Build world context
    let worldContext = '';
    if (reviewCtx.worldSetting) worldContext += `【世界观设定】\n${reviewCtx.worldSetting}\n\n`;
    if (reviewCtx.tone) worldContext += `【整体基调】\n${reviewCtx.tone}\n\n`;
    if (reviewCtx.theme) worldContext += `【核心主题】\n${reviewCtx.theme}\n\n`;

    // Get prompt template    // Get prompt template
    const promptTemplate = await PromptManager.getPrompt('critic', 'main', projectId);

    // Render template with variables
    const userPrompt = PromptManager.renderTemplate(promptTemplate.template, {
      text,
      worldContext,
      characterProfiles: reviewCtx.characterProfiles,
      constraintsText: reviewCtx.constraintsText,
      summaries: reviewCtx.summaries
    });

    const systemPrompt = promptTemplate.system;

    let textOut = '';
    try {
      textOut = await openai.generateText(userPrompt, systemPrompt, {
        response_format: { type: 'json_object' },
        temperature: 0.3,
        feature: 'critic',
        projectId
      });
    } catch (e) {
      console.error('Critic API call failed:', e);
      throw e;
    }

    // Log the interaction
    if (projectId) {
      try {
        const config = await openai.getFeatureConfig('critic', projectId);
        await PromptLogger.log({
          projectId,
          agent: 'CriticAgent',
          action: 'executeStructured',
          modules: {
            system: systemPrompt,
            context: {
              worldSetting: reviewCtx.worldSetting,
              tone: reviewCtx.tone,
              theme: reviewCtx.theme
            },
            instruction: userPrompt
          },
          fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
          response: textOut,
          model: config.model || 'unknown',
          taskId: context.taskId,
          taskName: context.taskName || 'Critic Review',
          chapterNumber: context.chapterNumber
        });
      } catch (err) {
        console.error('Failed to log prompt:', err);
      }
    }

    // Parse JSON response
    try {
      const clean = this.stripCodeFence(textOut);
      const parsed = JSON.parse(clean);
      return parsed;
    } catch (e) {
      return {
        characterConsistency: [],
        logicCoherence: [],
        quality: [],
        summary: {
          overallVerdict: 'fail',
          keyRisks: ['无法解析模型输出为JSON'],
          globalSuggestions: ['请重新执行质量检查']
        },
        raw: textOut
      };
    }
  }

  stripCodeFence(text) {
    let t = text || '';
    if (t.includes('```json')) t = t.replace(/```json\n?|\n?```/g, '');
    else if (t.includes('```')) t = t.replace(/```\n?|\n?```/g, '');
    return t;
  }
}
