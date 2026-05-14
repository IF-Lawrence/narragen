import { BaseAgent } from './BaseAgent';
import { openai } from '../openai';
import { PromptLogger } from '../PromptLogger';
import { PromptManager } from '../PromptManager';

export class StylistAgent extends BaseAgent {
  constructor() {
    super('Stylist', 0.4);
  }

  async generatePrompt(context) {
    const draft = context.draft || '';
    const tone = context.tone || '高级、真实、节奏感强';
    const passionLevel = context.passionLevel || 1;
    const deviationAnalysis = context.deviationAnalysis;
    const critique = context.critique;
    const targetLength = context.targetLength; // New: target word count

    // Build Passion Guidance
    // Use custom definitions from settings (same as WriterAgent)
    const defs = context.passionDefinitions || {};

    let passionGuidance = '';
    if (passionLevel >= 4) {
      passionGuidance = defs['5'] || defs['4'] || '极致的张力与激情，突破常规的描写尺度，完全释放的情感表达。';
    } else if (passionLevel >= 3) {
      passionGuidance = defs['3'] || '高强度的情感爆发，大胆的动作描写。';
    } else if (passionLevel >= 2) {
      passionGuidance = defs['2'] || '肢体接触增加，情感张力增强，有明显的暗示。';
    } else {
      passionGuidance = defs['1'] || '注重情感交流，氛围渲染，无直接描写。';
    }

    // Build Deviation Guidance
    let deviationGuidance = '';
    if (deviationAnalysis) {
      const deviations = deviationAnalysis.deviations || [];
      const strengths = deviationAnalysis.strengths || [];

      if (deviations.length > 0) {
        deviationGuidance += '## ⚠️ 剧情偏差修正 (来自 Planner)\n';
        deviations.forEach((d, i) => {
          deviationGuidance += `${i + 1}. **${d.issue}**: ${d.suggestion} (位置: ${d.location})\n`;
        });
        deviationGuidance += '\n';
      }

      if (strengths.length > 0) {
        deviationGuidance += '## ✅ 保持优点 (不要改动)\n';
        strengths.forEach((s, i) => {
          deviationGuidance += `- ${s}\n`;
        });
        deviationGuidance += '\n';
      }
    }

    // Build Critique Guidance
    let critiqueGuidance = '';
    if (critique) {
      const suggestions = [];

      // 1. Global suggestions
      if (critique.summary && critique.summary.globalSuggestions) {
        suggestions.push(...critique.summary.globalSuggestions);
      }

      // 2. Specific issues (filter for moderate/major severity)
      const categories = ['characterConsistency', 'logicCoherence', 'quality'];
      categories.forEach(cat => {
        if (critique[cat] && Array.isArray(critique[cat])) {
          critique[cat].forEach(item => {
            if (item.suggestion && (item.severity === 'moderate' || item.severity === 'major')) {
              suggestions.push(`[${cat}] ${item.issue}: ${item.suggestion}`);
            }
          });
        }
      });

      if (suggestions.length > 0) {
        critiqueGuidance += '## 💡 质量改进建议 (来自 Critic)\n';
        suggestions.forEach((s, i) => {
          critiqueGuidance += `${i + 1}. ${s}\n`;
        });
        critiqueGuidance += '\n';
      }
    }

    // Get prompt template from PromptManager
    const promptTemplate = await PromptManager.getPrompt('stylist', 'main', context.projectId);

    // Render template with variables
    return PromptManager.renderTemplate(promptTemplate.template, {
      tone,
      passionLevel,
      passionGuidance,
      deviationGuidance,
      critiqueGuidance,
      targetLength: targetLength || '',
      currentLength: draft.length,
      draft
    });
  }

  async execute(context) {
    const prompt = await this.generatePrompt(context);
    const systemPrompt = '你是专业润色师。严禁输出任何前言、后记、说明或对话，只允许输出处理后的小说正文。';

    // 根据草稿字数计算 max_tokens（润色输出应与输入相近，加 30% 安全余量）
    const draftLength = context.draft?.length || 2000;
    const estimatedTokens = Math.ceil(draftLength * 1.0 * 1.3); // 保守估计 + 30% 余量
    const maxTokens = Math.min(8192, Math.max(estimatedTokens, 4096)); // 限制在 4096-8192 之间

    const result = await openai.generateText(prompt, systemPrompt, {
      temperature: this.temperature,
      feature: 'stylist',
      projectId: context.projectId,
      max_tokens: maxTokens
    });

    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'StylistAgent',
        action: 'execute',
        modules: {
          system: systemPrompt,
          context: { tone: context.tone },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: result,
        model: (await openai.getFeatureConfig('stylist', context.projectId)).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName || 'Stylist Task',
        chapterNumber: context.chapterNumber
      });
    }

    return result;
  }

  async *executeStream(context) {
    const prompt = await this.generatePrompt(context);
    const systemPrompt = '你是专业润色师。严禁输出任何前言、后记、说明或对话，只允许输出处理后的小说正文。';

    // 根据草稿字数计算 max_tokens（润色输出应与输入相近，加 30% 安全余量）
    const draftLength = context.draft?.length || 2000;
    const estimatedTokens = Math.ceil(draftLength * 1.0 * 1.3); // 保守估计 + 30% 余量
    const maxTokens = Math.min(8192, Math.max(estimatedTokens, 4096)); // 限制在 4096-8192 之间

    let full = '';
    for await (const chunk of openai.generateTextStream(prompt, systemPrompt, null, {
      temperature: this.temperature,
      feature: 'stylist',
      projectId: context.projectId,
      max_tokens: maxTokens,
      signal: context.signal
    })) {
      full += chunk;
      yield chunk;
    }

    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'StylistAgent',
        action: 'executeStream',
        modules: {
          system: systemPrompt,
          context: { tone: context.tone },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: full,
        model: (await openai.getFeatureConfig('stylist', context.projectId)).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName || 'Stylist Task',
        chapterNumber: context.chapterNumber
      });
    }

    return full;
  }

  /**
   * 流式执行并自动续写（润色专用）
   * 当检测到输出被截断时，自动续写剩余部分
   * 润色续写策略：传递原始草稿 + 已完成润色部分，要求从断点继续
   * @param {Object} context - 润色上下文
   * @param {number} maxRetries - 最大续写次数（默认 5）
   * @yields {Object} { type: 'chunk' | 'continue' | 'complete', content?, retryCount?, totalLength? }
   */
  async * executeStreamWithAutoContinue(context, maxRetries = 5) {
    const systemPrompt = '你是专业润色师。严禁输出任何前言、后记、说明或对话，只允许输出处理后的小说正文。';
    const originalDraft = context.draft || '';
    const draftLength = originalDraft.length;

    let fullPolishedContent = '';
    let retryCount = 0;
    let truncated = false;

    do {
      // 计算本轮目标和 max_tokens
      const currentLength = fullPolishedContent.length;
      const remainingDraftLength = Math.max(draftLength - currentLength, 1000);
      const estimatedTokens = Math.ceil(remainingDraftLength * 1.0 * 1.3);
      const maxTokens = Math.min(8192, Math.max(estimatedTokens, 4096));

      // 构建本轮提示词
      let prompt;
      if (retryCount === 0) {
        // 首次：使用完整原始提示词
        prompt = await this.generatePrompt(context);
      } else {
        // 续写模式：传递原始草稿 + 已润色部分，要求从断点继续
        const remainingDraft = this.findRemainingDraft(originalDraft, fullPolishedContent);

        prompt = `你正在续写一段润色任务，请从断点继续：

## 原始草稿（需要润色的完整内容）
"""
${originalDraft}
"""

## 已完成的润色部分
"""
${fullPolishedContent}
"""

## 剩余待润色的原始内容（从这里对应的部分继续润色）
"""
${remainingDraft}
"""

## 续写要求
1. 从上方「已完成」部分的**最后一句话**自然衔接，避免重复
2. 继续润色「剩余待润色」的内容，保持风格一致
3. 只输出润色后的正文，不要任何说明文字
4. 预计还需润色约 ${remainingDraftLength} 字`;
      }

      // 用于捕获流结束状态
      let streamFinishInfo = { truncated: false };

      // 流式生成
      for await (const chunk of openai.generateTextStream(prompt, systemPrompt, null, {
        temperature: this.temperature,
        feature: 'stylist',
        projectId: context.projectId,
        max_tokens: maxTokens,
        signal: context.signal,
        onFinish: (info) => {
          streamFinishInfo = info;
        }
      })) {
        fullPolishedContent += chunk;
        yield { type: 'chunk', content: chunk, fullContent: fullPolishedContent };
      }

      truncated = streamFinishInfo.truncated;

      // 检查是否需要续写
      if (!truncated) {
        console.log(`[StylistAgent] 流式润色完成，总字数: ${fullPolishedContent.length}`);
        break;
      }

      // 检查是否已达到草稿字数的 90%（润色通常会略微压缩或扩展）
      if (fullPolishedContent.length >= draftLength * 0.9) {
        console.log(`[StylistAgent] 已达到草稿字数 90%，停止续写。总字数: ${fullPolishedContent.length}`);
        break;
      }

      // 准备续写
      retryCount++;
      console.log(`[StylistAgent] 检测到截断，自动续写第 ${retryCount} 次... 当前字数: ${fullPolishedContent.length}`);

      // 通知调用方正在续写
      yield { type: 'continue', retryCount, currentLength: fullPolishedContent.length, targetLength: draftLength };

      if (retryCount > maxRetries) {
        console.warn(`[StylistAgent] 达到最大续写次数 ${maxRetries}，停止。总字数: ${fullPolishedContent.length}`);
        break;
      }
    } while (truncated && retryCount <= maxRetries);

    // 记录日志
    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'StylistAgent',
        action: 'executeStreamWithAutoContinue',
        modules: {
          system: systemPrompt,
          context: {
            draftLength: draftLength,
            polishedLength: fullPolishedContent.length,
            retryCount: retryCount
          }
        },
        fullPrompt: '[Auto-continue stream mode - see individual API logs]',
        response: `[${fullPolishedContent.length} 字，续写 ${retryCount} 次]`,
        model: (await openai.getFeatureConfig('stylist', context.projectId)).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName || 'Stylist Task (Auto-Continue Stream)',
        chapterNumber: context.chapterNumber
      });
    }

    yield { type: 'complete', totalLength: fullPolishedContent.length, retryCount };
    return fullPolishedContent;
  }

  /**
   * 根据已润色内容，找出原始草稿中对应的剩余部分
   * 使用简单的字数比例估算
   */
  findRemainingDraft(originalDraft, polishedContent) {
    // 简单策略：假设润色比例约为 1:1，按字数比例截取原稿后半部分
    const ratio = polishedContent.length / originalDraft.length;
    const estimatedPosition = Math.min(Math.floor(originalDraft.length * ratio * 0.9), originalDraft.length - 500);

    // 找到最近的句号位置，从那里开始
    const searchStart = Math.max(0, estimatedPosition - 200);
    const nearestSentenceEnd = originalDraft.indexOf('。', searchStart);

    if (nearestSentenceEnd > 0 && nearestSentenceEnd < originalDraft.length - 100) {
      return originalDraft.substring(nearestSentenceEnd + 1);
    }

    return originalDraft.substring(estimatedPosition);
  }
}
