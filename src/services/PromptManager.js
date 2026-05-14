import { storage } from './storage';
import { DEFAULT_PROMPTS, getPromptById } from '../config/defaultPrompts';

/**
 * PromptManager - Manages prompt templates with priority-based resolution
 * 
 * Priority: User Custom > Default
 * 
 * Features:
 * - In-memory caching for performance
 * - Template variable rendering
 * - User customization support
 * - Import/Export functionality
 */
class PromptManagerClass {
    constructor() {
        this.cache = new Map(); // In-memory cache
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get a prompt template with priority resolution
     * @param {string} agent - Agent name (e.g., 'writer', 'planner')
     * @param {string} type - Prompt type (e.g., 'main', 'coreOutline')
     * @returns {Promise<Object>} Prompt object
     */
    /**
     * Get a prompt template with priority resolution
     * @param {string} agent - Agent name (e.g., 'writer', 'planner')
     * @param {string} type - Prompt type (e.g., 'main', 'coreOutline')
     * @param {string} projectId - Optional: Project ID for project-specific overrides
     * @returns {Promise<Object>} Prompt object
     */
    async getPrompt(agent, type = 'main', projectId = null) {
        const promptId = `${agent}_${type}`;

        // Check cache first (cache key needs to include projectId)
        const cacheKey = projectId ? `${promptId}_${projectId}` : promptId;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.prompt;
        }

        let customPrompt = null;

        // 1. Try project-specific override first
        if (projectId) {
            try {
                const raw = await storage.getItem(`prompt_${promptId}_${projectId}`);
                customPrompt = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch (err) {
                console.warn(`Failed to load project prompt ${promptId}_${projectId}:`, err);
            }
        }

        // 2. If no project override, try global custom prompt
        if (!customPrompt) {
            try {
                const raw = await storage.getItem(`prompt_${promptId}`);
                customPrompt = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch (err) {
                console.warn(`Failed to load global custom prompt ${promptId}:`, err);
            }
        }

        // Use custom prompt if exists, otherwise use default
        const prompt = customPrompt || getPromptById(promptId);

        if (!prompt) {
            console.warn(`Prompt not found: ${promptId}, using fallback`);
            return this.getFallbackPrompt(agent, type);
        }

        // Cache the result
        this.cache.set(cacheKey, {
            prompt,
            timestamp: Date.now()
        });

        return prompt;
    }

    /**
     * Save a custom prompt (user override)
     * @param {string} agent - Agent name
     * @param {string} type - Prompt type
     * @param {Object} promptData - Prompt data to save
     * @param {string} projectId - Optional: Project ID to save as project-specific
     */
    async savePrompt(agent, type, promptData, projectId = null) {
        const promptId = `${agent}_${type}`;

        // If projectId is provided, append it to the storage key
        const storageKey = projectId ? `prompt_${promptId}_${projectId}` : `prompt_${promptId}`;

        const customPrompt = {
            ...promptData,
            id: promptId, // Keep original ID reference
            agent,
            type,
            customized: true,
            projectId: projectId || null, // Track scope
            originalId: promptId,
            updatedAt: new Date().toISOString()
        };

        await storage.setItem(storageKey, customPrompt);

        // Invalidate cache
        const cacheKey = projectId ? `${promptId}_${projectId}` : promptId;
        this.cache.delete(cacheKey);

        return customPrompt;
    }

    /**
     * Reset a prompt to default (remove customization)
     * @param {string} agent - Agent name
     * @param {string} type - Prompt type
     * @param {string} projectId - Optional: Project ID to reset only project-specific override
     */
    async resetPrompt(agent, type, projectId = null) {
        const promptId = `${agent}_${type}`;
        const storageKey = projectId ? `prompt_${promptId}_${projectId}` : `prompt_${promptId}`;

        // Remove from IndexedDB using storage.deleteSetting (alias for deleteItem in storage.js context, or should use deleteItem/deleteSetting keys)
        // Checking storage.js: deleteSetting(key) calls db.delete('settings', key)
        try {
            await storage.deleteSetting(storageKey);
        } catch (err) {
            console.warn(`Failed to reset prompt ${storageKey}:`, err);
        }

        // Invalidate cache
        const cacheKey = projectId ? `${promptId}_${projectId}` : promptId;
        this.cache.delete(cacheKey);

        // If satisfying a project request, we might fall back to global custom or default
        // But the caller usually just wants to trigger a reload.
        // Returning fresh resolved prompt is best practice.
        return this.getPrompt(agent, type, projectId);
    }

    /**
     * Render a template with variables
     * @param {string} template - Template string with {{variable}} syntax
     * @param {Object} variables - Variables to replace
     * @returns {string} Rendered template
     */
    renderTemplate(template, variables = {}) {
        if (!template) return '';

        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            const value = variables[key];

            // Handle undefined/null
            if (value === undefined || value === null) {
                return '';
            }

            // Handle objects/arrays (stringify)
            if (typeof value === 'object') {
                return JSON.stringify(value, null, 2);
            }

            return String(value);
        });
    }

    /**
     * List all available prompts
     * @param {string} agent - Optional: filter by agent
     * @returns {Promise<Array>} List of prompts
     */
    async listPrompts(agent = null) {
        const prompts = Object.values(DEFAULT_PROMPTS);

        if (agent) {
            return prompts.filter(p => p.agent === agent);
        }

        return prompts;
    }

    /**
     * List all customized prompts
     * @param {string} projectId - Optional: Filter for a specific project
     * @returns {Promise<Array>} List of customized prompts
     */
    async listCustomPrompts(projectId = null) {
        const customPrompts = [];

        try {
            // Get all keys from settings store
            const allKeys = await storage.getAllKeys();

            for (const key of allKeys) {

                if (key.startsWith('prompt_')) {
                    const raw = await storage.getItem(key);
                    let value;
                    try {
                        value = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    } catch (e) {
                        console.warn(`Failed to parse prompt setting ${key}:`, e);
                        continue;
                    }

                    if (value && value.customized) {
                        // Filter logic:
                        // If projectId is provided, we want:
                        // 1. Valid Global prompts (projectId is null/undefined)
                        // 2. Specific prompts for this project
                        // But actually, we usually want to know "what are the active overrides for this project".
                        // However, typical UI usage is "Merge Default + Global Custom + Project Custom".

                        // Let's return EVERYTHING and let UI filter/merge?
                        // Or safer: return all relevant to this project context.

                        if (projectId) {
                            // Include if it belongs to this project OR is global
                            if (value.projectId === projectId || !value.projectId) {
                                customPrompts.push(value);
                            }
                        } else {
                            // If no project context, maybe only global?
                            // Or all? For now let's just return global if no projectId passed
                            if (!value.projectId) {
                                customPrompts.push(value);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to list custom prompts:', err);
        }

        return customPrompts;
    }

    /**
     * Export a prompt as JSON
     * @param {string} agent - Agent name
     * @param {string} type - Prompt type
     * @returns {Promise<string>} JSON string
     */
    async exportPrompt(agent, type, projectId = null) {
        const prompt = await this.getPrompt(agent, type, projectId);
        return JSON.stringify(prompt, null, 2);
    }

    /**
     * Import a prompt from JSON
     * @param {string} jsonString - JSON string
     * @returns {Promise<Object>} Imported prompt
     */
    async importPrompt(jsonString) {
        try {
            const promptData = JSON.parse(jsonString);

            if (!promptData.agent || !promptData.type) {
                throw new Error('Invalid prompt format: missing agent or type');
            }

            return await this.savePrompt(promptData.agent, promptData.type, promptData);
        } catch (err) {
            throw new Error(`Failed to import prompt: ${err.message}`);
        }
    }

    /**
     * Clear all cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Get fallback prompt when prompt not found
     * @private
     */
    getFallbackPrompt(agent, type) {
        return {
            id: `${agent}_${type}_fallback`,
            agent,
            type,
            name: `${agent} ${type} (Fallback)`,
            description: 'Fallback prompt - please configure properly',
            system: `You are a ${agent} agent.`,
            template: 'Please process the following:\n{{input}}',
            variables: [
                { name: 'input', description: 'Input data', example: 'Any input' }
            ],
            version: '0.0.0',
            createdAt: new Date().toISOString()
        };
    }
}

// Export singleton instance
export const PromptManager = new PromptManagerClass();
