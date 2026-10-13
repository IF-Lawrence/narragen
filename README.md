# Narragen

一个尝试用 Multi-Agent 架构自动生成长篇小说的实验性项目。

> ⚠️ **项目状态**: 烂尾中。部分核心流程已跑通，但离实用还有距离。系统不太稳定

---

## 创作流程

```
输入灵感
    ↓
Planner 生成世界观与核心大纲
    ↓
规划分卷结构（每卷独立情绪曲线）
    ↓
逐章生成循环 ───────────────────────┐
    ↓                               │
┌────────────────────────────────────┐
│ 1. Planner 生成场景大纲             │
│ 2. Writer 撰写正文                 │
│ 3. Critic 评审逻辑与一致性          │
│ 4. Stylist 润色文风                │
│ 5. Archivist 提取因果、更新上下文    │
└────────────────────────────────────┘
    ↓
  章节完成 → 下一章循环 ←
```

**每章的生成过程**:
1. **Planner** 根据章节梗概生成 3-5 个场景
2. **Writer** 基于场景大纲撰写正文（流式输出）
3. **Critic** 检查角色行为一致性（OOC）、逻辑漏洞
4. **Stylist** 优化文笔、修辞、错别字
5. **Archivist** 提取本章关键事件、更新角色状态，作为下一章的上下文

---

## 现状

| 模块 | 状态 |
|---|---|
| 多 Agent 协作框架（Planner / Writer / Stylist / Critic / Archivist） | ✅ 已实现 |
| 章节流式生成 | ✅ 已实现 |
| SQLite 本地存储（项目、章节、角色状态） | ✅ 已实现 |
| UI 界面 | ❌ 部分未完工 |
| 上下文管理策略（滚动摘要 + 状态追踪） | ❌ 文档完整，代码可能未跟上 |
| 生产级错误处理 | ❌ 未做 |

---

## 技术栈

React · Vite · Material UI · SQLite · OpenAI API

---

## 快速开始

```bash
npm install
npm run dev
```

配置你的 OpenAI API Key 后可运行。

---

## 项目结构

```
src/
├── services/
│   ├── agents/
│   │   ├── PlannerAgent.js     # 场景规划
│   │   ├── WriterAgent.js      # 正文撰写
│   │   ├── CriticAgent.js      # 逻辑评审
│   │   ├── StylistAgent.js     # 文风润色
│   │   └── ArchivistAgent.js   # 状态更新
│   ├── AgentCoordinator.js     # 协调各 Agent
│   ├── ContentGenerationManager.js
│   ├── PromptManager.js         # 动态 Prompt 构建
│   └── storage.js              # SQLite 操作
├── components/                  # UI 组件
documentation/
├── novel_generation_flow.md    # 系统设计文档
└── operations_manual.md        # 运维调试文档
```

---

## 文档

设计思路和技术细节见：
- [novel_generation_flow.md](documentation/novel_generation_flow.md) — Agent 协议、Prompt 构建逻辑、张力曲线机制
- [operations_manual.md](documentation/operations_manual.md) — 数据结构、调试工具、故障排查

---

随便用，勿抱期望。