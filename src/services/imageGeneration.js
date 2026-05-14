/**
 * Image Generation Service
 * 用于角色头像/立绘生成
 */

import { storage } from './storage';
import { PromptLogger } from './PromptLogger';
import { openai } from './openai';

const IMAGES_API = '/api/images';

function buildImageGenerationsUrl(baseUrl = 'https://api.tu-zi.com') {
    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const versionedBaseUrl = cleanBaseUrl.endsWith('/v1') ? cleanBaseUrl : `${cleanBaseUrl}/v1`;
    return `${versionedBaseUrl}/images/generations`;
}

function normalizeImageInputs(image) {
    if (!image) return undefined;
    return Array.isArray(image) ? image.filter(Boolean) : [image].filter(Boolean);
}

/**
 * 上传图像到服务器
 * @param {string} type - 图像类型（characters, covers, prompt_logs）
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
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to upload image');
    }
    const result = await response.json();
    return result.url;
}

/**
 * 将图片 URL 转换为 Base64 Data URL
 * 用于从外部 URL 下载图像后上传到本地服务器
 */
async function urlToBase64(url) {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Failed to convert URL to Base64:', error);
        return url;
    }
}

// LLM 封面设计师 System Prompt
// LLM 封面设计师 System Prompt
const COVER_DESIGNER_SYSTEM_PROMPT = `You are an elite Art Director. Your goal is to create **VISUALLY ARRESTING**, **MODERN**, and **HIGH-IMPACT** cover art. 
Avoid "boring", "quiet", or "vintage" looks unless absolutely necessary. We want **BOLDNESS**.

## 1. Visual Path Selection (MODERN & IMPACTFUL)

### Path A: Modern Cinematic (The "Netflix/HBO" Look)
*Target*: Thriller, Urban Fantasy, Realistic Fiction.
*Keywords*: "8k resolution", "anamorphic lens", "color graded", "moody lighting", "hyper-realistic", "fine detail".
*Vibe*: High-budget movie poster. Sharp, crisp, intense.

### Path B: Graphic Surrealism (The "A24" Look)
*Target*: Literary, Sci-Fi, Speculative.
*Keywords*: "Visual metaphor", "minimalist composition", "bold color block", "double exposure", "impossible geometry".
*Vibe*: Intellectual, strange, memorable.

### Path C: Neo-Artistic (The "Gallery" Look)
*Target*: Romance, YA, Historical.
*Keywords*: "Mixed media", "contemporary collage", "digital impasto", "abstract expressionism", "vibrant color palette".
*Vibe*: Modern art gallery, not an old museum.

### Path D1: Classical East Asian (Ancient/Fantasy) ⭐ FOR 仙侠/武侠/古代
*Target*: Xianxia, Wuxia, Chinese Historical, Ancient Fantasy.
*Keywords*: "Chinese ink wash influence", "jade green, vermillion red, ink black, gold accents", "traditional architecture silhouettes", "atmospheric fog and mist", "dynamic calligraphic flow", "silk and brocade textures", "soft diffused Eastern lighting".
*Lighting*: Soft diffused light, morning mist, lantern glow, moonlight through clouds.
*Architecture/Environment*: Eaves, lattice windows, pagodas, mountains, bamboo, lotus, ancient courtyards.
*Vibe*: Zhang Yimou epics, high-end Chinese fantasy production. Elegant, poetic, culturally authentic.

### Path D2: Modern Asian (Contemporary) ⭐ FOR 现代都市/青春文学/言情
*Target*: Modern Chinese Urban, Youth Literature, Contemporary Romance, Slice of Life.
*Keywords*: "Contemporary Asian cityscape", "neon-lit Asian streets", "soft natural lighting", "warm intimate atmosphere", "modern East Asian fashion", "clean minimalist aesthetic".
*Color Palette*: Warm naturals, soft pastels, cozy earth tones. Modern but NOT Western-default.
*Lighting*: Warm golden hour, soft window light, city night glow, café ambiance.
*Architecture/Environment*: Modern Asian apartment, coffee shop, university campus, city streets with Asian signage, cherry blossoms/ginkgo trees.
*Vibe*: Contemporary Korean/Chinese drama aesthetics, indie film warmth. Relatable, youthful, emotionally resonant. Think "Us and Them" (后来的我们), modern C-drama visuals.

## 2. CULTURAL ADAPTATION RULE (CRITICAL!)
**For Classical East Asian (Path D1)** - Use when:
- Genre: 玄幻, 仙侠, 武侠, 修仙, 历史
- World setting: 古代, 朝代, 江湖, 修真, 灵气, 仙, 武林
- Keywords: xianxia, wuxia, cultivation, ancient China

**For Modern Asian (Path D2)** - Use when:
- Genre: 现实主义, 成长小说, 言情, 青春文学
- World setting: 现代, 都市, 大学, 职场, 当代
- Character names are Chinese but setting is modern/contemporary

**DO NOT default to Western aesthetics for Chinese novels!** When in doubt about era, check if world setting mentions modern elements.

## 2.5 STORY ALIGNMENT RULE (HIGHEST PRIORITY)
The cover must be visually loyal to the actual novel, not merely beautiful.
- Identify the exact genre, era, culture, social setting, protagonist conflict, emotional tone, and core theme from the input.
- Every subject, costume, environment, color, and symbol must be explainable from the novel context.
- Do NOT invent unrelated characters, unrelated romantic couples, unrelated fantasy elements, unrelated modern fashion, or western-default aesthetics.
- If the story is Chinese or East Asian, preserve East Asian cultural and facial-feature cues unless the outline explicitly says otherwise.
- If the protagonist is described as a student, worker, cultivator, detective, aristocrat, etc., the generated subject must visually communicate that role.
- The final prompt must include a sentence beginning with "Story fidelity lock:" that lists the must-not-violate visual constraints.
- The final prompt must include "Cover subject:", "Symbolic motif:", "Setting fidelity:", and "Avoid:" clauses.
- A standard attractive portrait is only allowed when the novel is explicitly character-portrait driven. Otherwise prefer a narrative scene, symbolic object, fragmented body detail, reflection, silhouette, or environmental metaphor.

## 3. Impact Boosters (MANDATORY)
- **Extreme Scale Contrast**: Create drama through size difference.
    - *Option A (The Ant)*: Tiny human vs. Massive Structure (skyscraper, mountain, machine).
    - *Option B (The Giant)*: Macro close-up of a human part (eye, hand, lips) vs. Tiny background elements (cars like bugs, distant city).
    - *Option C (The Void)*: Small subject in a vast, empty negative space.
    - *Goal*: Avoid "mid-shots". Go extreme.
- **Dynamic Perspective**: Use "Worm's eye view" (looking up), "Bird's eye view" (looking down), or "Dutch angle".


## 4. Composition: The "Poster" Rule
- **Kill the Center**: Push subjects to the edges.
- **Negative Space**: Leave 50% empty space for typography.
- **Simplification**: Remove background clutter. One clear subject is better than a messy scene.

## 5. Narrative Subject Control (Anti-Idol)
- **Fragmented**: Show a hand, a back, a reflection. PROHIBIT standard portraits.
- **Action/State**: The subject should be interacting with the environment (drowning, running, hiding), not posing.

## 6. Output Format (JSON Only)
{
  "style": "Modern Cinematic / Graphic Surrealism / Neo-Artistic / Classical East Asian / Modern Asian",
  "reason": "Why this creates maximum visual impact",
  "prompt": "Detailed prompt. MUST include Cover subject, Symbolic motif, Setting fidelity, Story fidelity lock, and 'scale contrast' or 'dynamic perspective' elements. For East Asian novels, MUST include specific Eastern visual keywords.",
  "negative": "low resolution, blurry, dull colors, vintage photo, messy background, text, watermark"
}

## 7. CRITICAL RULES
1. **NO VINTAGE FILTERS**: Unless it's a 1920s story, avoid "sepia", "faded", or "retro". Make it look NEW.
2. **NO BORING ANGLES**: Every shot must be dramatic.
3. **NO TEXT**: Absolutely NO text in the image.
4. **CULTURAL MATCH**: For Chinese novels, avoid Western-default elements (blonde hair, blue eyes, European architecture, Mediterranean lighting).`;

/**
 * 使用 LLM 生成专业封面设计提示词
 * @param {Object} project - 项目数据
 * @param {Object} outline - 核心大纲数据
 * @param {Object} options - 大纲选项
 * @returns {Promise<{ coverPrompt: string, stylePrompt: string, designStyle: string }>}
 */
export async function generateCoverPromptWithLLM(project = {}, outline = {}, options = {}) {
    // 构建小说信息摘要给 LLM
    const novelInfo = [];
    const brief = buildCoverCreativeBrief(project, outline, options);
    const subjectStrategy = buildCoverSubjectStrategy(brief);

    if (project.name) novelInfo.push(`Title: ${project.name}`);
    if (options.novelType) novelInfo.push(`Genre: ${options.novelType}`);
    if (options.tone) novelInfo.push(`Tone/Mood: ${options.tone}`);
    if (getPrimaryTheme(outline)) novelInfo.push(`Theme: ${getPrimaryTheme(outline)}`);
    if (outline.coreConflict) novelInfo.push(`Core Conflict: ${outline.coreConflict}`);
    if (outline.logline) novelInfo.push(`Synopsis: ${outline.logline}`);

    const worldDesc = getWorldDescription(outline);
    if (worldDesc) novelInfo.push(`World Setting: ${worldDesc.substring(0, 300)}`);

    // 主角信息
    const protagonist = getProtagonist(outline);
    if (protagonist) {
        const charInfo = [protagonist.name, protagonist.role, protagonist.appearance, protagonist.personality, protagonist.goal, protagonist.arc].filter(Boolean).join(', ');
        novelInfo.push(`Protagonist: ${charInfo.substring(0, 280)}`);
    }

    if (options.targetAudience) {
        const audience = Array.isArray(options.targetAudience) ? options.targetAudience.join(', ') : options.targetAudience;
        novelInfo.push(`Target Audience: ${audience}`);
    }

    const userPrompt = `Analyze this novel and generate a professional book cover design prompt from this creative brief:

<RawNovelInfo>
${novelInfo.join('\n')}
</RawNovelInfo>

<CoverCreativeBrief>
${formatCoverCreativeBrief(brief)}
</CoverCreativeBrief>

<SubjectStrategy>
${subjectStrategy}
</SubjectStrategy>

Choose the most fitting design tradition and create an artistic, sophisticated cover prompt.

Critical:
- The generated image must be faithful to the novel's theme, era, culture, social setting, and protagonist conflict.
- Do not create a generic attractive character, unrelated genre image, random couple, or decorative cover with no narrative function.
- The output prompt must explicitly contain: Cover subject, Symbolic motif, Setting fidelity, Story fidelity lock, Avoid.
- Choose one strong cover concept, not a collage of many unrelated elements.`;

    try {
        const response = await openai.generateText(userPrompt, COVER_DESIGNER_SYSTEM_PROMPT, {
            feature: 'coverDesign',
            projectId: project?.id,
            temperature: 0.7,
            max_tokens: 800,
            response_format: { type: 'json_object' }
        });

        // 获取使用的模型配置
        let modelName = 'LLM';
        try {
            const config = await openai.getFeatureConfig('coverDesign', project?.id);
            if (config && config.model) {
                modelName = config.model;
            }
        } catch (e) {
            console.warn('Failed to resolve model name for logging', e);
        }

        // 解析 JSON 响应
        const result = JSON.parse(response);

        // 记录到 PromptLogger
        if (project?.id) {
            try {
                // 合并 System Prompt 和 User Prompt 以便完整记录
                const combinedPrompt = `=== SYSTEM PROMPT ===\n${COVER_DESIGNER_SYSTEM_PROMPT}\n\n=== USER PROMPT ===\n${userPrompt}`;

                await PromptLogger.log({
                    projectId: project.id,
                    agent: 'CoverDesigner',
                    action: `设计封面提示词 (${result.style || 'Custom'})`,
                    taskId: 'image-generation',
                    taskName: '图像生成/封面设计',
                    modules: {
                        context: { novelInfo: novelInfo.join('\n') }
                    },
                    fullPrompt: combinedPrompt,
                    response: JSON.stringify(result, null, 2),
                    model: modelName
                });
            } catch (logError) {
                console.warn('Failed to log cover prompt generation:', logError);
            }
        }

        // 组合提示词
        const coverPrompt = result.prompt || '';
        const stylePrompt = result.negative
            ? `${result.negative}, absolutely NO TEXT, NO TITLE, NO LETTERS, NO WORDS, NO TYPOGRAPHY`
            : 'absolutely NO TEXT, NO TITLE, NO LETTERS, NO WORDS, NO TYPOGRAPHY';

        return {
            coverPrompt,
            stylePrompt: `high quality, professional book cover, ${stylePrompt}`,
            designStyle: result.style || 'Custom',
            reason: result.reason || ''
        };
    } catch (error) {
        console.error('LLM cover prompt generation failed:', error);
        // 回退到本地生成
        const fallback = buildCoverPrompt(project, outline, options);
        return {
            ...fallback,
            designStyle: 'Fallback',
            reason: 'LLM generation failed, using local fallback'
        };
    }
}


// 小说类型到视觉风格的映射
const NOVEL_TYPE_STYLES = {
    '玄幻': 'ancient Chinese fantasy style, ethereal atmosphere, mystical lighting, flowing robes, intricate details',
    '仙侠': 'xianxia immortal cultivation style, celestial aura, traditional Chinese elements, ethereal beauty',
    '现实主义': 'cinematic photography, realistic portrait, natural lighting, contemporary setting',
    '成长小说': 'natural lighting, youthful atmosphere, slice of life aesthetic, soft tones',
    '悬疑犯罪': 'noir style, dramatic shadows, moody atmosphere, mysterious expression',
    '言情': 'soft romantic lighting, warm tones, elegant style, dreamy atmosphere',
    '科幻': 'futuristic sci-fi style, neon lighting, high-tech elements, cyberpunk aesthetic',
    '历史': 'historical period costume, classical style, period-accurate details, traditional setting',
    '其他': 'cinematic portrait, professional photography, natural lighting'
};

// 情感基调到光影色调的映射
const TONE_STYLES = {
    '轻松幽默': 'bright cheerful lighting, warm colors, friendly expression',
    '温馨治愈': 'soft warm lighting, gentle tones, kind expression',
    '紧张悬疑': 'dramatic shadows, cool tones, intense gaze',
    '深沉内敛': 'subdued lighting, muted colors, contemplative expression',
    '厚重史诗': 'epic cinematic lighting, rich colors, dignified presence',
    '细腻抒情': 'delicate soft lighting, pastel tones, emotional depth'
};

function getWorldDescription(outline = {}) {
    const ws = outline.worldSetting || {};
    return ws.description || [ws.timePeriod, ws.location, ws.socialStructure, ws.technology, ws.supernaturalRules, ws.keyRules]
        .filter(Boolean)
        .join('，') || outline.worldNotes || '';
}

function getPrimaryTheme(outline = {}) {
    return outline.primaryTheme || outline.theme || (Array.isArray(outline.secondaryThemes) ? outline.secondaryThemes[0] : '') || '';
}

function getProtagonist(outline = {}) {
    if (!Array.isArray(outline.characters) || outline.characters.length === 0) return null;
    return outline.characters.find(c =>
        c.role === '主角' ||
        c.role === 'Protagonist' ||
        c.role?.includes?.('主角') ||
        c.role?.toLowerCase?.().includes('protagonist')
    ) || outline.characters[0];
}

function detectStoryEraAndCulture(outline = {}, options = {}) {
    const novelType = options.novelType || '';
    const worldDesc = getWorldDescription(outline);
    const combined = `${novelType} ${worldDesc} ${outline.logline || ''} ${outline.coreConflict || ''}`;

    const isClassicalEastAsian = /玄幻|仙侠|武侠|修仙|古代|古风|朝代|江湖|宗门|灵气|仙|武林|皇宫|王朝/.test(combined);
    const isModernEastAsian = /现实|成长|言情|青春|现代|都市|大学|校园|职场|当代|城市|公寓|咖啡|公司/.test(combined);
    const isSciFi = /科幻|未来|赛博|太空|星际|机器人|AI|科技|义体|废土/.test(combined);
    const isHistorical = /历史|民国|战争|朝代|宫廷|王朝/.test(combined);

    if (isClassicalEastAsian) {
        return {
            label: 'Classical East Asian / Chinese historical-fantasy setting',
            positive: 'Chinese / East Asian facial features, culturally authentic ancient Chinese clothing, period-accurate hairstyle, traditional materials, Eastern architecture or natural landscape cues',
            negative: 'modern western streetwear, European medieval armor, blonde hair, blue eyes, Mediterranean city, generic western fantasy castle'
        };
    }

    if (isModernEastAsian) {
        return {
            label: 'Modern Chinese / contemporary East Asian setting',
            positive: 'Chinese / East Asian facial features, contemporary Chinese urban realism, modern Asian fashion, realistic local environment cues',
            negative: 'European model look, western campus stereotype, fantasy costume, ancient robes, blonde hair, blue eyes'
        };
    }

    if (isSciFi) {
        return {
            label: 'Science fiction setting',
            positive: 'futuristic visual language grounded in the story world, coherent technology design, cinematic sci-fi atmosphere',
            negative: 'ancient costume, generic romance portrait, unrelated fantasy magic, medieval setting'
        };
    }

    if (isHistorical) {
        return {
            label: 'Historical setting',
            positive: 'period-accurate clothing, historically grounded environment, restrained authentic styling',
            negative: 'modern clothing, futuristic devices, generic fantasy costume, anachronistic accessories'
        };
    }

    return {
        label: 'Story-specific setting',
        positive: 'visual design strictly grounded in the provided story world and character profile',
        negative: 'unrelated genre elements, random fashion, mismatched era, mismatched culture'
    };
}

function buildStoryVisualContext(outline = {}, options = {}) {
    const context = [];
    const eraCulture = detectStoryEraAndCulture(outline, options);
    const novelType = options.novelType || '';
    const worldDesc = getWorldDescription(outline);

    if (outline.title) context.push(`story title: ${outline.title}`);
    if (novelType) context.push(`genre: ${novelType}`);
    if (outline.logline) context.push(`story premise: ${outline.logline}`);
    const primaryTheme = getPrimaryTheme(outline);

    if (primaryTheme) context.push(`core theme: ${primaryTheme}`);
    if (outline.coreConflict) context.push(`core conflict: ${outline.coreConflict}`);
    if (worldDesc) context.push(`world setting: ${worldDesc}`);
    if (outline.tone || options.tone) context.push(`emotional tone: ${outline.tone || options.tone}`);
    context.push(`setting lock: ${eraCulture.label}`);

    return {
        text: context.filter(Boolean).join('; '),
        positive: eraCulture.positive,
        negative: eraCulture.negative
    };
}

function buildCoverCreativeBrief(project = {}, outline = {}, options = {}) {
    const storyContext = buildStoryVisualContext(outline, options);
    const protagonist = getProtagonist(outline);
    const worldDesc = getWorldDescription(outline);
    const primaryTheme = getPrimaryTheme(outline);
    const genre = options.novelType || '';
    const tone = outline.tone || options.tone || '';

    const protagonistParts = [];
    if (protagonist) {
        if (protagonist.name) protagonistParts.push(`name=${protagonist.name}`);
        if (protagonist.role) protagonistParts.push(`role=${protagonist.role}`);
        if (protagonist.age) protagonistParts.push(`age=${protagonist.age}`);
        if (protagonist.appearance) protagonistParts.push(`appearance=${protagonist.appearance}`);
        if (protagonist.personality) protagonistParts.push(`personality=${protagonist.personality}`);
        if (protagonist.goal) protagonistParts.push(`goal=${protagonist.goal}`);
        if (protagonist.arc) protagonistParts.push(`arc=${protagonist.arc}`);
    }

    return {
        title: outline.title || project.name || '',
        genre,
        premise: outline.logline || '',
        theme: primaryTheme,
        conflict: outline.coreConflict || '',
        world: worldDesc,
        tone,
        protagonist: protagonistParts.join('; '),
        fidelity: storyContext.positive,
        avoid: storyContext.negative,
        context: storyContext.text
    };
}

function formatCoverCreativeBrief(brief) {
    return [
        brief.title ? `Title: ${brief.title}` : '',
        brief.genre ? `Genre: ${brief.genre}` : '',
        brief.premise ? `Premise: ${brief.premise}` : '',
        brief.theme ? `Core theme: ${brief.theme}` : '',
        brief.conflict ? `Core conflict: ${brief.conflict}` : '',
        brief.world ? `World setting: ${brief.world}` : '',
        brief.tone ? `Emotional tone: ${brief.tone}` : '',
        brief.protagonist ? `Protagonist: ${brief.protagonist}` : '',
        brief.fidelity ? `Required visual fidelity: ${brief.fidelity}` : '',
        brief.avoid ? `Must avoid: ${brief.avoid}` : ''
    ].filter(Boolean).join('\n');
}

function buildCoverSubjectStrategy(brief) {
    const text = `${brief.genre} ${brief.premise} ${brief.theme} ${brief.conflict} ${brief.world} ${brief.tone}`;
    const strategies = [];

    strategies.push('Use a book-cover concept, not a character ID photo or glamour portrait.');
    strategies.push('The subject must communicate the central conflict before beauty or fashion.');

    if (/悬疑|犯罪|真相|秘密|背叛|猎杀|迷雾/.test(text)) {
        strategies.push('Cover subject: fragmented clue, obscured figure, reflection, shadow, or threshold moment that suggests danger and concealment.');
    } else if (/言情|情欲|欲望|沉沦|爱情|暧昧|诱惑/.test(text)) {
        strategies.push('Cover subject: emotionally charged but restrained symbolic scene, such as a hand gesture, fabric detail, mirror reflection, night corridor, or two figures separated by negative space; avoid explicit posing.');
    } else if (/玄幻|仙侠|修仙|江湖|灵气|宗门/.test(text)) {
        strategies.push('Cover subject: small protagonist silhouette against immense Eastern fantasy landscape, ritual object, sword, mountain gate, clouds, or celestial scale contrast.');
    } else if (/科幻|未来|赛博|AI|机器人|太空|废土/.test(text)) {
        strategies.push('Cover subject: human-scale figure against coherent technology or city-scale system, with a clear speculative concept.');
    } else if (/现实|成长|校园|职场|都市|阶层|家庭/.test(text)) {
        strategies.push('Cover subject: concrete contemporary life scene or symbolic object from the setting, with social pressure visible through environment and composition.');
    } else {
        strategies.push('Cover subject: one decisive narrative image or symbolic object that represents the protagonist conflict.');
    }

    strategies.push('Symbolic motif: choose 1-2 motifs directly from the premise, theme, world, or protagonist goal; do not add unrelated genre symbols.');
    strategies.push(`Setting fidelity: ${brief.fidelity}`);
    strategies.push(`Avoid: ${brief.avoid}, generic idol portrait, random couple, unrelated costume, mismatched location, decorative elements not grounded in the story`);

    return strategies.join(' ');
}

/**
 * 从角色数据和大纲构建图像生成提示词
 * @param {Object} character - 角色数据
 * @param {Object} outline - 核心大纲数据 (outlineJSON)
 * @param {Object} options - 大纲选项 (outlineOptions)
 * @returns {{ characterPrompt: string, stylePrompt: string }}
 */
export function buildCharacterPrompt(character, outline = {}, options = {}) {
    const storyContext = buildStoryVisualContext(outline, options);

    // 构建角色特征提示词
    const characterParts = [];

    characterParts.push('STRICT STORY-CONSISTENT CHARACTER DESIGN');
    if (storyContext.text) {
        characterParts.push(`must visually match this novel context: ${storyContext.text}`);
    }
    characterParts.push(`setting and culture must match: ${storyContext.positive}`);
    characterParts.push('do not create a generic attractive person; design must reflect this exact character role, era, genre, social environment, and narrative conflict');

    // 基础信息
    if (character.name) {
        characterParts.push(`character name: ${character.name}`);
    }
    if (character.role) {
        characterParts.push(`story role: ${character.role}`);
    }
    if (character.gender) {
        characterParts.push(character.gender === 'Male' || character.gender === '男' ? 'male' : 'female');
    }
    if (character.age) {
        characterParts.push(`${character.age} years old`);
    }

    // 外貌描述（核心）
    if (character.appearance) {
        characterParts.push(character.appearance);
    }

    // 角色定位 -> 气质
    if (character.role) {
        const roleHints = {
            'Protagonist': 'protagonist aura, determined expression',
            'Antagonist': 'antagonist presence, complex expression',
            '主角': 'protagonist aura, determined expression',
            '反派': 'antagonist presence, complex expression',
            'Supporting Character': 'supporting role, approachable demeanor',
            '配角': 'supporting role, approachable demeanor'
        };
        if (roleHints[character.role]) {
            characterParts.push(roleHints[character.role]);
        }
    }

    if (character.bio || character.background) {
        characterParts.push(`character background: ${(character.bio || character.background).substring(0, 240)}`);
    }
    if (character.goal) {
        characterParts.push(`character goal: ${character.goal}`);
    }
    if (character.arc) {
        characterParts.push(`character arc: ${character.arc}`);
    }

    // 性格 -> 表情/神态
    if (character.traits || character.personality) {
        const traits = character.traits || character.personality;
        characterParts.push(`personality: ${traits}`);
    }

    const characterPrompt = characterParts.join(', ');

    // 构建画面风格提示词
    const styleParts = [];

    // 从小说类型获取视觉风格
    const novelType = options.novelType || '';
    if (novelType && NOVEL_TYPE_STYLES[novelType]) {
        styleParts.push(NOVEL_TYPE_STYLES[novelType]);
    } else {
        styleParts.push(NOVEL_TYPE_STYLES['其他']);
    }

    // 从情感基调获取光影色调
    const tone = options.tone || outline.tone || '';
    if (tone && TONE_STYLES[tone]) {
        styleParts.push(TONE_STYLES[tone]);
    }

    // 从世界设定获取背景提示
    const worldDesc = getWorldDescription(outline);
    if (worldDesc) {
        // 提取关键词
        if (worldDesc.includes('古代') || worldDesc.includes('修仙') || worldDesc.includes('仙侠')) {
            styleParts.push('ancient Chinese setting');
        } else if (worldDesc.includes('现代') || worldDesc.includes('都市')) {
            styleParts.push('modern urban setting');
        } else if (worldDesc.includes('未来') || worldDesc.includes('科技')) {
            styleParts.push('futuristic setting');
        }
    }

    styleParts.push(`must match story context: ${storyContext.text}`);
    styleParts.push(`cultural and setting lock: ${storyContext.positive}`);

    // 添加通用质量提示词
    styleParts.push('high quality, detailed, 8k resolution, professional portrait');
    styleParts.push(`avoid theme mismatch: ${storyContext.negative}`);
    styleParts.push('avoid unrelated genre, mismatched era, mismatched culture, random modern fashion, generic idol portrait, western-default face unless explicitly specified');

    const stylePrompt = styleParts.join(', ');

    return { characterPrompt, stylePrompt };
}

/**
 * 从小说元数据构建封面生成提示词
 * 深度提取核心大纲信息，确保封面与故事完美契合
 * @param {Object} project - 项目数据
 * @param {Object} outline - 核心大纲数据 (outlineJSON)
 * @param {Object} options - 大纲选项 (outlineOptions)
 * @returns {{ coverPrompt: string, stylePrompt: string }}
 */
export function buildCoverPrompt(project = {}, outline = {}, options = {}) {
    const brief = buildCoverCreativeBrief(project, outline, options);
    const storyContext = buildStoryVisualContext(outline, options);
    const subjectStrategy = buildCoverSubjectStrategy(brief);

    // ========== 构建封面主体描述 ==========
    const coverParts = [];

    coverParts.push('STRICT STORY-FIDELITY BOOK COVER');
    if (brief.title) {
        coverParts.push(`book title/context name: ${brief.title}`);
    }
    if (storyContext.text) {
        coverParts.push(`must visually match this novel context: ${storyContext.text}`);
    }
    coverParts.push(`Cover subject strategy: ${subjectStrategy}`);
    coverParts.push(`Story fidelity lock: ${storyContext.positive}; every visual element must support the stated theme, world setting, protagonist conflict, and emotional tone`);

    // 1. 从核心冲突/主题提取视觉意象
    if (brief.conflict) {
        coverParts.push(`visual metaphor for central conflict: ${brief.conflict}`);
    }
    if (brief.theme) {
        coverParts.push(`symbolic motif must express core theme: ${brief.theme}`);
    }

    // 2. 从世界设定提取场景背景（完整世界观）
    const worldDesc = brief.world;
    if (worldDesc) {
        // 添加完整世界观描述
        coverParts.push(`world setting and atmosphere: ${worldDesc}`);

        // 同时添加智能解析的视觉风格关键词
        if (worldDesc.includes('古代') || worldDesc.includes('古风') || worldDesc.includes('朝代')) {
            coverParts.push('ancient Chinese dynasty aesthetic, traditional architecture');
        } else if (worldDesc.includes('仙') || worldDesc.includes('修真') || worldDesc.includes('灵气')) {
            coverParts.push('xianxia cultivation aesthetic, celestial mountains, mystical qi energy');
        } else if (worldDesc.includes('现代') || worldDesc.includes('都市') || worldDesc.includes('城市')) {
            coverParts.push('modern urban aesthetic, contemporary environment');
        } else if (worldDesc.includes('未来') || worldDesc.includes('科技') || worldDesc.includes('太空')) {
            coverParts.push('futuristic sci-fi aesthetic, advanced technology');
        } else if (worldDesc.includes('末世') || worldDesc.includes('废土')) {
            coverParts.push('post-apocalyptic aesthetic, ruins atmosphere');
        } else if (worldDesc.includes('魔法') || worldDesc.includes('奇幻')) {
            coverParts.push('high fantasy aesthetic, magical realm');
        }
    }

    // 3. 从主角提取人物元素
    if (brief.protagonist) {
        coverParts.push(`protagonist cues, only if visually useful: ${brief.protagonist.substring(0, 260)}`);
    }

    // 4. 从故事概要提取核心意象（完整概要）
    if (brief.premise) {
        coverParts.push(`story synopsis and essence: ${brief.premise}`);
    }

    // 5. 书籍类型 → 封面风格 + 独特构图
    const novelType = options.novelType || '';
    if (novelType) {
        const typeThemes = {
            '玄幻': 'epic fantasy cover, dramatic aerial view of mystical realm, swirling magical energy, towering ancient structures, protagonist silhouette against cosmic backdrop, dynamic diagonal composition',
            '仙侠': 'xianxia immortal cultivation art, serene mountain peaks above clouds, lone figure on cliff edge meditating, flowing robes and energy streams, vertical composition emphasizing height, ethereal mist',
            '现实主义': 'literary fiction cover, intimate close-up composition, everyday scene rendered artistically, shallow depth of field, natural lighting, muted color palette, contemplative mood',
            '成长小说': 'coming of age art, split composition showing transformation, path stretching into distance, symbolic imagery of growth, warm golden hour lighting, hopeful atmosphere',
            '悬疑犯罪': 'thriller noir cover, dramatic chiaroscuro lighting, fragmented composition, hidden faces in shadow, urban nightscape, rain-slicked streets, mysterious silhouettes, unsettling angles',
            '言情': 'romance novel art, soft focus romantic scene, two figures in intimate composition, cherry blossoms or flower petals, warm sunset colors, dreamy bokeh background, elegant flowing elements',
            '科幻': 'sci-fi cover art, vast scale visualization, tiny humans against massive technology, neon-lit cityscapes, geometric patterns, holographic interfaces, cold blue-green palette with orange accents',
            '历史': 'historical epic cover, sweeping landscape with period architecture, army formations or royal courts, detailed period costumes, sepia-tinted dramatic sky, classical oil painting style',
            '其他': 'artistic book cover, unique conceptual composition, symbolic visual metaphor'
        };
        coverParts.push(typeThemes[novelType] || typeThemes['其他']);
    }

    const coverPrompt = coverParts.join(', ');

    // ========== 构建风格提示词 ==========
    const styleParts = [];

    // 1. 情感基调 → 色调氛围 (核心！)
    const tone = outline.tone || options.tone || '';
    if (tone) {
        const toneMap = {
            '轻松幽默': 'bright cheerful colors, warm sunny palette, lighthearted atmosphere',
            '温馨治愈': 'soft warm lighting, gentle pastel tones, cozy healing atmosphere',
            '紧张悬疑': 'dramatic shadows, cool dark tones, tense mysterious atmosphere',
            '深沉内敛': 'muted sophisticated colors, contemplative mood, subdued elegance',
            '厚重史诗': 'epic cinematic lighting, rich deep colors, grand majestic atmosphere',
            '细腻抒情': 'delicate soft lighting, emotional depth, poetic artistic style'
        };
        if (toneMap[tone]) {
            styleParts.push(toneMap[tone]);
        } else {
            styleParts.push(`emotional tone: ${tone}`);
        }
    }

    // 2. 节奏感 → 构图风格
    const pacing = outline.pacing || '';
    if (pacing) {
        if (pacing.includes('快') || pacing.includes('紧凑')) {
            styleParts.push('dynamic composition, sense of movement and energy');
        } else if (pacing.includes('慢') || pacing.includes('缓')) {
            styleParts.push('calm contemplative composition, serene atmosphere');
        }
    }

    // 3. 标签 → 视觉元素
    const tags = outline.tags || [];
    if (tags.length > 0) {
        styleParts.push(`genre elements: ${tags.slice(0, 3).join(', ')}`);
    }

    // 4. 基础画质要求
    styleParts.push('professional book cover illustration');
    styleParts.push('cinematic composition, dramatic lighting');
    styleParts.push('high quality, detailed, 8k resolution');
    styleParts.push('artistic masterpiece quality');
    styleParts.push('single coherent cover concept, strong visual hierarchy, no unrelated collage');
    styleParts.push('Cover subject must be a narrative moment, symbolic object, silhouette, reflection, or environmental metaphor tied to the story');
    styleParts.push(`strictly match story context: ${storyContext.text}`);
    styleParts.push(`avoid theme mismatch: ${storyContext.negative}`);
    styleParts.push('avoid unrelated genre elements, mismatched era, mismatched culture, generic idol portrait, random romantic couple, western-default aesthetics unless explicitly specified');

    // 5. ⚠️ 关键：禁止文字！
    styleParts.push('absolutely NO TEXT, NO TITLE, NO LETTERS, NO WORDS, NO TYPOGRAPHY, NO WRITING');
    styleParts.push('pure visual illustration without any text elements');

    const stylePrompt = styleParts.join(', ');

    return { coverPrompt, stylePrompt };
}

/**
 * 获取图像生成 API 配置
 * @param {string} projectId - 可选的项目 ID
 * @returns {Promise<Object|null>}
 */
export async function getImageApiConfig(projectId = null) {
    try {
        const presetsData = await storage.getSetting('apiPresets');
        const presets = Array.isArray(presetsData) ? presetsData : [];
        console.log('[Debug] Loaded presets:', presets.map(p => ({ id: p.id, name: p.name, type: p.type })));

        // 先获取全局配置
        const globalFeatureConfigData = await storage.getSetting('featureConfig');
        let featureConfig = (globalFeatureConfigData && typeof globalFeatureConfigData === 'object') ? globalFeatureConfigData : {};
        console.log('[Debug] Global feature config:', featureConfig);

        // 如果有 projectId，尝试获取项目特定配置（优先级更高）
        if (projectId) {
            const projectFeatureConfigData = await storage.getSetting(`featureConfig_${projectId}`);
            console.log('[Debug] Project feature config raw:', projectFeatureConfigData);
            if (projectFeatureConfigData && typeof projectFeatureConfigData === 'object') {
                featureConfig = { ...featureConfig, ...projectFeatureConfigData };
            }
        }
        console.log('[Debug] Final feature config:', featureConfig);

        let imagePresetId = featureConfig.imageGeneration;

        // Auto-fallback: If no image preset is explicitly configured, try to find the first available image preset
        if (!imagePresetId) {
            console.warn('[Debug] No imageGeneration preset configured. Attempting to find a default image preset...');
            const defaultImagePreset = presets.find(p => p.type === 'image');
            if (defaultImagePreset) {
                console.log('[Debug] Found default image preset:', defaultImagePreset.name);
                return defaultImagePreset;
            }
        }

        if (!imagePresetId) {
            console.warn('[Debug] No imageGeneration preset ID configured and no default image preset found.');
            return null;
        }

        const preset = presets.find(p => p.id === imagePresetId);
        if (!preset) {
            console.warn(`[Debug] Preset with ID ${imagePresetId} found in config but not in presets list.`);
        }
        return preset || null;
    } catch (e) {
        console.error('Failed to get image API config:', e);
        return null;
    }
}

/**
 * 调用图像生成 API
 * @param {Object} params
 * @param {string} params.characterPrompt - 角色特征描述
 * @param {string} params.stylePrompt - 画面风格描述
 * @param {string} params.size - 图像尺寸 ('1:1' | '2:3' | '3:2')
 * @param {Object} params.apiConfig - API 配置
 * @param {boolean} [params.isCover=false] - 是否为封面生成（如果是，将跳过自动添加拍摄方式前缀）
 * @returns {Promise<{ url?: string, b64_json?: string }>}
 */
export async function generatePortrait({ characterPrompt, stylePrompt, size = '1:1', apiConfig, projectId, characterName, isCover = false, image = null, signal = null }) {
    if (!apiConfig || !apiConfig.apiKey) {
        throw new Error('未配置图像生成 API');
    }

    // 将比例转换为 API 需要的像素尺寸
    const sizeMap = {
        '1:1': '1024x1024',
        '2:3': '1024x1792',
        '3:2': '1792x1024'
    };

    // 根据尺寸添加拍摄方式前缀
    const shotTypeMap = {
        '1:1': 'head-shot, close-up portrait, face focused',
        '2:3': 'full body shot, standing pose, character portrait',
        '3:2': 'half body shot, upper body portrait, cinematic composition'
    };

    let prompt;
    if (isCover) {
        // 封面模式：不添加 shotType，完全信任传入的 Prompt
        prompt = stylePrompt
            ? `${characterPrompt}, ${stylePrompt}`
            : characterPrompt;
    } else {
        // 角色模式：自动添加 shotType
        const shotType = shotTypeMap[size] || shotTypeMap['1:1'];
        prompt = stylePrompt
            ? `${shotType}, ${characterPrompt}, ${stylePrompt}`
            : `${shotType}, ${characterPrompt}`;
    }

    const requestBody = {
        model: apiConfig.model || 'gpt-image-1.5',
        prompt: prompt,
        n: 1,
        size: sizeMap[size] || '1024x1024',
        response_format: 'b64_json' // 使用 base64 格式以便直接保存
    };

    const imageInputs = normalizeImageInputs(image);
    if (imageInputs?.length) {
        requestBody.image = imageInputs;
    }

    const imageGenerationsUrl = buildImageGenerationsUrl(apiConfig.baseUrl || 'https://api.tu-zi.com');

    const response = await fetch(imageGenerationsUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiConfig.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: signal  // 支持取消请求
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
        throw new Error('没有生成任何图像');
    }

    const generatedImage = data.data[0];

    /**
     * Sanitize filename to be safe for filesystem
     * Replaces invalid characters with underscores
     * Preserves unicode characters (Chinese, etc.)
     */
    function sanitizeFilename(name) {
        if (!name) return 'image';
        // Remove null bytes
        let clean = name.replace(/\0/g, '');
        // Replace illegal characters for common filesystems (Windows/Linux/Mac): / \ : * ? " < > |
        clean = clean.replace(/[\\/:*?"<>|]/g, '_');
        // Trim whitespace and limit length
        clean = clean.trim().substring(0, 50);
        // Ensure it's not empty after cleaning
        return clean || 'image';
    }

    // 生成唯一文件名
    const timestamp = Date.now();
    const imageType = isCover ? 'covers' : 'characters';
    const rawName = isCover ? projectId : (characterName || 'char');
    const filenameBase = sanitizeFilename(rawName);
    const filename = `${filenameBase}_${timestamp}.png`;

    let imageUrl;
    if (generatedImage.b64_json) {
        // API 直接返回了 Base64，上传到服务器
        const fullBase64 = `data:image/png;base64,${generatedImage.b64_json}`;
        imageUrl = await uploadImage(imageType, filename, fullBase64);
        console.log('[ImageGen] Uploaded image to server:', imageUrl);
    } else if (generatedImage.url) {
        // API 返回了 URL，下载并上传到本地服务器
        // 重要：AI 返回的 URL 是临时的，必须下载并上传到本地！
        console.log('[ImageGen] API returned URL, downloading and uploading to local server...');
        const base64Data = await urlToBase64(generatedImage.url);
        if (base64Data.startsWith('data:')) {
            imageUrl = await uploadImage(imageType, filename, base64Data);
            console.log('[ImageGen] Uploaded image to server:', imageUrl);
        } else {
            // 转换失败，抛出错误（不使用临时 URL）
            throw new Error('无法下载 AI 生成的图像，请重试');
        }
    } else {
        throw new Error('无法获取生成的图像');
    }

    // Log to PromptLogger（图像会自动被 PromptLogger 上传）
    if (projectId) {
        try {
            await PromptLogger.log({
                projectId,
                agent: 'ImageGeneration',
                action: `生成图像${characterName ? `: ${characterName}` : ''}`,
                taskId: 'image-generation',
                taskName: '图像生成',
                modules: {
                    characterPrompt,
                    stylePrompt,
                    size,
                    model: apiConfig.model || 'gpt-image-1.5'
                },
                fullPrompt: prompt,
                response: imageUrl, // 使用服务器 URL
                model: apiConfig.model || 'gpt-image-1.5'
            });
        } catch (logError) {
            console.warn('Failed to log image generation:', logError);
        }
    }

    // 返回服务器 URL
    return { url: imageUrl };
}

// --- Background Task Management ---

const runningTasks = new Map();

/**
 * 更新草稿状态
 */
function updateDraft(characterId, updates) {
    if (!characterId) return;
    const key = `narragen_ai_portrait_draft_${characterId}`;
    try {
        const current = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({ ...current, ...updates }));
    } catch (e) {
        console.error('Failed to update draft:', e);
    }
}

/**
 * 启动后台生成任务
 */
export function startBackgroundGeneration(characterId, params) {
    if (runningTasks.has(characterId)) return; // 已经在运行中

    // 立即标记为生成中
    updateDraft(characterId, { generating: true, error: '' });
    window.dispatchEvent(new CustomEvent('narragen-image-gen-status', {
        detail: { characterId, status: 'start' }
    }));

    const task = (async () => {
        try {
            const result = await generatePortrait(params);
            const imageUrl = result.url; // 现在只返回 URL

            // 保存结果
            // 注意：因为是并发，可能会覆盖用户之后的临时修改，但鉴于用户期望的是生成结果，这应该可以接受
            updateDraft(characterId, {
                generatedImage: imageUrl,
                generating: false,
                // 这里我们不再覆盖 prompts，以免覆盖用户在生成期间的修改
                // characterPrompt: params.characterPrompt,
                // stylePrompt: params.stylePrompt,
                // imageSize: params.size
            });

            window.dispatchEvent(new CustomEvent('narragen-image-gen-status', {
                detail: { characterId, status: 'success', imageUrl }
            }));
        } catch (error) {
            console.error('Background generation failed:', error);
            updateDraft(characterId, { generating: false, error: error.message || '生成失败' });

            window.dispatchEvent(new CustomEvent('narragen-image-gen-status', {
                detail: { characterId, status: 'error', error: error.message }
            }));
        } finally {
            runningTasks.delete(characterId);
        }
    })();

    runningTasks.set(characterId, task);
}

/**
 * 检查是否正在生成
 */
export function isGenerating(characterId) {
    return runningTasks.has(characterId);
}

// --- Cover Background Task Management ---

const runningCoverTasks = new Map();

/**
 * 更新封面草稿状态
 */
function updateCoverDraft(projectId, updates) {
    if (!projectId) return;
    const key = `narragen_cover_gen_draft_${projectId}`;
    try {
        const current = JSON.parse(localStorage.getItem(key) || '{}');
        localStorage.setItem(key, JSON.stringify({ ...current, ...updates }));
    } catch (e) {
        console.error('Failed to update cover draft:', e);
    }
}

/**
 * 获取封面草稿状态
 */
export function getCoverDraft(projectId) {
    if (!projectId) return null;
    const key = `narragen_cover_gen_draft_${projectId}`;
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
}

/**
 * 清除封面草稿
 */
export function clearCoverDraft(projectId) {
    if (!projectId) return;
    const key = `narragen_cover_gen_draft_${projectId}`;
    localStorage.removeItem(key);
}

/**
 * 启动后台封面生成任务
 */
export function startBackgroundCoverGeneration(projectId, params) {
    if (runningCoverTasks.has(projectId)) return; // 已经在运行中

    // 创建 AbortController 以便取消请求
    const abortController = new AbortController();

    // 立即标记为生成中
    updateCoverDraft(projectId, { generating: true, error: '' });
    window.dispatchEvent(new CustomEvent('narragen-cover-gen-status', {
        detail: { projectId, status: 'start' }
    }));

    const task = (async () => {
        try {
            // 封面生成时，传入 isCover: true 以跳过自动添加 "full body shot" 等前缀
            const result = await generatePortrait({ ...params, isCover: true, signal: abortController.signal });
            const imageUrl = result.url; // 现在只返回 URL

            // 保存结果
            updateCoverDraft(projectId, {
                generatedImage: imageUrl,
                generating: false,
            });

            window.dispatchEvent(new CustomEvent('narragen-cover-gen-status', {
                detail: { projectId, status: 'success', imageUrl }
            }));
        } catch (error) {
            console.error('Background cover generation failed:', error);
            updateCoverDraft(projectId, { generating: false, error: error.message || '生成失败' });

            window.dispatchEvent(new CustomEvent('narragen-cover-gen-status', {
                detail: { projectId, status: 'error', error: error.message }
            }));
        } finally {
            runningCoverTasks.delete(projectId);
        }
    })();

    // 存储 task 和 abortController 以便取消
    runningCoverTasks.set(projectId, { task, abortController });
}

/**
 * 检查封面是否正在生成
 */
export function isCoverGenerating(projectId) {
    return runningCoverTasks.has(projectId);
}

/**
 * 取消封面生成（标记为取消并清除状态）
 */
export function cancelCoverGeneration(projectId) {
    if (!projectId) return;
    // 获取任务并中断请求
    const taskEntry = runningCoverTasks.get(projectId);
    if (taskEntry?.abortController) {
        taskEntry.abortController.abort();
    }
    // 从运行任务中移除
    runningCoverTasks.delete(projectId);
    // 清除草稿状态
    clearCoverDraft(projectId);
    // 发送取消事件
    window.dispatchEvent(new CustomEvent('narragen-cover-gen-status', {
        detail: { projectId, status: 'cancelled' }
    }));
}

export default {
    buildCharacterPrompt,
    buildCoverPrompt,
    generateCoverPromptWithLLM,
    getImageApiConfig,
    generatePortrait,
    startBackgroundGeneration,
    isGenerating,
    startBackgroundCoverGeneration,
    isCoverGenerating,
    cancelCoverGeneration,
    getCoverDraft,
    clearCoverDraft,
    NOVEL_TYPE_STYLES,
    TONE_STYLES
};
