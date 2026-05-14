# 系统优化路线图：提升文学性、一致性与多样性

基于对系统架构的深度审计，我们发现当前系统虽然在结构化生成上表现出色，但在“文学质感”和“风格多样性”上仍有巨大的提升空间。

以下是针对您提出的 **多样性 (Diversity)**、**一致性 (Consistency)** 和 **文学性 (Literary Quality)** 三大目标的深度优化建议。

## 1. 增强多样性 (Enhancing Diversity)

当前问题：`WriterAgent` 过于依赖统一的 `style` 参数（如“现代中文叙事”），导致打斗、日常、情感戏的笔法趋同。

### 方案 A：动态语气注入 (Dynamic Mood Injection)
-   **原理**：在 `PlannerAgent.generateChapterScenes` 阶段，要求策划为每个场景打上 `Mood Tag`（如：*Tense/紧张*、*Melancholic/忧郁*、*Humorous/幽默*）。
-   **实现**：Writer 的 Prompt 中不再使用全局 `style`，而是根据当前场景的 Tag 动态切换形容词库。
    -   *Tense*: 强制使用短句，禁用连接词。
    -   *Melancholic*: 允许长难句和环境烘托。

### 方案 B：角色声纹库 (Character Voice Prints)
-   **原理**：当前 Character Profile 只有性格描述。
-   **实现**：在 `Character` 数据结构中增加 `dialogueSample`（对话样本）和 `speechPattern`（说话习惯）。
    -   *Example*: "老王 [说话习惯: 喜欢用反问句，口头禅'这不扯淡嘛']"。
-   **Prompt 注入**: 在 Writer 的 `characterContext` 中显式包含这些声纹特征。

## 2. 增强一致性 (Enhancing Consistency)

当前问题：`Archivist` 侧重于剧情摘要，缺乏对“硬事实”的管理。

### 方案 A：世界观圣经 (World Bible / Fact Graph)
-   **原理**：剧情摘要（Summary）是模糊的，但设定（Facts）必须是精确的。
-   **实现**：新增 `FactExtraction` 步骤。
    -   当文中提到“倚天剑是青色的”时，提取一条 Fact: `Entity: 倚天剑, Attribute: 颜色, Value: 青色`。
    -   Writer 撰写时，如果提及“倚天剑”，检索并注入其属性，防止写成“红色的倚天剑”。

### 方案 B：风格记忆 (Style Memory)
-   **原理**：Stylist 目前只根据通用规则润色，没有“记忆”。
-   **实现**：Stylist 应该记录并检索自己过去的修改习惯。
    -   如果 Stylist 上一次把“他笑了”改为“他嘴角勾起一抹冷意”，这个修改习惯应该被记录。

## 3. 增强文学性 (Enhancing Literary Depth)

当前问题：我们发现 `PlannerAgent.js` 中包含一个名为 `detectHighlights` 的方法，但在主流程 `AgentCoordinator.js` 中 **并未被调用**。这是一种资源浪费。

### 方案 A：激活“亮点增强”循环 (The Highlight Loop)
-   **原理**：利用闲置的 `detectHighlights` 功能。
-   **流程改造**：
    1.  Writer 生成初稿。
    2.  调用 `detectHighlights` 识别文中潜在的精彩点（如：一个好的比喻，一段有张力的对话）。
    3.  Stylist 接收这些“潜力点”，进行 **定向爆破式润色**（譬如：将这个好的比喻扩展开来，或者让这段对话更具冲击力），而不是平均用力地修饰全文。

### 方案 B：反AI味约束 (Anti-AI Constraints)
-   **原理**：LLM 容易生成陈词滥调（如“心中五味杂陈”、“不得不说”）。
-   **实现**：在 Critic 中增加 `ClichéDetector`（陈词滥调检测）。
-   **Prompt**: "禁止使用以下词汇：[...List...]。检测到时必须重写为具体的感官描写。"

### 方案 C：感官描写强制层 (Sensory Layer)
-   **原理**：文学性往往来自于“五感”。
-   **实现**：在 Writer Prompt 中强制要求：“每个场景必须包含至少一种非视觉描写（嗅觉/听觉/触觉）。”

---

## 4. 推荐实施路线

如果您希望提升系统能力，建议按以下优先级进行：

1.  **激活 `detectHighlights` (低成本，高回报)**: 修改 `AgentCoordinator`，在 Stylist 之前插入亮点分析，指导 Stylist 进行针对性润色。
2.  **角色声纹 (中成本)**: 修改 Character 数据结构和 Writer Prompt。
3.  **动态语气 (高成本)**: 需要修改 Planner 的场景生成逻辑和 Writer 的复杂 Prompt 逻辑。
