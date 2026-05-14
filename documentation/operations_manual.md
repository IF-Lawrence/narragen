# 运维与调试手册 (Operations & Debugging Manual)

> **目标读者**: DevOps, 后端开发, 如果您是系统架构师也强烈建议阅读。
> **文档密级**: 内部技术参考

本文档旨在补充架构设计文档中未覆盖的“落地实操”细节，包括数据图谱、调试工具链以及边缘情况的防御机制。

## 1. 数据图谱 (Data Schema)

本系统采用 REST-like API (`/api/storage`) 进行数据持久化。理解数据结构对于调试至关重要。

### 1.1 核心实体 (Core Entities)

| 实体 (Table) | 描述 | 关键字段 (Key Fields) |
| :--- | :--- | :--- |
| **projects** | 小说项目 | `id`, `name`, `bookStyle` (JSON), `createdAt` |
| **volumes** | 分卷信息 | `projectId`, `order`, `keyEvents` (Array) |
| **chapter_nodes** | 章节节点 | `volumeId`, `summary` (JSON), `content` (Text), `wordCount` |
| **characters** | 角色档案 | `projectId`, `currentState` (JSON), `relationships` (JSON) |
| **agent_activities** | 智能体活动 | `chapterId`, `agent`, `status`, `logs` |
| **prompt_logs** | 提示词日志 | `fullPrompt`, `response`, `model`, `tokens` |

### 1.2 关键 JSON 结构

**Character State (角色状态)**
存储于 `characters.currentState`:
```json
{
  "chapter": 12, // 最近一次更新发生的章节
  "description": "林凡正躲在废弃仓库中，身负重伤。",
  "emotional": "绝望",
  "updatedAt": "2024-03-20T10:00:00Z"
}
```

**Plot Memory (剧情记忆)**
存储于 `settings:plot_state_{projectId}_{timestamp}` (TimeSeries 数据):
```json
{
  "events": ["事件A", "事件B"],
  "clues": ["伏笔A"],
  "tags": ["悬疑", "高潮"]
}
```

---

## 2. 调试工具链 (Debugging Toolchain)

### 2.1 Prompt Inspector (黑盒录像机)
系统内置了 `PromptLogger` 服务，记录了每一次 LLM 调用的完整“请求-响应”对。

*   **访问方式**: 前端 `PromptInspector.jsx` 组件或 API `/api/storage/prompt_logs`。
*   **用途**:
    1.  **复现幻觉**: 当 Writer 写出离谱剧情时，检查 Log 中的 `previousChapterSummary` 是否本身就有误。
    2.  **优化提示词**: 复制 `fullPrompt` 到外部 Playground (如 ChatGPT) 进行微调。

### 2.2 常见故障排查 (Troubleshooting)

#### Case A: 角色“失忆” (Character Amnesia)
*   **现象**: 主角在第10章明明断了腿，第11章却健步如飞。
*   **排查步骤**:
    1.  检查 `characters` 表中该角色的 `currentState` 是否更新到了第10章。
    2.  如果未更新，检查 `ArchivistAgent` 在第10章的 `updateCharacterStates` 是否执行成功。
    3.  查看 Prompt Log，确认 Writer 在生成第11章时，`characterContext` 变量中是否包含“断腿”描述。

#### Case B: 剧情死循环 (Plot Loop)
*   **现象**: Writer 不断重复上一章的结尾。
*   **原因**: `previousChapterSummary` 注入了过多细节，且 Writer 的 `temperature` 过低 (< 0.5)。
*   **解决**: 调高 Writer 温度至 0.8，或在 Planner 中强制插入新的 `Conflict`。

---

## 3. 边界情况防御 (Edge Case Defense)

### 3.1 安全拒绝 (Safety Refusal)
*   **场景**: 用户设置了 Passion Level 5 (禁忌)，导致模型返回 "I cannot generate this content"。
*   **防御**:
    -   系统在检测到 Level 4+ 时，会在 Prompt 中自动注入 `Unlock Constraints` 指令 ("You are writing a fictional story...").
    -   **运维建议**: 如果依然拒绝，建议降低 Level 或更换为对内容审查较宽松的模型 (如 Claude / Local Models)。

### 3.2 上下文溢出 (Context Overflow)
*   **场景**: 剧情极其复杂，导致 `Prompt` 超过 128k token。
*   **机制**: `AgentCoordinator` 会强制执行 **"Aggressive Summarization"**。
    -   放弃 `history` (历史章节摘要)。
    -   仅保留 `coreOutline` 和 `currentChapterScene`。
*   **监控**: 关注 `PromptLogger` 中的 `token_usage`，若接近阈值需发出警告。

---

## 4. 性能与成本概算 (Token Economics)

*   **Average Chapter (3000 words)**:
    -   Planner (Scene): ~1k tokens
    -   Writer (Draft): ~6k tokens (Input) + ~4k tokens (Output)
    -   Critic (Review): ~5k tokens
    -   Stylist (Refine): ~5k tokens (Input) + ~4k tokens (Output)
*   **Total**: ~25k tokens / 章。
*   **建议**: 仅在 Writer/Stylist 使用 GPT-4 级别模型，其他环节使用 GPT-3.5/Haiku 以降低成本。
