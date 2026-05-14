import { BaseAgent } from './BaseAgent';
import { openai } from '../openai';
import { PromptLogger } from '../PromptLogger';
import { PromptManager } from '../PromptManager';
import { PlotMemoryAgent } from './PlotMemoryAgent';

export class WriterAgent extends BaseAgent {
  constructor() {
    super('Writer', 0.7);
  }

  async generatePrompt(context) {
    const plan = context.plan || '';
    const style = context.style || '现代中文叙事';
    const length = context.length || 2000;
    const characters = context.characters || [];
    const constraints = context.constraints || '';
    const previousChapterSummary = context.previousChapterSummary || '';
    const passionLevel = context.passionLevel || 1;
    const coreOutline = context.coreOutline;
    const chapterPosition = context.chapterPosition;
    const previousEvents = context.previousEvents || [];
    const plotMemory = context.plotMemory || null;
    const causalityContext = context.causalityContext || '';

    // Build Core Outline Context
    let outlineContext = '';
    if (coreOutline) {
      outlineContext = `## 故事核心\n`;
      if (coreOutline.theme) outlineContext += `- 主题: ${coreOutline.theme}\n`;
      if (coreOutline.coreConflict) outlineContext += `- 核心冲突: ${coreOutline.coreConflict}\n`;
      if (coreOutline.tone) outlineContext += `- 整体基调: ${coreOutline.tone}\n`;
      if (coreOutline.worldSetting) {
        const ws = coreOutline.worldSetting;
        if (typeof ws === 'object') {
          outlineContext += `- 世界观: ${ws.description || ''} ${ws.rules ? `(规则: ${ws.rules})` : ''}\n`;
        } else {
          outlineContext += `- 世界观: ${ws}\n`;
        }
      }
      outlineContext += '\n';
    }

    // Build Chapter Position Context
    let positionContext = '';
    if (chapterPosition) {
      const { current, total } = chapterPosition;
      const progress = (current / total * 100).toFixed(0);
      let positionHint = '';
      if (progress < 20) {
        positionHint = '故事开篇，注重世界观和角色引入';
      } else if (progress < 40) {
        positionHint = '故事发展期，推动矛盾和冲突';
      } else if (progress < 70) {
        positionHint = '故事中段，矛盾升级，剧情转折';
      } else if (progress < 90) {
        positionHint = '故事高潮，核心冲突爆发';
      } else {
        positionHint = '故事结局，解决冲突，收束线索';
      }
      positionContext = `## 章节位置\n第 ${current} 章 / 共 ${total} 章 (进度: ${progress}%)\n提示: ${positionHint}\n\n`;
    }

    // Build Previous Events Context
    let eventsContext = '';
    if (previousEvents && previousEvents.length > 0) {
      eventsContext = `## 前文关键事件\n`;
      previousEvents.forEach((event, idx) => {
        eventsContext += `${idx + 1}. ${event}\n`;
      });
      eventsContext += '\n';
    }

    // Build Character Context (with current states)
    let characterContext = '';
    if (characters.length > 0) {
      characterContext = '## 本章出场角色\n';
      characters.forEach(c => {
        characterContext += `### ${c.name} (${c.role})\n`;
        if (c.bio) characterContext += `- 基本信息: ${c.bio}\n`;
        if (c.traits) characterContext += `- 性格特征: ${c.traits}\n`;
        if (c.currentState && typeof c.currentState === 'object') {
          const state = c.currentState;
          if (state.description) {
            characterContext += `- 当前状态 (第${state.chapter || '?'}章): ${state.description}\n`;
          }
          if (state.emotional) {
            characterContext += `- 情感状态: ${state.emotional}\n`;
          }
        } else if (c.currentState && typeof c.currentState === 'string') {
          // Fallback for legacy string format
          characterContext += `- 当前状态: ${c.currentState}\n`;
        }
        characterContext += '\n';
      });
    }

    // Build Passion Guidance
    let passionGuidance = '';
    const defs = context.passionDefinitions || {};

    // Provide full scale context definition
    // Keys in storage are "1", "2", etc. (from Constraints.jsx)
    // Fallback definitions match the defaults in Constraints.jsx
    const passionScaleDefinition = `
【Passion Level 定义参考】:
- Level 1: ${defs['1'] || '清水/铺垫：注重情感交流，氛围渲染，无直接描写。'}
- Level 2: ${defs['2'] || '升温/暧昧：肢体接触增加，情感张力增强，有明显的暗示。'}
- Level 3: ${defs['3'] || '激烈/直白：高强度的情感爆发，大胆的动作描写。'}
- Level 4: ${defs['4'] || '极限/狂热：极致的张力与激情，突破常规的描写尺度。'}
- Level 5: ${defs['5'] || '禁忌/极致：完全释放的情感表达，无保留的描写尺度。'}
`;


    if (passionLevel >= 4) {
      passionGuidance = defs['5'] || defs['4'] || '极致的张力与激情，突破常规的描写尺度，完全释放的情感表达。';
    } else if (passionLevel >= 3) {
      passionGuidance = defs['3'] || '高强度的情感爆发，大胆的动作描写。';
    } else if (passionLevel >= 2) {
      passionGuidance = defs['2'] || '肢体接触增加，情感张力增强，有明显的暗示。';
    } else {
      passionGuidance = defs['1'] || '注重情感交流，氛围渲染，无直接描写。';
    }


    // Build Plot Memory Context
    let memoryContext = '';
    if (plotMemory) {
      // Unresolved conflicts
      if (plotMemory.openConflicts && plotMemory.openConflicts.length > 0) {
        memoryContext += `## 未解决的悬念\n`;
        plotMemory.openConflicts.forEach((conflict, idx) => {
          memoryContext += `${idx + 1}. ${conflict}\n`;
        });
        memoryContext += '\n';
      }

      // Important foreshadowing
      if (plotMemory.foreshadowing && plotMemory.foreshadowing.length > 0) {
        memoryContext += `## 重要伏笔\n`;
        plotMemory.foreshadowing.forEach((item, idx) => {
          memoryContext += `${idx + 1}. ${item}\n`;
        });
        memoryContext += '\n';
      }

      // Global clues
      if (plotMemory.globalClues && plotMemory.globalClues.length > 0) {
        memoryContext += `## 全局线索\n`;
        plotMemory.globalClues.forEach((clue, idx) => {
          memoryContext += `${idx + 1}. ${clue}\n`;
        });
        memoryContext += '\n';
      }

      // Character relationship evolution
      if (plotMemory.relationshipTimeline && plotMemory.relationshipTimeline.trim()) {
        memoryContext += `## 角色关系演变\n${plotMemory.relationshipTimeline}\n\n`;
      }

      // Recent chapters summary
      if (plotMemory.recentChapters && plotMemory.recentChapters.length > 0) {
        memoryContext += `## 最近章节回顾\n`;
        plotMemory.recentChapters.forEach(ch => {
          memoryContext += `第${ch.chapter}章 - ${ch.title}: ${ch.summary}\n`;
        });
        memoryContext += '\n';
      }
    }

    // Get prompt template from PromptManager
    const promptTemplate = await PromptManager.getPrompt('writer', 'main', context.projectId);

    // Mode Handling
    let modeContext = '';
    if (context.mode === 'continue') {
      modeContext = `## 续写模式
你正在续写本章内容。
当前已有内容:
"""
${context.currentText}
"""
请紧接上述内容继续写作，保持文风一致，逻辑连贯。不要重复已有内容。
`;
    }

    // Render template with variables
    return PromptManager.renderTemplate(promptTemplate.template, {
      style,
      outlineContext,
      positionContext,
      eventsContext,
      characterContext,
      memoryContext,
      causalityContext,
      constraints: constraints || '无特殊约束',
      previousChapterSummary: previousChapterSummary || '无',
      plan: Array.isArray(plan) ? `## 场景清单 (必须严格遵循)
${plan.map((s, i) => `
### 场景 ${i + 1}: ${s.location || '未知地点'}
- 出场角色: ${Array.isArray(s.characters) ? s.characters.join(', ') : (s.characters || '无')}
- 主要动作: ${s.action || '无'}
- 冲突: ${s.conflict || '无'}
- 结果: ${s.outcome || '无'}
**要求**: 必须完整呈现此场景,不得跳过或合并
`).join('\n')}` : (typeof plan === 'string' ? plan : JSON.stringify(plan, null, 2)),
      passionLevel,
      passionGuidance,
      passionScaleDefinition,
      length,
      modeContext // Add mode context to template
    });
  }

  async execute(context) {
    const prompt = await this.generatePrompt(context);
    const systemPrompt = '你是资深作家，负责高质量中文叙事写作。';

    // 根据目标字数计算 max_tokens（中文字符约 0.6-1 token，加 20% 安全余量）
    const targetLength = context.length || 2000;
    const estimatedTokens = Math.ceil(targetLength * 1.0 * 1.2); // 保守估计 + 20% 余量
    const maxTokens = Math.min(8192, Math.max(estimatedTokens, 4096)); // 限制在 4096-8192 之间

    const result = await openai.generateText(prompt, systemPrompt, {
      temperature: this.temperature,
      feature: 'chapterGeneration',
      projectId: context.projectId,
      max_tokens: maxTokens
    });

    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'WriterAgent',
        action: 'execute',
        modules: {
          system: systemPrompt,
          context: { plan: context.plan, style: context.style, length: context.length },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: result,
        model: (await openai.getFeatureConfig('chapterGeneration', context.projectId)).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName || 'Writer Task',
        chapterNumber: context.chapterNumber
      });
    }

    return result;
  }

  /**
   * 带自动续写的执行方法
   * 当检测到输出被截断时，自动发起续写请求直到完成
   * @param {Object} context - 写作上下文
   * @param {number} maxRetries - 最大续写次数（默认 5）
   * @param {Function} onProgress - 进度回调 (currentLength, targetLength, retryCount)
   * @returns {string} 完整的生成内容
   */
  async executeWithAutoContinue(context, maxRetries = 5, onProgress = null) {
    const systemPrompt = '你是资深作家，负责高质量中文叙事写作。';
    const targetLength = context.length || 2000;

    let fullContent = '';
    let retryCount = 0;
    let currentMode = 'full';

    // 保存原始提示词生成所需的上下文（首次生成用）
    const originalContext = { ...context };

    while (retryCount <= maxRetries) {
      // 计算本轮目标字数
      const currentLength = fullContent.length;
      const remainingLength = Math.max(targetLength - currentLength, 1000);

      // 构建本轮提示词
      let prompt;
      if (currentMode === 'full') {
        // 首次生成：使用完整的原始提示词
        prompt = await this.generatePrompt(originalContext);
      } else {
        // 续写模式：包含原始上下文 + 已生成内容 + 续写指令
        const continueContext = {
          ...originalContext,
          length: remainingLength,
          mode: 'continue',
          currentText: fullContent
        };
        prompt = await this.generatePrompt(continueContext);

        // 增强续写指令
        prompt += `

## 续写要求（重要）
- 从上文**最后一句话**自然衔接，避免任何重复
- 继续推进剩余场景，目标再写约 ${remainingLength} 字
- 保持文风、节奏、人称视角完全一致
- 如果场景已完成，可以结束本章`;
      }

      // 计算 max_tokens
      const estimatedTokens = Math.ceil(remainingLength * 1.0 * 1.2);
      const maxTokens = Math.min(8192, Math.max(estimatedTokens, 4096));

      // 调用带元数据的生成方法
      const { content, truncated } = await openai.generateTextWithMeta(prompt, systemPrompt, {
        temperature: this.temperature,
        feature: 'chapterGeneration',
        projectId: context.projectId,
        max_tokens: maxTokens,
        signal: context.signal
      });

      // 合并内容
      fullContent += content;

      // 进度回调
      if (onProgress) {
        onProgress(fullContent.length, targetLength, retryCount);
      }

      // 检查是否完成
      if (!truncated) {
        console.log(`[WriterAgent] 生成完成，总字数: ${fullContent.length}`);
        break;
      }

      // 检查是否已达到目标字数的 95%
      if (fullContent.length >= targetLength * 0.95) {
        console.log(`[WriterAgent] 已达到目标字数 95%，停止续写。总字数: ${fullContent.length}`);
        break;
      }

      // 继续续写
      retryCount++;
      currentMode = 'continue';
      console.log(`[WriterAgent] 检测到截断，自动续写第 ${retryCount} 次... 当前字数: ${fullContent.length}`);

      if (retryCount > maxRetries) {
        console.warn(`[WriterAgent] 达到最大续写次数 ${maxRetries}，停止。总字数: ${fullContent.length}`);
        break;
      }
    }

    // 记录日志
    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'WriterAgent',
        action: 'executeWithAutoContinue',
        modules: {
          system: systemPrompt,
          context: {
            plan: context.plan,
            style: context.style,
            targetLength: targetLength,
            actualLength: fullContent.length,
            retryCount: retryCount
          }
        },
        fullPrompt: '[Auto-continue mode - see individual API logs for details]',
        response: `[${fullContent.length} 字，续写 ${retryCount} 次]`,
        model: (await openai.getFeatureConfig('chapterGeneration', context.projectId)).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName || 'Writer Task (Auto-Continue)',
        chapterNumber: context.chapterNumber
      });
    }

    return fullContent;
  }

  async * executeStream(context) {
    const prompt = await this.generatePrompt(context);
    const systemPrompt = '你是资深作家，负责高质量中文叙事写作。';

    // 根据目标字数计算 max_tokens（中文字符约 0.6-1 token，加 20% 安全余量）
    const targetLength = context.length || 2000;
    const estimatedTokens = Math.ceil(targetLength * 1.0 * 1.2); // 保守估计 + 20% 余量
    const maxTokens = Math.min(8192, Math.max(estimatedTokens, 4096)); // 限制在 4096-8192 之间

    let full = '';
    for await (const chunk of openai.generateTextStream(prompt, systemPrompt, null, {
      temperature: this.temperature,
      feature: 'chapterGeneration',
      projectId: context.projectId,
      max_tokens: maxTokens,
      signal: context.signal  // Pass abort signal to enable cancellation
    })) {
      full += chunk;
      yield chunk;
    }

    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'WriterAgent',
        action: 'executeStream',
        modules: {
          system: systemPrompt,
          context: { plan: context.plan, style: context.style, length: context.length },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: full,
        model: (await openai.getFeatureConfig('chapterGeneration', context.projectId)).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName || 'Writer Task',
        chapterNumber: context.chapterNumber
      });
    }

    return full;
  }

  /**
   * 流式执行并自动续写
   * 当检测到输出被截断时，自动发起续写请求，同时保持流式输出
   * @param {Object} context - 写作上下文
   * @param {number} maxRetries - 最大续写次数（默认 5）
   * @yields {Object} { type: 'chunk' | 'continue' | 'complete', content?, retryCount?, totalLength? }
   */
  async * executeStreamWithAutoContinue(context, maxRetries = 5) {
    const systemPrompt = '你是资深作家，负责高质量中文叙事写作。';
    const targetLength = context.length || 2000;

    let fullContent = '';
    let retryCount = 0;
    let currentMode = 'full';
    let truncated = false;

    const originalContext = { ...context };

    do {
      // 计算本轮目标字数
      const currentLength = fullContent.length;
      const remainingLength = Math.max(targetLength - currentLength, 1000);

      // 构建本轮提示词
      let prompt;
      if (currentMode === 'full') {
        prompt = await this.generatePrompt(originalContext);
      } else {
        const continueContext = {
          ...originalContext,
          length: remainingLength,
          mode: 'continue',
          currentText: fullContent
        };
        prompt = await this.generatePrompt(continueContext);

        prompt += `

## 续写要求（重要）
- 从上文**最后一句话**自然衔接，避免任何重复
- 继续推进剩余场景，目标再写约 ${remainingLength} 字
- 保持文风、节奏、人称视角完全一致
- 如果场景已完成，可以结束本章`;
      }

      // 计算 max_tokens
      const estimatedTokens = Math.ceil(remainingLength * 1.0 * 1.2);
      const maxTokens = Math.min(8192, Math.max(estimatedTokens, 4096));

      // 用于捕获流结束状态
      let streamFinishInfo = { truncated: false };

      // 流式生成
      for await (const chunk of openai.generateTextStream(prompt, systemPrompt, null, {
        temperature: this.temperature,
        feature: 'chapterGeneration',
        projectId: context.projectId,
        max_tokens: maxTokens,
        signal: context.signal,
        onFinish: (info) => {
          streamFinishInfo = info;
        }
      })) {
        fullContent += chunk;
        yield { type: 'chunk', content: chunk, fullContent };
      }

      truncated = streamFinishInfo.truncated;

      // 检查是否需要续写
      if (!truncated) {
        console.log(`[WriterAgent] 流式生成完成，总字数: ${fullContent.length}`);
        break;
      }

      // 检查是否已达到目标字数的 95%
      if (fullContent.length >= targetLength * 0.95) {
        console.log(`[WriterAgent] 已达到目标字数 95%，停止续写。总字数: ${fullContent.length}`);
        break;
      }

      // 准备续写
      retryCount++;
      currentMode = 'continue';
      console.log(`[WriterAgent] 检测到截断，自动续写第 ${retryCount} 次... 当前字数: ${fullContent.length}`);

      // 通知调用方正在续写
      yield { type: 'continue', retryCount, currentLength: fullContent.length, targetLength };

      if (retryCount > maxRetries) {
        console.warn(`[WriterAgent] 达到最大续写次数 ${maxRetries}，停止。总字数: ${fullContent.length}`);
        break;
      }
    } while (truncated && retryCount <= maxRetries);

    // 记录日志
    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'WriterAgent',
        action: 'executeStreamWithAutoContinue',
        modules: {
          system: systemPrompt,
          context: {
            targetLength: targetLength,
            actualLength: fullContent.length,
            retryCount: retryCount
          }
        },
        fullPrompt: '[Auto-continue stream mode - see individual API logs]',
        response: `[${fullContent.length} 字，续写 ${retryCount} 次]`,
        model: (await openai.getFeatureConfig('chapterGeneration', context.projectId)).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName || 'Writer Task (Auto-Continue Stream)',
        chapterNumber: context.chapterNumber
      });
    }

    yield { type: 'complete', totalLength: fullContent.length, retryCount };
    return fullContent;
  }
}
