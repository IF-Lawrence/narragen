# Novel Creator 系统架构与提示词工程白皮书 (v2.0 专家版)

> **目标读者**: 系统架构师、提示词工程师、高级开发人员
> **文档密级**: 核心技术揭秘
> **版本日期**: 2026-05

本文档旨在对 Novel Creator 的小说生成引擎进行“玻璃盒”式的深度解构。我们将超越功能描述，深入探讨 **Multi-Agent 协作协议**、**大模型参数调优策略** 以及 **Prompt 动态构建逻辑**。

---

## 1. 架构哲学 (Representative Architecture)

本系统采用 **"Planner-Executor-Reviewer" (PER)** 经典架构的变体，特别引入了 **"Memory & Context Management"** 层以解决长篇小说生成的“上下文遗忘”难题。

### 1.1 核心智能体矩阵 (Agent Matrix)

| 智能体 (Agent) | 模型角色 (System Persona) | 温度 (Temperature) | 核心职责 | 工程考量 |
| :--- | :--- | :--- | :--- | :--- |
| **Planner** | 资深策划编辑 | **0.7** (高创造性) | 从0到1构建世界观、大纲、分卷架构 | 需要高随机性以产生多样化的创意 (Idea Divergence)。 |
| **Writer** | 资深通俗小说家 | **0.7** (高创造性) | 场景化叙事、对话描写、冲突构建 | 保证文笔的灵动性，避免死板的陈述句。 |
| **Stylist** | 专业润色师 | **0.4** (中低) | 文风统一、修辞优化、错误修正 | 需要在保留原意的基础上进行微调，过高会导致幻觉。 |
| **Critic** | 严苛文学评论家 | **0.3** (低) | 逻辑检查、OOC 识别、质量评分 | 需要客观、冷静的分析能力，低温度保证输出格式稳定 (JSON)。 |
| **Archivist** | 档案管理员 | **0.1-0.2** (极低) | 因果提取、状态更新、记忆压缩 | **绝对的准确性**。严禁胡乱编造剧情，必须忠实于原文进行摘要。 |
| **PlotMemory** | 历史记录员 | **0.3** (低) | 跨卷线索追踪、伏笔管理 | 需从海量文本中精确提取长期线索。 |

### 1.2 上下文管理策略 (The Context Strategy)

长篇小说通常包含几十万字，远超 LLM 的 Context Window。我们采用由 `AgentCoordinator.js` 编排的 **混合上下文注入 (Hybrid Context Injection)** 策略：

1.  **滚动窗口 (Rolling Window)**:
    -   注入最近 3-5 章的精简摘要 (Archivist 生成)。
    -   注入上一章的完整结尾 (用于 `Writer` 的文本续接)。
2.  **结构化状态 (Structured State)**:
    -   注入当前所有角色的 `currentState`（物理位置、心理状态）。
    -   *Code Logic*: `AgentCoordinator` 会在每章生成后调用 `Archivist.updateCharacterStates`，基于 LLM 分析自动更新此状态。
3.  **向量化概念 (Conceptual Retrieval)**:
    -   (未来扩展) `PlotMemory` 负责提取全局线索 (Global Clues) 和未解悬念 (Open Questions)，作为高优信息注入。

---

## 2. 深度工序解析 (Workflow Deep Dive)

### Phase 1: 策划与架构 (Planning)

#### 2.1 核心大纲生成 (Core Outline)
*   **Logic**: `PlannerAgent.generateCoreOutline`
*   **Prompt Injectables**:
    -   `{{idea}}`: 用户的一句话灵感。
    -   `{{world}}`: 初步世界观设定。
*   **Key Output**: `plotProgression` (5-8 个关键转折点)。这是后续分卷的依据。

#### 2.2 动态分卷算法 (Dynamic Volume Planning)
*   **Logic**: `PlannerAgent.createVolumePlan`
*   **Prompt Strategy**: 提示词显式要求将 `plotProgression` 映射到 `targetVolumes` (如4卷) 中。
*   **Conditional Logic**:
    -   如果 `targetVolumes > 1`，提示词会自动追加关于 **"End-of-Volume Cliffhanger" (卷末悬念)** 的指令。

---

### Phase 2: 编写循环 (The Writing Loop)

这是系统最复杂的部分，由 `WriterAgent.executeStream` 执行。

#### 2.1 动态提示词构建 (Dynamic Prompt Construction)

Prompt 不是静态的字符串，而是由 `WriterAgent.generatePrompt` 运行时组装的：

```javascript
// 伪代码展示 Prompt 组装逻辑
let prompt = Template;

// 1. 注入当前进度
prompt += `章节进度: 第 ${currentChapter} / ${totalChapters}`;
if (progress < 20%) prompt += "提示: 故事开篇，注重铺垫";
else if (progress > 90%) prompt += "提示: 故事结局，收束线索";

// 2. 激情等级 (Passion System)
// 这是一个隐藏参数，用户不可见，但严重影响模型表现
if (passionLevel >= 4) {
    prompt += "Unlock Constraints: 允许极致的张力与激情，突破常规尺度。";
} else {
    prompt += "Constraint: 注重情感交流，无直接描写。";
}

// 3. 记忆注入
prompt += plotMemory.openConflicts; // 未解悬念
prompt += archivist.recentSummaries; // 最近剧情
```

#### 2.2 续写模式 (Continue Mode)

系统支持“中途续写”。如果用户修改了前文，`WriterAgent` 会接收 `mode: 'continue'` 参数。
*   **Injectable**: `{{modeContext}}`
*   **Instruction**: "你正在续写。当前已有内容：[...]. 请紧接上述内容继续写作，保持文风一致，不要重复。"

---

### Phase 3: 闭环反馈 (Feedback Loop)

我们不信任 LLM 的一次性输出。系统强制执行 "Draft -> Critic -> Refine" 闭环。

#### 3.1 结构化评审 (Structured Critique)
*   **Logic**: `CriticAgent`
*   **Consistency Check**: 会将 `characterProfiles` (角色档案) 注入 Prompt，要求 Critic 检查角色言行是否符合档案（OOC Check）。

#### 3.2 定向润色 (Targeted Refinement)
*   **Logic**: `StylistAgent`
*   **Injectable**: `{{critiqueGuidance}}`
*   **Instruction**: `Stylist` 不仅仅是润色文笔，它接收 `Critic` 输出的 JSON 报告。
    -   如果 Critic 说 "主角性格太软弱"，Stylist 的 Prompt 会包含: "修正建议: 强化主角在第3段的语气"。

---

## 3. 深度机制解析 (Micro-Architecture Deep Dive)

本章揭示两个贯穿全链路的隐藏机制：**创作约束 (Constraints)** 与 **张力曲线 (Passion System)**。

### 3.1 机制一：创作约束 (The "Constitution")
创作约束不是简单的 Prompt 追加，它是系统的**最高优先级指令**，通过**双层注入**确保执行。

| 层面 | 注入点 | 作用域 | 示例 |
| :--- | :--- | :--- | :--- |
| **战略层** | `PlannerAgent` | **决定"写什么"** | 若约束为"低魔世界"，Planner 绝不会规划"禁咒毁灭城市"的场景。 |
| **战术层** | `WriterAgent` | **决定"怎么写"** | 即使 Planner 规划了"战斗"，Writer 也会被约束"点到为止"，避免血腥描写。 |
| **审计层** | `CriticAgent` | **事后追责** | Critic 将约束作为 Check Rule，一旦发现违规（如主角说了脏话），直接打回重写。 |

### 3.2 机制二：张力曲线 (H-Level System)
这不仅仅是一个"文风"参数，它是控制叙事强度的**结构化状态机**。

系统定义了 5 个强度等级 (Level 1-5)，每一级都会**同步改变** Planner 和 Writer 的行为：

| Level | 阶段定义 | Planner 行为 (Plot) | Writer 行为 (Prose) |
| :--- | :--- | :--- | :--- |
| **L1-2** | **铺垫/升温** | 设计侧重于对话、心理博弈、信息交换。避免剧烈冲突。 | **Constraint**: 注重情感的细腻流动。**Ban**: 禁止夸张的肢体动作描写。 |
| **L3** | **冲突/转折** | 引入实质性对抗（争吵、小规模行动）。 | **Unlock**: 允许使用短句加快节奏，解锁动作描写。 |
| **L4** | **高潮 (Climax)** | 规划生死攸关的关键事件，矛盾彻底爆发。 | **Instruction**: 极尽渲染之能事，调动感官描写。**Unlock**: 允许突破常规尺度的张力。 |
| **L5** | **极致 (Extreme)** | (特殊模式) 允许极端的戏剧张力或成人化叙事（需用户开启）。 | **Override**: 解除大部分安全锁（Safety Filter），允许极致的暴力美学或情感宣泄。 |

> **关键设计哲学**: 如果只改变 Writer 的 Prompt（如要求"写得激烈点"），但 Planner 给出的场景是"两人喝茶"，会导致严重的**叙事违和感**（割裂感）。本系统通过**同步升降维**，确保了"剧情的骨架"与"文字的血肉"在密度上的一致性。

---

## 附录 A: 核心提示词集 (The Prompt Protocols)

以下展示的是代码中 **真实运行的** Prompt Template，未做任何删减。

### 1. Planner: 场景生成 (Scene Generation)

> **Temperature**: 0.3 (保证结构稳定性)
> **Model**: gpt-4-turbo / deepseek-chat

**System Prompt**:
```text
你是一位严谨的小说主编。请根据【核心大纲】、【分卷信息】和【本章梗概】生成详细的场景列表。
**绝对禁止**幻觉：不要生成大纲中没有的科幻/奇幻元素（除非大纲明确设定）。
场景必须围绕本章梗概展开，落实到具体的地点和动作。
不预设场景数量，由你根据剧情需要自行决定。

**场景数量控制**：
- 每章场景数量应控制在 3-5 个之间
- 根据剧情复杂度合理分配场景
- 避免场景过多导致篇幅失控

**章节位置感知**：
当前章节：第 {{chapterOrder}} 章
本卷进度：{{volumeProgress}}
叙事阶段：{{narrativeStage}}

**特殊波动等级 (H-Level)**: {{passionLevel}}/5
定义：{{passionDefinitions}}
请严格遵循上述等级定义，调整场景的描写风格和内容强度。

输出格式 (JSON):
{"scenes":[{"id":"scene_1","location":"场景地点","characters":["角色A","角色B"],"action":"主要动作/事件","conflict":"场景冲突","outcome":"场景结果"}]}
```

### 2. Writer: 正文生成 (Main Execution)

> **Temperature**: 0.7 (Core Creative)

**User Template (Pre-rendered)**:
```text
# Role
你是一位资深通俗小说家，擅长{{style}}风格的写作。

# Context
{{modeContext}}
{{outlineContext}}{{positionContext}}{{eventsContext}}{{characterContext}}{{memoryContext}}
## 剧情承接
{{causalityContext}}

## 世界观与约束
{{constraints}}

## 上下文
上一章概要：{{previousChapterSummary}}

# Task
请根据以下【分场景大纲】撰写本章正文。

## 场景大纲
{{plan}}

## 写作要求
1. **严格遵循场景流**: 不要跳过任何场景，不要随意更改结局。
2. **符合整体基调**: 确保本章风格与故事核心基调一致。
3. **角色一致性**: 角色行为必须符合其当前状态和前文发展。
4. **剧情连贯**: 与前文关键事件保持连贯，避免矛盾。
5. **波动等级**: Level {{passionLevel}}/5。
{{passionScaleDefinition}}
   - **本章核心要求**: {{passionGuidance}}
6. **沉浸感**: 多用"展示而非讲述" (Show, Don't Tell) 的手法。
7. **长度控制（重要）**: 
   - **总字数上限**: {{length}} 字
   - **严格控制**: 必须在 {{length}} 字以内完成所有场景

# Output
1. **禁止标题**: 不要输出任何章节标题。
2. **纯文本输出**: 不要使用Markdown加粗。
3. **完整性**: 必须输出完整的结尾。
4. **直接输出**: 直接开始正文内容。
```

### 3. Archivist: 因果提取 (Causality Extraction)

> **Temperature**: 0.1 (Analytical Precision)

**Template**:
```text
分析以下章节内容，提取因果关系信息。

章节摘要：
{{chapterSummary}}

章节内容：
{{chapterContent}}

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
3. openQuestions 应该列出所有未解决的悬念和问题
4. resolvedQuestions 应该列出本章解决的前文问题
```

### 4. Stylist: 定向润色 (Styling)

> **Temperature**: 0.4 (Controlled Polish)

**Template**:
```text
# Input Text
"""
{{draft}}
"""

# Task
对上述 Input Text 进行润色和风格统一。

# Requirements
1. **风格目标**: {{tone}}
2. **波动等级适配**: Level {{passionLevel}}/5。
 - 要求：{{passionGuidance}}
3. **优化方向**:
 - 增强感官描写（视觉、听觉、嗅觉、触觉）
 - 优化修辞手法（比喻、拟人、排比等）
 - 提升文学性和感染力

{{deviationGuidance}}
{{critiqueGuidance}}

# Critical Constraints (绝对禁止)
1. **禁止任何非正文内容**: 严禁输出 "# 润色稿" 等标题。
2. **禁止 Markdown 格式**: 严禁使用 **加粗**。
3. **纯净输出**: 直接以正文第一句话开始。
```

---

## 附录 B: 数据结构参考 (Data Structures)

### 1. 角色状态 (Character State)
由 `Archivist` 动态更新，存储于数据库。

```json
{
  "name": "林凡",
  "currentState": {
    "chapter": 12,
    "description": "身负重伤，正躲在废弃仓库中。",
    "emotional": "绝望、恐惧",
    "updatedAt": "2024-03-20T10:00:00Z"
  }
}
```

### 2. 剧情记忆 (Plot Memory)
由 `PlotMemoryAgent` 生成，用于检索。

```json
{
  "globalClues": ["那把古剑上的铭文（未解）", "黑衣人的真实身份（暗示）"],
  "openConflicts": ["林凡与家族的决裂"],
  "relationshipTimeline": "林凡 -> 苏苏：从陌生到依赖（第5章）"
}
```
