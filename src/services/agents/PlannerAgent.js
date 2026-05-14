import { BaseAgent } from './BaseAgent';
import { openai } from '../openai';
import { PromptLogger } from '../PromptLogger';
import { PromptManager } from '../PromptManager';
import { v4 as uuidv4 } from 'uuid';

export class PlannerAgent extends BaseAgent {
  constructor() {
    super('Planner', 0.2);
  }

  async generatePrompt(context) {
    const title = context.title || '';
    const chapterNumber = context.chapterNumber || 1;
    const outline = context.outline || '';
    const constraints = context.constraints || '';
    return `为作品${title}的第${chapterNumber}章生成详细写作计划。包含场景列表、目标、冲突、转折、节奏。遵循约束：${constraints}。基于核心大纲：${outline}`;
  }

  async execute(context) {
    // Original prompt generation logic
    let prompt = await this.generatePrompt(context);
    const systemPrompt = '你是资深主编，负责将需求拆分为可执行的写作计划。';

    // Apply the user's requested change: get prompt template from PromptManager
    // This assumes the template will be used to construct the final 'prompt' variable.
    // For now, we'll just add the call as requested, assuming 'prompt' will be updated later
    // or that this is an initial step towards a template-based system.
    // Note: 'projectId' needs to be 'context.projectId'
    const promptTemplate = await PromptManager.getPrompt('planner', 'chapterScenes', context.projectId);

    // If the intention was to use the template, the 'prompt' variable would be constructed here
    // For example: prompt = promptTemplate.replace('{title}', context.title).replace(...)
    // But since the instruction only asks to *pass* projectId to the call, and not to change
    // how 'prompt' is ultimately defined for openai.generateText, we keep the original 'prompt'
    // definition for now to maintain functionality.

    const result = await openai.generateText(prompt, systemPrompt, { temperature: this.temperature, feature: 'planner', projectId: context.projectId });

    if (context.projectId) {
      try {
        const config = await openai.getFeatureConfig('planner', context.projectId);
        await PromptLogger.log({
          projectId: context.projectId,
          agent: 'PlannerAgent',
          action: 'execute',
          modules: {
            system: systemPrompt,
            context: { title: context.title, chapterNumber: context.chapterNumber, outline: context.outline, constraints: context.constraints },
            instruction: prompt
          },
          fullPrompt: `${systemPrompt}\n\n${prompt}`,
          response: result,
          model: config.model || 'unknown'
        });
      } catch (err) {
        console.error('Failed to log prompt:', err);
      }
    }

    return result;
  }

  async callLLM(prompt, type = 'text', options = {}) {
    const systemPrompt = 'You are a professional novel planner assistant. Return ONLY valid JSON without any markdown formatting, explanations, or additional text.';
    const result = await openai.generateText(prompt, systemPrompt, {
      temperature: this.temperature,
      feature: 'planner',
      signal: options.signal,
      projectId: options.projectId,
      response_format: type === 'json' ? { type: 'json_object' } : undefined
    });

    if (type === 'json') {
      try {
        let clean = typeof result === 'string' ? result : JSON.stringify(result);

        // 检测 AI 返回工具调用而不是 JSON 的情况
        if (clean.includes('**Using tool:**') || clean.includes('code_execution') || clean.includes('**Parameters:**')) {
          console.error('AI returned tool call instead of JSON:', clean.substring(0, 300));
          throw new Error('AI 尝试执行代码而不是生成 JSON。请更换模型或重试。');
        }

        // Remove markdown code blocks
        if (clean.includes('```')) {
          clean = clean.replace(/```json\n?|```\n?|```/g, '');
        }

        // Try to extract JSON from mixed content
        // Look for the first { and last } to extract the JSON object
        const jsonStart = clean.indexOf('{');
        const jsonEnd = clean.lastIndexOf('}');

        // 如果找不到有效的 JSON 结构
        if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
          console.error('No JSON object found in response:', clean.substring(0, 300));
          throw new Error('AI 未返回有效的 JSON 格式。请重试。');
        }

        clean = clean.substring(jsonStart, jsonEnd + 1);

        // Clean up any remaining non-JSON content
        clean = clean.trim();

        return JSON.parse(clean);
      } catch (e) {
        console.error('Failed to parse LLM JSON response:', e);
        console.error('Raw response:', result?.substring?.(0, 300));
        throw new Error(e.message || 'AI 响应不是有效的 JSON。请重试。');
      }
    }

    return result;
  }

  async generateTemplate(idea, options = {}) {
    // Get customizable prompt from PromptManager
    const promptConfig = await PromptManager.getPrompt('planner', 'generateTemplate', options.projectId);
    const systemPrompt = promptConfig.system || 'You are a professional novel planner assistant.';

    // Build prompt from template
    let prompt = promptConfig.template || '';
    prompt = prompt.replace(/\{\{idea\}\}/g, idea);

    // If no custom template, use default
    if (!prompt.trim()) {
      prompt = `You are a professional novel planner. Create a comprehensive novel outline template based on the following idea: "${idea}"

CRITICAL: Return ONLY valid JSON. No explanations.
CRITICAL: All values (name, descriptions, fields) MUST be in Chinese.

Required JSON structure:
{
  "name": "Template Name (4-6 chars, Chinese)",
  "icon": "Emoji Icon",
  "description": "Category | Style | Audience (e.g. 现实主义 | 群像叙事 | 成熟读者)",
  "storyFields": {
    "mainPlot": "One sentence summary in Chinese",
    "mainConflict": "Core conflict in Chinese",
    "storyBeginning": "How it starts in Chinese",
    "expectedEnding": "How it ends in Chinese"
  },
  "worldFields": {
    "timePeriod": "Time setting in Chinese",
    "mainSettings": "Key locations in Chinese",
    "worldFeatures": "Unique rules/features in Chinese",
    "socialRules": "Society structure in Chinese"
  },
  "characters": [
    { "name": "Name in Chinese", "role": "Role in Chinese", "description": "Brief bio in Chinese" },
    { "name": "Name in Chinese", "role": "Role in Chinese", "description": "Brief bio in Chinese" }
  ],
  "options": {
    "novelType": "Genre in Chinese (e.g. 现实主义, 成长小说, 悬疑犯罪, 言情, 玄幻, 科幻, 历史, 都市, 仙侠, 军事, 游戏, or any fitting genre)",
    "targetAudience": ["Audience types in Chinese (e.g. 青年读者, 成熟读者, 通俗大众, 文学爱好者, 女性读者, 男性读者, or any fitting audience)"],
    "tone": "Tone in Chinese (e.g. 轻松幽默, 温馨治愈, 紧张悬疑, 深沉内敛, 厚重史诗, 细腻抒情, 热血燃向, 黑暗压抑, or any fitting tone)",
    "length": "Length (short/medium/long) - Choose based on story complexity",
    "characterCount": "Number (2-12) - Main narrative characters based on story needs",
    "narrativeStyle": "Narrative style in Chinese (e.g. 群像叙事, 双主角, 单一视角, 多线交织, or any fitting style)",
    "literaryDepth": "Literary depth in Chinese (e.g. 通俗流畅, 兼具深度, 纯文学, or any fitting depth)"
  }
}

IMPORTANT GUIDELINES for options:
- novelType: Choose the MOST fitting genre for the story. You are NOT limited to the examples - use any Chinese genre term that best describes the story.
- targetAudience: Match with story depth and theme. You can use any relevant audience description in Chinese.
- tone: Describe the emotional atmosphere. Use any fitting Chinese term, not just the examples.
- length: short (3-10万字), medium (10-30万字), long (30万字以上)
- characterCount: Count the main characters needed for the story (typically 2-8, max 12)
- narrativeStyle: 
  * 群像叙事 for ensemble casts with multiple POVs
  * 双主角 for dual protagonist stories
  * 单一视角 for single POV narratives
  * 多线交织 for multiple interweaving plot lines
- literaryDepth:
  * 通俗流畅 for commercial/genre fiction
  * 兼具深度 for literary commercial fiction
  * 纯文学 for pure literary fiction
`;
    }

    // 1. 先创建日志记录（在调用 LLM 前）
    let logId = null;
    let config = null;
    if (options.projectId) {
      try {
        config = await openai.getFeatureConfig('planner', options.projectId);
        logId = await PromptLogger.startLog({
          projectId: options.projectId,
          agent: 'PlannerAgent',
          action: 'generateTemplate',
          taskId: `template_gen_${Date.now()}`,
          taskName: 'AI 生成构思模板',
          modules: {
            system: systemPrompt,
            userIdea: idea,
            instruction: prompt
          },
          fullPrompt: `${systemPrompt}\n\n${prompt}`,
          model: config?.model || 'unknown'
        });
      } catch (err) {
        console.error('Failed to start log:', err);
      }
    }

    // 2. 调用 LLM
    let result;
    let error = null;
    try {
      result = await this.callLLM(prompt, 'json', options);
    } catch (e) {
      error = e;
    }

    // 3. 更新日志记录
    if (logId) {
      await PromptLogger.completeLog(
        logId,
        error ? null : JSON.stringify(result, null, 2),
        error?.message
      );
    }

    // Re-throw error if there was one
    if (error) {
      throw error;
    }

    return result;
  }

  async generateCoreOutline(context) {
    const idea = context.idea || '';
    const world = context.world || '';
    const characters = context.characters || [];
    const options = context.options || {};
    const constraints = context.constraints || '';

    // Build additional constraints from options
    let additionalConstraints = '';
    if (constraints) {
      additionalConstraints += `\n\nUSER DEFINED CONSTRAINTS (MUST FOLLOW):\n${constraints}`;
    }
    if (options.novelType) {
      additionalConstraints += `\n- 小说类型: ${options.novelType}`;
    }
    if (options.targetAudience && options.targetAudience.length > 0) {
      additionalConstraints += `\n- 目标受众: ${options.targetAudience.join('、')}`;
    }
    if (options.tone) {
      additionalConstraints += `\n- 故事基调: ${options.tone}`;
    }
    if (options.length) {
      const lengthMap = { short: '短篇(3-10万字)', medium: '中篇(10-30万字)', long: '长篇(30万字以上)' };
      additionalConstraints += `\n- 预期篇幅: ${lengthMap[options.length] || '中篇'}`;
    }
    if (options.narrativeStyle) {
      additionalConstraints += `\n- 叙事风格: ${options.narrativeStyle}`;
    }
    if (options.literaryDepth) {
      additionalConstraints += `\n- 文学性: ${options.literaryDepth}`;
    }

    // Build character context if presets are provided
    let characterContext = '';
    if (characters.length > 0) {
      characterContext = '\n\nPredefined Characters (expand these with full details and add more if needed):\n';
      characters.forEach(char => {
        characterContext += `- ${char.name} (${char.role}): ${char.description}\n`;
      });
      characterContext += '\nPlease incorporate these characters into the outline and expand their profiles with additional details (age, gender, personality, background, goal, arc, appearance, relationships). You may also add additional supporting characters as needed for the story.';
    }

    const characterCountHint = options.characterCount
      ? `\n- Generate ${options.characterCount} main characters (adjust roles based on this count)`
      : '\n- Generate 2-4 main characters minimum (protagonist, love interest/supporting, antagonist, etc.)';

    const prompt = `你是一位精通中国网络文学与传统严肃文学的资深策划编辑。请基于以下创意和世界观设定，生成一份完整、专业的小说核心大纲。

**输出要求**：仅返回有效的 JSON，不要任何解释、markdown 代码块或额外文字。

---

## 标题创作指南（极其重要）

标题是小说的灵魂。必须具有感染力、令人难忘，且**匹配类型风格**。

**按类型选择风格**：
- 严肃文学/纯文学：深沉、意象化、可引用古典诗词意象（如"尘埃落定"、"长夜将尽"、"人间世"、"活着"）
- 都市言情：现代化、情感化、可用流行文化表达（如"何以笙箫默"、"微微一笑"、"匆匆那年"）
- 玄幻修仙：仙侠意境、气势磅礴（如"凡人修仙"、"遮天"、"择天记"、"一念永恒"）
- 悬疑推理：暗示性、紧张感（如"白夜行"、"嫌疑人"、"沉默的羔羊"）
- 科幻：未来感、概念性（如"三体"、"流浪地球"、"北京折叠"）
- 历史架空：厚重感、时代气息（如"大明王朝"、"琅琊榜"、"庆余年"）

**可参考的命名模式**：
- 动词+宾语：《追风筝的人》、《杀死一只知更鸟》
- 意象+情绪：《平凡的世界》、《百年孤独》
- 人名/地名：《白鹿原》、《围城》、《红楼梦》
- 概念/隐喻：《1984》、《飘》、《呼啸山庄》

**绝对禁止**：
- "XX之XX" 格式（如"重生之我是XX"、"穿越之XX"）
- 剧透或直白描述剧情
- 网文套路用语（如"无敌XX"、"最强XX"、"至尊XX"、"神级XX"）
- 俗套言情模式（如"霸道XX爱上我"、"XX的专属XX"）

**长度**：2-6 字为佳，简短有力，易于传播。

---

## JSON 结构要求

{
  "title": "小说标题（2-6字，文学性强，有意象感）",
  "logline": "一句话摘要（20-40字，点明主角、核心冲突、独特卖点）",
  "primaryTheme": "核心主题（如：救赎、成长、复仇、爱与牺牲）",
  "secondaryThemes": ["次要主题1", "次要主题2"],
  "coreConflict": "主要冲突（外部冲突+内心冲突，50-100字）",
  "tone": "故事基调（如：沉重写实、轻松幽默、紧张悬疑、温馨治愈）",
  "pacing": "预期节奏（如：前期慢热铺垫→中期加速→高潮爆发→余韵收尾）",
  "targetAudience": "目标受众（如：25-35岁都市女性、网文老读者、文学爱好者）",
  "tags": ["类型标签", "题材标签", "风格标签"],
  "worldSetting": {
    "timePeriod": "时代背景（如：当代中国、架空明朝、2150年后地球）",
    "location": "主要地点（如：北京胡同、架空江湖、废土城市）",
    "socialStructure": "社会结构（如：门阀世家、公司财阀、修仙宗门）",
    "technology": "科技/力量体系（如：现实科技、灵气修炼、赛博义体）",
    "supernaturalRules": "超自然规则（如适用：修炼境界、魔法体系、异能分类）",
    "keyRules": "世界观核心规则/禁区（如：灵气复苏后的规则、不可触碰的禁忌）"
  },
  "characters": [
    {
      "name": "角色中文名",
      "role": "主角/女主/配角/反派",
      "age": "年龄或年龄段",
      "gender": "性别",
      "personality": "性格特征（2-3个关键词+简述，如：外冷内热，表面疏离实则极度渴望认同）",
      "background": "背景故事（2-3句，关键创伤/起源）",
      "goal": "角色目标（外在目标+内在渴望）",
      "arc": "成长弧线（从A状态→经历B→变成C状态）",
      "appearance": "外貌描述（2-3句，具体视觉特征，避免模糊描述）",
      "relationships": {
        "其他角色名": "关系描述（如：青梅竹马→因误会反目→最终和解）"
      }
    }
  ],
  "relationshipMap": {
    "角色A-角色B": "关系类型与演变（如：师徒→反目→相互理解）",
    "角色B-角色C": "关系类型与演变"
  },
  "narrativeStrategy": {
    "structure": "叙事结构类型（如：双线并行 / 倒叙 / 循环 / 单元剧 / 线性）",
    "perspective": "叙事视角（如：双主角视角 / 群像视角 / 第一人称限制视角）",
    "presentation": "具体的表现形式（如：采用过去与现在交替叙事，两条线索在最终大高潮汇合）"
  },
  "plotProgression": [
    "[开端] 宏观阶段描述 + 核心情绪（如：身份认同的困惑与追寻的开始，基调：迷茫与好奇）",
    "[发展] 宏观阶段描述 + 核心情绪（如：矛盾逐渐激化，信任与背叛交织，基调：紧张与怀疑）",
    "[高潮] 宏观阶段描述 + 核心情绪（如：核心冲突全面爆发，角色面临终极抉择，基调：决绝与悲壮）",
    "[结局] 宏观阶段描述 + 情感落点（如：尘埃落定后的新秩序，角色完成蜕变，基调：释然与希望）"
  ],
  "ending": "预期结局方向（概括性描述：主线走向、角色弧光终点、情感基调，不透露具体过程）"
}

---

## 生成要求

${characterCountHint}
- **角色关系网络**：确保角色之间有清晰的关系脉络，填写 relationshipMap
- **角色详情适度**：外貌和背景各 2-3 句，避免过度冗长
- **plotProgression 设计原则**：
  - 3-5 个**宏观叙事阶段**，而非具体事件
  - 每个阶段标注 [开端]/[发展]/[高潮]/[结局]
  - 描述该阶段的**核心情绪弧**和**叙事方向**
  - **留白原则**：不要预设具体情节细节，为分卷规划和章节创作保留发散空间
  - **非线性叙事**：如采用双线/多线结构，用 [线索A]/[线索B] 前缀标记各线的阶段走向
  - 禁止罗列具体事件（如"主角发现日记"），改用抽象概括（如"秘密逐渐浮出水面"）
- **narrativeStrategy 叙事策略**：
  - 定义故事的结构形式（双线、群像、倒叙等）和视角选择
  - 如果是标准单线故事，structure 填"线性叙事"，perspective 填"主视角"
  - 如果采用非线性结构，必须在 plotProgression 中清晰标记不同线索
- **所有内容使用中文**（JSON key 除外）
- **直接返回 JSON**${additionalConstraints ? '\\n\\n## 用户指定约束（必须遵循）：' + additionalConstraints : ''}${characterContext}

---

## 输入信息

**创意**：${idea}

**世界观**：${world}

---

请直接返回 JSON：`;
    const systemPrompt = '你是一位专业的小说策划编辑。仅输出有效的 JSON，不要任何额外文字、解释或 markdown 格式。';
    // Extract signal from context if present
    const generateOptions = {
      temperature: 0.2,
      feature: 'planner',
      response_format: { type: 'json_object' },
      signal: context.signal,
      projectId: context.projectId
    };
    const result = await openai.generateText(prompt, systemPrompt, generateOptions);

    // Safety check for empty result
    if (!result || typeof result !== 'string' || result.trim() === '') {
      throw new Error('AI returned an empty response');
    }

    // Clean markdown code blocks if present
    let cleanResult = result;
    if (typeof cleanResult === 'string' && cleanResult.includes('```')) {
      cleanResult = cleanResult.replace(/```json\n?|```\n?|```/g, '');
    }

    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'PlannerAgent',
        action: 'generateCoreOutline',
        modules: {
          system: systemPrompt,
          context: { idea, world, characters: characters.length > 0 ? characters : 'none', options },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: result,
        taskId: context.taskId || uuidv4(),
        taskName: context.taskName || '核心大纲生成 (Core Outline Generation)'
      });
    }

    return cleanResult;
  }

  /**
   * 基于现有核心大纲和用户反馈生成优化版本
   * @param {Object} context - 包含 existingOutline, feedback, projectId, signal
   * @returns {string} 优化后的大纲 JSON 字符串
   */
  async refineCoreOutline(context) {
    const existingOutline = context.existingOutline || {};
    const feedback = context.feedback || '';

    const outlineStr = typeof existingOutline === 'string'
      ? existingOutline
      : JSON.stringify(existingOutline, null, 2);

    const prompt = `你是一位专业的小说策划编辑。请基于以下现有核心大纲和用户的修改意见，生成优化后的完整大纲。

**重要要求**：
1. 保持现有大纲的整体框架和核心设定
2. 根据用户反馈进行针对性优化
3. 返回完整的优化后大纲（不是差异或补丁）
4. 仅返回有效的 JSON，不要任何额外文字

---

## 现有核心大纲

${outlineStr}

---

## 用户修改意见

${feedback}

---

## 输出要求

请根据用户的修改意见，对现有大纲进行优化。保持 JSON 结构与原大纲一致：
{
  "title": "小说标题",
  "logline": "一句话摘要",
  "primaryTheme": "核心主题",
  "secondaryThemes": ["次要主题"],
  "coreConflict": "主要冲突",
  "tone": "故事基调",
  "pacing": "预期节奏",
  "targetAudience": "目标受众",
  "tags": ["标签"],
  "worldSetting": { ... },
  "characters": [ ... ],
  "relationshipMap": { ... },
  "narrativeStrategy": { ... },
  "plotProgression": [ ... ],
  "ending": "预期结局"
}

请直接返回优化后的完整 JSON：`;

    const systemPrompt = '你是一位专业的小说策划编辑。仅输出有效的 JSON，不要任何额外文字、解释或 markdown 格式。';

    const generateOptions = {
      temperature: 0.3,
      feature: 'planner',
      response_format: { type: 'json_object' },
      signal: context.signal,
      projectId: context.projectId
    };

    const result = await openai.generateText(prompt, systemPrompt, generateOptions);

    if (!result || typeof result !== 'string' || result.trim() === '') {
      throw new Error('AI returned an empty response');
    }

    // Clean markdown code blocks if present
    let cleanResult = result;
    if (typeof cleanResult === 'string' && cleanResult.includes('```')) {
      cleanResult = cleanResult.replace(/```json\n?|```\n?|```/g, '');
    }

    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'PlannerAgent',
        action: 'refineCoreOutline',
        modules: {
          system: systemPrompt,
          context: { feedback, existingOutlinePreview: outlineStr.substring(0, 500) + '...' },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: result,
        taskId: context.taskId || uuidv4(),
        taskName: context.taskName || '核心大纲优化 (Core Outline Refinement)'
      });
    }

    return cleanResult;
  }

  async generateVolumePlan(context) {
    const coreOutline = context.coreOutline || '';
    const volumes = context.targetVolumes || 3;
    const prompt = `将以下核心大纲拆解为${volumes}个分卷。每卷给出卷主题、关键事件、角色发展、覆盖章节范围。核心大纲：\n${coreOutline}`;
    const systemPrompt = '你是资深主编，负责分卷规划与阶段性叙事结构设计。';
    const result = await openai.generateText(prompt, systemPrompt, { temperature: 0.3, feature: 'planner', projectId: context.projectId });

    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'PlannerAgent',
        action: 'generateVolumePlan',
        modules: {
          system: systemPrompt,
          context: { coreOutline, volumes },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: result,
        model: (await openai.getFeatureConfig('planner')).model || 'unknown',
        taskId: context.taskId || uuidv4(),
        taskName: context.taskName || '分卷规划 (Volume Planning)',
        chapterNumber: context.chapterNumber
      });
    }

    return result;
  }

  async createVolumePlan(coreOutline, targetVolumes = 4, volumeConfigs = [], projectId = null, options = {}) {
    // Enforce volume limit
    targetVolumes = Math.min(5, Math.max(1, targetVolumes));
    const isSingleVolume = targetVolumes === 1;

    const systemPrompt = isSingleVolume
      ? `你是一位专家级的小说策划师。你的目标是基于核心大纲创作一个完整的单卷故事。

**关键要求**:
- 这是一个完整的独立故事,必须有明确的开端、发展、高潮和结局
- 不要将其视为多卷故事的"第一部分",而是一个自洽的完整作品
- 确保故事在本卷内达到满意的结局,解决核心冲突
- keyEvents 必须包含完整的叙事弧:开端 → 发展 → 冲突升级 → 高潮 → 结局

**叙事策略参考**:
- 如果核心大纲包含 narrativeStrategy，根据其 structure 安排故事结构
- 如果有多线叙事标记，确保各线索在单卷内完成交织和汇合

**角色关系**:
- 如果核心大纲包含 relationshipMap，summary 中应体现关系的完整演变弧

**分卷标题命名原则**:
- 2-6字为宜，简洁有力
- 可用意象隐喻本卷核心情感或转折

输出格式 (JSON):
{
    "volumes": [
        {
            "order": 1,
            "title": "分卷标题(2-6字,意象化)",
            "summary": "完整故事摘要(开端→发展→高潮→结局,200-500字)",
            "mainGoal": "本卷的完整叙事目标",
            "keyEvents": ["开端事件", "发展事件", "冲突升级", "高潮", "结局"]
        }
    ],
    "subplots": [
        {
            "name": "支线名称",
            "characters": ["涉及角色"],
            "description": "支线描述(50-100字)",
            "resolution": "支线收尾方式"
        }
    ],
    "foreshadowing": [
        {
            "hint": "伏笔内容",
            "importance": "major/minor"
        }
    ]
}`
      : `你是一位专家级的小说策划师。你的目标是将小说的核心大纲分解为结构分明的分卷计划。
请将故事规划为 ${targetVolumes} 个分卷（或根据故事体量适当调整，尽量接近 ${targetVolumes} 卷）。

**关键要求**:
- 每卷必须有足够的信息量和剧情密度,不要过于简略
- 每卷的 summary 应该是 200-400 字的详细描述,包含具体的情节发展
- 每卷的 keyEvents 应该包含 3-5 个具体事件,而非笼统概括
- **每卷都需要包含 cliffhanger 悬念**，用于吸引读者继续阅读下一卷

**叙事策略参考**（重要）:
- 如果核心大纲包含 narrativeStrategy，必须根据其 structure（如双线并行、倒叙）安排各卷内容
- 如果 plotProgression 中有多线标记（如 [线索A]、[线索B]），确保各线索在分卷中交织推进
- 非线性叙事时，每卷应包含多条线索的内容，并在关键卷实现线索汇合

**角色关系演变**:
- 如果核心大纲包含 relationshipMap，每卷的 summary 中应体现主要角色关系的阶段性变化
- 例如：第1卷"相遇与猜疑" → 第2卷"合作与信任建立" → 第3卷"背叛与决裂"

**分卷策略**:
- 第 1 卷:开端与世界观建立(引入角色、设定、初始冲突)
- 中间卷:发展与冲突升级(推进主线、深化矛盾、角色成长)
- 最后卷:高潮与结局(矛盾爆发、决战、收尾)

**分卷标题命名原则（重要）**:
- 2-6字为宜，简洁有力
- 风格应与小说类型匹配：
  * 都市言情：现代化、情感化（如"初见"、"重逢"、"错过"）
  * 玄幻修仙：气势磅礴、意境深远（如"破境"、"问道"、"逆天"）
  * 悬疑推理：暗示性、紧张感（如"迷雾"、"真相"、"猎杀"）
  * 严肃文学：深沉意象化（如"沉默"、"离散"、"归途"）
- 多卷之间的标题可有呼应感和递进感
- 避免直白描述剧情（如"主角重生"、"反派登场"）

注意：不需要预设每卷的章节数量，章节范围将在生成章节大纲时由用户决定。

**支线剧情要求**:
- 规划 1-3 条支线（根据总卷数调整）
- 每条支线应跨越至少 2 卷
- 支线必须与主线有交汇点，不能完全独立
- 在倒数第 1-2 卷完成所有支线收尾

**伏笔要求**:
- 规划 2-4 个伏笔
- major 伏笔（主线关键）必须在最后 1-2 卷揭示
- minor 伏笔（细节彩蛋）可以在任意卷揭示
- plantVolume 必须小于 revealVolume

输出格式 (JSON):
{
    "volumes": [
        {
            "order": 1,
            "title": "分卷标题(2-6字,意象化)",
            "summary": "分卷详细摘要(200-400字)",
            "mainGoal": "本卷的核心叙事目标",
            "keyEvents": ["具体事件1", "具体事件2", "..."],
            "cliffhanger": "本卷结尾悬念(吸引读者继续阅读)"
        }
    ],
    "subplots": [
        {
            "name": "支线名称",
            "characters": ["涉及的角色"],
            "description": "支线剧情描述(50-100字)",
            "volumeRange": "第N卷-第M卷(支线跨越的分卷范围)",
            "resolution": "支线收尾方式"
        }
    ],
    "foreshadowing": [
        {
            "hint": "伏笔内容描述",
            "plantVolume": 1,
            "revealVolume": 3,
            "importance": "major/minor"
        }
    ]
}`;
    let userPrompt = `核心大纲:\n${typeof coreOutline === 'string' ? coreOutline : JSON.stringify(coreOutline, null, 2)}`;

    if (volumeConfigs && volumeConfigs.length > 0) {
      userPrompt += `\n\n分卷具体要求:\n`;
      volumeConfigs.forEach((config, index) => {
        if (config.requirements) {
          userPrompt += `第 ${index + 1} 卷要求: ${config.requirements}\n`;
        }
      });
    }

    // Extract signal from options if present (passed via last argument object)
    const signal = options.signal;

    try {
      const result = await openai.generateText(userPrompt, systemPrompt, {
        response_format: { type: 'json_object' },
        temperature: 0.7,
        feature: 'planner',
        signal: signal,
        projectId: projectId
      });

      // Log the interaction
      if (projectId) {
        await PromptLogger.log({
          projectId: projectId,
          agent: 'PlannerAgent',
          action: 'createVolumePlan',
          modules: {
            system: systemPrompt,
            context: {
              targetVolumes,
              volumeConfigs: volumeConfigs.length > 0 ? volumeConfigs : 'none'
            },
            instruction: userPrompt
          },
          fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
          response: result,
          model: (await openai.getFeatureConfig('planner', projectId)).model || 'unknown',
          taskId: uuidv4(),
          taskName: '分卷规划 (Volume Planning)'
        });
      }

      let text = result;
      if (typeof text === 'string' && text.includes('```')) text = text.replace(/```json\n?|```\n?|```/g, '');
      return JSON.parse(text);
    } catch (error) {
      throw error;
    }
  }

  /**
   * 基于现有分卷规划和用户反馈生成优化版本
   * @param {Object} context - 包含 existingPlan, feedback, coreOutline, projectId, signal
   * @returns {Object} 优化后的分卷规划 { volumes, subplots, foreshadowing }
   */
  async refineVolumePlan(context) {
    const { existingPlan, feedback, coreOutline, projectId, signal } = context;

    const existingPlanStr = typeof existingPlan === 'string'
      ? existingPlan
      : JSON.stringify(existingPlan, null, 2);

    const coreOutlineStr = typeof coreOutline === 'string'
      ? coreOutline
      : JSON.stringify(coreOutline, null, 2);

    const systemPrompt = `你是一位专家级的小说策划师。请基于现有分卷规划和用户的修改意见，生成优化后的完整分卷规划。

**重要要求**：
1. 保持现有规划的整体框架和核心设定
2. 根据用户反馈进行针对性优化
3. 返回完整的优化后分卷规划（不是差异或补丁）
4. 仅返回有效的 JSON，不要任何额外文字

**输出格式**：
{
    "volumes": [
        {
            "order": 1,
            "name": "分卷标题(2-6字)",
            "description": "分卷详细摘要(200-400字)",
            "mainGoal": "本卷的核心叙事目标",
            "keyEvents": ["具体事件1", "具体事件2", "..."],
            "cliffhanger": "本卷结尾悬念"
        }
    ],
    "subplots": [
        {
            "name": "支线名称",
            "characters": ["涉及的角色"],
            "description": "支线剧情描述(50-100字)",
            "volumeRange": "第N卷-第M卷",
            "resolution": "支线收尾方式"
        }
    ],
    "foreshadowing": [
        {
            "hint": "伏笔内容描述",
            "plantVolume": 1,
            "revealVolume": 3,
            "importance": "major/minor"
        }
    ]
}`;

    const userPrompt = `## 核心大纲参考

${coreOutlineStr}

---

## 现有分卷规划

${existingPlanStr}

---

## 用户修改意见

${feedback || '请优化现有分卷规划，使其更加完善。'}

---

请根据用户的修改意见，对现有分卷规划进行优化，并返回完整的优化后 JSON：`;

    try {
      const result = await openai.generateText(userPrompt, systemPrompt, {
        response_format: { type: 'json_object' },
        temperature: 0.5,
        feature: 'planner',
        signal: signal,
        projectId: projectId
      });

      // Log the interaction
      if (projectId) {
        await PromptLogger.log({
          projectId: projectId,
          agent: 'PlannerAgent',
          action: 'refineVolumePlan',
          modules: {
            system: systemPrompt,
            context: {
              feedback,
              existingPlanPreview: existingPlanStr.substring(0, 500) + '...'
            },
            instruction: userPrompt
          },
          fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
          response: result,
          model: (await openai.getFeatureConfig('planner', projectId)).model || 'unknown',
          taskId: uuidv4(),
          taskName: '分卷规划优化 (Volume Plan Refinement)'
        });
      }

      let text = result;
      if (typeof text === 'string' && text.includes('```')) {
        text = text.replace(/```json\n?|```\n?|```/g, '');
      }
      return JSON.parse(text);
    } catch (error) {
      console.error('refineVolumePlan failed:', error);
      throw error;
    }
  }

  async generateVolumeChapterOutlines(context) {
    const volumeTitle = context.volumeTitle || '';
    const volumeDesc = context.volumeDesc || '';
    const startChapter = context.startChapter || 1;
    const count = context.count || 10;
    const coreOutline = context.coreOutline || '';
    const previousChaptersSummary = context.previousChaptersSummary || '';
    const characters = context.characters || [];

    // New parameters - volume plan details
    const currentChapterCount = context.currentChapterCount || 0;
    const totalChaptersInVolume = context.totalChaptersInVolume || 20;
    const isLastChapterOfVolume = context.isLastChapterOfVolume || false;
    const nextChapterSummary = context.nextChapterSummary || '';
    const passionLevel = context.passionLevel || 1;
    const passionDefinitions = context.passionDefinitions || {};
    const systemName = passionDefinitions.systemName || "特殊波动等级 (H-Level)";

    // Enhanced volume plan fields
    const mainGoal = context.mainGoal || '';
    const keyEvents = context.keyEvents || [];
    const cliffhanger = context.cliffhanger || '';
    const subplots = context.subplots || [];
    const foreshadowing = context.foreshadowing || [];
    const volumeOrder = context.volumeOrder || 1;

    // === EVENT PACING CALCULATION ===
    // Distribute key events across chapters to prevent repetition
    let eventPacingGuide = '';
    const eventCount = keyEvents.length;
    const chapterCount = totalChaptersInVolume;

    if (eventCount > 0 && chapterCount > 0) {
      if (chapterCount > eventCount) {
        // More chapters than events: distribute events across chapter ranges
        const chaptersPerEvent = Math.ceil(chapterCount / eventCount);
        eventPacingGuide = '\n**关键事件分配指南（必须严格遵守）**:\n';
        keyEvents.forEach((event, idx) => {
          const startCh = idx * chaptersPerEvent + 1;
          const endCh = Math.min((idx + 1) * chaptersPerEvent, chapterCount);
          if (startCh === endCh) {
            eventPacingGuide += `- 第 ${startCh} 章: 「${event}」的高潮/完成\n`;
          } else {
            eventPacingGuide += `- 第 ${startCh}-${endCh} 章: 围绕「${event}」展开（铺垫→发展→高潮）\n`;
          }
        });
        eventPacingGuide += '\n**重要提醒**: 每个关键事件应跨越多章逐步发展，而非在单章内完全结束。';
        eventPacingGuide += '\n多余的章节应用于：角色发展、关系深化、世界观补充、伏笔埋设、情感沉淀。';
      } else {
        // Equal or more events than chapters: assign events to chapters
        eventPacingGuide = '\n**关键事件分配指南**:\n';
        keyEvents.forEach((event, idx) => {
          const chapterIdx = Math.min(idx + 1, chapterCount);
          eventPacingGuide += `- 第 ${chapterIdx} 章: 「${event}」\n`;
        });
      }
    }

    // Build character context
    let characterContext = '';
    if (characters.length > 0) {
      characterContext = '<CharacterProfiles>\n';
      characters.forEach(c => {
        characterContext += `- ${c.name} (${c.role}): ${c.traits || c.bio || ''}\n`;
      });
      characterContext += '</CharacterProfiles>\n\n';
    }

    // Build subplot context for this volume
    let subplotContext = '';
    if (subplots.length > 0) {
      const relevantSubplots = subplots.filter(sp => {
        if (!sp.volumeRange) return true;
        const match = sp.volumeRange.match(/第(\d+)卷.*第(\d+)卷/);
        if (match) {
          const start = parseInt(match[1]);
          const end = parseInt(match[2]);
          return volumeOrder >= start && volumeOrder <= end;
        }
        return true;
      });
      if (relevantSubplots.length > 0) {
        subplotContext = '<本卷相关支线>\n';
        relevantSubplots.forEach(sp => {
          subplotContext += `- ${sp.name}: ${sp.description}\n`;
        });
        subplotContext += '</本卷相关支线>\n\n';
      }
    }

    // Build foreshadowing context for this volume
    let foreshadowingContext = '';
    if (foreshadowing.length > 0) {
      const toPlant = foreshadowing.filter(f => f.plantVolume === volumeOrder);
      const toReveal = foreshadowing.filter(f => f.revealVolume === volumeOrder);
      if (toPlant.length > 0 || toReveal.length > 0) {
        foreshadowingContext = '<伏笔任务>\n';
        toPlant.forEach(f => {
          foreshadowingContext += `- [埋设] ${f.hint} (${f.importance === 'major' ? '主线伏笔' : '细节彩蛋'})\n`;
        });
        toReveal.forEach(f => {
          foreshadowingContext += `- [揭示] ${f.hint} (${f.importance === 'major' ? '主线伏笔' : '细节彩蛋'})\n`;
        });
        foreshadowingContext += '</伏笔任务>\n\n';
      }
    }

    const prompt = `基于核心大纲和当前卷信息，生成第 ${startChapter} 章的大纲。

**核心大纲**:
${JSON.stringify(coreOutline, null, 2)}

**当前卷**: ${volumeTitle}
**卷简介**: ${volumeDesc}
**本卷叙事目标**: ${mainGoal || '无'}
**本卷关键事件**: ${keyEvents.length > 0 ? keyEvents.join('、') : '无'}${eventPacingGuide}
**本卷悬念**: ${cliffhanger || '无'}
${subplotContext}${foreshadowingContext}**上一章概要**: ${previousChaptersSummary || '无'}
**下一章概要**: ${nextChapterSummary || '无'}
**${systemName}**: ${passionLevel}/5
**${systemName}定义**:
${passionDefinitions[passionLevel] || '无特殊定义'}

**生成要求**:
1. 严格遵循 JSON 格式返回。
2. 这一章是本卷的第 ${currentChapterCount + 1} 章（共 ${totalChaptersInVolume} 章）。
3. ${isLastChapterOfVolume ? `这是本卷的最后一章，必须包含本卷的高潮或结局。${cliffhanger ? `结尾需要呼应悬念："${cliffhanger}"` : ''}` : '这是本卷的中间章节，请保持情节推进。'}
4. 如果有"伏笔任务"，必须在章节中安排相应的埋设或揭示环节。
5. 严格按照"${systemName}: ${passionLevel}"的强度进行构思。${passionDefinitions[passionLevel] ? `定义参考：${passionDefinitions[passionLevel]}` : ''}
   请严格遵循该等级定义，调整章节内容的描写风格和强度。

**章节标题命名原则**:
- 4-10字为宜，简洁有力
- 风格应与小说类型匹配（参考核心大纲中的类型）
- 应暗示本章核心冲突或情感转折，但不剧透结果
- 避免平铺直叙（如"主角去学校"、"反派出现了"）

返回格式：
{
  "chapters": [
    {
      "title": "章节标题(4-10字,简洁有力,暗示核心冲突)",
      "oneSentence": "一句话概括本章核心剧情（20字以内）",
      "summary": "详细摘要（200-500字，包含具体地点、人物、事件，拒绝空泛描述）",
      "keyEvents": ["事件1", "事件2"],
      "characters": ["出场角色"],
      "pacing": "节奏"
    }
  ]
}`;
    const progress = (currentChapterCount + 1) / totalChaptersInVolume;
    let narrativeStage = "发展阶段";
    let pacingGuidance = "推进主线剧情、深化角色关系。";

    if (isLastChapterOfVolume) {
      narrativeStage = "高潮收尾阶段";
      pacingGuidance = "达到情节高潮、解决核心冲突、给出阶段性结局。节奏先快后缓，确保完整性。";
    } else if (progress < 0.25) {
      narrativeStage = "开篇阶段";
      pacingGuidance = "建立世界观、引入角色、埋下伏笔、设置初始冲突。节奏相对从容。";
    } else if (progress < 0.5) {
      narrativeStage = "发展阶段";
      pacingGuidance = "推进主线剧情、深化角色关系、逐步揭示真相。节奏稳步加快。";
    } else if (progress < 0.75) {
      narrativeStage = "加速阶段";
      pacingGuidance = "冲突升级、危机迭起、角色面临重大选择。节奏明显加快，保持紧张感。";
    } else {
      narrativeStage = "高潮准备阶段";
      pacingGuidance = "为最终高潮做准备、各条线索汇聚、矛盾达到顶点前夕。节奏紧凑，蓄势待发。";
    }

    const systemPrompt = `你是一位严谨的小说策划师。请严格基于提供的【核心大纲】和【分卷信息】规划章节梗概。
**严禁**引入大纲中不存在的世界观、技术或设定。
**严禁**生成通用的、毫无特色的剧情。
**严禁**在本章大纲中概括整个分卷的剧情。只关注**当前章节**应发生的具体事件。

**严禁内容重复（最重要）**:
- 每章必须有独特的剧情推进点，不允许多章重复描述同一事件
- 若章节数多于关键事件数，必须在事件之间加入「过渡章节」
- 过渡章节应包含：角色发展/关系深化、世界观补充/伏笔埋设、情感沉淀/悬念升级
- 禁止生成「主角继续XXX」「再次XXX」等重复性描述

**关键上下文（必须严格遵守）**：
- 当前章节：第 ${startChapter} 章
- 本卷总章节：${totalChaptersInVolume} 章
- 进度：${Math.round(progress * 100)}%
- 叙事阶段：${narrativeStage}
- 节奏指导：${pacingGuidance}

**特殊波动等级 (H-Level)**: ${passionLevel}/5
定义：${passionDefinitions[passionLevel] || ''}
请根据此等级调整剧情中的情感张力和描写尺度。

每一章都必须紧扣分卷目标，同时推进核心大纲中的主线。
请根据"叙事阶段"精准定位本章的剧情功能（如：开篇铺垫、冲突升级、高潮爆发等），避免剧情雷同或节奏错位。

**章节标题命名原则**:
- 4-10字为宜，简洁有力
- 风格应与小说类型匹配（参考核心大纲中的类型）
- 应暗示本章核心冲突或情感转折，但不剧透结果
- 避免平铺直叙（如"主角去学校"、"反派出现了"）

输出格式 (JSON):
{
  "chapters": [
    {
      "order": 1,
      "title": "章节标题(4-10字,简洁有力,暗示核心冲突)",
      "oneSentence": "一句话概括本章核心剧情（20字以内）",
      "summary": "章节主要剧情梗概（200-500字，包含具体的地点、人物和事件，拒绝空泛描述）",
      "mainConflict": "主要冲突"
    }
  ]
}`;

    let userPrompt = `${characterContext}<CoreOutline>
${coreOutline}
</CoreOutline>

<VolumeInfo>
Title: ${volumeTitle}
Description & KeyEvents:
${volumeDesc}
Chapter Range: ${startChapter} - ${startChapter + count - 1} (Total ${totalChaptersInVolume} in Volume)
</VolumeInfo>
`;

    if (previousChaptersSummary) {
      userPrompt += `<PreviousContext>
The story so far (recent chapters):
${previousChaptersSummary}
</PreviousContext>
`;
    }

    if (nextChapterSummary) {
      userPrompt += `<NextContext>
The following chapter (Chapter ${startChapter + count}):
${nextChapterSummary}
**Constraint**: You MUST bridge the gap between the Previous Context and this Next Context. Ensure a seamless transition and do not contradict future events.
</NextContext>
`;
    }

    userPrompt += `<Task>
      Plan ${count} chapters starting from Chapter ${startChapter}.
      Ensure the plot progression matches the Volume Info provided above.
      Ensure continuity with the Previous Context if provided.
      ${isLastChapterOfVolume ? `
      **IMPORTANT**: This is the LAST chapter of the volume. 
      1. Provide a satisfying conclusion to the volume's main arc.
      2. Resolve key conflicts introduced in this volume.
      3. Set up hooks/cliffhangers for the next volume.
      ` : ''}
      </Task>`;

    try {
      const result = await openai.generateText(userPrompt, systemPrompt, {
        response_format: { type: 'json_object' },
        temperature: 0.5,
        feature: 'planner',
        signal: context.signal,
        projectId: context.projectId
      });

      // Log the interaction
      if (context.projectId) {
        await PromptLogger.log({
          projectId: context.projectId,
          agent: 'PlannerAgent',
          action: 'generateVolumeChapterOutlines',
          modules: {
            system: systemPrompt,
            context: {
              volumeTitle,
              volumeDesc,
              startChapter,
              count,
              passionLevel,
              narrativeStage
            },
            instruction: userPrompt
          },
          fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
          response: result,
          model: (await openai.getFeatureConfig('planner', context.projectId)).model || 'unknown',
          taskId: context.taskId || uuidv4(),
          taskName: context.taskName || `分卷章节大纲生成 (${startChapter}-${startChapter + count - 1})`
        });
      }

      let clean = result;

      // Robust cleanup: strip markdown code blocks
      if (typeof clean === 'string') {
        // Remove code blocks
        if (clean.includes('```')) {
          clean = clean.replace(/```json\n?|```\n?|```/g, '');
        }

        // Try to extract JSON object if response contains other markdown/text
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          clean = jsonMatch[0];
        }
      }

      try {
        return JSON.parse(clean);
      } catch (parseError) {
        console.error('Failed to parse volume chapter outlines:', parseError);
        console.error('Raw response (first 500 chars):', result?.substring?.(0, 500));
        // Return empty chapters to prevent duplicate generation attempts
        return { chapters: [] };
      }
    } catch (error) {
      console.error('Failed to generate volume chapter outlines', error);
      return { chapters: [] };
    }
  }

  async generateChapterScenes(context) {
    const volumeTheme = context.volumeTheme || '';
    const chapterOrder = context.chapterOrder || 1;
    const constraints = context.constraints || '';
    const chapterSummary = context.chapterSummary || '';
    const coreOutline = context.coreOutline || '';
    const rewritePrompt = context.rewritePrompt || '';
    const characters = context.characters || [];

    // New parameters
    const isLastChapterOfVolume = context.isLastChapterOfVolume || false;
    const totalChaptersInVolume = context.totalChaptersInVolume || 20;
    const nextChapterSummary = context.nextChapterSummary || '';
    const passionLevel = context.passionLevel || 1;
    const passionDefinitions = context.passionDefinitions || {};

    // Enhanced Context
    const previousChaptersSummary = context.previousChaptersSummary || '';
    const volumeProgress = context.volumeProgress || '';
    const characterStates = context.characterStates || '';

    // Build character context
    let characterContext = '';
    if (characters.length > 0) {
      characterContext = '<CharacterProfiles>\n';
      characters.forEach(c => {
        characterContext += `- ${c.name} (${c.role}): ${c.traits || c.bio || ''}\n`;
      });
      characterContext += '</CharacterProfiles>\n\n';
      characterContext += '<CharacterGuidance>\n';
      characterContext += '请根据剧情需要，从上述角色中选择合适的角色出场。\n';
      characterContext += '- 主角通常会在大部分章节出场\n';
      characterContext += '- 配角和次要角色按剧情需要出场\n';
      characterContext += '- 不必强制所有角色都出场\n';
      characterContext += '- 保持角色出场的自然性和合理性\n';
      characterContext += '</CharacterGuidance>\n\n';
    }

    // Calculate narrative stage with improved logic
    // If chapter exceeds the planned volume range, cap the progress at 0.9 to avoid "收尾" stage
    const effectiveTotal = totalChaptersInVolume || 20;
    let progress = chapterOrder / effectiveTotal;

    // If this chapter is beyond the planned range, treat it as an extension
    if (chapterOrder > effectiveTotal) {
      progress = 0.75; // Treat as "加速阶段" to maintain momentum
    }

    let narrativeStage = "发展阶段";
    // Only use "收尾" stage if explicitly marked as last chapter AND within reasonable range
    if (isLastChapterOfVolume && chapterOrder <= effectiveTotal) {
      narrativeStage = "高潮收尾阶段";
    } else if (progress < 0.25) {
      narrativeStage = "开篇阶段";
    } else if (progress < 0.5) {
      narrativeStage = "发展阶段";
    } else if (progress < 0.75) {
      narrativeStage = "加速阶段";
    } else {
      narrativeStage = "高潮准备阶段";
    }

    const systemName = passionDefinitions.systemName || "特殊波动等级 (H-Level)";

    // **场景数量控制**：
    // Dynamic scene count based on target length (if provided)
    const targetLength = context.targetLength || 3000;
    // Estimate scenes: ~1000-1500 words per scene is reasonable for high quality
    let minScenes = 3;
    let maxScenes = 5;

    if (targetLength > 6000) {
      minScenes = 6;
      maxScenes = 9;
    } else if (targetLength > 4000) {
      minScenes = 4;
      maxScenes = 7;
    }

    const sceneGuidance = `
**场景数量控制**:
- 目标字数: ${targetLength} 字
- 建议场景数: ${minScenes}-${maxScenes} 个
- 根据剧情复杂度合理分配场景
- 避免场景过多导致篇幅失控`;

    const systemPrompt = `你是一位严谨的小说主编。请根据【核心大纲】、【分卷信息】和【本章梗概】生成详细的场景列表。
**绝对禁止**幻觉：不要生成大纲中没有的科幻/奇幻元素（除非大纲明确设定）。
场景必须围绕本章梗概展开，落实到具体的地点和动作。
不预设场景数量，由你根据剧情需要自行决定。
${sceneGuidance}

**章节位置感知**：
当前章节：第 ${chapterOrder} 章
本卷进度：${volumeProgress}
本卷总章节：${totalChaptersInVolume} 章
叙事阶段：${narrativeStage}

**${systemName}**: ${passionLevel}/5
定义：${passionDefinitions[passionLevel] || ''}
请严格遵循上述等级定义，调整场景的描写风格和内容强度。

输出格式 (JSON):
{"scenes":[{"id":"scene_1","location":"场景地点","characters":["角色A","角色B"],"action":"主要动作/事件","conflict":"场景冲突","outcome":"场景结果"}]}`;

    let userPrompt = `${characterContext}<CoreOutline>
${coreOutline}
</CoreOutline>

<VolumeInfo>
${volumeTheme}
</VolumeInfo>

<ChapterRequirement>
Chapter Order: ${chapterOrder}
Volume Progress: ${volumeProgress}
${isLastChapterOfVolume ? '**IMPORTANT**: This is the LAST chapter of the volume. Ensure scenes build to a climax/resolution.' : ''}
</ChapterRequirement>

<CharacterStates>
${characterStates}
</CharacterStates>

<PreviousContext>
${previousChaptersSummary}
</PreviousContext>
`;

    if (chapterSummary) {
      userPrompt += `<ChapterSummary>
${chapterSummary}
</ChapterSummary>
`;
    } else {
      userPrompt += `<Warning>
No specific chapter summary provided. Please infer from the Volume Info and Core Outline, ensuring continuity.
</Warning>
`;
    }

    if (nextChapterSummary) {
      userPrompt += `<NextContext>
The following chapter summary:
${nextChapterSummary}
**Constraint**: Ensure the scenes in this chapter naturally lead into the events of the next chapter.
</NextContext>
`;
    }

    userPrompt += `<Constraints>
${constraints}
</Constraints>`;

    if (rewritePrompt) {
      userPrompt += `
<RewriteRequirements>
${rewritePrompt}
</RewriteRequirements>`;
    }

    const result = await openai.generateText(userPrompt, systemPrompt, {
      response_format: { type: 'json_object' },
      temperature: 0.3,
      feature: 'planner',
      signal: context.signal,
      projectId: context.projectId
    });

    // Log the interaction
    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'PlannerAgent',
        action: 'generateChapterScenes',
        modules: {
          system: systemPrompt,
          context: {
            volumeTheme,
            chapterOrder,
            chapterSummary: chapterSummary ? chapterSummary.substring(0, 100) + '...' : 'none',
            passionLevel,
            narrativeStage
          },
          instruction: userPrompt
        },
        fullPrompt: `${systemPrompt}\n\n${userPrompt}`,
        response: result,
        model: (await openai.getFeatureConfig('planner', context.projectId)).model || 'unknown',
        taskId: context.taskId || uuidv4(),
        taskName: context.taskName || `章节细纲生成 (Ch.${chapterOrder})`
      });
    }

    return result;
  }

  async analyzeDeviation(context) {
    const scenes = context.scenes || '';
    const draft = context.draft || '';
    const prompt = `对比章节细纲与初稿，分析剧情偏差并给出改进建议。

细纲：
${JSON.stringify(scenes, null, 2)}

初稿：
${draft}

请分析：
1. 哪些地方与细纲不符（具体指出）
2. 如何修正这些偏差（给出具体建议）
3. 哪些地方写得好，应该保留
4. 给出总体评分（1-10分）

返回JSON格式：
{
"score": 8,
"analysis": "总体评价概述...",
"deviations": [
  {
    "issue": "具体的偏差问题",
    "location": "在初稿的哪个部分",
    "suggestion": "如何修正"
  }
],
"strengths": ["初稿中写得好的地方"],
"detailedOverallAssessment": "详细的总体评价"
}`;

    const systemPrompt = '你是主编，评估初稿与细纲的一致性。只返回JSON，不要有其他文字。';
    const text = await openai.generateText(prompt, systemPrompt, { temperature: 0.2, feature: 'planner', projectId: context.projectId });

    // Log the interaction
    if (context.projectId) {
      try {
        const config = await openai.getFeatureConfig('planner', context.projectId);
        await PromptLogger.log({
          projectId: context.projectId,
          agent: 'PlannerAgent',
          action: 'analyzeDeviation',
          modules: {
            system: systemPrompt,
            context: { scenesCount: Array.isArray(scenes) ? scenes.length : 'unknown', draftLength: draft.length },
            instruction: prompt
          },
          fullPrompt: `${systemPrompt}\n\n${prompt}`,
          response: text,
          model: config.model || 'unknown',
          taskId: context.taskId || uuidv4(),
          taskName: context.taskName || '偏差分析 (Deviation Analysis)'
        });
      } catch (err) {
        console.error('Failed to log prompt:', err);
      }
    }

    try {
      let clean = text;
      if (clean.includes('```')) clean = clean.replace(/```json\n?|```\n?|```/g, '');
      return JSON.parse(clean);
    } catch {
      return {
        deviations: [],
        strengths: [],
        overallAssessment: text
      };
    }
  }

  async detectHighlights(context) {
    const draft = context.draft || '';
    const prompt = `从初稿中提取亮点与可强化元素(场景/意象/对白/冲突)，返回JSON：{"highlights":["..."],"strengthen":["..."]}`;
    const systemPrompt = '你是主编，提炼作品亮点与可强化元素。只返回JSON。';
    const text = await openai.generateText(prompt, systemPrompt, { temperature: 0.3, feature: 'planner', projectId: context.projectId });

    // Log the interaction
    if (context.projectId) {
      try {
        const config = await openai.getFeatureConfig('planner', context.projectId);
        await PromptLogger.log({
          projectId: context.projectId,
          agent: 'PlannerAgent',
          action: 'detectHighlights',
          modules: {
            system: systemPrompt,
            context: { draftLength: draft.length },
            instruction: prompt
          },
          fullPrompt: `${systemPrompt}\n\n${prompt}`,
          response: text,
          model: config.model || 'unknown',
          taskId: context.taskId || uuidv4(),
          taskName: context.taskName || '亮点提取 (Highlights Detection)'
        });
      } catch (err) {
        console.error('Failed to log prompt:', err);
      }
    }

    try {
      let clean = text;
      if (clean.includes('```')) clean = clean.replace(/```json\n?|```\n?|```/g, '');
      const parsed = JSON.parse(clean);
      return parsed.highlights || [];
    } catch {
      return [];
    }
  }

  async updateOutline(context) {
    const coreOutline = context.coreOutline || '';
    const changes = context.changes || '';
    const prompt = `基于变更说明更新核心大纲：\n变更：${changes}\n\n原大纲：\n${coreOutline}`;
    const systemPrompt = '你是主编，负责维护核心大纲的连续一致性。返回更新后的大纲文本。';
    const result = await openai.generateText(prompt, systemPrompt, { temperature: 0.2, feature: 'planner' });

    // Log to Prompt Inspector
    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'PlannerAgent',
        action: '更新核心大纲',
        modules: {
          system: systemPrompt,
          context: { changes },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: result,
        model: (await openai.getFeatureConfig('planner')).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName
      });
    }

    return result;
  }

  async generateDecisionOptions(context) {
    const plan = context.plan || '';
    const prompt = `基于如下章节计划提出3个剧情发展方向，每个方向简述目标、冲突与结尾钩子，返回JSON数组：[{"title":"","outline":""},...]：\n${plan}`;
    const systemPrompt = '你是主编，提供可选的剧情分支方向。只返回JSON数组。';
    const text = await openai.generateText(prompt, systemPrompt, { temperature: 0.4, feature: 'planner' });

    // Log to Prompt Inspector
    if (context.projectId) {
      await PromptLogger.log({
        projectId: context.projectId,
        agent: 'PlannerAgent',
        action: '生成剧情分支选项',
        modules: {
          system: systemPrompt,
          context: { planLength: plan.length },
          instruction: prompt
        },
        fullPrompt: `${systemPrompt}\n\n${prompt}`,
        response: text,
        model: (await openai.getFeatureConfig('planner')).model || 'unknown',
        taskId: context.taskId,
        taskName: context.taskName
      });
    }

    try {
      let clean = text;
      if (clean.includes('```')) clean = clean.replace(/```json\n?|```\n?|```/g, '');
      return JSON.parse(clean);
    } catch {
      return [{ title: '默认方向', outline: plan }];
    }
  }

  async createChapterOutline(context) {
    const systemPrompt = `你是一位专家级的小说策划师。请根据提供的上下文为特定章节创建详细的场景列表。
**绝对禁止**幻觉：不要生成大纲中没有的科幻/奇幻元素（除非大纲明确设定）。
场景必须围绕本章梗概展开，落实到具体的地点和动作。
不预设场景数量，由你根据剧情需要自行决定。

输出格式 (JSON):
{
  "scenes": [
    {
      "id": "scene_1",
      "location": "场景地点",
      "characters": ["角色A", "角色B"],
      "action": "主要动作/事件",
      "conflict": "场景冲突",
      "outcome": "场景结果"
    }
  ]
}`;
    const userPrompt = `上下文: ${JSON.stringify(context)}`;
    const text = await openai.generateText(userPrompt, systemPrompt, { response_format: { type: 'json_object' }, temperature: 0.3, feature: 'planner' });
    try {
      let clean = text;
      if (typeof clean === 'string' && clean.includes('```')) clean = clean.replace(/```json\n?|```\n?|```/g, '');
      return JSON.parse(clean);
    } catch (error) {
      throw error;
    }
  }

  async regenerateSingleVolume(context) {
    const { coreOutline, targetVolume, previousVolume, nextVolume, guidance } = context;

    const systemPrompt = `你是一位专家级的小说策划师。你的目标是重新规划小说中的某一卷。
请确保新规划的分卷在剧情上与前一卷（如果有）自然衔接，并为后一卷（如果有）做好铺垫。
严格遵循核心大纲的整体设定。

输出格式 (JSON):
{
  "title": "分卷标题",
  "summary": "分卷摘要",
  "mainGoal": "本卷主要目标",
  "keyEvents": ["关键事件1", "关键事件2"]
}`;

    let userPrompt = `<CoreOutline>
${typeof coreOutline === 'string' ? coreOutline : JSON.stringify(coreOutline, null, 2)}
</CoreOutline>

<TargetVolume>
${JSON.stringify({ order: targetVolume?.order, title: targetVolume?.name, summary: targetVolume?.description, mainGoal: targetVolume?.goal }, null, 2)}
</TargetVolume>
`;
    if (previousVolume) {
      userPrompt += `
<PreviousVolume>
${JSON.stringify({ order: previousVolume.order, title: previousVolume.name, summary: previousVolume.description, mainGoal: previousVolume.goal }, null, 2)}
</PreviousVolume>
`;
    }
    if (nextVolume) {
      userPrompt += `
<NextVolume>
${JSON.stringify({ order: nextVolume.order, title: nextVolume.name, summary: nextVolume.description, mainGoal: nextVolume.goal }, null, 2)}
</NextVolume>
`;
    }
    if (guidance) {
      userPrompt += `
<Guidance>
${guidance}
</Guidance>
`;
    }

    const text = await openai.generateText(userPrompt, systemPrompt, { response_format: { type: 'json_object' }, temperature: 0.5, feature: 'planner' });
    try {
      let clean = text;
      if (typeof clean === 'string' && clean.includes('```')) clean = clean.replace(/```json\n?|```\n?|```/g, '');
      return JSON.parse(clean);
    } catch (error) {
      throw error;
    }
  }
}
