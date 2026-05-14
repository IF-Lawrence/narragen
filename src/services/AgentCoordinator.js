import { PlannerAgent } from './agents/PlannerAgent';
import { WriterAgent } from './agents/WriterAgent';
import { StylistAgent } from './agents/StylistAgent';
import { CriticAgent } from './agents/CriticAgent';
import { ArchivistAgent } from './agents/ArchivistAgent';
import { PlotMemoryAgent } from './agents/PlotMemoryAgent';
import { storage, storageEx } from './storage';
import { v4 as uuidv4 } from 'uuid';
import { openai } from './openai';
import { PromptLogger } from './PromptLogger';

export class AgentCoordinator {
  constructor() {
    this.planner = new PlannerAgent();
    this.writer = new WriterAgent();
    this.stylist = new StylistAgent();
    this.critic = new CriticAgent();
    this.archivist = new ArchivistAgent();
    this.plotMemory = new PlotMemoryAgent();
  }

  /**
   * Get character states at a specific chapter point.
   * Uses stateHistory to find the most recent state before the given chapter.
   * @param {Array} characters - Array of character objects
   * @param {number} chapterNumber - The chapter number being generated
   * @returns {string} - Formatted character states description
   */
  getCharacterStatesForChapter(characters, chapterNumber) {
    if (!characters || characters.length === 0) return '';

    const states = characters.map(char => {
      let state = '未知';

      // Look for the most recent state BEFORE this chapter
      if (char.stateHistory && char.stateHistory.length > 0) {
        // Filter to states from chapters before current
        const validStates = char.stateHistory
          .filter(h => h.chapter < chapterNumber)
          .sort((a, b) => b.chapter - a.chapter); // Sort descending

        if (validStates.length > 0) {
          state = validStates[0].state || '状态未知';
          console.log(`[AgentCoordinator] Using state snapshot for ${char.name} from chapter ${validStates[0].chapter}: ${state}`);
        } else {
          // No prior state, use initial description
          state = char.background || char.description || '初始状态';
          console.log(`[AgentCoordinator] No prior state for ${char.name}, using initial: ${state}`);
        }
      } else if (char.currentState?.description) {
        // Fallback to currentState if no history (legacy data)
        state = char.currentState.description;
      } else {
        state = char.background || char.description || '未知';
      }

      return `${char.name}: ${state}`;
    });

    return states.join('\n');
  }

  async *executeChapterFlowStream(projectId, chapterNumber, options = {}) {
    const signal = options.signal;
    const taskId = uuidv4(); // Generate unique Task ID for this session
    const taskName = `章节生成 (第${chapterNumber}章)`; // Task Name
    const project = await storage.getProject(projectId);
    const constraintsRows = await storageEx.getItems('constraints', { projectId });
    const constraints = constraintsRows.map(x => x.content).join('\n');
    const outlineRow = await storageEx.getCoreOutline(projectId);
    const outline = outlineRow ? outlineRow.content : '';
    const pre = await this.archivist.extractPreInfo({ projectId, chapterNodeId: null });

    // 0. Pre-update Character States (if not first chapter)
    if (chapterNumber > 1) {
      try {
        const nodes = await storageEx.getItems('chapter_nodes', { projectId });
        const prevNode = nodes.find(n => n.order === chapterNumber - 1);

        if (prevNode && prevNode.content) {
          yield { type: 'stage', stage: 'updatingCharacters', data: { preUpdate: true } };
          await this.updateCharacterStates(projectId, chapterNumber - 1, prevNode.content, taskId, taskName);
        }
      } catch (err) {
        console.warn('Failed to pre-update character states:', err);
      }
    }

    // Fetch characters (now updated)
    const characters = await storage.getItemsByProject('characters', projectId);

    // Fetch previous chapter summary for context
    let previousChapterSummary = '';
    if (chapterNumber > 1) {
      try {
        const nodes = await storageEx.getItems('chapter_nodes', { projectId });
        const prevNode = nodes.find(n => n.order === chapterNumber - 1);
        if (prevNode) {
          try {
            const s = JSON.parse(prevNode.summary);
            // Prioritize detailed scenes or full summary over one-line summary for immediate context
            previousChapterSummary = (s.scenes ? JSON.stringify(s.scenes) : null) || s.summary || s.oneSentence || prevNode.summary;
          } catch { previousChapterSummary = prevNode.summary; }
        }
      } catch (err) { console.warn('Failed to fetch previous chapter summary', err); }
    }

    if (signal && signal.aborted) throw new Error('aborted');
    yield { type: 'stage', stage: 'context', data: { pre } };

    // Use existing scenes if passed in options, otherwise generate
    // Use existing scenes if passed in options, otherwise generate
    let scenes = options.scenes;
    if (!scenes) {
      // Gather enhanced context for scene generation
      const previousChaptersSummary = await this.getPreviousChaptersSummary(projectId, chapterNumber, 3);
      const nextChapterSummary = await this.getNextChapterSummary(projectId, chapterNumber);

      // Calculate volume progress
      let volumeId = null;
      try {
        const vols = await storageEx.getItems('volumes', { projectId });
        const match = vols.find(v => typeof v.startChapter === 'number' && typeof v.endChapter === 'number' && chapterNumber >= v.startChapter && chapterNumber <= v.endChapter);
        volumeId = match ? match.id : null;
      } catch { }
      const volumeProgress = await this.calculateVolumeProgress(projectId, chapterNumber, volumeId);

      // Get character states
      const characterStates = this.getCharacterStatesForChapter(characters, chapterNumber);

      scenes = await this.planner.generateChapterScenes({
        volumeTheme: '',
        chapterOrder: chapterNumber,
        constraints,
        characters, // Pass characters to scene generation too if generating from scratch
        projectId,
        // Enhanced Context
        previousChaptersSummary,
        nextChapterSummary,
        volumeProgress,
        characterStates,
        taskId, // Pass taskId to planner
        taskName, // Pass taskName to planner
        chapterNumber // Pass chapter number for logging
      });

      if (signal && signal.aborted) throw new Error('aborted');
      yield { type: 'stage', stage: 'plan', data: { scenes } };

      // Only generate decisions if we just created the plan
      const decisions = await this.planner.generateDecisionOptions({ plan: scenes, projectId });
      yield { type: 'stage', stage: 'planComplete', data: { scenes } };
      yield { type: 'decisions', options: decisions };
    } else {
      // If scenes provided, just yield the plan event for UI update without re-generating
      yield { type: 'stage', stage: 'plan', data: { scenes } };
      yield { type: 'stage', stage: 'planComplete', data: { scenes } };
    }

    const writer = new WriterAgent();
    const stylist = new StylistAgent();
    const nodes = await storageEx.getItems('chapter_nodes', { projectId });
    const nodeForOrder = nodes.find(n => n.order === chapterNumber);

    // Determine Passion Level
    let passionLevel = options.passionLevel || 1;
    // If not in options, try to infer from node or default
    if (!options.passionLevel && nodeForOrder) {
      // Use saved passionLevel if available
      passionLevel = nodeForOrder.passionLevel || 1;
    }

    // Manual length control - use options.length or default to 2000
    const length = options.length || 2000;

    // ===== Enhanced Context Collection =====

    // 1. Get core outline
    // 1. Get core outline
    let coreOutline = null;
    try {
      const coreOutlineRow = await storageEx.getCoreOutline(projectId);
      if (coreOutlineRow && coreOutlineRow.content) {
        let content = coreOutlineRow.content;
        if (content.includes('```json')) {
          content = content.replace(/```json\n?|```\n?|```/g, '');
        } else if (content.includes('```')) {
          content = content.replace(/```\n?|```/g, '');
        }
        coreOutline = JSON.parse(content);
      }
    } catch (err) {
      console.warn('Failed to parse core outline:', err);
    }

    // 2. Calculate chapter position
    const allChapters = await storageEx.getItems('chapter_nodes', { projectId });
    const totalChapters = allChapters.length;
    const chapterPosition = {
      current: chapterNumber,
      total: totalChapters
    };

    // 3. Get previous key events
    const previousEvents = await this.archivist.getPreviousKeyEvents({
      projectId,
      currentChapter: chapterNumber,
      count: 3
    });

    // 4. Filter to only appearing characters
    const appearingCharNames = [...new Set(scenes.flatMap(s => s.characters || []))];
    const appearingCharacters = characters.filter(c => appearingCharNames.includes(c.name));

    // 5. Build Plot Memory Context (only if chapter > 1)
    let plotMemory = null;
    if (chapterNumber > 1) {
      yield { type: 'stage', stage: 'memory', data: { building: true } };
      plotMemory = await this.plotMemory.buildMemoryContext(projectId, chapterNumber);
      yield { type: 'stage', stage: 'memoryComplete', data: { plotMemory } };
    }

    // 6. Build Causality Context
    let causalityContext = '';
    let prevChapterNode = null;
    let nextChapterNode = null;

    try {
      // Get previous chapter
      if (chapterNumber > 1) {
        prevChapterNode = allChapters.find(n => n.order === chapterNumber - 1);
      }

      // Get next chapter
      nextChapterNode = allChapters.find(n => n.order === chapterNumber + 1);

      // Build context
      causalityContext = this.archivist.buildCausalityContext(prevChapterNode, scenes, nextChapterNode);
    } catch (err) {
      console.warn('Failed to build causality context:', err);
    }

    // ===== End Enhanced Context Collection =====

    // Fetch custom passion definitions
    let passionDefinitions = null;
    try {
      const raw = await storage.getItem(`passion_definitions_${projectId}`);
      if (raw) {
        passionDefinitions = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
    } catch (e) { console.warn('Failed to load passion definitions', e); }

    // 3. Generate Draft
    yield { type: 'stage', stage: 'writer', data: { scenesCount: scenes.length } };

    // Check if auto-continue mode is enabled
    const useAutoContinue = options.useAutoContinue ?? false;

    let writerText = '';

    if (useAutoContinue) {
      // Use auto-continue stream mode for long-form generation
      const writerStream = this.writer.executeStreamWithAutoContinue({
        plan: scenes,
        style: '现代中文叙事',
        length,
        characters: appearingCharacters,
        constraints,
        previousChapterSummary,
        passionLevel,
        passionDefinitions,
        coreOutline,
        chapterPosition: { current: chapterNumber, total: totalChapters },
        previousEvents: plotMemory ? plotMemory.events : [],
        plotMemory,
        causalityContext,
        mode: options.mode || 'full',
        currentText: options.currentText || '',
        taskId,
        taskName,
        chapterNumber,
        projectId,
        signal
      }, 5); // max 5 retries

      for await (const event of writerStream) {
        if (signal && signal.aborted) throw new Error('aborted');

        if (event.type === 'chunk') {
          writerText = event.fullContent;
          yield { type: 'chunk', stage: 'writer', content: event.content, fullContent: writerText };
        } else if (event.type === 'continue') {
          yield {
            type: 'stage', stage: 'writerContinue', data: {
              retryCount: event.retryCount,
              currentLength: event.currentLength,
              targetLength: event.targetLength
            }
          };
        } else if (event.type === 'complete') {
          console.log(`[AgentCoordinator] Writer auto-continue complete. Total: ${event.totalLength} chars, ${event.retryCount} retries`);
        }
      }
    } else {
      // Use standard stream mode
      const writerStream = this.writer.executeStream({
        plan: scenes,
        style: '现代中文叙事',
        length,
        characters: appearingCharacters,
        constraints,
        previousChapterSummary,
        passionLevel,
        passionDefinitions,
        coreOutline,
        chapterPosition: { current: chapterNumber, total: totalChapters },
        previousEvents: plotMemory ? plotMemory.events : [],
        plotMemory,
        causalityContext,
        mode: options.mode || 'full',
        currentText: options.currentText || '',
        taskId,
        taskName,
        chapterNumber,
        projectId,
        signal
      });

      for await (const chunk of writerStream) {
        if (signal && signal.aborted) throw new Error('aborted');
        writerText += chunk;
        yield { type: 'chunk', stage: 'writer', content: chunk, fullContent: writerText };
      }
    }

    yield { type: 'stage', stage: 'writerComplete', data: { wordCount: writerText.length } };

    // Analyze deviation
    yield { type: 'stage', stage: 'analysis', data: { draft: writerText } };
    const deviation = await this.planner.analyzeDeviation({ scenes, draft: writerText, projectId });
    yield { type: 'stage', stage: 'analysisComplete', data: { deviation } };



    // Critic evaluates the draft BEFORE styling
    // This allows Stylist to use both deviation analysis AND critique for improvements
    const critic = await this.critic.executeStructured({
      text: writerText,
      projectId,
      taskId, // Pass taskId to critic
      taskName, // Pass taskName to critic
      chapterNumber // Pass chapter number
    });
    yield { type: 'critic', data: critic };

    // Now stylist can use deviation analysis AND critique to improve the draft
    let styledText = '';
    yield { type: 'stage', stage: 'stylist', data: { draftLength: writerText.length, deviation, critique: critic } };

    if (useAutoContinue) {
      // Use auto-continue stream mode for long drafts
      const stylistStream = stylist.executeStreamWithAutoContinue({
        draft: writerText,
        tone: '高级、真实、节奏感强',
        deviationAnalysis: deviation,
        critique: critic,
        passionLevel,
        passionDefinitions,
        targetLength: length,
        projectId,
        taskId,
        taskName,
        chapterNumber,
        signal
      }, 5);

      for await (const event of stylistStream) {
        if (signal && signal.aborted) throw new Error('aborted');

        if (event.type === 'chunk') {
          styledText = event.fullContent;
          yield { type: 'chunk', stage: 'stylist', content: event.content, fullContent: styledText };
        } else if (event.type === 'continue') {
          yield {
            type: 'stage', stage: 'stylistContinue', data: {
              retryCount: event.retryCount,
              currentLength: event.currentLength,
              targetLength: event.targetLength
            }
          };
        } else if (event.type === 'complete') {
          console.log(`[AgentCoordinator] Stylist auto-continue complete. Total: ${event.totalLength} chars, ${event.retryCount} retries`);
        }
      }
    } else {
      // Use standard stream mode
      for await (const chunk of stylist.executeStream({
        draft: writerText,
        tone: '高级、真实、节奏感强',
        deviationAnalysis: deviation,
        critique: critic,
        passionLevel,
        passionDefinitions,
        targetLength: length,
        projectId,
        taskId,
        taskName,
        chapterNumber,
        signal
      })) {
        if (signal && signal.aborted) throw new Error('aborted');
        styledText += chunk;
        yield { type: 'chunk', stage: 'stylist', content: chunk, fullContent: styledText };
      }
    }

    yield { type: 'stage', stage: 'stylistComplete', data: { finalLength: styledText.length } };

    // 4. Extract Causality Data
    try {
      yield { type: 'stage', stage: 'causality', data: { extracting: true } };
      const causalityData = await this.archivist.extractCausality(styledText, scenes, {
        projectId,
        taskId,
        taskName,
        chapterNumber
      });

      // Update chapter node with causality data
      if (nodeForOrder) {
        await storage.updateItem('chapter_nodes', {
          ...nodeForOrder,
          ...causalityData,
          updatedAt: new Date().toISOString()
        });
      }
      yield { type: 'stage', stage: 'causalityComplete', data: { causality: causalityData } };
    } catch (err) {
      console.warn('Failed to extract causality:', err);
    }

    yield { type: 'stage', stage: 'complete', data: { finalLength: styledText.length } };
    // Map chapter to volumeId based on planned ranges
    let volumeId = null;
    try {
      const vols = await storageEx.getItems('volumes', { projectId });
      const match = vols.find(v => typeof v.startChapter === 'number' && typeof v.endChapter === 'number' && chapterNumber >= v.startChapter && chapterNumber <= v.endChapter);
      volumeId = match ? match.id : null;
    } catch { }

    // Legacy 'chapters' table removed
    // await storage.addItem('chapters', chapter);
    // yield { type: 'saved', chapter };
    await storageEx.addPlotEvent(projectId, null, 'plan', scenes);
    await storageEx.addPlotEvent(projectId, null, 'draft', writerText);
    await storageEx.addPlotEvent(projectId, null, 'refined', styledText);
    await storageEx.addPlotEvent(projectId, null, 'critique', JSON.stringify(critic));
    await this.archivist.archiveAndUpdate({ projectId, chapterNodeId: null, compressed: JSON.stringify({ summary: scenes }), pre });
    yield { type: 'stage', stage: 'archived' };

    // Update character states based on generated content
    yield { type: 'stage', stage: 'updatingCharacters' };
    const updates = await this.updateCharacterStates(projectId, chapterNumber, styledText, taskId, taskName);
    for (const update of updates) {
      yield { type: 'characterUpdate', data: update };
    }
    yield { type: 'stage', stage: 'updatingCharactersComplete' };

    yield { type: 'complete' };
  }

  async updateCharacterStates(projectId, chapterNumber, generatedContent, taskId = null, taskName = null) {
    try {
      // 1. Get all characters for this project
      const characters = await storage.getItemsByProject('characters', projectId);
      if (characters.length === 0) return [];

      // 2. Use AI to analyze character state changes
      const prompt = `分析以下章节中角色的最新状态，返回 JSON：
{
  "characterUpdates": [
    {
      "name": "角色名",
      "appeared": true/false,
      "currentSummary": "该角色在本章结束时的最新状态/处境总结（必填）",
      "emotionalState": "情感状态描述"
    }
  ]
}

章节内容：
${generatedContent.substring(0, 15000)}

已知角色：
${characters.map(c => c.name).join(', ')}`;

      const systemPrompt = '你是角色状态分析专家，提取角色在章节中的出场和最新状态。只返回 JSON，不要其他文字。';
      const result = await openai.generateText(prompt, systemPrompt, {
        response_format: { type: 'json_object' },
        temperature: 0.3,
        feature: 'planner'
      });

      // Log to Prompt Inspector
      await PromptLogger.log({
        projectId,
        agent: 'System (Character Update)',
        action: '分析角色状态变化',
        modules: {
          guidance: systemPrompt,
          context: `已生成内容长度: ${generatedContent.length}`,
          output_format: 'JSON'
        },
        fullPrompt: prompt,
        response: result,
        model: 'planner',
        taskId,
        taskName,
        chapterNumber
      });

      console.log('[AgentCoordinator] Character update raw result:', result);

      let updates;
      try {
        let jsonStr = result;
        // Strip markdown code blocks if present
        if (jsonStr.includes('```')) {
          jsonStr = jsonStr.replace(/```json\n?|```\n?|```/g, '');
        }
        updates = JSON.parse(jsonStr);
        console.log('[AgentCoordinator] Parsed updates:', updates);
      } catch (e) {
        console.error('Failed to parse character updates', e);
        return [];
      }

      const updatesList = [];
      // 3. Update character data
      const updatesArr = updates.characterUpdates || [];
      console.log('[AgentCoordinator] Processing', updatesArr.length, 'updates against', characters.length, 'characters');

      for (const update of updatesArr) {
        const char = characters.find(c => c.name === update.name);

        if (!char) {
          console.warn('[AgentCoordinator] Could not find character for update:', update.name);
          continue;
        }

        let needsUpdate = false;
        let changeDescription = null; // Track what changed for the UI log

        // Update appearance record
        if (update.appeared) {
          if (!char.chapterAppearances) char.chapterAppearances = [];
          if (!char.chapterAppearances.includes(chapterNumber)) {
            char.chapterAppearances.push(chapterNumber);
            char.chapterAppearances.sort((a, b) => a - b);
            needsUpdate = true;
          }
        }

        // Update current state (always update if appeared or summary provided)
        if (update.currentSummary || update.appeared) {
          if (!char.currentState) char.currentState = {};

          // Check if summary changed
          const oldSummary = char.currentState.description;
          const newSummary = update.currentSummary || char.currentState.description || '状态未知';

          if (oldSummary !== newSummary) {
            changeDescription = `状态变更: ${newSummary}`;
          }

          char.currentState = {
            chapter: chapterNumber,
            emotional: update.emotionalState || '',
            description: newSummary
          };

          // Add to history
          if (!char.stateHistory) char.stateHistory = [];

          // Prevent duplicate history entries for the same chapter
          const existingHistoryIndex = char.stateHistory.findIndex(h => h.chapter === chapterNumber);
          const historyEntry = {
            chapter: chapterNumber,
            state: newSummary,
            trigger: `第${chapterNumber}章更新`,
            timestamp: new Date().toISOString()
          };

          if (existingHistoryIndex >= 0) {
            char.stateHistory[existingHistoryIndex] = historyEntry;
          } else {
            char.stateHistory.push(historyEntry);
          }
          needsUpdate = true;
        }

        // Save if updated
        if (needsUpdate) {
          char.updatedAt = new Date().toISOString();
          await storage.updateItem('characters', char);

          // Add to return list for UI notification
          updatesList.push({
            name: char.name,
            changes: changeDescription ? [changeDescription] : ['登场/活跃'],
            ...update
          });
        }
      }
      return updatesList;
    } catch (err) {
      console.error('Failed to update character states:', err);
      // Don't throw - this is a non-critical feature
      return [];
    }
  }

  async createVolumePlanFlow(projectId, targetCount = 4, volumeConfigs = [], options = {}) {
    const outlineRow = await storageEx.getCoreOutline(projectId);
    const coreOutlineText = outlineRow?.content || '';
    let coreOutlineParsed = coreOutlineText;
    try {
      let t = coreOutlineText;
      if (t.includes('```')) t = t.replace(/```json\n?|```\n?|```/g, '');
      coreOutlineParsed = JSON.parse(t);
    } catch { }
    const result = await this.planner.createVolumePlan(coreOutlineParsed, targetCount, volumeConfigs, projectId, options);
    const arr = Array.isArray(result?.volumes) ? result.volumes : [];
    const target = Math.max(1, Number(targetCount) || 4);
    const volumesToWrite = arr.slice(0, target);
    const existing = await storageEx.getVolumes(projectId);
    for (const ev of existing) {
      const nodes = await storageEx.getChapterNodesByVolume(ev.id);
      for (const n of nodes) await storage.deleteItem('chapter_nodes', n.id);
      await storage.deleteItem('volumes', ev.id);
    }
    const saved = [];
    for (let i = 0; i < volumesToWrite.length; i++) {
      const v = volumesToWrite[i];
      const item = {
        id: uuidv4(),
        projectId,
        name: v.title || '',
        order: i + 1,
        description: v.summary || '',
        mainGoal: v.mainGoal || '',
        keyEvents: v.keyEvents || [],
        cliffhanger: v.cliffhanger || '',
        startChapter: null,
        endChapter: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await storageEx.addVolume(projectId, item);
      saved.push(item);
    }

    // Save subplots and foreshadowing to project metadata
    const subplots = Array.isArray(result?.subplots) ? result.subplots : [];
    const foreshadowing = Array.isArray(result?.foreshadowing) ? result.foreshadowing : [];
    await storage.setItem(`volumePlan_subplots_${projectId}`, JSON.stringify(subplots));
    await storage.setItem(`volumePlan_foreshadowing_${projectId}`, JSON.stringify(foreshadowing));

    return saved;
  }
  async regenerateVolumeFlow(projectId, volumeId, guidance = '') {
    const volumes = await storageEx.getVolumes(projectId);
    const targetVolume = volumes.find(v => v.id === volumeId);
    if (!targetVolume) throw new Error('Volume not found');

    const sortedVolumes = volumes.sort((a, b) => a.order - b.order);
    const index = sortedVolumes.findIndex(v => v.id === volumeId);
    const previousVolume = index > 0 ? sortedVolumes[index - 1] : null;
    const nextVolume = index < sortedVolumes.length - 1 ? sortedVolumes[index + 1] : null;

    const outlineRow = await storageEx.getCoreOutline(projectId);
    const coreOutlineText = outlineRow?.content || '';
    let coreOutlineParsed = coreOutlineText;
    try {
      let t = coreOutlineText;
      if (t.includes('```')) t = t.replace(/```json\n?|```\n?|```/g, '');
      coreOutlineParsed = JSON.parse(t);
    } catch { }

    const result = await this.planner.regenerateSingleVolume({
      coreOutline: coreOutlineParsed,
      targetVolume,
      previousVolume,
      nextVolume,
      guidance
    });

    const updatedVolume = {
      ...targetVolume,
      name: result.title || targetVolume.name,
      description: result.summary || targetVolume.description,
      mainGoal: result.mainGoal || targetVolume.mainGoal,
      keyEvents: result.keyEvents || targetVolume.keyEvents || [],
      cliffhanger: result.cliffhanger || targetVolume.cliffhanger || '',
      updatedAt: new Date().toISOString()
    };

    await storage.updateItem('volumes', updatedVolume);
    return updatedVolume;
  }
}
